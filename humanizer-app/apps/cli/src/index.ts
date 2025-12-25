#!/usr/bin/env node
/**
 * Humanizer CLI
 *
 * Terminal-native interface for reclaiming subjective agency.
 *
 * "The reader is the single point of contact where the infinite potential
 * of recorded meaning must pass through the finite aperture of a single attention."
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { analyzeCommand } from './commands/analyze.js';
import { importCommand } from './commands/import.js';
import { curateCommand } from './commands/curate.js';
import { bookHarvestCommand, bookBuildCommand, bookConceptsCommand } from './commands/book.js';

const VERSION = '0.1.0';

const BANNER = `
╦ ╦╦ ╦╔╦╗╔═╗╔╗╔╦╔═╗╔═╗╦═╗
╠═╣║ ║║║║╠═╣║║║║╔═╝║╣ ╠╦╝
╩ ╩╚═╝╩ ╩╩ ╩╝╚╝╩╚═╝╚═╝╩╚═
`;

const program = new Command();

program
  .name('humanizer')
  .description('Reclaim your words. Find the human inside.')
  .version(VERSION)
  .addHelpText('before', chalk.cyan(BANNER))
  .addHelpText(
    'after',
    `
${chalk.dim('Examples:')}
  ${chalk.green('humanizer analyze')} text.txt       ${chalk.dim('Analyze SIC in a file')}
  ${chalk.green('humanizer import')} chatgpt/        ${chalk.dim('Import ChatGPT archive')}
  ${chalk.green('humanizer curate')}                 ${chalk.dim('Enter curation mode')}
  ${chalk.green('humanizer search')} "my old words"  ${chalk.dim('Find in your archive')}
`
  );

// Analyze command - semantic trajectory analysis
program
  .command('analyze')
  .description('Analyze text for semantic position and craft')
  .argument('[input]', 'File path or text to analyze')
  .option('-s, --stdin', 'Read from stdin')
  .option('-j, --json', 'Output as JSON')
  .option('-v, --verbose', 'Include sentence-level details')
  .option('--vector', 'Use new vector analysis (default)')
  .option('--legacy', 'Use legacy SIC analysis')
  .option('--no-color', 'Disable colors')
  .action((input, options) => {
    // Default to vector mode unless --legacy is specified
    if (!options.legacy) {
      options.vector = true;
    }
    return analyzeCommand(input, options);
  });

// Import command - bring in archives
program
  .command('import')
  .description('Import an archive (ChatGPT, Facebook, notes)')
  .argument('<path>', 'Path to archive folder or file')
  .option('-t, --type <type>', 'Archive type (chatgpt, facebook, notes)', 'auto')
  .option('-o, --output <path>', 'Output location', './humanizer-archive')
  .option('--dry-run', 'Preview without importing')
  .action(importCommand);

// Curate command - enter interactive curation
program
  .command('curate')
  .description('Enter curation mode - explore and compose')
  .option('-a, --archive <path>', 'Path to archive', './humanizer-archive')
  .action(curateCommand);

// Search command
program
  .command('search <query>')
  .description('Search your archive')
  .option('-a, --archive <path>', 'Path to archive', './humanizer-archive')
  .option('-l, --limit <n>', 'Maximum results', '20')
  .option('--sic-min <n>', 'Minimum SIC score', '0')
  .option('--sic-max <n>', 'Maximum SIC score', '100')
  .action(async (query, options) => {
    console.log(chalk.yellow('Search not yet implemented'));
    console.log(chalk.dim(`Would search for: "${query}"`));
  });

// Stats command
program
  .command('stats')
  .description('Show archive statistics')
  .option('-a, --archive <path>', 'Path to archive', './humanizer-archive')
  .action(async (options) => {
    console.log(chalk.yellow('Stats not yet implemented'));
  });

// Book command group
const book = program
  .command('book')
  .description('Build books from your archive');

book
  .command('harvest <query>')
  .description('Harvest passages matching a query')
  .option('-a, --archive <path>', 'Path to archive', './my-archive')
  .option('-o, --output <path>', 'Output directory', './book-project')
  .option('--min-sic <n>', 'Minimum SIC score', '30')
  .option('-l, --limit <n>', 'Maximum passages', '200')
  .action(bookHarvestCommand);

book
  .command('build <queries...>')
  .description('Build a complete book from queries')
  .option('-a, --archive <path>', 'Path to archive', './my-archive')
  .option('-o, --output <path>', 'Output directory', './book-output')
  .option('-t, --title <title>', 'Book title', 'Untitled')
  .option('--author <name>', 'Author name', 'Anonymous')
  .option('--min-sic <n>', 'Minimum SIC score', '30')
  .option('--max-chapters <n>', 'Maximum chapters', '12')
  .action(bookBuildCommand);

book
  .command('concepts')
  .description('List available phenomenology concepts')
  .action(bookConceptsCommand);

// Handle no command
program.action(() => {
  console.log(
    boxen(chalk.cyan(BANNER) + '\n' + chalk.dim('Infrastructure for reclaiming subjective agency'), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
    })
  );
  console.log(chalk.dim('Run `humanizer --help` for available commands\n'));
});

// Parse and run
program.parse();
