// app/api/query/route.ts
import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { retrieveRelevantChunks } from '@/lib/rag/retrieve';
import { buildPrompt } from '@/lib/rag/prompt';

export async function POST(req: NextRequest) {
  const { question, notebookId, topK = 5 } = await req.json();

  if (!question || !notebookId) {
    return new Response(JSON.stringify({ error: 'question and notebookId required' }), {
      status: 400,
    });
  }

  // Clamp to a sane range — too low starves the model of context,
  // too high dilutes the prompt with marginal matches and costs more tokens
  const safeTopK = Math.min(Math.max(topK, 3), 15);

  const chunks = await retrieveRelevantChunks(question, notebookId, safeTopK);

  if (chunks.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No sources indexed yet for this notebook' }),
      { status: 400 }
    );
  }

  const { systemPrompt, userPrompt } = buildPrompt(question, chunks);

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    prompt: userPrompt,
  });

  // Attach the retrieved chunk metadata as a custom header so the client
  // can map [1][2] markers back to real source IDs without re-parsing text
  const citationData = chunks.map((c, i) => ({
    marker: i + 1,
    sourceId: c.source_id,
    content: c.content,      // the actual cited chunk text
    metadata: c.metadata,    // page number or start_time for that specific chunk
  }));

  const response = result.toTextStreamResponse();
  // HTTP headers only allow ASCII (0-255). Chunk content can contain non-ASCII
  // Unicode (em-dashes, quotes, etc.), so we Base64-encode before setting.
  const citationsJson = JSON.stringify(citationData);
  const citationsBase64 = Buffer.from(citationsJson, 'utf-8').toString('base64');
  response.headers.set('X-Citations', citationsBase64);
  return response;
}