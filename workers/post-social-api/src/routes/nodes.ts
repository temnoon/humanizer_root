// Node System API routes
// AI-curated topic archives for Post-Social Network
import { Hono } from 'hono';
import { requireAuth, optionalAuth, getAuthContext } from '../middleware/auth';

const nodesRoutes = new Hono();

/**
 * Generate URL-friendly slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * POST /api/nodes - Create new Node (requires auth)
 */
nodesRoutes.post('/', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  
  try {
    const { name, description, curator, visibility = 'public' } = await c.req.json();

    if (!name || name.trim().length === 0) {
      return c.json({ error: 'Name is required' }, 400);
    }

    if (name.length > 100) {
      return c.json({ error: 'Name too long (max 100 characters)' }, 400);
    }

    // Generate slug and ensure uniqueness
    let slug = generateSlug(name);
    const existing = await c.env.DB.prepare(
      `SELECT id FROM nodes WHERE slug = ?`
    ).bind(slug).first();
    
    if (existing) {
      // Add random suffix for uniqueness
      slug = `${slug}-${crypto.randomUUID().substring(0, 8)}`;
    }

    const nodeId = crypto.randomUUID();
    const now = Date.now();

    // Default curator config if not provided
    const curatorConfig = curator || {
      personality: 'neutral',
      systemPrompt: 'You are a thoughtful curator.',
      model: 'llama-3.2',
      filterCriteria: {
        minQuality: 0.5,
        acceptedTopics: [],
        rejectedTopics: []
      }
    };

    await c.env.DB.prepare(
      `INSERT INTO nodes (id, name, slug, description, creator_user_id, curator_config, archive_metadata, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '{}', 'active', ?, ?)`
    ).bind(
      nodeId,
      name.trim(),
      slug,
      description || null,
      auth.userId,
      JSON.stringify(curatorConfig),
      now,
      now
    ).run();

    return c.json({
      node: {
        id: nodeId,
        name: name.trim(),
        slug,
        description,
        creatorUserId: auth.userId,
        curatorConfig,
        status: 'active',
        createdAt: now,
      }
    }, 201);
    
  } catch (error) {
    console.error('[NODES] Create error:', error);
    return c.json({ error: 'Failed to create node' }, 500);
  }
});

/**
 * GET /api/nodes - List all public Nodes (with optional auth for user's own)
 */
nodesRoutes.get('/', optionalAuth(), async (c) => {
  const auth = getAuthContext(c);
  const search = c.req.query('search');
  const mine = c.req.query('mine') === 'true';
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = parseInt(c.req.query('offset') || '0');
  
  try {
    let query: string;
    const params: (string | number)[] = [];
    
    if (mine && auth) {
      // User's own nodes
      query = `
        SELECT 
          n.id, n.name, n.slug, n.description, n.creator_user_id,
          n.curator_config, n.archive_metadata, n.status,
          n.created_at, n.updated_at,
          (SELECT COUNT(*) FROM narratives WHERE node_id = n.id) as narrative_count,
          (SELECT COUNT(*) FROM node_subscriptions WHERE node_id = n.id) as subscriber_count
        FROM nodes n
        WHERE n.creator_user_id = ? AND n.status = 'active'
      `;
      params.push(auth.userId);
    } else {
      // Public nodes
      query = `
        SELECT 
          n.id, n.name, n.slug, n.description, n.creator_user_id,
          n.archive_metadata, n.status,
          n.created_at, n.updated_at,
          (SELECT COUNT(*) FROM narratives WHERE node_id = n.id AND visibility = 'public') as narrative_count,
          (SELECT COUNT(*) FROM node_subscriptions WHERE node_id = n.id) as subscriber_count
        FROM nodes n
        WHERE n.status = 'active'
      `;
    }
    
    if (search) {
      query += ` AND (n.name LIKE ? OR n.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ` ORDER BY subscriber_count DESC, n.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const { results } = await c.env.DB.prepare(query).bind(...params).all();

    const nodes = (results || []).map((node: Record<string, unknown>) => ({
      id: node.id,
      name: node.name,
      slug: node.slug,
      description: node.description,
      creatorUserId: node.creator_user_id,
      narrativeCount: node.narrative_count || 0,
      subscriberCount: node.subscriber_count || 0,
      status: node.status,
      createdAt: node.created_at,
      updatedAt: node.updated_at,
      // Only include curator config for owner
      ...(mine && { curatorConfig: node.curator_config ? JSON.parse(node.curator_config as string) : null }),
      archiveMetadata: node.archive_metadata ? JSON.parse(node.archive_metadata as string) : {},
    }));

    return c.json({ 
      nodes,
      pagination: {
        limit,
        offset,
        hasMore: nodes.length === limit,
      },
    });
  } catch (error) {
    console.error('[NODES] List error:', error);
    return c.json({ error: 'Failed to fetch nodes' }, 500);
  }
});

/**
 * GET /api/nodes/:slug - Get Node details by slug
 */
nodesRoutes.get('/:slug', optionalAuth(), async (c) => {
  const auth = getAuthContext(c);
  const slug = c.req.param('slug');
  
  try {
    const node = await c.env.DB.prepare(
      `SELECT 
        n.id, n.name, n.slug, n.description, n.creator_user_id,
        n.curator_config, n.archive_metadata, n.status,
        n.created_at, n.updated_at,
        (SELECT COUNT(*) FROM narratives WHERE node_id = n.id) as narrative_count,
        (SELECT COUNT(*) FROM node_subscriptions WHERE node_id = n.id) as subscriber_count
       FROM nodes n
       WHERE n.slug = ?`
    ).bind(slug).first<Record<string, unknown>>();

    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }

    if (node.status === 'archived' && node.creator_user_id !== auth?.userId) {
      return c.json({ error: 'Node not found' }, 404);
    }

    const isOwner = auth?.userId === node.creator_user_id;

    // Get recent narratives
    const { results: narratives } = await c.env.DB.prepare(
      `SELECT id, title, slug, current_version, metadata, created_at, updated_at
       FROM narratives 
       WHERE node_id = ? ${!isOwner ? "AND visibility = 'public'" : ''}
       ORDER BY updated_at DESC 
       LIMIT 10`
    ).bind(node.id).all();

    // Check if current user is subscribed
    let isSubscribed = false;
    if (auth) {
      const sub = await c.env.DB.prepare(
        `SELECT id FROM node_subscriptions WHERE user_id = ? AND node_id = ?`
      ).bind(auth.userId, node.id).first();
      isSubscribed = !!sub;
    }

    return c.json({
      node: {
        id: node.id,
        name: node.name,
        slug: node.slug,
        description: node.description,
        creatorUserId: node.creator_user_id,
        narrativeCount: node.narrative_count || 0,
        subscriberCount: node.subscriber_count || 0,
        status: node.status,
        createdAt: node.created_at,
        updatedAt: node.updated_at,
        // Only include curator config for owner
        ...(isOwner && { curatorConfig: node.curator_config ? JSON.parse(node.curator_config as string) : null }),
        archiveMetadata: node.archive_metadata ? JSON.parse(node.archive_metadata as string) : {},
        isOwner,
        isSubscribed,
        narratives: (narratives || []).map((n: Record<string, unknown>) => ({
          id: n.id,
          title: n.title,
          slug: n.slug,
          currentVersion: n.current_version,
          metadata: n.metadata ? JSON.parse(n.metadata as string) : {},
          createdAt: n.created_at,
          updatedAt: n.updated_at,
        })),
      },
    });
  } catch (error) {
    console.error('[NODES] Get error:', error);
    return c.json({ error: 'Failed to fetch node' }, 500);
  }
});

