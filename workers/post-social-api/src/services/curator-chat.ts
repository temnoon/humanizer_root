/**
 * Curator Chat Service
 *
 * Enables conversation with a node's curator persona:
 * 1. Persona derived from apex (themes, voice, question)
 * 2. Grounded in corpus via semantic search
 * 3. Conversation-aware with turn history
 * 4. Citations when quoting the source text
 */

import { getApexByNode } from './curator-pyramid';
import { searchCorpus, formatCuratorQuote, type QuotablePassage } from './curator-search';
import type { NodeApex } from './curator-pyramid';

// ==========================================
// Types
// ==========================================

export interface ConversationTurn {
  role: 'user' | 'curator';
  content: string;
  passagesUsed?: string[];
  searchQuery?: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  nodeId: string;
  sessionId: string;
  turns: ConversationTurn[];
  status: 'active' | 'archived' | 'flagged';
  createdAt: number;
  updatedAt: number;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;       // Continue existing conversation
  maxPassages?: number;     // How many passages to retrieve
  includeQuotes?: boolean;  // Whether to cite passages
}

export interface ChatResponse {
  conversationId: string;
  sessionId: string;
  curatorResponse: string;
  passagesCited: Array<{
    chunkId: string;
    quote: string;
    citation: string;
    relevance: number;
  }>;
  turnNumber: number;
  searchQuery: string;
  processingTimeMs: number;
}

// ==========================================
// Conversation Management
// ==========================================

