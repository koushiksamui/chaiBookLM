// app/api/notebooks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';

export async function GET() {
  try {
    const response = await supabase
      .from('notebooks')
      .select('*')
      .order('created_at', { ascending: false });

    if (response.error) {
      throw response.error;
    }

    return NextResponse.json({
      success: true,
      data: response.data
    });
  } catch (error: any) {
    console.error('Error getting notebooks:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  try {
    const response = await supabase
      .from('notebooks')
      .insert({ name })
      .select()
      .single();
    
    if (response.error) {
      throw response.error;
    }

    return NextResponse.json({
      success: true,
      data: response.data
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating notebook:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}