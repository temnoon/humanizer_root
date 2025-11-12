/**
 * Verification System - Constraint checking and correction
 *
 * Pipeline:
 * 1. Measure before transformation (baseline)
 * 2. Apply transformation
 * 3. Measure after transformation
 * 4. Detect violations (drift beyond threshold)
 * 5. Generate correction prompts
 * 6. Apply corrections iteratively
 * 7. Return final result with verification report
 */

import type { Env } from '../../../shared/types';
import {
  measureContentPOVM,
  computeContentDrift,
  type ContentPOVMMeasurement
} from './content-povm';

export interface AttributeConstraints {
  allowedDimensions: string[];      // What can change
  conservedDimensions: string[];    // What must preserve
  conservationThreshold: number;    // Max drift allowed (0.0-1.0)
}

export interface Violation {
  dimension: string;
  drift: number;
  threshold: number;
  severity: 'minor' | 'major';
  evidence: {
    before: string;
    after: string;
    difference: string;
  };
}

export interface ViolationReport {
  passed: boolean;
  totalViolations: number;
  minorViolations: number;
  majorViolations: number;
  violations: Violation[];
  worstDrift: number;
  convergenceRatio: number;  // % of constraints met
}

export interface CorrectionAttempt {
  passNumber: number;
  text: string;
  violations: Violation[];
  convergenceRatio: number;
  improved: boolean;
}

export interface VerificationResult {
  finalText: string;
  attempts: CorrectionAttempt[];
  converged: boolean;
  finalReport: ViolationReport;
  measurements: {
    before: ContentPOVMMeasurement;
    after: ContentPOVMMeasurement;
  };
}

export interface VerificationConfig {
  maxCorrectionPasses: number;      // Default: 3
  conservationThreshold: number;    // Default: 0.15
  allowPartialConvergence: boolean; // Default: true
  partialConvergenceRatio: number;  // Default: 0.67
}

const DEFAULT_CONFIG: VerificationConfig = {
  maxCorrectionPasses: 3,
  conservationThreshold: 0.15,
  allowPartialConvergence: true,
  partialConvergenceRatio: 0.67
};

/**
 * Main verification pipeline
 */
export async function verifyTransformation(
  originalText: string,
  transformedText: string,
  constraints: AttributeConstraints,
  ai: any,
  config: Partial<VerificationConfig> = {}
): Promise<VerificationResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  console.log('[Verification] Starting verification pipeline');
  console.log('[Verification] Constraints:', JSON.stringify(constraints, null, 2));

  // Measure baseline
  const baseline = await measureContentPOVM(originalText, ai);
  console.log('[Verification] Baseline measured');

  // Start correction loop
  const attempts: CorrectionAttempt[] = [];
  let currentText = transformedText;
  let previousConvergence = 0;

  for (let pass = 1; pass <= fullConfig.maxCorrectionPasses; pass++) {
    console.log(`[Verification] Pass ${pass}/${fullConfig.maxCorrectionPasses}`);

    // Measure current state
    const current = await measureContentPOVM(currentText, ai);
    const withDrift = await computeContentDrift(baseline, current, ai);
    const report = generateViolationReport(withDrift, constraints, fullConfig);

    console.log(`[Verification] Pass ${pass} - Convergence: ${(report.convergenceRatio * 100).toFixed(1)}%`);

    // Check if converged (all constraints met)
    if (report.passed) {
      console.log('[Verification] ✓ Full convergence achieved');

      attempts.push({
        passNumber: pass,
        text: currentText,
        violations: [],
        convergenceRatio: 1.0,
        improved: true
      });

      return {
        finalText: currentText,
        attempts,
        converged: true,
        finalReport: report,
        measurements: {
          before: baseline,
          after: withDrift
        }
      };
    }

    // Check for partial convergence (acceptable)
    if (fullConfig.allowPartialConvergence &&
        report.convergenceRatio >= fullConfig.partialConvergenceRatio) {
      console.log(`[Verification] ⚠ Partial convergence: ${(report.convergenceRatio * 100).toFixed(1)}%`);

      attempts.push({
        passNumber: pass,
        text: currentText,
        violations: report.violations,
        convergenceRatio: report.convergenceRatio,
        improved: report.convergenceRatio > previousConvergence
      });

      return {
        finalText: currentText,
        attempts,
        converged: false,
        finalReport: report,
        measurements: {
          before: baseline,
          after: withDrift
        }
      };
    }

    // Check for stagnation (not improving)
    const improved = report.convergenceRatio > previousConvergence || pass === 1;
    if (!improved && pass > 1) {
      console.warn(`[Verification] ✗ Stagnation detected at pass ${pass}`);

      attempts.push({
        passNumber: pass,
        text: currentText,
        violations: report.violations,
        convergenceRatio: report.convergenceRatio,
        improved: false
      });

      // Return best attempt so far
      const bestAttempt = attempts.reduce((best, curr) =>
        curr.convergenceRatio > best.convergenceRatio ? curr : best
      );

      const bestMeasurement = await measureContentPOVM(bestAttempt.text, ai);
      const bestWithDrift = await computeContentDrift(baseline, bestMeasurement, ai);
      const bestReport = generateViolationReport(bestWithDrift, constraints, fullConfig);

      return {
        finalText: bestAttempt.text,
        attempts,
        converged: false,
        finalReport: bestReport,
        measurements: {
          before: baseline,
          after: bestWithDrift
        }
      };
    }

    // Record attempt
    attempts.push({
      passNumber: pass,
      text: currentText,
      violations: report.violations,
      convergenceRatio: report.convergenceRatio,
      improved
    });

    previousConvergence = report.convergenceRatio;

    // If we're on the last pass, return what we have
    if (pass === fullConfig.maxCorrectionPasses) {
      console.log('[Verification] ✗ Max passes reached without convergence');

      return {
        finalText: currentText,
        attempts,
        converged: false,
        finalReport: report,
        measurements: {
          before: baseline,
          after: withDrift
        }
      };
    }

    // Generate and apply correction
    console.log(`[Verification] Generating correction for ${report.violations.length} violations`);

    const correctionPrompt = buildCorrectionPrompt(
      originalText,
      currentText,
      report.violations,
      constraints
    );

    const correctionResponse = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are a precise text editor who fixes specific violations while preserving intended changes. Respond ONLY with the corrected text, no explanations or commentary.'
        },
        {
          role: 'user',
          content: correctionPrompt
        }
      ],
      max_tokens: 4096,
      temperature: 0.5
    });

    currentText = (correctionResponse.response || currentText).trim();
  }

  // Should not reach here, but handle gracefully
  const finalMeasurement = await measureContentPOVM(currentText, ai);
  const finalWithDrift = await computeContentDrift(baseline, finalMeasurement, ai);
  const finalReport = generateViolationReport(finalWithDrift, constraints, fullConfig);

  return {
    finalText: currentText,
    attempts,
    converged: false,
    finalReport,
    measurements: {
      before: baseline,
      after: finalWithDrift
    }
  };
}

