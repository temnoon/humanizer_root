// Narrative routes for Post-Social Node System
// Evolving essays with versioning
import { Hono } from 'hono';
import { requireAuth, optionalAuth, getAuthContext } from '../middleware/auth';
import { generateDiff, generateUnifiedDiff, generateSideBySide, calculateSemanticShift } from '../utils/diff';

const narrativesRoutes = new Hono();

/**
 * Generate URL-friendly slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

/**
 * Calculate reading time from content
 */
function calculateReadingTime(content: string): number {
  const words = content.split(/\s+/).length;
  return Math.ceil(words / 200); // 200 words per minute
}

/**
 * POST /api/nodes/:nodeId/narratives - Publish narrative to Node
 */
narrativesRoutes.post('/:nodeId/narratives', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const nodeId = c.req.param('nodeId');
  
  try {
    // Verify node ownership
    const node = await c.env.DB.prepare(
      `SELECT id, creator_user_id, name FROM nodes WHERE id = ? AND status = 'active'`
    ).bind(nodeId).first<{ id: string; creator_user_id: string; name: string }>();
    
    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }
    
    if (node.creator_user_id !== auth.userId) {
      return c.json({ error: 'Only Node owner can publish narratives' }, 403);
    }
    
    const { title, content, tags = [], visibility = 'public' } = await c.req.json();

    if (!title || title.trim().length === 0) {
      return c.json({ error: 'Title is required' }, 400);
    }

    if (!content || content.trim().length === 0) {
      return c.json({ error: 'Content is required' }, 400);
    }

    if (title.length > 200) {
      return c.json({ error: 'Title too long (max 200 characters)' }, 400);
    }

    // Generate unique slug within node
    let slug = generateSlug(title);
    const existing = await c.env.DB.prepare(
      `SELECT id FROM narratives WHERE node_id = ? AND slug = ?`
    ).bind(nodeId, slug).first();
    
    if (existing) {
      slug = `${slug}-${crypto.randomUUID().substring(0, 8)}`;
    }

    const narrativeId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const now = Date.now();

    const metadata = {
      tags: Array.isArray(tags) ? tags : [],
      wordCount: content.split(/\s+/).length,
      readingTime: calculateReadingTime(content),
    };

    // Insert narrative
    await c.env.DB.prepare(
      `INSERT INTO narratives (id, node_id, current_version, title, slug, content, metadata, synthesis, visibility, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?, ?, ?, '{"status":"none","pendingComments":0}', ?, ?, ?)`
    ).bind(
      narrativeId,
      nodeId,
      title.trim(),
      slug,
      content,
      JSON.stringify(metadata),
      visibility,
      now,
      now
    ).run();

    // Insert version 1
    await c.env.DB.prepare(
      `INSERT INTO narrative_versions (id, narrative_id, version, content, changes, trigger_info, created_at)
       VALUES (?, ?, 1, ?, '{"summary":"Initial publication"}', '{"type":"manual","actor":"${auth.userId}"}', ?)`
    ).bind(versionId, narrativeId, content, now).run();

    // Update node archive metadata
    await c.env.DB.prepare(
      `UPDATE nodes SET 
        archive_metadata = json_set(
          COALESCE(archive_metadata, '{}'),
          '$.narrativeCount', (SELECT COUNT(*) FROM narratives WHERE node_id = ?),
          '$.lastPublished', ?
        ),
        updated_at = ?
       WHERE id = ?`
    ).bind(nodeId, new Date(now).toISOString(), now, nodeId).run();

    // Increment unread count for all subscribers
    await c.env.DB.prepare(
      `UPDATE node_subscriptions 
       SET unread_count = unread_count + 1
       WHERE node_id = ?`
    ).bind(nodeId).run();

    return c.json({
      narrative: {
        id: narrativeId,
        nodeId,
        nodeName: node.name,
        title: title.trim(),
        slug,
        currentVersion: 1,
        metadata,
        visibility,
        createdAt: now,
      }
    }, 201);
    
  } catch (error) {
    console.error('[NARRATIVES] Create error:', error);
    return c.json({ error: 'Failed to create narrative' }, 500);
  }
});

/**
 * GET /api/nodes/:nodeSlug/narratives/:narrativeSlug - Get narrative by slugs
 */
