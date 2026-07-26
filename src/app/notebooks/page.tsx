// app/notebooks/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Notebook = {
  id: string;
  name: string;
  created_at: string;
};

export default function NotebooksPage() {
  const router = useRouter();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const fetchNotebooks = async () => {
    const res = await fetch('/api/notebooks');
    const data = await res.json();
    setNotebooks(data?.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchNotebooks(); }, []);

  const createNotebook = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch('/api/notebooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    const json = await res.json();
    const notebook = json?.data ?? json;
    setCreating(false);
    setNewName('');
    setShowModal(false);
    setNotebooks((n) => [notebook, ...n]);
    router.push(`/notebooks/${notebook.id}`);
  };

  const submitRename = async (id: string) => {
    if (!renameValue.trim()) return;
    await fetch(`/api/notebooks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue }),
    });
    setRenamingId(null);
    fetchNotebooks();
  };

  const deleteNotebook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this notebook and all its sources?')) return;
    await fetch(`/api/notebooks/${id}`, { method: 'DELETE' });
    setNotebooks((n) => n.filter((nb) => nb.id !== id));
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      {/* ── Ambient background glow ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/[0.04] blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-violet-600/[0.04] blur-3xl" />
      </div>

      {/* ── Top navigation bar ── */}
      <nav className="relative border-b border-white/[0.06] animate-fade-in">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center text-sm">
              ☕
            </div>
            <span className="text-sm font-semibold tracking-tight">ChaiBookLM</span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                       gradient-accent text-white
                       hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]
                       active:scale-[0.97] transition-all duration-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New notebook
          </button>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="relative max-w-5xl mx-auto px-6 py-10">
        {/* Hero section */}
        <div className="mb-10 animate-slide-up">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Your notebooks
          </h1>
          <p className="text-sm text-white/35">
            {loading
              ? 'Loading your workspace…'
              : notebooks.length === 0
                ? 'Create a notebook to start researching with AI.'
                : `${notebooks.length} notebook${notebooks.length !== 1 ? 's' : ''} in your workspace`
            }
          </p>
        </div>

        {/* ── Loading skeletons ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-44 rounded-2xl animate-shimmer min-w-60"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>

        /* ── Empty state ── */
        ) : notebooks.length === 0 ? (
          <div className="animate-scale-in">
            <div
              className="border-2 border-dashed border-white/[0.08] rounded-3xl py-24 flex flex-col items-center gap-6 
                         hover:border-white/[0.15] transition-colors duration-500 cursor-pointer"
              onClick={() => setShowModal(true)}
            >
              {/* Glowing icon */}
              <div className="relative">
                <div className="w-24 h-24 rounded-3xl gradient-accent opacity-15 blur-2xl absolute inset-0 m-auto" />
                <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center text-3xl relative">
                  📓
                </div>
              </div>

              <div className="text-center">
                <h3 className="text-lg font-semibold mb-1 text-white/70">No notebooks yet</h3>
                <p className="text-sm text-white/30 max-w-xs">
                  Create your first notebook to upload sources and start chatting with AI.
                </p>
              </div>

              <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                              gradient-accent text-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Create your first notebook
              </div>
            </div>
          </div>

        /* ── Notebook grid ── */
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {notebooks.map((nb, i) => (
              <div
                key={nb.id}
                onClick={() => renamingId !== nb.id && router.push(`/notebooks/${nb.id}`)}
                onMouseEnter={() => setHoveredId(nb.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="animate-slide-up group relative glass glass-hover rounded-2xl p-5 cursor-pointer min-w-60
                           transition-all duration-300 hover:translate-y-[-2px]
                           hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)]
                           flex flex-col justify-between h-44"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* Hover glow accent */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500
                                bg-gradient-to-br from-indigo-500/[0.04] to-violet-500/[0.04] pointer-events-none" />

                {/* Top section */}
                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20
                                    border border-white/[0.08] flex items-center justify-center text-lg">
                      📓
                    </div>

                    {/* Three-dot menu (visible on hover) */}
                    <div className={`flex items-center gap-1 transition-opacity duration-200 ${
                      hoveredId === nb.id ? 'opacity-100' : 'opacity-0'
                    }`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(nb.id);
                          setRenameValue(nb.name);
                        }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10
                                   text-white/40 hover:text-white transition-all"
                        aria-label="Rename"
                        title="Rename"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => deleteNotebook(nb.id, e)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/20
                                   text-white/40 hover:text-red-400 transition-all"
                        aria-label="Delete"
                        title="Delete"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {renamingId === nb.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRename(nb.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onBlur={() => submitRename(nb.id)}
                      className="w-full bg-transparent border-b border-indigo-400/50 outline-none text-sm font-medium pb-1
                                 text-white placeholder:text-white/30"
                      placeholder="Notebook name"
                    />
                  ) : (
                    <h3 className="font-semibold text-sm text-white/85 truncate pr-2 group-hover:text-white transition-colors">
                      {nb.name}
                    </h3>
                  )}
                </div>

                {/* Bottom section */}
                <div className="relative flex items-center justify-between">
                  <span className="text-[11px] text-white/25">
                    {formatDate(nb.created_at)}
                  </span>
                  <div className={`flex items-center gap-1.5 text-[11px] text-indigo-300/60 transition-opacity duration-200 ${
                    hoveredId === nb.id ? 'opacity-100' : 'opacity-0'
                  }`}>
                    <span>Open</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}

            {/* ── "Create new" card ── */}
            <div
              onClick={() => setShowModal(true)}
              className="animate-slide-up rounded-2xl border-2 border-dashed border-white/[0.08]
                         hover:border-indigo-500/30 hover:bg-indigo-500/[0.03]
                         cursor-pointer transition-all duration-300
                         flex flex-col items-center justify-center h-44 gap-3
                         group"
              style={{ animationDelay: `${notebooks.length * 60}ms` }}
            >
              <div className="w-10 h-10 rounded-xl border border-white/[0.1] group-hover:border-indigo-500/40
                              flex items-center justify-center transition-all duration-300
                              group-hover:shadow-[0_0_16px_rgba(99,102,241,0.15)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                     className="text-white/30 group-hover:text-indigo-400 transition-colors">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <span className="text-xs text-white/30 group-hover:text-white/50 transition-colors">
                New notebook
              </span>
            </div>
          </div>
        )}
      </main>

      {/* ── Create Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
          onClick={() => setShowModal(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md mx-4 bg-[#0a0a0f] rounded-2xl border border-white/[0.1] animate-scale-in overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div>
                <h2 className="text-base font-semibold">Create notebook</h2>
                <p className="text-xs text-white/30 mt-0.5">A workspace for your research</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-white/40 hover:text-white"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <label className="block text-xs text-white/40 mb-2 font-medium uppercase tracking-wider">
                Notebook name
              </label>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createNotebook()}
                placeholder="e.g. Machine Learning Research"
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.1] px-4 py-3 text-sm
                           placeholder:text-white/20 outline-none
                           focus:border-indigo-500/40 focus:shadow-[0_0_16px_rgba(99,102,241,0.06)]
                           transition-all duration-200"
              />
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/[0.06]">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={createNotebook}
                disabled={creating || !newName.trim()}
                className="px-5 py-2 rounded-xl text-sm font-medium
                           gradient-accent text-white
                           disabled:opacity-30 disabled:cursor-not-allowed
                           hover:shadow-[0_0_16px_rgba(99,102,241,0.3)]
                           active:scale-[0.97] transition-all duration-200"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                    Creating…
                  </span>
                ) : (
                  'Create notebook'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="mt-auto relative border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <p className="text-[11px] text-white/15">
            Powered by <span className="gradient-accent-text font-medium">ChaiBookLM</span>
          </p>
          <p className="text-[11px] text-white/15">
            Built with ☕ and AI
          </p>
        </div>
      </footer>
    </div>
  );
}