/**
 * Report Formatters
 *
 * Shared utilities for formatting analysis reports
 * across all development agents.
 */

import type {
  CodeIssue,
  Severity,
  Recommendation,
  ReportMetadata,
  ArchitectureReview,
  StyleReview,
  SecurityReport,
  A11yReport,
  ReviewResult,
} from '../types.js';

// ═══════════════════════════════════════════════════════════════════
// MARKDOWN FORMATTERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Format severity with emoji
 */
export function formatSeverity(severity: Severity): string {
  const icons: Record<Severity, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    critical: '🚨',
  };
  return `${icons[severity]} ${severity.toUpperCase()}`;
}

/**
 * Format a code issue as markdown
 */
export function formatIssue(issue: CodeIssue): string {
  let md = `### ${formatSeverity(issue.severity)}\n\n`;
  md += `**${issue.message}**\n\n`;

  if (issue.file) {
    md += `📁 \`${issue.file}\``;
    if (issue.line) {
      md += `:${issue.line}`;
      if (issue.column) md += `:${issue.column}`;
    }
    md += '\n\n';
  }

  if (issue.rule) {
    md += `📏 Rule: \`${issue.rule}\`\n\n`;
  }

  if (issue.suggestion) {
    md += `💡 **Suggestion:** ${issue.suggestion}\n\n`;
  }

  if (issue.autoFixable) {
    md += `✅ This issue can be auto-fixed\n\n`;
  }

  return md;
}

/**
 * Format issues list as markdown
 */
export function formatIssuesList(issues: CodeIssue[]): string {
  if (issues.length === 0) {
    return '*No issues found* ✅\n';
  }

  const grouped = groupBySeverity(issues);
  let md = '';

  for (const severity of ['critical', 'error', 'warning', 'info'] as Severity[]) {
    const severityIssues = grouped[severity];
    if (severityIssues.length > 0) {
      md += `## ${formatSeverity(severity)} (${severityIssues.length})\n\n`;
      for (const issue of severityIssues) {
        md += formatIssue(issue);
        md += '---\n\n';
      }
    }
  }

  return md;
}

/**
 * Format recommendation as markdown
 */
export function formatRecommendation(rec: Recommendation): string {
  const priorityIcons: Record<string, string> = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  };

  let md = `### ${priorityIcons[rec.priority]} ${rec.title}\n\n`;
  md += `${rec.description}\n\n`;
  md += `| Aspect | Value |\n|--------|-------|\n`;
  md += `| Priority | ${rec.priority} |\n`;
  md += `| Effort | ${rec.effort} |\n`;
  md += `| Impact | ${rec.impact} |\n`;
  md += `| Category | ${rec.category} |\n\n`;

  return md;
}

/**
 * Format report metadata as markdown
 */
export function formatMetadata(meta: ReportMetadata): string {
  return `---
**Report Metadata**
- Generated: ${meta.generatedAt}
- Agent: ${meta.agentId} (v${meta.agentVersion})
- Analysis Time: ${meta.analysisTimeMs}ms
- Files Analyzed: ${meta.filesAnalyzed}
${meta.projectId ? `- Project: ${meta.projectId}` : ''}
---\n\n`;
}

/**
 * Format score as progress bar
 */
export function formatScore(score: number, label: string = 'Score'): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  let color = '🔴';
  if (score >= 80) color = '🟢';
  else if (score >= 60) color = '🟡';
  else if (score >= 40) color = '🟠';

  return `${color} **${label}:** ${bar} ${score.toFixed(0)}/100`;
}

// ═══════════════════════════════════════════════════════════════════
// REPORT FORMATTERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Format architecture review as markdown
 */
export function formatArchitectureReview(review: ArchitectureReview): string {
  let md = '# 🏗️ Architecture Review\n\n';
  md += formatMetadata(review.metadata);

  md += '## Overall Assessment\n\n';
  md += formatScore(review.overallScore, 'Architecture Score') + '\n\n';

  md += '### Design Quality Metrics\n\n';
  md += `| Metric | Score |\n|--------|-------|\n`;
  md += `| Patterns | ${formatScore(review.designQuality.patterns * 100)} |\n`;
  md += `| Coupling | ${formatScore(review.designQuality.coupling * 100)} |\n`;
  md += `| Cohesion | ${formatScore(review.designQuality.cohesion * 100)} |\n`;
  md += `| Complexity | ${formatScore(review.designQuality.complexity * 100)} |\n\n`;

  if (review.patterns.length > 0) {
    md += '## Detected Design Patterns\n\n';
    for (const pattern of review.patterns) {
      md += `### ${pattern.name} (${pattern.type})\n`;
      md += `- Confidence: ${(pattern.confidence * 100).toFixed(0)}%\n`;
      md += `- Location: ${pattern.location.join(', ')}\n`;
      md += `- ${pattern.description}\n`;
      if (!pattern.isCorrectlyImplemented) {
        md += `- ⚠️ Implementation issues detected\n`;
      }
      md += '\n';
    }
  }

  if (review.antiPatterns.length > 0) {
    md += '## Anti-Patterns Detected\n\n';
    for (const ap of review.antiPatterns) {
      md += `### ${formatSeverity(ap.severity)} ${ap.name}\n`;
      md += `${ap.description}\n\n`;
      md += `**Impact:** ${ap.impact}\n\n`;
      md += `**Suggestion:** ${ap.suggestion}\n\n`;
      md += `**Refactoring Effort:** ${ap.refactoringEffort}\n\n`;
    }
  }

  if (review.recommendations.length > 0) {
    md += '## Recommendations\n\n';
    for (const rec of review.recommendations) {
      md += formatRecommendation(rec);
    }
  }

  return md;
}

