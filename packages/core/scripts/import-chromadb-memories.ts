#!/usr/bin/env npx tsx
/**
 * Import ChromaDB Memory Export into Humanizer Archive
 *
 * Converts exported markdown memories into ParsedArchive format
 * and imports them into the PostgreSQL content store.
 */

import * as fs from 'fs';
import * as path from 'path';
import { importArchiveToDb } from '../src/adapters/parsers/import-to-db.js';
import type {
  ParsedArchive,
  Conversation,
  ConversationMapping,
  Message,
  ExportFormat
} from '../src/adapters/parsers/types.js';

const MEMORIES_DIR = '/Users/tem/archive/mcp-memory/exported-memories';

interface ParsedMemory {
  title: string;
  date: Date;
  hash: string;
  type: string;
  tags: string[];
  metadata: Record<string, unknown>;
  content: string;
  monthKey: string;
  filename: string;
}

function parseMarkdownFile(filepath: string): ParsedMemory | null {
  try {
    const raw = fs.readFileSync(filepath, 'utf-8');
    const lines = raw.split('\n');

    // Parse frontmatter-style header
    let title = '';
    let date = new Date();
    let hash = '';
    let type = 'memory';
    let tags: string[] = [];
    let metadata: Record<string, unknown> = {};
    let contentStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('# ')) {
        title = line.slice(2).trim();
      } else if (line.startsWith('**Date**:')) {
        const dateStr = line.replace('**Date**:', '').trim();
        date = new Date(dateStr);
      } else if (line.startsWith('**Hash**:')) {
        hash = line.replace('**Hash**:', '').replace(/`/g, '').trim();
      } else if (line.startsWith('**Type**:')) {
        type = line.replace('**Type**:', '').trim();
      } else if (line.startsWith('**Tags**:')) {
        const tagsStr = line.replace('**Tags**:', '').trim();
        tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
      } else if (line.startsWith('**Metadata**:')) {
        try {
          const metaStr = line.replace('**Metadata**:', '').replace(/`/g, '').trim();
          metadata = JSON.parse(metaStr);
        } catch {
          // Ignore parse errors
        }
      } else if (line === '---') {
        contentStartLine = i + 2; // Skip the --- and blank line
        break;
      }
    }

    // Extract content after the separator
    const content = lines.slice(contentStartLine).join('\n').trim();

    // Get month key from directory
    const dirname = path.basename(path.dirname(filepath));
    const monthKey = dirname.match(/^\d{4}-\d{2}$/) ? dirname : 'unknown';

    return {
      title: title || 'Untitled Memory',
      date,
      hash,
      type,
      tags,
      metadata,
      content,
      monthKey,
      filename: path.basename(filepath),
    };
  } catch (err) {
    console.error(`Error parsing ${filepath}:`, err);
    return null;
  }
}

function memoryToConversation(memory: ParsedMemory, index: number): Conversation {
  const timestamp = Math.floor(memory.date.getTime() / 1000);
  const rootId = `root-${memory.hash.slice(0, 8)}`;
  const msgId = `msg-${memory.hash.slice(0, 12)}`;

  const message: Message = {
    id: msgId,
    author: {
      role: 'assistant',  // These are AI assistant memories
      name: 'claude-code',
    },
    create_time: timestamp,
    content: {
      content_type: 'text',
      parts: [memory.content],
    },
    metadata: {
      memory_type: memory.type,
      memory_tags: memory.tags,
      original_hash: memory.hash,
      ...memory.metadata,
    },
  };

  const mapping: ConversationMapping = {
    [rootId]: {
      id: rootId,
      children: [msgId],
    },
    [msgId]: {
      id: msgId,
      message,
      parent: rootId,
      children: [],
    },
  };

  return {
    conversation_id: `chromadb-memory-${memory.hash.slice(0, 16)}`,
    title: memory.title,
    create_time: timestamp,
    update_time: timestamp,
    mapping,
    moderation_results: [],
    current_node: msgId,
    _source: 'chromadb-memory',
    _import_date: new Date().toISOString(),
    _original_id: memory.hash,
  };
}

