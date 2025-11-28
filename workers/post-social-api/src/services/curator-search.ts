/**
 * Curator Search Tool
 *
 * Enables curators to search their text and quote with citations:
 * 1. Semantic search via Vectorize embeddings
 * 2. Return passages with chapter/position citations
 * 3. Format quotes for curator responses
 *
 * The curator can:
 * - Search for relevant passages to support a point
 * - Quote exactly with proper citations
 * - Find passages by theme, character, or concept
 */

import { getChunksByNode, getChunkById, getSummariesByLevel, getApexByNode } from './curator-pyramid';
import type { NodeChunk, NodeSummary, NodeApex } from './curator-pyramid';

// ==========================================
// Types
// ==========================================

export interface QuotablePassage {
  chunkId: string;
  content: string;
  quote: string;           // Extracted quotable portion
  citation: Citation;
  relevanceScore: number;
  chunkType: string;
  containsDialogue: boolean;
  speakers?: string[];
}

export interface Citation {
  formatted: string;       // "Chapter 3, 'The Chase'"
  chapterNumber?: number;
  chapterTitle?: string;
  position: string;        // "early", "middle", etc.
  charRange: string;       // "chars 12,450-13,200"
}

export interface SearchResult {
  passages: QuotablePassage[];
  query: string;
  nodeId: string;
  searchTimeMs: number;
  totalMatches: number;
}

export interface SearchOptions {
  maxResults?: number;
  minScore?: number;
  chapterFilter?: number;
  chunkTypeFilter?: string;
  includeContext?: boolean;
  contextSentences?: number;
}

const DEFAULT_OPTIONS: Required<SearchOptions> = {
  maxResults: 5,
  minScore: 0.3,
  chapterFilter: 0,        // 0 = no filter
  chunkTypeFilter: '',     // '' = no filter
  includeContext: true,
  contextSentences: 1,
};

// ==========================================
// Semantic Search
// ==========================================

/**
 * Search node corpus for relevant passages
 */
export async function searchCorpus(
  ai: Ai,
  db: D1Database,
  vectorize: VectorizeIndex,
  nodeId: string,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  // Generate query embedding
  const queryEmbedding = await generateQueryEmbedding(ai, query);

  // Search Vectorize
  const vectorResults = await vectorize.query(queryEmbedding, {
    topK: opts.maxResults * 2, // Get extra for filtering
    filter: { nodeId },
    returnMetadata: 'all',
  });

  // Fetch full chunk data and format results
  const passages: QuotablePassage[] = [];

  for (const match of vectorResults.matches) {
    if (match.score < opts.minScore) continue;

    const chunk = await getChunkById(db, match.id);
    if (!chunk) continue;

    // Apply filters
    if (opts.chapterFilter && chunk.chapterNumber !== opts.chapterFilter) continue;
    if (opts.chunkTypeFilter && chunk.chunkType !== opts.chunkTypeFilter) continue;

    // Format passage
    const passage = formatPassage(chunk, match.score, query, opts);
    passages.push(passage);

    if (passages.length >= opts.maxResults) break;
  }

  return {
    passages,
    query,
    nodeId,
    searchTimeMs: Date.now() - startTime,
    totalMatches: vectorResults.matches.length,
  };
}

/**
 * Generate embedding for search query
 */
async function generateQueryEmbedding(ai: Ai, query: string): Promise<number[]> {
  const prefixedQuery = `Represent this sentence for searching relevant passages: ${query}`;

  const result = await ai.run('@cf/baai/bge-small-en-v1.5' as Parameters<Ai['run']>[0], {
    text: [prefixedQuery],
  }) as { data: number[][] };

  return result.data[0];
}

/**
 * Format a chunk into a quotable passage
 */
function formatPassage(
  chunk: NodeChunk,
  score: number,
  query: string,
  options: Required<SearchOptions>
): QuotablePassage {
  // Extract best quote from chunk
  const quote = extractBestQuote(chunk.content, query, options.contextSentences);

  return {
    chunkId: chunk.id,
    content: chunk.content,
    quote,
    citation: formatCitation(chunk),
    relevanceScore: score,
    chunkType: chunk.chunkType,
    containsDialogue: chunk.containsDialogue,
    speakers: chunk.dialogueSpeakers,
  };
}

/**
 * Format citation for a chunk
 */
function formatCitation(chunk: NodeChunk): Citation {
  let formatted = '';

  if (chunk.partNumber) {
    formatted += `Part ${chunk.partNumber}, `;
  }

  if (chunk.chapterNumber) {
    if (chunk.chapterTitle) {
      formatted += `Chapter ${chunk.chapterNumber}: "${chunk.chapterTitle}"`;
    } else {
      formatted += `Chapter ${chunk.chapterNumber}`;
    }
  } else {
    formatted += capitalizeFirst(chunk.structuralPosition) + ' section';
  }

  return {
    formatted,
    chapterNumber: chunk.chapterNumber,
    chapterTitle: chunk.chapterTitle,
    position: chunk.structuralPosition,
    charRange: `chars ${chunk.charStart.toLocaleString()}-${chunk.charEnd.toLocaleString()}`,
  };
}

/**
 * Extract the most relevant quote from a chunk
 */
function extractBestQuote(
  content: string,
  query: string,
  contextSentences: number
): string {
  // Split into sentences
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];

  if (sentences.length <= contextSentences * 2 + 1) {
    // Short chunk, return it all
    return content.trim();
  }

  // Score each sentence by relevance to query
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const scores = sentences.map(sentence => {
    const lower = sentence.toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      if (lower.includes(term)) score++;
    }
    return score;
  });

  // Find best sentence
  let bestIndex = 0;
  let bestScore = 0;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] > bestScore) {
      bestScore = scores[i];
      bestIndex = i;
    }
  }

  // Include context
  const start = Math.max(0, bestIndex - contextSentences);
  const end = Math.min(sentences.length, bestIndex + contextSentences + 1);

  return sentences.slice(start, end).join(' ').trim();
}

