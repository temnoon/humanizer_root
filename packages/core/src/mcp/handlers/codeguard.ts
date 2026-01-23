/**
 * CodeGuard Handlers
 *
 * MCP tool handlers for CodeGuard agents (architect, stylist, security, accessibility, data).
 * Each handler invokes the corresponding agent method and formats the result for MCP.
 */

import type { MCPResult } from '../types.js';
import type {
  ReviewArchitectureInput,
  SuggestPatternsInput,
  AnalyzeCouplingInput,
  AnalyzeComplexityInput,
  ReviewCodeStyleInput,
  ValidateNamingInput,
  CheckConsistencyInput,
  ScanVulnerabilitiesInput,
  ReviewSecretsInput,
  AuditAccessibilityInput,
  ValidateAriaInput,
  CheckContrastInput,
  ValidateSchemasInput,
  CheckCompatibilityInput,
  TraceDataFlowInput,
  FilesInput,
  ValidateStructureInput,
  PlanRefactoringInput,
  AuditPermissionsInput,
  ReviewAuthInput,
} from '../types.js';
import type {
  CodeFile,
  ArchitectureReviewRequest,
  StyleReviewRequest,
  SecurityScanRequest,
  A11yAuditRequest,
} from '../../houses/codeguard/types.js';
import {
  getArchitectAgent,
  getStylistAgent,
  getSecurityAgent,
  getAccessibilityAgent,
  getDataAgent,
} from '../../houses/codeguard/index.js';

// ═══════════════════════════════════════════════════════════════════
// RESULT HELPERS
// ═══════════════════════════════════════════════════════════════════

function jsonResult(data: unknown): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ARCHITECT HANDLERS
// ═══════════════════════════════════════════════════════════════════

