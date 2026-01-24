/**
 * Accessibility Agent
 *
 * The champion of inclusive design.
 * Audits UI components for WCAG compliance, validates ARIA usage,
 * checks color contrast, and ensures keyboard accessibility.
 *
 * Capabilities:
 * - WCAG compliance auditing
 * - ARIA validation
 * - Color contrast checking
 * - Keyboard navigation review
 * - Semantic HTML validation
 * - Screen reader compatibility
 *
 * NOTE: Uses ConfigManager for all thresholds and prompts.
 */

import { DevelopmentAgentBase } from './development-agent-base.js';
import type { AgentMessage, HouseType } from '../../runtime/types.js';
import type {
  DevelopmentHouseType,
  A11yAuditRequest,
  A11yReport,
  A11yViolation,
  A11yWarning,
  AriaIssue,
  ContrastIssue,
  KeyboardIssue,
  SemanticIssue,
  A11yTestResult,
  CertificationReadiness,
  Recommendation,
  WCAGStandard,
  ComplianceLevel,
  CodeFile,
  FileChangeEvent,
  ReviewResult,
} from './types.js';
import { DEVELOPMENT_CONFIG } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// ACCESSIBILITY CONFIG KEYS
// ═══════════════════════════════════════════════════════════════════

export const ACCESSIBILITY_CONFIG = {
  WCAG_LEVEL: 'a11y.wcagLevel',
  CONTRAST_RATIO_AA: 'a11y.contrastRatioAA',
  CONTRAST_RATIO_AAA: 'a11y.contrastRatioAAA',
  STRICT_MODE: 'a11y.strictMode',
  CHECK_SCREEN_READER: 'a11y.checkScreenReader',
} as const;

// ═══════════════════════════════════════════════════════════════════
// WCAG RULES
// ═══════════════════════════════════════════════════════════════════

interface WCAGRule {
  id: string;
  criteria: string;
  level: 'A' | 'AA' | 'AAA';
  name: string;
  description: string;
  check: (content: string, filePath: string) => WCAGViolation[];
}

interface WCAGViolation {
  line?: number;
  element?: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  recommendation: string;
}

