// lib/rag/prompt.ts
import { RetrievedChunk } from './retrieve';

export function buildPrompt(question: string, chunks: RetrievedChunk[]) {
  const sourceBlocks = chunks
    .map((chunk, i) => {
      const label = chunk.metadata.page
        ? `page ${chunk.metadata.page}`
        : chunk.metadata.start_time !== undefined
        ? `${Math.floor(chunk.metadata.start_time / 60)}:${String(chunk.metadata.start_time % 60).padStart(2, '0')}`
        : 'source';
      return `[${i + 1}] (${label}): ${chunk.content}`;
    })
    .join('\n\n');

  const systemPrompt = `You are a research assistant answering questions using ONLY the sources provided below.

Rules:
- Answer using only information found in the sources.
- If the sources don't contain the answer, say so clearly — do not guess or use outside knowledge.
- Cite every claim with the matching source number in square brackets, e.g. [1] or [2][3].
- Keep answers concise and well-formatted (use bullet points or short paragraphs where helpful).

Sources:
${sourceBlocks}`;

  return { systemPrompt, userPrompt: question };
}