/**
 * V2 API Routes - /v2/allegorical
 *
 * ρ-Based Allegorical Transformation:
 * - POST /allegorical/transform - 5-stage transformation with ρ tracking
 */

import { Hono } from 'hono';
import { optionalLocalAuth, getAuthContext } from '../../middleware/auth';
import { NarrativeRepository } from '../../domain/narrative-repository';
import { POVMService } from '../../domain/povm-service';
import { AllegoricalRhoService } from '../../domain/allegorical-rho-service';
import type { Env } from '../../../shared/types';

export const allegoricalRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /v2/allegorical/transform
 *
 * Perform 5-stage allegorical transformation with ρ measurements
 *
 * Request body:
 * {
 *   "text": "Original narrative...",
 *   "persona": "neutral",
 *   "namespace": "mythology",
 *   "style": "standard"
 * }
 *
 * Response:
 * {
 *   "transformation_id": "...",
 *   "narrative_id": "...",
 *   "original_text": "...",
 *   "final_text": "...",
 *   "stages": [
 *     {
 *       "stage_name": "Deconstruct",
 *       "stage_number": 1,
 *       "input_text": "...",
 *       "output_text": "...",
 *       "rho_before": {
 *         "id": "...",
 *         "purity": 0.15,
 *         "entropy": 2.8,
 *         "top_eigenvalues": [...]
 *       },
 *       "rho_after": {
 *         "id": "...",
 *         "purity": 0.18,
 *         "entropy": 2.6,
 *         "top_eigenvalues": [...]
 *       },
 *       "povm_measurement": {
 *         "axis": "narrative_structure",
 *         "probabilities": {...},
 *         "coherence": 0.75
 *       },
 *       "transformation_description": "..."
 *     },
 *     ...
 *   ],
 *   "overall_metrics": {
 *     "initial_purity": 0.15,
 *     "final_purity": 0.22,
 *     "purity_delta": 0.07,
 *     "initial_entropy": 2.8,
 *     "final_entropy": 2.5,
 *     "entropy_delta": -0.3,
 *     "total_coherence": 0.72
 *   }
 * }
 */
allegoricalRoutes.post('/transform', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();
    const { text, persona, namespace, style, model, length_preference } = body;

    // Validate input
    if (!text || typeof text !== 'string') {
      return c.json({ error: 'Text is required' }, 400);
    }

    if (!persona || !namespace || !style) {
      return c.json({ error: 'Persona, namespace, and style are required' }, 400);
    }

    if (text.length > 10000) {
      return c.json({ error: 'Text too long (max 10,000 characters)' }, 400);
    }

    // Fetch persona from database (support custom attributes)
    let personaRow;
    if (persona.startsWith('custom_')) {
      const customId = persona.replace('custom_', '');
      personaRow = await c.env.DB.prepare(
        'SELECT * FROM user_attributes WHERE id = ? AND user_id = ? AND type = ?'
      ).bind(customId, auth.userId, 'persona').first();

      if (!personaRow) {
        return c.json({ error: `Invalid or unauthorized custom persona: ${persona}` }, 400);
      }

      // Map user_attribute fields to expected persona structure
      const definition = JSON.parse(personaRow.definition as string);
      personaRow = {
        name: personaRow.name,
        system_prompt: definition.system_prompt || ''
      };
    } else {
      personaRow = await c.env.DB.prepare(
        'SELECT * FROM npe_personas WHERE name = ?'
      ).bind(persona).first();

      if (!personaRow) {
        return c.json({ error: `Invalid persona: ${persona}` }, 400);
      }
    }

    // Fetch namespace from database (support custom attributes)
    let namespaceRow;
    if (namespace.startsWith('custom_')) {
      const customId = namespace.replace('custom_', '');
      namespaceRow = await c.env.DB.prepare(
        'SELECT * FROM user_attributes WHERE id = ? AND user_id = ? AND type = ?'
      ).bind(customId, auth.userId, 'namespace').first();

      if (!namespaceRow) {
        return c.json({ error: `Invalid or unauthorized custom namespace: ${namespace}` }, 400);
      }

      // Map user_attribute fields to expected namespace structure
      const definition = JSON.parse(namespaceRow.definition as string);
      namespaceRow = {
        name: namespaceRow.name,
        description: definition.description || '',
        context_prompt: definition.context_prompt || ''
      };
    } else {
      namespaceRow = await c.env.DB.prepare(
        'SELECT * FROM npe_namespaces WHERE name = ?'
      ).bind(namespace).first();

      if (!namespaceRow) {
        return c.json({ error: `Invalid namespace: ${namespace}` }, 400);
      }
    }

    // Fetch style from database (support custom attributes)
    let styleRow;
    if (style.startsWith('custom_')) {
      const customId = style.replace('custom_', '');
      styleRow = await c.env.DB.prepare(
        'SELECT * FROM user_attributes WHERE id = ? AND user_id = ? AND type = ?'
      ).bind(customId, auth.userId, 'style').first();

      if (!styleRow) {
        return c.json({ error: `Invalid or unauthorized custom style: ${style}` }, 400);
      }

      // Map user_attribute fields to expected style structure
      const definition = JSON.parse(styleRow.definition as string);
      styleRow = {
        name: styleRow.name,
        style_prompt: definition.style_prompt || ''
      };
    } else {
      styleRow = await c.env.DB.prepare(
        'SELECT * FROM npe_styles WHERE name = ?'
      ).bind(style).first();

      if (!styleRow) {
        return c.json({ error: `Invalid style: ${style}` }, 400);
      }
    }

    // Fetch user preferences if model/length not specified
    let selectedModel = model;
    let selectedLength = length_preference;

    if (!selectedModel || !selectedLength) {
      const userPrefsRow = await c.env.DB.prepare(
        'SELECT preferred_model, preferred_length FROM users WHERE id = ?'
      ).bind(auth.userId).first();

      if (userPrefsRow) {
        selectedModel = selectedModel || (userPrefsRow.preferred_model as string) || '@cf/meta/llama-3.1-8b-instruct';
        selectedLength = selectedLength || (userPrefsRow.preferred_length as any) || 'same';
      } else {
        selectedModel = selectedModel || '@cf/meta/llama-3.1-8b-instruct';
        selectedLength = selectedLength || 'same';
      }
    }

    // Create services
    const narrativeRepo = new NarrativeRepository(c.env.DB, c.env.AI);
    const povmService = new POVMService(c.env.DB, c.env.AI, narrativeRepo);

    const allegoricalService = new AllegoricalRhoService(
      c.env.DB,
      c.env.AI,
      narrativeRepo,
      povmService,
      {
        name: personaRow.name as string,
        system_prompt: personaRow.system_prompt as string
      },
      {
        name: namespaceRow.name as string,
        description: namespaceRow.description as string,
        context_prompt: namespaceRow.context_prompt as string
      },
      {
        name: styleRow.name as string,
        style_prompt: styleRow.style_prompt as string
      },
      selectedModel,
      selectedLength as 'shorter' | 'same' | 'longer' | 'much_longer'
    );

    // Perform transformation
    console.log('[Route] Starting allegorical transformation for user:', auth.userId, 'with model:', selectedModel);
    const result = await allegoricalService.transform(text, auth.userId);
    console.log('[Route] Transformation complete, stages:', result.stages.length);

    return c.json(result, 200);
  } catch (error: any) {
    console.error('[Route] Allegorical transformation error:', error);
    console.error('[Route] Error stack:', error.stack);
    return c.json(
      {
        error: 'Transformation failed',
        details: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n')  // First 5 lines of stack
      },
      500
    );
  }
});
