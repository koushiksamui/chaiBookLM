// scripts/test-pdf-extractor.ts
import { readFileSync } from 'fs';
import { extractPdf } from '../src/lib/ingestion/pdf';

async function main() {
  const filePath = process.argv[2]; 
  if (!filePath) {
    console.error('Usage: npx tsx scripts/test-pdf-extractor.ts <path-to-pdf>');
    process.exit(1);
  }

  const buffer = readFileSync(filePath);
  const result = await extractPdf(buffer);

  console.log(`Extracted ${result.segments.length} segments`);
  console.log('First 3 segments:');
  console.log(JSON.stringify(result.segments.slice(0, 3), null, 2));
}

main();