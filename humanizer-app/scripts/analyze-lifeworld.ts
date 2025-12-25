/**
 * Analyze Lifeworld Corpus with Vector Model
 *
 * Runs the new trajectory analyzer on all passages from the lifeworld book
 * and generates insights about semantic positions and inflection points.
 */

import { readFileSync, writeFileSync } from 'fs';
import { analyzePassage, formatTrajectory } from '../packages/core/dist/vector/trajectory.js';
import type { PassageRho, SemanticPosition } from '../packages/core/dist/types/vector.js';

interface Passage {
  id: string;
  text: string;
  sourceConversation: { id: string; title: string };
  sourceMessage: { id: string; timestamp: string; author: string };
  wordCount: number;
  concepts?: string[];
}

interface BookProject {
  title: string;
  passages: Passage[];
}

interface AnalyzedPassage {
  id: string;
  title: string;
  wordCount: number;
  concepts: string[];
  rho: PassageRho;
}

// Load the lifeworld book project
const projectPath = '~/humanizer_root/humanizer-app/lifeworld-book/project.json';
const project: BookProject = JSON.parse(readFileSync(projectPath, 'utf-8'));

console.log(`\n📚 Analyzing: ${project.title}`);
console.log(`   ${project.passages.length} passages\n`);

const analyzed: AnalyzedPassage[] = [];

// Analyze each passage
for (const passage of project.passages) {
  const rho = analyzePassage(passage.text);
  analyzed.push({
    id: passage.id,
    title: passage.sourceConversation.title,
    wordCount: passage.wordCount,
    concepts: passage.concepts || [],
    rho,
  });
}

// Sort by various metrics
console.log('═'.repeat(60));
console.log('TOP PASSAGES BY SEMANTIC COVERAGE (territory traversed)');
console.log('═'.repeat(60));

const byCoverage = [...analyzed].sort((a, b) =>
  b.rho.summary.coverage - a.rho.summary.coverage
);

for (const p of byCoverage.slice(0, 5)) {
  console.log(`\n[${(p.rho.summary.coverage * 100).toFixed(0)}% coverage] ${p.title.slice(0, 50)}`);
  console.log(`   Region: ${p.rho.summary.dominantRegion}`);
  console.log(`   Inflections: ${p.rho.summary.inflectionCount}`);
  console.log(`   Journey: ${p.rho.summary.journeyLength.toFixed(2)}`);
}

console.log('\n' + '═'.repeat(60));
console.log('TOP PASSAGES BY INFLECTION COUNT (narrative pivots)');
console.log('═'.repeat(60));

const byInflections = [...analyzed].sort((a, b) =>
  b.rho.summary.inflectionCount - a.rho.summary.inflectionCount
);

for (const p of byInflections.slice(0, 5)) {
  console.log(`\n[${p.rho.summary.inflectionCount} inflections] ${p.title.slice(0, 50)}`);
  if (p.rho.inflections.length > 0) {
    for (const inf of p.rho.inflections.slice(0, 3)) {
      console.log(`   ${inf.from} → ${inf.to} (${inf.primaryShift})`);
      console.log(`   "${inf.text.slice(0, 60)}..."`);
    }
  }
}

console.log('\n' + '═'.repeat(60));
console.log('TOP PASSAGES BY COMMITMENT (skin in the game)');
console.log('═'.repeat(60));

const byCommitment = [...analyzed].sort((a, b) =>
  b.rho.summary.centroid.commitment - a.rho.summary.centroid.commitment
);

for (const p of byCommitment.slice(0, 5)) {
  const c = p.rho.summary.centroid;
  console.log(`\n[C:${c.commitment.toFixed(2)}] ${p.title.slice(0, 50)}`);
  console.log(`   Preview: "${p.rho.text.slice(0, 100).replace(/\n/g, ' ')}..."`);
}

console.log('\n' + '═'.repeat(60));
console.log('TOP PASSAGES BY EMBODIMENT (sensory grounding)');
console.log('═'.repeat(60));

const byEmbodiment = [...analyzed].sort((a, b) =>
  b.rho.summary.centroid.embodiment - a.rho.summary.centroid.embodiment
);

for (const p of byEmbodiment.slice(0, 5)) {
  const c = p.rho.summary.centroid;
  console.log(`\n[B:${c.embodiment.toFixed(2)}] ${p.title.slice(0, 50)}`);
  console.log(`   Preview: "${p.rho.text.slice(0, 100).replace(/\n/g, ' ')}..."`);
}

console.log('\n' + '═'.repeat(60));
console.log('TOP PASSAGES BY TENSION (unresolved energy)');
console.log('═'.repeat(60));

const byTension = [...analyzed].sort((a, b) =>
  b.rho.craft.tension.score - a.rho.craft.tension.score
);

for (const p of byTension.slice(0, 5)) {
  console.log(`\n[Tension: ${(p.rho.craft.tension.score * 100).toFixed(0)}%] ${p.title.slice(0, 50)}`);
  console.log(`   Questions: ${p.rho.craft.tension.openQuestions}, Contrasts: ${p.rho.craft.tension.unresolvedContrasts}`);
}

