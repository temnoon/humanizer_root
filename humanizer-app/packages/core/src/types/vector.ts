/**
 * Vector Types for Sentence-Level Analysis
 *
 * Each sentence occupies a position in semantic space.
 * The trajectory through these positions reveals the
 * movement of mind through meaning.
 */

/**
 * Position in 5-dimensional semantic space
 * Each dimension is -1 to +1
 */
export interface SemanticPosition {
  /** certainty (-1) ↔ uncertainty (+1) - epistemic stance */
  epistemic: number;

  /** detached (-1) ↔ committed (+1) - skin in the game */
  commitment: number;

  /** abstract/timeless (-1) ↔ situated-in-time (+1) */
  temporal: number;

  /** disembodied (-1) ↔ corporeal/sensory (+1) */
  embodiment: number;

  /** hypothetical (-1) ↔ consequential (+1) - real stakes */
  stakes: number;
}

/**
 * A sentence with its position vector
 */
export interface SentenceVector {
  /** The sentence text */
  text: string;

  /** Index in the passage */
  index: number;

  /** Position in semantic space */
  position: SemanticPosition;

  /** Magnitude of position (distance from origin) */
  magnitude: number;

  /** Dominant dimension name */
  dominantDimension: keyof SemanticPosition;
}

/**
 * An inflection point where the text pivots
 */
export interface Inflection {
  /** Sentence index where inflection occurs */
  sentenceIndex: number;

  /** The sentence text */
  text: string;

  /** Region the text was in */
  from: string;

  /** Region the text moves to */
  to: string;

  /** Magnitude of the shift (Euclidean distance) */
  magnitude: number;

  /** The dimensions that shifted most */
  primaryShift: keyof SemanticPosition;
}

/**
 * Craft metrics - how well the writing does what it does
 */
export interface CraftMetrics {
  /** Words per idea - lower is more compressed */
  compression: {
    score: number;        // 0-1, higher = more compressed
    wordsPerSentence: number;
    fillerRatio: number;  // proportion of filler phrases
    contentWordRatio: number;
  };

  /** Statistical unexpectedness */
  surprise: {
    score: number;        // 0-1, higher = more surprising
    unusualTransitions: number;
    patternBreaks: number;
    unexpectedCollocations: number;
  };

  /** Concreteness and grounding */
  specificity: {
    score: number;        // 0-1, higher = more specific
    namedEntities: number;
    concreteNouns: number;
    numericalPrecision: number;
    sensoryDetails: number;
  };

  /** Unresolved narrative energy */
  tension: {
    score: number;        // 0-1, higher = more tension
    openQuestions: number;
    unresolvedContrasts: number;
    anticipationMarkers: number;
  };

  /** Semantic ground covered */
  velocity: {
    score: number;        // 0-1, higher = more movement
    averageDistance: number;
    totalDistance: number;
    stationaryRatio: number;
  };
}

/**
 * Complete passage analysis - the density matrix
 */
export interface PassageRho {
  /** Original text */
  text: string;

  /** Sentence-by-sentence vectors */
  sentences: SentenceVector[];

  /** Points where the text pivots */
  inflections: Inflection[];

  /** Trajectory through semantic space */
  trajectory: SemanticPosition[];

  /** Craft metrics */
  craft: CraftMetrics;

  /** Summary statistics */
  summary: {
    /** Average position (centroid) */
    centroid: SemanticPosition;

    /** Spread in each dimension */
    variance: SemanticPosition;

    /** How much territory is covered */
    coverage: number;

    /** Total semantic distance traveled */
    journeyLength: number;

    /** Number of significant inflections */
    inflectionCount: number;

    /** Dominant region of the passage */
    dominantRegion: string;
  };
}

/**
 * Named regions in semantic space
 */
export const SEMANTIC_REGIONS = {
  // High commitment, high stakes
  'committed-consequential': { commitment: [0.5, 1], stakes: [0.5, 1] },

  // High uncertainty, exploring
  'epistemic-exploration': { epistemic: [0.5, 1], commitment: [-1, 0] },

  // Grounded in body and time
  'embodied-present': { embodiment: [0.5, 1], temporal: [0.5, 1] },

  // Abstract, detached theorizing
  'abstract-theoretical': { embodiment: [-1, -0.3], temporal: [-1, -0.3] },

  // High stakes, uncertain
  'precarious': { stakes: [0.5, 1], epistemic: [0.3, 1] },

  // Low everything - neutral expository
  'neutral-expository': {
    epistemic: [-0.3, 0.3],
    commitment: [-0.3, 0.3],
    temporal: [-0.3, 0.3],
    embodiment: [-0.3, 0.3],
    stakes: [-0.3, 0.3],
  },
} as const;

export type SemanticRegion = keyof typeof SEMANTIC_REGIONS;
