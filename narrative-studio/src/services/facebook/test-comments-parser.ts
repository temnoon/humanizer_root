/**
 * Test CommentsParser with real Facebook export
 */

import { CommentsParser } from './CommentsParser.js';

const parser = new CommentsParser();

const exportDir = '/Users/tem/Downloads/facebook-temnoon-2025-11-18-5XY1dvj4';
const commentsFile = `${exportDir}/your_facebook_activity/comments_and_reactions/comments.json`;

console.log('Testing CommentsParser with Tem\'s Facebook export:\n');

// First, get stats
console.log('Getting file statistics...');
const stats = await parser.getFileStats(commentsFile);

console.log(`Total comments: ${stats.totalComments}`);
console.log(`Own comments: ${stats.ownComments}`);
console.log(`Comments on own posts: ${stats.commentsOnOwnPosts}`);
console.log(`Comments on other posts: ${stats.commentsOnOtherPosts}`);
console.log(`Date range: ${new Date(stats.dateRange.earliest * 1000).toDateString()} to ${new Date(stats.dateRange.latest * 1000).toDateString()}\n`);

console.log('Top 10 people Tem commented on:');
stats.topTargetAuthors.forEach((author, i) => {
  console.log(`  ${i + 1}. ${author.name}: ${author.count} comments`);
});

// Parse the comments
console.log('\nParsing comments...');
const items = await parser.parse(commentsFile);

console.log(`\nParsed ${items.length} content items\n`);

// Show first 10 comments
console.log('First 10 comments:');
items.slice(0, 10).forEach((item, i) => {
  const date = new Date(item.created_at * 1000);
  const context = JSON.parse(item.context || '{}');
  console.log(`\n${i + 1}. ${date.toDateString()}`);
  console.log(`   Context: ${context.contextType} ${context.targetAuthor ? `(${context.targetAuthor})` : ''}`);
  console.log(`   Comment: ${item.text?.substring(0, 80)}${item.text && item.text.length > 80 ? '...' : ''}`);
});
