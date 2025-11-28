/**
 * Curator Pyramid Service
 *
 * Manages the hierarchical chunk pyramid for literary nodes.
 * Provides CRUD operations and helpers for:
 * - L0 chunks (quotable source text)
 * - L1-N summaries (progressive condensation)
 * - Apex (curator's consciousness)
 * - Discourse artifacts (inter-curator conversations)
 * - Curator synthesis (accumulated wisdom)
 */

// ==========================================
// Types
// ==========================================

export interface NodeChunk {
  id: string;
  nodeId: string;
  sourceType: 'gutenberg' | 'user_upload' | 'url_import';
  sourceId?: string;
  pyramidLevel: number;
  chunkIndex: number;
  parentSummaryId?: string;
  content: string;
  tokenCount: number;
  charStart: number;
  charEnd: number;
  chapterNumber?: number;
  chapterTitle?: string;
  partNumber?: number;
  structuralPosition: 'opening' | 'early' | 'middle' | 'late' | 'closing';
  chunkType: 'narration' | 'dialogue' | 'exposition' | 'description' | 'action' | 'interior' | 'mixed';
  containsDialogue: boolean;
  dialogueSpeakers?: string[];
  embeddingId?: string;
  embeddedAt?: number;
  createdAt: number;
}

export interface NodeSummary {
  id: string;
  nodeId: string;
  pyramidLevel: number;
  summaryIndex: number;
  parentSummaryId?: string;
  content: string;
  tokenCount: number;
  childIds: string[];
  childType: 'chunk' | 'summary';
  chapterStart?: number;
  chapterEnd?: number;
  preservedElements: {
    events?: string[];
    characters?: string[];
    themes?: string[];
    tone?: string;
  };
  embeddingId?: string;
  embeddedAt?: number;
  createdAt: number;
}

export interface NodeApex {
  id: string;
  nodeId: string;
  narrativeArc: string;
  coreThemes: string[];
  characterEssences?: Record<string, string>;
  voiceCharacteristics?: {
    style?: string;
    tone?: string;
    diction?: string;
  };
  theQuestion: string;
  resonanceHooks: string[];
  lifecycleState: 'dormant' | 'awakened' | 'active' | 'mature' | 'canonical';
  totalChunks: number;
  totalSummaries: number;
  pyramidDepth: number;
  sourceTitle?: string;
  sourceAuthor?: string;
  sourceYear?: number;
  sourceGutenbergId?: string;
  embeddingId?: string;
  embeddedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface DiscourseArtifact {
  id: string;
  conversationId: string;
  visitorNodeId: string;
  hostNodeId: string;
  discourseType: 'visitation' | 'debate' | 'synthesis' | 'discovery';
  discourseRole: 'visitor_opening' | 'host_response' | 'visitor_synthesis' | 'host_synthesis' | 'joint_discovery';
  content: string;
  referenceType?: 'thematic' | 'contrast' | 'influence' | 'dialogue' | 'expansion';
  referenceStrength?: number;
  discoveryHook?: string;
  sequenceNumber: number;
  embeddingId?: string;
  createdAt: number;
}

export interface CuratorSynthesis {
  id: string;
  nodeId: string;
  synthesisType: 'user_interaction' | 'inter_curator' | 'editorial' | 'discovery';
  theme: string;
  content: string;
  sourceInteractionIds: string[];
  sourceDiscourseIds: string[];
  version: number;
  status: 'draft' | 'integrated' | 'superseded';
  supersededBy?: string;
  embeddingId?: string;
  createdAt: number;
  integratedAt?: number;
}

// ==========================================
// Chunk Operations
// ==========================================

export async function createChunk(
  db: D1Database,
  chunk: Omit<NodeChunk, 'id' | 'createdAt'>
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();

  await db.prepare(`
    INSERT INTO node_chunks (
      id, node_id, source_type, source_id, pyramid_level, chunk_index,
      parent_summary_id, content, token_count, char_start, char_end,
      chapter_number, chapter_title, part_number, structural_position,
      chunk_type, contains_dialogue, dialogue_speakers,
      embedding_id, embedded_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    chunk.nodeId,
    chunk.sourceType,
    chunk.sourceId || null,
    chunk.pyramidLevel,
    chunk.chunkIndex,
    chunk.parentSummaryId || null,
    chunk.content,
    chunk.tokenCount,
    chunk.charStart,
    chunk.charEnd,
    chunk.chapterNumber || null,
    chunk.chapterTitle || null,
    chunk.partNumber || null,
    chunk.structuralPosition,
    chunk.chunkType,
    chunk.containsDialogue ? 1 : 0,
    chunk.dialogueSpeakers ? JSON.stringify(chunk.dialogueSpeakers) : null,
    chunk.embeddingId || null,
    chunk.embeddedAt || null,
    now
  ).run();

  return id;
}

export async function createChunksBatch(
  db: D1Database,
  chunks: Array<Omit<NodeChunk, 'id' | 'createdAt'>>
): Promise<string[]> {
  const ids: string[] = [];
  const now = Date.now();

  // D1 supports batch operations
  const statements = chunks.map(chunk => {
    const id = crypto.randomUUID();
    ids.push(id);

    return db.prepare(`
      INSERT INTO node_chunks (
        id, node_id, source_type, source_id, pyramid_level, chunk_index,
        parent_summary_id, content, token_count, char_start, char_end,
        chapter_number, chapter_title, part_number, structural_position,
        chunk_type, contains_dialogue, dialogue_speakers, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      chunk.nodeId,
      chunk.sourceType,
      chunk.sourceId || null,
      chunk.pyramidLevel,
      chunk.chunkIndex,
      chunk.parentSummaryId || null,
      chunk.content,
      chunk.tokenCount,
      chunk.charStart,
      chunk.charEnd,
      chunk.chapterNumber || null,
      chunk.chapterTitle || null,
      chunk.partNumber || null,
      chunk.structuralPosition,
      chunk.chunkType,
      chunk.containsDialogue ? 1 : 0,
      chunk.dialogueSpeakers ? JSON.stringify(chunk.dialogueSpeakers) : null,
      now
    );
  });

