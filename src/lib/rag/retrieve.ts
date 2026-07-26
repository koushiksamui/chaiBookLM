// lib/rag/retrieve.ts
import { supabase } from '@/lib/db/client';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type RetrievedChunk = {
  id: string;
  source_id: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
};

export async function retrieveRelevantChunks(
  question: string,
  notebookId: string,
  matchCount = 5
): Promise<RetrievedChunk[]> {
  // Embed the question with the same model used for chunks — mismatched
  // embedding models produce meaningless similarity scores
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: question,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;

  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_notebook_id: notebookId,
    match_count: matchCount,
  });

  if (error) {
    throw new Error(`Retrieval failed: ${error.message}`);
  }

  return data as RetrievedChunk[];
}