// ==========================================
// Direct Chunk Access
// ==========================================

/**
 * Get chunks by chapter for browsing
 */
export async function getChapterChunks(
  db: D1Database,
  nodeId: string,
  chapter: number
): Promise<QuotablePassage[]> {
  const chunks = await getChunksByNode(db, nodeId, { chapter });

  return chunks.map(chunk => ({
    chunkId: chunk.id,
    content: chunk.content,
    quote: chunk.content.substring(0, 300) + (chunk.content.length > 300 ? '...' : ''),
    citation: formatCitation(chunk),
    relevanceScore: 1.0,
    chunkType: chunk.chunkType,
    containsDialogue: chunk.containsDialogue,
    speakers: chunk.dialogueSpeakers,
  }));
}

/**
 * Get a specific chunk with formatted citation
 */
export async function getQuotableChunk(
  db: D1Database,
  chunkId: string
): Promise<QuotablePassage | null> {
  const chunk = await getChunkById(db, chunkId);
  if (!chunk) return null;

  return {
    chunkId: chunk.id,
    content: chunk.content,
    quote: chunk.content,
    citation: formatCitation(chunk),
    relevanceScore: 1.0,
    chunkType: chunk.chunkType,
    containsDialogue: chunk.containsDialogue,
    speakers: chunk.dialogueSpeakers,
  };
}

// ==========================================
// Quote Formatting for Curator
// ==========================================

/**
 * Format a passage as a curator quote with citation
 */
export function formatCuratorQuote(
  passage: QuotablePassage,
  options: {
    maxLength?: number;
    includeAnalysis?: boolean;
  } = {}
): string {
  const maxLength = options.maxLength || 200;

  let quote = passage.quote;
  if (quote.length > maxLength) {
    // Find a good break point
    const truncated = quote.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    if (lastSentence > maxLength / 2) {
      quote = truncated.substring(0, lastSentence + 1);
    } else {
      quote = truncated.trim() + '...';
    }
  }

  return `"${quote}" (${passage.citation.formatted})`;
}

/**
 * Format multiple passages for a curator response
 */
export function formatCuratorResponse(
  passages: QuotablePassage[],
  context: {
    query: string;
    responseIntro?: string;
  }
): string {
  if (passages.length === 0) {
    return "I couldn't find relevant passages for that query.";
  }

  const intro = context.responseIntro || `Here's what I found regarding "${context.query}":`;
  const quotes = passages.map((p, i) =>
    `${i + 1}. ${formatCuratorQuote(p)}`
  ).join('\n\n');

  return `${intro}\n\n${quotes}`;
}

// ==========================================
// Context Building for Conversations
// ==========================================

/**
 * Build context for curator conversation from search results
 */
export async function buildConversationContext(
  ai: Ai,
  db: D1Database,
  vectorize: VectorizeIndex,
  nodeId: string,
  userQuery: string,
  options: {
    maxTokens?: number;
    includeApex?: boolean;
    includeSummaries?: boolean;
  } = {}
): Promise<{
  apex?: NodeApex;
  relevantPassages: QuotablePassage[];
  contextText: string;
}> {
  const maxTokens = options.maxTokens || 2000;
  const includeApex = options.includeApex ?? true;
  const includeSummaries = options.includeSummaries ?? false;

  let contextText = '';
  let tokenCount = 0;

  // Get apex (curator's core consciousness)
  let apex: NodeApex | undefined;
  if (includeApex) {
    const apexData = await getApexByNode(db, nodeId);
    if (apexData) {
      apex = apexData;
      const apexContext = `
CORE UNDERSTANDING:
Themes: ${apexData.coreThemes.join(', ')}
The Question: ${apexData.theQuestion}
Narrative Arc: ${apexData.narrativeArc.substring(0, 300)}...
`;
      contextText += apexContext;
      tokenCount += estimateTokens(apexContext);
    }
  }

  // Search for relevant passages
  const searchResults = await searchCorpus(ai, db, vectorize, nodeId, userQuery, {
    maxResults: 5,
    minScore: 0.4,
  });

  // Add passages within token budget
  const passages: QuotablePassage[] = [];
  for (const passage of searchResults.passages) {
    const passageTokens = estimateTokens(passage.quote);
    if (tokenCount + passageTokens > maxTokens) break;

    passages.push(passage);
    contextText += `\nRELEVANT PASSAGE (${passage.citation.formatted}):\n"${passage.quote}"\n`;
    tokenCount += passageTokens;
  }

  return {
    apex,
    relevantPassages: passages,
    contextText,
  };
}

// ==========================================
// Utilities
// ==========================================

function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.4);
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Highlight search terms in text
 */
export function highlightTerms(text: string, query: string): string {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  let highlighted = text;

  for (const term of terms) {
    const regex = new RegExp(`\\b(${term})\\b`, 'gi');
    highlighted = highlighted.replace(regex, '**$1**');
  }

  return highlighted;
}

/**
 * Extract key terms from a query for search expansion
 */
export function expandQuery(query: string): string[] {
  // Extract nouns, verbs, adjectives (simplified)
  const words = query.toLowerCase().split(/\s+/);
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
    'about', 'against', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    'am', 'it', 'its', 'he', 'she', 'they', 'them', 'his', 'her', 'their', 'my', 'your']);

  return words.filter(w => w.length > 2 && !stopWords.has(w));
}
