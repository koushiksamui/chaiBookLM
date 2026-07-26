// scripts/test-embed.ts
import { embedChunks } from '../src/lib/ingestion/embed';

async function main() {
  const sampleTexts = [
    'The cat sat on the mat.',
    'Retrieval augmented generation combines search with language models.',
    'Metastatic breast cancer treatment options vary by patient.',
  ];

  const embeddings = await embedChunks(sampleTexts);

  console.log(`Generated ${embeddings.length} embeddings`);
  console.log(`Each embedding has ${embeddings[0].length} dimensions`);
  console.log('First 5 values of embedding 1:', embeddings[0].slice(0, 5));
}

main();