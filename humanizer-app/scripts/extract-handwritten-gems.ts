/**
 * Extract Handwritten Gems
 *
 * Finds the actual handwritten notebook transcriptions
 * (inside code blocks) + the assistant interpretations
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { analyzePassage } from '../packages/core/dist/vector/trajectory.js';

const ARCHIVE_PATH = '~/humanizer_root/humanizer-app/my-archive';
const OUTPUT_PATH = '~/humanizer_root/humanizer-app/three-threads-book';

interface HandwrittenGem {
  id: string;
  type: 'transcription' | 'echo';
  text: string;
  conversationTitle: string;
  timestamp: Date;
  wordCount: number;
  centroid: {
    epistemic: number;
    commitment: number;
    temporal: number;
    embodiment: number;
    stakes: number;
  };
  craft: {
    compression: number;
    tension: number;
    velocity: number;
  };
}

// Load archive
console.log('📓 Extracting handwritten gems...\n');
const archive = JSON.parse(readFileSync(join(ARCHIVE_PATH, 'archive.json'), 'utf-8'));

const gems: HandwrittenGem[] = [];

// Extract content from code blocks
function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  const regex = /```(?:markdown|text)?\s*([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const content = match[1].trim();
    if (content.length > 50) {
      blocks.push(content);
    }
  }
  return blocks;
}

// Process each conversation
for (const conv of archive.conversations) {
  const messages = conv.messages || [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const text = msg.content || '';

    // Look for code blocks in both user and assistant messages
    const blocks = extractCodeBlocks(text);

    for (const block of blocks) {
      // Skip if it looks like actual code (programming)
      if (block.includes('function ') || block.includes('const ') ||
          block.includes('import ') || block.includes('class ') ||
          block.includes('export ') || block.includes('return ') ||
          block.includes('#!/') || block.includes('npm ')) {
        continue;
      }

      // Skip if too short or looks like a command
      if (block.length < 80) continue;

      const rho = analyzePassage(block);

      gems.push({
        id: `gem-${gems.length}`,
        type: msg.author?.role === 'user' ? 'transcription' : 'echo',
        text: block,
        conversationTitle: conv.title,
        timestamp: new Date(msg.timestamp),
        wordCount: block.split(/\s+/).length,
        centroid: rho.summary.centroid,
        craft: {
          compression: rho.craft.compression.score,
          tension: rho.craft.tension.score,
          velocity: rho.craft.velocity.score,
        },
      });
    }
  }
}

console.log(`Found ${gems.length} handwritten gems\n`);

const transcriptions = gems.filter(g => g.type === 'transcription');
const echoes = gems.filter(g => g.type === 'echo');

console.log(`Transcriptions (your handwriting): ${transcriptions.length}`);
console.log(`Echoes (LLM interpretations): ${echoes.length}\n`);

// Sort by commitment (skin in the game)
const byCommitment = [...gems].sort((a, b) => b.centroid.commitment - a.centroid.commitment);

console.log('═'.repeat(60));
console.log('TOP GEMS BY COMMITMENT');
console.log('═'.repeat(60));

for (const g of byCommitment.slice(0, 12)) {
  console.log(`\n[${g.type}] ${g.conversationTitle.slice(0, 40)}`);
  console.log(`C:${g.centroid.commitment.toFixed(2)} E:${g.centroid.epistemic.toFixed(2)} B:${g.centroid.embodiment.toFixed(2)}`);
  console.log(`"${g.text.slice(0, 300).replace(/\n/g, ' ')}"`);
}

// Sort by embodiment (grounded in sensation)
const byEmbodiment = [...gems].sort((a, b) => b.centroid.embodiment - a.centroid.embodiment);

console.log('\n' + '═'.repeat(60));
console.log('TOP GEMS BY EMBODIMENT');
console.log('═'.repeat(60));

for (const g of byEmbodiment.slice(0, 8)) {
  console.log(`\n[${g.type}] ${g.conversationTitle.slice(0, 40)}`);
  console.log(`B:${g.centroid.embodiment.toFixed(2)} C:${g.centroid.commitment.toFixed(2)}`);
  console.log(`"${g.text.slice(0, 300).replace(/\n/g, ' ')}"`);
}

// Sort by tension (unresolved energy)
const byTension = [...gems].sort((a, b) => b.craft.tension - a.craft.tension);

console.log('\n' + '═'.repeat(60));
console.log('TOP GEMS BY TENSION');
console.log('═'.repeat(60));

for (const g of byTension.slice(0, 8)) {
  console.log(`\n[${g.type}] ${g.conversationTitle.slice(0, 40)} (${(g.craft.tension * 100).toFixed(0)}%)`);
  console.log(`"${g.text.slice(0, 300).replace(/\n/g, ' ')}"`);
}

// Find phenomenology/philosophy gems
const philosophyKeywords = ['phenomenology', 'consciousness', 'being', 'existence', 'husserl',
  'experience', 'perception', 'intentionality', 'lifeworld', 'world', 'self', 'unity',
  'derrida', 'merleau', 'body', 'flesh', 'presence', 'absence'];

const philosophyGems = gems.filter(g => {
  const lower = g.text.toLowerCase();
  return philosophyKeywords.some(k => lower.includes(k));
});

console.log('\n' + '═'.repeat(60));
console.log(`PHILOSOPHY GEMS (${philosophyGems.length} found)`);
console.log('═'.repeat(60));

const topPhilosophy = [...philosophyGems]
  .sort((a, b) => (b.centroid.commitment + b.craft.tension) - (a.centroid.commitment + a.craft.tension))
  .slice(0, 10);

for (const g of topPhilosophy) {
  console.log(`\n[${g.type}] ${g.conversationTitle.slice(0, 40)}`);
  console.log(`"${g.text.slice(0, 400).replace(/\n/g, ' ')}"`);
}

// Save all gems
writeFileSync(
  join(OUTPUT_PATH, 'handwritten-gems.json'),
  JSON.stringify({
    totalGems: gems.length,
    transcriptions: transcriptions.length,
    echoes: echoes.length,
    philosophyGems: philosophyGems.length,
    gems: gems,
    topByCommitment: byCommitment.slice(0, 30),
    topByEmbodiment: byEmbodiment.slice(0, 30),
    topByTension: byTension.slice(0, 30),
    philosophyGems: topPhilosophy,
  }, null, 2)
);

console.log(`\n✅ Saved to: ${OUTPUT_PATH}/handwritten-gems.json\n`);
