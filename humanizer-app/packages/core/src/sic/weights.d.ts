/**
 * SIC Signal Weights
 *
 * These weights determine how each signal contributes to the final score.
 * Based on the phenomenological framework: traces of lived constraint.
 */
export declare const POSITIVE_WEIGHTS: {
    /** P1: Irreversibility / Commitment */
    readonly irreversibility: 0.22;
    /** P2: Temporal Pressure & Sequencing */
    readonly temporalPressure: 0.14;
    /** P3: Epistemic Incompleteness - Lived, Not Hedged */
    readonly epistemicIncompleteness: 0.16;
    /** P4: Value Tradeoffs & Sacrifice */
    readonly valueTradeoffs: 0.18;
    /** P5: Scar Tissue / Residue */
    readonly scarTissue: 0.18;
    /** P6: Situated Embodiment & Stakes */
    readonly embodiment: 0.12;
};
export declare const NEGATIVE_WEIGHTS: {
    /** N1: Resolution Without Cost */
    readonly resolutionWithoutCost: 0.3;
    /** N2: Manager Voice / Expository Smoothing */
    readonly managerVoice: 0.25;
    /** N3: Symmetry & Coverage Obsession */
    readonly symmetryCoverage: 0.25;
    /** N4: Generic Human Facsimile */
    readonly genericFacsimile: 0.2;
};
//# sourceMappingURL=weights.d.ts.map