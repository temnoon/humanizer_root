/**
 * Analyze Command
 *
 * Core SIC analysis for text - detect traces of lived constraint
 */
interface AnalyzeOptions {
    stdin?: boolean;
    json?: boolean;
    verbose?: boolean;
    color?: boolean;
}
export declare function analyzeCommand(input: string | undefined, options: AnalyzeOptions): Promise<void>;
export {};
//# sourceMappingURL=analyze.d.ts.map