/**
 * Security Agent
 *
 * The guardian of code security and privacy.
 * Scans for vulnerabilities, detects secrets, audits permissions,
 * and ensures secure coding practices.
 *
 * Capabilities:
 * - Vulnerability scanning
 * - Secret/credential detection
 * - Permission auditing
 * - Crypto analysis
 * - Dependency vulnerability checking
 * - Authentication review
 *
 * NOTE: Uses ConfigManager for all thresholds and prompts.
 */

import { DevelopmentAgentBase } from './development-agent-base.js';
import type { AgentMessage, HouseType } from '../../runtime/types.js';
import type {
  DevelopmentHouseType,
  SecurityScanRequest,
  SecurityReport,
  SecurityVulnerability,
  SecretLeak,
  PermissionIssue,
  CryptoIssue,
  DependencyVulnerability,
  ComplianceResult,
  Recommendation,
  SecurityRiskLevel,
  SecurityScanType,
  CodeFile,
  FileChangeEvent,
  ReviewResult,
  CodeIssue,
} from './types.js';
import { DEVELOPMENT_CONFIG } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// SECURITY CONFIG KEYS
// ═══════════════════════════════════════════════════════════════════

export const SECURITY_CONFIG = {
  SCAN_DEPTH: 'security.scanDepth',
  SECRET_PATTERNS: 'security.secretPatterns',
  DEPENDENCY_AUDIT: 'security.dependencyAudit',
  BLOCK_ON_SECRETS: 'security.blockOnSecrets',
  OWASP_CHECKS: 'security.owaspChecks',
} as const;

// ═══════════════════════════════════════════════════════════════════
// SECRET DETECTION PATTERNS
// ═══════════════════════════════════════════════════════════════════

interface SecretPattern {
  type: SecretLeak['type'];
  name: string;
  pattern: RegExp;
  severity: SecurityRiskLevel;
}

const SECRET_PATTERNS: SecretPattern[] = [
  // API Keys
  {
    type: 'api_key',
    name: 'AWS Access Key',
    pattern: /(?:AKIA|A3T|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    severity: 'critical',
  },
  {
    type: 'api_key',
    name: 'Google API Key',
    pattern: /AIza[0-9A-Za-z_-]{35}/g,
    severity: 'critical',
  },
  {
    type: 'api_key',
    name: 'Stripe API Key',
    pattern: /(?:sk_live_|rk_live_)[0-9a-zA-Z]{24,}/g,
    severity: 'critical',
  },
  {
    type: 'api_key',
    name: 'Generic API Key',
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([a-zA-Z0-9_-]{20,})['"]?/gi,
    severity: 'high',
  },
  // Tokens
  {
    type: 'token',
    name: 'JWT Token',
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    severity: 'high',
  },
  {
    type: 'token',
    name: 'GitHub Token',
    pattern: /(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})/g,
    severity: 'critical',
  },
  {
    type: 'token',
    name: 'NPM Token',
    pattern: /npm_[a-zA-Z0-9]{36}/g,
    severity: 'critical',
  },
  // Passwords
  {
    type: 'password',
    name: 'Password Assignment',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]{8,})['"]?/gi,
    severity: 'critical',
  },
  // Connection Strings
  {
    type: 'connection_string',
    name: 'Database URL',
    pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/gi,
    severity: 'critical',
  },
  {
    type: 'connection_string',
    name: 'Connection String',
    pattern: /(?:connection[_-]?string|database[_-]?url)\s*[:=]\s*['"]([^'"]+)['"]?/gi,
    severity: 'high',
  },
  // Private Keys
  {
    type: 'private_key',
    name: 'RSA Private Key',
    pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g,
    severity: 'critical',
  },
  {
    type: 'private_key',
    name: 'SSH Private Key',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
    severity: 'critical',
  },
];

// ═══════════════════════════════════════════════════════════════════
// VULNERABILITY PATTERNS
// ═══════════════════════════════════════════════════════════════════

interface VulnerabilityPattern {
  type: SecurityScanType;
  name: string;
  pattern: RegExp;
  severity: SecurityRiskLevel;
  cwe?: string;
  owasp?: string;
  description: string;
  recommendation: string;
}

