/**
 * Extract Notebook Voice + Echo
 *
 * Captures:
 * 1. User's handwritten notebook transcriptions (the raw voice)
 * 2. Assistant commentary AFTER transcriptions (the interpreted echo)
 * 3. Image descriptions from Echo & Bounce (visual voice)
 *
 * The composite voice = original + reflection
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { analyzePassage } from '../packages/core/dist/vector/trajectory.js';
import type { PassageRho } from '../packages/core/dist/types/vector.js';

const ARCHIVE_PATH = '~/humanizer_root/humanizer-app/my-archive';
const OUTPUT_PATH = '~/humanizer_root/humanizer-app/three-threads-book';

// Gizmo IDs for notebook content
const JOURNAL_OCR_GIZMO = 'g-T7bW2qVzx';
const IMAGE_ECHO_GIZMO = 'g-FmQp1Tm1G';

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
  gizmo_id?: string;
}

interface VoiceFragment {
  id: string;
  type: 'transcription' | 'echo' | 'image-description' | 'user-reflection';
  text: string;
  conversationTitle: string;
  timestamp: Date;
  rho: PassageRho;
  wordCount: number;
  // For transcription+echo pairs
  pairedWith?: string;
}

// Load archive
console.log('📓 Extracting notebook voice + echoes...\n');
const archivePath = join(ARCHIVE_PATH, 'archive.json');
const archive = JSON.parse(readFileSync(archivePath, 'utf-8'));

const conversations: Conversation[] = archive.conversations || [];
console.log(`Loaded ${conversations.length} conversations\n`);

// Patterns that indicate notebook/transcription content
const transcriptionPatterns = [
  /transcription:/i,
  /handwritten/i,
  /from my notebook/i,
  /page \d+/i,
  /here is the text/i,
  /the writing says/i,
  /i wrote/i,
  /my notes/i,
  /```[\s\S]*?```/,  // Code blocks often contain transcriptions
  /notebook page/i,
  /journal entry/i,
  /scanned/i,
];

// Patterns for image descriptions
const imageDescPatterns = [
  /name.*?:/i,
  /description.*?:/i,
  /the image shows/i,
  /this image/i,
  /depicts/i,
  /appears to be/i,
  /\|.*?\|/,  // Table format often used for Name|Description
];

// Title patterns for notebook conversations
const notebookTitlePatterns = [
  /notebook/i,
  /journal/i,
  /ocr/i,
  /handwrit/i,
  /transcri/i,
  /marginalia/i,
  /scan/i,
  /echo.*?bounce/i,
  /image.*?name/i,
];

const fragments: VoiceFragment[] = [];

// Find notebook-related conversations
const notebookConversations = conversations.filter(c =>
  notebookTitlePatterns.some(p => p.test(c.title))
);

console.log(`Found ${notebookConversations.length} notebook-related conversations\n`);

// Process notebook conversations - capture user + following assistant
for (const conv of notebookConversations) {
  const messages = conv.messages || [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const text = msg.content || '';

    if (text.length < 30) continue;

    const isUser = msg.author?.role === 'user';
    const isAssistant = msg.author?.role === 'assistant';

    // Check for transcription content in user messages
    if (isUser) {
      const hasTranscription = transcriptionPatterns.some(p => p.test(text));

      if (hasTranscription || text.length > 200) {
        const rho = analyzePassage(text);

        const fragmentId = `voice-${fragments.length}`;
        fragments.push({
          id: fragmentId,
          type: 'transcription',
          text,
          conversationTitle: conv.title,
          timestamp: new Date(msg.timestamp),
          rho,
          wordCount: text.split(/\s+/).length,
        });

        // Look for assistant echo (next message)
        if (i + 1 < messages.length) {
          const nextMsg = messages[i + 1];
          if (nextMsg.author?.role === 'assistant' && nextMsg.content?.length > 50) {
            const echoRho = analyzePassage(nextMsg.content);
            fragments.push({
              id: `voice-${fragments.length}`,
              type: 'echo',
              text: nextMsg.content,
              conversationTitle: conv.title,
              timestamp: new Date(nextMsg.timestamp),
              rho: echoRho,
              wordCount: nextMsg.content.split(/\s+/).length,
              pairedWith: fragmentId,
            });
          }
        }
      }
    }

    // Check for image descriptions in assistant messages
    if (isAssistant) {
      const hasImageDesc = imageDescPatterns.some(p => p.test(text));
      const hasTable = text.includes('|') && text.split('|').length > 3;

      if (hasImageDesc || hasTable) {
        const rho = analyzePassage(text);

        fragments.push({
          id: `voice-${fragments.length}`,
          type: 'image-description',
          text,
          conversationTitle: conv.title,
          timestamp: new Date(msg.timestamp),
          rho,
          wordCount: text.split(/\s+/).length,
        });
      }
    }
  }
}

// Also search ALL conversations for notebook-like content
for (const conv of conversations) {
  if (notebookConversations.includes(conv)) continue;

  const messages = conv.messages || [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.author?.role !== 'user') continue;

    const text = msg.content || '';
    if (text.length < 100) continue;

    // Check for transcription markers
    const hasTranscription = transcriptionPatterns.some(p => p.test(text));
    if (!hasTranscription) continue;

    const rho = analyzePassage(text);
    const fragmentId = `voice-${fragments.length}`;

    fragments.push({
      id: fragmentId,
      type: 'user-reflection',
      text,
      conversationTitle: conv.title,
      timestamp: new Date(msg.timestamp),
      rho,
      wordCount: text.split(/\s+/).length,
    });

    // Capture assistant echo
    if (i + 1 < messages.length) {
      const nextMsg = messages[i + 1];
      if (nextMsg.author?.role === 'assistant' && nextMsg.content?.length > 100) {
        const echoRho = analyzePassage(nextMsg.content);
        fragments.push({
          id: `voice-${fragments.length}`,
          type: 'echo',
          text: nextMsg.content,
          conversationTitle: conv.title,
          timestamp: new Date(nextMsg.timestamp),
          rho: echoRho,
          wordCount: nextMsg.content.split(/\s+/).length,
          pairedWith: fragmentId,
        });
      }
    }
  }
}

console.log(`Extracted ${fragments.length} voice fragments\n`);

// Breakdown by type
const transcriptions = fragments.filter(f => f.type === 'transcription');
const echoes = fragments.filter(f => f.type === 'echo');
const imageDescs = fragments.filter(f => f.type === 'image-description');
const reflections = fragments.filter(f => f.type === 'user-reflection');

console.log('Fragment breakdown:');
console.log(`  Transcriptions:      ${transcriptions.length}`);
console.log(`  Assistant Echoes:    ${echoes.length}`);
console.log(`  Image Descriptions:  ${imageDescs.length}`);
console.log(`  User Reflections:    ${reflections.length}`);

// Analyze voice characteristics
console.log('\n' + '═'.repeat(60));
console.log('VOICE ANALYSIS BY TYPE');
console.log('═'.repeat(60));

function analyzeVoiceType(frags: VoiceFragment[], label: string) {
  if (frags.length === 0) return;

  let e = 0, c = 0, t = 0, b = 0, s = 0;
  for (const f of frags) {
    e += f.rho.summary.centroid.epistemic;
    c += f.rho.summary.centroid.commitment;
    t += f.rho.summary.centroid.temporal;
    b += f.rho.summary.centroid.embodiment;
    s += f.rho.summary.centroid.stakes;
  }
  const n = frags.length;

  console.log(`\n${label} (${n} fragments):`);
  console.log(`  Epistemic:  ${(e/n).toFixed(3)}`);
  console.log(`  Commitment: ${(c/n).toFixed(3)}`);
  console.log(`  Temporal:   ${(t/n).toFixed(3)}`);
  console.log(`  Embodiment: ${(b/n).toFixed(3)}`);
  console.log(`  Stakes:     ${(s/n).toFixed(3)}`);
}

analyzeVoiceType(transcriptions, 'TRANSCRIPTIONS (raw handwriting)');
analyzeVoiceType(echoes, 'ECHOES (assistant interpretations)');
analyzeVoiceType(imageDescs, 'IMAGE DESCRIPTIONS');
analyzeVoiceType(reflections, 'USER REFLECTIONS');

// Find the best fragments
console.log('\n' + '═'.repeat(60));
console.log('TOP TRANSCRIPTIONS (your raw voice)');
console.log('═'.repeat(60));

const topTranscriptions = [...transcriptions]
  .sort((a, b) => b.rho.summary.centroid.commitment - a.rho.summary.centroid.commitment)
  .slice(0, 8);

for (const t of topTranscriptions) {
  console.log(`\n[${t.conversationTitle.slice(0, 40)}]`);
  console.log(`C:${t.rho.summary.centroid.commitment.toFixed(2)} B:${t.rho.summary.centroid.embodiment.toFixed(2)}`);
  console.log(`"${t.text.slice(0, 250).replace(/\n/g, ' ')}..."`);
}

console.log('\n' + '═'.repeat(60));
console.log('TOP ECHOES (LLM interpretations of your writing)');
console.log('═'.repeat(60));

const topEchoes = [...echoes]
  .sort((a, b) => b.wordCount - a.wordCount)
  .slice(0, 5);

for (const e of topEchoes) {
  console.log(`\n[${e.conversationTitle.slice(0, 40)}] (${e.wordCount} words)`);
  console.log(`"${e.text.slice(0, 300).replace(/\n/g, ' ')}..."`);
}

console.log('\n' + '═'.repeat(60));
console.log('IMAGE DESCRIPTIONS (visual voice)');
console.log('═'.repeat(60));

const topImages = [...imageDescs]
  .sort((a, b) => b.rho.summary.centroid.embodiment - a.rho.summary.centroid.embodiment)
  .slice(0, 5);

for (const img of topImages) {
  console.log(`\n[${img.conversationTitle.slice(0, 40)}]`);
  console.log(`"${img.text.slice(0, 300).replace(/\n/g, ' ')}..."`);
}

// Save complete voice profile
mkdirSync(OUTPUT_PATH, { recursive: true });

const voiceProfile = {
  summary: {
    totalFragments: fragments.length,
    transcriptions: transcriptions.length,
    echoes: echoes.length,
    imageDescriptions: imageDescs.length,
    userReflections: reflections.length,
  },
  fragments: fragments.map(f => ({
    id: f.id,
    type: f.type,
    text: f.text,
    title: f.conversationTitle,
    timestamp: f.timestamp,
    wordCount: f.wordCount,
    pairedWith: f.pairedWith,
    centroid: f.rho.summary.centroid,
    craft: {
      compression: f.rho.craft.compression.score,
      tension: f.rho.craft.tension.score,
      velocity: f.rho.craft.velocity.score,
    },
    inflections: f.rho.summary.inflectionCount,
  })),
};

writeFileSync(
  join(OUTPUT_PATH, 'notebook-voice.json'),
  JSON.stringify(voiceProfile, null, 2)
);

console.log(`\n✅ Saved voice profile to: ${OUTPUT_PATH}/notebook-voice.json`);
console.log(`   ${fragments.length} fragments (transcriptions + echoes + images)\n`);
