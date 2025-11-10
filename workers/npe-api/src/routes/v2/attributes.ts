/**
 * V2 Attributes API Routes
 *
 * Endpoints for LLM-assisted attribute extraction and refinement.
 * Allows users to create custom personas, namespaces, styles, and voices
 * through natural language dialogue.
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { Env } from '../../../shared/types';
import { optionalLocalAuth, getAuthContext } from '../../middleware/auth';
import { createAttributeExtractionService } from '../../services/attribute-extraction';
import {
  ExtractAttributeRequestSchema,
  RefineAttributeRequestSchema,
  AttributeDialogue,
  DialogueMessage,
  EXAMPLE_STARTERS,
} from '../../domain/attribute-models';

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /v2/attributes/extract
 * Extract an attribute from a free-form description
 */
app.post('/extract', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();

    // Validate request
    const request = ExtractAttributeRequestSchema.parse(body);

    // Create extraction service
    const service = createAttributeExtractionService(c.env);

    // Extract attribute
    const response = await service.extractAttribute(request);

    // If we have a dialogue context, update it in the database
    if (body.dialogueId) {
      await updateDialogue(
        c.env,
        body.dialogueId,
        request.description,
        response,
        auth.userId
      );
    } else if (response.questions) {
      // Start a new dialogue session if we're asking questions
      const dialogueId = await createDialogue(
        c.env,
        request,
        response,
        auth.userId
      );
      return c.json({
        ...response,
        dialogueId
      });
    }

    return c.json(response);
  } catch (error) {
    console.error('[Attributes] Extract error:', error);
    return c.json(
      { error: 'Failed to extract attribute', details: error.message },
      500
    );
  }
});

/**
 * POST /v2/attributes/refine
 * Refine an existing definition based on user feedback
 */
app.post('/refine', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();

    // Validate request
    const request = RefineAttributeRequestSchema.parse(body);

    // Get dialogue history from database
    const dialogue = await getDialogue(c.env, request.dialogueId);

    if (!dialogue) {
      return c.json({ error: 'Dialogue not found' }, 404);
    }

    if (dialogue.user_id !== auth.userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Parse messages and type
    const messages: DialogueMessage[] = JSON.parse(dialogue.messages);
    const type = dialogue.type;

    // Create extraction service
    const service = createAttributeExtractionService(c.env);

    // Refine the attribute
    const response = await service.refineAttribute(request, type as any, messages);

    // Update dialogue
    await updateDialogueWithRefinement(
      c.env,
      request.dialogueId,
      request.feedback,
      response,
      auth.userId
    );

    return c.json({
      ...response,
      dialogueId: request.dialogueId
    });
  } catch (error) {
    console.error('[Attributes] Refine error:', error);
    return c.json(
      { error: 'Failed to refine attribute', details: error.message },
      500
    );
  }
});

/**
 * GET /v2/attributes/examples
 * Get example starters for inspiration
 */
app.get('/examples', async (c) => {
  const type = c.req.query('type');

  if (type) {
    const filtered = EXAMPLE_STARTERS.filter(ex => ex.type === type);
    return c.json(filtered);
  }

  return c.json(EXAMPLE_STARTERS);
});

/**
 * POST /v2/attributes/generate-example
 * Generate an example of how an attribute would transform text
 */
app.post('/generate-example', optionalLocalAuth(), async (c) => {
  try {
    const body = await c.req.json();
    const { definition, type, sampleText } = body;

    if (!definition || !type) {
      return c.json({ error: 'Missing definition or type' }, 400);
    }

    const service = createAttributeExtractionService(c.env);
    const example = await service.generateExample(
      definition,
      type,
      sampleText || 'The quantum computer processed the calculation in parallel universes.'
    );

    return c.json({ example });
  } catch (error) {
    console.error('[Attributes] Generate example error:', error);
    return c.json(
      { error: 'Failed to generate example', details: error.message },
      500
    );
  }
});

/**
 * GET /v2/attributes/dialogue/:id
 * Get a dialogue session
 */
