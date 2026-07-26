// app/api/sources/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  const notebookId = req.nextUrl.searchParams.get('notebookId');
  if (!notebookId) {
    return NextResponse.json({ error: 'notebookId required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('notebook_id', notebookId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const notebookId = formData.get('notebookId') as string;
  const type = formData.get('type') as string; // 'pdf' | 'text' | 'url' | 'youtube' | 'vtt'
  const title = formData.get('title') as string;

  if (!notebookId || !type) {
    return NextResponse.json({ error: 'notebookId and type required' }, { status: 400 });
  }

  let originalRef: string | null = null;
  let metadata: Record<string, any> = {};

  if (type === 'pdf' || type === 'vtt') {
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `${notebookId}/${Date.now()}-${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from('sources')
      .upload(path, buffer, { contentType: file.type });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
    originalRef = path;
  } else if (type === 'text') {
    const content = formData.get('content') as string;
    if (!content?.trim()) {
      return NextResponse.json({ error: 'content required' }, { status: 400 });
    }
    originalRef = null; // raw text stored via chunks later; or store in metadata
    metadata.rawText = content;
  } else if (type === 'url') {
    const url = formData.get('url') as string;
    if (!url?.trim()) return NextResponse.json({ error: 'url required' }, { status: 400 });
    originalRef = url;
  } else if (type === 'youtube') {
    const url = formData.get('url') as string;
    if (!url?.trim()) return NextResponse.json({ error: 'url required' }, { status: 400 });
    originalRef = url;
  } else {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('sources')
    .insert({
      notebook_id: notebookId,
      type,
      title: title || 'Untitled source',
      original_ref: originalRef,
      status: 'uploading',
      metadata,
    })
    .select()
    .single();

  if (error) {
    console.error('Database insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire-and-forget: don't await, so the upload response returns immediately
  // while indexing happens in the background
  fetch(`${req.nextUrl.origin}/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId: data.id }),
  }).catch((err) => console.error('Failed to trigger ingest:', err));

  return NextResponse.json(data, { status: 201 });
}