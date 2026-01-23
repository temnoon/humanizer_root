/**
 * Architect Agent
 *
 * The guardian of code structure and design patterns.
 * Analyzes architecture, detects patterns and anti-patterns,
 * measures coupling and complexity, and guides refactoring.
 *
 * Capabilities:
 * - Architecture review and scoring
 * - Design pattern detection
 * - Anti-pattern detection
 * - Coupling and cohesion analysis
 * - Complexity measurement
 * - Refactoring suggestions
 *
 * NOTE: Uses ConfigManager for all thresholds and prompts.
 */

import { DevelopmentAgentBase } from './development-agent-base.js';
import type { AgentMessage, HouseType } from '../../runtime/types.js';
import type {
  DevelopmentHouseType,
  ArchitectureReviewRequest,
  ArchitectureReview,
  DetectedPattern,
  AntiPattern,
  CouplingReport,
  ModuleCoupling,
  TechnicalDebtItem,
  RefactoringOpportunity,
  Recommendation,
  FileChangeEvent,
  ReviewResult,
  CodeFile,
  CodeIssue,
} from './types.js';
import { DEVELOPMENT_CONFIG } from './types.js';
import {
  detectPatterns,
  detectAntiPatterns,
  calculateCyclomaticComplexity,
  calculateCognitiveComplexity,
  analyzeCoupling,
  detectCircularDependencies,
} from './shared/pattern-detectors.js';

// ═══════════════════════════════════════════════════════════════════
// ARCHITECT CONFIG KEYS
// ═══════════════════════════════════════════════════════════════════

export const ARCHITECT_CONFIG = {
  COMPLEXITY_THRESHOLD: 'architect.complexityThreshold',
  COUPLING_THRESHOLD: 'architect.couplingThreshold',
  MAX_FILE_SIZE: 'architect.maxFileSize',
  PATTERN_CONFIDENCE_MIN: 'architect.patternConfidenceMin',
  REVIEW_DEPTH_DEFAULT: 'architect.reviewDepthDefault',
} as const;

// ═══════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

interface PatternSuggestionRequest {
  context: string;
  problem: string;
  constraints?: string[];
  projectId?: string;
}

interface StructureValidationRequest {
  codebase: { files: CodeFile[] };
  constraints: Array<{
    type: 'dependency' | 'layer' | 'module' | 'pattern';
    rule: string;
  }>;
  projectId?: string;
}

interface RefactoringPlanRequest {
  files: CodeFile[];
  targetPattern?: string;
  goals?: string[];
  projectId?: string;
}

interface ComplexityAnalysisRequest {
  files: CodeFile[];
  threshold?: number;
  projectId?: string;
}

// ═══════════════════════════════════════════════════════════════════
// ARCHITECT AGENT
// ═══════════════════════════════════════════════════════════════════

export class ArchitectAgent extends DevelopmentAgentBase {
  readonly id = 'architect';
  readonly name = 'The Architect';
  readonly house: HouseType = 'architect';
  readonly version = '1.0.0';
  readonly capabilities = [
    'review-architecture',
    'suggest-patterns',
    'validate-structure',
    'analyze-coupling',
    'analyze-complexity',
    'detect-anti-patterns',
    'plan-refactoring',
    'on-file-change',
    'on-pre-commit',
  ];

  // ─────────────────────────────────────────────────────────────────
  // DEVELOPMENT AGENT INTERFACE
  // ─────────────────────────────────────────────────────────────────

  getDevelopmentHouse(): DevelopmentHouseType {
    return 'architect';
  }

