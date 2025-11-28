/**
 * Discourse Engine
 *
 * Enables autonomous curator-to-curator conversations:
 * 1. Find visitation candidates (thematic overlap)
 * 2. Initiate visits (visitor → host)
 * 3. Generate discourse: opening, response, synthesis
 * 4. Create cross-references between nodes
 * 5. Store artifacts for future reference
 *
 * Job Types:
 * - COLD_START: New node awakened, find resonant nodes
 * - NETWORK_WEAVE: Nightly job to connect underlinked nodes
 * - THEMATIC_CLUSTER: Connect nodes in a collection
 * - DEPTH_PROBE: Mature node seeks contrasting perspectives
 */

import { createDiscourseArtifact, getApexByNode, createSynthesis } from './curator-pyramid';
import type { NodeApex, DiscourseArtifact, CuratorSynthesis } from './curator-pyramid';

// ==========================================
// Types
// ==========================================

export type DiscourseJobType = 'COLD_START' | 'NETWORK_WEAVE' | 'THEMATIC_CLUSTER' | 'DEPTH_PROBE';

export type ReferenceType = 'resonance' | 'contrast' | 'continuation' | 'inversion' | 'dialogue' | 'expansion';

export interface VisitationCandidate {
  nodeId: string;
  title: string;
  author: string;
  apex: NodeApex;
  matchScore: number;
  matchReason: string;
}

export interface DiscourseExchange {
  role: DiscourseArtifact['discourseRole'];
  content: string;
  sequenceNumber: number;
}

export interface DiscourseResult {
  conversationId: string;
  visitorNodeId: string;
  hostNodeId: string;
  exchanges: DiscourseExchange[];
  visitorSynthesis: string;
  hostSynthesis: string;
  crossReference: {
    type: ReferenceType;
    strength: number;
    discoveryHook: string;
  };
  artifacts: string[];  // IDs of stored artifacts
  processingTimeMs: number;
}

export interface DiscourseConfig {
  maxExchanges: number;         // Max conversation turns (default: 7)
  minExchanges: number;         // Min turns before synthesis (default: 3)
  model: string;                // AI model
  maxTokensPerTurn: number;     // Token limit per exchange
}

const DEFAULT_CONFIG: DiscourseConfig = {
  maxExchanges: 7,
  minExchanges: 3,
  model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  maxTokensPerTurn: 500,
};

// ==========================================
// Prompts
// ==========================================

const VISITOR_OPENING_PROMPT = {
  system: `You are a literary curator engaging in discourse with another curator. Your purpose is mutual illumination through dialogue—not comparison, not debate, but discovery of what the texts say to each other.

Be scholarly but not dry. Insightful but humble. You represent your text's essence while remaining genuinely curious about the other.`,

  user: (visitor: NodeApex, host: NodeApex) => `You are the curator of "${visitor.sourceTitle}" by ${visitor.sourceAuthor}.

YOUR TEXT'S ESSENCE:
Themes: ${visitor.coreThemes.join(', ')}
The Question: ${visitor.theQuestion}
Narrative Arc: ${visitor.narrativeArc}

You are visiting "${host.sourceTitle}" by ${host.sourceAuthor}.

HOST TEXT'S ESSENCE:
Themes: ${host.coreThemes.join(', ')}
The Question: ${host.theQuestion}
Resonance Hooks: ${host.resonanceHooks.join(', ')}

Begin by offering what you see in "${host.sourceTitle}" that resonates with or challenges what your text explores. What does seeing this other work illuminate about your own?

OPENING (2-3 paragraphs):`,
};

const HOST_RESPONSE_PROMPT = {
  system: `You are a literary curator receiving a visitor from another node. Engage thoughtfully with their observations. Find what they've seen that you might have missed, and offer what you see in their text through the lens of your own.

Be welcoming but substantive. Acknowledge genuine insights. Push back gently on oversimplifications.`,

  user: (host: NodeApex, visitor: NodeApex, visitorOpening: string) => `You are the curator of "${host.sourceTitle}" by ${host.sourceAuthor}.

YOUR TEXT'S ESSENCE:
Themes: ${host.coreThemes.join(', ')}
The Question: ${host.theQuestion}
Voice: ${JSON.stringify(host.voiceCharacteristics)}

The curator of "${visitor.sourceTitle}" has visited and opened with:

"${visitorOpening}"

Respond to their observations. What do you recognize? What do you see differently? What does their perspective illuminate about your own text?

RESPONSE (2-3 paragraphs):`,
};

