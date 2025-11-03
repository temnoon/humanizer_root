// Configuration routes for NPE Workers API
import { Hono } from 'hono';
import type { Env, NPEPersona, NPENamespace, NPEStyle } from '../../shared/types';

const configRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /config/personas - List available personas
 *
 * Returns all available narrator personas (neutral, advocate, critic, philosopher, storyteller)
 */
configRoutes.get('/personas', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT * FROM npe_personas ORDER BY id'
    ).all();

    const personas: NPEPersona[] = result.results.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      system_prompt: row.system_prompt
    }));

    return c.json(personas, 200);
  } catch (error) {
    console.error('Error fetching personas:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /config/namespaces - List available namespaces
 *
 * Returns all available fictional universes (mythology, quantum, nature, corporate, medieval, science)
 */
configRoutes.get('/namespaces', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT * FROM npe_namespaces ORDER BY id'
    ).all();

    const namespaces: NPENamespace[] = result.results.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      context_prompt: row.context_prompt
    }));

    return c.json(namespaces, 200);
  } catch (error) {
    console.error('Error fetching namespaces:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /config/styles - List available styles
 *
 * Returns all available language styles (standard, academic, poetic, technical, casual)
 */
configRoutes.get('/styles', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT * FROM npe_styles ORDER BY id'
    ).all();

    const styles: NPEStyle[] = result.results.map((row: any) => ({
      id: row.id,
      name: row.name,
      style_prompt: row.style_prompt
    }));

    return c.json(styles, 200);
  } catch (error) {
    console.error('Error fetching styles:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /config/languages - List supported languages for round-trip translation
 *
 * Returns array of 18 supported intermediate languages
 */
configRoutes.get('/languages', async (c) => {
  const languages = [
    'spanish', 'french', 'german', 'italian', 'portuguese', 'russian',
    'chinese', 'japanese', 'korean', 'arabic', 'hebrew', 'hindi',
    'dutch', 'swedish', 'norwegian', 'danish', 'polish', 'czech'
  ];

  return c.json({ languages }, 200);
});

export default configRoutes;
