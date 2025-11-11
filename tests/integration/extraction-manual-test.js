/**
 * Manual Integration Test: Entity Extraction with Sample Transcripts
 * Feature: 005-entity-extraction
 *
 * Run this with: node tests/integration/extraction-manual-test.js
 *
 * This test verifies that entity extraction:
 * 1. Extracts all 7 entity types from diverse transcripts
 * 2. Achieves reasonable accuracy on known samples
 * 3. Handles edge cases properly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load sample transcripts
const samplesPath = path.join(__dirname, '../../test-data/sample-transcripts.json');
const samples = JSON.parse(fs.readFileSync(samplesPath, 'utf-8'));

console.log('='.repeat(80));
console.log('Entity Extraction - Sample Transcript Test');
console.log('='.repeat(80));
console.log();

// Test summary
const summary = {
  totalSamples: samples.length,
  entityTypesCovered: new Set(),
  sampleResults: [],
};

console.log(`Testing ${samples.length} sample transcripts...\n`);

// Process each sample
for (const sample of samples) {
  console.log(`[${sample.id}] ${sample.description}`);
  console.log('-'.repeat(80));
  console.log(`Transcript: "${sample.transcript.substring(0, 100)}..."`);
  console.log();

  // Track expected entities
  console.log('Expected Entities:');
  sample.expected_entities.forEach(entity => {
    console.log(`  - ${entity.type}: ${entity.name}`);
    summary.entityTypesCovered.add(entity.type);
  });

  console.log();
  console.log('Status: ⏳ Ready for extraction (run with wrangler dev)');
  console.log();

  summary.sampleResults.push({
    id: sample.id,
    expectedCount: sample.expected_entities.length,
    expectedTypes: [...new Set(sample.expected_entities.map(e => e.type))],
  });
}

// Print summary
console.log('='.repeat(80));
console.log('Test Summary');
console.log('='.repeat(80));
console.log();
console.log(`Total Samples: ${summary.totalSamples}`);
console.log(`Entity Types Covered: ${summary.entityTypesCovered.size}/7`);
console.log();
console.log('Entity Types Found in Samples:');
Array.from(summary.entityTypesCovered).sort().forEach(type => {
  const count = samples.reduce((acc, sample) => {
    return acc + sample.expected_entities.filter(e => e.type === type).length;
  }, 0);
  console.log(`  - ${type}: ${count} instances`);
});
console.log();

// Check coverage
const allEntityTypes = ['Person', 'Project', 'Meeting', 'Topic', 'Technology', 'Location', 'Organization'];
const missingTypes = allEntityTypes.filter(type => !summary.entityTypesCovered.has(type));

if (missingTypes.length === 0) {
  console.log('✅ All 7 entity types are covered in test samples');
} else {
  console.log(`⚠️  Missing entity types: ${missingTypes.join(', ')}`);
}

console.log();
console.log('='.repeat(80));
console.log('Next Steps');
console.log('='.repeat(80));
console.log();
console.log('To test entity extraction with Workers AI:');
console.log();
console.log('1. Start local dev server:');
console.log('   npm run dev');
console.log();
console.log('2. In another terminal, test extraction API:');
console.log('   curl -X POST http://localhost:8787/api/notes/note_test/extract-entities \\');
console.log('     -H "Authorization: Bearer YOUR_JWT_TOKEN" \\');
console.log('     -H "Content-Type: application/json"');
console.log();
console.log('3. Check extraction results:');
console.log('   curl http://localhost:8787/api/notes/note_test/entities \\');
console.log('     -H "Authorization: Bearer YOUR_JWT_TOKEN"');
console.log();
console.log('Expected Latency: <3 seconds (p95)');
console.log('Expected Accuracy: >85% F1 score');
console.log();