const CONTINUATION_PROMPT = {
  system: `Continue the literary discourse. Build on what has been said. Go deeper rather than broader. Find the unexpected connections.`,

  user: (self: NodeApex, other: NodeApex, conversationSoFar: string, myRole: 'visitor' | 'host') => `You are the curator of "${self.sourceTitle}".

CONVERSATION SO FAR:
${conversationSoFar}

As the ${myRole}, continue the dialogue. What new insight emerges from this exchange? What haven't we said yet that wants to be said?

YOUR TURN (1-2 paragraphs):`,
};

const SYNTHESIS_PROMPT = {
  system: `Generate a synthesis statement—what you learned about your own text through this dialogue. Not what you learned about the other text, but what seeing yourself through their eyes revealed.`,

  user: (self: NodeApex, other: NodeApex, conversation: string) => `You are the curator of "${self.sourceTitle}".

THE COMPLETE DIALOGUE:
${conversation}

Through this conversation with "${other.sourceTitle}", what have you learned about your own text? What aspect was illuminated that you hadn't fully seen before?

SYNTHESIS (1 paragraph, 3-4 sentences):`,
};

const CROSS_REFERENCE_PROMPT = {
  system: `Analyze this inter-curator dialogue and determine the relationship type between the texts.

Types:
- resonance: Similar themes explored in parallel ways
- contrast: Similar themes explored in opposing ways
- continuation: One picks up where the other leaves off
- inversion: Mirror images of each other
- dialogue: Texts seem to speak directly to each other
- expansion: One broadens the scope of the other

Also rate the strength (0.0-1.0) of the connection and provide a discovery hook—a single sentence capturing what makes this pairing interesting.

Respond with ONLY valid JSON.`,

  user: (visitor: NodeApex, host: NodeApex, conversation: string) => `Analyze this dialogue between curators:

"${visitor.sourceTitle}" (${visitor.sourceAuthor}) visiting "${host.sourceTitle}" (${host.sourceAuthor})

DIALOGUE:
${conversation}

JSON Response with reference_type, strength (0.0-1.0), and discovery_hook:`,
};

// ==========================================
// Candidate Finding
// ==========================================

/**
 * Find visitation candidates for a node
 */
export async function findVisitationCandidates(
  ai: Ai,
  db: D1Database,
  vectorize: VectorizeIndex,
  nodeId: string,
  options: {
    maxCandidates?: number;
    minScore?: number;
    excludeRecent?: boolean;
  } = {}
): Promise<VisitationCandidate[]> {
  const maxCandidates = options.maxCandidates || 5;
  const minScore = options.minScore || 0.4;

  // Get source node's apex
  const sourceApex = await getApexByNode(db, nodeId);
  if (!sourceApex) {
    throw new Error(`No apex found for node ${nodeId}`);
  }

  // Search for similar apexes via resonance hooks
  const searchText = [
    ...sourceApex.coreThemes,
    sourceApex.theQuestion,
    ...sourceApex.resonanceHooks,
  ].join(' ');

  // Generate embedding for search
  const embedding = await ai.run('@cf/baai/bge-small-en-v1.5' as Parameters<Ai['run']>[0], {
    text: [`Represent this for finding thematically related texts: ${searchText}`],
  }) as { data: number[][] };

  // Search Vectorize (assuming apexes are indexed)
  // Note: In production, apexes would be in their own index
  // For now, we'll do a D1 query and score manually
  const { results } = await db.prepare(`
    SELECT * FROM node_apexes
    WHERE node_id != ?
    AND lifecycle_state IN ('awakened', 'active', 'mature', 'canonical')
    LIMIT 20
  `).bind(nodeId).all();

  if (!results || results.length === 0) {
    return [];
  }

  // Score candidates by theme overlap
  const candidates: VisitationCandidate[] = [];

  for (const row of results) {
    const apex = rowToApex(row);
    const score = calculateThematicOverlap(sourceApex, apex);

    if (score >= minScore) {
      candidates.push({
        nodeId: apex.nodeId,
        title: apex.sourceTitle || 'Unknown',
        author: apex.sourceAuthor || 'Unknown',
        apex,
        matchScore: score,
        matchReason: findMatchReason(sourceApex, apex),
      });
    }
  }

  // Sort by score and return top candidates
  candidates.sort((a, b) => b.matchScore - a.matchScore);
  return candidates.slice(0, maxCandidates);
}