console.log('\n' + '═'.repeat(60));
console.log('TOP PASSAGES BY SURPRISE (pattern-breaking)');
console.log('═'.repeat(60));

const bySurprise = [...analyzed].sort((a, b) =>
  b.rho.craft.surprise.score - a.rho.craft.surprise.score
);

for (const p of bySurprise.slice(0, 5)) {
  console.log(`\n[Surprise: ${(p.rho.craft.surprise.score * 100).toFixed(0)}%] ${p.title.slice(0, 50)}`);
  console.log(`   Unusual transitions: ${p.rho.craft.surprise.unusualTransitions}`);
}

// Aggregate statistics
console.log('\n' + '═'.repeat(60));
console.log('CORPUS-WIDE STATISTICS');
console.log('═'.repeat(60));

const avgCentroid: SemanticPosition = {
  epistemic: 0, commitment: 0, temporal: 0, embodiment: 0, stakes: 0
};

let totalInflections = 0;
let totalCoverage = 0;
const regionCounts: Record<string, number> = {};

for (const p of analyzed) {
  avgCentroid.epistemic += p.rho.summary.centroid.epistemic;
  avgCentroid.commitment += p.rho.summary.centroid.commitment;
  avgCentroid.temporal += p.rho.summary.centroid.temporal;
  avgCentroid.embodiment += p.rho.summary.centroid.embodiment;
  avgCentroid.stakes += p.rho.summary.centroid.stakes;
  totalInflections += p.rho.summary.inflectionCount;
  totalCoverage += p.rho.summary.coverage;

  const region = p.rho.summary.dominantRegion;
  regionCounts[region] = (regionCounts[region] || 0) + 1;
}

const n = analyzed.length;
avgCentroid.epistemic /= n;
avgCentroid.commitment /= n;
avgCentroid.temporal /= n;
avgCentroid.embodiment /= n;
avgCentroid.stakes /= n;

console.log('\nCorpus Centroid (average position):');
console.log(`  Epistemic:  ${avgCentroid.epistemic >= 0 ? '+' : ''}${avgCentroid.epistemic.toFixed(3)}`);
console.log(`  Commitment: ${avgCentroid.commitment >= 0 ? '+' : ''}${avgCentroid.commitment.toFixed(3)}`);
console.log(`  Temporal:   ${avgCentroid.temporal >= 0 ? '+' : ''}${avgCentroid.temporal.toFixed(3)}`);
console.log(`  Embodiment: ${avgCentroid.embodiment >= 0 ? '+' : ''}${avgCentroid.embodiment.toFixed(3)}`);
console.log(`  Stakes:     ${avgCentroid.stakes >= 0 ? '+' : ''}${avgCentroid.stakes.toFixed(3)}`);

console.log(`\nTotal Inflections: ${totalInflections}`);
console.log(`Average Coverage: ${(totalCoverage / n * 100).toFixed(1)}%`);

console.log('\nDominant Regions:');
const sortedRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);
for (const [region, count] of sortedRegions) {
  const pct = (count / n * 100).toFixed(0);
  console.log(`  ${region}: ${count} (${pct}%)`);
}

// Craft metrics averages
const avgCraft = {
  compression: analyzed.reduce((s, p) => s + p.rho.craft.compression.score, 0) / n,
  surprise: analyzed.reduce((s, p) => s + p.rho.craft.surprise.score, 0) / n,
  specificity: analyzed.reduce((s, p) => s + p.rho.craft.specificity.score, 0) / n,
  tension: analyzed.reduce((s, p) => s + p.rho.craft.tension.score, 0) / n,
  velocity: analyzed.reduce((s, p) => s + p.rho.craft.velocity.score, 0) / n,
};

console.log('\nAverage Craft Metrics:');
console.log(`  Compression:  ${(avgCraft.compression * 100).toFixed(0)}%`);
console.log(`  Surprise:     ${(avgCraft.surprise * 100).toFixed(0)}%`);
console.log(`  Specificity:  ${(avgCraft.specificity * 100).toFixed(0)}%`);
console.log(`  Tension:      ${(avgCraft.tension * 100).toFixed(0)}%`);
console.log(`  Velocity:     ${(avgCraft.velocity * 100).toFixed(0)}%`);

// Save full analysis
const outputPath = '~/humanizer_root/humanizer-app/lifeworld-book/vector-analysis.json';
writeFileSync(outputPath, JSON.stringify({
  title: project.title,
  passageCount: analyzed.length,
  corpusCentroid: avgCentroid,
  totalInflections,
  averageCoverage: totalCoverage / n,
  regionDistribution: regionCounts,
  averageCraft: avgCraft,
  passages: analyzed.map(p => ({
    id: p.id,
    title: p.title,
    concepts: p.concepts,
    summary: p.rho.summary,
    craft: p.rho.craft,
    inflections: p.rho.inflections,
  })),
}, null, 2));

console.log(`\n✅ Full analysis saved to: ${outputPath}\n`);
