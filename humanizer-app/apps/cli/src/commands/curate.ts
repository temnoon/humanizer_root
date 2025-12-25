/**
 * Curate Command
 *
 * Enter the semifictional space - explore and compose from your archive
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { createInterface } from 'readline';
import { analyzeSIC } from '@humanizer/core';
import type { ParsedArchive, Conversation, Message } from '@humanizer/archive';

interface CurateOptions {
  archive: string;
}

interface ArchiveIndex {
  type: string;
  stats: {
    conversationCount: number;
    messageCount: number;
    userMessageCount: number;
    assistantMessageCount: number;
    wordCount: number;
    dateRange: { earliest?: string; latest?: string };
  };
  conversations: Array<{
    id: string;
    title: string;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
}

let loadedArchive: ParsedArchive | null = null;
let archiveIndex: ArchiveIndex | null = null;

export async function curateCommand(options: CurateOptions): Promise<void> {
  console.log(
    boxen(
      chalk.cyan.bold('CURATION MODE') +
        '\n\n' +
        chalk.dim('You are the curator of your own archive.') +
        '\n' +
        chalk.dim('Your writings are the density matrix of a lifetime.') +
        '\n' +
        chalk.dim('Here, you explore and compose.'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
      }
    )
  );

  // Load archive
  const indexPath = join(options.archive, 'index.json');
  const archivePath = join(options.archive, 'archive.json');

  if (!existsSync(indexPath)) {
    console.log(chalk.red(`Archive not found at: ${options.archive}`));
    console.log(chalk.dim('Run: humanizer import <path> -o ' + options.archive));
    process.exit(1);
  }

  try {
    archiveIndex = JSON.parse(readFileSync(indexPath, 'utf-8'));
    console.log(chalk.green('✓') + chalk.dim(` Loaded archive: ${archiveIndex!.stats.conversationCount} conversations`));
  } catch (error) {
    console.log(chalk.red('Failed to load archive index'));
    process.exit(1);
  }

  console.log();
  console.log(chalk.dim('Commands: search, stats, analyze, find, exit'));
  console.log();

  // Interactive REPL
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('curate> '),
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    const [cmd, ...args] = input.split(' ');
    const query = args.join(' ');

    if (cmd === 'exit' || cmd === 'quit' || cmd === 'q') {
      console.log(chalk.dim('\nBalance is a practice, not a destination.\n'));
      rl.close();
      return;
    }

    if (cmd === 'help' || cmd === '?') {
      showHelp();
    } else if (cmd === 'stats') {
      showStats();
    } else if (cmd === 'search' && query) {
      await searchArchive(query, options.archive);
    } else if (cmd === 'find' && query) {
      findConversations(query);
    } else if (cmd === 'analyze' && query) {
      analyzeText(query);
    } else if (cmd === 'read' && query) {
      await readConversation(query, options.archive);
    } else if (cmd === '') {
      // Empty input
    } else {
      console.log(chalk.dim(`Unknown command: ${cmd}`));
      console.log(chalk.dim('Type "help" for available commands'));
    }

    console.log();
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

function showHelp(): void {
  console.log();
  console.log(chalk.bold('Curation Commands:'));
  console.log();
  console.log(`  ${chalk.green('stats')}              ${chalk.dim('Show archive statistics')}`);
  console.log(`  ${chalk.green('find')} <query>       ${chalk.dim('Find conversations by title')}`);
  console.log(`  ${chalk.green('search')} <query>     ${chalk.dim('Search message content')}`);
  console.log(`  ${chalk.green('read')} <id>          ${chalk.dim('Read a conversation')}`);
  console.log(`  ${chalk.green('analyze')} <text>     ${chalk.dim('Analyze text for SIC')}`);
  console.log(`  ${chalk.green('exit')}               ${chalk.dim('Exit curation mode')}`);
  console.log();
  console.log(chalk.dim('The goal is to evoke from this lifetime of work'));
  console.log(chalk.dim('the human who has been dying to speak.'));
}

function showStats(): void {
  if (!archiveIndex) return;

  const { stats } = archiveIndex;

  console.log();
  console.log(chalk.bold('Archive Statistics'));
  console.log();

  const table = new Table({
    style: { head: [], border: [] },
  });

  table.push(
    [chalk.dim('Conversations'), chalk.white(stats.conversationCount.toLocaleString())],
    [chalk.dim('Total Messages'), chalk.white(stats.messageCount.toLocaleString())],
    [chalk.dim('Your Messages'), chalk.cyan(stats.userMessageCount.toLocaleString())],
    [chalk.dim('AI Messages'), chalk.dim(stats.assistantMessageCount.toLocaleString())],
    [chalk.dim('Total Words'), chalk.white(stats.wordCount.toLocaleString())],
  );

  if (stats.dateRange.earliest) {
    const earliest = new Date(stats.dateRange.earliest).toLocaleDateString();
    const latest = new Date(stats.dateRange.latest!).toLocaleDateString();
    table.push([chalk.dim('Date Range'), chalk.white(`${earliest} → ${latest}`)]);
  }

  console.log(table.toString());
}

function findConversations(query: string): void {
  if (!archiveIndex) return;

  const queryLower = query.toLowerCase();
  const matches = archiveIndex.conversations.filter(c =>
    c.title.toLowerCase().includes(queryLower)
  );

  console.log();
  if (matches.length === 0) {
    console.log(chalk.yellow(`No conversations matching "${query}"`));
    return;
  }

  console.log(chalk.bold(`Found ${matches.length} conversations:`));
  console.log();

  for (const conv of matches.slice(0, 10)) {
    const date = new Date(conv.createdAt).toLocaleDateString();
    console.log(
      `  ${chalk.cyan('•')} ${chalk.white(truncate(conv.title, 50))} ` +
      chalk.dim(`(${conv.messageCount} msgs, ${date})`) +
      chalk.dim(` [${conv.id.slice(0, 8)}]`)
    );
  }

  if (matches.length > 10) {
    console.log(chalk.dim(`  ... and ${matches.length - 10} more`));
  }
}

async function searchArchive(query: string, archivePath: string): Promise<void> {
  // Lazy load full archive for search
  if (!loadedArchive) {
    const fullPath = join(archivePath, 'archive.json');
    if (!existsSync(fullPath)) {
      console.log(chalk.yellow('Full archive not available for content search'));
      console.log(chalk.dim('Use "find" to search by title'));
      return;
    }

    console.log(chalk.dim('Loading full archive for search...'));
    try {
      loadedArchive = JSON.parse(readFileSync(fullPath, 'utf-8'));
    } catch {
      console.log(chalk.red('Failed to load archive'));
      return;
    }
  }

  const queryLower = query.toLowerCase();
  const results: Array<{
    conv: Conversation;
    msg: Message;
    snippet: string;
  }> = [];

  for (const conv of loadedArchive!.conversations) {
    for (const msg of conv.messages) {
      if (msg.author.role !== 'user') continue; // Only search your messages

      if (msg.content.toLowerCase().includes(queryLower)) {
        // Extract snippet around match
        const idx = msg.content.toLowerCase().indexOf(queryLower);
        const start = Math.max(0, idx - 40);
        const end = Math.min(msg.content.length, idx + query.length + 40);
        let snippet = msg.content.slice(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < msg.content.length) snippet = snippet + '...';

        results.push({ conv, msg, snippet });

        if (results.length >= 15) break;
      }
    }
    if (results.length >= 15) break;
  }

  console.log();
  if (results.length === 0) {
    console.log(chalk.yellow(`No messages matching "${query}"`));
    return;
  }

  console.log(chalk.bold(`Found ${results.length}+ matches for "${query}":`));
  console.log();

  for (const { conv, msg, snippet } of results) {
    const date = new Date(msg.timestamp).toLocaleDateString();
    console.log(
      chalk.cyan('─'.repeat(60))
    );
    console.log(
      chalk.dim('From: ') + chalk.white(truncate(conv.title || 'Untitled', 40)) +
      chalk.dim(` (${date})`)
    );
    console.log();

    // Highlight the query in the snippet
    const highlighted = snippet.replace(
      new RegExp(`(${escapeRegex(query)})`, 'gi'),
      chalk.yellow.bold('$1')
    );
    console.log(`  "${highlighted}"`);
    console.log();
  }
}

async function readConversation(idPrefix: string, archivePath: string): Promise<void> {
  if (!archiveIndex) return;

  // Find conversation by ID prefix
  const conv = archiveIndex.conversations.find(c =>
    c.id.toLowerCase().startsWith(idPrefix.toLowerCase())
  );

  if (!conv) {
    console.log(chalk.yellow(`No conversation found with ID starting with "${idPrefix}"`));
    return;
  }

  // Load full archive if needed
  if (!loadedArchive) {
    const fullPath = join(archivePath, 'archive.json');
    try {
      loadedArchive = JSON.parse(readFileSync(fullPath, 'utf-8'));
    } catch {
      console.log(chalk.red('Failed to load archive'));
      return;
    }
  }

  const fullConv = loadedArchive!.conversations.find(c => c.id === conv.id);
  if (!fullConv) {
    console.log(chalk.red('Conversation not found in archive'));
    return;
  }

  console.log();
  console.log(chalk.bold(fullConv.title || 'Untitled'));
  console.log(chalk.dim(new Date(fullConv.createdAt).toLocaleDateString()));
  console.log(chalk.cyan('─'.repeat(60)));
  console.log();

  for (const msg of fullConv.messages.slice(0, 20)) {
    const role = msg.author.role === 'user' ? chalk.green('You') : chalk.blue('AI');
    const content = truncate(msg.content, 200);

    console.log(`${role}: ${content}`);
    console.log();
  }

  if (fullConv.messages.length > 20) {
    console.log(chalk.dim(`... ${fullConv.messages.length - 20} more messages`));
  }
}

function analyzeText(text: string): void {
  const result = analyzeSIC(text, { includeEvidence: false });

  console.log();
  console.log(
    chalk.bold('SIC Score: ') +
    getScoreColor(result.score)(result.score.toFixed(0)) +
    chalk.dim('/100') +
    '  ' +
    getCategoryBadge(result.category)
  );
}

function getScoreColor(score: number): (text: string) => string {
  if (score >= 70) return chalk.green;
  if (score >= 40) return chalk.yellow;
  return chalk.red;
}

function getCategoryBadge(category: string): string {
  const badges: Record<string, string> = {
    'polished-human': chalk.green('Polished Human'),
    'raw-human': chalk.yellow('Raw Human'),
    'neat-slop': chalk.red('Neat Slop'),
    'messy-low-craft': chalk.dim('Messy Low-Craft'),
  };
  return badges[category] || category;
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 3) + '...';
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