narrativesRoutes.get('/:nodeSlug/narratives/:narrativeSlug', optionalAuth(), async (c) => {
  const auth = getAuthContext(c);
  const nodeSlug = c.req.param('nodeSlug');
  const narrativeSlug = c.req.param('narrativeSlug');
  const version = c.req.query('version');
  
  try {
    // Get node first
    const node = await c.env.DB.prepare(
      `SELECT id, name, slug, creator_user_id FROM nodes WHERE slug = ? AND status = 'active'`
    ).bind(nodeSlug).first<{ id: string; name: string; slug: string; creator_user_id: string }>();
    
    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }
    
    const isOwner = auth?.userId === node.creator_user_id;
    
    // Get narrative
    const narrative = await c.env.DB.prepare(
      `SELECT * FROM narratives WHERE node_id = ? AND slug = ?`
    ).bind(node.id, narrativeSlug).first<Record<string, unknown>>();
    
    if (!narrative) {
      return c.json({ error: 'Narrative not found' }, 404);
    }
    
    // Check visibility
    if (narrative.visibility !== 'public' && !isOwner) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    // Get specific version content if requested
    let content = narrative.content as string;
    if (version) {
      const versionRecord = await c.env.DB.prepare(
        `SELECT content FROM narrative_versions WHERE narrative_id = ? AND version = ?`
      ).bind(narrative.id, parseInt(version)).first<{ content: string }>();
      
      if (versionRecord) {
        content = versionRecord.content;
      }
    }
    
    // Get version history (summaries only)
    const { results: versions } = await c.env.DB.prepare(
      `SELECT version, changes, trigger_info, created_at 
       FROM narrative_versions 
       WHERE narrative_id = ? 
       ORDER BY version DESC`
    ).bind(narrative.id).all();

    return c.json({
      narrative: {
        id: narrative.id,
        nodeId: node.id,
        nodeName: node.name,
        nodeSlug: node.slug,
        title: narrative.title,
        slug: narrative.slug,
        content,
        currentVersion: narrative.current_version,
        requestedVersion: version ? parseInt(version) : null,
        metadata: narrative.metadata ? JSON.parse(narrative.metadata as string) : {},
        synthesis: narrative.synthesis ? JSON.parse(narrative.synthesis as string) : {},
        visibility: narrative.visibility,
        subscriberCount: narrative.subscriber_count,
        createdAt: narrative.created_at,
        updatedAt: narrative.updated_at,
        isOwner,
        versions: (versions || []).map((v: Record<string, unknown>) => ({
          version: v.version,
          changes: v.changes ? JSON.parse(v.changes as string) : {},
          trigger: v.trigger_info ? JSON.parse(v.trigger_info as string) : {},
          createdAt: v.created_at,
        })),
      },
    });
  } catch (error) {
    console.error('[NARRATIVES] Get error:', error);
    return c.json({ error: 'Failed to fetch narrative' }, 500);
  }
});

/**
 * GET /api/narratives/:id - Get narrative by ID
 */
narrativesRoutes.get('/:id', optionalAuth(), async (c) => {
  const auth = getAuthContext(c);
  const narrativeId = c.req.param('id');
  
  try {
    const narrative = await c.env.DB.prepare(
      `SELECT n.*, nd.name as node_name, nd.slug as node_slug, nd.creator_user_id as node_creator
       FROM narratives n
       JOIN nodes nd ON n.node_id = nd.id
       WHERE n.id = ?`
    ).bind(narrativeId).first<Record<string, unknown>>();
    
    if (!narrative) {
      return c.json({ error: 'Narrative not found' }, 404);
    }
    
    const isOwner = auth?.userId === narrative.node_creator;
    
    if (narrative.visibility !== 'public' && !isOwner) {
      return c.json({ error: 'Access denied' }, 403);
    }

    return c.json({
      narrative: {
        id: narrative.id,
        nodeId: narrative.node_id,
        nodeName: narrative.node_name,
        nodeSlug: narrative.node_slug,
        title: narrative.title,
        slug: narrative.slug,
        content: narrative.content,
        currentVersion: narrative.current_version,
        metadata: narrative.metadata ? JSON.parse(narrative.metadata as string) : {},
        synthesis: narrative.synthesis ? JSON.parse(narrative.synthesis as string) : {},
        visibility: narrative.visibility,
        createdAt: narrative.created_at,
        updatedAt: narrative.updated_at,
        isOwner,
      },
    });
  } catch (error) {
    console.error('[NARRATIVES] Get by ID error:', error);
    return c.json({ error: 'Failed to fetch narrative' }, 500);
  }
});