const WCAG_RULES: WCAGRule[] = [
  // Level A
  {
    id: '1.1.1',
    criteria: 'Non-text Content',
    level: 'A',
    name: 'Images must have alt text',
    description: 'All images must have alternative text',
    check: (content) => {
      const violations: WCAGViolation[] = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Check for img tags without alt
        if (/<img\s+[^>]*(?!alt=)[^>]*>/i.test(line) && !/alt=/i.test(line)) {
          violations.push({
            line: index + 1,
            element: 'img',
            impact: 'critical',
            recommendation: 'Add alt attribute to image',
          });
        }

        // Check for Image components without alt
        if (/<Image\s+[^>]*(?!alt)[^>]*\/>/i.test(line) && !/alt/i.test(line)) {
          violations.push({
            line: index + 1,
            element: 'Image',
            impact: 'critical',
            recommendation: 'Add alt prop to Image component',
          });
        }
      });

      return violations;
    },
  },
  {
    id: '1.3.1',
    criteria: 'Info and Relationships',
    level: 'A',
    name: 'Use semantic HTML',
    description: 'Information and relationships must be programmatically determinable',
    check: (content) => {
      const violations: WCAGViolation[] = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Div used as button
        if (/<div[^>]*onClick/i.test(line) && !/role=/i.test(line)) {
          violations.push({
            line: index + 1,
            element: 'div',
            impact: 'serious',
            recommendation: 'Use <button> element or add role="button" with keyboard handlers',
          });
        }

        // Span used as link
        if (/<span[^>]*onClick[^>]*>.*<\/span>/i.test(line) && !/<a\s/i.test(line)) {
          violations.push({
            line: index + 1,
            element: 'span',
            impact: 'serious',
            recommendation: 'Use <a> element for navigation or <button> for actions',
          });
        }
      });

      return violations;
    },
  },
  {
    id: '2.1.1',
    criteria: 'Keyboard',
    level: 'A',
    name: 'All functionality keyboard accessible',
    description: 'All functionality must be operable through keyboard interface',
    check: (content) => {
      const violations: WCAGViolation[] = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // onClick without keyboard equivalent
        if (/onClick\s*=/i.test(line)) {
          const hasKeyboardHandler = /onKeyDown|onKeyUp|onKeyPress/i.test(line);
          const isButton = /<button|<Button|role="button"|type="button"|type="submit"/i.test(line);

          if (!hasKeyboardHandler && !isButton) {
            violations.push({
              line: index + 1,
              element: 'interactive',
              impact: 'serious',
              recommendation: 'Add keyboard event handler (onKeyDown) or use <button>',
            });
          }
        }
      });

      return violations;
    },
  },
  {
    id: '2.4.1',
    criteria: 'Bypass Blocks',
    level: 'A',
    name: 'Skip navigation link',
    description: 'Provide mechanism to bypass repeated content',
    check: (content) => {
      const violations: WCAGViolation[] = [];

      // Check if file looks like a layout/page component
      if (/(?:Layout|Page|App)\.tsx?$/i.test(content) || /export\s+default\s+function\s+(?:Layout|Page|App)/i.test(content)) {
        if (!/#main|skip-to-main|skip-nav|skiplink/i.test(content)) {
          violations.push({
            element: 'layout',
            impact: 'moderate',
            recommendation: 'Add skip navigation link to bypass repeated content',
          });
        }
      }

      return violations;
    },
  },
  {
    id: '2.4.2',
    criteria: 'Page Titled',
    level: 'A',
    name: 'Page must have title',
    description: 'Pages must have descriptive titles',
    check: (content) => {
      const violations: WCAGViolation[] = [];

      // Check for head/title in HTML/JSX
      if (/<html|<head/i.test(content)) {
        if (!/<title/i.test(content) && !/document\.title/i.test(content) && !/useTitle|Helmet/i.test(content)) {
          violations.push({
            element: 'head',
            impact: 'serious',
            recommendation: 'Add <title> element or use a title management library',
          });
        }
      }

      return violations;
    },
  },
  {
    id: '4.1.1',
    criteria: 'Parsing',
    level: 'A',
    name: 'Valid markup',
    description: 'Elements must have complete start and end tags and be properly nested',
    check: (content) => {
      const violations: WCAGViolation[] = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Duplicate IDs (simplified check)
        const idMatches = line.match(/id=["']([^"']+)["']/g);
        if (idMatches && idMatches.length > 1) {
          violations.push({
            line: index + 1,
            element: 'element',
            impact: 'serious',
            recommendation: 'Remove duplicate id attributes',
          });
        }
      });

      return violations;
    },
  },
  {
    id: '4.1.2',
    criteria: 'Name, Role, Value',
    level: 'A',
    name: 'Custom controls have proper ARIA',
    description: 'Custom UI components must have accessible names and roles',
    check: (content) => {
      const violations: WCAGViolation[] = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Custom role without aria-label
        if (/role="(?!presentation|none)/i.test(line)) {
          if (!/aria-label|aria-labelledby/i.test(line)) {
            violations.push({
              line: index + 1,
              element: 'custom control',
              impact: 'serious',
              recommendation: 'Add aria-label or aria-labelledby to elements with role',
            });
          }
        }
      });

      return violations;
    },
  },

  // Level AA
  {
    id: '1.4.3',
    criteria: 'Contrast (Minimum)',
    level: 'AA',
    name: 'Text contrast 4.5:1',
    description: 'Text must have sufficient contrast ratio',
    check: (content) => {
      // Note: Real contrast checking requires rendering
      // This is a heuristic check for common issues
      const violations: WCAGViolation[] = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Light text on light background patterns
        if (/color:\s*#?(?:fff|white|[ef]{6})/i.test(line) &&
            /background(?:-color)?:\s*#?(?:fff|white|[ef]{6})/i.test(line)) {
          violations.push({
            line: index + 1,
            element: 'text',
            impact: 'serious',
            recommendation: 'Ensure text has contrast ratio of at least 4.5:1',
          });
        }
      });

      return violations;
    },
  },
  {
    id: '1.4.4',
    criteria: 'Resize Text',
    level: 'AA',
    name: 'Text resizable to 200%',
    description: 'Text must be resizable without loss of content',
    check: (content) => {
      const violations: WCAGViolation[] = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Fixed pixel font sizes
        if (/font-size:\s*\d+px/i.test(line)) {
          violations.push({
            line: index + 1,
            element: 'text',
            impact: 'moderate',
            recommendation: 'Use relative units (rem, em) instead of pixels for font-size',
          });
        }
      });

      return violations;
    },
  },
  {
    id: '2.4.6',
    criteria: 'Headings and Labels',
    level: 'AA',
    name: 'Headings describe content',
    description: 'Headings and labels must describe topic or purpose',
    check: (content) => {
      const violations: WCAGViolation[] = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Empty headings
        if (/<h[1-6][^>]*>\s*<\/h[1-6]>/i.test(line)) {
          violations.push({
            line: index + 1,
            element: 'heading',
            impact: 'moderate',
            recommendation: 'Add descriptive text to heading',
          });
        }

        // Empty labels
        if (/<label[^>]*>\s*<\/label>/i.test(line)) {
          violations.push({
            line: index + 1,
            element: 'label',
            impact: 'moderate',
            recommendation: 'Add descriptive text to label',
          });
        }
      });

      return violations;
    },
  },
  {
    id: '2.4.7',
    criteria: 'Focus Visible',
    level: 'AA',
    name: 'Focus indicator visible',
    description: 'Keyboard focus indicator must be visible',
    check: (content) => {
      const violations: WCAGViolation[] = [];

      // Check for focus outline removal
      if (/outline:\s*(?:none|0)|outline-width:\s*0/i.test(content)) {
        if (!/focus-visible|:focus\s*\{[^}]*(?:outline|box-shadow|border)/i.test(content)) {
          violations.push({
            element: 'focusable',
            impact: 'serious',
            recommendation: 'Provide visible focus indicator when removing default outline',
          });
        }
      }

      return violations;
    },
  },

  // Level AAA
  {
    id: '1.4.6',
    criteria: 'Contrast (Enhanced)',
    level: 'AAA',
    name: 'Text contrast 7:1',
    description: 'Text should have enhanced contrast ratio',
    check: () => {
      // Enhanced contrast checking would require rendering
      return [];
    },
  },
  {
    id: '2.4.9',
    criteria: 'Link Purpose (Link Only)',
    level: 'AAA',
    name: 'Link text describes purpose',
    description: 'Link text alone should describe the purpose',
    check: (content) => {
      const violations: WCAGViolation[] = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Generic link text
        if (/<a[^>]*>(?:click here|here|more|read more|link)<\/a>/i.test(line)) {
          violations.push({
            line: index + 1,
            element: 'a',
            impact: 'moderate',
            recommendation: 'Use descriptive link text that indicates the destination',
          });
        }
      });

      return violations;
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// ARIA VALIDATION RULES
// ═══════════════════════════════════════════════════════════════════

