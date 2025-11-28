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
 * POST /api/nodes/:id/publish-chapters - Convert node content to narratives by chapter
 *
 * Prefers working texts (clean markdown) if available, falls back to raw chunks.
 * Users can then read and comment on the published narratives.
 */
nodesRoutes.post('/:id/publish-chapters', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const nodeId = c.req.param('id');

  try {
    // Verify ownership
    const node = await c.env.DB.prepare(
      `SELECT id, name, slug, creator_user_id FROM nodes WHERE id = ? AND status = 'active'`
    ).bind(nodeId).first<{ id: string; name: string; slug: string; creator_user_id: string }>();

    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }

    if (node.creator_user_id !== auth.userId) {
      return c.json({ error: 'Only Node owner can publish chapters' }, 403);
    }

    // Get optional parameters
    const body = await c.req.json().catch(() => ({}));
    const {
      visibility = 'public',
      chaptersToPublish = null,  // null = all chapters, or array of chapter numbers
      useWorkingTexts = true     // prefer working texts over raw chunks
    } = body;

    // First, try to get working texts (clean markdown)
    let chapterMap = new Map<number, {
      title: string | null;
      content: string;
      isWorkingText: boolean;
    }>();

    let sourceType = 'chunks';

    if (useWorkingTexts) {
      let workingTextsQuery = `
        SELECT chapter_number, chapter_title, working_content, word_count
        FROM node_working_texts
        WHERE node_id = ? AND status = 'complete'
      `;

      if (chaptersToPublish && Array.isArray(chaptersToPublish) && chaptersToPublish.length > 0) {
        const placeholders = chaptersToPublish.map(() => '?').join(',');
        workingTextsQuery += ` AND chapter_number IN (${placeholders})`;
      }

      workingTextsQuery += ` ORDER BY chapter_number ASC`;

      const wtParams = chaptersToPublish && Array.isArray(chaptersToPublish)
        ? [nodeId, ...chaptersToPublish]
        : [nodeId];

      const { results: workingTexts } = await c.env.DB.prepare(workingTextsQuery)
        .bind(...wtParams)
        .all<{
          chapter_number: number;
          chapter_title: string | null;
          working_content: string;
          word_count: number;
        }>();

      if (workingTexts && workingTexts.length > 0) {
        sourceType = 'working_texts';
        for (const wt of workingTexts) {
          chapterMap.set(wt.chapter_number, {
            title: wt.chapter_title,
            content: wt.working_content,
            isWorkingText: true
          });
        }
      }
    }

    // Fall back to raw chunks if no working texts
    if (chapterMap.size === 0) {
      let chunksQuery = `
        SELECT
          chapter_number,
          chapter_title,
          content,
          chunk_index,
          char_start
        FROM node_chunks
        WHERE node_id = ? AND pyramid_level = 0
      `;

      if (chaptersToPublish && Array.isArray(chaptersToPublish) && chaptersToPublish.length > 0) {
        const placeholders = chaptersToPublish.map(() => '?').join(',');
        chunksQuery += ` AND chapter_number IN (${placeholders})`;
      }

      chunksQuery += ` ORDER BY chapter_number ASC, chunk_index ASC`;

      const params = chaptersToPublish && Array.isArray(chaptersToPublish)
        ? [nodeId, ...chaptersToPublish]
        : [nodeId];

      const { results: chunks } = await c.env.DB.prepare(chunksQuery)
        .bind(...params)
        .all<{
          chapter_number: number | null;
          chapter_title: string | null;
          content: string;
          chunk_index: number;
          char_start: number;
        }>();

      if (!chunks || chunks.length === 0) {
        return c.json({
          error: 'No content found for this node. Has the pyramid been built?'
        }, 400);
      }

      // Group chunks by chapter and concatenate
      const tempMap = new Map<number, {
        title: string | null;
        chunks: { content: string; index: number }[];
      }>();

      for (const chunk of chunks) {
        const chapterNum = chunk.chapter_number ?? 0;
        if (!tempMap.has(chapterNum)) {
          tempMap.set(chapterNum, { title: chunk.chapter_title, chunks: [] });
        }
        tempMap.get(chapterNum)!.chunks.push({
          content: chunk.content,
          index: chunk.chunk_index
        });
      }

      // Convert to chapterMap with concatenated content
      for (const [chapterNum, data] of tempMap) {
        data.chunks.sort((a, b) => a.index - b.index);
        chapterMap.set(chapterNum, {
          title: data.title,
          content: data.chunks.map(c => c.content).join('\n\n'),
          isWorkingText: false
        });
      }
    }

    // Check for existing chapter narratives to avoid duplicates
    const { results: existingNarratives } = await c.env.DB.prepare(
      `SELECT slug FROM narratives WHERE node_id = ? AND slug LIKE 'chapter-%'`
    ).bind(nodeId).all<{ slug: string }>();

    const existingSlugs = new Set((existingNarratives || []).map(n => n.slug));

    // Create narratives for each chapter
    const now = Date.now();
    const publishedChapters: Array<{
      chapterNumber: number;
      narrativeId: string;
      title: string;
      slug: string;
      wordCount: number;
    }> = [];

    const skippedChapters: number[] = [];

    for (const [chapterNum, chapterData] of chapterMap) {
      const fullContent = chapterData.content;

      // Generate title and slug
      const chapterTitle = chapterData.title || `Chapter ${chapterNum || 'Preface'}`;
      const narrativeTitle = chapterNum === 0
        ? (chapterData.title || 'Preface')
        : chapterTitle;

      let slug = `chapter-${chapterNum || 'preface'}`;

      // Skip if already exists
      if (existingSlugs.has(slug)) {
        skippedChapters.push(chapterNum);
        continue;
      }

      const narrativeId = crypto.randomUUID();
      const versionId = crypto.randomUUID();
      const wordCount = fullContent.split(/\s+/).length;
      const readingTime = Math.ceil(wordCount / 200);

      const metadata = {
        tags: ['chapter', `chapter-${chapterNum}`],
        wordCount,
        readingTime,
        sourceChapter: chapterNum,
        sourceChapterTitle: chapterData.title,
      };

      // Insert narrative
      await c.env.DB.prepare(
        `INSERT INTO narratives (id, node_id, current_version, title, slug, content, metadata, synthesis, visibility, created_at, updated_at)
         VALUES (?, ?, 1, ?, ?, ?, ?, '{"status":"none","pendingComments":0}', ?, ?, ?)`
      ).bind(
        narrativeId,
        nodeId,
        narrativeTitle,
        slug,
        fullContent,
        JSON.stringify(metadata),
        visibility,
        now,
        now
      ).run();

      // Insert version 1
      await c.env.DB.prepare(
        `INSERT INTO narrative_versions (id, narrative_id, version, content, changes, trigger_info, created_at)
         VALUES (?, ?, 1, ?, '{"summary":"Published from chapter chunks"}', '{"type":"chapter-publish","actor":"${auth.userId}"}', ?)`
      ).bind(versionId, narrativeId, fullContent, now).run();

      publishedChapters.push({
        chapterNumber: chapterNum,
        narrativeId,
        title: narrativeTitle,
        slug,
        wordCount,
      });
    }

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

    // Increment unread count for subscribers
    if (publishedChapters.length > 0) {
      await c.env.DB.prepare(
        `UPDATE node_subscriptions
         SET unread_count = unread_count + ?
         WHERE node_id = ?`
      ).bind(publishedChapters.length, nodeId).run();
    }

    return c.json({
      success: true,
      nodeId,
      nodeName: node.name,
      sourceType,  // 'working_texts' or 'chunks'
      published: publishedChapters,
      skipped: skippedChapters,
      summary: {
        totalChapters: chapterMap.size,
        publishedCount: publishedChapters.length,
        skippedCount: skippedChapters.length,
        totalWords: publishedChapters.reduce((sum, ch) => sum + ch.wordCount, 0),
      }
    }, 201);

  } catch (error) {
    console.error('[NODES] Publish chapters error:', error);
    return c.json({ error: 'Failed to publish chapters' }, 500);
  }
});