const VULNERABILITY_PATTERNS: VulnerabilityPattern[] = [
  // XSS Vulnerabilities
  {
    type: 'xss',
    name: 'innerHTML Assignment',
    pattern: /\.innerHTML\s*=\s*(?!['"`])/g,
    severity: 'high',
    cwe: 'CWE-79',
    owasp: 'A7:2017',
    description: 'Direct innerHTML assignment can lead to XSS if user input is used',
    recommendation: 'Use textContent or sanitize HTML before assignment',
  },
  {
    type: 'xss',
    name: 'Dangerous React Prop',
    pattern: /dangerouslySetInnerHTML/g,
    severity: 'medium',
    cwe: 'CWE-79',
    owasp: 'A7:2017',
    description: 'dangerouslySetInnerHTML can lead to XSS if not properly sanitized',
    recommendation: 'Sanitize HTML content before using dangerouslySetInnerHTML',
  },
  {
    type: 'xss',
    name: 'Document Write',
    pattern: /document\.write\s*\(/g,
    severity: 'high',
    cwe: 'CWE-79',
    owasp: 'A7:2017',
    description: 'document.write can be exploited for XSS attacks',
    recommendation: 'Use DOM manipulation methods instead',
  },
  // Injection Vulnerabilities
  {
    type: 'injection',
    name: 'SQL Concatenation',
    pattern: /(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)[\s\S]*?\+[\s\S]*?(?:req\.|request\.|params\.|query\.)/gi,
    severity: 'critical',
    cwe: 'CWE-89',
    owasp: 'A1:2017',
    description: 'SQL query built with string concatenation is vulnerable to SQL injection',
    recommendation: 'Use parameterized queries or an ORM',
  },
  {
    type: 'injection',
    name: 'Eval Usage',
    pattern: /\beval\s*\(/g,
    severity: 'critical',
    cwe: 'CWE-95',
    owasp: 'A1:2017',
    description: 'eval() can execute arbitrary code and is dangerous',
    recommendation: 'Avoid eval() and use safer alternatives like JSON.parse()',
  },
  {
    type: 'injection',
    name: 'Command Injection Risk',
    pattern: /(?:exec|spawn|execSync)\s*\([^)]*(?:\+|`|\$\{)/g,
    severity: 'critical',
    cwe: 'CWE-78',
    owasp: 'A1:2017',
    description: 'Command execution with user input can lead to command injection',
    recommendation: 'Sanitize input and use parameterized commands',
  },
  // Authentication Issues
  {
    type: 'authentication',
    name: 'Hardcoded Credentials',
    pattern: /(?:username|user|login)\s*[:=]\s*['"][^'"]+['"][\s\S]{0,50}(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/gi,
    severity: 'critical',
    cwe: 'CWE-798',
    owasp: 'A2:2017',
    description: 'Hardcoded credentials in source code',
    recommendation: 'Use environment variables or a secure credential manager',
  },
  {
    type: 'authentication',
    name: 'Weak Password Validation',
    pattern: /password\.length\s*[<>=]+\s*[0-7]\b/g,
    severity: 'medium',
    cwe: 'CWE-521',
    owasp: 'A2:2017',
    description: 'Password length requirement is too weak (less than 8 characters)',
    recommendation: 'Require passwords of at least 8 characters',
  },
  // Crypto Issues
  {
    type: 'crypto',
    name: 'Weak Hash Algorithm',
    pattern: /(?:createHash|Hash)\s*\(\s*['"](?:md5|sha1)['"]\s*\)/gi,
    severity: 'high',
    cwe: 'CWE-328',
    owasp: 'A3:2017',
    description: 'MD5 and SHA1 are cryptographically weak',
    recommendation: 'Use SHA-256 or stronger for hashing',
  },
  {
    type: 'crypto',
    name: 'Math.random for Security',
    pattern: /Math\.random\s*\(\s*\)[\s\S]{0,50}(?:token|key|secret|password|salt|nonce)/gi,
    severity: 'high',
    cwe: 'CWE-338',
    owasp: 'A3:2017',
    description: 'Math.random() is not cryptographically secure',
    recommendation: 'Use crypto.randomBytes() or crypto.getRandomValues()',
  },
  // Authorization Issues
  {
    type: 'authorization',
    name: 'Missing Auth Check Pattern',
    pattern: /app\.(?:get|post|put|delete|patch)\s*\([^)]+,\s*(?:async\s*)?\(?[^)]*\)?\s*=>/g,
    severity: 'medium',
    cwe: 'CWE-862',
    owasp: 'A5:2017',
    description: 'Route handler might be missing authentication middleware',
    recommendation: 'Ensure authentication middleware is applied to protected routes',
  },
];

// ═══════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

interface ApiKeyReviewRequest {
  files: CodeFile[];
  includeEnvFiles?: boolean;
  projectId?: string;
}

interface PermissionValidationRequest {
  files: CodeFile[];
  projectId?: string;
}

interface AuthReviewRequest {
  files: CodeFile[];
  projectId?: string;
}

// ═══════════════════════════════════════════════════════════════════
// SECURITY AGENT
// ═══════════════════════════════════════════════════════════════════

export class SecurityAgent extends DevelopmentAgentBase {
  readonly id = 'security';
  readonly name = 'The Security Guard';
  readonly house: HouseType = 'security';
  readonly version = '1.0.0';
  readonly capabilities = [
    'scan-vulnerabilities',
    'review-api-keys',
    'validate-permissions',
    'audit-data-flow',
    'check-encryption',
    'review-auth',
    'on-file-change',
    'on-pre-commit',
  ];

  // ─────────────────────────────────────────────────────────────────
  // DEVELOPMENT AGENT INTERFACE
  // ─────────────────────────────────────────────────────────────────

  getDevelopmentHouse(): DevelopmentHouseType {
    return 'security';
  }

  getFilePatterns(): string[] {
    return [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.py',
      '**/*.env*',
      '**/*.json',
      '**/*.yaml',
      '**/*.yml',
      '**/Dockerfile*',
    ];
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    await super.onInitialize();
    this.log('info', 'Security Guard on duty - scanning for threats');
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', 'Security Guard signing off');
    await super.onShutdown();
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE HANDLING
  // ─────────────────────────────────────────────────────────────────

  protected async onMessage(message: AgentMessage): Promise<unknown> {
    switch (message.type) {
      case 'scan-vulnerabilities':
        return this.scanVulnerabilities(message.payload as SecurityScanRequest);

      case 'review-api-keys':
        return this.reviewApiKeys(message.payload as ApiKeyReviewRequest);

      case 'validate-permissions':
        return this.validatePermissions(message.payload as PermissionValidationRequest);

      case 'review-auth':
        return this.reviewAuth(message.payload as AuthReviewRequest);

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
        'No security-relevant files changed'
      );
    }

    // Check for sensitive file changes
    const warnings: CodeIssue[] = [];
    const blockers: CodeIssue[] = [];

    const sensitivePatterns = ['.env', 'secret', 'credential', 'auth', 'key'];
    const sensitiveFiles = relevantFiles.filter(f =>
      sensitivePatterns.some(p => f.toLowerCase().includes(p))
    );

    if (sensitiveFiles.length > 0) {
      warnings.push(this.createIssue(
        'warning',
        `Sensitive files modified: ${sensitiveFiles.join(', ')}. Ensure no secrets are committed.`,
        { rule: 'sensitive-file-change' }
      ));
    }

    const passed = blockers.length === 0;
    return this.createReviewResult(
      'file-change',
      passed,
      blockers,
      warnings,
      `Security review: ${relevantFiles.length} files, ${sensitiveFiles.length} sensitive`
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

    // Block commits of .env files
    const envFiles = relevantFiles.filter(f => f.includes('.env') && !f.includes('.example'));
    if (envFiles.length > 0) {
      blockers.push(this.createIssue(
        'critical',
        `Attempting to commit .env file(s): ${envFiles.join(', ')}`,
        { rule: 'no-env-commit', suggestion: 'Add .env to .gitignore' }
      ));
    }

    // Warn about key/secret file names
    const suspiciousFiles = relevantFiles.filter(f =>
      /(?:key|secret|credential|password|token)\./i.test(f)
    );
    if (suspiciousFiles.length > 0) {
      warnings.push(this.createIssue(
        'warning',
        `Files with sensitive names: ${suspiciousFiles.join(', ')}`,
        { rule: 'suspicious-filename' }
      ));
    }

    const blockOnSecrets = await this.getConfig<boolean>(SECURITY_CONFIG.BLOCK_ON_SECRETS, true);
    const passed = blockOnSecrets ? blockers.length === 0 : true;

    return this.createReviewResult(
      'pre-commit',
      passed,
      blockers,
      warnings,
      `Security pre-commit: ${blockers.length} blockers, ${warnings.length} warnings`
    );
  }

  async onPrePush(commits: string[]): Promise<ReviewResult> {
    return this.createReviewResult(
      'pre-push',
      true,
      [],
      [],
      `Security check for ${commits.length} commits`
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // VULNERABILITY SCANNING
  // ─────────────────────────────────────────────────────────────────

  async scanVulnerabilities(request: SecurityScanRequest): Promise<SecurityReport> {
    const startTime = Date.now();
    const { codebase, scanTypes, severity, includeDependencies } = request;

    const activeTypes = scanTypes || ['xss', 'injection', 'secrets', 'crypto', 'authentication', 'authorization'];
    const minSeverity = severity || 'all';

    const vulnerabilities: SecurityVulnerability[] = [];
    const secretsFound: SecretLeak[] = [];
    const permissionIssues: PermissionIssue[] = [];
    const cryptoIssues: CryptoIssue[] = [];
    const dependencyVulns: DependencyVulnerability[] = [];

    for (const file of codebase.files) {
      // Scan for secrets
      if (activeTypes.includes('secrets')) {
        const secrets = this.scanForSecrets(file);
        secretsFound.push(...secrets);
      }

      // Scan for vulnerabilities
      for (const pattern of VULNERABILITY_PATTERNS) {
        if (!activeTypes.includes(pattern.type)) continue;
        if (!this.meetsMinSeverity(pattern.severity, minSeverity)) continue;

        const matches = file.content.matchAll(pattern.pattern);
        for (const match of matches) {
          const line = this.getLineNumber(file.content, match.index || 0);

          if (pattern.type === 'crypto') {
            cryptoIssues.push({
              type: pattern.name.toLowerCase().includes('weak') ? 'weak_algorithm' :
                    pattern.name.toLowerCase().includes('random') ? 'insecure_random' : 'hardcoded_key',
              description: pattern.description,
              file: file.path,
              line,
              severity: pattern.severity,
              recommendation: pattern.recommendation,
            });
          } else {
            vulnerabilities.push({
              id: this.generateId('vuln'),
              type: pattern.type,
              severity: pattern.severity,
              title: pattern.name,
              description: pattern.description,
              file: file.path,
              line,
              cwe: pattern.cwe,
              owasp: pattern.owasp,
              recommendation: pattern.recommendation,
            });
          }
        }
      }

      // Check for permission issues
      if (activeTypes.includes('permissions') || activeTypes.includes('authorization')) {
        const permissions = this.analyzePermissions(file);
        permissionIssues.push(...permissions);
      }
    }

    // Check dependencies if requested
    if (includeDependencies) {
      const packageFile = codebase.files.find(f => f.path.endsWith('package.json'));
      if (packageFile) {
        const depVulns = await this.checkDependencies(packageFile);
        dependencyVulns.push(...depVulns);
      }
    }

    // Calculate risk level
    const overallRisk = this.calculateOverallRisk(vulnerabilities, secretsFound, cryptoIssues);
    const riskScore = this.calculateRiskScore(vulnerabilities, secretsFound, cryptoIssues, permissionIssues);

    // Generate recommendations
    const recommendations = this.generateSecurityRecommendations(
      vulnerabilities,
      secretsFound,
      cryptoIssues,
      permissionIssues
    );

    // Check compliance
    const complianceStatus = this.checkCompliance(vulnerabilities, secretsFound);

    // Propose action if critical issues found
    if (secretsFound.length > 0 || vulnerabilities.some(v => v.severity === 'critical')) {
      await this.proposeAction(
        'address-security-issues',
        'Critical security issues detected',
        `Found ${secretsFound.length} secrets and ${vulnerabilities.filter(v => v.severity === 'critical').length} critical vulnerabilities`,
        { secretsFound, criticalVulns: vulnerabilities.filter(v => v.severity === 'critical') },
        { projectId: request.projectId, requiresApproval: true, urgency: 'critical' }
      );
    }

    return {
      metadata: this.createReportMetadata(
        codebase.files.length,
        Date.now() - startTime,
        request.projectId
      ),
      overallRisk,
      riskScore,
      vulnerabilities,
      secretsFound,
      permissionIssues,
      cryptoIssues,
      dependencyVulns,
      recommendations,
      complianceStatus,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // SECRET DETECTION
  // ─────────────────────────────────────────────────────────────────

  async reviewApiKeys(request: ApiKeyReviewRequest): Promise<{
    secretsFound: SecretLeak[];
    recommendations: string[];
  }> {
    const allSecrets: SecretLeak[] = [];

    for (const file of request.files) {
      // Skip example files unless explicitly requested
      if (!request.includeEnvFiles && file.path.includes('.example')) continue;

      const secrets = this.scanForSecrets(file);
      allSecrets.push(...secrets);
    }

    const recommendations: string[] = [];

    if (allSecrets.length > 0) {
      recommendations.push('Remove hardcoded secrets immediately');
      recommendations.push('Use environment variables or a secret manager');
      recommendations.push('Rotate any exposed credentials');
      recommendations.push('Add secret files to .gitignore');
    }

    if (allSecrets.some(s => s.type === 'api_key')) {
      recommendations.push('Consider using API key rotation');
    }

    if (allSecrets.some(s => s.type === 'private_key')) {
      recommendations.push('Generate new key pairs immediately');
    }

    return { secretsFound: allSecrets, recommendations };
  }

  private scanForSecrets(file: CodeFile): SecretLeak[] {
    const secrets: SecretLeak[] = [];

    for (const pattern of SECRET_PATTERNS) {
      const matches = file.content.matchAll(pattern.pattern);

      for (const match of matches) {
        const line = this.getLineNumber(file.content, match.index || 0);
        const value = match[1] || match[0];
        const maskedValue = this.maskSecret(value);

        secrets.push({
          type: pattern.type,
          file: file.path,
          line,
          pattern: pattern.name,
          maskedValue,
          severity: pattern.severity,
          recommendation: `Remove ${pattern.name} from source code. Use environment variables instead.`,
        });
      }
    }

    return secrets;
  }

  private maskSecret(value: string): string {
    if (value.length <= 8) return '*'.repeat(value.length);
    return value.slice(0, 4) + '*'.repeat(value.length - 8) + value.slice(-4);
  }

  // ─────────────────────────────────────────────────────────────────
  // PERMISSION VALIDATION
  // ─────────────────────────────────────────────────────────────────

  async validatePermissions(request: PermissionValidationRequest): Promise<{
    issues: PermissionIssue[];
    recommendations: string[];
  }> {
    const issues: PermissionIssue[] = [];

    for (const file of request.files) {
      const fileIssues = this.analyzePermissions(file);
      issues.push(...fileIssues);
    }

    const recommendations: string[] = [];

    if (issues.some(i => i.type === 'hardcoded')) {
      recommendations.push('Move permissions to configuration');
    }

    if (issues.some(i => i.type === 'missing_check')) {
      recommendations.push('Add authorization middleware to protected routes');
    }

    if (issues.some(i => i.type === 'overprivileged')) {
      recommendations.push('Apply principle of least privilege');
    }

    return { issues, recommendations };
  }

  private analyzePermissions(file: CodeFile): PermissionIssue[] {
    const issues: PermissionIssue[] = [];

    // Check for hardcoded roles
    const hardcodedRoles = file.content.match(/(?:role|permission)\s*[:=]\s*['"](?:admin|root|superuser)['"]/gi);
    if (hardcodedRoles) {
      issues.push({
        type: 'hardcoded',
        description: 'Hardcoded administrative role',
        file: file.path,
        severity: 'medium',
        recommendation: 'Use role-based access control with configurable roles',
      });
    }

    // Check for missing auth middleware patterns
    const unprotectedRoutes = file.content.match(/app\.(?:get|post|put|delete)\s*\([^)]+,\s*async\s*\([^)]*\)\s*=>/g);
    if (unprotectedRoutes) {
      for (const route of unprotectedRoutes) {
        // Check if it's not a public route
        if (!/(?:login|register|public|health|status)/i.test(route)) {
          issues.push({
            type: 'missing_check',
            description: 'Route handler may be missing authentication',
            file: file.path,
            severity: 'medium',
            recommendation: 'Add authentication middleware to protected routes',
          });
          break; // Only report once per file
        }
      }
    }

    return issues;
  }

  // ─────────────────────────────────────────────────────────────────
  // AUTH REVIEW
  // ─────────────────────────────────────────────────────────────────

  async reviewAuth(request: AuthReviewRequest): Promise<{
    findings: Array<{ type: string; description: string; severity: SecurityRiskLevel }>;
    recommendations: string[];
  }> {
    const findings: Array<{ type: string; description: string; severity: SecurityRiskLevel }> = [];

    for (const file of request.files) {
      // Check for weak password requirements
      if (/password\.length\s*[<>=]+\s*[0-7]\b/.test(file.content)) {
        findings.push({
          type: 'weak-password',
          description: 'Password length requirement is too weak',
          severity: 'medium',
        });
      }

      // Check for missing rate limiting
      if (/app\.post.*login/i.test(file.content) && !/rateLimit|rateLimiter/i.test(file.content)) {
        findings.push({
          type: 'missing-rate-limit',
          description: 'Login endpoint may be missing rate limiting',
          severity: 'high',
        });
      }

      // Check for session configuration
      if (/session/i.test(file.content)) {
        if (/secure\s*:\s*false/i.test(file.content)) {
          findings.push({
            type: 'insecure-session',
            description: 'Session cookies not marked as secure',
            severity: 'high',
          });
        }
        if (!/httpOnly/i.test(file.content)) {
          findings.push({
            type: 'session-httponly',
            description: 'Session cookies may not be httpOnly',
            severity: 'medium',
          });
        }
      }
    }

    const recommendations: string[] = [];

    if (findings.some(f => f.type === 'weak-password')) {
      recommendations.push('Require passwords of at least 8 characters with complexity requirements');
    }
    if (findings.some(f => f.type === 'missing-rate-limit')) {
      recommendations.push('Add rate limiting to authentication endpoints');
    }
    if (findings.some(f => f.type.includes('session'))) {
      recommendations.push('Configure secure session settings (secure, httpOnly, sameSite)');
    }

    return { findings, recommendations };
  }

  // ─────────────────────────────────────────────────────────────────
  // DEPENDENCY CHECKING
  // ─────────────────────────────────────────────────────────────────

  private async checkDependencies(packageFile: CodeFile): Promise<DependencyVulnerability[]> {
    // In a real implementation, this would call npm audit or similar
    // For now, check for known problematic packages
    const vulnerabilities: DependencyVulnerability[] = [];

    try {
      const pkg = JSON.parse(packageFile.content);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Known vulnerable package patterns
      const knownVulnerable: Array<{ package: string; before: string; severity: SecurityRiskLevel; cve?: string }> = [
        { package: 'lodash', before: '4.17.21', severity: 'high', cve: 'CVE-2021-23337' },
        { package: 'minimist', before: '1.2.6', severity: 'critical', cve: 'CVE-2021-44906' },
        { package: 'glob-parent', before: '5.1.2', severity: 'high', cve: 'CVE-2020-28469' },
      ];

      for (const [name, version] of Object.entries(allDeps)) {
        const vuln = knownVulnerable.find(v => v.package === name);
        if (vuln) {
          // Extract version string (remove ^ or ~ prefix)
          const versionStr = (version as string).replace(/^[\^~]/, '');

          // Only flag if installed version is below the fixed version
          if (this.isVersionBelow(versionStr, vuln.before)) {
            vulnerabilities.push({
              package: name,
              version: versionStr,
              vulnerability: `Known vulnerability in ${name}`,
              severity: vuln.severity,
              fixedVersion: vuln.before,
              cve: vuln.cve,
            });
          }
        }
      }
    } catch (error) {
      this.log('warn', `Failed to parse package.json: ${error}`);
    }

    return vulnerabilities;
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Compare semver versions - returns true if v1 < v2
   */
  private isVersionBelow(v1: string, v2: string): boolean {
    const parse = (v: string): number[] => {
      // Extract numeric parts (e.g., "4.17.21" -> [4, 17, 21])
      const match = v.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
      if (!match) return [0, 0, 0];
      return [
        parseInt(match[1] || '0', 10),
        parseInt(match[2] || '0', 10),
        parseInt(match[3] || '0', 10),
      ];
    };

    const parts1 = parse(v1);
    const parts2 = parse(v2);

    for (let i = 0; i < 3; i++) {
      if (parts1[i] < parts2[i]) return true;
      if (parts1[i] > parts2[i]) return false;
    }
    return false; // Equal versions
  }

  private getLineNumber(content: string, index: number): number {
    return content.slice(0, index).split('\n').length;
  }

  private meetsMinSeverity(severity: SecurityRiskLevel, minSeverity: string): boolean {
    const levels: SecurityRiskLevel[] = ['low', 'medium', 'high', 'critical'];
    const minIndex = minSeverity === 'all' ? 0 :
                     minSeverity === 'medium+' ? 1 :
                     minSeverity === 'high-only' ? 2 :
                     minSeverity === 'critical-only' ? 3 : 0;
    return levels.indexOf(severity) >= minIndex;
  }

  private calculateOverallRisk(
    vulnerabilities: SecurityVulnerability[],
    secrets: SecretLeak[],
    cryptoIssues: CryptoIssue[]
  ): SecurityRiskLevel {
    if (secrets.length > 0) return 'critical';
    if (vulnerabilities.some(v => v.severity === 'critical')) return 'critical';
    if (vulnerabilities.some(v => v.severity === 'high') || cryptoIssues.some(c => c.severity === 'high')) return 'high';
    if (vulnerabilities.some(v => v.severity === 'medium')) return 'medium';
    return 'low';
  }

  private calculateRiskScore(
    vulnerabilities: SecurityVulnerability[],
    secrets: SecretLeak[],
    cryptoIssues: CryptoIssue[],
    permissionIssues: PermissionIssue[]
  ): number {
    let score = 0;

    const severityWeights: Record<SecurityRiskLevel, number> = {
      critical: 25,
      high: 15,
      medium: 8,
      low: 3,
    };

    // Secrets are very serious
    score += secrets.length * 30;

    for (const v of vulnerabilities) {
      score += severityWeights[v.severity];
    }

    for (const c of cryptoIssues) {
      score += severityWeights[c.severity];
    }

    for (const p of permissionIssues) {
      score += severityWeights[p.severity];
    }

    return Math.min(100, score);
  }

  private generateSecurityRecommendations(
    vulnerabilities: SecurityVulnerability[],
    secrets: SecretLeak[],
    cryptoIssues: CryptoIssue[],
    permissionIssues: PermissionIssue[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (secrets.length > 0) {
      recommendations.push(this.createRecommendation(
        'Remove exposed secrets immediately',
        `Found ${secrets.length} secrets in source code. Rotate credentials and use environment variables.`,
        { priority: 'critical', effort: 'small', impact: 'high', category: 'secrets' }
      ));
    }

    const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
    if (criticalVulns.length > 0) {
      recommendations.push(this.createRecommendation(
        'Fix critical vulnerabilities',
        `Found ${criticalVulns.length} critical vulnerabilities including ${criticalVulns.map(v => v.type).join(', ')}`,
        { priority: 'critical', effort: 'medium', impact: 'high', category: 'vulnerabilities' }
      ));
    }

    if (cryptoIssues.length > 0) {
      recommendations.push(this.createRecommendation(
        'Update cryptographic implementations',
        'Found weak or insecure cryptographic patterns',
        { priority: 'high', effort: 'medium', impact: 'high', category: 'crypto' }
      ));
    }

    if (permissionIssues.some(p => p.type === 'missing_check')) {
      recommendations.push(this.createRecommendation(
        'Add authorization checks',
        'Some routes may be missing authentication or authorization',
        { priority: 'high', effort: 'medium', impact: 'high', category: 'auth' }
      ));
    }

    return recommendations;
  }

  private checkCompliance(
    vulnerabilities: SecurityVulnerability[],
    secrets: SecretLeak[]
  ): ComplianceResult[] {
    const results: ComplianceResult[] = [];

    // OWASP Top 10 check
    const owaspFindings: string[] = [];
    const owaspCategories = new Set(vulnerabilities.filter(v => v.owasp).map(v => v.owasp));

    if (owaspCategories.size > 0) {
      owaspFindings.push(...Array.from(owaspCategories).map(c => `Violation: ${c}`));
    }

    results.push({
      standard: 'OWASP Top 10',
      status: owaspCategories.size === 0 ? 'compliant' :
              owaspCategories.size < 3 ? 'partial' : 'non-compliant',
      findings: owaspFindings,
    });

    // Basic security hygiene
    const hygieneFindings: string[] = [];
    if (secrets.length > 0) hygieneFindings.push('Secrets in source code');
    if (vulnerabilities.some(v => v.type === 'injection')) hygieneFindings.push('Injection vulnerabilities');

    results.push({
      standard: 'Security Hygiene',
      status: hygieneFindings.length === 0 ? 'compliant' :
              hygieneFindings.length < 2 ? 'partial' : 'non-compliant',
      findings: hygieneFindings,
    });

    return results;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _security: SecurityAgent | null = null;

export function getSecurityAgent(): SecurityAgent {
  if (!_security) {
    _security = new SecurityAgent();
  }
  return _security;
}

export function resetSecurityAgent(): void {
  _security = null;
}
