/**
 * Stylist Agent
 *
 * The keeper of code aesthetics and conventions.
 * Enforces consistent style, naming conventions, and formatting
 * across the codebase.
 *
 * Capabilities:
 * - Code style review
 * - Naming convention validation
 * - Formatting analysis
 * - Consistency checking
 * - Auto-fix suggestions
 *
 * NOTE: Uses ConfigManager for all thresholds and prompts.
 */

import { DevelopmentAgentBase } from './development-agent-base.js';
import type { AgentMessage, HouseType } from '../../runtime/types.js';
import type {
  DevelopmentHouseType,
  StyleReviewRequest,
  StyleReview,
  StyleViolation,
  NamingIssue,
  ConsistencyIssue,
  AutoFix,
  CodeFile,
  FileChangeEvent,
  ReviewResult,
  Severity,
  CodeIssue,
} from './types.js';
import { DEVELOPMENT_CONFIG } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// STYLIST CONFIG KEYS
// ═══════════════════════════════════════════════════════════════════

export const STYLIST_CONFIG = {
  STRICTNESS: 'stylist.strictness',
  AUTO_FIX: 'stylist.autoFix',
  IGNORE_PATTERNS: 'stylist.ignorePatterns',
  MAX_LINE_LENGTH: 'stylist.maxLineLength',
  INDENT_SIZE: 'stylist.indentSize',
  QUOTE_STYLE: 'stylist.quoteStyle',
} as const;

// ═══════════════════════════════════════════════════════════════════
// STYLE RULES
// ═══════════════════════════════════════════════════════════════════

interface StyleRuleDefinition {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  languages: string[];
  check: (content: string, options: StyleOptions) => StyleRuleViolation[];
  autoFixable: boolean;
}

interface StyleRuleViolation {
  line: number;
  column?: number;
  message: string;
  suggestion?: string;
  fixedCode?: string;
}

interface StyleOptions {
  maxLineLength: number;
  indentSize: number;
  quoteStyle: 'single' | 'double';
  strictness: 'lenient' | 'moderate' | 'strict';
}

/**
 * Built-in style rules
 */
