/**
 * Development House Agents - Shared Types
 *
 * Type definitions for code development assistance agents:
 * - Architect: Code architecture and design patterns
 * - Stylist: Code style and conventions
 * - Security: Security audits and vulnerability scanning
 * - Accessibility: A11y compliance and WCAG validation
 */

// ═══════════════════════════════════════════════════════════════════
// COMMON TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Development agent category (CodeGuard Council)
 * These agents enforce code quality standards during development.
 */
export type DevelopmentHouseType = 'architect' | 'stylist' | 'security' | 'accessibility' | 'data';

/**
 * Severity levels for issues
 */
export type Severity = 'info' | 'warning' | 'error' | 'critical';

/**
 * File representation for analysis
 */
export interface CodeFile {
  path: string;
  content: string;
  language?: string;
  size?: number;
}

/**
 * File tree for architecture analysis
 */
export interface FileTree {
  files: CodeFile[];
  rootPath?: string;
  excludePatterns?: string[];
}

/**
 * Generic issue type used across agents
 */
export interface CodeIssue {
  id: string;
  severity: Severity;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  rule?: string;
  suggestion?: string;
  autoFixable?: boolean;
}

/**
 * Generic recommendation
 */
export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  effort: 'trivial' | 'small' | 'medium' | 'large';
  impact: 'low' | 'medium' | 'high';
  category: string;
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  generatedAt: string;
  agentId: string;
  agentVersion: string;
  analysisTimeMs: number;
  filesAnalyzed: number;
  projectId?: string;
}

// ═══════════════════════════════════════════════════════════════════
// ARCHITECT TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Architecture review focus areas
 */
export type ArchitectureFocus =
  | 'patterns'
  | 'coupling'
  | 'cohesion'
  | 'scalability'
  | 'maintainability'
  | 'testability'
  | 'complexity';

/**
 * Detected design pattern
 */
export interface DetectedPattern {
  name: string;
  type: 'creational' | 'structural' | 'behavioral' | 'architectural';
  confidence: number;
  location: string[];
  description: string;
  isCorrectlyImplemented: boolean;
  issues?: string[];
}

/**
 * Anti-pattern detection result
 */
export interface AntiPattern {
  name: string;
  severity: Severity;
  description: string;
  locations: string[];
  impact: string;
  suggestion: string;
  refactoringEffort: 'trivial' | 'small' | 'medium' | 'large';
}

/**
 * Coupling analysis between modules
 */
export interface CouplingReport {
  overallScore: number; // 0-100, higher = less coupled (better)
  modules: ModuleCoupling[];
  circularDependencies: string[][];
  highCouplingPairs: Array<{
    module1: string;
    module2: string;
    couplingScore: number;
    sharedDependencies: string[];
  }>;
}

export interface ModuleCoupling {
  module: string;
  afferentCoupling: number;  // incoming dependencies
  efferentCoupling: number;  // outgoing dependencies
  instability: number;       // efferent / (afferent + efferent)
  abstractness: number;      // abstract elements / total elements
}

/**
 * Architecture review request
 */
export interface ArchitectureReviewRequest {
  codebase: FileTree;
  focus: ArchitectureFocus | ArchitectureFocus[];
  constraints?: ArchitecturalConstraint[];
  reviewDepth: 'surface' | 'deep' | 'comprehensive';
  projectId?: string;
}

export interface ArchitecturalConstraint {
  type: 'dependency' | 'layer' | 'module' | 'pattern';
  rule: string;
  severity: Severity;
}

/**
 * Architecture review result
 */
export interface ArchitectureReview {
  metadata: ReportMetadata;
  overallScore: number;
  designQuality: {
    patterns: number;
    coupling: number;
    cohesion: number;
    complexity: number;
  };
  patterns: DetectedPattern[];
  antiPatterns: AntiPattern[];
  couplingAnalysis: CouplingReport;
  recommendations: Recommendation[];
  technicalDebt: TechnicalDebtItem[];
  refactoringOpportunities: RefactoringOpportunity[];
}

export interface TechnicalDebtItem {
  id: string;
  type: 'code' | 'architecture' | 'dependency' | 'documentation';
  description: string;
  location: string[];
  severity: Severity;
  estimatedEffort: string;
  interestRate: 'low' | 'medium' | 'high'; // How fast it accumulates
}

export interface RefactoringOpportunity {
  id: string;
  title: string;
  description: string;
  targetFiles: string[];
  pattern: string;
  currentState: string;
  targetState: string;
  effort: 'trivial' | 'small' | 'medium' | 'large';
  risk: 'low' | 'medium' | 'high';
  dependencies: string[];
}

// ═══════════════════════════════════════════════════════════════════
// STYLIST TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Code style convention
 */
export interface StyleConvention {
  id: string;
  name: string;
  description: string;
  language: string;
  rules: StyleRule[];
  enabled: boolean;
}