/**
 * Generate violation report from measurements
 */
function generateViolationReport(
  measurement: ContentPOVMMeasurement,
  constraints: AttributeConstraints,
  config: VerificationConfig
): ViolationReport {
  const violations: Violation[] = [];

  // Map conserved dimensions to measurement fields
  const dimensionMap: Record<string, { drift: number; before: string; after: string }> = {
    'content.plotStructure': {
      drift: measurement.plotStructure.drift,
      before: measurement.plotStructure.evidence,
      after: measurement.plotStructure.evidence  // Will be updated for comparison
    },
    'content.semanticEntailment': {
      drift: measurement.semanticEntailment.drift,
      before: measurement.semanticEntailment.evidence,
      after: measurement.semanticEntailment.evidence
    },
    'content.ethicalStance': {
      drift: measurement.ethicalStance.drift,
      before: measurement.ethicalStance.evidence,
      after: measurement.ethicalStance.evidence
    }
  };

  // Check each conserved dimension
  for (const dim of constraints.conservedDimensions) {
    const data = dimensionMap[dim];
    if (!data) {
      console.warn(`[Verification] Unknown dimension: ${dim}`);
      continue;
    }

    const threshold = constraints.conservationThreshold || config.conservationThreshold;

    if (data.drift > threshold) {
      const severity = data.drift < threshold * 1.5 ? 'minor' : 'major';

      violations.push({
        dimension: dim,
        drift: data.drift,
        threshold,
        severity,
        evidence: {
          before: data.before,
          after: data.after,
          difference: `Drifted by ${(data.drift * 100).toFixed(1)}% (limit: ${(threshold * 100).toFixed(1)}%)`
        }
      });
    }
  }

  const minorCount = violations.filter(v => v.severity === 'minor').length;
  const majorCount = violations.filter(v => v.severity === 'major').length;
  const worstDrift = violations.length > 0 ? Math.max(...violations.map(v => v.drift)) : 0;
  const convergenceRatio = 1 - (violations.length / constraints.conservedDimensions.length);

  return {
    passed: violations.length === 0,
    totalViolations: violations.length,
    minorViolations: minorCount,
    majorViolations: majorCount,
    violations,
    worstDrift,
    convergenceRatio
  };
}

/**
 * Build correction prompt from violations
 */
function buildCorrectionPrompt(
  originalText: string,
  transformedText: string,
  violations: Violation[],
  constraints: AttributeConstraints
): string {
  const major = violations.filter(v => v.severity === 'major');
  const minor = violations.filter(v => v.severity === 'minor');

  let prompt = `You are correcting a narrative transformation that has introduced unintended changes.

ORIGINAL TEXT:
${originalText}

TRANSFORMED TEXT (with violations):
${transformedText}

INTENDED CHANGES: ${constraints.allowedDimensions.join(', ')}
MUST PRESERVE: ${constraints.conservedDimensions.join(', ')}

VIOLATIONS DETECTED:
`;

  if (major.length > 0) {
    prompt += `\n🚨 MAJOR VIOLATIONS (fix these first):\n`;
    for (const v of major) {
      prompt += `\n${formatViolation(v)}\n`;
    }
  }

  if (minor.length > 0) {
    prompt += `\n⚠️ MINOR VIOLATIONS (fix if possible):\n`;
    for (const v of minor) {
      prompt += `\n${formatViolation(v)}\n`;
    }
  }

  prompt += `

TASK:
Rewrite the TRANSFORMED TEXT to fix these violations while preserving the intended changes.

RULES:
1. Keep all intended changes (${constraints.allowedDimensions.join(', ')})
2. Restore the preserved dimensions that drifted (${constraints.conservedDimensions.join(', ')})
3. Do NOT revert to the original text - maintain the transformation
4. Focus on fixing major violations first, then minor ones
5. Return ONLY the corrected text, no explanations

CORRECTED TEXT:`;

  return prompt;
}

function formatViolation(v: Violation): string {
  const driftPercent = (v.drift * 100).toFixed(1);
  const thresholdPercent = (v.threshold * 100).toFixed(1);

  let formatted = `• ${v.dimension}: ${driftPercent}% drift (threshold: ${thresholdPercent}%)`;
  formatted += `\n  Problem: ${v.evidence.difference}`;

  return formatted;
}
