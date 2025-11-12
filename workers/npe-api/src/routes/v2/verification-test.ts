/**
 * Verification System Test Route
 *
 * Simple endpoint to test POVM verification without full allegorical pipeline
 * Can be removed once integrated into main transformation routes
 */

import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../../middleware/auth';
import { measureContentPOVM, computeContentDrift } from '../../services/povm-verification/content-povm';
import { verifyTransformation, type AttributeConstraints } from '../../services/povm-verification/verification';
import type { Env } from '../../../shared/types';

export const verificationTestRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /v2/verification-test/measure
 *
 * Test Content POVM measurement on a single text
 */
verificationTestRoutes.post('/measure', requireAuth(), async (c) => {
  try {
    const body = await c.req.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return c.json({ error: 'Text is required' }, 400);
    }

    console.log('[Verification Test] Measuring text:', text.substring(0, 100));

    const measurement = await measureContentPOVM(text, c.env.AI);

    return c.json({
      success: true,
      measurement
    });
  } catch (error: any) {
    console.error('[Verification Test] Error:', error);
    return c.json({
      error: error.message || 'Measurement failed'
    }, 500);
  }
});

/**
 * POST /v2/verification-test/compare
 *
 * Compare two texts and calculate drift
 */
verificationTestRoutes.post('/compare', requireAuth(), async (c) => {
  try {
    const body = await c.req.json();
    const { text1, text2 } = body;

    if (!text1 || !text2) {
      return c.json({ error: 'Both text1 and text2 are required' }, 400);
    }

    console.log('[Verification Test] Comparing texts');

    const measurement1 = await measureContentPOVM(text1, c.env.AI);
    const measurement2 = await measureContentPOVM(text2, c.env.AI);
    const withDrift = await computeContentDrift(measurement1, measurement2, c.env.AI);

    return c.json({
      success: true,
      before: measurement1,
      after: withDrift,
      summary: {
        plotDrift: withDrift.plotStructure.drift,
        entailmentDrift: withDrift.semanticEntailment.drift,
        ethicsDrift: withDrift.ethicalStance.drift,
        averageDrift: (
          withDrift.plotStructure.drift +
          withDrift.semanticEntailment.drift +
          withDrift.ethicalStance.drift
        ) / 3
      }
    });
  } catch (error: any) {
    console.error('[Verification Test] Error:', error);
    return c.json({
      error: error.message || 'Comparison failed'
    }, 500);
  }
});

/**
 * POST /v2/verification-test/verify
 *
 * Full verification pipeline: measure, detect violations, correct
 */
verificationTestRoutes.post('/verify', requireAuth(), async (c) => {
  try {
    const body = await c.req.json();
    const {
      originalText,
      transformedText,
      constraints,
      config
    } = body;

    if (!originalText || !transformedText) {
      return c.json({ error: 'Both originalText and transformedText are required' }, 400);
    }

    // Default constraints if not provided
    const defaultConstraints: AttributeConstraints = {
      allowedDimensions: ['names', 'settings'],
      conservedDimensions: [
        'content.plotStructure',
        'content.semanticEntailment',
        'content.ethicalStance'
      ],
      conservationThreshold: 0.15
    };

    const finalConstraints = constraints || defaultConstraints;

    console.log('[Verification Test] Running full verification pipeline');
    console.log('[Verification Test] Constraints:', JSON.stringify(finalConstraints, null, 2));

    const result = await verifyTransformation(
      originalText,
      transformedText,
      finalConstraints,
      c.env.AI,
      config
    );

    return c.json({
      success: true,
      result: {
        finalText: result.finalText,
        converged: result.converged,
        attempts: result.attempts.map(a => ({
          passNumber: a.passNumber,
          convergenceRatio: a.convergenceRatio,
          violationCount: a.violations.length,
          improved: a.improved
        })),
        finalReport: {
          passed: result.finalReport.passed,
          convergenceRatio: result.finalReport.convergenceRatio,
          totalViolations: result.finalReport.totalViolations,
          violations: result.finalReport.violations
        },
        measurements: {
          before: {
            plot: result.measurements.before.plotStructure.events,
            entailments: result.measurements.before.semanticEntailment.implications,
            ethics: {
              stance: result.measurements.before.ethicalStance.stance,
              explanation: result.measurements.before.ethicalStance.explanation
            }
          },
          after: {
            plot: result.measurements.after.plotStructure.events,
            entailments: result.measurements.after.semanticEntailment.implications,
            ethics: {
              stance: result.measurements.after.ethicalStance.stance,
              explanation: result.measurements.after.ethicalStance.explanation
            },
            drifts: {
              plot: result.measurements.after.plotStructure.drift,
              entailment: result.measurements.after.semanticEntailment.drift,
              ethics: result.measurements.after.ethicalStance.drift
            }
          }
        }
      }
    });
  } catch (error: any) {
    console.error('[Verification Test] Error:', error);
    return c.json({
      error: error.message || 'Verification failed',
      stack: error.stack
    }, 500);
  }
});

/**
 * GET /v2/verification-test/example
 *
 * Return example request bodies for testing
 */
verificationTestRoutes.get('/example', async (c) => {
  return c.json({
    measure: {
      text: "The CEO announced quarterly results to the board, highlighting the team's hard work and dedication."
    },
    compare: {
      text1: "The CEO announced quarterly results to the board, highlighting the team's hard work and dedication.",
      text2: "Lord Agamemnon proclaimed the campaign's triumphs to the council, lauding the warriors' valor and steadfast courage."
    },
    verify: {
      originalText: "The CEO announced quarterly results to the board, highlighting the team's hard work and dedication.",
      transformedText: "Lord Agamemnon proclaimed the campaign's triumphs to the council, lauding the warriors' valor and steadfast courage.",
      constraints: {
        allowedDimensions: ["names", "settings", "cultural_references"],
        conservedDimensions: [
          "content.plotStructure",
          "content.semanticEntailment",
          "content.ethicalStance"
        ],
        conservationThreshold: 0.15
      },
      config: {
        maxCorrectionPasses: 3,
        allowPartialConvergence: true,
        partialConvergenceRatio: 0.67
      }
    }
  });
});
