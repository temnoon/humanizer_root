/**
 * Attribute POVM Testing Routes
 * Tests attribute-specific POVM measurements
 */

import { Hono } from 'hono';
import type { Env } from '../../../shared/types';
import { requireAuth } from '../../middleware/auth';
import {
  measureNamespacePOVM,
  computeNamespaceDrift,
  type NamespacePOVMMeasurement
} from '../../services/povm-verification/namespace-povm';
import {
  measurePersonaPOVM,
  computePersonaDrift,
  type PersonaPOVMMeasurement
} from '../../services/povm-verification/persona-povm';
import {
  measureStylePOVM,
  computeStyleDrift,
  type StylePOVMMeasurement
} from '../../services/povm-verification/style-povm';

export const attributePOVMTestRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /v2/attribute-povm-test/namespace/measure
 * Measure Namespace POVM for a single text
 */
attributePOVMTestRoutes.post('/namespace/measure', requireAuth(), async (c) => {
  try {
    const { text } = await c.req.json();

    if (!text) {
      return c.json({ error: 'Text is required' }, 400);
    }

    console.log('[Attribute POVM Test] Measuring Namespace POVM');

    const measurement = await measureNamespacePOVM(text, c.env.AI);

    return c.json({
      success: true,
      measurement
    });
  } catch (error: any) {
    console.error('[Attribute POVM Test] Measurement failed:', error);
    return c.json({
      success: false,
      error: error.message || 'Measurement failed'
    }, 500);
  }
});

/**
 * POST /v2/attribute-povm-test/namespace/compare
 * Compare Namespace POVMs of two texts
 */
attributePOVMTestRoutes.post('/namespace/compare', requireAuth(), async (c) => {
  try {
    const { text1, text2 } = await c.req.json();

    if (!text1 || !text2) {
      return c.json({ error: 'Both text1 and text2 are required' }, 400);
    }

    console.log('[Attribute POVM Test] Comparing Namespace POVMs');

    const measurement1 = await measureNamespacePOVM(text1, c.env.AI);
    const measurement2 = await measureNamespacePOVM(text2, c.env.AI);
    const withDrift = await computeNamespaceDrift(measurement1, measurement2, c.env.AI);

    return c.json({
      success: true,
      before: measurement1,
      after: withDrift,
      summary: {
        namesDrift: withDrift.properNames.drift,
        domainDrift: withDrift.culturalDomain.drift,
        termsDrift: withDrift.specializedTerms.drift,
        averageDrift: (
          withDrift.properNames.drift +
          withDrift.culturalDomain.drift +
          withDrift.specializedTerms.drift
        ) / 3
      }
    });
  } catch (error: any) {
    console.error('[Attribute POVM Test] Comparison failed:', error);
    return c.json({
      success: false,
      error: error.message || 'Comparison failed'
    }, 500);
  }
});

/**
 * POST /v2/attribute-povm-test/persona/measure
 * Measure Persona POVM for a single text
 */
attributePOVMTestRoutes.post('/persona/measure', requireAuth(), async (c) => {
  try {
    const { text } = await c.req.json();

    if (!text) {
      return c.json({ error: 'Text is required' }, 400);
    }

    console.log('[Attribute POVM Test] Measuring Persona POVM');

    const measurement = await measurePersonaPOVM(text, c.env.AI);

    return c.json({
      success: true,
      measurement
    });
  } catch (error: any) {
    console.error('[Attribute POVM Test] Persona measurement failed:', error);
    return c.json({
      success: false,
      error: error.message || 'Measurement failed'
    }, 500);
  }
});

/**
 * POST /v2/attribute-povm-test/persona/compare
 * Compare Persona POVMs of two texts
 */
attributePOVMTestRoutes.post('/persona/compare', requireAuth(), async (c) => {
  try {
    const { text1, text2 } = await c.req.json();

    if (!text1 || !text2) {
      return c.json({ error: 'Both text1 and text2 are required' }, 400);
    }

    console.log('[Attribute POVM Test] Comparing Persona POVMs');

    const measurement1 = await measurePersonaPOVM(text1, c.env.AI);
    const measurement2 = await measurePersonaPOVM(text2, c.env.AI);
    const withDrift = await computePersonaDrift(measurement1, measurement2, c.env.AI);

    return c.json({
      success: true,
      before: measurement1,
      after: withDrift,
      summary: {
        perspectiveDrift: withDrift.narrativePerspective.drift,
        toneDrift: withDrift.affectiveTone.drift,
        stanceDrift: withDrift.rhetoricalStance.drift,
        averageDrift: (
          withDrift.narrativePerspective.drift +
          withDrift.affectiveTone.drift +
          withDrift.rhetoricalStance.drift
        ) / 3
      }
    });
  } catch (error: any) {
    console.error('[Attribute POVM Test] Persona comparison failed:', error);
    return c.json({
      success: false,
      error: error.message || 'Comparison failed'
    }, 500);
  }
});