export async function handleReviewArchitecture(args: ReviewArchitectureInput): Promise<MCPResult> {
  try {
    const architect = getArchitectAgent();
    
    const request: ArchitectureReviewRequest = {
      codebase: { files: args.files },
      focus: args.focus || 'patterns',
      reviewDepth: args.depth || 'deep',
    };
    
    const review = await architect.reviewArchitecture(request);
    return jsonResult(review);
  } catch (err) {
    return errorResult(`Architecture review failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleSuggestPatterns(args: SuggestPatternsInput): Promise<MCPResult> {
  try {
    const architect = getArchitectAgent();
    
    const patterns = await architect.suggestPatterns({
      context: args.context,
      problem: args.problem,
    });
    
    return jsonResult({ patterns });
  } catch (err) {
    return errorResult(`Pattern suggestion failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleDetectAntiPatterns(args: FilesInput): Promise<MCPResult> {
  try {
    const architect = getArchitectAgent();
    
    // Use the architect's review method focused on anti-patterns
    const review = await architect.reviewArchitecture({
      codebase: { files: args.files },
      focus: 'patterns',
      reviewDepth: 'deep',
    });
    
    return jsonResult({
      antiPatterns: review.antiPatterns,
      count: review.antiPatterns.length,
    });
  } catch (err) {
    return errorResult(`Anti-pattern detection failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleAnalyzeCoupling(args: AnalyzeCouplingInput): Promise<MCPResult> {
  try {
    const architect = getArchitectAgent();
    
    const review = await architect.reviewArchitecture({
      codebase: { files: args.files },
      focus: 'coupling',
      reviewDepth: 'deep',
    });
    
    return jsonResult(review.couplingAnalysis);
  } catch (err) {
    return errorResult(`Coupling analysis failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleAnalyzeComplexity(args: AnalyzeComplexityInput): Promise<MCPResult> {
  try {
    const architect = getArchitectAgent();

    const review = await architect.reviewArchitecture({
      codebase: { files: args.files },
      focus: 'complexity',
      reviewDepth: 'deep',
    });

    return jsonResult({
      overallComplexity: review.designQuality.complexity,
      technicalDebt: review.technicalDebt.filter(d =>
        d.description.toLowerCase().includes('complexity')
      ),
    });
  } catch (err) {
    return errorResult(`Complexity analysis failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleValidateStructure(args: ValidateStructureInput): Promise<MCPResult> {
  try {
    const architect = getArchitectAgent();

    const result = await architect.validateStructure({
      codebase: { files: args.files },
      constraints: args.constraints,
    });

    return jsonResult(result);
  } catch (err) {
    return errorResult(`Structure validation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handlePlanRefactoring(args: PlanRefactoringInput): Promise<MCPResult> {
  try {
    const architect = getArchitectAgent();

    const plan = await architect.planRefactoring({
      files: args.files,
      targetPattern: args.targetPattern,
      goals: args.goals,
    });

    return jsonResult(plan);
  } catch (err) {
    return errorResult(`Refactoring planning failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// STYLIST HANDLERS
// ═══════════════════════════════════════════════════════════════════

export async function handleReviewCodeStyle(args: ReviewCodeStyleInput): Promise<MCPResult> {
  try {
    const stylist = getStylistAgent();
    
    const request: StyleReviewRequest = {
      files: args.files,
      language: args.language,
      strictness: args.strictness || 'moderate',
    };
    
    const review = await stylist.reviewCodeStyle(request);
    return jsonResult(review);
  } catch (err) {
    return errorResult(`Code style review failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleValidateNaming(args: ValidateNamingInput): Promise<MCPResult> {
  try {
    const stylist = getStylistAgent();
    
    const review = await stylist.reviewCodeStyle({
      files: args.files,
      strictness: 'strict',
    });
    
    return jsonResult({
      namingIssues: review.namingIssues,
      count: review.namingIssues.length,
    });
  } catch (err) {
    return errorResult(`Naming validation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleCheckConsistency(args: CheckConsistencyInput): Promise<MCPResult> {
  try {
    const stylist = getStylistAgent();
    
    const review = await stylist.reviewCodeStyle({
      files: args.files,
      strictness: 'strict',
    });
    
    return jsonResult({
      consistencyIssues: review.consistencyIssues,
      count: review.consistencyIssues.length,
    });
  } catch (err) {
    return errorResult(`Consistency check failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SECURITY HANDLERS
// ═══════════════════════════════════════════════════════════════════

export async function handleScanVulnerabilities(args: ScanVulnerabilitiesInput): Promise<MCPResult> {
  try {
    const security = getSecurityAgent();
    
    const request: SecurityScanRequest = {
      codebase: { files: args.files },
      scanTypes: args.scanTypes,
      severity: args.severity || 'all',
    };
    
    const report = await security.scanVulnerabilities(request);
    return jsonResult(report);
  } catch (err) {
    return errorResult(`Vulnerability scan failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleReviewSecrets(args: ReviewSecretsInput): Promise<MCPResult> {
  try {
    const security = getSecurityAgent();
    
    const report = await security.scanVulnerabilities({
      codebase: { files: args.files },
      scanTypes: ['secrets'],
    });
    
    return jsonResult({
      secretsFound: report.secretsFound,
      count: report.secretsFound.length,
      riskLevel: report.overallRisk,
    });
  } catch (err) {
    return errorResult(`Secrets review failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleAuditCrypto(args: FilesInput): Promise<MCPResult> {
  try {
    const security = getSecurityAgent();

    const report = await security.scanVulnerabilities({
      codebase: { files: args.files },
      scanTypes: ['crypto'],
    });

    return jsonResult({
      cryptoIssues: report.cryptoIssues,
      count: report.cryptoIssues.length,
    });
  } catch (err) {
    return errorResult(`Crypto audit failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleAuditPermissions(args: AuditPermissionsInput): Promise<MCPResult> {
  try {
    const security = getSecurityAgent();

    const result = await security.validatePermissions({
      files: args.files,
    });

    return jsonResult(result);
  } catch (err) {
    return errorResult(`Permission audit failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleReviewAuth(args: ReviewAuthInput): Promise<MCPResult> {
  try {
    const security = getSecurityAgent();

    const result = await security.reviewAuth({
      files: args.files,
    });

    return jsonResult(result);
  } catch (err) {
    return errorResult(`Auth review failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// ACCESSIBILITY HANDLERS
// ═══════════════════════════════════════════════════════════════════

export async function handleAuditAccessibility(args: AuditAccessibilityInput): Promise<MCPResult> {
  try {
    const accessibility = getAccessibilityAgent();
    
    const request: A11yAuditRequest = {
      components: args.components,
      standards: args.standard || 'WCAG-2.1-AA',
      auditDepth: args.depth || 'comprehensive',
    };
    
    const report = await accessibility.auditAccessibility(request);
    return jsonResult(report);
  } catch (err) {
    return errorResult(`Accessibility audit failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleValidateAria(args: ValidateAriaInput): Promise<MCPResult> {
  try {
    const accessibility = getAccessibilityAgent();
    
    const report = await accessibility.auditAccessibility({
      components: args.components,
      auditDepth: 'comprehensive',
    });
    
    return jsonResult({
      ariaIssues: report.ariaIssues,
      count: report.ariaIssues.length,
    });
  } catch (err) {
    return errorResult(`ARIA validation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleCheckContrast(args: CheckContrastInput): Promise<MCPResult> {
  try {
    const accessibility = getAccessibilityAgent();
    
    const report = await accessibility.auditAccessibility({
      components: args.components,
      auditDepth: 'comprehensive',
    });
    
    return jsonResult({
      contrastIssues: report.contrastIssues,
      count: report.contrastIssues.length,
    });
  } catch (err) {
    return errorResult(`Contrast check failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// DATA HANDLERS
// ═══════════════════════════════════════════════════════════════════

export async function handleValidateSchemas(args: ValidateSchemasInput): Promise<MCPResult> {
  try {
    const data = getDataAgent();
    
    const report = await data.validateSchemas({
      files: args.files,
    });
    
    return jsonResult(report);
  } catch (err) {
    return errorResult(`Schema validation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleCheckCompatibility(args: CheckCompatibilityInput): Promise<MCPResult> {
  try {
    const data = getDataAgent();
    
    const report = await data.checkCompatibility({
      before: args.baselineFiles || [],
      after: args.files,
    });
    
    return jsonResult(report);
  } catch (err) {
    return errorResult(`Compatibility check failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleTraceDataFlow(args: TraceDataFlowInput): Promise<MCPResult> {
  try {
    const data = getDataAgent();
    
    const graph = await data.traceDataFlow({
      entryPoint: args.entryPoint,
      files: args.files,
      maxDepth: args.maxDepth || 10,
    });
    
    return jsonResult(graph);
  } catch (err) {
    return errorResult(`Data flow trace failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER REGISTRY
// ═══════════════════════════════════════════════════════════════════

export const CODEGUARD_HANDLERS: Record<string, (args: unknown) => Promise<MCPResult>> = {
  // Architect
  review_architecture: handleReviewArchitecture as (args: unknown) => Promise<MCPResult>,
  suggest_patterns: handleSuggestPatterns as (args: unknown) => Promise<MCPResult>,
  detect_anti_patterns: handleDetectAntiPatterns as (args: unknown) => Promise<MCPResult>,
  analyze_coupling: handleAnalyzeCoupling as (args: unknown) => Promise<MCPResult>,
  analyze_complexity: handleAnalyzeComplexity as (args: unknown) => Promise<MCPResult>,
  validate_structure: handleValidateStructure as (args: unknown) => Promise<MCPResult>,
  plan_refactoring: handlePlanRefactoring as (args: unknown) => Promise<MCPResult>,

  // Stylist
  review_code_style: handleReviewCodeStyle as (args: unknown) => Promise<MCPResult>,
  validate_naming: handleValidateNaming as (args: unknown) => Promise<MCPResult>,
  check_consistency: handleCheckConsistency as (args: unknown) => Promise<MCPResult>,

  // Security
  scan_vulnerabilities: handleScanVulnerabilities as (args: unknown) => Promise<MCPResult>,
  review_secrets: handleReviewSecrets as (args: unknown) => Promise<MCPResult>,
  audit_crypto: handleAuditCrypto as (args: unknown) => Promise<MCPResult>,
  audit_permissions: handleAuditPermissions as (args: unknown) => Promise<MCPResult>,
  review_auth: handleReviewAuth as (args: unknown) => Promise<MCPResult>,

  // Accessibility
  audit_accessibility: handleAuditAccessibility as (args: unknown) => Promise<MCPResult>,
  validate_aria: handleValidateAria as (args: unknown) => Promise<MCPResult>,
  check_contrast: handleCheckContrast as (args: unknown) => Promise<MCPResult>,

  // Data
  validate_schemas: handleValidateSchemas as (args: unknown) => Promise<MCPResult>,
  check_compatibility: handleCheckCompatibility as (args: unknown) => Promise<MCPResult>,
  trace_data_flow: handleTraceDataFlow as (args: unknown) => Promise<MCPResult>,
};