  await db.batch(statements);
  return ids;
}

export async function getChunksByNode(
  db: D1Database,
  nodeId: string,
  options?: {
    chapter?: number;
    chunkType?: string;
    limit?: number;
    offset?: number;
  }
): Promise<NodeChunk[]> {
  let query = `SELECT * FROM node_chunks WHERE node_id = ?`;
  const bindings: (string | number)[] = [nodeId];

  if (options?.chapter) {
    query += ` AND chapter_number = ?`;
    bindings.push(options.chapter);
  }

  if (options?.chunkType) {
    query += ` AND chunk_type = ?`;
    bindings.push(options.chunkType);
  }

  query += ` ORDER BY chunk_index ASC`;

  if (options?.limit) {
    query += ` LIMIT ?`;
    bindings.push(options.limit);
    if (options?.offset) {
      query += ` OFFSET ?`;
      bindings.push(options.offset);
    }
  }

  const { results } = await db.prepare(query).bind(...bindings).all();
  return (results || []).map(rowToChunk);
}

export async function getChunkById(
  db: D1Database,
  chunkId: string
): Promise<NodeChunk | null> {
  const result = await db.prepare(
    `SELECT * FROM node_chunks WHERE id = ?`
  ).bind(chunkId).first();

  return result ? rowToChunk(result) : null;
}

export async function updateChunkEmbedding(
  db: D1Database,
  chunkId: string,
  embeddingId: string
): Promise<void> {
  await db.prepare(`
    UPDATE node_chunks
    SET embedding_id = ?, embedded_at = ?
    WHERE id = ?
  `).bind(embeddingId, Date.now(), chunkId).run();
}

// ==========================================
// Summary Operations
// ==========================================