/**
 * POST /v2/attribute-povm-test/style/measure
 * Measure Style POVM for a single text
 */
attributePOVMTestRoutes.post('/style/measure', requireAuth(), async (c) => {
  try {
    const { text } = await c.req.json();

    if (!text) {
      return c.json({ error: 'Text is required' }, 400);
    }

    console.log('[Attribute POVM Test] Measuring Style POVM');

    const measurement = await measureStylePOVM(text, c.env.AI);

    return c.json({
      success: true,
      measurement
    });
  } catch (error: any) {
    console.error('[Attribute POVM Test] Style measurement failed:', error);
    return c.json({
      success: false,
      error: error.message || 'Measurement failed'
    }, 500);
  }
});

/**
 * POST /v2/attribute-povm-test/style/compare
 * Compare Style POVMs of two texts
 */
attributePOVMTestRoutes.post('/style/compare', requireAuth(), async (c) => {
  try {
    const { text1, text2 } = await c.req.json();

    if (!text1 || !text2) {
      return c.json({ error: 'Both text1 and text2 are required' }, 400);
    }

    console.log('[Attribute POVM Test] Comparing Style POVMs');

    const measurement1 = await measureStylePOVM(text1, c.env.AI);
    const measurement2 = await measureStylePOVM(text2, c.env.AI);
    const withDrift = await computeStyleDrift(measurement1, measurement2, c.env.AI);

    return c.json({
      success: true,
      before: measurement1,
      after: withDrift,
      summary: {
        structureDrift: withDrift.sentenceStructure.drift,
        formalityDrift: withDrift.formality.drift,
        lexicalDrift: withDrift.lexicalFeatures.drift,
        averageDrift: (
          withDrift.sentenceStructure.drift +
          withDrift.formality.drift +
          withDrift.lexicalFeatures.drift
        ) / 3
      }
    });
  } catch (error: any) {
    console.error('[Attribute POVM Test] Style comparison failed:', error);
    return c.json({
      success: false,
      error: error.message || 'Comparison failed'
    }, 500);
  }
});

/**
 * POST /v2/attribute-povm-test/leakage-test
 * Test for attribute leakage
 * Transforms text with ONE attribute, measures ALL POVMs
 */
