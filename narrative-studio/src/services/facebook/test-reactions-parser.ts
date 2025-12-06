/**
 * Test ReactionsParser with real Facebook export
 */

import { ReactionsParser } from './ReactionsParser.js';

const parser = new ReactionsParser();

const exportDir = '/Users/tem/Downloads/facebook-temnoon-2025-11-18-5XY1dvj4';
const reactionsDir = `${exportDir}/your_facebook_activity/comments_and_reactions`;

console.log('Testing ReactionsParser with Tem\'s Facebook export:\n');

// Get statistics
console.log('Getting reaction statistics...');
const stats = await parser.getAllStats(reactionsDir);

console.log(`Total reactions: ${stats.totalReactions}`);
console.log(`Has valid timestamps: ${stats.hasValidTimestamps ? 'Yes' : 'No (mostly timestamp=1)'}\n`);

console.log('Reactions by type:');
Object.entries(stats.byType).forEach(([type, count]) => {
  console.log(`  ${type}: ${count}`);
});

console.log('\nReactions by target type:');
Object.entries(stats.byTargetType).forEach(([type, count]) => {
  console.log(`  ${type}: ${count}`);
});

if (stats.hasValidTimestamps) {
  console.log(`\nDate range: ${new Date(stats.dateRange.earliest * 1000).toDateString()} to ${new Date(stats.dateRange.latest * 1000).toDateString()}`);
} else {
  console.log(`\nWarning: Most reactions have invalid timestamps (set to 1)`);
}

// Parse all reactions
console.log('\nParsing all reaction files...');
const reactions = await parser.parseAll(reactionsDir);

console.log(`\nParsed ${reactions.length} reactions`);

// Show first 10 reactions with valid timestamps
console.log('\nFirst 10 reactions with valid timestamps:');
const validReactions = reactions.filter(r => r.created_at > 1000).slice(0, 10);
validReactions.forEach((reaction, i) => {
  const date = new Date(reaction.created_at * 1000);
  const context = (reaction as any).context;
  const title = (reaction as any).title;
  console.log(`\n${i + 1}. ${reaction.reaction_type.toUpperCase()} - ${date.toDateString()}`);
  console.log(`   Target: ${context?.targetType} ${context?.targetAuthor ? `by ${context.targetAuthor}` : ''}`);
  console.log(`   Title: ${title?.substring(0, 80)}`);
});