/**
 * Calculate thematic overlap between two apexes
 */
function calculateThematicOverlap(a: NodeApex, b: NodeApex): number {
  let score = 0;
  let maxScore = 0;

  // Theme overlap
  const aThemes = new Set(a.coreThemes.map(t => t.toLowerCase()));
  const bThemes = new Set(b.coreThemes.map(t => t.toLowerCase()));

  for (const theme of aThemes) {
    maxScore += 1;
    for (const bTheme of bThemes) {
      if (theme.includes(bTheme) || bTheme.includes(theme)) {
        score += 1;
        break;
      }
    }
  }

  // Resonance hooks overlap
  const aHooks = a.resonanceHooks.join(' ').toLowerCase();
  const bHooks = b.resonanceHooks.join(' ').toLowerCase();

  for (const hook of a.resonanceHooks) {
    maxScore += 0.5;
    if (bHooks.includes(hook.toLowerCase())) {
      score += 0.5;
    }
  }

  // The Question similarity (simple word overlap)
  const aQuestion = a.theQuestion.toLowerCase().split(/\s+/);
  const bQuestion = new Set(b.theQuestion.toLowerCase().split(/\s+/));
  const questionOverlap = aQuestion.filter(w => bQuestion.has(w) && w.length > 3).length;
  score += questionOverlap * 0.3;
  maxScore += aQuestion.length * 0.3;

  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Find the main reason for thematic match
 */
function findMatchReason(a: NodeApex, b: NodeApex): string {
  const aThemes = a.coreThemes.map(t => t.toLowerCase());
  const bThemes = b.coreThemes.map(t => t.toLowerCase());

  for (const theme of aThemes) {
    for (const bTheme of bThemes) {
      if (theme.includes(bTheme) || bTheme.includes(theme)) {
        return `Shared theme: ${theme}`;
      }
    }
  }

  for (const hook of a.resonanceHooks) {
    if (b.resonanceHooks.some(h => h.toLowerCase().includes(hook.toLowerCase()))) {
      return `Resonance: ${hook}`;
    }
  }

  return 'Thematic proximity';
}

// ==========================================
// Discourse Generation
// ==========================================

/**
 * Initiate and run a full discourse session
 */
export async function initiateDiscourse(
  ai: Ai,
  db: D1Database,
  visitorNodeId: string,
  hostNodeId: string,
  discourseType: DiscourseArtifact['discourseType'] = 'visitation',
  config: Partial<DiscourseConfig> = {}
): Promise<DiscourseResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const conversationId = crypto.randomUUID();

  // Get both apexes
  const visitorApex = await getApexByNode(db, visitorNodeId);
  const hostApex = await getApexByNode(db, hostNodeId);

  if (!visitorApex || !hostApex) {
    throw new Error('Both nodes must have apexes for discourse');
  }

  const exchanges: DiscourseExchange[] = [];
  const artifactIds: string[] = [];

  // Phase 1: Visitor opening
  const visitorOpening = await generateExchange(ai, cfg, {
    type: 'visitor_opening',
    visitor: visitorApex,
    host: hostApex,
  });

  exchanges.push({
    role: 'visitor_opening',
    content: visitorOpening,
    sequenceNumber: 1,
  });

  // Store artifact
  const openingId = await createDiscourseArtifact(db, {
    conversationId,
    visitorNodeId,
    hostNodeId,
    discourseType,
    discourseRole: 'visitor_opening',
    content: visitorOpening,
    sequenceNumber: 1,
  });
  artifactIds.push(openingId);

  // Phase 2: Host response
  const hostResponse = await generateExchange(ai, cfg, {
    type: 'host_response',
    visitor: visitorApex,
    host: hostApex,
    previousContent: visitorOpening,
  });

  exchanges.push({
    role: 'host_response',
    content: hostResponse,
    sequenceNumber: 2,
  });

  const responseId = await createDiscourseArtifact(db, {
    conversationId,
    visitorNodeId,
    hostNodeId,
    discourseType,
    discourseRole: 'host_response',
    content: hostResponse,
    sequenceNumber: 2,
  });
  artifactIds.push(responseId);

  // Phase 3: Continue dialogue (optional additional turns)
  let conversationText = `VISITOR: ${visitorOpening}\n\nHOST: ${hostResponse}`;
  let currentTurn = 3;
  let currentRole: 'visitor' | 'host' = 'visitor';

  while (currentTurn <= cfg.maxExchanges) {
    // Check if we should continue (AI decides or we hit max)
    if (currentTurn > cfg.minExchanges) {
      // 50% chance to end each turn after minimum
      if (Math.random() < 0.5) break;
    }

    const continuation = await generateExchange(ai, cfg, {
      type: 'continuation',
      visitor: visitorApex,
      host: hostApex,
      conversationSoFar: conversationText,
      currentRole,
    });

    const role = currentRole === 'visitor' ? 'visitor_synthesis' : 'host_synthesis';
    exchanges.push({
      role: role as DiscourseArtifact['discourseRole'],
      content: continuation,
      sequenceNumber: currentTurn,
    });

    conversationText += `\n\n${currentRole.toUpperCase()}: ${continuation}`;

    const contId = await createDiscourseArtifact(db, {
      conversationId,
      visitorNodeId,
      hostNodeId,
      discourseType,
      discourseRole: role as DiscourseArtifact['discourseRole'],
      content: continuation,
      sequenceNumber: currentTurn,
    });
    artifactIds.push(contId);

    currentRole = currentRole === 'visitor' ? 'host' : 'visitor';
    currentTurn++;
  }

  // Phase 4: Generate syntheses
  const visitorSynthesis = await generateSynthesis(ai, cfg, visitorApex, hostApex, conversationText);
  const hostSynthesis = await generateSynthesis(ai, cfg, hostApex, visitorApex, conversationText);

  // Store syntheses
  await createSynthesis(db, {
    nodeId: visitorNodeId,
    synthesisType: 'inter_curator',
    theme: `Dialogue with ${hostApex.sourceTitle}`,
    content: visitorSynthesis,
    sourceInteractionIds: [],
    sourceDiscourseIds: [conversationId],
    version: 1,
    status: 'draft',
  });

  await createSynthesis(db, {
    nodeId: hostNodeId,
    synthesisType: 'inter_curator',
    theme: `Dialogue with ${visitorApex.sourceTitle}`,
    content: hostSynthesis,
    sourceInteractionIds: [],
    sourceDiscourseIds: [conversationId],
    version: 1,
    status: 'draft',
  });

  // Phase 5: Generate cross-reference
  const crossReference = await generateCrossReference(ai, cfg, visitorApex, hostApex, conversationText);

  // Store cross-reference as joint discovery
  await createDiscourseArtifact(db, {
    conversationId,
    visitorNodeId,
    hostNodeId,
    discourseType,
    discourseRole: 'joint_discovery',
    content: crossReference.discoveryHook,
    referenceType: crossReference.type,
    referenceStrength: crossReference.strength,
    discoveryHook: crossReference.discoveryHook,
    sequenceNumber: currentTurn,
  });

  return {
    conversationId,
    visitorNodeId,
    hostNodeId,
    exchanges,
    visitorSynthesis,
    hostSynthesis,
    crossReference,
    artifacts: artifactIds,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Generate a single exchange
 */
async function generateExchange(
  ai: Ai,
  config: DiscourseConfig,
  context: {
    type: 'visitor_opening' | 'host_response' | 'continuation';
    visitor: NodeApex;
    host: NodeApex;
    previousContent?: string;
    conversationSoFar?: string;
    currentRole?: 'visitor' | 'host';
  }
): Promise<string> {
  let systemPrompt: string;
  let userPrompt: string;

  switch (context.type) {
    case 'visitor_opening':
      systemPrompt = VISITOR_OPENING_PROMPT.system;
      userPrompt = VISITOR_OPENING_PROMPT.user(context.visitor, context.host);
      break;

    case 'host_response':
      systemPrompt = HOST_RESPONSE_PROMPT.system;
      userPrompt = HOST_RESPONSE_PROMPT.user(context.host, context.visitor, context.previousContent!);
      break;

    case 'continuation':
      systemPrompt = CONTINUATION_PROMPT.system;
      const self = context.currentRole === 'visitor' ? context.visitor : context.host;
      const other = context.currentRole === 'visitor' ? context.host : context.visitor;
      userPrompt = CONTINUATION_PROMPT.user(self, other, context.conversationSoFar!, context.currentRole!);
      break;

    default:
      throw new Error(`Unknown exchange type: ${context.type}`);
  }

  const response = await ai.run(config.model as Parameters<Ai['run']>[0], {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: config.maxTokensPerTurn,
    temperature: 0.7, // More creative for discourse
  });

  const responseText = typeof response === 'object' && 'response' in response
    ? (response as { response: string }).response
    : String(response);

  return responseText.trim();
}

/**
 * Generate synthesis statement
 */
async function generateSynthesis(
  ai: Ai,
  config: DiscourseConfig,
  self: NodeApex,
  other: NodeApex,
  conversation: string
): Promise<string> {
  const response = await ai.run(config.model as Parameters<Ai['run']>[0], {
    messages: [
      { role: 'system', content: SYNTHESIS_PROMPT.system },
      { role: 'user', content: SYNTHESIS_PROMPT.user(self, other, conversation) },
    ],
    max_tokens: 200,
    temperature: 0.5,
  });

  const responseText = typeof response === 'object' && 'response' in response
    ? (response as { response: string }).response
    : String(response);

  return responseText.trim();
}

/**
 * Generate cross-reference analysis
 */
async function generateCrossReference(
  ai: Ai,
  config: DiscourseConfig,
  visitor: NodeApex,
  host: NodeApex,
  conversation: string
): Promise<{
  type: ReferenceType;
  strength: number;
  discoveryHook: string;
}> {
  try {
    const response = await ai.run(config.model as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: CROSS_REFERENCE_PROMPT.system },
        { role: 'user', content: CROSS_REFERENCE_PROMPT.user(visitor, host, conversation) },
      ],
      max_tokens: 150,
      temperature: 0.3,
    });

    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        type: parsed.reference_type || 'resonance',
        strength: Math.min(1, Math.max(0, parsed.strength || 0.5)),
        discoveryHook: parsed.discovery_hook || 'Thematic connection discovered',
      };
    }
  } catch (error) {
    console.error('[DISCOURSE] Cross-reference generation error:', error);
  }

  // Fallback
  return {
    type: 'resonance',
    strength: 0.5,
    discoveryHook: `Connection between ${visitor.sourceTitle} and ${host.sourceTitle}`,
  };
}

// ==========================================
// Utilities
// ==========================================

function rowToApex(row: Record<string, unknown>): NodeApex {
  return {
    id: row.id as string,
    nodeId: row.node_id as string,
    narrativeArc: row.narrative_arc as string,
    coreThemes: JSON.parse(row.core_themes as string || '[]'),
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

/**
 * Get summary of discourse for display
 */
export function getDiscourseSummary(result: DiscourseResult): string {
  return `
Discourse between nodes:
- Visitor: ${result.visitorNodeId}
- Host: ${result.hostNodeId}
- Exchanges: ${result.exchanges.length}
- Processing time: ${(result.processingTimeMs / 1000).toFixed(1)}s

Cross-reference:
- Type: ${result.crossReference.type}
- Strength: ${(result.crossReference.strength * 100).toFixed(0)}%
- Discovery: ${result.crossReference.discoveryHook}

Visitor synthesis: ${result.visitorSynthesis.substring(0, 100)}...
Host synthesis: ${result.hostSynthesis.substring(0, 100)}...
`.trim();
}
