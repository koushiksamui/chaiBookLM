// lib/ingestion/pdf.ts
import { ExtractionResult } from './types';

// pdfjs-dist needs its worker disabled in a Node (non-browser) environment
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function extractPdf(fileBuffer: Buffer): Promise<ExtractionResult> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer) });
  const pdf = await loadingTask.promise;

  const segments: ExtractionResult['segments'] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // textContent.items is a flat list of text fragments with position data.
    // Join them into one string per page — good enough for chunking; we don't
    // need per-word coordinates, just per-page text + the page number.
    const pageText = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (pageText.length === 0) continue; // skip blank pages (e.g. images-only)

    // Split each page into paragraph-ish segments so the chunker has
    // reasonable boundaries, same as the text extractor.
    const paragraphs = pageText
      .split(/(?<=[.?!])\s+(?=[A-Z])/) // rough sentence-group split
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // Group sentences back into ~2-4 sentence chunks per page rather than
    // one segment per sentence (too granular) or one per page (too coarse).
    const groupSize = 3;
    for (let i = 0; i < paragraphs.length; i += groupSize) {
      const group = paragraphs.slice(i, i + groupSize).join(' ');
      segments.push({
        text: group,
        metadata: { page: pageNum },
      });
    }
  }

  return { segments };
}