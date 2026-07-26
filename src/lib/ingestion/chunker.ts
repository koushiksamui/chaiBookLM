// lib/ingestion/chunker.ts
import { getEncoding } from 'js-tiktoken';
import { ExtractionResult } from './types';

const enc = getEncoding('cl100k_base'); // same tokenizer family as OpenAI embeddings

function countTokens(text: string): number {
  return enc.encode(text).length;
}

const TARGET_TOKENS = 600;
const MAX_TOKENS = 800;
const OVERLAP_TOKENS = 80;

// Token-based chunking for text/PDF/URL segments — merges small segments
// (paragraphs, page groups) up to ~600-800 tokens, with a small overlap
// carried into the next chunk so context isn't lost at boundaries.
function chunkByTokens(segments: ExtractionResult['segments']): ExtractionResult['segments'] {
  const chunks: ExtractionResult['segments'] = [];
  let buffer: typeof segments = [];
  let bufferTokens = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const text = buffer.map((s) => s.text).join(' ');
    // Keep the metadata from the first segment in the buffer (e.g. its page
    // number) — good enough for citation purposes; a chunk spanning two
    // pages cites the page it starts on.
    chunks.push({ text, metadata: buffer[0].metadata });

    // Carry the last ~OVERLAP_TOKENS worth of segments into the next buffer
    let overlapTokens = 0;
    const overlapSegments: typeof segments = [];
    for (let i = buffer.length - 1; i >= 0; i--) {
      const t = countTokens(buffer[i].text);
      if (overlapTokens + t > OVERLAP_TOKENS) break;
      overlapSegments.unshift(buffer[i]);
      overlapTokens += t;
    }
    buffer = overlapSegments;
    bufferTokens = overlapTokens;
  };

  for (const segment of segments) {
    const segTokens = countTokens(segment.text);

    if (bufferTokens + segTokens > MAX_TOKENS) {
      flush();
    }

    buffer.push(segment);
    bufferTokens += segTokens;

    if (bufferTokens >= TARGET_TOKENS) {
      flush();
    }
  }

  flush(); // remaining partial buffer
  return chunks;
}

// Time-based segments (YouTube/VTT) already arrive in sensible ~35s windows
// from the extractor — pass through as-is. If a window is unusually long
// (e.g. a slow talker producing a huge caption block), split it in half.
function chunkByTime(segments: ExtractionResult['segments']): ExtractionResult['segments'] {
  return segments.flatMap((segment) => {
    const tokens = countTokens(segment.text);
    if (tokens <= MAX_TOKENS) return [segment];

    // Rare fallback: split an oversized time-window segment in half by text,
    // keeping the same start/end time metadata (approximate but safe)
    const midpoint = Math.floor(segment.text.length / 2);
    const splitPoint = segment.text.indexOf(' ', midpoint);
    const cut = splitPoint === -1 ? midpoint : splitPoint;

    return [
      { text: segment.text.slice(0, cut).trim(), metadata: segment.metadata },
      { text: segment.text.slice(cut).trim(), metadata: segment.metadata },
    ];
  });
}

export function chunkExtractedContent(
  extraction: ExtractionResult
): ExtractionResult['segments'] {
  const isTimeBased = extraction.segments.some((s) => 'start_time' in s.metadata);
  return isTimeBased ? chunkByTime(extraction.segments) : chunkByTokens(extraction.segments);
}