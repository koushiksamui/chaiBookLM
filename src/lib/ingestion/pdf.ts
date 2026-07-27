// lib/ingestion/pdf.ts
// Uses pdf-parse v1 — a pure Node.js library with no DOM dependencies,
// safe to run in Vercel serverless environments (no DOMMatrix, no Worker API).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse');
import { ExtractionResult } from './types';

export async function extractPdf(fileBuffer: Buffer): Promise<ExtractionResult> {
  const data = await pdfParse(fileBuffer);

  // data.text is the full extracted text across all pages.
  const fullText: string = data.text.replace(/\s+/g, ' ').trim();

  const segments: ExtractionResult['segments'] = [];

  if (fullText.length === 0) return { segments };

  // Split into paragraph-ish segments on sentence boundaries.
  const paragraphs = fullText
    .split(/(?<=[.?!])\s+(?=[A-Z])/)
    .map((p: string) => p.trim())
    .filter((p: string) => p.length > 0);

  // Group sentences into ~3-sentence chunks.
  const groupSize = 3;
  for (let i = 0; i < paragraphs.length; i += groupSize) {
    const group = paragraphs.slice(i, i + groupSize).join(' ');
    segments.push({
      text: group,
      metadata: {},
    });
  }

  return { segments };
}