// lib/ingestion/time-chunker.ts
import { ExtractionResult } from './types';

export type TimedCaption = {
  text: string;
  startSec: number;
  endSec: number;
};

// Group consecutive timed captions into ~windowSeconds-long chunks so
// citations jump to a meaningful segment, not a single caption line.
export function groupByTimeWindow(
  captions: TimedCaption[],
  windowSeconds = 35
): ExtractionResult['segments'] {
  const segments: ExtractionResult['segments'] = [];
  let currentGroup: string[] = [];
  let groupStart: number | null = null;
  let groupEnd = 0;

  for (const caption of captions) {
    if (groupStart === null) groupStart = caption.startSec;
    currentGroup.push(caption.text);
    groupEnd = caption.endSec;

    if (groupEnd - groupStart >= windowSeconds) {
      segments.push({
        text: currentGroup.join(' ').replace(/\s+/g, ' ').trim(),
        metadata: { start_time: Math.floor(groupStart), end_time: Math.floor(groupEnd) },
      });
      currentGroup = [];
      groupStart = null;
    }
  }

  if (currentGroup.length > 0 && groupStart !== null) {
    segments.push({
      text: currentGroup.join(' ').replace(/\s+/g, ' ').trim(),
      metadata: { start_time: Math.floor(groupStart), end_time: Math.floor(groupEnd) },
    });
  }

  return segments;
}