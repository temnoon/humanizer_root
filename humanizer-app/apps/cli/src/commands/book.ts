/**
 * Book Command - Build books from archives
 *
 * Pipeline: Harvest → Cluster → Order → Compose → Export
 */

import chalk from 'chalk';
import ora from 'ora';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import {
  buildBook,
  summarizeBook,
  harvestPassages,
  getHarvestStats,
  clusterPassages,
  buildConceptGraph,
  orderClusters,
  orderPassages,
  exportBook,
  explainOrder,
  PHENOMENOLOGY_CONCEPTS,
  type BookProject,
} from '@humanizer/book';

export interface BookHarvestOptions {
  archive: string;
  output: string;
  minSic: number;
  limit: number;
}

export interface BookComposeOptions {
  input: string;
  output: string;
  format: string;
  maxChapters: number;
}

export interface BookBuildOptions {
  archive: string;
  output: string;
  title: string;
  author: string;
  minSic: number;
  maxChapters: number;
}

/**
 * Harvest passages matching a query
 */
export async function bookHarvestCommand(
  query: string,
  options: BookHarvestOptions
): Promise<void> {
  const archivePath = resolve(options.archive);

  if (!existsSync(archivePath)) {
    console.log(chalk.red(`Archive not found: ${archivePath}`));
    process.exit(1);
  }

  const spinner = ora('Harvesting passages...').start();

  try {
    const passages = await harvestPassages(archivePath, {
      queries: [query],
      minSIC: options.minSic,
      limit: options.limit,
    });

    spinner.succeed(`Found ${passages.length} passages`);

    const stats = getHarvestStats(passages);
    console.log();
    console.log(chalk.cyan('Harvest Statistics:'));
    console.log(`  Passages: ${stats.count}`);
    console.log(`  Words: ${stats.totalWords.toLocaleString()}`);
    console.log(`  Average SIC: ${stats.averageSIC.toFixed(1)}`);
    if (stats.dateRange) {
      console.log(`  Date range: ${stats.dateRange.earliest.toLocaleDateString()} → ${stats.dateRange.latest.toLocaleDateString()}`);
    }

    // Save harvest results
    const outputPath = resolve(options.output);
    mkdirSync(outputPath, { recursive: true });

    const harvestFile = join(outputPath, 'harvest.json');
    writeFileSync(harvestFile, JSON.stringify({
      query,
      passages,
      stats,
      harvestedAt: new Date().toISOString(),
    }, null, 2));

    console.log();
    console.log(chalk.green(`Saved to: ${harvestFile}`));

    // Show top passages
    if (passages.length > 0) {
      console.log();
      console.log(chalk.cyan('Top passages by SIC:'));
      const top = passages.slice(0, 5);
      for (const p of top) {
        const sic = p.sic?.score?.toFixed(0) || '?';
        const preview = p.text.slice(0, 80).replace(/\n/g, ' ') + '...';
        console.log(`  [${chalk.yellow(sic)}] ${chalk.dim(preview)}`);
      }
    }

  } catch (error) {
    spinner.fail('Harvest failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

/**
 * Build a complete book from an archive
 */
export async function bookBuildCommand(
  queries: string[],
  options: BookBuildOptions
): Promise<void> {
  const archivePath = resolve(options.archive);

  if (!existsSync(archivePath)) {
    console.log(chalk.red(`Archive not found: ${archivePath}`));
    process.exit(1);
  }

  console.log(chalk.cyan.bold(`\n📚 Building book: ${options.title}\n`));

  try {
    const project = await buildBook({
      archivePath,
      title: options.title,
      author: options.author,
      theme: queries.join(', '),
      queries,
      harvestOptions: {
        minSIC: options.minSic,
      },
      onProgress: (stage, message) => {
        const icons: Record<string, string> = {
          harvesting: '🔍',
          clustering: '📊',
          ordering: '📐',
          composing: '✍️',
        };
        console.log(`${icons[stage] || '•'} ${message}`);
      },
    });

    console.log();
    console.log(chalk.green.bold('Book built successfully!'));
    console.log();
    console.log(summarizeBook(project));

    // Show chapter overview
    console.log();
    console.log(chalk.cyan('Chapters:'));
    for (const chapter of project.chapters) {
      console.log(`  ${chapter.number}. ${chapter.title} (${chapter.passages.length} passages)`);
    }

    // Explain concept ordering
    const graph = buildConceptGraph(project.passages);
    console.log();
    console.log(chalk.cyan('Concept Order:'));
    console.log(chalk.dim(explainOrder(graph)));

    // Export
    const outputPath = resolve(options.output);
    exportBook(project, {
      format: 'markdown',
      outputPath,
      includeMarginalia: true,
      includeCitations: true,
      includeSIC: true,
    });

    // Also save project JSON
    writeFileSync(
      join(outputPath, 'project.json'),
      JSON.stringify(project, null, 2)
    );

    console.log();
    console.log(chalk.green(`📖 Book exported to: ${outputPath}/`));
    console.log(chalk.dim(`   book.md - Main content`));
    console.log(chalk.dim(`   marginalia.md - Annotations`));
    console.log(chalk.dim(`   project.json - Full project data`));

  } catch (error) {
    console.error(chalk.red('\nBuild failed:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    if (error instanceof Error && error.stack) {
      console.error(chalk.dim(error.stack));
    }
    process.exit(1);
  }
}

/**
 * Show available phenomenology concepts for clustering
 */
export async function bookConceptsCommand(): Promise<void> {
  console.log(chalk.cyan.bold('\n📚 Phenomenology Concepts\n'));
  console.log(chalk.dim('These concepts are used for clustering and ordering:\n'));

  for (const concept of PHENOMENOLOGY_CONCEPTS) {
    console.log(`  • ${concept}`);
  }

  console.log();
  console.log(chalk.dim('Use these as queries: humanizer book build "lifeworld" "epoché"'));
}
