// lib/ingestion/text.ts
import { ExtractionResult } from './types';

export function extractText(rawText: string): ExtractionResult {
  // Split into paragraphs so later chunking has natural boundaries to work with,
  // rather than one giant blob of text.
  const paragraphs = rawText
    .split(/\n\s*\n/)  // Split when there is a new line, whitespace and then a new line
    .map((p) => p.trim()) // Trim leading and trailing whitespace from each paragraph
    .filter((p) => p.length > 0); // Filter out any resulting empty strings (e.g. if there were >2 newlines)

  let charOffset = 0;
  const segments = paragraphs.map((text) => {
    const segment = {
      text,
      metadata: { char_offset: charOffset },
    };
    charOffset += text.length;
    return segment;
  });

  return { segments };
}