const STYLE_RULES: StyleRuleDefinition[] = [
  {
    id: 'max-line-length',
    name: 'Maximum Line Length',
    description: 'Lines should not exceed maximum length',
    severity: 'warning',
    languages: ['typescript', 'javascript', 'python', 'css'],
    autoFixable: false,
    check: (content, options) => {
      const violations: StyleRuleViolation[] = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.length > options.maxLineLength) {
          violations.push({
            line: index + 1,
            column: options.maxLineLength,
            message: `Line exceeds ${options.maxLineLength} characters (${line.length})`,
            suggestion: 'Break into multiple lines or extract to variable',
          });
        }
      });

      return violations;
    },
  },
  {
    id: 'consistent-quotes',
    name: 'Consistent Quotes',
    description: 'Use consistent quote style',
    severity: 'info',
    languages: ['typescript', 'javascript'],
    autoFixable: true,
    check: (content, options) => {
      const violations: StyleRuleViolation[] = [];
      const lines = content.split('\n');
      const wrongQuote = options.quoteStyle === 'single' ? '"' : "'";
      const correctQuote = options.quoteStyle === 'single' ? "'" : '"';

      lines.forEach((line, index) => {
        // Skip lines with template literals or JSX
        if (line.includes('`') || line.includes('/>')) return;

        // Find string literals with wrong quotes
        const regex = new RegExp(`${wrongQuote}[^${wrongQuote}]*${wrongQuote}`, 'g');
        let match;
        while ((match = regex.exec(line)) !== null) {
          // Skip if it contains the other quote (avoids escaping issues)
          if (match[0].includes(correctQuote)) continue;

          violations.push({
            line: index + 1,
            column: match.index + 1,
            message: `Use ${options.quoteStyle} quotes instead of ${options.quoteStyle === 'single' ? 'double' : 'single'}`,
            fixedCode: correctQuote + match[0].slice(1, -1) + correctQuote,
          });
        }
      });

      return violations;
    },
  },
  {
    id: 'no-trailing-whitespace',
    name: 'No Trailing Whitespace',
    description: 'Lines should not have trailing whitespace',
    severity: 'info',
    languages: ['typescript', 'javascript', 'python', 'css', 'html'],
    autoFixable: true,
    check: (content) => {
      const violations: StyleRuleViolation[] = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (/\s+$/.test(line)) {
          violations.push({
            line: index + 1,
            message: 'Trailing whitespace',
            fixedCode: line.trimEnd(),
          });
        }
      });

      return violations;
    },
  },
  {
    id: 'consistent-indentation',
    name: 'Consistent Indentation',
    description: 'Use consistent indentation',
    severity: 'warning',
    languages: ['typescript', 'javascript', 'python'],
    autoFixable: true,
    check: (content, options) => {
      const violations: StyleRuleViolation[] = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.trim().length === 0) return;

        const leadingWhitespace = line.match(/^(\s*)/)?.[1] || '';

        // Check for tabs when using spaces
        if (leadingWhitespace.includes('\t')) {
          violations.push({
            line: index + 1,
            message: 'Use spaces for indentation, not tabs',
            fixedCode: line.replace(/^\t+/, match => ' '.repeat(match.length * options.indentSize)),
          });
        }

        // Check indentation is multiple of indent size
        const spaceCount = leadingWhitespace.replace(/\t/g, '').length;
        if (spaceCount > 0 && spaceCount % options.indentSize !== 0) {
          violations.push({
            line: index + 1,
            message: `Indentation should be a multiple of ${options.indentSize} spaces`,
          });
        }
      });

      return violations;
    },
  },
  {
    id: 'no-console',
    name: 'No Console Statements',
    description: 'Avoid console statements in production code',
    severity: 'warning',
    languages: ['typescript', 'javascript'],
    autoFixable: false,
    check: (content, options) => {
      if (options.strictness === 'lenient') return [];

      const violations: StyleRuleViolation[] = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (/console\.(log|debug|info|warn|error)\s*\(/.test(line)) {
          // Skip if it looks like a legitimate logger
          if (/\/\/\s*eslint-disable/.test(line)) return;

          violations.push({
            line: index + 1,
            message: 'Avoid console statements in production code',
            suggestion: 'Use a proper logging library or remove',
          });
        }
      });

      return violations;
    },
  },
  {
    id: 'no-debugger',
    name: 'No Debugger Statements',
    description: 'Remove debugger statements',
    severity: 'error',
    languages: ['typescript', 'javascript'],
    autoFixable: true,
    check: (content) => {
      const violations: StyleRuleViolation[] = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (/\bdebugger\b/.test(line)) {
          violations.push({
            line: index + 1,
            message: 'Remove debugger statement',
            fixedCode: line.replace(/\bdebugger\s*;?/, ''),
          });
        }
      });

      return violations;
    },
  },
  {
    id: 'prefer-const',
    name: 'Prefer Const',
    description: 'Use const for variables that are never reassigned',
    severity: 'info',
    languages: ['typescript', 'javascript'],
    autoFixable: true,
    check: (content, options) => {
      if (options.strictness === 'lenient') return [];

      const violations: StyleRuleViolation[] = [];
      const lines = content.split('\n');

      // Simple heuristic: find let declarations without reassignment
      const letDeclarations = new Map<string, { line: number; reassigned: boolean }>();

      lines.forEach((line, index) => {
        // Find let declarations
        const letMatch = line.match(/\blet\s+(\w+)\s*=/);
        if (letMatch) {
          letDeclarations.set(letMatch[1], { line: index + 1, reassigned: false });
        }

        // Check for reassignments
        for (const [varName, info] of letDeclarations) {
          const reassignPattern = new RegExp(`\\b${varName}\\s*(?:[+\\-*/%]?=|\\+\\+|--)`, 'g');
          // Skip the declaration line itself
          if (index + 1 !== info.line && reassignPattern.test(line)) {
            info.reassigned = true;
          }
        }
      });

      // Report let declarations that are never reassigned
      for (const [varName, info] of letDeclarations) {
        if (!info.reassigned) {
          violations.push({
            line: info.line,
            message: `'${varName}' is never reassigned. Use 'const' instead.`,
            suggestion: `Replace 'let ${varName}' with 'const ${varName}'`,
          });
        }
      }

      return violations;
    },
  },
  {
    id: 'no-var',
    name: 'No Var',
    description: 'Use let or const instead of var',
    severity: 'warning',
    languages: ['typescript', 'javascript'],
    autoFixable: true,
    check: (content) => {
      const violations: StyleRuleViolation[] = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (/\bvar\s+\w/.test(line)) {
          violations.push({
            line: index + 1,
            message: "Use 'let' or 'const' instead of 'var'",
            fixedCode: line.replace(/\bvar\s+/, 'let '),
          });
        }
      });

      return violations;
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// NAMING CONVENTIONS
// ═══════════════════════════════════════════════════════════════════

