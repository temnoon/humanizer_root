/**
 * Data Agent
 *
 * The guardian of data integrity and schema standards.
 * Validates schemas, checks interface compatibility, ensures
 * proper Zod usage, and traces data flow through the system.
 *
 * Capabilities:
 * - Schema validation (Zod presence and correctness)
 * - Interface compatibility checking
 * - API contract validation
 * - Data flow analysis
 * - Type safety enforcement
 *
 * NOTE: Uses ConfigManager for all thresholds and prompts.
 */

import { DevelopmentAgentBase } from './development-agent-base.js';
import type { AgentMessage, HouseType } from '../../runtime/types.js';
import type {
  DevelopmentHouseType,
  CodeFile,
  FileChangeEvent,
  ReviewResult,
  CodeIssue,
  Recommendation,
  Severity,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════
// DATA AGENT CONFIG KEYS
// ═══════════════════════════════════════════════════════════════════

export const DATA_CONFIG = {
  REQUIRE_ZOD_SCHEMAS: 'data.requireZodSchemas',
  REQUIRE_TYPE_EXPORTS: 'data.requireTypeExports',
  CHECK_NULLABILITY: 'data.checkNullability',
  MAX_SCHEMA_DEPTH: 'data.maxSchemaDepth',
  STRICT_MODE: 'data.strictMode',
} as const;

// ═══════════════════════════════════════════════════════════════════
// DATA AGENT TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Schema validation report
 */
export interface SchemaReport {
  metadata: {
    generatedAt: string;
    filesAnalyzed: number;
    analysisTimeMs: number;
  };
  overallScore: number;
  zodUsage: ZodUsageStats;
  issues: SchemaIssue[];
  recommendations: Recommendation[];
}

export interface ZodUsageStats {
  totalSchemas: number;
  validSchemas: number;
  schemasWithIssues: number;
  coveragePercent: number;
  filesWithoutValidation: string[];
}

export interface SchemaIssue {
  type: 'missing-validation' | 'invalid-schema' | 'type-mismatch' | 'unsafe-any' | 'missing-export';
  severity: Severity;
  file: string;
  line?: number;
  description: string;
  suggestion: string;
}

/**
 * Interface compatibility report
 */
export interface CompatibilityReport {
  compatible: boolean;
  breakingChanges: BreakingChange[];
  warnings: CompatibilityWarning[];
  safeChanges: string[];
}

export interface BreakingChange {
  type: 'removed-field' | 'type-change' | 'required-added' | 'signature-change';
  location: string;
  before: string;
  after: string;
  impact: string;
  migration?: string;
}

export interface CompatibilityWarning {
  type: 'optional-removed' | 'default-changed' | 'deprecation';
  location: string;
  description: string;
}

/**
 * API contract report
 */
export interface ContractReport {
  endpoints: EndpointContract[];
  issues: ContractIssue[];
  coverage: {
    withInputValidation: number;
    withOutputValidation: number;
    total: number;
  };
}

export interface EndpointContract {
  path: string;
  method: string;
  hasInputSchema: boolean;
  hasOutputSchema: boolean;
  inputSchema?: string;
  outputSchema?: string;
}

export interface ContractIssue {
  endpoint: string;
  type: 'missing-input-validation' | 'missing-output-validation' | 'schema-mismatch' | 'untyped-response';
  severity: Severity;
  description: string;
}

/**
 * Data flow analysis
 */
export interface DataFlowGraph {
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
  issues: DataFlowIssue[];
}

export interface DataFlowNode {
  id: string;
  type: 'source' | 'transform' | 'sink' | 'validator';
  file: string;
  line?: number;
  dataType?: string;
}

export interface DataFlowEdge {
  from: string;
  to: string;
  transformation?: string;
  validated: boolean;
}

export interface DataFlowIssue {
  type: 'unvalidated-path' | 'type-narrowing-lost' | 'unsafe-cast' | 'any-boundary';
  path: string[];
  description: string;
  severity: Severity;
}

// ═══════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

interface SchemaValidationRequest {
  files: CodeFile[];
  requireZod?: boolean;
  projectId?: string;
}

interface CompatibilityCheckRequest {
  before: CodeFile[];
  after: CodeFile[];
  projectId?: string;
}

interface ContractValidationRequest {
  routeFiles: CodeFile[];
  schemaFiles: CodeFile[];
  projectId?: string;
}

interface DataFlowRequest {
  entryPoint: string;
  files: CodeFile[];
  maxDepth?: number;
  projectId?: string;
}

// ═══════════════════════════════════════════════════════════════════
// ZOD DETECTION PATTERNS
// ═══════════════════════════════════════════════════════════════════

const ZOD_PATTERNS = {
  // Import detection
  zodImport: /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|z)\s+from\s+['"]zod['"]/,
  
  // Schema definitions
  schemaDefinition: /(?:const|let|export\s+const)\s+(\w+)\s*=\s*z\./g,
  
  // Schema usage
  schemaParse: /\.parse\s*\(/g,
  schemaSafeParse: /\.safeParse\s*\(/g,
  
  // Type inference
  zodInfer: /z\.infer\s*<\s*typeof\s+(\w+)\s*>/g,
  
  // Validation methods
  validationMethods: /\.(parse|safeParse|parseAsync|safeParseAsync)\s*\(/g,
};

const TYPE_PATTERNS = {
  // Interface definitions
  interfaceDefinition: /(?:export\s+)?interface\s+(\w+)/g,
  
  // Type definitions
  typeDefinition: /(?:export\s+)?type\s+(\w+)\s*=/g,
  
  // Any usage (problematic)
  anyUsage: /:\s*any\b/g,
  
  // Unknown usage (safer)
  unknownUsage: /:\s*unknown\b/g,
  
  // Optional fields
  optionalField: /(\w+)\s*\?\s*:/g,
  
  // Non-null assertion
  nonNullAssertion: /\w+!/g,
};

// ═══════════════════════════════════════════════════════════════════
// DATA AGENT
// ═══════════════════════════════════════════════════════════════════

export class DataAgent extends DevelopmentAgentBase {
  readonly id = 'data';
  readonly name = 'The Data Guardian';
  readonly house: HouseType = 'data' as HouseType;
  readonly version = '1.0.0';
  readonly capabilities = [
    'validate-schemas',
    'check-zod-usage',
    'check-interface-compatibility',
    'validate-api-contracts',
    'trace-data-flow',
    'on-file-change',
    'on-pre-commit',
  ];

  // ─────────────────────────────────────────────────────────────────
  // DEVELOPMENT AGENT INTERFACE
  // ─────────────────────────────────────────────────────────────────

  getDevelopmentHouse(): DevelopmentHouseType {
    return 'data' as DevelopmentHouseType;
  }

  getFilePatterns(): string[] {
    return [
      '**/*.ts',
      '**/*.tsx',
      '**/schemas/*.ts',
      '**/types/*.ts',
      '**/*schema*.ts',
      '**/*types*.ts',
    ];
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    await super.onInitialize();
    this.log('info', 'Data Guardian establishing schema standards');
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', 'Data Guardian archiving validation rules');
    await super.onShutdown();
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE HANDLING
  // ─────────────────────────────────────────────────────────────────

  protected async onMessage(message: AgentMessage): Promise<unknown> {
    switch (message.type) {
      case 'validate-schemas':
        return this.validateSchemas(message.payload as SchemaValidationRequest);

      case 'check-interface-compatibility':
        return this.checkCompatibility(message.payload as CompatibilityCheckRequest);

      case 'validate-api-contracts':
        return this.validateContracts(message.payload as ContractValidationRequest);

      case 'trace-data-flow':
        return this.traceDataFlow(message.payload as DataFlowRequest);

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
        'No data-relevant files changed'
      );
    }

    const warnings: CodeIssue[] = [];
    const blockers: CodeIssue[] = [];

    // Check for schema/type file changes
    const schemaFiles = relevantFiles.filter(f =>
      f.includes('schema') || f.includes('types') || f.includes('/types/')
    );

    if (schemaFiles.length > 0) {
      warnings.push(this.createIssue(
        'warning',
        `Schema/type files changed: ${schemaFiles.join(', ')}. Run compatibility check before merging.`,
        { rule: 'schema-change-review' }
      ));
    }

    const passed = blockers.length === 0;
    return this.createReviewResult(
      'file-change',
      passed,
      blockers,
      warnings,
      `Data review: ${relevantFiles.length} files, ${schemaFiles.length} schema files`
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

    // Check for exported type changes
    const typeFiles = relevantFiles.filter(f =>
      f.includes('types.ts') || f.includes('/types/') || f.endsWith('.d.ts')
    );

    if (typeFiles.length > 0) {
      warnings.push(this.createIssue(
        'warning',
        `Type definition files being committed. Ensure backward compatibility.`,
        { rule: 'type-export-change' }
      ));
    }

    const passed = blockers.length === 0;
    return this.createReviewResult(
      'pre-commit',
      passed,
      blockers,
      warnings,
      `Pre-commit data check: ${relevantFiles.length} files`
    );
  }

  async onPrePush(commits: string[]): Promise<ReviewResult> {
    return this.createReviewResult(
      'pre-push',
      true,
      [],
      [],
      `Data check for ${commits.length} commits`
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // SCHEMA VALIDATION
  // ─────────────────────────────────────────────────────────────────

  async validateSchemas(request: SchemaValidationRequest): Promise<SchemaReport> {
    const startTime = Date.now();
    const requireZod = request.requireZod ?? await this.getConfig<boolean>(
      DATA_CONFIG.REQUIRE_ZOD_SCHEMAS,
      true
    );

    const issues: SchemaIssue[] = [];
    const filesWithZod: string[] = [];
    const filesWithoutZod: string[] = [];
    let totalSchemas = 0;
    let validSchemas = 0;

    for (const file of request.files) {
      const hasZodImport = ZOD_PATTERNS.zodImport.test(file.content);

      if (hasZodImport) {
        filesWithZod.push(file.path);

        // Count schemas
        const schemaMatches = file.content.matchAll(ZOD_PATTERNS.schemaDefinition);
        for (const match of schemaMatches) {
          totalSchemas++;
          // Basic validation - schema is used somewhere
          const schemaName = match[1];
          if (file.content.includes(`${schemaName}.parse`) ||
              file.content.includes(`${schemaName}.safeParse`) ||
              file.content.includes(`typeof ${schemaName}`)) {
            validSchemas++;
          } else {
            issues.push({
              type: 'invalid-schema',
              severity: 'warning',
              file: file.path,
              description: `Schema '${schemaName}' is defined but never used`,
              suggestion: `Use ${schemaName}.parse() or export for other modules`,
            });
          }
        }
      } else {
        // Check if file should have Zod
        const isApiFile = file.path.includes('/api/') || file.path.includes('/routes/');
        const hasTypeImports = file.content.includes('import type');

        if (isApiFile && requireZod) {
          filesWithoutZod.push(file.path);
          issues.push({
            type: 'missing-validation',
            severity: 'error',
            file: file.path,
            description: 'API file lacks Zod validation',
            suggestion: 'Add Zod schema validation for request bodies',
          });
        }
      }

      // Check for unsafe 'any' usage
      const anyMatches = file.content.matchAll(TYPE_PATTERNS.anyUsage);
      for (const match of anyMatches) {
        const line = this.getLineNumber(file.content, match.index || 0);
        issues.push({
          type: 'unsafe-any',
          severity: 'warning',
          file: file.path,
          line,
          description: 'Usage of `any` type reduces type safety',
          suggestion: 'Use `unknown` with type guards, or define a proper type',
        });
      }

      // Check for missing type exports in type files
      if (file.path.includes('types') || file.path.includes('schema')) {
        const hasExports = /export\s+(type|interface|const)/.test(file.content);
        if (!hasExports) {
          issues.push({
            type: 'missing-export',
            severity: 'warning',
            file: file.path,
            description: 'Type file has no exports',
            suggestion: 'Export types for use by other modules',
          });
        }
      }
    }

    const coveragePercent = request.files.length > 0
      ? (filesWithZod.length / request.files.length) * 100
      : 0;

    const overallScore = this.calculateSchemaScore(issues, coveragePercent);

    const recommendations = this.generateSchemaRecommendations(issues, coveragePercent);

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        filesAnalyzed: request.files.length,
        analysisTimeMs: Date.now() - startTime,
      },
      overallScore,
      zodUsage: {
        totalSchemas,
        validSchemas,
        schemasWithIssues: totalSchemas - validSchemas,
        coveragePercent,
        filesWithoutValidation: filesWithoutZod,
      },
      issues,
      recommendations,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // COMPATIBILITY CHECKING
  // ─────────────────────────────────────────────────────────────────

  async checkCompatibility(request: CompatibilityCheckRequest): Promise<CompatibilityReport> {
    const breakingChanges: BreakingChange[] = [];
    const warnings: CompatibilityWarning[] = [];
    const safeChanges: string[] = [];

    // Extract interfaces from before and after
    const beforeInterfaces = this.extractInterfaces(request.before);
    const afterInterfaces = this.extractInterfaces(request.after);

    // Check for removed interfaces
    for (const [name, beforeDef] of beforeInterfaces) {
      const afterDef = afterInterfaces.get(name);

      if (!afterDef) {
        breakingChanges.push({
          type: 'removed-field',
          location: name,
          before: beforeDef.signature,
          after: '(removed)',
          impact: `Interface '${name}' was removed`,
          migration: `Ensure no code depends on '${name}'`,
        });
        continue;
      }

      // Check for field changes
      const beforeFields = this.extractFields(beforeDef.content);
      const afterFields = this.extractFields(afterDef.content);

      for (const [fieldName, fieldType] of beforeFields) {
        const afterFieldType = afterFields.get(fieldName);

        if (!afterFieldType) {
          breakingChanges.push({
            type: 'removed-field',
            location: `${name}.${fieldName}`,
            before: fieldType,
            after: '(removed)',
            impact: `Field '${fieldName}' removed from '${name}'`,
          });
        } else if (afterFieldType !== fieldType) {
          // Check if it's just adding optional
          if (afterFieldType === `${fieldType}?` || afterFieldType === `${fieldType} | undefined`) {
            safeChanges.push(`${name}.${fieldName}: Made optional`);
          } else {
            breakingChanges.push({
              type: 'type-change',
              location: `${name}.${fieldName}`,
              before: fieldType,
              after: afterFieldType,
              impact: `Field type changed in '${name}'`,
            });
          }
        }
      }

      // Check for new required fields
      for (const [fieldName, fieldType] of afterFields) {
        if (!beforeFields.has(fieldName) && !fieldType.includes('?')) {
          breakingChanges.push({
            type: 'required-added',
            location: `${name}.${fieldName}`,
            before: '(not present)',
            after: fieldType,
            impact: `New required field '${fieldName}' added to '${name}'`,
            migration: `Add '${fieldName}' to all existing usages of '${name}'`,
          });
        } else if (!beforeFields.has(fieldName)) {
          safeChanges.push(`${name}.${fieldName}: New optional field`);
        }
      }
    }

    return {
      compatible: breakingChanges.length === 0,
      breakingChanges,
      warnings,
      safeChanges,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // CONTRACT VALIDATION
  // ─────────────────────────────────────────────────────────────────

  async validateContracts(request: ContractValidationRequest): Promise<ContractReport> {
    const endpoints: EndpointContract[] = [];
    const issues: ContractIssue[] = [];

    // HTTP method patterns
    const routePatterns = [
      /app\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /(GET|POST|PUT|PATCH|DELETE)\s+['"`]([^'"`]+)['"`]/g,
    ];

    for (const file of request.routeFiles) {
      for (const pattern of routePatterns) {
        const matches = file.content.matchAll(pattern);

        for (const match of matches) {
          const method = match[1].toUpperCase();
          const path = match[2];

          // Check for validation
          const hasInputValidation = file.content.includes('.parse(') ||
                                     file.content.includes('.safeParse(') ||
                                     file.content.includes('validate(');

          const hasOutputValidation = file.content.includes('return ') &&
                                      (file.content.includes('Schema') ||
                                       file.content.includes('Response'));

          endpoints.push({
            path,
            method,
            hasInputSchema: hasInputValidation,
            hasOutputSchema: hasOutputValidation,
          });

          if (['POST', 'PUT', 'PATCH'].includes(method) && !hasInputValidation) {
            issues.push({
              endpoint: `${method} ${path}`,
              type: 'missing-input-validation',
              severity: 'error',
              description: 'Endpoint accepts data but has no input validation',
            });
          }

          if (!hasOutputValidation) {
            issues.push({
              endpoint: `${method} ${path}`,
              type: 'missing-output-validation',
              severity: 'warning',
              description: 'Endpoint response is not typed/validated',
            });
          }
        }
      }
    }

    return {
      endpoints,
      issues,
      coverage: {
        withInputValidation: endpoints.filter(e => e.hasInputSchema).length,
        withOutputValidation: endpoints.filter(e => e.hasOutputSchema).length,
        total: endpoints.length,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // DATA FLOW ANALYSIS
  // ─────────────────────────────────────────────────────────────────

  async traceDataFlow(request: DataFlowRequest): Promise<DataFlowGraph> {
    const nodes: DataFlowNode[] = [];
    const edges: DataFlowEdge[] = [];
    const issues: DataFlowIssue[] = [];

    // This is a simplified implementation
    // A full implementation would use AST analysis

    for (const file of request.files) {
      // Find data sources (API calls, user input, etc.)
      if (file.content.includes('request.body') ||
          file.content.includes('req.body') ||
          file.content.includes('params')) {
        nodes.push({
          id: `source-${file.path}`,
          type: 'source',
          file: file.path,
          dataType: 'unknown',
        });

        // Check if validated
        const hasValidation = file.content.includes('.parse(') ||
                             file.content.includes('.safeParse(');

        if (!hasValidation) {
          issues.push({
            type: 'unvalidated-path',
            path: [file.path],
            description: 'Data from external source is not validated',
            severity: 'error',
          });
        }
      }

      // Find type casts (potentially unsafe)
      const asCasts = file.content.matchAll(/as\s+(\w+)/g);
      for (const match of asCasts) {
        const castType = match[1];
        if (castType !== 'const' && castType !== 'unknown') {
          const line = this.getLineNumber(file.content, match.index || 0);
          issues.push({
            type: 'unsafe-cast',
            path: [file.path],
            description: `Type assertion 'as ${castType}' at line ${line} may be unsafe`,
            severity: 'warning',
          });
        }
      }

      // Find any boundaries
      const anyBoundaries = file.content.matchAll(/:\s*any\s*[,)=]/g);
      for (const match of anyBoundaries) {
        const line = this.getLineNumber(file.content, match.index || 0);
        issues.push({
          type: 'any-boundary',
          path: [file.path],
          description: `'any' type at line ${line} breaks type safety chain`,
          severity: 'warning',
        });
      }
    }

    return { nodes, edges, issues };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────

  private getLineNumber(content: string, index: number): number {
    return content.slice(0, index).split('\n').length;
  }

  private extractInterfaces(files: CodeFile[]): Map<string, { signature: string; content: string }> {
    const interfaces = new Map<string, { signature: string; content: string }>();

    for (const file of files) {
      const interfaceMatches = file.content.matchAll(
        /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?\s*\{([^}]*)\}/g
      );

      for (const match of interfaceMatches) {
        const name = match[1];
        const content = match[2];
        interfaces.set(name, {
          signature: `interface ${name}`,
          content,
        });
      }

      const typeMatches = file.content.matchAll(
        /(?:export\s+)?type\s+(\w+)\s*=\s*\{([^}]*)\}/g
      );

      for (const match of typeMatches) {
        const name = match[1];
        const content = match[2];
        interfaces.set(name, {
          signature: `type ${name}`,
          content,
        });
      }
    }

    return interfaces;
  }

  private extractFields(content: string): Map<string, string> {
    const fields = new Map<string, string>();

    const fieldMatches = content.matchAll(/(\w+)(\?)?\s*:\s*([^;,\n]+)/g);

    for (const match of fieldMatches) {
      const name = match[1];
      const optional = match[2] || '';
      const type = match[3].trim();
      fields.set(name, optional ? `${type}?` : type);
    }

    return fields;
  }

  private calculateSchemaScore(issues: SchemaIssue[], coveragePercent: number): number {
    let score = coveragePercent;

    // Deduct for issues
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    score -= errorCount * 10;
    score -= warningCount * 3;

    return Math.max(0, Math.min(100, score));
  }

  private generateSchemaRecommendations(
    issues: SchemaIssue[],
    coveragePercent: number
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (coveragePercent < 50) {
      recommendations.push(this.createRecommendation(
        'Increase Zod schema coverage',
        'Less than 50% of files use Zod validation. Add schemas to API boundaries.',
        { priority: 'high', effort: 'medium', impact: 'high', category: 'validation' }
      ));
    }

    const anyIssues = issues.filter(i => i.type === 'unsafe-any');
    if (anyIssues.length > 5) {
      recommendations.push(this.createRecommendation(
        'Reduce usage of `any` type',
        `Found ${anyIssues.length} usages of 'any'. Replace with proper types or 'unknown'.`,
        { priority: 'medium', effort: 'medium', impact: 'medium', category: 'type-safety' }
      ));
    }

    const missingValidation = issues.filter(i => i.type === 'missing-validation');
    if (missingValidation.length > 0) {
      recommendations.push(this.createRecommendation(
        'Add input validation to API endpoints',
        `${missingValidation.length} API files lack Zod validation. This is a security risk.`,
        { priority: 'critical', effort: 'medium', impact: 'high', category: 'security' }
      ));
    }

    return recommendations;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _dataAgent: DataAgent | null = null;

export function getDataAgent(): DataAgent {
  if (!_dataAgent) {
    _dataAgent = new DataAgent();
  }
  return _dataAgent;
}

export function resetDataAgent(): void {
  _dataAgent = null;
}