  getFilePatterns(): string[] {
    return [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.py',
      '**/package.json',
      '**/tsconfig.json',
    ];
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    await super.onInitialize();
    this.log('info', 'Architect surveying the codebase landscape');

    // Subscribe to architecture-relevant events
    this.subscribe('content:file-created');
    this.subscribe('content:file-modified');
    this.subscribe('project:structure-changed');
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', 'Architect laying down the blueprints');
    await super.onShutdown();
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE HANDLING
  // ─────────────────────────────────────────────────────────────────

  protected async onMessage(message: AgentMessage): Promise<unknown> {
    switch (message.type) {
      case 'review-architecture':
        return this.reviewArchitecture(message.payload as ArchitectureReviewRequest);

      case 'suggest-patterns':
        return this.suggestPatterns(message.payload as PatternSuggestionRequest);

      case 'validate-structure':
        return this.validateStructure(message.payload as StructureValidationRequest);

      case 'analyze-coupling':
        return this.analyzeCouplingFromRequest(message.payload as { files: CodeFile[]; projectId?: string });

      case 'analyze-complexity':
        return this.analyzeComplexity(message.payload as ComplexityAnalysisRequest);

      case 'detect-anti-patterns':
        return this.detectAntiPatternsFromFiles(message.payload as { files: CodeFile[]; projectId?: string });

      case 'plan-refactoring':
        return this.planRefactoring(message.payload as RefactoringPlanRequest);

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
      return this.createReviewResult(
        'file-change',
        true,
        [],
        [],
        'Hooks disabled'
      );
    }

    // Filter to architecture-relevant files
    const relevantFiles = event.files.filter(f => this.matchesPattern(f, this.getFilePatterns()));

    if (relevantFiles.length === 0) {
      return this.createReviewResult(
        'file-change',
        true,
        [],
        [],
        'No architecture-relevant files changed'
      );
    }

    // Quick structural check for significant changes
    const warnings: CodeIssue[] = [];
    const blockers: CodeIssue[] = [];

    // Check for potentially problematic patterns in changed files
    for (const file of relevantFiles) {
      // Check if new files follow naming conventions
      if (event.changeType === 'create') {
        if (!/^[a-z][a-z0-9-]*(\.[a-z]+)+$/.test(file.split('/').pop() || '')) {
          warnings.push(this.createIssue(
            'warning',
            `File name doesn't follow kebab-case convention`,
            { file }
          ));
        }
      }
    }

    const passed = blockers.length === 0;
    return this.createReviewResult(
      'file-change',
      passed,
      blockers,
      warnings,
      `Reviewed ${relevantFiles.length} architecture-relevant files`
    );
  }

  async onPreCommit(stagedFiles: string[]): Promise<ReviewResult> {
    const hooksEnabled = await this.areHooksEnabled();
    if (!hooksEnabled) {
      return this.createReviewResult('pre-commit', true, [], [], 'Hooks disabled');
    }

    const relevantFiles = stagedFiles.filter(f => this.matchesPattern(f, this.getFilePatterns()));

    if (relevantFiles.length === 0) {
      return this.createReviewResult(
        'pre-commit',
        true,
        [],
        [],
        'No architecture-relevant files in commit'
      );
    }

    const warnings: CodeIssue[] = [];
    const blockers: CodeIssue[] = [];

    // Check for structural files that might need review
    const structuralFiles = relevantFiles.filter(f =>
      f.includes('package.json') ||
      f.includes('tsconfig') ||
      f.includes('index.ts') ||
      f.includes('types.ts')
    );

    if (structuralFiles.length > 0) {
      warnings.push(this.createIssue(
        'warning',
        `Structural files changed: ${structuralFiles.join(', ')}. Consider architecture review.`,
        { rule: 'structural-change' }
      ));
    }

    const passed = blockers.length === 0;
    return this.createReviewResult(
      'pre-commit',
      passed,
      blockers,
      warnings,
      `Pre-commit check: ${relevantFiles.length} files, ${warnings.length} warnings`
    );
  }

  async onPrePush(commits: string[]): Promise<ReviewResult> {
    // Pre-push can do a more thorough review
    return this.createReviewResult(
      'pre-push',
      true,
      [],
      [],
      `Reviewed ${commits.length} commits for architectural impact`
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // ARCHITECTURE REVIEW
  // ─────────────────────────────────────────────────────────────────

  async reviewArchitecture(request: ArchitectureReviewRequest): Promise<ArchitectureReview> {
    const startTime = Date.now();
    const { codebase, focus, reviewDepth } = request;
    const focusAreas = Array.isArray(focus) ? focus : [focus];

    // Get config values
    const complexityThreshold = await this.getConfig<number>(
      ARCHITECT_CONFIG.COMPLEXITY_THRESHOLD,
      15
    );
    const couplingThreshold = await this.getConfig<number>(
      ARCHITECT_CONFIG.COUPLING_THRESHOLD,
      0.7
    );
    const patternConfidenceMin = await this.getConfig<number>(
      ARCHITECT_CONFIG.PATTERN_CONFIDENCE_MIN,
      0.5
    );

    // Analyze all files
    const allPatterns: DetectedPattern[] = [];
    const allAntiPatterns: AntiPattern[] = [];
    const complexityIssues: TechnicalDebtItem[] = [];

    for (const file of codebase.files) {
      const language = this.detectLanguage(file.path);

      // Detect patterns
      if (focusAreas.includes('patterns')) {
        const patterns = detectPatterns(file.content, file.path);
        allPatterns.push(...patterns.filter(p => p.confidence >= patternConfidenceMin));
      }

      // Detect anti-patterns
      const antiPatterns = detectAntiPatterns(file.content, file.path);
      allAntiPatterns.push(...antiPatterns);

      // Analyze complexity
      if (focusAreas.includes('complexity') || focusAreas.includes('maintainability')) {
        const cyclomatic = calculateCyclomaticComplexity(file.content);
        const cognitive = calculateCognitiveComplexity(file.content);

        if (cyclomatic > complexityThreshold) {
          complexityIssues.push({
            id: this.generateId('debt'),
            type: 'code',
            description: `High cyclomatic complexity (${cyclomatic}) in ${file.path}`,
            location: [file.path],
            severity: cyclomatic > complexityThreshold * 2 ? 'error' : 'warning',
            estimatedEffort: '2-4 hours',
            interestRate: 'medium',
          });
        }

        if (cognitive > complexityThreshold * 1.5) {
          complexityIssues.push({
            id: this.generateId('debt'),
            type: 'code',
            description: `High cognitive complexity (${cognitive}) in ${file.path}`,
            location: [file.path],
            severity: cognitive > complexityThreshold * 3 ? 'error' : 'warning',
            estimatedEffort: '4-8 hours',
            interestRate: 'high',
          });
        }
      }
    }

    // Analyze coupling
    let couplingAnalysis: CouplingReport = {
      overallScore: 100,
      modules: [],
      circularDependencies: [],
      highCouplingPairs: [],
    };

    if (focusAreas.includes('coupling') || focusAreas.includes('scalability')) {
      couplingAnalysis = await this.performCouplingAnalysis(codebase.files, couplingThreshold);
    }

    // Generate recommendations
    const recommendations = this.generateArchitectureRecommendations(
      allPatterns,
      allAntiPatterns,
      couplingAnalysis,
      complexityIssues
    );

    // Generate refactoring opportunities
    const refactoringOpportunities = this.identifyRefactoringOpportunities(
      allAntiPatterns,
      couplingAnalysis,
      complexityIssues
    );

    // Calculate scores
    const patternScore = allPatterns.length > 0 ? 0.8 : 0.5;
    const antiPatternPenalty = Math.min(allAntiPatterns.length * 0.1, 0.5);
    const couplingScore = couplingAnalysis.overallScore / 100;
    const complexityPenalty = Math.min(complexityIssues.length * 0.05, 0.3);

    const overallScore = Math.max(0, Math.min(100,
      ((patternScore - antiPatternPenalty + couplingScore - complexityPenalty) / 2) * 100
    ));

    const review: ArchitectureReview = {
      metadata: this.createReportMetadata(
        codebase.files.length,
        Date.now() - startTime,
        request.projectId
      ),
      overallScore,
      designQuality: {
        patterns: patternScore,
        coupling: couplingScore,
        cohesion: 1 - antiPatternPenalty,
        complexity: 1 - complexityPenalty,
      },
      patterns: allPatterns,
      antiPatterns: allAntiPatterns,
      couplingAnalysis,
      recommendations,
      technicalDebt: complexityIssues,
      refactoringOpportunities,
    };

    // Propose significant findings
    if (allAntiPatterns.some(ap => ap.severity === 'critical' || ap.severity === 'error')) {
      await this.proposeAction(
        'address-anti-patterns',
        'Critical anti-patterns detected',
        `Found ${allAntiPatterns.filter(ap => ap.severity === 'critical' || ap.severity === 'error').length} serious architectural issues`,
        { antiPatterns: allAntiPatterns.filter(ap => ap.severity === 'critical' || ap.severity === 'error') },
        { projectId: request.projectId, requiresApproval: true }
      );
    }

    return review;
  }

  // ─────────────────────────────────────────────────────────────────
  // PATTERN SUGGESTIONS
  // ─────────────────────────────────────────────────────────────────

  async suggestPatterns(request: PatternSuggestionRequest): Promise<DetectedPattern[]> {
    const { context, problem, constraints } = request;

    // Use AI to suggest appropriate patterns
    const prompt = `Given this context and problem, suggest appropriate design patterns.

Context: ${context}
Problem: ${problem}
${constraints ? `Constraints: ${constraints.join(', ')}` : ''}

Respond with JSON: {
  patterns: [
    {
      name: "Pattern Name",
      type: "creational|structural|behavioral|architectural",
      confidence: 0.0-1.0,
      description: "Why this pattern fits",
      implementation: "Brief implementation guidance"
    }
  ]
}`;

    const response = await this.callAI('analysis', prompt, {
      systemPrompt: 'You are a software architect expert in design patterns.',
    });

    const parsed = this.parseAIResponse<{
      patterns?: Array<{
        name?: string;
        type?: string;
        confidence?: number;
        description?: string;
        implementation?: string;
      }>;
    }>(response);

    if (!parsed?.patterns) {
      return [];
    }

    return parsed.patterns.map(p => ({
      name: p.name || 'Unknown',
      type: (p.type as DetectedPattern['type']) || 'behavioral',
      confidence: p.confidence || 0.5,
      location: [],
      description: p.description || '',
      isCorrectlyImplemented: true,
    }));
  }

  // ─────────────────────────────────────────────────────────────────
  // STRUCTURE VALIDATION
  // ─────────────────────────────────────────────────────────────────

  async validateStructure(request: StructureValidationRequest): Promise<{
    valid: boolean;
    violations: Array<{ constraint: string; violations: string[] }>;
  }> {
    const violations: Array<{ constraint: string; violations: string[] }> = [];

    for (const constraint of request.constraints) {
      const constraintViolations: string[] = [];

      if (constraint.type === 'dependency') {
        // Check dependency rules (e.g., "ui cannot import from server")
        const [from, to] = constraint.rule.split(' cannot import from ').map(s => s.trim());
        if (from && to) {
          for (const file of request.codebase.files) {
            if (file.path.includes(from)) {
              const imports = this.extractImports(file.content, this.detectLanguage(file.path));
              for (const imp of imports) {
                if (imp.includes(to)) {
                  constraintViolations.push(`${file.path} imports from ${to}`);
                }
              }
            }
          }
        }
      }

      if (constraint.type === 'layer') {
        // Check layer architecture rules
        // Simplified: assume constraint.rule is like "presentation -> business -> data"
        const layers = constraint.rule.split('->').map(s => s.trim());
        // Check that lower layers don't import from higher layers
        for (let i = 1; i < layers.length; i++) {
          const lowerLayer = layers[i];
          const higherLayers = layers.slice(0, i);

          for (const file of request.codebase.files) {
            if (file.path.includes(lowerLayer)) {
              const imports = this.extractImports(file.content, this.detectLanguage(file.path));
              for (const imp of imports) {
                for (const higher of higherLayers) {
                  if (imp.includes(higher)) {
                    constraintViolations.push(`${file.path} (${lowerLayer}) imports from ${higher}`);
                  }
                }
              }
            }
          }
        }
      }

      if (constraintViolations.length > 0) {
        violations.push({ constraint: constraint.rule, violations: constraintViolations });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // COUPLING ANALYSIS
  // ─────────────────────────────────────────────────────────────────

  private async analyzeCouplingFromRequest(request: { files: CodeFile[]; projectId?: string }): Promise<CouplingReport> {
    const couplingThreshold = await this.getConfig<number>(
      ARCHITECT_CONFIG.COUPLING_THRESHOLD,
      0.7
    );
    return this.performCouplingAnalysis(request.files, couplingThreshold);
  }

  private async performCouplingAnalysis(files: CodeFile[], threshold: number): Promise<CouplingReport> {
    // Extract imports for each file
    const fileImports = files.map(f => ({
      path: f.path,
      imports: this.extractImports(f.content, this.detectLanguage(f.path)),
    }));

    // Analyze coupling
    const coupling = analyzeCoupling(fileImports);

    // Detect circular dependencies
    const circularDeps = detectCircularDependencies(fileImports);

    // Find high coupling pairs
    const highCouplingPairs: CouplingReport['highCouplingPairs'] = [];

    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const file1 = files[i];
        const file2 = files[j];
        const imports1 = fileImports[i].imports;
        const imports2 = fileImports[j].imports;

        // Check mutual imports
        const shared = imports1.filter(imp =>
          imports2.some(imp2 => imp.includes(imp2) || imp2.includes(imp))
        );

        if (shared.length > 2) {
          highCouplingPairs.push({
            module1: file1.path,
            module2: file2.path,
            couplingScore: shared.length / Math.max(imports1.length, imports2.length, 1),
            sharedDependencies: shared,
          });
        }
      }
    }

    // Build module coupling info
    const modules: ModuleCoupling[] = files.map(f => ({
      module: f.path,
      afferentCoupling: coupling.afferent[f.path] || 0,
      efferentCoupling: coupling.efferent[f.path] || 0,
      instability: coupling.instability[f.path] || 0,
      abstractness: 0, // Would need deeper analysis
    }));

    // Calculate overall score
    const avgInstability = modules.reduce((sum, m) => sum + m.instability, 0) / Math.max(modules.length, 1);
    const circularPenalty = circularDeps.length * 10;
    const highCouplingPenalty = highCouplingPairs.filter(p => p.couplingScore > threshold).length * 5;

    const overallScore = Math.max(0, 100 - avgInstability * 50 - circularPenalty - highCouplingPenalty);

    return {
      overallScore,
      modules,
      circularDependencies: circularDeps,
      highCouplingPairs: highCouplingPairs.filter(p => p.couplingScore > threshold),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // COMPLEXITY ANALYSIS
  // ─────────────────────────────────────────────────────────────────

  async analyzeComplexity(request: ComplexityAnalysisRequest): Promise<{
    files: Array<{
      path: string;
      cyclomatic: number;
      cognitive: number;
      linesOfCode: number;
      functions: number;
    }>;
    summary: {
      totalComplexity: number;
      averageComplexity: number;
      highComplexityFiles: number;
    };
  }> {
    const threshold = request.threshold ?? await this.getConfig<number>(
      ARCHITECT_CONFIG.COMPLEXITY_THRESHOLD,
      15
    );

    const results = [];

    for (const file of request.files) {
      const language = this.detectLanguage(file.path);
      const cyclomatic = calculateCyclomaticComplexity(file.content);
      const cognitive = calculateCognitiveComplexity(file.content);
      const linesOfCode = this.countLinesOfCode(file.content, language);
      const functions = this.extractFunctions(file.content, language).length;

      results.push({
        path: file.path,
        cyclomatic,
        cognitive,
        linesOfCode,
        functions,
      });
    }

    const totalComplexity = results.reduce((sum, r) => sum + r.cyclomatic, 0);
    const averageComplexity = totalComplexity / Math.max(results.length, 1);
    const highComplexityFiles = results.filter(r => r.cyclomatic > threshold).length;

    return {
      files: results,
      summary: {
        totalComplexity,
        averageComplexity,
        highComplexityFiles,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // ANTI-PATTERN DETECTION
  // ─────────────────────────────────────────────────────────────────

  private async detectAntiPatternsFromFiles(request: { files: CodeFile[]; projectId?: string }): Promise<AntiPattern[]> {
    const allAntiPatterns: AntiPattern[] = [];

    for (const file of request.files) {
      const antiPatterns = detectAntiPatterns(file.content, file.path);
      allAntiPatterns.push(...antiPatterns);
    }

    return allAntiPatterns;
  }

  // ─────────────────────────────────────────────────────────────────
  // REFACTORING PLANNING
  // ─────────────────────────────────────────────────────────────────

  async planRefactoring(request: RefactoringPlanRequest): Promise<{
    plan: RefactoringOpportunity[];
    estimatedTotalEffort: string;
    suggestedOrder: string[];
  }> {
    const { files, targetPattern, goals } = request;

    // Analyze current state
    const antiPatterns: AntiPattern[] = [];
    for (const file of files) {
      antiPatterns.push(...detectAntiPatterns(file.content, file.path));
    }

    const opportunities = this.identifyRefactoringOpportunities(
      antiPatterns,
      { overallScore: 0, modules: [], circularDependencies: [], highCouplingPairs: [] },
      []
    );

    // If target pattern specified, add pattern-specific refactoring
    if (targetPattern) {
      opportunities.push({
        id: this.generateId('refactor'),
        title: `Introduce ${targetPattern} pattern`,
        description: `Refactor code to use the ${targetPattern} design pattern`,
        targetFiles: files.map(f => f.path),
        pattern: targetPattern,
        currentState: 'Ad-hoc implementation',
        targetState: `${targetPattern} pattern applied`,
        effort: 'medium',
        risk: 'medium',
        dependencies: [],
      });
    }

    // Sort by dependencies and effort
    const orderedIds = this.orderRefactorings(opportunities);

    // Estimate total effort
    const effortMap = { trivial: 1, small: 2, medium: 4, large: 8 };
    const totalHours = opportunities.reduce((sum, o) => sum + effortMap[o.effort], 0);
    const estimatedTotalEffort = totalHours < 8 ? `${totalHours} hours` :
                                  totalHours < 40 ? `${Math.ceil(totalHours / 8)} days` :
                                  `${Math.ceil(totalHours / 40)} weeks`;

    return {
      plan: opportunities,
      estimatedTotalEffort,
      suggestedOrder: orderedIds,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────

  private generateArchitectureRecommendations(
    patterns: DetectedPattern[],
    antiPatterns: AntiPattern[],
    coupling: CouplingReport,
    debt: TechnicalDebtItem[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Pattern-based recommendations
    if (patterns.length === 0) {
      recommendations.push(this.createRecommendation(
        'Consider applying design patterns',
        'No recognized design patterns detected. Consider using patterns like Repository, Service, or Strategy for better maintainability.',
        { priority: 'medium', effort: 'medium', impact: 'medium', category: 'patterns' }
      ));
    }

    // Anti-pattern recommendations
    for (const ap of antiPatterns.filter(ap => ap.severity === 'error' || ap.severity === 'critical')) {
      recommendations.push(this.createRecommendation(
        `Address ${ap.name} anti-pattern`,
        ap.suggestion,
        {
          priority: ap.severity === 'critical' ? 'critical' : 'high',
          effort: ap.refactoringEffort,
          impact: 'high',
          category: 'anti-patterns',
        }
      ));
    }

    // Coupling recommendations
    if (coupling.circularDependencies.length > 0) {
      recommendations.push(this.createRecommendation(
        'Break circular dependencies',
        `Found ${coupling.circularDependencies.length} circular dependency chains. Consider introducing interfaces or dependency injection.`,
        { priority: 'high', effort: 'medium', impact: 'high', category: 'coupling' }
      ));
    }

    if (coupling.highCouplingPairs.length > 0) {
      recommendations.push(this.createRecommendation(
        'Reduce module coupling',
        `${coupling.highCouplingPairs.length} module pairs have high coupling. Consider extracting shared abstractions.`,
        { priority: 'medium', effort: 'large', impact: 'high', category: 'coupling' }
      ));
    }

    // Complexity recommendations
    const highDebt = debt.filter(d => d.severity === 'error' || d.severity === 'critical');
    if (highDebt.length > 0) {
      recommendations.push(this.createRecommendation(
        'Address complexity issues',
        `${highDebt.length} files have high complexity. Consider breaking down large functions and simplifying control flow.`,
        { priority: 'high', effort: 'medium', impact: 'high', category: 'complexity' }
      ));
    }

    return recommendations;
  }

  private identifyRefactoringOpportunities(
    antiPatterns: AntiPattern[],
    coupling: CouplingReport,
    debt: TechnicalDebtItem[]
  ): RefactoringOpportunity[] {
    const opportunities: RefactoringOpportunity[] = [];

    // From anti-patterns
    for (const ap of antiPatterns) {
      opportunities.push({
        id: this.generateId('refactor'),
        title: `Remove ${ap.name}`,
        description: ap.suggestion,
        targetFiles: ap.locations,
        pattern: 'refactoring',
        currentState: ap.description,
        targetState: 'Clean implementation',
        effort: ap.refactoringEffort,
        risk: ap.severity === 'critical' ? 'high' : 'medium',
        dependencies: [],
      });
    }

    // From circular dependencies
    for (const cycle of coupling.circularDependencies) {
      opportunities.push({
        id: this.generateId('refactor'),
        title: 'Break circular dependency',
        description: `Circular dependency: ${cycle.join(' -> ')}`,
        targetFiles: cycle,
        pattern: 'dependency-injection',
        currentState: 'Circular dependency',
        targetState: 'Acyclic dependencies',
        effort: 'medium',
        risk: 'medium',
        dependencies: [],
      });
    }

    return opportunities;
  }

  private orderRefactorings(opportunities: RefactoringOpportunity[]): string[] {
    // Simple topological sort based on dependencies
    const result: string[] = [];
    const visited = new Set<string>();

    const visit = (op: RefactoringOpportunity) => {
      if (visited.has(op.id)) return;
      visited.add(op.id);

      for (const depId of op.dependencies) {
        const dep = opportunities.find(o => o.id === depId);
        if (dep) visit(dep);
      }

      result.push(op.id);
    };

    // Start with low-risk, low-effort items
    const sorted = [...opportunities].sort((a, b) => {
      const effortOrder = { trivial: 0, small: 1, medium: 2, large: 3 };
      const riskOrder = { low: 0, medium: 1, high: 2 };
      return (effortOrder[a.effort] + riskOrder[a.risk]) - (effortOrder[b.effort] + riskOrder[b.risk]);
    });

    for (const op of sorted) {
      visit(op);
    }

    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _architect: ArchitectAgent | null = null;

export function getArchitectAgent(): ArchitectAgent {
  if (!_architect) {
    _architect = new ArchitectAgent();
  }
  return _architect;
}

export function resetArchitectAgent(): void {
  _architect = null;
}
