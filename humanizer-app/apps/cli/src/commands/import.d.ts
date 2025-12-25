/**
 * Import Command
 *
 * Bring archives into the Humanizer system - reclaim your words
 */
interface ImportOptions {
    type: 'auto' | 'chatgpt' | 'facebook' | 'notes';
    output: string;
    dryRun?: boolean;
}
export declare function importCommand(path: string, options: ImportOptions): Promise<void>;
export {};
//# sourceMappingURL=import.d.ts.map