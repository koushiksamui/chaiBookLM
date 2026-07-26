// app/notebooks/[id]/page.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SourceViewerModal from '@/components/SourceViewerModal';

/* ────────────────────────── Types ────────────────────────── */
type Source = {
  id: string;
  type: string;
  title: string;
  status: 'uploading' | 'indexing' | 'ready' | 'failed';
};

type Citation = {
  marker: number;
  sourceId: string;
  content: string;
  metadata: Record<string, any>;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
};

/* ────────────────────────── Icons ────────────────────────── */
const TYPE_ICON: Record<string, string> = {
  pdf: '📄',
  text: '📝',
  youtube: '🎥',
  url: '🔗',
  vtt: '🎬',
};

const SUGGESTED_PROMPTS = [
  'Summarize all my sources',
  'What are the key takeaways?',
  'Compare the main topics',
  'Create a study guide',
];

/* ═══════════════════════════════════════════════════════════ */
/*  MAIN PAGE                                                 */
/* ═══════════════════════════════════════════════════════════ */
export default function NotebookDetailPage() {
  const { id: notebookId } = useParams<{ id: string }>();
  const router = useRouter();

  /* ── state ── */
  const [notebookName, setNotebookName] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [topK, setTopK] = useState(5);
  const [viewingCitation, setViewingCitation] = useState<{ sourceId: string; content: string; metadata?: Record<string, any> } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  /* ── data fetching ── */
  const fetchNotebookName = useCallback(async () => {
    try {
      const res = await fetch('/api/notebooks');
      const json = await res.json();
      const nb = json?.data?.find((n: { id: string }) => n.id === notebookId);
      if (nb) setNotebookName(nb.name);
    } catch { /* silent */ }
  }, [notebookId]);

  const fetchSources = useCallback(async () => {
    setSourcesLoading(true);
    try {
      const res = await fetch(`/api/sources?notebookId=${notebookId}`);
      const data = await res.json();
      setSources(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    setSourcesLoading(false);
  }, [notebookId]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?notebookId=${notebookId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(
          data.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            citations: m.citations,
          }))
        );
      }
    } catch { /* silent */ }
  }, [notebookId]);

  useEffect(() => {
    fetchNotebookName();
    fetchSources();
    fetchMessages();
  }, [fetchNotebookName, fetchSources, fetchMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // polling for source status
  useEffect(() => {
    const hasPendingSources = sources.some(
      (s) => s.status === 'uploading' || s.status === 'indexing'
    );

    if (hasPendingSources && !pollingRef.current) {
      pollingRef.current = setInterval(() => {
        fetchSources();
      }, 2000);
    }

    if (!hasPendingSources && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [sources]);

  /* ── source actions ── */
  const deleteSource = async (id: string) => {
    setSources((s) => s.filter((src) => src.id !== id));
    await fetch(`/api/sources/${id}`, { method: 'DELETE' });
  };

  const toggleSource = (id: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /* ── chat ── */
  const sendMessage = async (text?: string) => {
    const question = text ?? input;
    if (!question.trim()) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: question };
    const assistantMsgId = crypto.randomUUID();

    setMessages((m) => [
      ...m,
      userMsg,
      { id: assistantMsgId, role: 'assistant', content: '' },
    ]);
    setInput('');
    setIsThinking(true);

    // Save the user message immediately — fire-and-forget
    fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notebookId, role: 'user', content: question }),
    });

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, notebookId, topK }),
      });

      setIsThinking(false);

      if (!res.ok) {
        const err = await res.json();
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, content: `Error: ${err.error}` } : msg
          )
        );
        return;
      }

      const citationsHeader = res.headers.get('X-Citations');
      const citations: Citation[] = citationsHeader
        ? JSON.parse(atob(citationsHeader))
        : [];

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: accumulated, citations }
                : msg
            )
          );
        }
      }

      // Save the completed assistant message with full citation data
      fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId,
          role: 'assistant',
          content: accumulated,
          citations,
        }),
      });
    } catch (e: any) {
      setIsThinking(false);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantMsgId ? { ...msg, content: `Error: ${e.message}` } : msg
        )
      );
    }
  };

  const readySources = sources.filter((s) => s.status === 'ready');

  /* ═══════════════════════════════════════════════════════════ */
  /*  RENDER                                                    */
  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-screen bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] shrink-0 animate-fade-in">
        <button
          onClick={() => router.push('/notebooks')}
          className="group flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
        >
          <span className="inline-block transition-transform group-hover:-translate-x-0.5">←</span>
          Notebooks
        </button>
        <span className="text-white/20">|</span>
        <h1 className="text-sm font-medium truncate max-w-xs">
          {notebookName || (
            <span className="inline-block w-32 h-4 rounded animate-shimmer" />
          )}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-white/30">
            {readySources.length} source{readySources.length !== 1 ? 's' : ''} ready
          </span>
        </div>
      </header>

      {/* ── Main 3-column layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ──────────── LEFT: Sources Sidebar ──────────── */}
        <aside className="w-72 border-r border-white/[0.06] flex flex-col shrink-0 animate-slide-in-left">
          {/* Sidebar header */}
          <div className="px-4 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Sources
              </h2>
              <span className="text-[10px] text-white/30 glass rounded-full px-2 py-0.5">
                {sources.length}
              </span>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium
                         border border-white/[0.12] hover:border-indigo-500/50
                         bg-gradient-to-r from-indigo-500/10 to-violet-500/10
                         hover:from-indigo-500/20 hover:to-violet-500/20
                         transition-all duration-300 group"
            >
              <span className="text-base transition-transform group-hover:scale-110">+</span>
              Add source
            </button>
          </div>

          {/* Source list */}
          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5">
            {sourcesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl animate-shimmer" />
              ))
            ) : sources.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-fade-in">
                <div className="text-4xl mb-3 opacity-40">📚</div>
                <p className="text-xs text-white/30 leading-relaxed">
                  No sources yet.<br />Add PDFs, text, or YouTube links to get started.
                </p>
              </div>
            ) : (
              sources.map((s, i) => (
                <SourceCard
                  key={s.id}
                  source={s}
                  selected={selectedSources.has(s.id)}
                  onToggle={() => toggleSource(s.id)}
                  onDelete={() => deleteSource(s.id)}
                  onRetry={async () => {
                    await fetch('/api/ingest', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ sourceId: s.id }),
                    });
                    fetchSources();
                  }}
                  style={{ animationDelay: `${i * 50}ms` }}
                />
              ))
            )}
          </div>
        </aside>

        {/* ──────────── CENTER: Chat Panel ──────────── */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {messages.length === 0 && !isThinking ? (
              <EmptyState onPromptClick={sendMessage} />
            ) : (
              <div className="max-w-2xl mx-auto flex flex-col gap-5">
                {messages.map((msg, i) => (
                  <ChatBubble
                    key={msg.id}
                    message={msg}
                    sources={sources}
                    onCitationClick={(citation) =>
                      setViewingCitation({
                        sourceId: citation.sourceId,
                        content: citation.content,
                        metadata: citation.metadata,
                      })
                    }
                    style={{ animationDelay: `${i * 60}ms` }}
                  />
                ))}
                {isThinking && <TypingIndicator />}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="px-6 pb-5 pt-2 shrink-0 animate-slide-up">
            <div className="max-w-2xl mx-auto flex justify-end mb-2">
              <select
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="bg-transparent border border-white/20 rounded-full px-3 py-1 text-xs text-gray-400 outline-none cursor-pointer hover:border-white/40 transition-colors"
              >
                <option value={5} className="bg-black text-white">5 sources</option>
                <option value={8} className="bg-black text-white">8 sources</option>
                <option value={12} className="bg-black text-white">12 sources</option>
              </select>
            </div>
            <div
              className="max-w-2xl mx-auto glass rounded-2xl flex items-end gap-3 px-4 py-3
                         transition-all duration-300 focus-within:border-indigo-500/40 focus-within:shadow-[0_0_20px_rgba(99,102,241,0.08)]"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask about your sources..."
                rows={1}
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/25
                           resize-none max-h-32 leading-relaxed"
                style={{ minHeight: '24px' }}
              />
              <div className="flex items-center gap-2 shrink-0 pb-0.5">
                <span className="text-[10px] text-white/20 tabular-nums">
                  {input.length > 0 ? input.length : ''}
                </span>
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim()}
                  className="w-8 h-8 rounded-xl flex items-center justify-center
                             gradient-accent text-white
                             disabled:opacity-30 disabled:cursor-not-allowed
                             hover:shadow-[0_0_16px_rgba(99,102,241,0.4)]
                             active:scale-95 transition-all duration-200"
                  aria-label="Send message"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            <p className="text-center text-[10px] text-white/15 mt-2">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </main>

        {/* ──────────── RIGHT: Studio Panel ──────────── */}
        <aside className="w-72 border-l border-white/[0.06] flex flex-col shrink-0 animate-slide-in-right">
          <div className="px-4 py-4 border-b border-white/[0.06]">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
              Studio
            </h2>
          </div>
          <div className="flex-1 px-4 py-4 flex flex-col gap-2">
            {[
              { icon: '✨', label: 'Generate summary', desc: 'Summarize all sources' },
              { icon: '📋', label: 'Study guide', desc: 'Create flashcards & notes' },
              { icon: '🎙️', label: 'Audio overview', desc: 'Generate podcast-style audio' },
              { icon: '💡', label: 'FAQ', desc: 'Auto-generate questions' },
              { icon: '📊', label: 'Timeline', desc: 'Extract key events' },
            ].map((action) => (
              <button
                key={action.label}
                className="glass glass-hover rounded-xl px-4 py-3 text-left transition-all duration-200
                           group hover:translate-x-0.5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg group-hover:scale-110 transition-transform">
                    {action.icon}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                      {action.label}
                    </p>
                    <p className="text-[11px] text-white/30">{action.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Bottom branding */}
          <div className="px-4 py-4 border-t border-white/[0.06]">
            <p className="text-[11px] text-white/20 text-center">
              Powered by <span className="gradient-accent-text font-medium">ChaiBookLM</span>
            </p>
          </div>
        </aside>
      </div>

      {/* ── Upload Modal ── */}
      {showUploadModal && (
        <UploadModal
          notebookId={notebookId}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => {
            setShowUploadModal(false);
            fetchSources();
          }}
        />
      )}

      {/* ── Source Viewer Modal ── */}
      {viewingCitation && (
        <SourceViewerModal
          sourceId={viewingCitation.sourceId}
          citedChunkContent={viewingCitation.content}
          citedChunkMetadata={viewingCitation.metadata}
          onClose={() => setViewingCitation(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  SOURCE CARD                                               */
/* ═══════════════════════════════════════════════════════════ */
function SourceCard({
  source,
  selected,
  onToggle,
  onDelete,
  onRetry,
  style,
}: {
  source: Source;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRetry?: () => void;
  style?: React.CSSProperties;
}) {
  const statusLabel: Record<string, { color: string; text: string }> = {
    uploading: { color: 'bg-white/30', text: 'Uploading' },
    indexing: { color: 'bg-amber-400 animate-pulse', text: 'Indexing' },
    ready: { color: 'bg-emerald-400', text: 'Ready' },
    failed: { color: 'bg-red-400', text: 'Failed' },
  };

  const status = statusLabel[source.status] ?? statusLabel.uploading;

  return (
    <div
      style={style}
      className={`animate-slide-up group relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer
                  transition-all duration-200 border
                  ${selected
          ? 'border-indigo-500/40 bg-indigo-500/[0.08]'
          : 'border-transparent hover:bg-white/[0.04]'
        }`}
      onClick={onToggle}
      title={
        source.status === 'uploading' ? 'Uploading...' :
        source.status === 'indexing' ? 'Indexing content...' :
        source.status === 'ready' ? 'Ready to query' :
        'Indexing failed — click to retry'
      }
    >
      {/* Checkbox */}
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all
                    ${selected
            ? 'border-indigo-400 bg-indigo-500'
            : 'border-white/20 group-hover:border-white/40'
          }`}
      >
        {selected && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </div>

      {/* Icon */}
      <span className="text-base shrink-0">{TYPE_ICON[source.type] ?? '📎'}</span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate text-white/80">{source.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${status.color}`} />
          <span className="text-[10px] text-white/30">{status.text}</span>
          {source.status === 'failed' && onRetry && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              className="text-[10px] text-indigo-300 hover:text-indigo-200 shrink-0 ml-2"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400"
        aria-label="Delete source"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
        </svg>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  CHAT BUBBLE                                               */
/* ═══════════════════════════════════════════════════════════ */
function ChatBubble({
  message,
  sources,
  onCitationClick,
  style,
}: {
  message: Message;
  sources: Source[];
  onCitationClick: (citation: Citation) => void;
  style?: React.CSSProperties;
}) {
  const isUser = message.role === 'user';

  return (
    <div
      style={style}
      className={`animate-slide-up flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                    ${isUser
            ? 'gradient-accent text-white rounded-br-md'
            : 'glass text-white/85 rounded-bl-md'
          }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {/* Citation chips */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/10">
            {[...new Map(message.citations.map((c) => [c.sourceId, c])).values()].map((citation) => {
              const src = sources.find((s) => s.id === citation.sourceId);
              return (
                <button
                  key={citation.sourceId}
                  onClick={() => onCitationClick(citation)}
                  className="inline-flex items-center gap-1 text-[10px] text-indigo-300 bg-indigo-500/10
                             border border-indigo-500/20 rounded-full px-2 py-0.5
                             hover:border-indigo-400 hover:bg-indigo-500/20 transition-colors cursor-pointer"
                >
                  <span className="opacity-60">[{citation.marker}]</span>
                  {src?.title ?? 'Source'}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  TYPING INDICATOR                                          */
/* ═══════════════════════════════════════════════════════════ */
function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="glass rounded-2xl rounded-bl-md px-5 py-4 flex items-center gap-1.5">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  EMPTY STATE                                               */
/* ═══════════════════════════════════════════════════════════ */
function EmptyState({ onPromptClick }: { onPromptClick: (text: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center animate-fade-in px-4">
      {/* Brand mark */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-3xl gradient-accent opacity-20 blur-2xl absolute inset-0 m-auto" />
        <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center text-3xl relative">
          ☕
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-2 text-white/80">
        What would you like to know?
      </h2>
      <p className="text-sm text-white/30 mb-8 text-center max-w-sm">
        Ask a question about your sources. I&apos;ll analyze them and respond with cited answers.
      </p>

      {/* Suggested prompts */}
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPromptClick(prompt)}
            className="glass glass-hover rounded-full px-4 py-2 text-xs text-white/50
                       hover:text-white/80 transition-all duration-200 hover:translate-y-[-1px]
                       hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  UPLOAD MODAL                                              */
/* ═══════════════════════════════════════════════════════════ */
function UploadModal({
  notebookId,
  onClose,
  onUploaded,
}: {
  notebookId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [tab, setTab] = useState<'text' | 'file' | 'youtube'>('file');
  const [textSource, setTextSource] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const TABS = [
    { key: 'file' as const, label: 'File', icon: '📁' },
    { key: 'text' as const, label: 'Text', icon: '📝' },
    { key: 'youtube' as const, label: 'YouTube', icon: '🎥' },
  ];

  const submitText = async () => {
    if (!textSource.trim()) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('notebookId', notebookId);
    formData.append('type', 'text');
    formData.append('title', textSource.slice(0, 40) || 'Text source');
    formData.append('content', textSource);
    await fetch('/api/sources', { method: 'POST', body: formData });
    setUploading(false);
    setUploadSuccess(true);
    setTimeout(onUploaded, 600);
  };

  const submitFile = async (file: File) => {
    setUploading(true);
    const type = file.name.endsWith('.vtt') ? 'vtt' : 'pdf';
    const formData = new FormData();
    formData.append('notebookId', notebookId);
    formData.append('type', type);
    formData.append('title', file.name);
    formData.append('file', file);
    await fetch('/api/sources', { method: 'POST', body: formData });
    setUploading(false);
    setUploadSuccess(true);
    setTimeout(onUploaded, 600);
  };

  const submitYoutube = async () => {
    if (!youtubeUrl.trim()) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('notebookId', notebookId);
    formData.append('type', 'youtube');
    formData.append('title', youtubeUrl);
    formData.append('url', youtubeUrl);
    await fetch('/api/sources', { method: 'POST', body: formData });
    setUploading(false);
    setUploadSuccess(true);
    setTimeout(onUploaded, 600);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) submitFile(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg mx-4 bg-[#0a0a0f] rounded-2xl border border-white/[0.1] animate-scale-in overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-base font-semibold">Add source</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-white/40 hover:text-white"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-all duration-200
                          ${tab === t.key
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
                }`}
            >
              <span className="text-sm">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-6 py-5">
          {uploadSuccess ? (
            <div className="py-12 flex flex-col items-center gap-3 animate-scale-in">
              <div className="text-4xl">✅</div>
              <p className="text-sm text-white/60">Source added successfully!</p>
            </div>
          ) : uploading ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white/40">Uploading…</p>
            </div>
          ) : tab === 'file' ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl py-14 flex flex-col items-center gap-4 transition-all duration-300
                          ${dragOver
                  ? 'border-indigo-400 bg-indigo-500/[0.06]'
                  : 'border-white/[0.12] hover:border-white/20'
                }`}
            >
              <div className="text-4xl opacity-40">📂</div>
              <div className="text-center">
                <p className="text-sm text-white/60 mb-1">Drag & drop files here</p>
                <p className="text-xs text-white/25">PDF, VTT supported</p>
              </div>
              <label
                className="mt-2 px-5 py-2 rounded-xl text-sm font-medium cursor-pointer
                           gradient-accent text-white hover:shadow-[0_0_16px_rgba(99,102,241,0.3)]
                           active:scale-95 transition-all duration-200"
              >
                Browse files
                <input
                  type="file"
                  accept=".pdf,.vtt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) submitFile(file);
                  }}
                />
              </label>
            </div>
          ) : tab === 'text' ? (
            <div className="flex flex-col gap-4">
              <textarea
                value={textSource}
                onChange={(e) => setTextSource(e.target.value)}
                placeholder="Paste or type your text content here..."
                className="w-full h-40 rounded-xl bg-white/[0.03] border border-white/[0.1] px-4 py-3 text-sm
                           placeholder:text-white/20 outline-none resize-none
                           focus:border-indigo-500/40 transition-colors"
              />
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-white/20">
                  {textSource.length} characters
                </span>
                <button
                  onClick={submitText}
                  disabled={!textSource.trim()}
                  className="px-5 py-2 rounded-xl text-sm font-medium
                             gradient-accent text-white
                             disabled:opacity-30 disabled:cursor-not-allowed
                             hover:shadow-[0_0_16px_rgba(99,102,241,0.3)]
                             active:scale-95 transition-all duration-200"
                >
                  Add text source
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitYoutube()}
                  placeholder="https://youtube.com/watch?v=..."
                  className="flex-1 rounded-xl bg-white/[0.03] border border-white/[0.1] px-4 py-3 text-sm
                             placeholder:text-white/20 outline-none
                             focus:border-indigo-500/40 transition-colors"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={submitYoutube}
                  disabled={!youtubeUrl.trim()}
                  className="px-5 py-2 rounded-xl text-sm font-medium
                             gradient-accent text-white
                             disabled:opacity-30 disabled:cursor-not-allowed
                             hover:shadow-[0_0_16px_rgba(99,102,241,0.3)]
                             active:scale-95 transition-all duration-200"
                >
                  Add YouTube source
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}