/**
 * Format style review as markdown
 */
export function formatStyleReview(review: StyleReview): string {
  let md = '# 🎨 Code Style Review\n\n';
  md += formatMetadata(review.metadata);

  md += '## Overall Assessment\n\n';
  md += formatScore(review.overallScore, 'Style Score') + '\n\n';

  md += '### Summary\n\n';
  md += `| Category | Count |\n|----------|-------|\n`;
  md += `| Total Issues | ${review.styleSummary.totalIssues} |\n`;
  md += `| Critical | ${review.styleSummary.bySeperity.critical || 0} |\n`;
  md += `| Errors | ${review.styleSummary.bySeperity.error || 0} |\n`;
  md += `| Warnings | ${review.styleSummary.bySeperity.warning || 0} |\n`;
  md += `| Info | ${review.styleSummary.bySeperity.info || 0} |\n`;
  md += `| Auto-fixable | ${review.fixableCount} |\n\n`;

  if (review.violations.length > 0) {
    md += '## Style Violations\n\n';
    md += formatIssuesList(review.violations);
  }

  if (review.namingIssues.length > 0) {
    md += '## Naming Issues\n\n';
    for (const ni of review.namingIssues) {
      md += `- **${ni.identifier}** (${ni.type}) in \`${ni.file}:${ni.line}\`\n`;
      md += `  - Convention: ${ni.convention}\n`;
      md += `  - Suggestion: \`${ni.suggestion}\`\n\n`;
    }
  }

  if (review.consistencyIssues.length > 0) {
    md += '## Consistency Issues\n\n';
    for (const ci of review.consistencyIssues) {
      md += `### ${ci.type}\n`;
      md += `${ci.description}\n\n`;
      md += `**Suggestion:** ${ci.suggestion}\n\n`;
    }
  }

  return md;
}

/**
 * Format security report as markdown
 */
export function formatSecurityReport(report: SecurityReport): string {
  let md = '# 🔒 Security Report\n\n';
  md += formatMetadata(report.metadata);

  const riskColors: Record<string, string> = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  };

  md += '## Overall Risk Assessment\n\n';
  md += `${riskColors[report.overallRisk]} **Risk Level:** ${report.overallRisk.toUpperCase()}\n\n`;
  md += formatScore(100 - report.riskScore, 'Security Score') + '\n\n';

  if (report.secretsFound.length > 0) {
    md += '## 🚨 Secrets/Credentials Found\n\n';
    md += '> **CRITICAL:** Remove these immediately!\n\n';
    for (const secret of report.secretsFound) {
      md += `- **${secret.type}** in \`${secret.file}:${secret.line}\`\n`;
      md += `  - Pattern: \`${secret.pattern}\`\n`;
      md += `  - Value: \`${secret.maskedValue}\`\n\n`;
    }
  }

  if (report.vulnerabilities.length > 0) {
    md += '## Vulnerabilities\n\n';
    for (const vuln of report.vulnerabilities) {
      md += `### ${riskColors[vuln.severity]} ${vuln.title}\n`;
      md += `- Type: ${vuln.type}\n`;
      md += `- File: \`${vuln.file}${vuln.line ? `:${vuln.line}` : ''}\`\n`;
      if (vuln.cwe) md += `- CWE: ${vuln.cwe}\n`;
      if (vuln.owasp) md += `- OWASP: ${vuln.owasp}\n`;
      md += `\n${vuln.description}\n\n`;
      md += `**Recommendation:** ${vuln.recommendation}\n\n`;
    }
  }

  if (report.complianceStatus.length > 0) {
    md += '## Compliance Status\n\n';
    md += `| Standard | Status | Findings |\n|----------|--------|----------|\n`;
    for (const cs of report.complianceStatus) {
      const statusIcon = cs.status === 'compliant' ? '✅' :
                        cs.status === 'partial' ? '⚠️' : '❌';
      md += `| ${cs.standard} | ${statusIcon} ${cs.status} | ${cs.findings.length} |\n`;
    }
    md += '\n';
  }

  if (report.recommendations.length > 0) {
    md += '## Security Recommendations\n\n';
    for (const rec of report.recommendations) {
      md += formatRecommendation(rec);
    }
  }

  return md;
}

