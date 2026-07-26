// app/api/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';
import { extractText } from '@/lib/ingestion/text';
import { extractPdf } from '@/lib/ingestion/pdf';
// import { extractUrl } from '@/lib/ingestion/url';
import { extractYoutube } from '@/lib/ingestion/youtube';
import { extractVtt } from '@/lib/ingestion/vtt';
import { chunkExtractedContent } from '@/lib/ingestion/chunker';
import { embedChunks } from '@/lib/ingestion/embed';
import { ExtractionResult } from '@/lib/ingestion/types';

async function runExtraction(source: any): Promise<ExtractionResult> {
  switch (source.type) {
    case 'text':
      return extractText(source.metadata.rawText);

    case 'pdf': {
      const { data, error } = await supabase.storage
        .from('sources')
        .download(source.original_ref);
      if (error) throw new Error(`Failed to download PDF: ${error.message}`);
      const buffer = Buffer.from(await data.arrayBuffer());
      return extractPdf(buffer);
    }

    // case 'url':
    //   return extractUrl(source.original_ref);

    case 'youtube':
      return extractYoutube(source.original_ref);

    case 'vtt': {
      const { data, error } = await supabase.storage
        .from('sources')
        .download(source.original_ref);
      if (error) throw new Error(`Failed to download VTT: ${error.message}`);
      const content = await data.text();
      return extractVtt(content);
    }

    default:
      throw new Error(`Unknown source type: ${source.type}`);
  }
}

export async function POST(req: NextRequest) {
  const { sourceId } = await req.json();
  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId required' }, { status: 400 });
  }

  // Fetch the source row
  const { data: source, error: fetchError } = await supabase
    .from('sources')
    .select('*')
    .eq('id', sourceId)
    .single();

  if (fetchError || !source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }

  try {
    // 1. Set status to indexing
    await supabase.from('sources').update({ status: 'indexing' }).eq('id', sourceId);

    // 2. Extract
    const extraction = await runExtraction(source);

    // 3. Chunk
    const chunks = chunkExtractedContent(extraction);
    if (chunks.length === 0) {
      throw new Error('No content extracted — nothing to index');
    }

    // 4. Embed (batched inside embedChunks)
    const texts = chunks.map((c) => c.text);
    const embeddings = await embedChunks(texts);

    // 5. Insert into chunks table
    const rows = chunks.map((chunk, i) => ({
      source_id: sourceId,
      notebook_id: source.notebook_id,
      content: chunk.text,
      embedding: embeddings[i],
      metadata: chunk.metadata,
    }));

    // Insert in batches too — Supabase/Postgres can choke on very large single inserts
    const INSERT_BATCH = 10;
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const batch = rows.slice(i, i + INSERT_BATCH);
      const { error: insertError } = await supabase.from('chunks').insert(batch);
      if (insertError) throw new Error(`Failed to insert chunks: ${insertError.message}`);
    }

    // 6. Mark ready
    await supabase
      .from('sources')
      .update({ status: 'ready', metadata: { ...source.metadata, chunk_count: rows.length } })
      .eq('id', sourceId);

    return NextResponse.json({ success: true, chunkCount: rows.length });
  } catch (err: any) {
    console.error(`Ingestion failed for source ${sourceId}:`, err);
    await supabase
      .from('sources')
      .update({ status: 'failed', metadata: { error: err.message } })
      .eq('id', sourceId);

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}