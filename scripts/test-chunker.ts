// scripts/test-chunker.ts
import { extractPdf } from '../src/lib/ingestion/pdf';
import { readFileSync } from 'fs';
import { chunkExtractedContent } from '../src/lib/ingestion/chunker';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx tsx scripts/test-chunker.ts <path-to-pdf>');
    process.exit(1);
  }

  const buffer = readFileSync(filePath);
  const extraction = await extractPdf(buffer);
  console.log(`Raw segments from extractor: ${extraction.segments.length}`);

  const chunks = chunkExtractedContent(extraction);
  console.log(`Chunks after grouping: ${chunks.length}`);
  console.log('First 2 chunks with token counts:');
  chunks.slice(0, 2).forEach((c, i) => {
    console.log(`\n--- Chunk ${i + 1} (page ${c.metadata.page}) ---`);
    console.log(c.text.slice(0, 300) + '...');
  });
}

main();