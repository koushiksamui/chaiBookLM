// components/SourceViewerModal.tsx
'use client';
import { useEffect, useState } from 'react';

type Props = {
  sourceId: string;
  citedChunkContent: string;
  citedChunkMetadata?: Record<string, any>;
  onClose: () => void;
};

export default function SourceViewerModal({ sourceId, citedChunkContent, citedChunkMetadata, onClose }: Props) {
  const [source, setSource] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sources/${sourceId}/content`)
      .then((res) => res.json())
      .then((data) => {
        setSource(data);
        setLoading(false);
      });
  }, [sourceId]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-black border border-white/15 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-white/10">
          <h3 className="font-medium truncate">{source?.title ?? 'Loading...'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">
            ×
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading source...</p>
          ) : source.type === 'pdf' ? (
            <PdfViewer signedUrl={source.signedUrl} citedText={citedChunkContent} />
          ) : source.type === 'youtube' ? (
            <YoutubeViewer url={source.original_ref} citedText={citedChunkContent} startTime={citedChunkMetadata?.start_time} />
          ) : source.type === 'vtt' ? (
            <TranscriptViewer signedUrl={source.signedUrl} citedText={citedChunkContent} />
          ) : (
            <TextViewer text={source.metadata?.rawText ?? ''} citedText={citedChunkContent} />
          )}
        </div>
      </div>
    </div>
  );
}

function HighlightedText({ text, citedText }: { text: string; citedText: string }) {
  // Simple substring match highlight — the cited chunk should appear verbatim
  // in the full text since it came directly from extraction
  const idx = text.indexOf(citedText.slice(0, 60)); // match on first 60 chars, safer than full string
  if (idx === -1) {
    return <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>;
  }
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + citedText.length);
  const after = text.slice(idx + citedText.length);

  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {before}
      <mark className="bg-indigo-500/30 text-white rounded px-0.5">{match}</mark>
      {after}
    </p>
  );
}

function TextViewer({ text, citedText }: { text: string; citedText: string }) {
  return <HighlightedText text={text} citedText={citedText} />;
}

function TranscriptViewer({ signedUrl, citedText }: { signedUrl: string; citedText: string }) {
  const [content, setContent] = useState('');
  useEffect(() => {
    fetch(signedUrl).then((r) => r.text()).then(setContent);
  }, [signedUrl]);
  return <HighlightedText text={content} citedText={citedText} />;
}

function YoutubeViewer({ url, citedText, startTime }: { url: string; citedText: string; startTime?: number }) {
  const videoId = url.match(/(?:v=|youtu\.be\/)([^&?]+)/)?.[1];
  const embedSrc = startTime
    ? `https://www.youtube.com/embed/${videoId}?start=${Math.floor(startTime)}`
    : `https://www.youtube.com/embed/${videoId}`;
  return (
    <div>
      <div className="aspect-video mb-3">
        <iframe
          className="w-full h-full rounded-lg"
          src={embedSrc}
          allowFullScreen
        />
      </div>
      {startTime !== undefined && (
        <p className="text-xs text-gray-500 mb-2">
          Seeking to {Math.floor(startTime / 60)}:{String(Math.floor(startTime % 60)).padStart(2, '0')}
        </p>
      )}
      <p className="text-xs text-gray-500 mb-1">Cited transcript segment:</p>
      <p className="text-sm bg-white/5 rounded p-3">{citedText}</p>
    </div>
  );
}

function PdfViewer({ signedUrl, citedText }: { signedUrl: string; citedText: string }) {
  return (
    <div>
      <iframe src={signedUrl} className="w-full h-[50vh] rounded-lg mb-3" />
      <p className="text-xs text-gray-500 mb-1">Cited excerpt:</p>
      <p className="text-sm bg-white/5 rounded p-3">{citedText}</p>
    </div>
  );
}