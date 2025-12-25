/**
 * Analyze Command
 *
 * Analyze text for semantic position, trajectory, and craft metrics.
 * Uses the new vector model: sentence-by-sentence through semantic space.
 */

import { readFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import {
  analyzeSIC,
  analyzePassage,
  formatTrajectory,
  tokenize,
  type SICAnalysis,
  type SICCategory,
  type PassageRho,
} from '@humanizer/core';

interface AnalyzeOptions {
  stdin?: boolean;
  json?: boolean;
  verbose?: boolean;
  color?: boolean;
  vector?: boolean;  // Use new vector analysis
}

export async function analyzeCommand(
  input: string | undefined,
  options: AnalyzeOptions
): Promise<void> {
  let text: string;

  // Get input text
  if (options.stdin || !input) {
    text = await readStdin();
    if (!text.trim()) {
      console.log(chalk.yellow('No input provided. Use --stdin or provide a file path.'));
      process.exit(1);
    }
  } else if (existsSync(input)) {
    text = readFileSync(input, 'utf-8');
  } else {
    // Treat as literal text
    text = input;
  }

  // Use vector analysis (new) or SIC analysis (legacy)
  if (options.vector) {
    const spinner = ora('Analyzing semantic trajectory...').start();

    try {
      const result = analyzePassage(text);
      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log();
        console.log(formatTrajectory(result));
        console.log();
        displayVectorSummary(result, options);
      }
    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red(String(error)));
      process.exit(1);
    }
  } else {
    const spinner = ora('Analyzing for Subjective Intentional Constraint...').start();

    try {
      const result = analyzeSIC(text, { includeEvidence: options.verbose });
      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        displayResults(result, text, options);
      }
    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red(String(error)));
      process.exit(1);
    }
  }
}

function displayVectorSummary(result: PassageRho, options: AnalyzeOptions): void {
  // Craft metrics table
  const table = new Table({
    head: [chalk.cyan('Craft Metric'), chalk.cyan('Score'), chalk.cyan('Details')],
    style: { head: [], border: [] },
  });

  table.push([
    'Compression',
    formatPercent(result.craft.compression.score),
    `${result.craft.compression.wordsPerSentence.toFixed(1)} words/sentence, ${(result.craft.compression.fillerRatio * 100).toFixed(0)}% filler`,
  ]);

  table.push([
    'Surprise',
    formatPercent(result.craft.surprise.score),
    `${result.craft.surprise.unusualTransitions} transitions, ${result.craft.surprise.patternBreaks} breaks`,
  ]);

  table.push([
    'Specificity',
    formatPercent(result.craft.specificity.score),
    `${result.craft.specificity.concreteNouns} concrete, ${result.craft.specificity.sensoryDetails} sensory`,
  ]);

  table.push([
    'Tension',
    formatPercent(result.craft.tension.score),
    `${result.craft.tension.openQuestions} questions, ${result.craft.tension.unresolvedContrasts} contrasts`,
  ]);

  table.push([
    'Velocity',
    formatPercent(result.craft.velocity.score),
    `avg distance: ${result.craft.velocity.averageDistance.toFixed(2)}, ${(result.craft.velocity.stationaryRatio * 100).toFixed(0)}% stationary`,
  ]);

  console.log(chalk.bold('Craft Metrics:'));
  console.log(table.toString());
  console.log();

  // Show sentence positions if verbose
  if (options.verbose && result.sentences.length > 0) {
    console.log(chalk.bold('Sentence Positions:'));
    console.log();

    for (const s of result.sentences.slice(0, 8)) {
      const preview = s.text.slice(0, 50) + (s.text.length > 50 ? '...' : '');
      const pos = s.position;
      console.log(chalk.dim(`[${s.index}]`) + ` ${preview}`);
      console.log(
        `    E:${formatDim(pos.epistemic)} C:${formatDim(pos.commitment)} ` +
        `T:${formatDim(pos.temporal)} B:${formatDim(pos.embodiment)} S:${formatDim(pos.stakes)}`
      );
      console.log();
    }

    if (result.sentences.length > 8) {
      console.log(chalk.dim(`... and ${result.sentences.length - 8} more sentences`));
    }
  }
}

function formatPercent(score: number): string {
  const pct = (score * 100).toFixed(0);
  if (score >= 0.6) return chalk.green(`${pct}%`);
  if (score >= 0.3) return chalk.yellow(`${pct}%`);
  return chalk.dim(`${pct}%`);
}

function formatDim(value: number): string {
  const sign = value >= 0 ? '+' : '';
  const str = `${sign}${value.toFixed(2)}`;
  if (Math.abs(value) >= 0.3) return chalk.cyan(str);
  return chalk.dim(str);
}

