/**
 * Concept Orderer
 *
 * Determines optimal ordering of passages and chapters using:
 * - Concept dependency graphs
 * - Topological sorting
 * - Narrative flow optimization
 */

import type { Passage, Cluster, Chapter, ConceptNode, ConceptGraph } from '../types/index.js';

/**
 * Known concept dependencies for phenomenology domain
 * Format: [concept, ...dependencies]
 * A concept should come after its dependencies
 */
export const CONCEPT_DEPENDENCIES: Array<[string, ...string[]]> = [
  // Foundational -> Advanced
  ['consciousness', ],
  ['perception', 'consciousness'],
  ['intentionality', 'consciousness'],
  ['experience', 'consciousness', 'perception'],

  // Husserl progression
  ['phenomenology', 'consciousness'],
  ['epoché', 'phenomenology'],
  ['reduction', 'epoché'],
  ['transcendental', 'reduction'],
  ['noesis', 'intentionality'],
  ['noema', 'intentionality', 'noesis'],
  ['horizon', 'intentionality', 'perception'],
  ['constitution', 'transcendental', 'noema'],
  ['intersubjectivity', 'constitution', 'other'],
  ['lifeworld', 'intersubjectivity', 'experience'],

  // Crisis
  ['mathematization', 'science'],
  ['objectivism', 'mathematization'],
  ['naturalism', 'objectivism'],
  ['crisis', 'naturalism', 'lifeworld'],

  // Time
  ['temporality', 'consciousness'],
  ['retention', 'temporality'],
  ['protention', 'temporality'],
  ['time-consciousness', 'retention', 'protention'],

  // Body
  ['body', 'perception'],
  ['embodiment', 'body', 'experience'],
  ['corporeal', 'embodiment'],
  ['lived body', 'corporeal', 'experience'],

  // Later phenomenology
  ['being', 'existence'],
  ['dasein', 'being', 'temporality'],
  ['other', 'intersubjectivity'],

  // Your framework
  ['objective world', 'consciousness'],
  ['corporeal world', 'embodiment', 'perception'],
  ['subjective world', 'intentionality', 'experience'],
  ['field of agency', 'subjective world', 'intersubjectivity'],
  ['density matrix', 'field of agency'],
  ['measurement', 'density matrix', 'reduction'],
];

/**
 * Build a concept dependency graph from passages
 */
export function buildConceptGraph(passages: Passage[]): ConceptGraph {
  const nodes = new Map<string, ConceptNode>();

  // Extract all concepts
  const allConcepts = new Set<string>();
  for (const passage of passages) {
    for (const concept of passage.concepts || []) {
      allConcepts.add(concept.toLowerCase());
    }
  }

  // Create nodes
  for (const concept of allConcepts) {
    nodes.set(concept, {
      concept,
      passageIds: [],
      dependencies: [],
      dependents: [],
    });
  }

  // Link passages to concepts
  for (const passage of passages) {
    for (const concept of passage.concepts || []) {
      const node = nodes.get(concept.toLowerCase());
      if (node) {
        node.passageIds.push(passage.id);
      }
    }
  }

  // Add known dependencies
  for (const [concept, ...deps] of CONCEPT_DEPENDENCIES) {
    const node = nodes.get(concept);
    if (!node) continue;

    for (const dep of deps) {
      if (nodes.has(dep)) {
        node.dependencies.push(dep);
        const depNode = nodes.get(dep)!;
        depNode.dependents.push(concept);
      }
    }
  }

  // Calculate depths
  calculateDepths(nodes);

  // Topological sort
  const sortedOrder = topologicalSort(nodes);

  return { nodes, sortedOrder };
}

/**
 * Calculate depth of each node (distance from root)
 */
