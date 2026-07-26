// lib/ingestion/youtube.ts
import { YoutubeTranscript } from 'youtube-transcript';
import { ExtractionResult } from './types';
import { groupByTimeWindow, TimedCaption } from './time-chunker';

function extractVideoId(url: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&]+)/,
    /(?:youtu\.be\/)([^?]+)/,
    /(?:youtube\.com\/embed\/)([^?]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  throw new Error(`Could not extract video ID from URL: ${url}`);
}

export async function extractYoutube(url: string): Promise<ExtractionResult> {
  const videoId = extractVideoId(url);

  let captions;
  try {
    captions = await YoutubeTranscript.fetchTranscript(videoId);
  } catch (err: any) {
    throw new Error(
      `Could not fetch transcript for this video — it may have captions disabled. (${err.message})`
    );
  }

  if (!captions || captions.length === 0) {
    throw new Error('No transcript available for this video');
  }

  const timedCaptions: TimedCaption[] = captions.map((c) => ({
    text: c.text,
    startSec: c.offset / 1000,
    endSec: (c.offset + c.duration) / 1000,
  }));

  return { segments: groupByTimeWindow(timedCaptions) };
}