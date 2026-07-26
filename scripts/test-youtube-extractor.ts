// scripts/test-youtube-extractor.ts
import { extractYoutube } from '../src/lib/ingestion/youtube';

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: npx tsx scripts/test-youtube-extractor.ts <youtube-url>');
    process.exit(1);
  }

  const result = await extractYoutube(url);
  console.log(`Extracted ${result.segments.length} segments`);
  console.log('First 3 segments:');
  console.log(JSON.stringify(result.segments.slice(0, 3), null, 2));
}

main();