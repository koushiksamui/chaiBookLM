// scripts/test-retrieve.ts
import { retrieveRelevantChunks } from '../src/lib/rag/retrieve';

async function main() {
  const notebookId = process.argv[2];
  const question = process.argv[3];

  if (!notebookId || !question) {
    console.error('Usage: npx tsx scripts/test-retrieve.ts <notebook-id> "<question>"');
    process.exit(1);
  }

  const results = await retrieveRelevantChunks(question, notebookId);

  console.log(`Found ${results.length} relevant chunks:\n`);
  results.forEach((chunk, i) => {
    console.log(`--- Result ${i + 1} (similarity: ${chunk.similarity.toFixed(3)}) ---`);
    console.log(`Source: ${chunk.source_id}, metadata: ${JSON.stringify(chunk.metadata)}`);
    console.log(chunk.content.slice(0, 200) + '...\n');
  });
}

main();