/**
 * PUT /api/nodes/:id - Update Node (owner only)
 */
nodesRoutes.put('/:id', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const nodeId = c.req.param('id');
  
  try {
    // Verify ownership
    const existing = await c.env.DB.prepare(
      `SELECT creator_user_id FROM nodes WHERE id = ?`
    ).bind(nodeId).first<{ creator_user_id: string }>();
    
    if (!existing) {
      return c.json({ error: 'Node not found' }, 404);
    }
    
    if (existing.creator_user_id !== auth.userId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const { name, description, curator } = await c.req.json();
    const now = Date.now();
    
    // Build update query dynamically
    const updates: string[] = ['updated_at = ?'];
    const params: (string | number)[] = [now];
    
    if (name !== undefined) {
      if (name.length > 100) {
        return c.json({ error: 'Name too long (max 100 characters)' }, 400);
      }
      updates.push('name = ?');
      params.push(name.trim());
    }
    
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    
    if (curator !== undefined) {
      updates.push('curator_config = ?');
      params.push(JSON.stringify(curator));
    }
    
    params.push(nodeId);
    
    await c.env.DB.prepare(
      `UPDATE nodes SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run();

    // Fetch updated node
    const updated = await c.env.DB.prepare(
      `SELECT * FROM nodes WHERE id = ?`
    ).bind(nodeId).first<Record<string, unknown>>();
    
    return c.json({
      node: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        description: updated.description,
        curatorConfig: updated.curator_config ? JSON.parse(updated.curator_config as string) : null,
        updatedAt: updated.updated_at,
      },
    });
    
  } catch (error) {
    console.error('[NODES] Update error:', error);
    return c.json({ error: 'Failed to update node' }, 500);
  }
});

/**
 * DELETE /api/nodes/:id - Archive Node (soft delete, owner only)
 */
nodesRoutes.delete('/:id', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const nodeId = c.req.param('id');
  
  try {
    // Verify ownership
    const existing = await c.env.DB.prepare(
      `SELECT creator_user_id FROM nodes WHERE id = ?`
    ).bind(nodeId).first<{ creator_user_id: string }>();
    
    if (!existing) {
      return c.json({ error: 'Node not found' }, 404);
    }
    
    if (existing.creator_user_id !== auth.userId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    // Soft delete - set status to archived
    await c.env.DB.prepare(
      `UPDATE nodes SET status = 'archived', updated_at = ? WHERE id = ?`
    ).bind(Date.now(), nodeId).run();

    return c.json({ success: true, id: nodeId });
  } catch (error) {
    console.error('[NODES] Delete error:', error);
    return c.json({ error: 'Failed to delete node' }, 500);
  }
});

export default nodesRoutes;
