/**
 * Core Type Definitions for Humanizer
 *
 * These types embody the philosophical framework:
 * - Sentence as quantum of semantic exchange
 * - Density matrix as subjective state
 * - POVM as measurement operator
 * - SIC as trace of lived constraint
 */
/**
 * A sentence is the unit of quantum semantic exchange.
 * Each sentence collapses potential into actuality.
 */
export interface Sentence {
    /** The raw text of the sentence */
    text: string;
    /** Position in the source (0-indexed) */
    index: number;
    /** Character offset in original text */
    offset: number;
    /** Length in characters */
    length: number;
    /** Optional: embedding vector if computed */
    embedding?: number[];
    /** SIC analysis results if computed */
    sic?: SICAnalysis;
    /** Source metadata */
    source?: SentenceSource;
}
export interface SentenceSource {
    /** Type of archive this came from */
    archiveType: ArchiveType;
    /** Identifier within the archive */
    id: string;
    /** Timestamp if known */
    timestamp?: Date;
    /** Author/speaker if known */
    author?: string;
}
export type ArchiveType = 'chatgpt' | 'facebook' | 'notes' | 'import' | 'composed' | 'unknown';
/**
 * Subjective Intentional Constraint Analysis
 *
 * Measures traces of lived constraint in text:
 * - Time pressure, uncertainty, irreversible commitment
 * - Asymmetric consequences, competing values
 *
 * Text shaped BY these conditions (not just describing them)
 * carries the imprint of a mind paying the cost of being itself.
 */
export interface SICAnalysis {
    /** Overall SIC score (0-100) */
    score: number;
    /** Confidence in the analysis (0-1) */
    confidence: number;
    /** Positive signals - traces of constraint */
    positive: SICPositiveSignals;
    /** Negative signals - constraint erasers */
    negative: SICNegativeSignals;
    /** Detailed evidence for each signal */
    evidence: SICEvidence[];
    /** Diagnostic category */
    category: SICCategory;
}
/**
 * Positive SIC signals - evidence of lived constraint
 */
export interface SICPositiveSignals {
    /** P1: Irreversibility / Commitment (weight: 0.22) */
    irreversibility: SignalScore;
    /** P2: Temporal Pressure & Sequencing (weight: 0.14) */
    temporalPressure: SignalScore;
    /** P3: Epistemic Incompleteness - Lived, Not Hedged (weight: 0.16) */
    epistemicIncompleteness: SignalScore;
    /** P4: Value Tradeoffs & Sacrifice (weight: 0.18) */
    valueTradeoffs: SignalScore;
    /** P5: Scar Tissue / Residue (weight: 0.18) */
    scarTissue: SignalScore;
    /** P6: Situated Embodiment & Stakes (weight: 0.12) */
    embodiment: SignalScore;
}
/**
 * Negative SIC signals - constraint erasers
 */
export interface SICNegativeSignals {
    /** N1: Resolution Without Cost (weight: 0.30) */
    resolutionWithoutCost: SignalScore;
    /** N2: Manager Voice / Expository Smoothing (weight: 0.25) */
    managerVoice: SignalScore;
    /** N3: Symmetry & Coverage Obsession (weight: 0.25) */
    symmetryCoverage: SignalScore;
    /** N4: Generic Human Facsimile (weight: 0.20) */
    genericFacsimile: SignalScore;
}
export interface SignalScore {
    /** Raw score 0-4 */
    raw: number;
    /** Weighted contribution to final score */
    weighted: number;
    /** Number of evidence instances found */
    count: number;
}
export interface SICEvidence {
    /** Which signal this evidence supports */
    signal: keyof SICPositiveSignals | keyof SICNegativeSignals;
    /** Whether this is positive or negative */
    polarity: 'positive' | 'negative';
    /** The quoted text */
    quote: string;
    /** Character offset in source */
    offset: number;
    /** Explanation of why this is evidence */
    rationale: string;
    /** Strength of evidence (0-4) */
    strength: number;
}
/**
 * Diagnostic categories based on SIC + Neatness
 */
