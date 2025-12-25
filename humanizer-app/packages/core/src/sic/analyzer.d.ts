/**
 * SIC Analyzer
 *
 * Analyzes text for Subjective Intentional Constraint -
 * traces of lived constraint that distinguish human writing
 * from LLM output.
 *
 * "Burstiness detects statistics. SIC analysis detects whether
 * a mind seems to be paying the cost of being itself."
 */
import type { SICAnalysis } from '../types/index.js';
export interface AnalyzeOptions {
    /** Include detailed evidence (slower) */
    includeEvidence?: boolean;
    /** Use LLM for deeper analysis (requires provider) */
    useLLM?: boolean;
    /** LLM provider for deep analysis */
    llmProvider?: LLMProvider;
}
export interface LLMProvider {
    analyze(text: string, prompt: string): Promise<string>;
}
/**
 * Analyze text for SIC signals
 */
export declare function analyzeSIC(text: string, options?: AnalyzeOptions): SICAnalysis;
/**
 * Quick check for a single sentence
 */
export declare function quickSIC(sentence: string): number;
/**
 * Batch analyze multiple texts
 */
export declare function batchAnalyzeSIC(texts: string[], options?: AnalyzeOptions): SICAnalysis[];
//# sourceMappingURL=analyzer.d.ts.map