interface NamingConvention {
  type: 'variable' | 'function' | 'class' | 'constant' | 'file' | 'type';
  pattern: RegExp;
  description: string;
  example: string;
}

const NAMING_CONVENTIONS: Record<string, NamingConvention[]> = {
  typescript: [
    { type: 'variable', pattern: /^[a-z][a-zA-Z0-9]*$/, description: 'camelCase', example: 'myVariable' },
    { type: 'function', pattern: /^[a-z][a-zA-Z0-9]*$/, description: 'camelCase', example: 'myFunction' },
    { type: 'class', pattern: /^[A-Z][a-zA-Z0-9]*$/, description: 'PascalCase', example: 'MyClass' },
    { type: 'constant', pattern: /^[A-Z][A-Z0-9_]*$/, description: 'UPPER_SNAKE_CASE', example: 'MY_CONSTANT' },
    { type: 'type', pattern: /^[A-Z][a-zA-Z0-9]*$/, description: 'PascalCase', example: 'MyType' },
    { type: 'file', pattern: /^[a-z][a-z0-9-]*(\.[a-z]+)+$/, description: 'kebab-case', example: 'my-file.ts' },
  ],
  javascript: [
    { type: 'variable', pattern: /^[a-z][a-zA-Z0-9]*$/, description: 'camelCase', example: 'myVariable' },
    { type: 'function', pattern: /^[a-z][a-zA-Z0-9]*$/, description: 'camelCase', example: 'myFunction' },
    { type: 'class', pattern: /^[A-Z][a-zA-Z0-9]*$/, description: 'PascalCase', example: 'MyClass' },
    { type: 'constant', pattern: /^[A-Z][A-Z0-9_]*$/, description: 'UPPER_SNAKE_CASE', example: 'MY_CONSTANT' },
  ],
  python: [
    { type: 'variable', pattern: /^[a-z][a-z0-9_]*$/, description: 'snake_case', example: 'my_variable' },
    { type: 'function', pattern: /^[a-z][a-z0-9_]*$/, description: 'snake_case', example: 'my_function' },
    { type: 'class', pattern: /^[A-Z][a-zA-Z0-9]*$/, description: 'PascalCase', example: 'MyClass' },
    { type: 'constant', pattern: /^[A-Z][A-Z0-9_]*$/, description: 'UPPER_SNAKE_CASE', example: 'MY_CONSTANT' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

interface NamingValidationRequest {
  files: CodeFile[];
  language?: string;
  projectId?: string;
}

interface ConsistencyCheckRequest {
  files: CodeFile[];
  projectId?: string;
}

interface FormatCodeRequest {
  files: CodeFile[];
  options?: Partial<StyleOptions>;
  projectId?: string;
}

// ═══════════════════════════════════════════════════════════════════
// STYLIST AGENT
// ═══════════════════════════════════════════════════════════════════

export class StylistAgent extends DevelopmentAgentBase {
  readonly id = 'stylist';
  readonly name = 'The Stylist';
  readonly house: HouseType = 'stylist';
  readonly version = '1.0.0';
  readonly capabilities = [
    'review-code-style',
    'validate-naming',
    'check-consistency',
    'format-code',
    'suggest-fixes',
    'on-file-change',
    'on-pre-commit',
  ];

  // ─────────────────────────────────────────────────────────────────
  // DEVELOPMENT AGENT INTERFACE
  // ─────────────────────────────────────────────────────────────────

  getDevelopmentHouse(): DevelopmentHouseType {
    return 'stylist';
  }

  getFilePatterns(): string[] {
    return [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.py',
      '**/*.css',
      '**/*.scss',
      '**/*.json',
    ];
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    await super.onInitialize();
    this.log('info', 'Stylist preparing the style guide');
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', 'Stylist closing the fashion book');
    await super.onShutdown();
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE HANDLING
  // ─────────────────────────────────────────────────────────────────

  protected async onMessage(message: AgentMessage): Promise<unknown> {
    switch (message.type) {
      case 'review-code-style':
        return this.reviewCodeStyle(message.payload as StyleReviewRequest);

      case 'validate-naming':
        return this.validateNaming(message.payload as NamingValidationRequest);

      case 'check-consistency':
        return this.checkConsistency(message.payload as ConsistencyCheckRequest);

      case 'format-code':
        return this.formatCode(message.payload as FormatCodeRequest);

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // HOOK INTERFACES
  // ─────────────────────────────────────────────────────────────────

  async onFileChange(event: FileChangeEvent): Promise<ReviewResult> {
    const hooksEnabled = await this.areHooksEnabled();
    if (!hooksEnabled) {
      return this.createReviewResult('file-change', true, [], [], 'Hooks disabled');
    }

    const relevantFiles = event.files.filter(f => this.matchesPattern(f, this.getFilePatterns()));

    if (relevantFiles.length === 0) {
      return this.createReviewResult(
        'file-change',
        true,
        [],
        [],
        'No style-relevant files changed'
      );
    }

    const warnings: CodeIssue[] = [];
    const blockers: CodeIssue[] = [];

    // Note: We can't read file contents from just file paths here
    // In a real implementation, we'd need file system access
    return this.createReviewResult(
      'file-change',
      true,
      [],
      [],
      `${relevantFiles.length} files changed - run full style review for details`
    );
  }

  async onPreCommit(stagedFiles: string[]): Promise<ReviewResult> {
    const hooksEnabled = await this.areHooksEnabled();
    if (!hooksEnabled) {
      return this.createReviewResult('pre-commit', true, [], [], 'Hooks disabled');
    }

    const relevantFiles = stagedFiles.filter(f => this.matchesPattern(f, this.getFilePatterns()));
    const warnings: CodeIssue[] = [];
    const blockers: CodeIssue[] = [];

    // Check file naming conventions
    for (const file of relevantFiles) {
      const fileName = file.split('/').pop() || '';
      const language = this.detectLanguage(file);
      const conventions = NAMING_CONVENTIONS[language] || [];
      const fileConvention = conventions.find(c => c.type === 'file');

      if (fileConvention && !fileConvention.pattern.test(fileName)) {
        warnings.push(this.createIssue(
          'warning',
          `File name '${fileName}' should be ${fileConvention.description}`,
          { file, rule: 'file-naming', suggestion: `Example: ${fileConvention.example}` }
        ));
      }
    }

    const passed = blockers.length === 0;
    return this.createReviewResult(
      'pre-commit',
      passed,
      blockers,
      warnings,
      `Pre-commit style check: ${relevantFiles.length} files, ${warnings.length} warnings`
    );
  }

  async onPrePush(commits: string[]): Promise<ReviewResult> {
    return this.createReviewResult(
      'pre-push',
      true,
      [],
      [],
      `Style check for ${commits.length} commits`
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // STYLE REVIEW
  // ─────────────────────────────────────────────────────────────────

  async reviewCodeStyle(request: StyleReviewRequest): Promise<StyleReview> {
    const startTime = Date.now();
    const { files, strictness } = request;

    // Get style options from config
    const options = await this.getStyleOptions(strictness);

    const allViolations: StyleViolation[] = [];
    const allNamingIssues: NamingIssue[] = [];
    const formattingIssues: StyleViolation[] = [];

    for (const file of files) {
      const language = request.language || this.detectLanguage(file.path);

      // Apply style rules
      for (const rule of STYLE_RULES) {
        if (!rule.languages.includes(language)) continue;

        const ruleViolations = rule.check(file.content, options);

        for (const violation of ruleViolations) {
          const styleViolation: StyleViolation = {
            id: this.generateId('style'),
            severity: rule.severity,
            message: violation.message,
            file: file.path,
            line: violation.line,
            column: violation.column,
            ruleId: rule.id,
            ruleName: rule.name,
            suggestion: violation.suggestion,
            fixedCode: violation.fixedCode,
            autoFixable: rule.autoFixable && !!violation.fixedCode,
          };

          if (rule.id.includes('indent') || rule.id.includes('whitespace') || rule.id.includes('line-length')) {
            formattingIssues.push(styleViolation);
          } else {
            allViolations.push(styleViolation);
          }
        }
      }

      // Check naming conventions
      const namingIssues = this.checkNamingConventions(file, language);
      allNamingIssues.push(...namingIssues);
    }

    // Check consistency across files
    const consistencyIssues = await this.analyzeConsistency(files);

    // Calculate score
    const totalIssues = allViolations.length + allNamingIssues.length + formattingIssues.length + consistencyIssues.length;
    const score = this.calculateScore([...allViolations, ...formattingIssues]);

    // Count fixable issues
    const fixableCount = [...allViolations, ...formattingIssues].filter(v => v.autoFixable).length;

    // Generate auto-fixes
    const autoFixSuggestions = this.generateAutoFixes(allViolations, formattingIssues);

    // Group by severity
    const bySeverity: Record<Severity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    for (const v of [...allViolations, ...formattingIssues]) {
      bySeverity[v.severity]++;
    }

    // Group by category
    const byCategory: Record<string, number> = {};
    for (const v of allViolations) {
      const category = v.ruleId.split('-')[0];
      byCategory[category] = (byCategory[category] || 0) + 1;
    }

    const review: StyleReview = {
      metadata: this.createReportMetadata(
        files.length,
        Date.now() - startTime,
        request.projectId
      ),
      overallScore: score,
      violations: allViolations,
      namingIssues: allNamingIssues,
      consistencyIssues,
      formattingIssues,
      fixableCount,
      autoFixSuggestions,
      styleSummary: {
        totalIssues,
        bySeperity: bySeverity,
        byCategory,
      },
    };

    return review;
  }

  // ─────────────────────────────────────────────────────────────────
  // NAMING VALIDATION
  // ─────────────────────────────────────────────────────────────────

  async validateNaming(request: NamingValidationRequest): Promise<NamingIssue[]> {
    const issues: NamingIssue[] = [];

    for (const file of request.files) {
      const language = request.language || this.detectLanguage(file.path);
      const fileIssues = this.checkNamingConventions(file, language);
      issues.push(...fileIssues);
    }

    return issues;
  }

  private checkNamingConventions(file: CodeFile, language: string): NamingIssue[] {
    const issues: NamingIssue[] = [];
    const conventions = NAMING_CONVENTIONS[language] || [];
    const lines = file.content.split('\n');

    // Extract identifiers and check against conventions
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check variable declarations
      const varConvention = conventions.find(c => c.type === 'variable');
      if (varConvention) {
        const varMatches = line.matchAll(/(?:let|const|var)\s+(\w+)/g);
        for (const match of varMatches) {
          const name = match[1];
          // Skip if it looks like a constant (all uppercase)
          if (/^[A-Z][A-Z0-9_]*$/.test(name)) continue;

          if (!varConvention.pattern.test(name)) {
            issues.push({
              identifier: name,
              type: 'variable',
              file: file.path,
              line: i + 1,
              convention: varConvention.description,
              suggestion: this.suggestName(name, varConvention),
              severity: 'warning',
            });
          }
        }
      }

      // Check function declarations
      const funcConvention = conventions.find(c => c.type === 'function');
      if (funcConvention) {
        const funcMatches = line.matchAll(/function\s+(\w+)/g);
        for (const match of funcMatches) {
          const name = match[1];
          if (!funcConvention.pattern.test(name)) {
            issues.push({
              identifier: name,
              type: 'function',
              file: file.path,
              line: i + 1,
              convention: funcConvention.description,
              suggestion: this.suggestName(name, funcConvention),
              severity: 'warning',
            });
          }
        }
      }

      // Check class declarations
      const classConvention = conventions.find(c => c.type === 'class');
      if (classConvention) {
        const classMatches = line.matchAll(/class\s+(\w+)/g);
        for (const match of classMatches) {
          const name = match[1];
          if (!classConvention.pattern.test(name)) {
            issues.push({
              identifier: name,
              type: 'class',
              file: file.path,
              line: i + 1,
              convention: classConvention.description,
              suggestion: this.suggestName(name, classConvention),
              severity: 'error',
            });
          }
        }
      }

      // Check type/interface declarations (TypeScript)
      const typeConvention = conventions.find(c => c.type === 'type');
      if (typeConvention && language === 'typescript') {
        const typeMatches = line.matchAll(/(?:type|interface)\s+(\w+)/g);
        for (const match of typeMatches) {
          const name = match[1];
          if (!typeConvention.pattern.test(name)) {
            issues.push({
              identifier: name,
              type: 'type',
              file: file.path,
              line: i + 1,
              convention: typeConvention.description,
              suggestion: this.suggestName(name, typeConvention),
              severity: 'warning',
            });
          }
        }
      }
    }

    return issues;
  }

  private suggestName(name: string, convention: NamingConvention): string {
    switch (convention.description) {
      case 'camelCase':
        return name.replace(/[-_](.)/g, (_, c) => c.toUpperCase()).replace(/^./, c => c.toLowerCase());
      case 'PascalCase':
        return name.replace(/[-_](.)/g, (_, c) => c.toUpperCase()).replace(/^./, c => c.toUpperCase());
      case 'snake_case':
        return name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
      case 'UPPER_SNAKE_CASE':
        return name.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
      case 'kebab-case':
        return name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      default:
        return name;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // CONSISTENCY CHECKING
  // ─────────────────────────────────────────────────────────────────

  async checkConsistency(request: ConsistencyCheckRequest): Promise<ConsistencyIssue[]> {
    return this.analyzeConsistency(request.files);
  }

  private async analyzeConsistency(files: CodeFile[]): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];

    // Check import style consistency
    const importStyles = new Map<string, Array<{ file: string; line: number; example: string }>>();

    for (const file of files) {
      const language = this.detectLanguage(file.path);
      if (language !== 'typescript' && language !== 'javascript') continue;

      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect import styles
        if (/^import\s+\{/.test(line)) {
          const style = 'destructured';
          if (!importStyles.has(style)) importStyles.set(style, []);
          importStyles.get(style)!.push({ file: file.path, line: i + 1, example: line.trim() });
        } else if (/^import\s+\*\s+as/.test(line)) {
          const style = 'namespace';
          if (!importStyles.has(style)) importStyles.set(style, []);
          importStyles.get(style)!.push({ file: file.path, line: i + 1, example: line.trim() });
        } else if (/^import\s+\w+\s+from/.test(line)) {
          const style = 'default';
          if (!importStyles.has(style)) importStyles.set(style, []);
          importStyles.get(style)!.push({ file: file.path, line: i + 1, example: line.trim() });
        }
      }
    }

    // If mixed import styles, report
    if (importStyles.size > 1) {
      const allOccurrences: Array<{ file: string; line: number; example: string }> = [];
      for (const occurrences of importStyles.values()) {
        allOccurrences.push(...occurrences.slice(0, 2));
      }

      issues.push({
        type: 'import',
        description: `Mixed import styles detected: ${Array.from(importStyles.keys()).join(', ')}`,
        occurrences: allOccurrences,
        suggestion: 'Use a consistent import style across the codebase',
      });
    }

    // Check quote style consistency
    let singleQuoteCount = 0;
    let doubleQuoteCount = 0;

    for (const file of files) {
      const singles = (file.content.match(/'/g) || []).length;
      const doubles = (file.content.match(/"/g) || []).length;
      singleQuoteCount += singles;
      doubleQuoteCount += doubles;
    }

    if (singleQuoteCount > 0 && doubleQuoteCount > 0) {
      const ratio = Math.min(singleQuoteCount, doubleQuoteCount) / Math.max(singleQuoteCount, doubleQuoteCount);
      if (ratio > 0.3) { // Significant mix
        issues.push({
          type: 'formatting',
          description: `Mixed quote styles: ${singleQuoteCount} single, ${doubleQuoteCount} double`,
          occurrences: [],
          suggestion: `Standardize on ${singleQuoteCount > doubleQuoteCount ? 'single' : 'double'} quotes`,
        });
      }
    }

    return issues;
  }

  // ─────────────────────────────────────────────────────────────────
  // CODE FORMATTING
  // ─────────────────────────────────────────────────────────────────

  async formatCode(request: FormatCodeRequest): Promise<{
    files: Array<{ path: string; formatted: string; changes: number }>;
  }> {
    const options = await this.getStyleOptions(request.options?.strictness || 'moderate');

    const results = [];

    for (const file of request.files) {
      let formatted = file.content;
      let changes = 0;

      // Apply auto-fixes
      const language = this.detectLanguage(file.path);

      for (const rule of STYLE_RULES) {
        if (!rule.languages.includes(language)) continue;
        if (!rule.autoFixable) continue;

        const violations = rule.check(formatted, options);
        for (const violation of violations) {
          if (violation.fixedCode) {
            const lines = formatted.split('\n');
            if (lines[violation.line - 1]) {
              lines[violation.line - 1] = violation.fixedCode;
              formatted = lines.join('\n');
              changes++;
            }
          }
        }
      }

      results.push({
        path: file.path,
        formatted,
        changes,
      });
    }

    return { files: results };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────

  private async getStyleOptions(strictness: 'lenient' | 'moderate' | 'strict'): Promise<StyleOptions> {
    const maxLineLength = await this.getConfig<number>(STYLIST_CONFIG.MAX_LINE_LENGTH, 100);
    const indentSize = await this.getConfig<number>(STYLIST_CONFIG.INDENT_SIZE, 2);
    const quoteStyle = await this.getConfig<'single' | 'double'>(STYLIST_CONFIG.QUOTE_STYLE, 'single');

    return {
      maxLineLength,
      indentSize,
      quoteStyle,
      strictness,
    };
  }

  private generateAutoFixes(
    violations: StyleViolation[],
    formattingIssues: StyleViolation[]
  ): AutoFix[] {
    const fixes: AutoFix[] = [];

    for (const violation of [...violations, ...formattingIssues]) {
      if (violation.autoFixable && violation.fixedCode && violation.file && violation.line) {
        fixes.push({
          file: violation.file,
          original: violation.message,
          fixed: violation.fixedCode,
          startLine: violation.line,
          endLine: violation.endLine || violation.line,
          description: `Fix ${violation.ruleName}: ${violation.message}`,
        });
      }
    }

    return fixes;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _stylist: StylistAgent | null = null;

export function getStylistAgent(): StylistAgent {
  if (!_stylist) {
    _stylist = new StylistAgent();
  }
  return _stylist;
}

export function resetStylistAgent(): void {
  _stylist = null;
}
