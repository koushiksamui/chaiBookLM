// app/api/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  const notebookId = req.nextUrl.searchParams.get('notebookId');
  if (!notebookId) {
    return NextResponse.json({ error: 'notebookId required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('notebook_id', notebookId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { notebookId, role, content, citations } = await req.json();

  const { data, error } = await supabase
    .from('messages')
    .insert({ notebook_id: notebookId, role, content, citations: citations ?? [] })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