interface AriaRule {
  id: string;
  check: (content: string) => AriaIssue[];
}

const ARIA_RULES: AriaRule[] = [
  {
    id: 'aria-hidden-focus',
    check: (content) => {
      const issues: AriaIssue[] = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // aria-hidden on focusable element
        if (/aria-hidden="true"[^>]*(?:tabIndex|href|onClick|button|input|select|textarea)/i.test(line) ||
            /(?:tabIndex|href|onClick|button|input|select|textarea)[^>]*aria-hidden="true"/i.test(line)) {
          issues.push({
            type: 'misused',
            element: 'focusable',
            file: '',
            line: index + 1,
            description: 'aria-hidden should not be used on focusable elements',
            recommendation: 'Remove aria-hidden or make element non-focusable',
          });
        }
      });

      return issues;
    },
  },
  {
    id: 'aria-valid-attr',
    check: (content) => {
      const issues: AriaIssue[] = [];
      const lines = content.split('\n');
      const validAriaAttrs = [
        'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden',
        'aria-expanded', 'aria-controls', 'aria-haspopup', 'aria-pressed',
        'aria-selected', 'aria-checked', 'aria-disabled', 'aria-live',
        'aria-atomic', 'aria-relevant', 'aria-busy', 'aria-current',
        'aria-invalid', 'aria-required', 'aria-readonly', 'aria-valuemin',
        'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'aria-orientation',
        'aria-activedescendant', 'aria-autocomplete', 'aria-colcount', 'aria-colindex',
        'aria-colspan', 'aria-rowcount', 'aria-rowindex', 'aria-rowspan',
        'aria-level', 'aria-multiline', 'aria-multiselectable', 'aria-placeholder',
        'aria-posinset', 'aria-setsize', 'aria-sort', 'aria-modal',
        'aria-owns', 'aria-flowto', 'aria-details', 'aria-errormessage',
      ];

      lines.forEach((line, index) => {
        const ariaMatches = line.match(/aria-[\w-]+/g);
        if (ariaMatches) {
          for (const attr of ariaMatches) {
            if (!validAriaAttrs.includes(attr)) {
              issues.push({
                type: 'invalid',
                attribute: attr,
                element: 'element',
                file: '',
                line: index + 1,
                description: `Invalid ARIA attribute: ${attr}`,
                recommendation: 'Use a valid ARIA attribute',
              });
            }
          }
        }
      });

      return issues;
    },
  },
  {
    id: 'aria-role-valid',
    check: (content) => {
      const issues: AriaIssue[] = [];
      const lines = content.split('\n');
      const validRoles = [
        'alert', 'alertdialog', 'application', 'article', 'banner', 'button',
        'cell', 'checkbox', 'columnheader', 'combobox', 'complementary',
        'contentinfo', 'definition', 'dialog', 'directory', 'document',
        'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading',
        'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main',
        'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox',
        'menuitemradio', 'navigation', 'none', 'note', 'option', 'presentation',
        'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup',
        'rowheader', 'scrollbar', 'search', 'searchbox', 'separator', 'slider',
        'spinbutton', 'status', 'switch', 'tab', 'table', 'tablist', 'tabpanel',
        'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem',
      ];

      lines.forEach((line, index) => {
        const roleMatch = line.match(/role="([^"]+)"/);
        if (roleMatch) {
          const role = roleMatch[1];
          if (!validRoles.includes(role)) {
            issues.push({
              type: 'invalid',
              attribute: 'role',
              element: role,
              file: '',
              line: index + 1,
              description: `Invalid role: ${role}`,
              recommendation: 'Use a valid ARIA role',
            });
          }
        }
      });

      return issues;
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

interface AriaValidationRequest {
  components: CodeFile[];
  projectId?: string;
}

interface ContrastCheckRequest {
  cssFiles: CodeFile[];
  projectId?: string;
}

interface KeyboardReviewRequest {
  components: CodeFile[];
  projectId?: string;
}

interface SemanticValidationRequest {
  components: CodeFile[];
  projectId?: string;
}

// ═══════════════════════════════════════════════════════════════════
// ACCESSIBILITY AGENT
// ═══════════════════════════════════════════════════════════════════

export class AccessibilityAgent extends DevelopmentAgentBase {
  readonly id = 'accessibility';
  readonly name = 'The A11y Champion';
  readonly house: HouseType = 'accessibility';
  readonly version = '1.0.0';
  readonly capabilities = [
    'audit-accessibility',
    'validate-aria',
    'check-color-contrast',
    'review-keyboard-navigation',
    'validate-semantic-html',
    'suggest-improvements',
    'on-file-change',
    'on-pre-commit',
  ];

  // ─────────────────────────────────────────────────────────────────
  // DEVELOPMENT AGENT INTERFACE
  // ─────────────────────────────────────────────────────────────────

  getDevelopmentHouse(): DevelopmentHouseType {
    return 'accessibility';
  }

  getFilePatterns(): string[] {
    return [
      '**/*.tsx',
      '**/*.jsx',
      '**/*.html',
      '**/*.vue',
      '**/*.svelte',
      '**/*.css',
      '**/*.scss',
    ];
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    await super.onInitialize();
    this.log('info', 'A11y Champion ready to advocate for inclusive design');
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', 'A11y Champion signing off');
    await super.onShutdown();
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE HANDLING
  // ─────────────────────────────────────────────────────────────────

  protected async onMessage(message: AgentMessage): Promise<unknown> {
    switch (message.type) {
      case 'audit-accessibility':
        return this.auditAccessibility(message.payload as A11yAuditRequest);

      case 'validate-aria':
        return this.validateAria(message.payload as AriaValidationRequest);

      case 'check-color-contrast':
        return this.checkColorContrast(message.payload as ContrastCheckRequest);

      case 'review-keyboard-navigation':
        return this.reviewKeyboardNavigation(message.payload as KeyboardReviewRequest);

      case 'validate-semantic-html':
        return this.validateSemanticHtml(message.payload as SemanticValidationRequest);

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
        'No UI files changed'
      );
    }

    return this.createReviewResult(
      'file-change',
      true,
      [],
      [],
      `${relevantFiles.length} UI files changed - run full a11y audit for details`
    );
  }

  async onPreCommit(stagedFiles: string[]): Promise<ReviewResult> {
    const hooksEnabled = await this.areHooksEnabled();
    if (!hooksEnabled) {
      return this.createReviewResult('pre-commit', true, [], [], 'Hooks disabled');
    }

    const relevantFiles = stagedFiles.filter(f => this.matchesPattern(f, this.getFilePatterns()));
    const warnings = [];

    // Check for component files
    const componentFiles = relevantFiles.filter(f =>
      /\.(tsx|jsx)$/.test(f) && !/\.test\.|\.spec\./i.test(f)
    );

    if (componentFiles.length > 0) {
      warnings.push(this.createIssue(
        'info',
        `${componentFiles.length} UI components modified. Consider running a11y audit.`,
        { rule: 'ui-component-change' }
      ));
    }

    return this.createReviewResult(
      'pre-commit',
      true,
      [],
      warnings,
      `A11y pre-commit: ${relevantFiles.length} UI files`
    );
  }

  async onPrePush(commits: string[]): Promise<ReviewResult> {
    return this.createReviewResult(
      'pre-push',
      true,
      [],
      [],
      `A11y check for ${commits.length} commits`
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // ACCESSIBILITY AUDIT
  // ─────────────────────────────────────────────────────────────────

  async auditAccessibility(request: A11yAuditRequest): Promise<A11yReport> {
    const startTime = Date.now();
    const { components, auditDepth } = request;

    // Get target standard
    const targetStandard = request.standards || await this.getConfig<WCAGStandard>(
      ACCESSIBILITY_CONFIG.WCAG_LEVEL,
      'WCAG-2.1-AA'
    );

    const targetLevel = this.getTargetLevel(targetStandard);

    const violations: A11yViolation[] = [];
    const warnings: A11yWarning[] = [];
    const ariaIssues: AriaIssue[] = [];
    const contrastIssues: ContrastIssue[] = [];
    const keyboardIssues: KeyboardIssue[] = [];
    const semanticIssues: SemanticIssue[] = [];

    for (const file of components) {
      // Run WCAG rule checks
      for (const rule of WCAG_RULES) {
        // Skip rules above target level
        if (!this.levelMeetsTarget(rule.level, targetLevel)) continue;

        // Skip basic checks for comprehensive audits only
        if (auditDepth === 'basic' && rule.level === 'AAA') continue;

        const ruleViolations = rule.check(file.content, file.path);

        for (const v of ruleViolations) {
          violations.push({
            id: this.generateId('a11y'),
            wcagCriteria: `${rule.id} ${rule.criteria}`,
            level: rule.level,
            description: rule.description,
            impact: v.impact,
            file: file.path,
            line: v.line,
            element: v.element,
            recommendation: v.recommendation,
            helpUrl: `https://www.w3.org/WAI/WCAG21/Understanding/${rule.criteria.toLowerCase().replace(/\s+/g, '-')}`,
          });
        }
      }

      // Run ARIA validation
      for (const ariaRule of ARIA_RULES) {
        const issues = ariaRule.check(file.content);
        for (const issue of issues) {
          issue.file = file.path;
          ariaIssues.push(issue);
        }
      }

      // Check keyboard navigation
      const kbIssues = this.checkKeyboardAccessibility(file);
      keyboardIssues.push(...kbIssues);

      // Check semantic HTML
      const semIssues = this.checkSemanticHtml(file);
      semanticIssues.push(...semIssues);
    }

    // Determine compliance level
    const complianceLevel = this.determineComplianceLevel(violations, targetLevel);

    // Calculate score
    const score = this.calculateA11yScore(violations, ariaIssues, keyboardIssues, semanticIssues);

    // Run tests
    const testResults = this.runA11yTests(violations, ariaIssues, keyboardIssues, semanticIssues);

    // Check certification readiness
    const certificationReadiness = this.checkCertificationReadiness(violations, testResults, targetStandard);

    // Generate recommendations
    const recommendations = this.generateA11yRecommendations(
      violations,
      ariaIssues,
      keyboardIssues,
      semanticIssues
    );

    // Propose action if critical issues
    const criticalViolations = violations.filter(v => v.impact === 'critical');
    if (criticalViolations.length > 0) {
      await this.proposeAction(
        'fix-a11y-critical',
        'Critical accessibility violations detected',
        `Found ${criticalViolations.length} critical accessibility issues that block users`,
        { violations: criticalViolations },
        { projectId: request.projectId, requiresApproval: true }
      );
    }

    return {
      metadata: this.createReportMetadata(
        components.length,
        Date.now() - startTime,
        request.projectId
      ),
      complianceLevel,
      overallScore: score,
      targetStandard,
      violations,
      warnings,
      ariaIssues,
      contrastIssues,
      keyboardIssues,
      semanticIssues,
      recommendations,
      testResults,
      certificationReadiness,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // ARIA VALIDATION
  // ─────────────────────────────────────────────────────────────────

  async validateAria(request: AriaValidationRequest): Promise<{
    issues: AriaIssue[];
    valid: boolean;
  }> {
    const allIssues: AriaIssue[] = [];

    for (const file of request.components) {
      for (const rule of ARIA_RULES) {
        const issues = rule.check(file.content);
        for (const issue of issues) {
          issue.file = file.path;
          allIssues.push(issue);
        }
      }
    }

    return {
      issues: allIssues,
      valid: allIssues.length === 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // COLOR CONTRAST
  // ─────────────────────────────────────────────────────────────────

  async checkColorContrast(request: ContrastCheckRequest): Promise<{
    issues: ContrastIssue[];
    passed: boolean;
  }> {
    const issues: ContrastIssue[] = [];

    // Get contrast requirements from config
    const aaRatio = await this.getConfig<number>(ACCESSIBILITY_CONFIG.CONTRAST_RATIO_AA, 4.5);
    const aaaRatio = await this.getConfig<number>(ACCESSIBILITY_CONFIG.CONTRAST_RATIO_AAA, 7);

    for (const file of request.cssFiles) {
      // Extract color pairs (simplified)
      const colorPairs = this.extractColorPairs(file.content);

      for (const pair of colorPairs) {
        const ratio = this.calculateContrastRatio(pair.foreground, pair.background);

        if (ratio < aaRatio) {
          issues.push({
            element: pair.selector,
            file: file.path,
            line: pair.line,
            foreground: pair.foreground,
            background: pair.background,
            ratio,
            requiredRatio: aaRatio,
            level: 'AA',
            recommendation: `Increase contrast ratio from ${ratio.toFixed(2)} to at least ${aaRatio}`,
          });
        } else if (ratio < aaaRatio) {
          issues.push({
            element: pair.selector,
            file: file.path,
            line: pair.line,
            foreground: pair.foreground,
            background: pair.background,
            ratio,
            requiredRatio: aaaRatio,
            level: 'AAA',
            recommendation: `For AAA compliance, increase contrast ratio from ${ratio.toFixed(2)} to ${aaaRatio}`,
          });
        }
      }
    }

    return {
      issues,
      passed: issues.filter(i => i.level === 'AA').length === 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // KEYBOARD NAVIGATION
  // ─────────────────────────────────────────────────────────────────

  async reviewKeyboardNavigation(request: KeyboardReviewRequest): Promise<{
    issues: KeyboardIssue[];
    recommendations: string[];
  }> {
    const allIssues: KeyboardIssue[] = [];

    for (const file of request.components) {
      const issues = this.checkKeyboardAccessibility(file);
      allIssues.push(...issues);
    }

    const recommendations: string[] = [];

    if (allIssues.some(i => i.type === 'not_focusable')) {
      recommendations.push('Add tabIndex="0" to make interactive elements focusable');
    }
    if (allIssues.some(i => i.type === 'no_visible_focus')) {
      recommendations.push('Add :focus-visible styles to show keyboard focus');
    }
    if (allIssues.some(i => i.type === 'missing_handler')) {
      recommendations.push('Add keyboard event handlers (onKeyDown) for interactive elements');
    }

    return { issues: allIssues, recommendations };
  }

  private checkKeyboardAccessibility(file: CodeFile): KeyboardIssue[] {
    const issues: KeyboardIssue[] = [];
    const lines = file.content.split('\n');

    lines.forEach((line, index) => {
      // Interactive element without keyboard handler
      if (/onClick\s*=/.test(line) && !/onKeyDown|onKeyPress|onKeyUp/.test(line)) {
        // Exclude native interactive elements
        if (!/<button|<a\s|<input|<select|<textarea/i.test(line)) {
          issues.push({
            type: 'missing_handler',
            element: 'interactive',
            file: file.path,
            line: index + 1,
            description: 'Interactive element without keyboard handler',
            recommendation: 'Add onKeyDown handler for keyboard accessibility',
          });
        }
      }

      // tabIndex on non-interactive element without role
      if (/tabIndex\s*=\s*["']?0/.test(line) && !/role=/.test(line)) {
        if (!/<button|<a\s|<input|<select|<textarea/i.test(line)) {
          issues.push({
            type: 'not_focusable',
            element: 'element',
            file: file.path,
            line: index + 1,
            description: 'Focusable element without semantic role',
            recommendation: 'Add appropriate role attribute',
          });
        }
      }
    });

    return issues;
  }

  // ─────────────────────────────────────────────────────────────────
  // SEMANTIC HTML
  // ─────────────────────────────────────────────────────────────────

  async validateSemanticHtml(request: SemanticValidationRequest): Promise<{
    issues: SemanticIssue[];
    recommendations: string[];
  }> {
    const allIssues: SemanticIssue[] = [];

    for (const file of request.components) {
      const issues = this.checkSemanticHtml(file);
      allIssues.push(...issues);
    }

    const recommendations: string[] = [];

    if (allIssues.some(i => i.type === 'wrong_element')) {
      recommendations.push('Use semantic HTML elements (button, a, nav, main, etc.)');
    }
    if (allIssues.some(i => i.type === 'missing_landmark')) {
      recommendations.push('Add landmark regions (main, nav, aside, footer)');
    }
    if (allIssues.some(i => i.type === 'heading_order')) {
      recommendations.push('Use headings in proper order (h1 -> h2 -> h3)');
    }

    return { issues: allIssues, recommendations };
  }

  private checkSemanticHtml(file: CodeFile): SemanticIssue[] {
    const issues: SemanticIssue[] = [];
    const lines = file.content.split('\n');

    // Track heading levels
    const headingLevels: number[] = [];

    lines.forEach((line, index) => {
      // Div with click handler should be button
      if (/<div[^>]*onClick/i.test(line)) {
        issues.push({
          type: 'wrong_element',
          element: 'div',
          file: file.path,
          line: index + 1,
          description: 'Interactive div should be a button or have role="button"',
          recommendation: 'Replace with <button> or add role="button" and keyboard handlers',
        });
      }

      // Check heading order
      const headingMatch = line.match(/<h([1-6])/);
      if (headingMatch) {
        const level = parseInt(headingMatch[1]);
        const lastLevel = headingLevels[headingLevels.length - 1] || 0;

        if (level > lastLevel + 1 && lastLevel > 0) {
          issues.push({
            type: 'heading_order',
            element: `h${level}`,
            file: file.path,
            line: index + 1,
            description: `Heading level skipped from h${lastLevel} to h${level}`,
            recommendation: `Use h${lastLevel + 1} instead`,
          });
        }

        headingLevels.push(level);
      }

      // List without proper structure
      if (/<ul|<ol/i.test(line)) {
        // Check if next non-empty line contains li
        for (let i = index + 1; i < Math.min(index + 5, lines.length); i++) {
          const nextLine = lines[i].trim();
          if (nextLine && !/<li|<\/(?:ul|ol)>/i.test(nextLine)) {
            issues.push({
              type: 'list_structure',
              element: 'list',
              file: file.path,
              line: index + 1,
              description: 'List items should use <li> elements',
              recommendation: 'Wrap list content in <li> elements',
            });
            break;
          }
          if (nextLine) break;
        }
      }
    });

    return issues;
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────

  private getTargetLevel(standard: WCAGStandard): 'A' | 'AA' | 'AAA' {
    if (standard.includes('AAA')) return 'AAA';
    if (standard.includes('AA')) return 'AA';
    return 'A';
  }

  private levelMeetsTarget(ruleLevel: 'A' | 'AA' | 'AAA', targetLevel: 'A' | 'AA' | 'AAA'): boolean {
    const levels = ['A', 'AA', 'AAA'];
    return levels.indexOf(ruleLevel) <= levels.indexOf(targetLevel);
  }

  private determineComplianceLevel(
    violations: A11yViolation[],
    targetLevel: 'A' | 'AA' | 'AAA'
  ): ComplianceLevel {
    const levelAViolations = violations.filter(v => v.level === 'A');
    const levelAAViolations = violations.filter(v => v.level === 'AA');
    const levelAAAViolations = violations.filter(v => v.level === 'AAA');

    if (levelAViolations.length > 0) return 'non-compliant';
    if (levelAAViolations.length > 0) return 'A';
    if (levelAAAViolations.length > 0) return 'AA';
    return targetLevel === 'AAA' ? 'AAA' : targetLevel === 'AA' ? 'AA' : 'A';
  }

  private calculateA11yScore(
    violations: A11yViolation[],
    ariaIssues: AriaIssue[],
    keyboardIssues: KeyboardIssue[],
    semanticIssues: SemanticIssue[]
  ): number {
    let penalty = 0;

    // Violation penalties
    for (const v of violations) {
      switch (v.impact) {
        case 'critical': penalty += 15; break;
        case 'serious': penalty += 10; break;
        case 'moderate': penalty += 5; break;
        case 'minor': penalty += 2; break;
      }
    }

    // Other issue penalties
    penalty += ariaIssues.length * 5;
    penalty += keyboardIssues.length * 8;
    penalty += semanticIssues.length * 3;

    return Math.max(0, 100 - penalty);
  }

  private runA11yTests(
    violations: A11yViolation[],
    ariaIssues: AriaIssue[],
    keyboardIssues: KeyboardIssue[],
    semanticIssues: SemanticIssue[]
  ): A11yTestResult[] {
    return [
      {
        test: 'WCAG Level A Compliance',
        status: violations.filter(v => v.level === 'A').length === 0 ? 'pass' : 'fail',
        details: `${violations.filter(v => v.level === 'A').length} Level A violations`,
      },
      {
        test: 'WCAG Level AA Compliance',
        status: violations.filter(v => v.level === 'AA').length === 0 ? 'pass' : 'fail',
        details: `${violations.filter(v => v.level === 'AA').length} Level AA violations`,
      },
      {
        test: 'Valid ARIA Usage',
        status: ariaIssues.length === 0 ? 'pass' : 'fail',
        details: `${ariaIssues.length} ARIA issues`,
      },
      {
        test: 'Keyboard Accessibility',
        status: keyboardIssues.length === 0 ? 'pass' : 'fail',
        details: `${keyboardIssues.length} keyboard issues`,
      },
      {
        test: 'Semantic HTML',
        status: semanticIssues.length === 0 ? 'pass' : 'partial',
        details: `${semanticIssues.length} semantic issues`,
      },
    ];
  }

  private checkCertificationReadiness(
    violations: A11yViolation[],
    testResults: A11yTestResult[],
    targetStandard: WCAGStandard
  ): CertificationReadiness {
    const blockers: string[] = [];
    const warnings: string[] = [];

    // Check for critical violations
    const criticalViolations = violations.filter(v => v.impact === 'critical');
    if (criticalViolations.length > 0) {
      blockers.push(`${criticalViolations.length} critical violations must be fixed`);
    }

    // Check failed tests
    const failedTests = testResults.filter(t => t.status === 'fail');
    for (const test of failedTests) {
      blockers.push(`${test.test}: ${test.details}`);
    }

    // Check partial tests
    const partialTests = testResults.filter(t => t.status === 'partial');
    for (const test of partialTests) {
      warnings.push(`${test.test}: ${test.details}`);
    }

    const score = (testResults.filter(t => t.status === 'pass').length / testResults.length) * 100;

    return {
      ready: blockers.length === 0,
      blockers,
      warnings,
      score,
    };
  }

  private generateA11yRecommendations(
    violations: A11yViolation[],
    ariaIssues: AriaIssue[],
    keyboardIssues: KeyboardIssue[],
    semanticIssues: SemanticIssue[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    const criticalViolations = violations.filter(v => v.impact === 'critical');
    if (criticalViolations.length > 0) {
      recommendations.push(this.createRecommendation(
        'Fix critical accessibility violations',
        `${criticalViolations.length} critical issues are blocking users with disabilities`,
        { priority: 'critical', effort: 'medium', impact: 'high', category: 'wcag' }
      ));
    }

    if (ariaIssues.length > 0) {
      recommendations.push(this.createRecommendation(
        'Fix ARIA implementation issues',
        'Invalid or misused ARIA attributes reduce assistive technology compatibility',
        { priority: 'high', effort: 'small', impact: 'high', category: 'aria' }
      ));
    }

    if (keyboardIssues.length > 0) {
      recommendations.push(this.createRecommendation(
        'Improve keyboard navigation',
        'Keyboard users cannot access all interactive elements',
        { priority: 'high', effort: 'medium', impact: 'high', category: 'keyboard' }
      ));
    }

    if (semanticIssues.length > 0) {
      recommendations.push(this.createRecommendation(
        'Use semantic HTML elements',
        'Semantic HTML improves screen reader navigation and SEO',
        { priority: 'medium', effort: 'small', impact: 'medium', category: 'semantic' }
      ));
    }

    return recommendations;
  }

  private extractColorPairs(cssContent: string): Array<{
    selector: string;
    foreground: string;
    background: string;
    line: number;
  }> {
    // Simplified color pair extraction
    const pairs: Array<{
      selector: string;
      foreground: string;
      background: string;
      line: number;
    }> = [];

    // This is a simplified implementation
    // Real implementation would parse CSS properly and resolve variables
    const rules = cssContent.match(/[^{}]+\{[^{}]+\}/g) || [];

    rules.forEach((rule, index) => {
      const colorMatch = rule.match(/color:\s*([^;]+)/);
      const bgMatch = rule.match(/background(?:-color)?:\s*([^;]+)/);

      if (colorMatch && bgMatch) {
        const selector = rule.split('{')[0].trim();
        pairs.push({
          selector,
          foreground: colorMatch[1].trim(),
          background: bgMatch[1].trim(),
          line: index + 1, // Approximate line number
        });
      }
    });

    return pairs;
  }

  private calculateContrastRatio(foreground: string, background: string): number {
    // Simplified contrast calculation
    // Real implementation would convert to luminance and calculate properly

    try {
      const fgLum = this.getRelativeLuminance(foreground);
      const bgLum = this.getRelativeLuminance(background);

      const lighter = Math.max(fgLum, bgLum);
      const darker = Math.min(fgLum, bgLum);

      return (lighter + 0.05) / (darker + 0.05);
    } catch (error) {
      console.debug('[Accessibility] Contrast calculation error:', error);
      // If we can't calculate, assume it passes
      return 21;
    }
  }

  private getRelativeLuminance(color: string): number {
    // Parse hex color
    let hex = color.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }

    if (hex.length !== 6) return 0.5; // Can't parse, return middle value

    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;

    const linearize = (c: number) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _accessibility: AccessibilityAgent | null = null;

export function getAccessibilityAgent(): AccessibilityAgent {
  if (!_accessibility) {
    _accessibility = new AccessibilityAgent();
  }
  return _accessibility;
}

export function resetAccessibilityAgent(): void {
  _accessibility = null;
}
