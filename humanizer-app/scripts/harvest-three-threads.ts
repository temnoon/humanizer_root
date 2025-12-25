/**
 * Harvest Three Threads
 *
 * Weaving: Lifeworld + Husserl's Life + Body/Letter (Merleau-Ponty/Derrida)
 * Find the gems - passages with movement, tension, inflection
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { analyzePassage } from '../packages/core/dist/vector/trajectory.js';
import type { PassageRho, SemanticPosition } from '../packages/core/dist/types/vector.js';

const ARCHIVE_PATH = '~/humanizer_root/humanizer-app/my-archive';
const OUTPUT_PATH = '~/humanizer_root/humanizer-app/three-threads-book';

// Three threads with their search terms
const THREADS = {
  lifeworld: {
    name: 'The Lifeworld',
    queries: ['lifeworld', 'lebenswelt', 'crisis', 'european sciences', 'natural attitude', 'pre-theoretical', 'everyday experience'],
  },
  husserl: {
    name: "Husserl's Life & Project",
    queries: ['husserl', 'edmund', 'transcendental phenomenology', 'epoché', 'reduction', 'intentionality', 'noesis', 'noema', 'brentano', 'göttingen', 'freiburg'],
  },
  bodyLetter: {
    name: 'Body & Letter',
    queries: ['merleau-ponty', 'derrida', 'flesh', 'chiasm', 'embodiment', 'corporeal', 'trace', 'différance', 'writing', 'speech', 'presence', 'absence', 'visible invisible'],
  },
};

interface Message {
  id: string;
  author: { role: string };
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

interface HarvestedPassage {
  id: string;
  text: string;
  thread: string;
  matchedQuery: string;
  conversationTitle: string;
  timestamp: Date;
  rho: PassageRho;
  gems: {
    hasInflection: boolean;
    highVelocity: boolean;
    highTension: boolean;
    highCommitment: boolean;
    isGem: boolean;
  };
}

// Load archive
console.log('📚 Loading archive...\n');
const archivePath = join(ARCHIVE_PATH, 'archive.json');
const archive = JSON.parse(readFileSync(archivePath, 'utf-8'));

// Extract conversations from archive
const conversations: Conversation[] = archive.conversations || [];

console.log(`Loaded ${conversations.length} conversations\n`);

// Harvest passages for each thread
const harvested: HarvestedPassage[] = [];

for (const [threadKey, thread] of Object.entries(THREADS)) {
  console.log(`\n🧵 Harvesting: ${thread.name}`);
  console.log(`   Queries: ${thread.queries.slice(0, 5).join(', ')}...`);

  let threadCount = 0;

  for (const conv of conversations) {
    // Extract user messages
    for (const msg of conv.messages || []) {
      if (msg.author?.role !== 'user') continue;

      const text = msg.content || '';
      if (text.length < 100) continue; // Skip short messages

      const textLower = text.toLowerCase();

      // Check if any query matches
      for (const query of thread.queries) {
        if (textLower.includes(query.toLowerCase())) {
          // Found a match - analyze it
          const rho = analyzePassage(text);

          // Determine if it's a gem
          const hasInflection = rho.summary.inflectionCount > 0;
          const highVelocity = rho.craft.velocity.score > 0.15;
          const highTension = rho.craft.tension.score > 0.25;
          const highCommitment = rho.summary.centroid.commitment > 0.1;
          const isGem = hasInflection || highVelocity || highTension || highCommitment;

          harvested.push({
            id: `${threadKey}-${harvested.length}`,
            text,
            thread: threadKey,
            matchedQuery: query,
            conversationTitle: conv.title,
            timestamp: new Date(msg.timestamp),
            rho,
            gems: { hasInflection, highVelocity, highTension, highCommitment, isGem },
          });

          threadCount++;
          break; // Only count once per message
        }
      }
    }
  }

  console.log(`   Found: ${threadCount} passages`);
}

// Separate gems from non-gems
const gems = harvested.filter(p => p.gems.isGem);
const messy = harvested.filter(p => !p.gems.isGem);

console.log('\n' + '═'.repeat(60));
console.log('HARVEST SUMMARY');
console.log('═'.repeat(60));

console.log(`\nTotal passages: ${harvested.length}`);
console.log(`Gems (with movement): ${gems.length}`);
console.log(`Messy (stationary): ${messy.length}`);

// Thread breakdown
for (const [threadKey, thread] of Object.entries(THREADS)) {
  const threadPassages = harvested.filter(p => p.thread === threadKey);
  const threadGems = threadPassages.filter(p => p.gems.isGem);
  console.log(`\n${thread.name}:`);
  console.log(`  Total: ${threadPassages.length}, Gems: ${threadGems.length}`);
}

// Show top gems
console.log('\n' + '═'.repeat(60));
console.log('TOP GEMS (passages with life)');
console.log('═'.repeat(60));

// Sort gems by a composite score
const scoredGems = gems.map(g => ({
  ...g,
  score:
    (g.gems.hasInflection ? 3 : 0) +
    (g.gems.highVelocity ? 2 : 0) +
    (g.gems.highTension ? 2 : 0) +
    (g.gems.highCommitment ? 1 : 0) +
    g.rho.summary.coverage * 5,
})).sort((a, b) => b.score - a.score);

for (const g of scoredGems.slice(0, 15)) {
  console.log(`\n[${g.thread}] ${g.conversationTitle.slice(0, 45)}`);
  console.log(`   Matched: "${g.matchedQuery}"`);
  console.log(`   Inflections: ${g.rho.summary.inflectionCount}, Velocity: ${(g.rho.craft.velocity.score * 100).toFixed(0)}%, Tension: ${(g.rho.craft.tension.score * 100).toFixed(0)}%`);
  console.log(`   Region: ${g.rho.summary.dominantRegion}`);
  console.log(`   Preview: "${g.text.slice(0, 120).replace(/\n/g, ' ')}..."`);
}

// Find passages that bridge threads
console.log('\n' + '═'.repeat(60));
console.log('BRIDGE PASSAGES (mention multiple threads)');
console.log('═'.repeat(60));

const bridges: HarvestedPassage[] = [];
for (const p of harvested) {
  const textLower = p.text.toLowerCase();
  const threads = new Set<string>();

  if (THREADS.lifeworld.queries.some(q => textLower.includes(q.toLowerCase()))) {
    threads.add('lifeworld');
  }
  if (THREADS.husserl.queries.some(q => textLower.includes(q.toLowerCase()))) {
    threads.add('husserl');
  }
  if (THREADS.bodyLetter.queries.some(q => textLower.includes(q.toLowerCase()))) {
    threads.add('bodyLetter');
  }

  if (threads.size >= 2) {
    bridges.push({ ...p, thread: Array.from(threads).join('+') });
  }
}

console.log(`\nFound ${bridges.length} bridge passages\n`);

for (const b of bridges.slice(0, 10)) {
  console.log(`[${b.thread}] ${b.conversationTitle.slice(0, 45)}`);
  console.log(`   "${b.text.slice(0, 100).replace(/\n/g, ' ')}..."`);
}

// Save output
mkdirSync(OUTPUT_PATH, { recursive: true });

// Save gems
writeFileSync(
  join(OUTPUT_PATH, 'gems.json'),
  JSON.stringify(scoredGems.slice(0, 50).map(g => ({
    id: g.id,
    thread: g.thread,
    matchedQuery: g.matchedQuery,
    conversationTitle: g.conversationTitle,
    timestamp: g.timestamp,
    text: g.text,
    gems: g.gems,
    summary: g.rho.summary,
    craft: g.rho.craft,
    inflections: g.rho.inflections,
    score: g.score,
  })), null, 2)
);

// Save bridges
writeFileSync(
  join(OUTPUT_PATH, 'bridges.json'),
  JSON.stringify(bridges.map(b => ({
    id: b.id,
    thread: b.thread,
    conversationTitle: b.conversationTitle,
    text: b.text,
    summary: b.rho.summary,
    craft: b.rho.craft,
  })), null, 2)
);

// Create a narrative prompt for LLM
const narrativePrompt = `
# Three Threads: A Phenomenological Weave

You are composing a book from archival fragments. The book weaves three threads:

## Thread 1: The Lifeworld
Husserl's late turn to the Lebenswelt - the pre-theoretical world of lived experience that science forgot. The Crisis of European Sciences. What does it mean that we always already live in a world before we theorize about it?

## Thread 2: Husserl's Life & Project
The man and the method. From mathematics to meaning. Brentano's student who became phenomenology's founder. The struggle against psychologism, the dream of philosophy as rigorous science, the late confrontation with death and the Nazi rise.

## Thread 3: Body & Letter
Where phenomenology meets its limits and successors:
- Merleau-Ponty: The flesh, the chiasm, the visible and invisible. The body is not an object but our openness to the world.
- Derrida: The trace, différance, writing before speech. Presence is always already marked by absence.

## The Weave
Between these threads, find the tension and resolution:
- The lifeworld is embodied (Merleau-Ponty) before it is inscribed (Derrida)
- Husserl's project is incomplete - his successors complete and betray it
- The body writes; the letter is flesh

## Your Task
From the passages below, compose a narrative arc. You may:
- Reorder passages for conceptual flow
- Add transitions between passages
- Tighten language while preserving voice
- Identify the arc: what question opens, what crisis emerges, what resolution (if any) is offered?

---

## Gem Passages (selected for movement and tension)

${scoredGems.slice(0, 30).map((g, i) => `
### Passage ${i + 1} [${g.thread}]
From: ${g.conversationTitle}
Matched: "${g.matchedQuery}"
Tension: ${(g.rho.craft.tension.score * 100).toFixed(0)}%, Velocity: ${(g.rho.craft.velocity.score * 100).toFixed(0)}%

${g.text}
`).join('\n---\n')}

## Bridge Passages (connecting threads)

${bridges.slice(0, 10).map((b, i) => `
### Bridge ${i + 1} [${b.thread}]
From: ${b.conversationTitle}

${b.text}
`).join('\n---\n')}
`;

writeFileSync(join(OUTPUT_PATH, 'narrative-prompt.md'), narrativePrompt);

console.log('\n' + '═'.repeat(60));
console.log('OUTPUT SAVED');
console.log('═'.repeat(60));
console.log(`\n📁 ${OUTPUT_PATH}/`);
console.log('   gems.json           - Top 50 passages with movement');
console.log('   bridges.json        - Passages connecting threads');
console.log('   narrative-prompt.md - Ready for LLM synthesis');
console.log('\n✅ Ready for the next step: LLM persona pass\n');
