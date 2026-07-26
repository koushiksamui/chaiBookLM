// scripts/test-text-extractor.ts
import { extractText } from '../src/lib/ingestion/text';

const sample = `This is paragraph one. It talks about something.

This is paragraph two. It covers a different point.

This is paragraph three.`;

const result = extractText(sample);
console.log(JSON.stringify(result, null, 2));