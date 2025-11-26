// Node Subscriptions API routes
// Powers the VAX Notes-style dashboard with unread counts
import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../middleware/auth';

const subscriptionsRoutes = new Hono();

/**
 * POST /api/subscriptions - Subscribe to a Node
 */
subscriptionsRoutes.post('/', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  
  try {
    const { nodeId, preferences = {} } = await c.req.json();

    if (!nodeId) {
      return c.json({ error: 'nodeId is required' }, 400);
    }

    // Verify node exists and is active
    const node = await c.env.DB.prepare(
      `SELECT id, name, slug, creator_user_id FROM nodes WHERE id = ? AND status = 'active'`
    ).bind(nodeId).first<{ id: string; name: string; slug: string; creator_user_id: string }>();
    
    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }

    // Check if already subscribed
    const existing = await c.env.DB.prepare(
      `SELECT id FROM node_subscriptions WHERE user_id = ? AND node_id = ?`
    ).bind(auth.userId, nodeId).first();
    
    if (existing) {
      return c.json({ error: 'Already subscribed to this Node' }, 409);
    }

    const subscriptionId = crypto.randomUUID();
    const now = Date.now();

    const defaultPrefs = {
      notifyOnNewNarrative: true,
      notifyOnUpdate: true,
      emailDigest: 'none',
      ...preferences,
    };

    await c.env.DB.prepare(
      `INSERT INTO node_subscriptions (id, user_id, node_id, preferences, last_checked, unread_count, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`
    ).bind(
      subscriptionId,
      auth.userId,
      nodeId,
      JSON.stringify(defaultPrefs),
      now,
      now
    ).run();

    return c.json({
      subscription: {
        id: subscriptionId,
        nodeId,
        node: {
          id: node.id,
          name: node.name,
          slug: node.slug,
        },
        preferences: defaultPrefs,
        unreadCount: 0,
        lastChecked: now,
        createdAt: now,
      }
    }, 201);
    
  } catch (error) {
    console.error('[SUBSCRIPTIONS] Create error:', error);
    return c.json({ error: 'Failed to subscribe' }, 500);
  }
});

/**
 * GET /api/subscriptions - List user's subscriptions (VAX Notes dashboard data)
 */