async function main() {
  console.log('ChromaDB Memory Import');
  console.log('======================\n');

  // Find all month directories
  const entries = fs.readdirSync(MEMORIES_DIR, { withFileTypes: true });
  const monthDirs = entries
    .filter(e => e.isDirectory() && /^\d{4}-\d{2}$/.test(e.name))
    .map(e => e.name)
    .sort();

  console.log(`Found ${monthDirs.length} month directories: ${monthDirs.join(', ')}\n`);

  // Parse all memories
  const allMemories: ParsedMemory[] = [];

  for (const month of monthDirs) {
    const monthPath = path.join(MEMORIES_DIR, month);
    const files = fs.readdirSync(monthPath).filter(f => f.endsWith('.md'));

    console.log(`Processing ${month}: ${files.length} files...`);

    for (const file of files) {
      const filepath = path.join(monthPath, file);
      const memory = parseMarkdownFile(filepath);
      if (memory) {
        allMemories.push(memory);
      }
    }
  }

  console.log(`\nParsed ${allMemories.length} memories total\n`);

  // Sort by date
  allMemories.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Show date range
  if (allMemories.length > 0) {
    const earliest = allMemories[0].date;
    const latest = allMemories[allMemories.length - 1].date;
    console.log(`Date range: ${earliest.toISOString().split('T')[0]} to ${latest.toISOString().split('T')[0]}`);
  }

  // Count by type
  const byType: Record<string, number> = {};
  for (const mem of allMemories) {
    byType[mem.type] = (byType[mem.type] || 0) + 1;
  }
  console.log('\nMemory types:');
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${type}: ${count}`);
  }

  // Collect all tags
  const allTags: Record<string, number> = {};
  for (const mem of allMemories) {
    for (const tag of mem.tags) {
      allTags[tag] = (allTags[tag] || 0) + 1;
    }
  }
  console.log(`\nUnique tags: ${Object.keys(allTags).length}`);
  console.log('Top tags:');
  for (const [tag, count] of Object.entries(allTags).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${tag}: ${count}`);
  }

  // Convert to conversations
  console.log('\nConverting to ParsedArchive format...');
  const conversations = allMemories.map((mem, i) => memoryToConversation(mem, i));

  // Build ParsedArchive
  const archive: ParsedArchive = {
    conversations,
    mediaFiles: [],
    format: 'openai' as ExportFormat, // Use openai format for compatibility
    extractedPath: MEMORIES_DIR,
    stats: {
      totalConversations: conversations.length,
      totalMessages: conversations.length, // 1 message per conversation
      totalMediaFiles: 0,
      parseErrors: 0,
    },
  };

  console.log(`\nCreated archive with ${archive.stats.totalConversations} conversations`);

  // Import to database
  console.log('\nImporting to PostgreSQL...\n');

  try {
    const result = await importArchiveToDb(archive, {
      verbose: true,
      generateEmbeddings: true,
      generateHashes: true,
      extractMediaText: false,
      detectPaste: false,
      enrichContent: false,
    });

    console.log('\n=== Import Complete ===');
    console.log(`Success: ${result.success}`);
    console.log(`Conversations created: ${result.conversationsCreated}`);
    console.log(`Conversations updated: ${result.conversationsUpdated}`);
    console.log(`Messages added: ${result.totalMessagesAdded}`);
    console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);

    if (result.errors.length > 0) {
      console.log(`\nErrors (${result.errors.length}):`);
      for (const err of result.errors.slice(0, 10)) {
        console.log(`  - ${err}`);
      }
      if (result.errors.length > 10) {
        console.log(`  ... and ${result.errors.length - 10} more`);
      }
    }
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }
}

main().catch(console.error);
