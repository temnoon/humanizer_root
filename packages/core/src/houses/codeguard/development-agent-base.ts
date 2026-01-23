/**
 * Development Agent Base Class
 *
 * Abstract base class for development house agents.
 * Extends AgentBase with development-specific functionality including:
 * - Code analysis helpers
 * - Review hook interfaces
 * - Report generation
 * - File pattern matching
 */

import { AgentBase } from '../../runtime/agent-base.js';
import type { AgentMessage } from '../../runtime/types.js';
import { getConfigManager } from '../../config/index.js';
import type { ConfigManager } from '../../config/types.js';
import type {
  DevelopmentHouseType,
  CodeFile,
  FileTree,
  CodeIssue,
  Severity,
  Recommendation,
  ReportMetadata,
  FileChangeEvent,
  ReviewResult,
} from './types.js';
import { DEVELOPMENT_CONFIG } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// DEVELOPMENT AGENT BASE CLASS
// ═══════════════════════════════════════════════════════════════════

/**
 * Abstract base class for development agents
 */
export abstract class DevelopmentAgentBase extends AgentBase {
  /**
   * Category identifier for development agents
   */
  readonly category = 'development' as const;

  /**
   * Version for report metadata
   */
  abstract readonly version: string;

  protected configManager: ConfigManager;

  constructor() {
    super();
    this.configManager = getConfigManager();
  }

  // ─────────────────────────────────────────────────────────────────
  // ABSTRACT METHODS (Implement in subclasses)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get the development house type
   */
  abstract getDevelopmentHouse(): DevelopmentHouseType;

  /**
   * File patterns this agent is interested in
   */
  abstract getFilePatterns(): string[];

  /**
   * Handle file changes (hook interface)
   */
  abstract onFileChange?(event: FileChangeEvent): Promise<ReviewResult>;

  /**
   * Pre-commit hook
   */
  abstract onPreCommit?(stagedFiles: string[]): Promise<ReviewResult>;

  /**
   * Pre-push hook
   */
  abstract onPrePush?(commits: string[]): Promise<ReviewResult>;

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    this.log('info', `${this.name} initializing (development agent)`);

