// lib/ingestion/vtt.ts
import webvtt from 'node-webvtt';
import { ExtractionResult } from './types';
import { groupByTimeWindow, TimedCaption } from './time-chunker';

export function extractVtt(fileContent: string): ExtractionResult {
  const parsed = webvtt.parse(fileContent);

  if (!parsed.cues || parsed.cues.length === 0) {
    throw new Error('No cues found in this VTT file — check the file is valid WebVTT format');
  }

  // node-webvtt gives start/end in seconds already, unlike youtube-transcript's ms
  const timedCaptions: TimedCaption[] = parsed.cues.map((cue: any) => ({
    text: cue.text.replace(/\s+/g, ' ').trim(),
    startSec: cue.start,
    endSec: cue.end,
  }));

  return { segments: groupByTimeWindow(timedCaptions) };
}