export interface StyleRule {
  id: string;
  name: string;
  severity: Severity;
  autoFixable: boolean;
  options?: Record<string, unknown>;
}

/**
 * Style review request
 */
export interface StyleReviewRequest {
  files: CodeFile[];
  language?: string;
  conventions?: StyleConvention[];
  strictness: 'lenient' | 'moderate' | 'strict';
  includeFormatting?: boolean;
  projectId?: string;
}

/**
 * Style violation
 */
export interface StyleViolation extends CodeIssue {
  ruleId: string;
  ruleName: string;
  fixedCode?: string;
}

/**
 * Naming issue
 */
export interface NamingIssue {
  identifier: string;
  type: 'variable' | 'function' | 'class' | 'constant' | 'file' | 'type';
  file: string;
  line: number;
  convention: string;
  suggestion: string;
  severity: Severity;
}

/**
 * Consistency issue
 */
export interface ConsistencyIssue {
  type: 'naming' | 'formatting' | 'structure' | 'import';
  description: string;
  occurrences: Array<{ file: string; line: number; example: string }>;
  suggestion: string;
}

/**
 * Style review result
 */
export interface StyleReview {
  metadata: ReportMetadata;
  overallScore: number;
  violations: StyleViolation[];
  namingIssues: NamingIssue[];
  consistencyIssues: ConsistencyIssue[];
  formattingIssues: CodeIssue[];
  fixableCount: number;
  autoFixSuggestions: AutoFix[];
  styleSummary: {
    totalIssues: number;
    bySeperity: Record<Severity, number>;
    byCategory: Record<string, number>;
  };
}

export interface AutoFix {
  file: string;
  original: string;
  fixed: string;
  startLine: number;
  endLine: number;
  description: string;
}

// ═══════════════════════════════════════════════════════════════════
// SECURITY TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Security scan types
 */
export type SecurityScanType =
  | 'xss'
  | 'injection'
  | 'secrets'
  | 'permissions'
  | 'crypto'
  | 'dependencies'
  | 'authentication'
  | 'authorization';

/**
 * Security risk level
 */
export type SecurityRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Security scan request
 */
export interface SecurityScanRequest {
  codebase: FileTree;
  scanTypes?: SecurityScanType[];
  severity?: 'all' | 'medium+' | 'high-only' | 'critical-only';
  includeDependencies?: boolean;
  projectId?: string;
}

/**
 * Security vulnerability
 */
export interface SecurityVulnerability {
  id: string;
  type: SecurityScanType;
  severity: SecurityRiskLevel;
  title: string;
  description: string;
  file: string;
  line?: number;
  cwe?: string;  // Common Weakness Enumeration
  owasp?: string; // OWASP category
  cvss?: number; // Common Vulnerability Scoring System
  recommendation: string;
  references?: string[];
}

/**
 * Secret/credential leak
 */
export interface SecretLeak {
  type: 'api_key' | 'password' | 'token' | 'certificate' | 'connection_string' | 'private_key';
  file: string;
  line: number;
  pattern: string;
  maskedValue: string;
  severity: SecurityRiskLevel;
  recommendation: string;
}

/**
 * Permission issue
 */
export interface PermissionIssue {
  type: 'overprivileged' | 'hardcoded' | 'missing_check' | 'elevation';
  description: string;
  file: string;
  line?: number;
  severity: SecurityRiskLevel;
  recommendation: string;
}

/**
 * Crypto issue
 */
export interface CryptoIssue {
  type: 'weak_algorithm' | 'insecure_random' | 'hardcoded_key' | 'missing_encryption';
  description: string;
  file: string;
  line?: number;
  severity: SecurityRiskLevel;
  recommendation: string;
}

/**
 * Dependency vulnerability
 */
export interface DependencyVulnerability {
  package: string;
  version: string;
  vulnerability: string;
  severity: SecurityRiskLevel;
  fixedVersion?: string;
  cve?: string;
}

/**
 * Security report
 */
export interface SecurityReport {
  metadata: ReportMetadata;
  overallRisk: SecurityRiskLevel;
  riskScore: number; // 0-100, lower is better
  vulnerabilities: SecurityVulnerability[];
  secretsFound: SecretLeak[];
  permissionIssues: PermissionIssue[];
  cryptoIssues: CryptoIssue[];
  dependencyVulns: DependencyVulnerability[];
  recommendations: Recommendation[];
  complianceStatus: ComplianceResult[];
}

export interface ComplianceResult {
  standard: string; // e.g., 'OWASP Top 10', 'PCI-DSS', 'GDPR'
  status: 'compliant' | 'partial' | 'non-compliant';
  findings: string[];
}

// ═══════════════════════════════════════════════════════════════════
// ACCESSIBILITY TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * WCAG standard versions
 */
export type WCAGStandard = 'WCAG-2.1-A' | 'WCAG-2.1-AA' | 'WCAG-2.1-AAA' | 'WCAG-2.2-A' | 'WCAG-2.2-AA' | 'WCAG-2.2-AAA';