export type SICCategory = 'polished-human' | 'raw-human' | 'neat-slop' | 'messy-low-craft';
/**
 * The density matrix represents the agent's current distribution
 * of interpretive possibilities - the "resting potential" of the mind,
 * weighted by every word ever processed.
 */
export interface DensityMatrix {
    /** Dimensionality of the semantic space */
    dimension: number;
    /** The matrix values (flattened for storage) */
    values: number[];
    /** Eigenvalues (principal modes of meaning) */
    eigenvalues?: number[];
    /** Last update timestamp */
    updatedAt: Date;
    /** Source of this state (accumulated from what) */
    sources: DensitySource[];
}
export interface DensitySource {
    archiveType: ArchiveType;
    count: number;
    weight: number;
}
/**
 * A POVM (Positive Operator-Valued Measure) represents a way of
 * "measuring" or analyzing text. Each tool in Humanizer is a POVM.
 */
export interface POVM {
    /** Unique identifier */
    id: string;
    /** Human-readable name */
    name: string;
    /** What aspect of meaning this measures */
    description: string;
    /** The operator elements (what dimensions it projects onto) */
    operators: POVMOperator[];
    /** Whether this is a built-in or user-defined POVM */
    builtin: boolean;
}
export interface POVMOperator {
    /** Label for this outcome */
    label: string;
    /** The measurement vector */
    vector: number[];
    /** Weight/probability of this outcome */
    weight: number;
}
/**
 * A chunk is a group of sentences processed together.
 * Typically 8-15 sentences (~200-400 words).
 */
export interface Chunk {
    /** Unique identifier */
    id: string;
    /** The sentences in this chunk */
    sentences: Sentence[];
    /** Combined text */
    text: string;
    /** Character count */
    charCount: number;
    /** Word count */
    wordCount: number;
    /** Sentence count */
    sentenceCount: number;
    /** Aggregated SIC analysis */
    sic?: SICAnalysis;
    /** Embedding for the whole chunk */
    embedding?: number[];
}
/**
 * An archive is the user's ρ - their accumulated density matrix
 * materialized as text. This is what they are curating.
 */
export interface Archive {
    /** Unique identifier */
    id: string;
    /** User-defined name */
    name: string;
    /** When created */
    createdAt: Date;
    /** Last modified */
    updatedAt: Date;
    /** Sources imported into this archive */
    sources: ArchiveSourceInfo[];
    /** Total statistics */
    stats: ArchiveStats;
}
export interface ArchiveSourceInfo {
    type: ArchiveType;
    name: string;
    importedAt: Date;
    itemCount: number;
}
export interface ArchiveStats {
    totalConversations: number;
    totalMessages: number;
    totalSentences: number;
    totalWords: number;
    dateRange: {
        earliest?: Date;
        latest?: Date;
    };
}
/**
 * The curator is the agent (you + AI assistance) that operates
 * on the archive to extract meaning and compose new understanding.
 */
export interface CuratorSession {
    /** Session identifier */
    id: string;
    /** Which archive is being curated */
    archiveId: string;
    /** Current focus/query */
    focus?: string;
    /** Active filters */
    filters: CuratorFilters;
    /** Items currently in view */
    selection: string[];
    /** Session history for continuity */
    history: CuratorAction[];
}
export interface CuratorFilters {
    dateRange?: {
        start: Date;
        end: Date;
    };
    sources?: ArchiveType[];
    sicRange?: {
        min: number;
        max: number;
    };
    searchQuery?: string;
}
export interface CuratorAction {
    type: 'search' | 'filter' | 'select' | 'analyze' | 'transform' | 'compose';
    timestamp: Date;
    params: Record<string, unknown>;
    result?: unknown;
}
/**
 * A composition is what the curator creates - a new synthesis
 * from the raw material of the archive.
 */
export interface Composition {
    /** Unique identifier */
    id: string;
    /** Title */
    title: string;
    /** The composed text */
    content: string;
    /** Source sentences that contributed */
    sources: CompositionSource[];
    /** When created */
    createdAt: Date;
    /** Analysis of the composition itself */
    sic?: SICAnalysis;
}
export interface CompositionSource {
    sentenceId: string;
    contribution: 'quote' | 'inspiration' | 'context';
    weight: number;
}
//# sourceMappingURL=index.d.ts.map