// app/api/sources/[id]/content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: source, error } = await supabase
    .from('sources')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }

  if (source.type === 'pdf' || source.type === 'vtt') {
    // Generate a signed URL so the browser can fetch the private storage file directly
    const { data: signed, error: signError } = await supabase.storage
      .from('sources')
      .createSignedUrl(source.original_ref, 60 * 10); // 10 min expiry

    if (signError) {
      return NextResponse.json({ error: signError.message }, { status: 500 });
    }
    return NextResponse.json({ ...source, signedUrl: signed.signedUrl });
  }

  // text and youtube/url sources don't need a signed file URL
  return NextResponse.json(source);
}