app.get('/dialogue/:id', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const dialogueId = c.req.param('id');

    const dialogue = await getDialogue(c.env, dialogueId);

    if (!dialogue) {
      return c.json({ error: 'Dialogue not found' }, 404);
    }

    if (dialogue.user_id !== auth.userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    return c.json({
      id: dialogue.id,
      type: dialogue.type,
      messages: JSON.parse(dialogue.messages),
      currentDefinition: dialogue.current_definition ? JSON.parse(dialogue.current_definition) : null,
      status: dialogue.status,
      createdAt: dialogue.created_at,
      completedAt: dialogue.completed_at
    });
  } catch (error) {
    console.error('[Attributes] Get dialogue error:', error);
    return c.json(
      { error: 'Failed to get dialogue', details: error.message },
      500
    );
  }
});

// ============================================================================
// Database Helper Functions
// ============================================================================

async function createDialogue(
  env: Env,
  request: any,
  response: any,
  userId: string
): Promise<string> {
  const dialogueId = uuidv4();

  const messages: DialogueMessage[] = [
    {
      role: 'user',
      content: request.description,
      timestamp: Date.now()
    },
    {
      role: 'assistant',
      content: response.questions ? response.questions.join('\n\n') : 'Extracted successfully',
      timestamp: Date.now()
    }
  ];

  await env.DB.prepare(`
    INSERT INTO attribute_dialogues (
      id, user_id, type, messages, current_definition, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    dialogueId,
    userId,
    request.type,
    JSON.stringify(messages),
    response.definition ? JSON.stringify(response.definition) : null,
    response.questions ? 'in_progress' : 'completed',
    Date.now()
  ).run();

  return dialogueId;
}

async function updateDialogue(
  env: Env,
  dialogueId: string,
  userMessage: string,
  response: any,
  userId: string
): Promise<void> {
  const dialogue = await getDialogue(env, dialogueId);

  if (!dialogue || dialogue.user_id !== userId) {
    throw new Error('Dialogue not found or unauthorized');
  }

  const messages = JSON.parse(dialogue.messages);
  messages.push(
    {
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    },
    {
      role: 'assistant',
      content: response.questions ? response.questions.join('\n\n') : 'Extracted successfully',
      timestamp: Date.now()
    }
  );

  const status = response.questions ? 'in_progress' : 'completed';
  const completedAt = status === 'completed' ? Date.now() : null;

  await env.DB.prepare(`
    UPDATE attribute_dialogues
    SET messages = ?, current_definition = ?, status = ?, completed_at = ?
    WHERE id = ?
  `).bind(
    JSON.stringify(messages),
    response.definition ? JSON.stringify(response.definition) : dialogue.current_definition,
    status,
    completedAt,
    dialogueId
  ).run();
}

async function updateDialogueWithRefinement(
  env: Env,
  dialogueId: string,
  userFeedback: string,
  response: any,
  userId: string
): Promise<void> {
  const dialogue = await getDialogue(env, dialogueId);

  if (!dialogue || dialogue.user_id !== userId) {
    throw new Error('Dialogue not found or unauthorized');
  }

  const messages = JSON.parse(dialogue.messages);
  messages.push(
    {
      role: 'user',
      content: userFeedback,
      timestamp: Date.now()
    },
    {
      role: 'assistant',
      content: response.questions
        ? response.questions.join('\n\n')
        : 'Refined the definition based on your feedback.',
      timestamp: Date.now()
    }
  );

  const status = response.questions ? 'in_progress' : 'completed';
  const completedAt = status === 'completed' ? Date.now() : null;

  await env.DB.prepare(`
    UPDATE attribute_dialogues
    SET messages = ?, current_definition = ?, status = ?, completed_at = ?
    WHERE id = ?
  `).bind(
    JSON.stringify(messages),
    response.definition ? JSON.stringify(response.definition) : dialogue.current_definition,
    status,
    completedAt,
    dialogueId
  ).run();
}

async function getDialogue(env: Env, dialogueId: string): Promise<any> {
  const result = await env.DB.prepare(`
    SELECT * FROM attribute_dialogues WHERE id = ?
  `).bind(dialogueId).first();

  return result;
}

export default app;