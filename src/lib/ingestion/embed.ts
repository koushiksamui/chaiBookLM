// lib/ingestion/embed.ts
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dimensions — matches your DB schema
const BATCH_SIZE = 20; // batch requests to stay well under rate limits

export async function embedChunks(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });

    // OpenAI returns embeddings in the same order as the input array
    const batchEmbeddings = response.data.map((d) => d.embedding);
    allEmbeddings.push(...batchEmbeddings);

    console.log(`Embedded ${Math.min(i + BATCH_SIZE, texts.length)} / ${texts.length} chunks`);
  }

  return allEmbeddings;
}