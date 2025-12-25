/**
 * Theme Clusterer
 *
 * Groups passages by thematic similarity.
 * Uses concept extraction and keyword overlap for clustering.
 */

import type { Passage, Cluster } from '../types/index.js';

/**
 * Cluster passages by theme
 */
export function clusterPassages(
  passages: Passage[],
  options: ClusterOptions = {}
): Cluster[] {
  const {
    maxClusters = 10,
    minClusterSize = 3,
    conceptKeywords,
  } = options;

  // First, extract concepts from each passage
  for (const passage of passages) {
    passage.concepts = extractConcepts(passage.text, conceptKeywords);
  }

  // Build concept frequency map
  const conceptFreq = new Map<string, number>();
  for (const passage of passages) {
    for (const concept of passage.concepts || []) {
      conceptFreq.set(concept, (conceptFreq.get(concept) || 0) + 1);
    }
  }

  // Sort concepts by frequency
  const sortedConcepts = [...conceptFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxClusters * 2)
    .map(([concept]) => concept);

  // Create clusters based on dominant concepts
  const clusters: Cluster[] = [];
  const assignedPassages = new Set<string>();

  for (const concept of sortedConcepts) {
    if (clusters.length >= maxClusters) break;

    // Find passages with this concept that aren't assigned yet
    const matching = passages.filter(p =>
      !assignedPassages.has(p.id) &&
      (p.concepts || []).includes(concept)
    );

    if (matching.length >= minClusterSize) {
      const cluster: Cluster = {
        id: `cluster-${clusters.length + 1}`,
        label: formatConceptLabel(concept),
        passages: matching,
        keyConcepts: [concept],
      };

      // Find additional shared concepts
      const sharedConcepts = findSharedConcepts(matching, concept);
      cluster.keyConcepts = [concept, ...sharedConcepts.slice(0, 4)];
      cluster.description = generateClusterDescription(cluster);

      clusters.push(cluster);

      for (const p of matching) {
        assignedPassages.add(p.id);
      }
    }
  }

  // Create a catch-all cluster for unassigned passages
  const unassigned = passages.filter(p => !assignedPassages.has(p.id));
  if (unassigned.length > 0) {
    clusters.push({
      id: `cluster-misc`,
      label: 'Other Themes',
      passages: unassigned,
      keyConcepts: ['miscellaneous'],
      description: 'Passages that span multiple themes or introduce unique ideas.',
    });
  }

  // Sort clusters by size
  clusters.sort((a, b) => b.passages.length - a.passages.length);

  return clusters;
}

export interface ClusterOptions {
  /** Maximum number of clusters to create */
  maxClusters?: number;

  /** Minimum passages for a cluster to be created */
  minClusterSize?: number;

  /** Domain-specific concept keywords to look for */
  conceptKeywords?: string[];
}

/**
 * Default phenomenology-related concept keywords
 */
export const PHENOMENOLOGY_CONCEPTS = [
  // Husserl core
  'lifeworld', 'lebenswelt', 'intentionality', 'epoché', 'epoche',
  'noesis', 'noema', 'horizon', 'reduction', 'constitution',
  'transcendental', 'phenomenological', 'intersubjectivity',

  // Crisis
  'crisis', 'european sciences', 'mathematization', 'galileo',
  'objectivism', 'naturalism', 'science',

  // Consciousness
  'consciousness', 'perception', 'experience', 'awareness',
  'subject', 'subjectivity', 'subjective',

  // Time
  'temporality', 'time-consciousness', 'retention', 'protention',
  'now', 'present', 'past', 'future',

  // Body
  'embodiment', 'body', 'corporeal', 'flesh', 'lived body',

  // Later phenomenology
  'merleau-ponty', 'heidegger', 'derrida', 'levinas',
  'being', 'dasein', 'existence', 'other',

  // Your framework
  'objective world', 'corporeal world', 'subjective world',
  'field of agency', 'density matrix', 'measurement',
];

/**
 * Extract concepts from passage text
 */
function extractConcepts(text: string, keywords?: string[]): string[] {
  const concepts: string[] = [];
  const textLower = text.toLowerCase();
  const searchTerms = keywords || PHENOMENOLOGY_CONCEPTS;

  for (const term of searchTerms) {
    if (textLower.includes(term.toLowerCase())) {
      concepts.push(term);
    }
  }

  return concepts;
}

/**
 * Find concepts shared by multiple passages
 */
function findSharedConcepts(passages: Passage[], excludeConcept: string): string[] {
  const conceptCounts = new Map<string, number>();

  for (const passage of passages) {
    for (const concept of passage.concepts || []) {
      if (concept !== excludeConcept) {
        conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
      }
    }
  }

  return [...conceptCounts.entries()]
    .filter(([_, count]) => count >= passages.length * 0.3)
    .sort((a, b) => b[1] - a[1])
    .map(([concept]) => concept);
}

/**
 * Format a concept as a readable label
 */
function formatConceptLabel(concept: string): string {
  // Capitalize first letter of each word
  return concept
    .split(/[\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate a description for a cluster
 */
function generateClusterDescription(cluster: Cluster): string {
  const { keyConcepts, passages } = cluster;

  const conceptList = keyConcepts.slice(0, 3).join(', ');
  const passageCount = passages.length;
  const avgSIC = passages.reduce((sum, p) => sum + (p.sic?.score || 0), 0) / passageCount;

  return `${passageCount} passages exploring ${conceptList}. Average SIC: ${avgSIC.toFixed(0)}/100.`;
}

/**
 * Merge similar clusters
 */
export function mergeClusters(clusters: Cluster[], similarity: number = 0.5): Cluster[] {
  const merged: Cluster[] = [];
  const used = new Set<string>();

  for (let i = 0; i < clusters.length; i++) {
    if (used.has(clusters[i].id)) continue;

    const current = { ...clusters[i], passages: [...clusters[i].passages] };

    for (let j = i + 1; j < clusters.length; j++) {
      if (used.has(clusters[j].id)) continue;

      const overlap = calculateConceptOverlap(
        current.keyConcepts,
        clusters[j].keyConcepts
      );

      if (overlap >= similarity) {
        // Merge clusters
        current.passages.push(...clusters[j].passages);
        current.keyConcepts = [...new Set([
          ...current.keyConcepts,
          ...clusters[j].keyConcepts,
        ])];
        used.add(clusters[j].id);
      }
    }

    merged.push(current);
    used.add(current.id);
  }

  return merged;
}

function calculateConceptOverlap(concepts1: string[], concepts2: string[]): number {
  const set1 = new Set(concepts1);
  const set2 = new Set(concepts2);
  const intersection = [...set1].filter(c => set2.has(c)).length;
  const union = new Set([...set1, ...set2]).size;
  return intersection / union;
}