/**
 * PUT /api/narratives/:id - Update narrative (creates new version)
 */
narrativesRoutes.put('/:id', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const narrativeId = c.req.param('id');
  
  try {
    // Get narrative with node info for ownership check
    const narrative = await c.env.DB.prepare(
      `SELECT n.*, nd.creator_user_id as node_creator
       FROM narratives n
       JOIN nodes nd ON n.node_id = nd.id
       WHERE n.id = ?`
    ).bind(narrativeId).first<Record<string, unknown>>();
    
    if (!narrative) {
      return c.json({ error: 'Narrative not found' }, 404);
    }
    
    if (narrative.node_creator !== auth.userId) {
      return c.json({ error: 'Only Node owner can update narratives' }, 403);
    }
    
    const { content, title, changeReason, tags, visibility } = await c.req.json();
    const now = Date.now();
    
    // Content change creates new version
    if (content && content !== narrative.content) {
      const newVersion = (narrative.current_version as number) + 1;
      const versionId = crypto.randomUUID();
      
      const changes = {
        summary: changeReason || `Updated to version ${newVersion}`,
        // TODO: Generate actual diff
        addedLines: 0,
        removedLines: 0,
      };
      
      const trigger = {
        type: 'manual',
        actor: auth.userId,
      };
      
      // Insert new version
      await c.env.DB.prepare(
        `INSERT INTO narrative_versions (id, narrative_id, version, content, changes, trigger_info, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        versionId,
        narrativeId,
        newVersion,
        content,
        JSON.stringify(changes),
        JSON.stringify(trigger),
        now
      ).run();
      
      // Update narrative current version
      const metadata = narrative.metadata ? JSON.parse(narrative.metadata as string) : {};
      if (tags) metadata.tags = tags;
      metadata.wordCount = content.split(/\s+/).length;
      metadata.readingTime = calculateReadingTime(content);
      
      await c.env.DB.prepare(
        `UPDATE narratives 
         SET content = ?, current_version = ?, metadata = ?, updated_at = ?
         ${title ? ', title = ?' : ''}
         ${visibility ? ', visibility = ?' : ''}
         WHERE id = ?`
      ).bind(
        content,
        newVersion,
        JSON.stringify(metadata),
        now,
        ...(title ? [title] : []),
        ...(visibility ? [visibility] : []),
        narrativeId
      ).run();
      
      // Increment unread count for subscribers
      await c.env.DB.prepare(
        `UPDATE node_subscriptions 
         SET unread_count = unread_count + 1
         WHERE node_id = ?`
      ).bind(narrative.node_id).run();
      
      return c.json({
        narrative: {
          id: narrativeId,
          currentVersion: newVersion,
          updatedAt: now,
        },
      });
    }
    
    // Non-content changes (title, visibility, tags only)
    const updates: string[] = ['updated_at = ?'];
    const params: (string | number)[] = [now];
    
    if (title) {
      updates.push('title = ?');
      params.push(title);
    }
    
    if (visibility) {
      updates.push('visibility = ?');
      params.push(visibility);
    }
    
    if (tags) {
      const metadata = narrative.metadata ? JSON.parse(narrative.metadata as string) : {};
      metadata.tags = tags;
      updates.push('metadata = ?');
      params.push(JSON.stringify(metadata));
    }
    
    params.push(narrativeId);
    
    await c.env.DB.prepare(
      `UPDATE narratives SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run();

    return c.json({
      narrative: {
        id: narrativeId,
        currentVersion: narrative.current_version,
        updatedAt: now,
      },
    });
    
  } catch (error) {
    console.error('[NARRATIVES] Update error:', error);
    return c.json({ error: 'Failed to update narrative' }, 500);
  }
});

/**
 * GET /api/narratives/:id/versions - List all versions
 */
narrativesRoutes.get('/:id/versions', optionalAuth(), async (c) => {
  const auth = getAuthContext(c);
  const narrativeId = c.req.param('id');
  
  try {
    // Get narrative with ownership check
    const narrative = await c.env.DB.prepare(
      `SELECT n.visibility, nd.creator_user_id as node_creator
       FROM narratives n
       JOIN nodes nd ON n.node_id = nd.id
       WHERE n.id = ?`
    ).bind(narrativeId).first<{ visibility: string; node_creator: string }>();
    
    if (!narrative) {
      return c.json({ error: 'Narrative not found' }, 404);
    }
    
    if (narrative.visibility !== 'public' && narrative.node_creator !== auth?.userId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const { results: versions } = await c.env.DB.prepare(
      `SELECT id, version, changes, trigger_info, created_at 
       FROM narrative_versions 
       WHERE narrative_id = ? 
       ORDER BY version DESC`
    ).bind(narrativeId).all();

    return c.json({
      versions: (versions || []).map((v: Record<string, unknown>) => ({
        id: v.id,
        version: v.version,
        changes: v.changes ? JSON.parse(v.changes as string) : {},
        trigger: v.trigger_info ? JSON.parse(v.trigger_info as string) : {},
        createdAt: v.created_at,
      })),
    });
  } catch (error) {
    console.error('[NARRATIVES] Versions list error:', error);
    return c.json({ error: 'Failed to fetch versions' }, 500);
  }
});

/**
 * GET /api/narratives/:id/versions/compare - Compare two versions
 * MUST be defined before /:id/versions/:version to avoid route conflict
 */
narrativesRoutes.get('/:id/versions/compare', optionalAuth(), async (c) => {
  const auth = getAuthContext(c);
  const narrativeId = c.req.param('id');
  const fromVersion = parseInt(c.req.query('from') || '1');
  const toVersion = parseInt(c.req.query('to') || '2');
  const format = c.req.query('format') || 'structured'; // 'structured' | 'unified' | 'side-by-side'
  
  try {
    // Check narrative access
    const narrative = await c.env.DB.prepare(
      `SELECT n.id, n.title, n.visibility, n.current_version, nd.creator_user_id as node_creator
       FROM narratives n
       JOIN nodes nd ON n.node_id = nd.id
       WHERE n.id = ?`
    ).bind(narrativeId).first<Record<string, unknown>>();
    
    if (!narrative) {
      return c.json({ error: 'Narrative not found' }, 404);
    }
    
    const isOwner = auth?.userId === narrative.node_creator;
    
    if (narrative.visibility !== 'public' && !isOwner) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    // Validate version numbers
    if (fromVersion < 1 || toVersion < 1) {
      return c.json({ error: 'Version numbers must be positive' }, 400);
    }
    
    if (fromVersion >= toVersion) {
      return c.json({ error: 'from version must be less than to version' }, 400);
    }
    
    if (toVersion > (narrative.current_version as number)) {
      return c.json({ error: `Version ${toVersion} does not exist. Current version is ${narrative.current_version}` }, 404);
    }
    
    // Get both versions
    const { results: versions } = await c.env.DB.prepare(
      `SELECT version, content, changes, trigger_info, created_at
       FROM narrative_versions
       WHERE narrative_id = ? AND version IN (?, ?)
       ORDER BY version ASC`
    ).bind(narrativeId, fromVersion, toVersion).all();
    
    if (!versions || versions.length !== 2) {
      return c.json({ error: 'One or both versions not found' }, 404);
    }
    
    const fromContent = versions[0].content as string;
    const toContent = versions[1].content as string;
    
    // Generate diff based on format
    let diffData: unknown;
    
    if (format === 'unified') {
      diffData = generateUnifiedDiff(
        fromContent,
        toContent,
        `v${fromVersion}`,
        `v${toVersion}`
      );
    } else if (format === 'side-by-side') {
      diffData = generateSideBySide(fromContent, toContent);
    } else {
      // Default: structured diff
      diffData = generateDiff(fromContent, toContent);
    }
    
    const semanticShift = calculateSemanticShift(fromContent, toContent);
    
    return c.json({
      comparison: {
        narrativeId,
        narrativeTitle: narrative.title,
        from: {
          version: fromVersion,
          content: fromContent,
          changes: versions[0].changes ? JSON.parse(versions[0].changes as string) : {},
          trigger: versions[0].trigger_info ? JSON.parse(versions[0].trigger_info as string) : {},
          createdAt: versions[0].created_at,
        },
        to: {
          version: toVersion,
          content: toContent,
          changes: versions[1].changes ? JSON.parse(versions[1].changes as string) : {},
          trigger: versions[1].trigger_info ? JSON.parse(versions[1].trigger_info as string) : {},
          createdAt: versions[1].created_at,
        },
        diff: diffData,
        format,
        stats: {
          semanticShift,
          ...(format === 'structured' && typeof diffData === 'object' && diffData !== null && 'addedLines' in diffData ? {
            addedLines: (diffData as { addedLines: number }).addedLines,
            removedLines: (diffData as { removedLines: number }).removedLines,
            similarity: (diffData as { similarity: number }).similarity,
          } : {}),
        },
      },
    });
  } catch (error) {
    console.error('[NARRATIVES] Compare error:', error);
    return c.json({ error: 'Failed to compare versions' }, 500);
  }
});

/**
 * GET /api/narratives/:id/versions/:version - Get specific version content
 */
narrativesRoutes.get('/:id/versions/:version', optionalAuth(), async (c) => {
  const auth = getAuthContext(c);
  const narrativeId = c.req.param('id');
  const versionNum = parseInt(c.req.param('version'));
  
  try {
    // Get narrative with ownership check
    const narrative = await c.env.DB.prepare(
      `SELECT n.visibility, nd.creator_user_id as node_creator
       FROM narratives n
       JOIN nodes nd ON n.node_id = nd.id
       WHERE n.id = ?`
    ).bind(narrativeId).first<{ visibility: string; node_creator: string }>();
    
    if (!narrative) {
      return c.json({ error: 'Narrative not found' }, 404);
    }
    
    if (narrative.visibility !== 'public' && narrative.node_creator !== auth?.userId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const version = await c.env.DB.prepare(
      `SELECT * FROM narrative_versions WHERE narrative_id = ? AND version = ?`
    ).bind(narrativeId, versionNum).first<Record<string, unknown>>();
    
    if (!version) {
      return c.json({ error: 'Version not found' }, 404);
    }

    return c.json({
      version: {
        id: version.id,
        narrativeId: version.narrative_id,
        version: version.version,
        content: version.content,
        changes: version.changes ? JSON.parse(version.changes as string) : {},
        trigger: version.trigger_info ? JSON.parse(version.trigger_info as string) : {},
        createdAt: version.created_at,
      },
    });
  } catch (error) {
    console.error('[NARRATIVES] Get version error:', error);
    return c.json({ error: 'Failed to fetch version' }, 500);
  }
});

/**
 * DELETE /api/narratives/:id - Delete narrative (owner only)
 */
narrativesRoutes.delete('/:id', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const narrativeId = c.req.param('id');
  
  try {
    const narrative = await c.env.DB.prepare(
      `SELECT n.node_id, nd.creator_user_id as node_creator
       FROM narratives n
       JOIN nodes nd ON n.node_id = nd.id
       WHERE n.id = ?`
    ).bind(narrativeId).first<{ node_id: string; node_creator: string }>();
    
    if (!narrative) {
      return c.json({ error: 'Narrative not found' }, 404);
    }
    
    if (narrative.node_creator !== auth.userId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    // Delete narrative (cascades to versions and comments)
    await c.env.DB.prepare(`DELETE FROM narratives WHERE id = ?`).bind(narrativeId).run();
    
    // Update node archive metadata
    await c.env.DB.prepare(
      `UPDATE nodes SET 
        archive_metadata = json_set(
          COALESCE(archive_metadata, '{}'),
          '$.narrativeCount', (SELECT COUNT(*) FROM narratives WHERE node_id = ?)
        ),
        updated_at = ?
       WHERE id = ?`
    ).bind(narrative.node_id, Date.now(), narrative.node_id).run();

    return c.json({ success: true, id: narrativeId });
  } catch (error) {
    console.error('[NARRATIVES] Delete error:', error);
    return c.json({ error: 'Failed to delete narrative' }, 500);
  }
});

export default narrativesRoutes;
