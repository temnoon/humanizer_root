/**
 * SIC Detection Lexicons
 *
 * Pattern libraries for detecting SIC signals without LLM.
 * These are heuristic indicators, not definitive classifiers.
 */
/**
 * P1: Irreversibility / Commitment markers
 * "I decided / I did / I will / I can't undo / it cost"
 */
export declare const IRREVERSIBILITY_PATTERNS: RegExp[];
/**
 * P2: Temporal Pressure & Sequencing markers
 * Urgency, deadlines, "before I could," "in the moment"
 */
export declare const TEMPORAL_PRESSURE_PATTERNS: RegExp[];
/**
 * P3: Epistemic Incompleteness - Lived, Not Hedged
 * Being wrong, surprises, misreadings
 */
export declare const EPISTEMIC_INCOMPLETENESS_PATTERNS: RegExp[];
/**
 * P4: Value Tradeoffs & Sacrifice
 * Explicit "X over Y" with acknowledged loss
 */
export declare const VALUE_TRADEOFF_PATTERNS: RegExp[];
/**
 * P5: Scar Tissue / Residue
 * Defensiveness, embarrassment, lingering regret
 */
export declare const SCAR_TISSUE_PATTERNS: RegExp[];
/**
 * P6: Situated Embodiment & Stakes
 * Body, place, social risk, consequences, friction
 */
export declare const EMBODIMENT_PATTERNS: RegExp[];
/**
 * N1: Resolution Without Cost
 * Conflict introduced → instantly harmonized
 */
export declare const RESOLUTION_WITHOUT_COST_PATTERNS: RegExp[];
/**
 * N2: Manager Voice / Expository Smoothing
 * "In conclusion / it is important / this suggests"
 */
export declare const MANAGER_VOICE_PATTERNS: RegExp[];
/**
 * N3: Symmetry & Coverage Obsession
 * Enumerating all sides, all caveats
 */
export declare const SYMMETRY_COVERAGE_PATTERNS: RegExp[];
/**
 * N4: Generic Human Facsimile
 * Stock empathy lines; motivational filler
 */
export declare const GENERIC_FACSIMILE_PATTERNS: RegExp[];
//# sourceMappingURL=lexicons.d.ts.map