/**
 * Format accessibility report as markdown
 */
export function formatA11yReport(report: A11yReport): string {
  let md = '# ♿ Accessibility Report\n\n';
  md += formatMetadata(report.metadata);

  const levelIcons: Record<string, string> = {
    'A': '🥉',
    'AA': '🥈',
    'AAA': '🥇',
    'non-compliant': '❌',
  };

  md += '## Compliance Status\n\n';
  md += `${levelIcons[report.complianceLevel]} **Compliance Level:** ${report.complianceLevel}\n\n`;
  md += `**Target Standard:** ${report.targetStandard}\n\n`;
  md += formatScore(report.overallScore, 'Accessibility Score') + '\n\n';

  if (report.violations.length > 0) {
    md += '## WCAG Violations\n\n';
    for (const v of report.violations) {
      md += `### ${v.wcagCriteria} (Level ${v.level})\n`;
      md += `**Impact:** ${v.impact}\n\n`;
      md += `${v.description}\n\n`;
      md += `- File: \`${v.file}${v.line ? `:${v.line}` : ''}\`\n`;
      if (v.element) md += `- Element: \`${v.element}\`\n`;
      md += `\n**Recommendation:** ${v.recommendation}\n`;
      if (v.helpUrl) md += `\n[Learn more](${v.helpUrl})\n`;
      md += '\n';
    }
  }

  if (report.contrastIssues.length > 0) {
    md += '## Color Contrast Issues\n\n';
    md += `| Element | Ratio | Required | Level |\n|---------|-------|----------|-------|\n`;
    for (const ci of report.contrastIssues) {
      md += `| \`${ci.element}\` | ${ci.ratio.toFixed(2)} | ${ci.requiredRatio} | ${ci.level} |\n`;
    }
    md += '\n';
  }

  md += '## Certification Readiness\n\n';
  md += `${report.certificationReadiness.ready ? '✅' : '❌'} **Ready:** ${report.certificationReadiness.ready ? 'Yes' : 'No'}\n\n`;
  md += formatScore(report.certificationReadiness.score, 'Readiness Score') + '\n\n';

  if (report.certificationReadiness.blockers.length > 0) {
    md += '### Blockers\n\n';
    for (const b of report.certificationReadiness.blockers) {
      md += `- ❌ ${b}\n`;
    }
    md += '\n';
  }

  if (report.recommendations.length > 0) {
    md += '## Recommendations\n\n';
    for (const rec of report.recommendations) {
      md += formatRecommendation(rec);
    }
  }

  return md;
}

/**
 * Format review result for hooks
 */
export function formatReviewResult(result: ReviewResult): string {
  const statusIcon = result.passed ? '✅' : '❌';

  let md = `# ${statusIcon} ${result.agent.toUpperCase()} Review\n\n`;
  md += `**Trigger:** ${result.trigger}\n`;
  md += `**Time:** ${new Date(result.timestamp).toISOString()}\n`;
  md += `**Result:** ${result.passed ? 'PASSED' : 'FAILED'}\n\n`;
  md += `## Summary\n\n${result.summary}\n\n`;

  if (result.blockers.length > 0) {
    md += '## 🚫 Blockers\n\n';
    for (const b of result.blockers) {
      md += formatIssue(b);
    }
  }

  if (result.warnings.length > 0) {
    md += '## ⚠️ Warnings\n\n';
    for (const w of result.warnings) {
      md += formatIssue(w);
    }
  }

  return md;
}

// ═══════════════════════════════════════════════════════════════════
// JSON FORMATTERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Format report as SARIF (Static Analysis Results Interchange Format)
 */
export function formatAsSarif(
  issues: CodeIssue[],
  toolName: string,
  toolVersion: string
): object {
  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: toolName,
            version: toolVersion,
            rules: [],
          },
        },
        results: issues.map((issue, index) => ({
          ruleId: issue.rule || `rule-${index}`,
          level: severityToSarifLevel(issue.severity),
          message: {
            text: issue.message,
          },
          locations: issue.file
            ? [
                {
                  physicalLocation: {
                    artifactLocation: {
                      uri: issue.file,
                    },
                    region: issue.line
                      ? {
                          startLine: issue.line,
                          startColumn: issue.column,
                          endLine: issue.endLine,
                          endColumn: issue.endColumn,
                        }
                      : undefined,
                  },
                },
              ]
            : [],
        })),
      },
    ],
  };
}

function severityToSarifLevel(severity: Severity): string {
  const map: Record<Severity, string> = {
    info: 'note',
    warning: 'warning',
    error: 'error',
    critical: 'error',
  };
  return map[severity];
}

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function groupBySeverity(issues: CodeIssue[]): Record<Severity, CodeIssue[]> {
  return {
    info: issues.filter(i => i.severity === 'info'),
    warning: issues.filter(i => i.severity === 'warning'),
    error: issues.filter(i => i.severity === 'error'),
    critical: issues.filter(i => i.severity === 'critical'),
  };
}
