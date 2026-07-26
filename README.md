# ChaiBookLM — AI Research Workspace

An AI-powered research assistant inspired by Google's NotebookLM. Upload multiple knowledge sources into isolated notebooks, ask natural-language questions, and get grounded answers with clickable citations that jump straight back to the original source.

Built to understand — end to end — how modern RAG (Retrieval Augmented Generation) systems actually work: ingestion, chunking, embedding, vector search, and grounded generation.

**Live demo:** [add your deployment URL here]
**Demo video:** [add your video link here]

---

## What it does

- Create multiple notebooks, each with its own isolated knowledge base
- Add sources in five formats: plain text, PDF, website URL, YouTube video, and VTT/transcript files
- Every source goes through a visible pipeline: uploading → indexing → ready (or failed, with retry)
- Ask questions in a chat interface — answers stream token-by-token
- Every answer includes numbered citations back to the exact chunk that produced it
- Click a citation to open the original source: PDF at the right page, YouTube at the right timestamp, text/transcript with the cited passage highlighted
- Conversation history persists per notebook

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js app                            │
│  ┌───────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │  Notebook UI  │  │  Upload / chat  │  │  Source viewer  │  │
│  │  (list, CRUD) │  │  UI             │  │  (modal)        │  │
│  └───────┬───────┘  └────────┬────────┘  └────────┬────────┘  │
│          │                    │                     │           │
│  ┌───────┴────────────────────┴─────────────────────┴───────┐  │
│  │                     API routes (app/api/*)                 │  │
│  │  /notebooks   /sources   /ingest   /query   /messages      │  │
│  └───────┬─────────────────────────────────────────┬─────────┘  │
└──────────┼─────────────────────────────────────────┼────────────┘
           │                                          │
   ┌───────┴────────┐                        ┌────────┴────────┐
   │  Ingestion       │                        │  Retrieval        │
   │  pipeline        │                        │  + generation     │
   │  (lib/ingestion) │                        │  (lib/rag)        │
   └───────┬────────┘                        └────────┬────────┘
           │                                          │
   ┌───────┴──────────────────────────────────────────┴────────┐
   │              Supabase (Postgres + pgvector + Storage)        │
   │   notebooks · sources · chunks (embeddings) · messages       │
   └───────────────────────────────────────────────────────────┘
                              │
                      ┌───────┴───────┐
                      │  OpenAI API     │
                      │  embeddings +   │
                      │  gpt-4o-mini    │
                      └────────────────┘
```

### Why this stack

- **Next.js** — one codebase for both frontend and API routes, deploys as a single Vercel project
- **Supabase (Postgres + pgvector)** — avoids running a separate vector database; metadata and embeddings live in the same relational store, so joins between chunks/sources/notebooks are trivial SQL
- **OpenAI `text-embedding-3-small`** — 1536-dimension embeddings, cheap and fast enough for iterative indexing
- **Vercel AI SDK (`streamText`)** — handles token-by-token streaming without hand-rolling SSE parsing

---

## Ingestion pipeline

Every source — regardless of type — goes through the same five stages. Only extraction and chunking differ per type; embedding and storage are identical for all of them.

```
Source uploaded (status: uploading)
        │
        ▼
Extract content (type-specific extractor)
        │
        ▼
Chunk into segments (token-based or time-based)
        │
        ▼
Generate embeddings (one vector per chunk)
        │
        ▼
Store in vector DB (status: ready for querying)
```

### Extraction, per source type

| Source | How it's extracted | Position metadata kept |
|---|---|---|
| Plain text | Read directly, split by paragraph | character offset |
| PDF | `pdfjs-dist`, page by page | page number |
| Website URL | Fetch + `cheerio`, strips nav/ads, keeps `<p>/<h*>/<li>` blocks | tag type |
| YouTube | `youtube-transcript` pulls auto-captions with timestamps | start/end time (seconds) |
| VTT / transcript file | `node-webvtt` parses cue blocks | start/end time (seconds) |

### Chunking strategy

- **Token-based sources** (text, PDF, URL): merged into ~600–800 token windows using `js-tiktoken` (`cl100k_base` encoding), with an ~80-token overlap carried into the next chunk so context isn't lost at boundaries.
- **Time-based sources** (YouTube, VTT): grouped into ~35-second windows instead of by token count, since a citation that jumps to the middle of a sentence is useless — jumping to the start of a coherent ~35s segment is not.
- Every chunk retains the metadata needed to open the exact spot it came from later (`page`, or `start_time`/`end_time`).

### Embedding + storage

- Chunks are embedded in batches of 20 via the OpenAI embeddings API (`text-embedding-3-small`, 1536 dimensions) to avoid rate limits.
- Each chunk is inserted into Postgres with its `notebook_id`, `source_id`, raw text, embedding vector, and metadata JSON.
- A source's status flips `uploading → indexing → ready` as it moves through this pipeline, or `failed` (with the error message stored) if any stage throws — failed sources can be retried without re-uploading.

---

## Retrieval + answer generation

```
User question
      │
      ▼
Embed the question (same model as chunks)
      │
      ▼
Vector search — pgvector cosine similarity,
scoped to notebook_id, top-k configurable (default 8)
      │
      ▼
Build prompt: numbered sources + question +
instruction to cite every claim as [1] [2] ...
      │
      ▼
Stream answer from gpt-4o-mini (Vercel AI SDK)
      │
      ▼
Attach retrieved chunk metadata as citation data
(sent via response header, not parsed from text)
```

**Why citations aren't parsed from the LLM's output text:** relying on the model to always emit correctly-formatted `[1]` markers pointing at real chunks is fragile. Instead, the actual retrieved chunks (with their source ID, text, and page/timestamp metadata) are attached to the response directly from the retrieval step — so citation data is always accurate regardless of what the model's prose happens to say.

**Notebook isolation:** every retrieval query filters by `notebook_id` at the SQL level (`match_chunks` Postgres function), so one notebook's sources are never visible to another's queries.

---

## Source viewer

Clicking a citation opens a modal scoped to the specific chunk that was cited (not just "some part of this source"):

- **PDF** → renders the file (via a signed Supabase Storage URL) with the cited excerpt shown alongside
- **YouTube** → embeds the video with `?start=<seconds>` set to the cited chunk's timestamp
- **Text** → highlights the cited passage within the full source text
- **VTT/transcript** → same highlighting, applied to the parsed transcript

---

## Project structure

```
src/app/
  notebooks/                 notebook list page
  notebooks/[id]/             notebook detail — sources + chat
  api/
    notebooks/                CRUD
    sources/                  create, list, delete
    sources/[id]/content/      signed URL / content for source viewer
    ingest/                    extraction → chunk → embed → store
    query/                     retrieval + streamed generation
    messages/                  chat history persistence
src/lib/
  ingestion/
    text.ts, pdf.ts, url.ts, youtube.ts, vtt.ts   one extractor per type
    time-chunker.ts            shared time-window grouping (YouTube + VTT)
    chunker.ts                 token-based chunking (text/PDF/URL)
    embed.ts                   batched OpenAI embedding calls
    types.ts                   shared ExtractionResult type
  rag/
    retrieve.ts                 vector search
    prompt.ts                   prompt construction
  db/
    client.ts                   Supabase client
src/components/
  SourceViewerModal.tsx
scripts/
  test-*.ts                    standalone test scripts per pipeline stage
```

---

## Setup

### Prerequisites

- Node.js 18+
- A Supabase project (free tier is enough)
- An OpenAI API key

### 1. Clone and install

```bash
git clone https://github.com/koushiksamui/chaiBookLM.git
cd chai-book-lm
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. In the SQL editor, enable pgvector and create the schema:

```sql
create extension if not exists vector;

create table notebooks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table sources (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid references notebooks(id) on delete cascade,
  type text check (type in ('pdf','text','url','youtube','vtt')),
  title text,
  original_ref text,
  status text default 'uploading',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id) on delete cascade,
  notebook_id uuid references notebooks(id) on delete cascade,
  content text,
  embedding vector(1536),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
create index on chunks using ivfflat (embedding vector_cosine_ops);

create table messages (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid references notebooks(id) on delete cascade,
  role text check (role in ('user','assistant')),
  content text,
  citations jsonb default '[]',
  created_at timestamptz default now()
);
create index on messages (notebook_id, created_at);

create or replace function match_chunks(
  query_embedding vector(1536),
  match_notebook_id uuid,
  match_count int default 8
)
returns table (
  id uuid, source_id uuid, content text, metadata jsonb, similarity float
)
language sql stable as $$
  select chunks.id, chunks.source_id, chunks.content, chunks.metadata,
         1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  where chunks.notebook_id = match_notebook_id
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;
```

3. Create a **private** Storage bucket named `sources` (for original PDF/VTT files)

### 3. Environment variables

Create `.env.local` in the project root:

```
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Find your keys at: **Supabase Dashboard → Project Settings → API**

| Variable | Used for |
|---|---|
| `OPENAI_API_KEY` | embeddings (`text-embedding-3-small`) + chat completion (`gpt-4o-mini`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (used by both client and server) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key for the browser client (`@supabase/ssr`) |

> **Note:** This project uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the new Supabase publishable key format) rather than the older `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Both refer to the same safe, public-facing key — just copy whichever name your Supabase dashboard shows.

### 4. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000/notebooks`.

### 5. Deploy

- Push to GitHub
- Import the repo in Vercel
- Add the same environment variables in the Vercel project settings
- Deploy

---

## Known limitations

- Website URL extraction only works on server-rendered pages — JS-rendered single-page apps return empty content without a headless browser (not implemented in this version).
- YouTube extraction depends on auto-generated captions being available and enabled; videos without captions can't be ingested.
- No authentication — notebooks are not scoped to individual users in this version.
- Citation highlighting uses substring matching against the first ~60 characters of the cited chunk; heavily reformatted source text could occasionally fail to highlight precisely.

## Possible extensions

- Personalized learning roadmap generated from a YouTube playlist's transcripts
- Podcast-style audio summary of a notebook's sources via TTS
- Background job queue (BullMQ/Celery) instead of fire-and-forget ingestion for production-scale reliability

---

## Tech stack

Next.js · TypeScript · Tailwind CSS · Supabase (Postgres, pgvector, Storage) · OpenAI (`text-embedding-3-small`, `gpt-4o-mini`) · Vercel AI SDK · `pdfjs-dist` · `youtube-transcript` · `node-webvtt` · `js-tiktoken`