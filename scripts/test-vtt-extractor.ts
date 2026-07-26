// scripts/test-vtt-extractor.ts
import { readFileSync } from 'fs';
import { extractVtt } from '../src/lib/ingestion/vtt';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx tsx scripts/test-vtt-extractor.ts <path-to-vtt>');
    process.exit(1);
  }

  const content = readFileSync(filePath, 'utf-8');
  const result = extractVtt(content);

  console.log(`Extracted ${result.segments.length} segments`);
  console.log('First 3 segments:');
  console.log(JSON.stringify(result.segments.slice(0, 3), null, 2));
}

main();