    // Subscribe to development events
    this.subscribe('development:file-changed');
    this.subscribe('development:pre-commit');
    this.subscribe('development:pre-push');
    this.subscribe('development:review-requested');
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', `${this.name} shutting down`);
  }

  // ─────────────────────────────────────────────────────────────────
  // CODE ANALYSIS HELPERS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Detect language from file extension
   */
  protected detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'java': 'java',
      'rb': 'ruby',
      'css': 'css',
      'scss': 'scss',
      'html': 'html',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sql': 'sql',
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'bash',
    };
    return languageMap[ext] || 'unknown';
  }

  /**
   * Check if file matches any of the given patterns
   */
  protected matchesPattern(filePath: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      // Convert glob pattern to regex
      // Use placeholder for ** to avoid double-replacement
      const GLOBSTAR_PLACEHOLDER = '\u0000GLOBSTAR\u0000';
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, GLOBSTAR_PLACEHOLDER)  // Placeholder for **
        .replace(/\*/g, '[^/]*')                  // Single * = one segment
        .replace(new RegExp(GLOBSTAR_PLACEHOLDER, 'g'), '.*')  // ** = any path
        .replace(/\?/g, '.');
      return new RegExp(`^${regexPattern}$`).test(filePath);
    });
  }

  /**
   * Filter files by patterns
   */
  protected filterFiles(files: CodeFile[], patterns: string[]): CodeFile[] {
    return files.filter(f => this.matchesPattern(f.path, patterns));
  }

  /**
   * Count lines of code (excluding comments and blank lines)
   */
  protected countLinesOfCode(content: string, language: string): number {
    const lines = content.split('\n');
    let count = 0;

    const commentPatterns: Record<string, RegExp[]> = {
      typescript: [/^\s*\/\//, /^\s*\/\*/, /^\s*\*/],
      javascript: [/^\s*\/\//, /^\s*\/\*/, /^\s*\*/],
      python: [/^\s*#/],
      css: [/^\s*\/\*/, /^\s*\*/],
      html: [/^\s*<!--/],
    };

    const patterns = commentPatterns[language] || [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      if (patterns.some(p => p.test(trimmed))) continue;
      count++;
    }

    return count;
  }

  /**
   * Extract imports from source code
   */
  protected extractImports(content: string, language: string): string[] {
    const imports: string[] = [];

    if (language === 'typescript' || language === 'javascript') {
      // ES6 imports
      const esImports = content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
      for (const match of esImports) {
        imports.push(match[1]);
      }

      // CommonJS require
      const requires = content.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
      for (const match of requires) {
        imports.push(match[1]);
      }
    } else if (language === 'python') {
      const pyImports = content.matchAll(/(?:from\s+(\S+)\s+)?import\s+(\S+)/g);
      for (const match of pyImports) {
        imports.push(match[1] || match[2]);
      }
    }

    return [...new Set(imports)];
  }

  /**
   * Extract function/method names from source code
   */
  protected extractFunctions(content: string, language: string): string[] {
    const functions: string[] = [];

    if (language === 'typescript' || language === 'javascript') {
      // Function declarations
      const funcDecls = content.matchAll(/function\s+(\w+)\s*\(/g);
      for (const match of funcDecls) {
        functions.push(match[1]);
      }

      // Arrow functions assigned to variables
      const arrowFuncs = content.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g);
      for (const match of arrowFuncs) {
        functions.push(match[1]);
      }

      // Class methods
      const methods = content.matchAll(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+\s*)?\{/g);
      for (const match of methods) {
        if (!['if', 'for', 'while', 'switch', 'catch', 'function'].includes(match[1])) {
          functions.push(match[1]);
        }
      }
    } else if (language === 'python') {
      const pyFuncs = content.matchAll(/def\s+(\w+)\s*\(/g);
      for (const match of pyFuncs) {
        functions.push(match[1]);
      }
    }

    return [...new Set(functions)];
  }

  /**
   * Extract class names from source code
   */
  protected extractClasses(content: string, language: string): string[] {
    const classes: string[] = [];

    if (language === 'typescript' || language === 'javascript') {
      const tsClasses = content.matchAll(/class\s+(\w+)/g);
      for (const match of tsClasses) {
        classes.push(match[1]);
      }
    } else if (language === 'python') {
      const pyClasses = content.matchAll(/class\s+(\w+)/g);
      for (const match of pyClasses) {
        classes.push(match[1]);
      }
    }

    return [...new Set(classes)];
  }

  // ─────────────────────────────────────────────────────────────────
  // REPORT GENERATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create report metadata
   */
  protected createReportMetadata(
    filesAnalyzed: number,
    analysisTimeMs: number,
    projectId?: string
  ): ReportMetadata {
    return {
      generatedAt: new Date().toISOString(),
      agentId: this.id,
      agentVersion: this.version,
      analysisTimeMs,
      filesAnalyzed,
      projectId,
    };
  }

  /**
   * Create a code issue
   */
  protected createIssue(
    severity: Severity,
    message: string,
    options?: {
      file?: string;
      line?: number;
      column?: number;
      endLine?: number;
      endColumn?: number;
      rule?: string;
      suggestion?: string;
      autoFixable?: boolean;
    }
  ): CodeIssue {
    return {
      id: this.generateId('issue'),
      severity,
      message,
      ...options,
    };
  }

  /**
   * Create a recommendation
   */
  protected createRecommendation(
    title: string,
    description: string,
    options: {
      priority: 'low' | 'medium' | 'high' | 'critical';
      effort: 'trivial' | 'small' | 'medium' | 'large';
      impact: 'low' | 'medium' | 'high';
      category: string;
    }
  ): Recommendation {
    return {
      id: this.generateId('rec'),
      title,
      description,
      ...options,
    };
  }

  /**
   * Create a review result for hooks
   */
  protected createReviewResult(
    trigger: string,
    passed: boolean,
    blockers: CodeIssue[],
    warnings: CodeIssue[],
    summary: string
  ): ReviewResult {
    return {
      agent: this.getDevelopmentHouse(),
      trigger,
      timestamp: Date.now(),
      passed,
      blockers,
      warnings,
      summary,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // AI INTEGRATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Call AI for analysis
   */
  protected async callAI(
    capability: string,
    input: string,
    options?: { systemPrompt?: string }
  ): Promise<string> {
    const response = await this.bus.request('model-master', {
      type: 'call-capability',
      payload: {
        capability,
        input,
        params: options,
      },
    });

    if (!response.success) {
      throw new Error(response.error || 'AI call failed');
    }

    return (response.data as { output: string }).output;
  }

  /**
   * Parse JSON from AI response
   */
  protected parseAIResponse<T>(response: string): T | null {
    try {
      // Try to extract JSON array first
      const arrayMatch = response.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        return JSON.parse(arrayMatch[0]) as T;
      }

      // Then try object
      const objectMatch = response.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]) as T;
      }

      return null;
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // CONFIG HELPERS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get a development config value
   */
  protected async getConfig<T>(key: string, defaultValue: T): Promise<T> {
    return this.configManager.getOrDefault<T>('agents', key, defaultValue);
  }

  /**
   * Check if hooks are enabled
   */
  protected async areHooksEnabled(): Promise<boolean> {
    return this.configManager.getOrDefault<boolean>(
      'features',
      DEVELOPMENT_CONFIG.HOOKS_ENABLED,
      true
    );
  }

  /**
   * Check if should block on error
   */
  protected async shouldBlockOnError(): Promise<boolean> {
    return this.configManager.getOrDefault<boolean>(
      'features',
      DEVELOPMENT_CONFIG.HOOKS_BLOCK_ON_ERROR,
      false
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // UTILITY
  // ─────────────────────────────────────────────────────────────────

  /**
   * Calculate a score from issues
   */
  protected calculateScore(
    issues: CodeIssue[],
    weights: Record<Severity, number> = {
      info: 0,
      warning: 5,
      error: 15,
      critical: 30,
    }
  ): number {
    const totalPenalty = issues.reduce((sum, issue) => {
      return sum + (weights[issue.severity] || 0);
    }, 0);

    // Score from 0-100, higher is better
    return Math.max(0, Math.min(100, 100 - totalPenalty));
  }

  /**
   * Group issues by severity
   */
  protected groupBySeverity(issues: CodeIssue[]): Record<Severity, CodeIssue[]> {
    return {
      info: issues.filter(i => i.severity === 'info'),
      warning: issues.filter(i => i.severity === 'warning'),
      error: issues.filter(i => i.severity === 'error'),
      critical: issues.filter(i => i.severity === 'critical'),
    };
  }

  /**
   * Group issues by file
   */
  protected groupByFile(issues: CodeIssue[]): Record<string, CodeIssue[]> {
    const grouped: Record<string, CodeIssue[]> = {};
    for (const issue of issues) {
      const file = issue.file || 'unknown';
      if (!grouped[file]) {
        grouped[file] = [];
      }
      grouped[file].push(issue);
    }
    return grouped;
  }
}

/**
 * Development agent interface for type safety
 */
export interface DevelopmentAgent {
  getDevelopmentHouse(): DevelopmentHouseType;
  getFilePatterns(): string[];
  onFileChange?(event: FileChangeEvent): Promise<ReviewResult>;
  onPreCommit?(stagedFiles: string[]): Promise<ReviewResult>;
  onPrePush?(commits: string[]): Promise<ReviewResult>;
}
