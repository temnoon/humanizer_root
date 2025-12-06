/**
 * Test full Facebook import with Tem's real export
 */

import { FacebookFullParser } from './FacebookFullParser.js';
import path from 'path';

const parser = new FacebookFullParser();

const exportDir = '/Users/tem/Downloads/facebook-temnoon-2025-11-18-5XY1dvj4';
const targetDir = '/tmp/facebook-test-import';

console.log('🎯 Full Facebook Import Test\n');
console.log('═══════════════════════════════════════════════════════\n');

// First, get a preview
console.log('Step 1: Getting import preview...\n');

const preview = await parser.getImportPreview(exportDir, {
  periodType: 'quarters',
  periodLength: 90,
  yearStartType: 'birthday',
  birthday: '04-21',
  useQuarterNames: true,
  includeDateRanges: true,
});

console.log('Preview Results:');
console.log(`  Posts: ${preview.posts.toLocaleString()}`);
console.log(`  Comments: ${preview.comments.toLocaleString()}`);
console.log(`  Reactions: ${preview.reactions.toLocaleString()}`);
console.log(`  Periods: ${preview.periods}`);
console.log(`  Date Range: ${preview.dateRange.earliest.toDateString()} → ${preview.dateRange.latest.toDateString()}`);
console.log(`  Total Items: ${(preview.posts + preview.comments + preview.reactions).toLocaleString()}`);

console.log('\n═══════════════════════════════════════════════════════\n');
console.log('Step 2: Running full import...\n');

// Run the import
const result = await parser.importExport({
  exportDir,
  targetDir,
  settings: {
    periodType: 'quarters',
    periodLength: 90,
    yearStartType: 'birthday',
    birthday: '04-21',
    useQuarterNames: true,
    includeDateRanges: true,
  },
  preserveSource: true,
  onProgress: (progress) => {
    console.log(`   Progress: ${progress.stage} - ${progress.message}`);
  },
});

console.log('\n═══════════════════════════════════════════════════════\n');
console.log('Import Results:\n');
console.log(`  Archive ID: ${result.archive_id}`);
console.log(`  Location: ${path.join(targetDir, result.archive_id)}`);
console.log(`  Import Date: ${new Date(result.import_date * 1000).toLocaleString()}`);
console.log(`\n  Content Imported:`);
console.log(`    Posts: ${result.posts_imported.toLocaleString()}`);
console.log(`    Comments: ${result.comments_imported.toLocaleString()}`);
console.log(`    Reactions: ${result.reactions_imported.toLocaleString()}`);
console.log(`    Total: ${result.total_items.toLocaleString()}`);
console.log(`\n  Organization:`);
console.log(`    Periods: ${result.periods.length}`);
console.log(`    Period Type: ${result.settings.periodType}`);
console.log(`    Year Start: ${result.settings.yearStartType} (${result.settings.birthday})`);

console.log(`\n  Period Breakdown (first 10):`);
result.periods.slice(0, 10).forEach((period, i) => {
  console.log(`    ${i + 1}. ${period.period_folder}`);
  console.log(`       Posts: ${period.posts_count}, Comments: ${period.comments_count}`);
});

if (result.periods.length > 10) {
  console.log(`    ... and ${result.periods.length - 10} more periods`);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('✅ Full import test complete!');
console.log('═══════════════════════════════════════════════════════\n');