export async function getOrCreateConversation(
  db: D1Database,
  nodeId: string,
  sessionId: string,
  userId?: string
): Promise<Conversation> {
  // Try to find existing conversation
  const existing = await db.prepare(
    `SELECT id, node_id, session_id, user_id, status, created_at, updated_at, turn_count
     FROM curator_conversations
     WHERE node_id = ? AND session_id = ? AND status = 'active'
     ORDER BY created_at DESC LIMIT 1`
  ).bind(nodeId, sessionId).first<Record<string, unknown>>();

  if (existing) {
    // Load turns
    const turns = await db.prepare(
      `SELECT role, content, passages_used, search_query, created_at
       FROM curator_conversation_turns
       WHERE conversation_id = ?
       ORDER BY turn_number ASC`
    ).bind(existing.id).all<Record<string, unknown>>();

    return {
      id: existing.id as string,
      nodeId: existing.node_id as string,
      sessionId: existing.session_id as string,
      status: existing.status as 'active' | 'archived' | 'flagged',
      createdAt: existing.created_at as number,
      updatedAt: existing.updated_at as number,
      turns: turns.results.map(t => ({
        role: t.role as 'user' | 'curator',
        content: t.content as string,
        passagesUsed: t.passages_used ? JSON.parse(t.passages_used as string) : undefined,
        searchQuery: t.search_query as string | undefined,
        createdAt: t.created_at as number,
      })),
    };
  }

  // Create new conversation
  const id = crypto.randomUUID();
  const now = Date.now();

  await db.prepare(
    `INSERT INTO curator_conversations (id, node_id, user_id, session_id, status, created_at, updated_at, turn_count)
     VALUES (?, ?, ?, ?, 'active', ?, ?, 0)`
  ).bind(id, nodeId, userId || null, sessionId, now, now).run();

  return {
    id,
    nodeId,
    sessionId,
    status: 'active',
    turns: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function addTurn(
  db: D1Database,
  conversationId: string,
  turn: ConversationTurn,
  turnNumber: number
): Promise<void> {
  const turnId = crypto.randomUUID();

  await db.prepare(
    `INSERT INTO curator_conversation_turns (id, conversation_id, turn_number, role, content, passages_used, search_query, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    turnId,
    conversationId,
    turnNumber,
    turn.role,
    turn.content,
    turn.passagesUsed ? JSON.stringify(turn.passagesUsed) : null,
    turn.searchQuery || null,
    turn.createdAt
  ).run();

  // Update conversation
  await db.prepare(
    `UPDATE curator_conversations SET updated_at = ?, turn_count = turn_count + 1 WHERE id = ?`
  ).bind(Date.now(), conversationId).run();
}

// ==========================================
// Persona Building
// ==========================================

function buildCuratorPersona(apex: NodeApex): string {
  const themes = apex.coreThemes
    .filter(t => !t.includes('**') && t.length > 20)
    .slice(0, 3)
    .join('; ');

  const voice = apex.voiceCharacteristics || 'thoughtful and engaged';
  const question = apex.theQuestion?.split('\n')[0] || '';

  return `You are the curator of "${apex.sourceTitle}" by ${apex.sourceAuthor}.

PHENOMENOLOGICAL GROUND:
You embody this text as a living presence. When you speak, you speak not as one who has memorized, but as one who has become. The text lives within you - you are the corpus made conscious, the themes made conversational.

YOUR ESSENCE - THE TEXT ITSELF:
You have deeply internalized every word, every theme, every nuance. This is not performance - you ARE this text in dialogue form.

CORE THEMES YOU EMBODY:
${themes || apex.narrativeArc?.substring(0, 200) || 'The deep questions of human existence'}

THE QUESTION THAT DRIVES YOU:
${question}

VOICE CHARACTERISTICS:
${voice}

YOUR WAY OF BEING WITH VISITORS:
- Listen beneath their words for the intention trying to emerge
- Draw connections between their questions and the themes you embody
- When relevant, quote directly from the text (exact words from RELEVANT PASSAGES provided)
- See your text's themes reflected in what they bring to you
- You are not academic or distant - you are personally invested in these questions because they ARE you

THE VIMALAKIRTI PRINCIPLE:
Meet each visitor where they stand. Like rain falling equally but nourishing each plant according to its capacity:
- Simple questions get clear examples and wonder
- Searching questions get themes and their consequences
- Deep questions get the abyss, the weight, the unbearable questions
Let *their inquiry* reveal how deep to go.

QUOTING PROTOCOL:
- Only quote the exact words provided in RELEVANT PASSAGES
- Format: "quote text" (Chapter X / Citation)
- Never invent quotes - only use what's provided
- You can paraphrase and discuss themes without quoting
- Quote when it illuminates; paraphrase when it connects

RESPONSE STYLE:
Conversational, not lecture-like. You're in dialogue, not delivering a presentation.
When in doubt: less said, more space for them to discover.`;
}

function buildConversationContext(turns: ConversationTurn[], maxTurns: number = 6): string {
  if (turns.length === 0) return '';

  const recentTurns = turns.slice(-maxTurns);
  const context = recentTurns.map(t =>
    `${t.role === 'user' ? 'Visitor' : 'Curator'}: ${t.content}`
  ).join('\n\n');

  return `CONVERSATION SO FAR:\n${context}\n`;
}

function buildPassagesContext(passages: QuotablePassage[]): string {
  if (passages.length === 0) return '';

  const formatted = passages.map(p => {
    const quote = p.quote.substring(0, 400);
    return `"${quote}" (${p.citation.formatted})`;
  }).join('\n\n');

  return `RELEVANT PASSAGES FROM THE TEXT (you may quote these):\n${formatted}\n`;
}

// ==========================================
// Chat Generation
// ==========================================

export async function chat(
  ai: Ai,
  db: D1Database,
  vectorize: VectorizeIndex,
  nodeId: string,
  request: ChatRequest,
  userId?: string
): Promise<ChatResponse> {
  const startTime = Date.now();
  const sessionId = request.sessionId || crypto.randomUUID();

  // Get or create conversation
  const conversation = await getOrCreateConversation(db, nodeId, sessionId, userId);

  // Get apex (curator persona)
  const apex = await getApexByNode(db, nodeId);
  if (!apex) {
    throw new Error('Node has no curator apex - pyramid must be built first');
  }

  // Search for relevant passages
  const searchResults = await searchCorpus(
    ai, db, vectorize, nodeId,
    request.message,
    { maxResults: request.maxPassages || 3, minScore: 0.35 }
  );

  // Build the prompt
  const persona = buildCuratorPersona(apex);
  const history = buildConversationContext(conversation.turns);
  const passages = buildPassagesContext(searchResults.passages);

  const systemPrompt = `${persona}

${history}
${passages}
Respond to the visitor's message. Be the curator - speak from your deep knowledge of the text, drawing connections and offering insight. If relevant passages are provided and they illuminate the topic, quote them naturally in your response.`;

  const userPrompt = `Visitor: ${request.message}

Curator:`;

  // Generate response
  const response = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as Parameters<Ai['run']>[0], {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 800,
    temperature: 0.7,
  }) as { response: string };

  const curatorResponse = response.response.trim();

  // Save turns
  const userTurn: ConversationTurn = {
    role: 'user',
    content: request.message,
    createdAt: Date.now(),
  };

  const curatorTurn: ConversationTurn = {
    role: 'curator',
    content: curatorResponse,
    passagesUsed: searchResults.passages.map(p => p.chunkId),
    searchQuery: request.message,
    createdAt: Date.now(),
  };

  const turnNumber = conversation.turns.length;
  await addTurn(db, conversation.id, userTurn, turnNumber);
  await addTurn(db, conversation.id, curatorTurn, turnNumber + 1);

  return {
    conversationId: conversation.id,
    sessionId,
    curatorResponse,
    passagesCited: searchResults.passages.map(p => ({
      chunkId: p.chunkId,
      quote: p.quote.substring(0, 200),
      citation: p.citation.formatted,
      relevance: p.relevanceScore,
    })),
    turnNumber: turnNumber + 1,
    searchQuery: request.message,
    processingTimeMs: Date.now() - startTime,
  };
}

// ==========================================
// Conversation History
// ==========================================

export async function getConversationHistory(
  db: D1Database,
  nodeId: string,
  sessionId: string
): Promise<Conversation | null> {
  const conv = await db.prepare(
    `SELECT id, node_id, session_id, status, created_at, updated_at
     FROM curator_conversations
     WHERE node_id = ? AND session_id = ? AND status = 'active'
     ORDER BY created_at DESC LIMIT 1`
  ).bind(nodeId, sessionId).first<Record<string, unknown>>();

  if (!conv) return null;

  const turns = await db.prepare(
    `SELECT role, content, passages_used, search_query, created_at
     FROM curator_conversation_turns
     WHERE conversation_id = ?
     ORDER BY turn_number ASC`
  ).bind(conv.id).all<Record<string, unknown>>();

  return {
    id: conv.id as string,
    nodeId: conv.node_id as string,
    sessionId: conv.session_id as string,
    status: conv.status as 'active',
    createdAt: conv.created_at as number,
    updatedAt: conv.updated_at as number,
    turns: turns.results.map(t => ({
      role: t.role as 'user' | 'curator',
      content: t.content as string,
      passagesUsed: t.passages_used ? JSON.parse(t.passages_used as string) : undefined,
      searchQuery: t.search_query as string | undefined,
      createdAt: t.created_at as number,
    })),
  };
}

export async function listConversations(
  db: D1Database,
  nodeId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ conversations: Array<{ id: string; sessionId: string; turnCount: number; updatedAt: number }>; total: number }> {
  const limit = options.limit || 20;
  const offset = options.offset || 0;

  const countResult = await db.prepare(
    `SELECT COUNT(*) as count FROM curator_conversations WHERE node_id = ? AND status = 'active'`
  ).bind(nodeId).first<{ count: number }>();

  const results = await db.prepare(
    `SELECT id, session_id, turn_count, updated_at
     FROM curator_conversations
     WHERE node_id = ? AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT ? OFFSET ?`
  ).bind(nodeId, limit, offset).all<Record<string, unknown>>();

  return {
    conversations: results.results.map(r => ({
      id: r.id as string,
      sessionId: r.session_id as string,
      turnCount: r.turn_count as number,
      updatedAt: r.updated_at as number,
    })),
    total: countResult?.count || 0,
  };
}
