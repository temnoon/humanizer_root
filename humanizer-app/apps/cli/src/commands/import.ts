/**
 * Import Command
 *
 * Bring archives into the Humanizer system - reclaim your words
 */

import { existsSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import {
  parseArchive,
  detectArchiveType,
  type ParsedArchive,
} from '@humanizer/archive';

interface ImportOptions {
  type: 'auto' | 'chatgpt' | 'facebook' | 'notes';
  output: string;
  dryRun?: boolean;
}

export async function importCommand(
  path: string,
  options: ImportOptions
): Promise<void> {
  // Verify path exists
  if (!existsSync(path)) {
    console.log(chalk.red(`Path not found: ${path}`));
    process.exit(1);
  }

  const isDir = statSync(path).isDirectory();
  if (!isDir) {
    console.log(chalk.red(`Path must be a directory: ${path}`));
    process.exit(1);
  }

  const type = options.type === 'auto' ? detectArchiveType(path) : options.type;

  console.log();
  console.log(chalk.bold('Import Archive'));
  console.log(chalk.dim('─'.repeat(50)));
  console.log(`  ${chalk.dim('Source:')} ${chalk.cyan(path)}`);
  console.log(`  ${chalk.dim('Type:')}   ${chalk.cyan(type)}`);
  console.log(`  ${chalk.dim('Output:')} ${chalk.cyan(options.output)}`);
  console.log();

  if (type === 'unknown' || type === 'notes') {
    console.log(chalk.yellow('Could not detect archive type.'));
    console.log(chalk.dim('Supported formats: ChatGPT export, Facebook export'));
    process.exit(1);
  }

  if (options.dryRun) {
    console.log(chalk.yellow('Dry run mode - no changes will be made'));
    console.log();
  }

  const spinner = ora('Parsing archive...').start();

  try {
    const parsed = await parseArchive(path);
    spinner.succeed('Archive parsed');

    // Display statistics
    console.log();
    displayStats(parsed);

    if (options.dryRun) {
      console.log();
      console.log(chalk.yellow('Dry run complete. No files written.'));
      return;
    }

    // Create output directory and save
    spinner.start('Saving archive...');

    mkdirSync(options.output, { recursive: true });

    // Save parsed data
    const outputPath = join(options.output, 'archive.json');
    writeFileSync(outputPath, JSON.stringify(parsed, null, 2));

    // Save index for quick access
    const indexPath = join(options.output, 'index.json');
    const index = {
      type: parsed.type,
      sourcePath: parsed.sourcePath,
      stats: parsed.stats,
      conversations: parsed.conversations.map(c => ({
        id: c.id,
        title: c.title,
        messageCount: c.messages.length,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      importedAt: new Date().toISOString(),
    };
    writeFileSync(indexPath, JSON.stringify(index, null, 2));

    spinner.succeed('Archive saved');

    console.log();
    console.log(chalk.green('✓') + ' Archive imported successfully');
    console.log(chalk.dim(`  Location: ${options.output}`));
    console.log();
    console.log(chalk.dim('Next steps:'));
    console.log(chalk.dim(`  humanizer curate -a ${options.output}`));
    console.log(chalk.dim(`  humanizer search "your query" -a ${options.output}`));

  } catch (error) {
    spinner.fail('Import failed');
    console.error(chalk.red(String(error)));
    process.exit(1);
  }
}

function displayStats(parsed: ParsedArchive): void {
  const { stats } = parsed;

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
    table.push([
      chalk.dim('Date Range'),
      chalk.white(
        `${formatDate(stats.dateRange.earliest)} → ${formatDate(stats.dateRange.latest!)}`
      ),
    ]);
  }

  console.log(table.toString());

  // Show sample conversations
  if (parsed.conversations.length > 0) {
    console.log();
    console.log(chalk.bold('Sample Conversations'));
    console.log();

    const samples = parsed.conversations.slice(0, 5);
    for (const conv of samples) {
      const msgCount = conv.messages.length;
      const userMsgs = conv.messages.filter(m => m.author.role === 'user').length;
      console.log(
        `  ${chalk.cyan('•')} ${chalk.white(truncate(conv.title || 'Untitled', 40))} ` +
        chalk.dim(`(${msgCount} msgs, ${userMsgs} yours)`)
      );
    }

    if (parsed.conversations.length > 5) {
      console.log(chalk.dim(`  ... and ${parsed.conversations.length - 5} more`));
    }
  }

  // Show media summary
  if (parsed.media.length > 0) {
    console.log();
    console.log(chalk.bold('Media Files'));
    const images = parsed.media.filter(m => m.type === 'image').length;
    const audio = parsed.media.filter(m => m.type === 'audio').length;
    const other = parsed.media.length - images - audio;

    const parts = [];
    if (images > 0) parts.push(`${images} images`);
    if (audio > 0) parts.push(`${audio} audio`);
    if (other > 0) parts.push(`${other} other`);
    console.log(chalk.dim(`  ${parts.join(', ')}`));
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 3) + '...';
}
