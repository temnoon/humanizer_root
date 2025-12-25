/**
 * Book Builder - Orchestrates Harvest → Cluster → Order → Compose
 */

import type { BookProject, BookStatus, HarvestOptions } from './types/index.js';
import { harvestPassages, getHarvestStats } from './harvester/index.js';
import { clusterPassages, PHENOMENOLOGY_CONCEPTS } from './clusterer/index.js';
import { buildConceptGraph, orderClusters, orderPassages } from './orderer/index.js';
import { composeBook } from './composer/index.js';

export async function buildBook(options: BuildBookOptions): Promise<BookProject> {
  const { archivePath, title, subtitle, author, theme, queries, onProgress } = options;

  const project: BookProject = {
    id: `book-${Date.now()}`,
    title, subtitle, author, theme, queries, archivePath,
    passages: [], clusters: [], chapters: [],
    metadata: { currentWordCount: 0, passageCount: 0 },
    status: 'harvesting',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Harvest
  onProgress?.('harvesting', 'Gathering passages...');
  const passages = await harvestPassages(archivePath, { queries, ...options.harvestOptions });
  project.passages = passages;
  const stats = getHarvestStats(passages);
  project.metadata = { ...project.metadata, passageCount: stats.count, currentWordCount: stats.totalWords, averageSIC: stats.averageSIC, dateRange: stats.dateRange };

  // Cluster
  onProgress?.('clustering', 'Grouping by theme...');
  const clusters = clusterPassages(passages, { conceptKeywords: PHENOMENOLOGY_CONCEPTS });

  // Order
  onProgress?.('ordering', 'Ordering by concept...');
  const graph = buildConceptGraph(passages);
  const ordered = orderClusters(clusters, graph);
  for (const c of ordered) c.passages = orderPassages(c.passages, graph);
  project.clusters = ordered;

  // Compose
  onProgress?.('composing', 'Building chapters...');
  project.chapters = composeBook(ordered);
  project.status = 'complete';

  return project;
}

export function summarizeBook(p: BookProject): string {
  return `📚 ${p.title}\n${p.metadata.passageCount} passages, ${p.metadata.currentWordCount} words, ${p.chapters.length} chapters`;
}

export interface BuildBookOptions {
  archivePath: string; title: string; subtitle?: string; author: string;
  theme: string; queries: string[];
  harvestOptions?: Partial<HarvestOptions>;
  onProgress?: (stage: BookStatus, message: string) => void;
}