attributePOVMTestRoutes.post('/leakage-test', requireAuth(), async (c) => {
  try {
    const { originalText, transformedText, changedAttribute } = await c.req.json();

    if (!originalText || !transformedText || !changedAttribute) {
      return c.json({
        error: 'originalText, transformedText, and changedAttribute are required'
      }, 400);
    }

    console.log('[Attribute POVM Test] Running leakage test');
    console.log('[Attribute POVM Test] Changed attribute:', changedAttribute);

    // Measure ALL POVMs for both texts (Namespace, Persona, Style)
    const [namespaceBefore, personaBefore, styleBefore] = await Promise.all([
      measureNamespacePOVM(originalText, c.env.AI),
      measurePersonaPOVM(originalText, c.env.AI),
      measureStylePOVM(originalText, c.env.AI)
    ]);

    const [namespaceAfter, personaAfter, styleAfter] = await Promise.all([
      measureNamespacePOVM(transformedText, c.env.AI),
      measurePersonaPOVM(transformedText, c.env.AI),
      measureStylePOVM(transformedText, c.env.AI)
    ]);

    // Compute drift for all three POVMs
    const [namespaceWithDrift, personaWithDrift, styleWithDrift] = await Promise.all([
      computeNamespaceDrift(namespaceBefore, namespaceAfter, c.env.AI),
      computePersonaDrift(personaBefore, personaAfter, c.env.AI),
      computeStyleDrift(styleBefore, styleAfter, c.env.AI)
    ]);

    // Calculate average drift for each POVM pack
    const namespaceDrift = (
      namespaceWithDrift.properNames.drift +
      namespaceWithDrift.culturalDomain.drift +
      namespaceWithDrift.specializedTerms.drift
    ) / 3;

    const personaDrift = (
      personaWithDrift.narrativePerspective.drift +
      personaWithDrift.affectiveTone.drift +
      personaWithDrift.rhetoricalStance.drift
    ) / 3;

    const styleDrift = (
      styleWithDrift.sentenceStructure.drift +
      styleWithDrift.formality.drift +
      styleWithDrift.lexicalFeatures.drift
    ) / 3;

    // Leakage detection logic
    const LEAKAGE_THRESHOLD = 0.15;  // 15% drift threshold
    let leakageDetected = false;
    const leakageMessages: string[] = [];

    if (changedAttribute === 'namespace') {
      // Namespace change is expected, check if Persona or Style changed
      if (personaDrift > LEAKAGE_THRESHOLD) {
        leakageDetected = true;
        leakageMessages.push(`LEAKAGE: Namespace transformation affected Persona (${(personaDrift * 100).toFixed(1)}% drift)`);
      }
      if (styleDrift > LEAKAGE_THRESHOLD) {
        leakageDetected = true;
        leakageMessages.push(`LEAKAGE: Namespace transformation affected Style (${(styleDrift * 100).toFixed(1)}% drift)`);
      }
      if (!leakageDetected) {
        leakageMessages.push('Namespace changed as expected. Persona and Style preserved.');
      }
    } else if (changedAttribute === 'persona') {
      // Persona change is expected, check if Namespace or Style changed
      if (namespaceDrift > LEAKAGE_THRESHOLD) {
        leakageDetected = true;
        leakageMessages.push(`LEAKAGE: Persona transformation affected Namespace (${(namespaceDrift * 100).toFixed(1)}% drift)`);
      }
      if (styleDrift > LEAKAGE_THRESHOLD) {
        leakageDetected = true;
        leakageMessages.push(`LEAKAGE: Persona transformation affected Style (${(styleDrift * 100).toFixed(1)}% drift)`);
      }
      if (!leakageDetected) {
        leakageMessages.push('Persona changed as expected. Namespace and Style preserved.');
      }
    } else if (changedAttribute === 'style') {
      // Style change is expected, check if Namespace or Persona changed
      if (namespaceDrift > LEAKAGE_THRESHOLD) {
        leakageDetected = true;
        leakageMessages.push(`LEAKAGE: Style transformation affected Namespace (${(namespaceDrift * 100).toFixed(1)}% drift)`);
      }
      if (personaDrift > LEAKAGE_THRESHOLD) {
        leakageDetected = true;
        leakageMessages.push(`LEAKAGE: Style transformation affected Persona (${(personaDrift * 100).toFixed(1)}% drift)`);
      }
      if (!leakageDetected) {
        leakageMessages.push('Style changed as expected. Namespace and Persona preserved.');
      }
    }

    // Calculate leakage score: (unintended drift) / (intended + unintended drift)
    // Handle edge case where no drift is detected (0/0 division)
    let leakageScore = 0;
    let intendedDrift = 0;
    let unintendedDrift = 0;

    if (changedAttribute === 'namespace') {
      intendedDrift = namespaceDrift;
      unintendedDrift = personaDrift + styleDrift;
    } else if (changedAttribute === 'persona') {
      intendedDrift = personaDrift;
      unintendedDrift = namespaceDrift + styleDrift;
    } else if (changedAttribute === 'style') {
      intendedDrift = styleDrift;
      unintendedDrift = namespaceDrift + personaDrift;
    }

    const totalDrift = intendedDrift + unintendedDrift;

    if (totalDrift === 0) {
      // Edge case: No change detected at all
      // This can happen if:
      // 1. Transformation didn't occur (technical failure)
      // 2. Constraints are too restrictive (preventing all changes)
      // 3. Text is identical to original
      leakageScore = 0;
      leakageMessages.push('WARNING: No drift detected in any dimension. Transformation may not have occurred or constraints are too restrictive.');
      console.warn('[Attribute POVM Test] Zero total drift detected - possible measurement issue');
    } else if (intendedDrift === 0 && unintendedDrift > 0) {
      // Worst case: Only unintended changes occurred
      leakageScore = 1.0;  // 100% leakage
      leakageMessages.push(`CRITICAL: Only unintended drift detected (${(unintendedDrift * 100).toFixed(1)}% in other dimensions, 0% in ${changedAttribute})`);
    } else {
      // Normal case: Calculate ratio
      leakageScore = unintendedDrift / totalDrift;
    }

    return c.json({
      success: true,
      changedAttribute,
      leakageDetected,
      leakageScore,
      intendedDrift,
      unintendedDrift,
      pass: !leakageDetected,
      namespaceDrift,
      personaDrift,
      styleDrift,
      leakageMessages,
      measurements: {
        namespace: {
          before: namespaceBefore,
          after: namespaceWithDrift,
          drift: namespaceDrift
        },
        persona: {
          before: personaBefore,
          after: personaWithDrift,
          drift: personaDrift
        },
        style: {
          before: styleBefore,
          after: styleWithDrift,
          drift: styleDrift
        }
      }
    });
  } catch (error: any) {
    console.error('[Attribute POVM Test] Leakage test failed:', error);
    return c.json({
      success: false,
      error: error.message || 'Leakage test failed'
    }, 500);
  }
});
