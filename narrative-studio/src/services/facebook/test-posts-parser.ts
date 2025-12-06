/**
 * Test PostsParser with real Facebook export
 */

import { PostsParser } from './PostsParser.js';

const parser = new PostsParser();

const exportDir = '/Users/tem/Downloads/facebook-temnoon-2025-11-18-5XY1dvj4';
const postsFile = `${exportDir}/your_facebook_activity/posts/your_posts__check_ins__photos_and_videos_1.json`;

console.log('Testing PostsParser with Tem\'s Facebook export:\n');

// First, get stats
console.log('Getting file statistics...');
const stats = await parser.getFileStats(postsFile);

console.log(`Total posts: ${stats.totalPosts}`);
console.log(`Posts with text: ${stats.postsWithText}`);
console.log(`Posts with media: ${stats.postsWithMedia}`);
console.log(`Posts with links: ${stats.postsWithLinks}`);
console.log(`Date range: ${new Date(stats.dateRange.earliest * 1000).toDateString()} to ${new Date(stats.dateRange.latest * 1000).toDateString()}\n`);

// Parse the posts
console.log('Parsing posts...');
const items = await parser.parse(postsFile, exportDir);

console.log(`\nParsed ${items.length} content items\n`);

// Show first 5 posts
console.log('First 5 posts:');
items.slice(0, 5).forEach((item, i) => {
  const date = new Date(item.created_at * 1000);
  console.log(`\n${i + 1}. ${item.title || 'Untitled'}`);
  console.log(`   Date: ${date.toDateString()}`);
  console.log(`   Text: ${item.text?.substring(0, 100)}${item.text && item.text.length > 100 ? '...' : ''}`);
  console.log(`   Media: ${item.media_count} files`);
  if (item.metadata?.external_url) {
    console.log(`   Link: ${item.metadata.external_url}`);
  }
});