function calculateDepths(nodes: Map<string, ConceptNode>): void {
  // Find roots (no dependencies)
  const roots = [...nodes.values()].filter(n => n.dependencies.length === 0);

  // BFS to assign depths
  const queue: Array<{ node: ConceptNode; depth: number }> = roots.map(n => ({
    node: n,
    depth: 0,
  }));

  const visited = new Set<string>();

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;

    if (visited.has(node.concept)) {
      // Take maximum depth if revisited
      if ((node.depth || 0) < depth) {
        node.depth = depth;
      }
      continue;
    }

    visited.add(node.concept);
    node.depth = depth;

    for (const depConcept of node.dependents) {
      const depNode = nodes.get(depConcept);
      if (depNode) {
        queue.push({ node: depNode, depth: depth + 1 });
      }
    }
  }

  // Assign depth 0 to unvisited nodes
  for (const node of nodes.values()) {
    if (node.depth === undefined) {
      node.depth = 0;
    }
  }
}

/**
 * Topological sort of concepts
 */
function topologicalSort(nodes: Map<string, ConceptNode>): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(concept: string): void {
    if (visited.has(concept)) return;
    if (visiting.has(concept)) {
      // Cycle detected - skip
      return;
    }

    visiting.add(concept);

    const node = nodes.get(concept);
    if (node) {
      for (const dep of node.dependencies) {
        visit(dep);
      }
    }

    visiting.delete(concept);
    visited.add(concept);
    sorted.push(concept);
  }

  for (const concept of nodes.keys()) {
    visit(concept);
  }

  return sorted;
}

/**
 * Order passages within a cluster based on concept dependencies
 */
export function orderPassages(
  passages: Passage[],
  conceptGraph: ConceptGraph
): Passage[] {
  const { sortedOrder } = conceptGraph;
  if (!sortedOrder || sortedOrder.length === 0) {
    // Fall back to chronological
    return [...passages].sort((a, b) =>
      a.sourceMessage.timestamp.getTime() - b.sourceMessage.timestamp.getTime()
    );
  }

  // Create concept priority map
  const conceptPriority = new Map<string, number>();
  sortedOrder.forEach((concept, idx) => {
    conceptPriority.set(concept, idx);
  });

  // Score each passage by its earliest concept
  const scored = passages.map(passage => {
    const concepts = passage.concepts || [];
    let minPriority = Infinity;

    for (const concept of concepts) {
      const priority = conceptPriority.get(concept.toLowerCase());
      if (priority !== undefined && priority < minPriority) {
        minPriority = priority;
      }
    }

    return { passage, priority: minPriority };
  });

  // Sort by concept priority, then by date
  scored.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.passage.sourceMessage.timestamp.getTime() -
           b.passage.sourceMessage.timestamp.getTime();
  });

  return scored.map(s => s.passage);
}

/**
 * Order clusters into chapters
 */
export function orderClusters(
  clusters: Cluster[],
  conceptGraph: ConceptGraph
): Cluster[] {
  const { sortedOrder } = conceptGraph;
  if (!sortedOrder || sortedOrder.length === 0) {
    return clusters;
  }

  // Create concept priority map
  const conceptPriority = new Map<string, number>();
  sortedOrder.forEach((concept, idx) => {
    conceptPriority.set(concept, idx);
  });

  // Score each cluster by its primary concept
  const scored = clusters.map(cluster => {
    let minPriority = Infinity;

    for (const concept of cluster.keyConcepts) {
      const priority = conceptPriority.get(concept.toLowerCase());
      if (priority !== undefined && priority < minPriority) {
        minPriority = priority;
      }
    }

    return { cluster, priority: minPriority };
  });

  // Sort by concept priority
  scored.sort((a, b) => a.priority - b.priority);

  return scored.map(s => s.cluster);
}

/**
 * Generate suggested reading order explanation
 */
export function explainOrder(conceptGraph: ConceptGraph): string {
  const { sortedOrder, nodes } = conceptGraph;
  if (!sortedOrder || sortedOrder.length === 0) {
    return 'No concept dependencies found.';
  }

  const lines: string[] = ['Concept progression:'];

  let currentDepth = -1;
  for (const concept of sortedOrder) {
    const node = nodes.get(concept);
    if (!node) continue;

    const depth = node.depth || 0;
    if (depth !== currentDepth) {
      currentDepth = depth;
      lines.push(`\nLevel ${depth}:`);
    }

    const deps = node.dependencies.length > 0
      ? ` (requires: ${node.dependencies.join(', ')})`
      : ' (foundational)';

    lines.push(`  • ${concept}${deps}`);
  }

  return lines.join('\n');
}
