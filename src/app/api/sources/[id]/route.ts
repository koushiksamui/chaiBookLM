// app/api/sources/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error } = await supabase
    .from('sources')
    .delete()
    .eq('id', id);

  if (error) 
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}