function displayResults(
  result: SICAnalysis,
  text: string,
  options: AnalyzeOptions
): void {
  console.log();

  // Main score display
  const scoreColor = getScoreColor(result.score);
  const scoreBar = createScoreBar(result.score);

  console.log(
    chalk.bold('SIC Score: ') +
      scoreColor(result.score.toFixed(1)) +
      chalk.dim('/100') +
      '  ' +
      scoreBar
  );

  console.log(
    chalk.dim('Confidence: ') +
      chalk.white((result.confidence * 100).toFixed(0) + '%') +
      '  ' +
      chalk.dim('Category: ') +
      getCategoryLabel(result.category)
  );

  console.log();

  // Signal breakdown table
  const table = new Table({
    head: [chalk.cyan('Signal'), chalk.cyan('Raw'), chalk.cyan('Weighted'), chalk.cyan('Count')],
    style: { head: [], border: [] },
  });

  // Positive signals
  table.push([{ content: chalk.green.bold('Positive Signals'), colSpan: 4 }]);
  table.push([
    'Irreversibility',
    formatScore(result.positive.irreversibility.raw),
    formatWeight(result.positive.irreversibility.weighted),
    String(result.positive.irreversibility.count),
  ]);
  table.push([
    'Temporal Pressure',
    formatScore(result.positive.temporalPressure.raw),
    formatWeight(result.positive.temporalPressure.weighted),
    String(result.positive.temporalPressure.count),
  ]);
  table.push([
    'Epistemic Incompleteness',
    formatScore(result.positive.epistemicIncompleteness.raw),
    formatWeight(result.positive.epistemicIncompleteness.weighted),
    String(result.positive.epistemicIncompleteness.count),
  ]);
  table.push([
    'Value Tradeoffs',
    formatScore(result.positive.valueTradeoffs.raw),
    formatWeight(result.positive.valueTradeoffs.weighted),
    String(result.positive.valueTradeoffs.count),
  ]);
  table.push([
    'Scar Tissue',
    formatScore(result.positive.scarTissue.raw),
    formatWeight(result.positive.scarTissue.weighted),
    String(result.positive.scarTissue.count),
  ]);
  table.push([
    'Embodiment',
    formatScore(result.positive.embodiment.raw),
    formatWeight(result.positive.embodiment.weighted),
    String(result.positive.embodiment.count),
  ]);

  // Negative signals
  table.push([{ content: chalk.red.bold('Negative Signals'), colSpan: 4 }]);
  table.push([
    'Resolution Without Cost',
    formatScore(result.negative.resolutionWithoutCost.raw),
    formatWeight(result.negative.resolutionWithoutCost.weighted, true),
    String(result.negative.resolutionWithoutCost.count),
  ]);
  table.push([
    'Manager Voice',
    formatScore(result.negative.managerVoice.raw),
    formatWeight(result.negative.managerVoice.weighted, true),
    String(result.negative.managerVoice.count),
  ]);
  table.push([
    'Symmetry/Coverage',
    formatScore(result.negative.symmetryCoverage.raw),
    formatWeight(result.negative.symmetryCoverage.weighted, true),
    String(result.negative.symmetryCoverage.count),
  ]);
  table.push([
    'Generic Facsimile',
    formatScore(result.negative.genericFacsimile.raw),
    formatWeight(result.negative.genericFacsimile.weighted, true),
    String(result.negative.genericFacsimile.count),
  ]);

  console.log(table.toString());
  console.log();

  // Show evidence if verbose
  if (options.verbose && result.evidence.length > 0) {
    console.log(chalk.bold('Evidence:'));
    console.log();

    for (const ev of result.evidence.slice(0, 10)) {
      const color = ev.polarity === 'positive' ? chalk.green : chalk.red;
      const symbol = ev.polarity === 'positive' ? '+' : '-';

      console.log(
        color(`[${symbol}] ${ev.signal}`) +
          chalk.dim(` (strength: ${ev.strength.toFixed(1)})`)
      );
      console.log(chalk.dim('   "' + ev.quote.trim() + '"'));
      console.log();
    }

    if (result.evidence.length > 10) {
      console.log(chalk.dim(`... and ${result.evidence.length - 10} more`));
    }
  }

  // Interpretation
  console.log(chalk.dim('─'.repeat(60)));
  console.log();
  console.log(chalk.bold('Interpretation:'));
  console.log(getInterpretation(result));
  console.log();
}

function getScoreColor(score: number): (text: string) => string {
  if (score >= 70) return chalk.green;
  if (score >= 40) return chalk.yellow;
  return chalk.red;
}

function createScoreBar(score: number): string {
  const width = 30;
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;

  const filledChar = '█';
  const emptyChar = '░';

  let bar = '';
  for (let i = 0; i < filled; i++) {
    if (i < width * 0.4) bar += chalk.red(filledChar);
    else if (i < width * 0.7) bar += chalk.yellow(filledChar);
    else bar += chalk.green(filledChar);
  }
  bar += chalk.dim(emptyChar.repeat(empty));

  return bar;
}

function formatScore(score: number): string {
  return score.toFixed(2);
}

function formatWeight(weight: number, negative = false): string {
  const value = weight.toFixed(3);
  return negative ? chalk.red(`-${value}`) : chalk.green(`+${value}`);
}

function getCategoryLabel(category: SICCategory): string {
  const labels: Record<SICCategory, string> = {
    'polished-human': chalk.green('Polished Human'),
    'raw-human': chalk.yellow('Raw Human'),
    'neat-slop': chalk.red('Neat Slop'),
    'messy-low-craft': chalk.dim('Messy Low-Craft'),
  };
  return labels[category];
}

function getInterpretation(result: SICAnalysis): string {
  const { score, category } = result;

  if (category === 'polished-human') {
    return chalk.green(
      'This text shows strong traces of lived constraint - irreversibility, genuine uncertainty, ' +
        'and embodied stakes. It bears the marks of a mind paying the cost of being itself.'
    );
  }

  if (category === 'raw-human') {
    return chalk.yellow(
      'This text has authentic human traces but rough edges. The constraint signals are present, ' +
        'but the craft could use refinement. This is often the voice of genuine thought in progress.'
    );
  }

  if (category === 'neat-slop') {
    return chalk.red(
      'This text is suspiciously clean. It resolves tension too easily, covers all angles, ' +
        'and lacks the scar tissue of genuine commitment. The pattern matches LLM output.'
    );
  }

  return chalk.dim(
    'This text lacks both polish and authentic constraint signals. It may be struggling human ' +
      'writing or degraded/edited AI output.'
  );
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';

    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    process.stdin.setEncoding('utf8');

    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });

    process.stdin.on('end', () => {
      resolve(data);
    });
  });
}
