// Story Generation Routes
import { Hono } from 'hono';
import { optionalLocalAuth, getAuthContext } from '../middleware/auth';
import { StoryGenerationService, type StoryLength } from '../services/story-generation';
import type { Env } from '../../shared/types';

const storyGenerationRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /story-generation/generate - Generate original story from attributes
 *
 * The inverse problem: attributes → narrative
 */
storyGenerationRoutes.post('/generate', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();
    const {
      persona,
      namespace,
      style,
      seed,
      length = 'medium',
      model
    } = body;

    // Validate input
    if (!persona || !namespace || !style) {
      return c.json({
        error: 'Missing required fields: persona, namespace, style'
      }, 400);
    }

    // Validate length
    if (length && !['short', 'medium', 'long'].includes(length)) {
      return c.json({
        error: 'Invalid length. Must be: short, medium, or long'
      }, 400);
    }

    // Fetch persona from database
    const personaRow = await c.env.DB.prepare(
      'SELECT * FROM npe_personas WHERE name = ?'
    ).bind(persona).first();

    if (!personaRow) {
      return c.json({ error: `Invalid persona: ${persona}` }, 400);
    }

    // Fetch namespace from database
    const namespaceRow = await c.env.DB.prepare(
      'SELECT * FROM npe_namespaces WHERE name = ?'
    ).bind(namespace).first();

    if (!namespaceRow) {
      return c.json({ error: `Invalid namespace: ${namespace}` }, 400);
    }

    // Fetch style from database
    const styleRow = await c.env.DB.prepare(
      'SELECT * FROM npe_styles WHERE name = ?'
    ).bind(style).first();

    if (!styleRow) {
      return c.json({ error: `Invalid style: ${style}` }, 400);
    }

    // Get model preference if not specified
    let selectedModel = model;
    if (!selectedModel) {
      const userPrefsRow = await c.env.DB.prepare(
        'SELECT preferred_model FROM users WHERE id = ?'
      ).bind(auth.userId).first();

      selectedModel = (userPrefsRow?.preferred_model as string) || '@cf/meta/llama-3.1-8b-instruct';
    }

    // Create service
    const service = new StoryGenerationService(
      c.env,
      {
        id: personaRow.id as number,
        name: personaRow.name as string,
        description: personaRow.description as string,
        system_prompt: personaRow.system_prompt as string
      },
      {
        id: namespaceRow.id as number,
        name: namespaceRow.name as string,
        description: namespaceRow.description as string,
        context_prompt: namespaceRow.context_prompt as string
      },
      {
        id: styleRow.id as number,
        name: styleRow.name as string,
        style_prompt: styleRow.style_prompt as string
      },
      auth.userId,
      selectedModel,
      length as StoryLength,
      seed
    );

    // Generate story
    const result = await service.generate();

    return c.json({
      success: true,
      ...result
    }, 200);

  } catch (error) {
    console.error('Story generation error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, 500);
  }
});

/**
 * GET /story-generation/examples - Get example prompts for story generation
 */
storyGenerationRoutes.get('/examples', async (c) => {
  const examples = [
    {
      title: 'Holmes in Mythology',
      description: 'Analytical detective voice in Greek mythological setting',
      attributes: {
        persona: 'holmes_analytical',
        namespace: 'mythology',
        style: 'standard',
        length: 'medium'
      }
    },
    {
      title: 'Quantum Philosophy',
      description: 'Deep philosophical exploration of quantum physics',
      attributes: {
        persona: 'philosopher',
        namespace: 'quantum',
        style: 'academic',
        length: 'long'
      }
    },
    {
      title: 'Corporate Satire',
      description: 'Critical examination of corporate dystopia',
      attributes: {
        persona: 'critic',
        namespace: 'corporate',
        style: 'casual',
        length: 'medium',
        seed: 'A mandatory team-building exercise goes wrong'
      }
    },
    {
      title: 'Nature Poetry',
      description: 'Engaging storyteller exploring natural world poetically',
      attributes: {
        persona: 'storyteller',
        namespace: 'nature',
        style: 'poetic',
        length: 'short'
      }
    },
    {
      title: 'Medieval Quest',
      description: 'Advocacy for heroism in medieval realm',
      attributes: {
        persona: 'advocate',
        namespace: 'medieval',
        style: 'standard',
        length: 'medium',
        seed: 'A young squire discovers an ancient prophecy'
      }
    },
    {
      title: 'Scientific Analysis',
      description: 'Technical examination of scientific method',
      attributes: {
        persona: 'critic',
        namespace: 'science',
        style: 'technical',
        length: 'medium',
        seed: 'An unexpected result challenges established theory'
      }
    }
  ];

  return c.json({
    success: true,
    examples
  });
});

export { storyGenerationRoutes };
