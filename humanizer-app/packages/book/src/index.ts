/**
 * @humanizer/book
 *
 * Build books from archives through:
 * Harvest → Cluster → Order → Compose → Export
 *
 * "Evoke from this lifetime of work the human
 * who has been dying to speak."
 */

// Types
export * from './types/index.js';

// Harvester
export { harvestPassages, getHarvestStats, type HarvestStats } from './harvester/index.js';

// Clusterer
export {
  clusterPassages,
  mergeClusters,
  PHENOMENOLOGY_CONCEPTS,
  type ClusterOptions,
} from './clusterer/index.js';

// Orderer
export {
  buildConceptGraph,
  orderClusters,
  orderPassages,
  explainOrder,
  CONCEPT_DEPENDENCIES,
} from './orderer/index.js';

// Composer
export { composeBook, exportBook, type ComposeOptions } from './composer/index.js';

// Builder (main orchestrator)
export { buildBook, summarizeBook, type BuildBookOptions } from './builder.js';
