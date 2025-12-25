/**
 * Sentence Analysis Types
 */

export interface TetralemmaProbs {
  affirmation: number;
  negation: number;
  both: number;
  neither: number;
}

export type TetralemmaStance = 'affirmation' | 'negation' | 'both' | 'neither';

export interface SemanticPosition {
  epistemic: number;    // -1 (uncertain) to +1 (certain)
  commitment: number;   // -1 (detached) to +1 (committed)
  temporal: number;     // -1 (past) to +1 (future)
  embodiment: number;   // -1 (abstract) to +1 (concrete)
  stakes: number;       // -1 (trivial) to +1 (consequential)
}

export interface SentenceMetrics {
  text: string;
  index: number;

  // Tetralemma analysis
  tetralemma: TetralemmaProbs;
  dominantStance: TetralemmaStance;
  entropy: number;

  // SIC score (0-100)
  sicScore: number;
  sicLevel: 'low' | 'medium' | 'high';

  // 5D semantic position (optional, requires deeper analysis)
  position?: SemanticPosition;

  // Craft metrics (optional)
  craft?: {
    compression: number;
    surprise: number;
    specificity: number;
    tension: number;
    velocity: number;
  };
}

export interface SentenceAnalysisConfig {
  /** Display mode for metrics */
  displayMode: 'tooltip' | 'sidebar' | 'modal' | 'inline';

  /** Which metrics to show */
  showMetrics: {
    tetralemma: boolean;
    sic: boolean;
    position: boolean;
    craft: boolean;
  };

  /** Enable inline editing */
  editable: boolean;

  /** Show metrics on hover */
  showOnHover: boolean;

  /** Show metrics on click */
  showOnClick: boolean;
}

export const DEFAULT_CONFIG: SentenceAnalysisConfig = {
  displayMode: 'tooltip',
  showMetrics: {
    tetralemma: true,
    sic: true,
    position: false,
    craft: false,
  },
  editable: false,
  showOnHover: true,
  showOnClick: true,
};