export async function createSummary(
  db: D1Database,
  summary: Omit<NodeSummary, 'id' | 'createdAt'>
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();

  await db.prepare(`
    INSERT INTO node_summaries (
      id, node_id, pyramid_level, summary_index, parent_summary_id,
      content, token_count, child_ids, child_type,
      chapter_start, chapter_end, preserved_elements, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    summary.nodeId,
    summary.pyramidLevel,
    summary.summaryIndex,
    summary.parentSummaryId || null,
    summary.content,
    summary.tokenCount,
    JSON.stringify(summary.childIds),
    summary.childType,
    summary.chapterStart || null,
    summary.chapterEnd || null,
    JSON.stringify(summary.preservedElements),
    now
  ).run();

  return id;
}

export async function getSummariesByLevel(
  db: D1Database,
  nodeId: string,
  level: number
): Promise<NodeSummary[]> {
  const { results } = await db.prepare(`
    SELECT * FROM node_summaries
    WHERE node_id = ? AND pyramid_level = ?
    ORDER BY summary_index ASC
  `).bind(nodeId, level).all();

  return (results || []).map(rowToSummary);
}

export async function getSummaryById(
  db: D1Database,
  summaryId: string
): Promise<NodeSummary | null> {
  const result = await db.prepare(
    `SELECT * FROM node_summaries WHERE id = ?`
  ).bind(summaryId).first();

  return result ? rowToSummary(result) : null;
}

// ==========================================
// Apex Operations
// ==========================================

export async function createOrUpdateApex(
  db: D1Database,
  apex: Omit<NodeApex, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Date.now();

  // Check if apex exists
  const existing = await db.prepare(
    `SELECT id FROM node_apexes WHERE node_id = ?`
  ).bind(apex.nodeId).first<{ id: string }>();

  if (existing) {
    // Update
    await db.prepare(`
      UPDATE node_apexes SET
        narrative_arc = ?,
        core_themes = ?,
        character_essences = ?,
        voice_characteristics = ?,
        the_question = ?,
        resonance_hooks = ?,
        lifecycle_state = ?,
        total_chunks = ?,
        total_summaries = ?,
        pyramid_depth = ?,
        source_title = ?,
        source_author = ?,
        source_year = ?,
        source_gutenberg_id = ?,
        embedding_id = ?,
        embedded_at = ?,
        updated_at = ?
      WHERE node_id = ?
    `).bind(
      apex.narrativeArc,
      JSON.stringify(apex.coreThemes),
      apex.characterEssences ? JSON.stringify(apex.characterEssences) : null,
      apex.voiceCharacteristics ? JSON.stringify(apex.voiceCharacteristics) : null,
      apex.theQuestion,
      JSON.stringify(apex.resonanceHooks),
      apex.lifecycleState,
      apex.totalChunks,
      apex.totalSummaries,
      apex.pyramidDepth,
      apex.sourceTitle || null,
      apex.sourceAuthor || null,
      apex.sourceYear || null,
      apex.sourceGutenbergId || null,
      apex.embeddingId || null,
      apex.embeddedAt || null,
      now,
      apex.nodeId
    ).run();

    return existing.id;
  } else {
    // Create
    const id = crypto.randomUUID();

    await db.prepare(`
      INSERT INTO node_apexes (
        id, node_id, narrative_arc, core_themes, character_essences,
        voice_characteristics, the_question, resonance_hooks,
        lifecycle_state, total_chunks, total_summaries, pyramid_depth,
        source_title, source_author, source_year, source_gutenberg_id,
        embedding_id, embedded_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      apex.nodeId,
      apex.narrativeArc,
      JSON.stringify(apex.coreThemes),
      apex.characterEssences ? JSON.stringify(apex.characterEssences) : null,
      apex.voiceCharacteristics ? JSON.stringify(apex.voiceCharacteristics) : null,
      apex.theQuestion,
      JSON.stringify(apex.resonanceHooks),
      apex.lifecycleState,
      apex.totalChunks,
      apex.totalSummaries,
      apex.pyramidDepth,
      apex.sourceTitle || null,
      apex.sourceAuthor || null,
      apex.sourceYear || null,
      apex.sourceGutenbergId || null,
      apex.embeddingId || null,
      apex.embeddedAt || null,
      now,
      now
    ).run();

    return id;
  }
}

export async function getApexByNode(
  db: D1Database,
  nodeId: string
): Promise<NodeApex | null> {
  const result = await db.prepare(
    `SELECT * FROM node_apexes WHERE node_id = ?`
  ).bind(nodeId).first();

  return result ? rowToApex(result) : null;
}

export async function updateApexLifecycle(
  db: D1Database,
  nodeId: string,
  state: NodeApex['lifecycleState']
): Promise<void> {
  await db.prepare(`
    UPDATE node_apexes
    SET lifecycle_state = ?, updated_at = ?
    WHERE node_id = ?
  `).bind(state, Date.now(), nodeId).run();
}

// ==========================================
// Discourse Operations
// ==========================================