subscriptionsRoutes.get('/', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT 
        s.id, s.node_id, s.preferences, s.last_checked, s.unread_count, s.created_at,
        n.name as node_name, n.slug as node_slug, n.description as node_description,
        (SELECT COUNT(*) FROM narratives WHERE node_id = n.id) as narrative_count
       FROM node_subscriptions s
       JOIN nodes n ON s.node_id = n.id
       WHERE s.user_id = ? AND n.status = 'active'
       ORDER BY s.unread_count DESC, n.name ASC`
    ).bind(auth.userId).all();

    const subscriptions = (results || []).map((sub: Record<string, unknown>) => ({
      id: sub.id,
      node: {
        id: sub.node_id,
        name: sub.node_name,
        slug: sub.node_slug,
        description: sub.node_description,
        narrativeCount: sub.narrative_count || 0,
      },
      preferences: sub.preferences ? JSON.parse(sub.preferences as string) : {},
      unreadCount: sub.unread_count || 0,
      lastChecked: sub.last_checked,
      createdAt: sub.created_at,
    }));

    // Total unread across all subscriptions
    const totalUnread = subscriptions.reduce((sum, s) => sum + s.unreadCount, 0);

    return c.json({ 
      subscriptions,
      totalUnread,
    });
  } catch (error) {
    console.error('[SUBSCRIPTIONS] List error:', error);
    return c.json({ error: 'Failed to fetch subscriptions' }, 500);
  }
});

/**
 * GET /api/subscriptions/:id - Get single subscription details
 */
subscriptionsRoutes.get('/:id', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const subscriptionId = c.req.param('id');
  
  try {
    const sub = await c.env.DB.prepare(
      `SELECT 
        s.*, n.name as node_name, n.slug as node_slug
       FROM node_subscriptions s
       JOIN nodes n ON s.node_id = n.id
       WHERE s.id = ? AND s.user_id = ?`
    ).bind(subscriptionId, auth.userId).first<Record<string, unknown>>();
    
    if (!sub) {
      return c.json({ error: 'Subscription not found' }, 404);
    }

    return c.json({
      subscription: {
        id: sub.id,
        node: {
          id: sub.node_id,
          name: sub.node_name,
          slug: sub.node_slug,
        },
        preferences: sub.preferences ? JSON.parse(sub.preferences as string) : {},
        unreadCount: sub.unread_count || 0,
        lastChecked: sub.last_checked,
        createdAt: sub.created_at,
      },
    });
  } catch (error) {
    console.error('[SUBSCRIPTIONS] Get error:', error);
    return c.json({ error: 'Failed to fetch subscription' }, 500);
  }
});

/**
 * PUT /api/subscriptions/:id - Update subscription preferences
 */
subscriptionsRoutes.put('/:id', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const subscriptionId = c.req.param('id');
  
  try {
    // Verify ownership
    const existing = await c.env.DB.prepare(
      `SELECT id, preferences FROM node_subscriptions WHERE id = ? AND user_id = ?`
    ).bind(subscriptionId, auth.userId).first<{ id: string; preferences: string }>();
    
    if (!existing) {
      return c.json({ error: 'Subscription not found' }, 404);
    }
    
    const { preferences } = await c.req.json();
    
    const currentPrefs = existing.preferences ? JSON.parse(existing.preferences) : {};
    const newPrefs = { ...currentPrefs, ...preferences };
    
    await c.env.DB.prepare(
      `UPDATE node_subscriptions SET preferences = ? WHERE id = ?`
    ).bind(JSON.stringify(newPrefs), subscriptionId).run();

    return c.json({
      subscription: {
        id: subscriptionId,
        preferences: newPrefs,
      },
    });
  } catch (error) {
    console.error('[SUBSCRIPTIONS] Update error:', error);
    return c.json({ error: 'Failed to update subscription' }, 500);
  }
});

/**
 * PUT /api/subscriptions/:id/mark-read - Mark Node as read (reset unread count)
 */
subscriptionsRoutes.put('/:id/mark-read', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const subscriptionId = c.req.param('id');
  
  try {
    // Verify ownership
    const existing = await c.env.DB.prepare(
      `SELECT id FROM node_subscriptions WHERE id = ? AND user_id = ?`
    ).bind(subscriptionId, auth.userId).first();
    
    if (!existing) {
      return c.json({ error: 'Subscription not found' }, 404);
    }
    
    const now = Date.now();
    
    await c.env.DB.prepare(
      `UPDATE node_subscriptions SET unread_count = 0, last_checked = ? WHERE id = ?`
    ).bind(now, subscriptionId).run();

    return c.json({
      subscription: {
        id: subscriptionId,
        unreadCount: 0,
        lastChecked: now,
      },
    });
  } catch (error) {
    console.error('[SUBSCRIPTIONS] Mark read error:', error);
    return c.json({ error: 'Failed to mark as read' }, 500);
  }
});

/**
 * POST /api/subscriptions/mark-all-read - Mark all subscriptions as read
 */
subscriptionsRoutes.post('/mark-all-read', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  
  try {
    const now = Date.now();
    
    await c.env.DB.prepare(
      `UPDATE node_subscriptions SET unread_count = 0, last_checked = ? WHERE user_id = ?`
    ).bind(now, auth.userId).run();

    return c.json({
      success: true,
      lastChecked: now,
    });
  } catch (error) {
    console.error('[SUBSCRIPTIONS] Mark all read error:', error);
    return c.json({ error: 'Failed to mark all as read' }, 500);
  }
});

/**
 * DELETE /api/subscriptions/:id - Unsubscribe from Node
 */
subscriptionsRoutes.delete('/:id', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const subscriptionId = c.req.param('id');
  
  try {
    // Verify ownership
    const existing = await c.env.DB.prepare(
      `SELECT id FROM node_subscriptions WHERE id = ? AND user_id = ?`
    ).bind(subscriptionId, auth.userId).first();
    
    if (!existing) {
      return c.json({ error: 'Subscription not found' }, 404);
    }
    
    await c.env.DB.prepare(
      `DELETE FROM node_subscriptions WHERE id = ?`
    ).bind(subscriptionId).run();

    return c.json({ success: true, id: subscriptionId });
  } catch (error) {
    console.error('[SUBSCRIPTIONS] Delete error:', error);
    return c.json({ error: 'Failed to unsubscribe' }, 500);
  }
});

/**
 * GET /api/subscriptions/node/:nodeId - Check if subscribed to specific node
 */
subscriptionsRoutes.get('/node/:nodeId', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const nodeId = c.req.param('nodeId');
  
  try {
    const sub = await c.env.DB.prepare(
      `SELECT id, unread_count, last_checked FROM node_subscriptions 
       WHERE user_id = ? AND node_id = ?`
    ).bind(auth.userId, nodeId).first<{ id: string; unread_count: number; last_checked: number }>();
    
    return c.json({
      isSubscribed: !!sub,
      subscription: sub ? {
        id: sub.id,
        unreadCount: sub.unread_count,
        lastChecked: sub.last_checked,
      } : null,
    });
  } catch (error) {
    console.error('[SUBSCRIPTIONS] Check error:', error);
    return c.json({ error: 'Failed to check subscription' }, 500);
  }
});

export default subscriptionsRoutes;