/**
 * Compliance level
 */
export type ComplianceLevel = 'A' | 'AA' | 'AAA' | 'non-compliant';

/**
 * A11y audit request
 */
export interface A11yAuditRequest {
  components: CodeFile[];
  standards?: WCAGStandard;
  includeScreenReaderTest?: boolean;
  auditDepth: 'basic' | 'comprehensive' | 'certification-ready';
  projectId?: string;
}

/**
 * A11y violation
 */
export interface A11yViolation {
  id: string;
  wcagCriteria: string;
  level: 'A' | 'AA' | 'AAA';
  description: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  file: string;
  line?: number;
  element?: string;
  recommendation: string;
  helpUrl?: string;
}

/**
 * A11y warning (potential issue)
 */
export interface A11yWarning {
  id: string;
  type: string;
  description: string;
  file: string;
  line?: number;
  suggestion: string;
}

/**
 * ARIA issue
 */
export interface AriaIssue {
  type: 'missing' | 'invalid' | 'redundant' | 'misused';
  attribute?: string;
  element: string;
  file: string;
  line?: number;
  description: string;
  recommendation: string;
}

/**
 * Color contrast issue
 */
export interface ContrastIssue {
  element: string;
  file: string;
  line?: number;
  foreground: string;
  background: string;
  ratio: number;
  requiredRatio: number;
  level: 'AA' | 'AAA';
  recommendation: string;
}

/**
 * Keyboard navigation issue
 */
export interface KeyboardIssue {
  type: 'not_focusable' | 'no_visible_focus' | 'trap' | 'order' | 'missing_handler';
  element: string;
  file: string;
  line?: number;
  description: string;
  recommendation: string;
}

/**
 * Semantic HTML issue
 */
export interface SemanticIssue {
  type: 'wrong_element' | 'missing_landmark' | 'heading_order' | 'list_structure';
  element: string;
  file: string;
  line?: number;
  description: string;
  recommendation: string;
}

/**
 * A11y report
 */
export interface A11yReport {
  metadata: ReportMetadata;
  complianceLevel: ComplianceLevel;
  overallScore: number; // 0-100
  targetStandard: WCAGStandard;
  violations: A11yViolation[];
  warnings: A11yWarning[];
  ariaIssues: AriaIssue[];
  contrastIssues: ContrastIssue[];
  keyboardIssues: KeyboardIssue[];
  semanticIssues: SemanticIssue[];
  recommendations: Recommendation[];
  testResults: A11yTestResult[];
  certificationReadiness: CertificationReadiness;
}

export interface A11yTestResult {
  test: string;
  status: 'pass' | 'fail' | 'partial' | 'not-applicable';
  details?: string;
}

export interface CertificationReadiness {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  score: number;
}

// ═══════════════════════════════════════════════════════════════════
// REVIEW HOOK TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * File change event for hooks
 */
export interface FileChangeEvent {
  files: string[];
  changeType: 'create' | 'modify' | 'delete';
  timestamp: number;
}

/**
 * Review hook trigger
 */
export interface ReviewTrigger {
  agent: DevelopmentHouseType;
  condition: 'file-change' | 'pre-commit' | 'pre-push' | 'pr-open' | 'manual';
  filePatterns?: string[];
  enabled: boolean;
}

/**
 * Review result from hook
 */
export interface ReviewResult {
  agent: DevelopmentHouseType;
  trigger: string;
  timestamp: number;
  passed: boolean;
  blockers: CodeIssue[];
  warnings: CodeIssue[];
  summary: string;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIG KEYS FOR DEVELOPMENT AGENTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Development agent config keys
 */
export const DEVELOPMENT_CONFIG = {
  // Architect
  ARCHITECT_COMPLEXITY_THRESHOLD: 'architect.complexityThreshold',
  ARCHITECT_COUPLING_THRESHOLD: 'architect.couplingThreshold',
  ARCHITECT_MAX_FILE_SIZE: 'architect.maxFileSize',

  // Stylist
  STYLIST_STRICTNESS: 'stylist.strictness',
  STYLIST_AUTO_FIX: 'stylist.autoFix',
  STYLIST_IGNORE_PATTERNS: 'stylist.ignorePatterns',

  // Security
  SECURITY_SCAN_DEPTH: 'security.scanDepth',
  SECURITY_SECRET_PATTERNS: 'security.secretPatterns',
  SECURITY_DEPENDENCY_AUDIT: 'security.dependencyAudit',

  // Accessibility
  A11Y_WCAG_LEVEL: 'a11y.wcagLevel',
  A11Y_CONTRAST_RATIO: 'a11y.contrastRatio',
  A11Y_STRICT_MODE: 'a11y.strictMode',

  // Review Hooks
  HOOKS_ENABLED: 'hooks.enabled',
  HOOKS_BLOCK_ON_ERROR: 'hooks.blockOnError',
  HOOKS_TIMEOUT: 'hooks.timeout',
} as const;