export async function createDiscourseArtifact(
  db: D1Database,
  artifact: Omit<DiscourseArtifact, 'id' | 'createdAt'>
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();

  await db.prepare(`
    INSERT INTO discourse_artifacts (
      id, conversation_id, visitor_node_id, host_node_id,
      discourse_type, discourse_role, content,
      reference_type, reference_strength, discovery_hook,
      sequence_number, embedding_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    artifact.conversationId,
    artifact.visitorNodeId,
    artifact.hostNodeId,
    artifact.discourseType,
    artifact.discourseRole,
    artifact.content,
    artifact.referenceType || null,
    artifact.referenceStrength || null,
    artifact.discoveryHook || null,
    artifact.sequenceNumber,
    artifact.embeddingId || null,
    now
  ).run();

  return id;
}

export async function getDiscourseConversation(
  db: D1Database,
  conversationId: string
): Promise<DiscourseArtifact[]> {
  const { results } = await db.prepare(`
    SELECT * FROM discourse_artifacts
    WHERE conversation_id = ?
    ORDER BY sequence_number ASC
  `).bind(conversationId).all();

  return (results || []).map(rowToDiscourseArtifact);
}

export async function getDiscourseByNode(
  db: D1Database,
  nodeId: string,
  role: 'visitor' | 'host' | 'both' = 'both'
): Promise<DiscourseArtifact[]> {
  let query: string;
  let bindings: string[];

  if (role === 'visitor') {
    query = `SELECT * FROM discourse_artifacts WHERE visitor_node_id = ? ORDER BY created_at DESC`;
    bindings = [nodeId];
  } else if (role === 'host') {
    query = `SELECT * FROM discourse_artifacts WHERE host_node_id = ? ORDER BY created_at DESC`;
    bindings = [nodeId];
  } else {
    query = `SELECT * FROM discourse_artifacts WHERE visitor_node_id = ? OR host_node_id = ? ORDER BY created_at DESC`;
    bindings = [nodeId, nodeId];
  }

  const { results } = await db.prepare(query).bind(...bindings).all();
  return (results || []).map(rowToDiscourseArtifact);
}

// ==========================================
// Synthesis Operations
// ==========================================

export async function createSynthesis(
  db: D1Database,
  synthesis: Omit<CuratorSynthesis, 'id' | 'createdAt'>
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();

  await db.prepare(`
    INSERT INTO curator_synthesis (
      id, node_id, synthesis_type, theme, content,
      source_interaction_ids, source_discourse_ids,
      version, status, superseded_by, embedding_id,
      created_at, integrated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    synthesis.nodeId,
    synthesis.synthesisType,
    synthesis.theme,
    synthesis.content,
    JSON.stringify(synthesis.sourceInteractionIds),
    JSON.stringify(synthesis.sourceDiscourseIds),
    synthesis.version,
    synthesis.status,
    synthesis.supersededBy || null,
    synthesis.embeddingId || null,
    now,
    synthesis.integratedAt || null
  ).run();

  return id;
}

export async function getSynthesisByNode(
  db: D1Database,
  nodeId: string,
  options?: { status?: CuratorSynthesis['status']; theme?: string }
): Promise<CuratorSynthesis[]> {
  let query = `SELECT * FROM curator_synthesis WHERE node_id = ?`;
  const bindings: string[] = [nodeId];

  if (options?.status) {
    query += ` AND status = ?`;
    bindings.push(options.status);
  }

  if (options?.theme) {
    query += ` AND theme = ?`;
    bindings.push(options.theme);
  }

  query += ` ORDER BY created_at DESC`;

  const { results } = await db.prepare(query).bind(...bindings).all();
  return (results || []).map(rowToSynthesis);
}

export async function integrateSynthesis(
  db: D1Database,
  synthesisId: string
): Promise<void> {
  await db.prepare(`
    UPDATE curator_synthesis
    SET status = 'integrated', integrated_at = ?
    WHERE id = ?
  `).bind(Date.now(), synthesisId).run();
}

// ==========================================
// Pyramid Stats
// ==========================================

export async function getPyramidStats(
  db: D1Database,
  nodeId: string
): Promise<{
  chunkCount: number;
  summaryCount: number;
  levelCounts: Record<number, number>;
  hasApex: boolean;
}> {
  const [chunkResult, summaryResult, levelResult, apexResult] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as count FROM node_chunks WHERE node_id = ?`).bind(nodeId).first<{ count: number }>(),
    db.prepare(`SELECT COUNT(*) as count FROM node_summaries WHERE node_id = ?`).bind(nodeId).first<{ count: number }>(),
    db.prepare(`SELECT pyramid_level, COUNT(*) as count FROM node_summaries WHERE node_id = ? GROUP BY pyramid_level`).bind(nodeId).all(),
    db.prepare(`SELECT id FROM node_apexes WHERE node_id = ?`).bind(nodeId).first(),
  ]);

  const levelCounts: Record<number, number> = { 0: chunkResult?.count || 0 };
  for (const row of levelResult.results || []) {
    levelCounts[(row as any).pyramid_level] = (row as any).count;
  }

  return {
    chunkCount: chunkResult?.count || 0,
    summaryCount: summaryResult?.count || 0,
    levelCounts,
    hasApex: !!apexResult,
  };
}

// ==========================================
// Row Converters
// ==========================================

function rowToChunk(row: Record<string, unknown>): NodeChunk {
  return {
    id: row.id as string,
    nodeId: row.node_id as string,
    sourceType: row.source_type as NodeChunk['sourceType'],
    sourceId: row.source_id as string | undefined,
    pyramidLevel: row.pyramid_level as number,
    chunkIndex: row.chunk_index as number,
    parentSummaryId: row.parent_summary_id as string | undefined,
    content: row.content as string,
    tokenCount: row.token_count as number,
    charStart: row.char_start as number,
    charEnd: row.char_end as number,
    chapterNumber: row.chapter_number as number | undefined,
    chapterTitle: row.chapter_title as string | undefined,
    partNumber: row.part_number as number | undefined,
    structuralPosition: row.structural_position as NodeChunk['structuralPosition'],
    chunkType: row.chunk_type as NodeChunk['chunkType'],
    containsDialogue: !!row.contains_dialogue,
    dialogueSpeakers: row.dialogue_speakers ? JSON.parse(row.dialogue_speakers as string) : undefined,
    embeddingId: row.embedding_id as string | undefined,
    embeddedAt: row.embedded_at as number | undefined,
    createdAt: row.created_at as number,
  };
}

function rowToSummary(row: Record<string, unknown>): NodeSummary {
  return {
    id: row.id as string,
    nodeId: row.node_id as string,
    pyramidLevel: row.pyramid_level as number,
    summaryIndex: row.summary_index as number,
    parentSummaryId: row.parent_summary_id as string | undefined,
    content: row.content as string,
    tokenCount: row.token_count as number,
    childIds: JSON.parse(row.child_ids as string),
    childType: row.child_type as NodeSummary['childType'],
    chapterStart: row.chapter_start as number | undefined,
    chapterEnd: row.chapter_end as number | undefined,
    preservedElements: JSON.parse(row.preserved_elements as string || '{}'),
    embeddingId: row.embedding_id as string | undefined,
    embeddedAt: row.embedded_at as number | undefined,
    createdAt: row.created_at as number,
  };
}

function rowToApex(row: Record<string, unknown>): NodeApex {
  return {
    id: row.id as string,
    nodeId: row.node_id as string,
    narrativeArc: row.narrative_arc as string,
    coreThemes: JSON.parse(row.core_themes as string),
    characterEssences: row.character_essences ? JSON.parse(row.character_essences as string) : undefined,
    voiceCharacteristics: row.voice_characteristics ? JSON.parse(row.voice_characteristics as string) : undefined,
    theQuestion: row.the_question as string,
    resonanceHooks: JSON.parse(row.resonance_hooks as string || '[]'),
    lifecycleState: row.lifecycle_state as NodeApex['lifecycleState'],
    totalChunks: row.total_chunks as number,
    totalSummaries: row.total_summaries as number,
    pyramidDepth: row.pyramid_depth as number,
    sourceTitle: row.source_title as string | undefined,
    sourceAuthor: row.source_author as string | undefined,
    sourceYear: row.source_year as number | undefined,
    sourceGutenbergId: row.source_gutenberg_id as string | undefined,
    embeddingId: row.embedding_id as string | undefined,
    embeddedAt: row.embedded_at as number | undefined,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

function rowToDiscourseArtifact(row: Record<string, unknown>): DiscourseArtifact {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    visitorNodeId: row.visitor_node_id as string,
    hostNodeId: row.host_node_id as string,
    discourseType: row.discourse_type as DiscourseArtifact['discourseType'],
    discourseRole: row.discourse_role as DiscourseArtifact['discourseRole'],
    content: row.content as string,
    referenceType: row.reference_type as DiscourseArtifact['referenceType'] | undefined,
    referenceStrength: row.reference_strength as number | undefined,
    discoveryHook: row.discovery_hook as string | undefined,
    sequenceNumber: row.sequence_number as number,
    embeddingId: row.embedding_id as string | undefined,
    createdAt: row.created_at as number,
  };
}

function rowToSynthesis(row: Record<string, unknown>): CuratorSynthesis {
  return {
    id: row.id as string,
    nodeId: row.node_id as string,
    synthesisType: row.synthesis_type as CuratorSynthesis['synthesisType'],
    theme: row.theme as string,
    content: row.content as string,
    sourceInteractionIds: JSON.parse(row.source_interaction_ids as string || '[]'),
    sourceDiscourseIds: JSON.parse(row.source_discourse_ids as string || '[]'),
    version: row.version as number,
    status: row.status as CuratorSynthesis['status'],
    supersededBy: row.superseded_by as string | undefined,
    embeddingId: row.embedding_id as string | undefined,
    createdAt: row.created_at as number,
    integratedAt: row.integrated_at as number | undefined,
  };
}
