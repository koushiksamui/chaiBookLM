// lib/ingestion/types.ts
export type ExtractedSegment = {
  text: string;
  metadata: Record<string, any>; // e.g. { page: 3 } or { start_time: 125 }
};

export type ExtractionResult = {
  segments: ExtractedSegment[];
};