/**
 * GET /api/nodes/:id/chapters - List chapters for a node (from chunks or narratives)
 */
nodesRoutes.get('/:id/chapters', optionalAuth(), async (c) => {
  const nodeId = c.req.param('id');
  const source = c.req.query('source') || 'narratives'; // 'chunks' or 'narratives'

  try {
    if (source === 'chunks') {
      // Get chapters from raw chunks (even if not published as narratives)
      const { results } = await c.env.DB.prepare(`
        SELECT
          chapter_number,
          chapter_title,
          COUNT(*) as chunk_count,
          SUM(LENGTH(content)) as total_chars,
          MIN(chunk_index) as first_chunk,
          MAX(chunk_index) as last_chunk
        FROM node_chunks
        WHERE node_id = ? AND pyramid_level = 0
        GROUP BY chapter_number, chapter_title
        ORDER BY chapter_number ASC
      `).bind(nodeId).all<{
        chapter_number: number;
        chapter_title: string | null;
        chunk_count: number;
        total_chars: number;
        first_chunk: number;
        last_chunk: number;
      }>();

      return c.json({
        nodeId,
        source: 'chunks',
        chapters: (results || []).map(ch => ({
          chapterNumber: ch.chapter_number,
          title: ch.chapter_title || `Chapter ${ch.chapter_number}`,
          chunkCount: ch.chunk_count,
          estimatedWords: Math.round(ch.total_chars / 5), // rough estimate
          published: false, // from chunks, not yet narratives
        })),
      });
    } else {
      // Get chapters from published narratives
      const { results } = await c.env.DB.prepare(`
        SELECT
          id, title, slug, current_version, metadata,
          visibility, created_at, updated_at
        FROM narratives
        WHERE node_id = ? AND slug LIKE 'chapter-%'
        ORDER BY
          CASE
            WHEN slug = 'chapter-preface' THEN 0
            ELSE CAST(REPLACE(slug, 'chapter-', '') AS INTEGER)
          END ASC
      `).bind(nodeId).all<{
        id: string;
        title: string;
        slug: string;
        current_version: number;
        metadata: string;
        visibility: string;
        created_at: number;
        updated_at: number;
      }>();

      return c.json({
        nodeId,
        source: 'narratives',
        chapters: (results || []).map(n => {
          const meta = JSON.parse(n.metadata || '{}');
          return {
            narrativeId: n.id,
            title: n.title,
            slug: n.slug,
            currentVersion: n.current_version,
            wordCount: meta.wordCount || 0,
            readingTime: meta.readingTime || 0,
            chapterNumber: meta.sourceChapter,
            visibility: n.visibility,
            createdAt: n.created_at,
            updatedAt: n.updated_at,
          };
        }),
      });
    }
  } catch (error) {
    console.error('[NODES] Get chapters error:', error);
    return c.json({ error: 'Failed to get chapters' }, 500);
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
