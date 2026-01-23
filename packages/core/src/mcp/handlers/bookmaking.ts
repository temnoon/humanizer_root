/**
 * Bookmaking Handlers
 *
 * MCP tool handlers for the complete bookmaking workflow.
 * Connects to core services: search, clustering, harvester, builder.
 *
 * Note: These handlers require Ollama for embeddings. Handlers check
 * availability and return helpful errors if services are unavailable.
 */

import type { MCPResult } from '../types.js';
import { ClusteringService } from '../../clustering/clustering-service.js';
import type { ClusterPoint } from '../../clustering/types.js';
import {
  createAnchor,
  createAnchorSet,
  refineByAnchors,
  findBetweenAnchors,
  computeCentroid,
} from '../../retrieval/anchor-refinement.js';
import type { SemanticAnchor } from '../../retrieval/types.js';

// ═══════════════════════════════════════════════════════════════════
// LAZY-LOADED NPE ADAPTER
// ═══════════════════════════════════════════════════════════════════

let OllamaAdapter: typeof import('@humanizer/npe').OllamaAdapter | null = null;
let adapter: InstanceType<typeof import('@humanizer/npe').OllamaAdapter> | null = null;

async function ensureNpeLoaded(): Promise<void> {
  if (!OllamaAdapter) {
    const npe = await import('@humanizer/npe');
    OllamaAdapter = npe.OllamaAdapter;
  }
}

async function getEmbedder(): Promise<(text: string) => Promise<number[]>> {
  await ensureNpeLoaded();

  if (!adapter) {
    adapter = new OllamaAdapter!();
    const isAvailable = await adapter.isAvailable();
    if (!isAvailable) {
      throw new Error('Ollama is not available. Please ensure Ollama is running on localhost:11434');
    }
  }

  return async (text: string) => {
    const result = await adapter!.embed(text);
    return result.embedding;
  };
}

// ═══════════════════════════════════════════════════════════════════
// RESULT HELPERS
// ═══════════════════════════════════════════════════════════════════

function jsonResult(data: unknown): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ═══════════════════════════════════════════════════════════════════
// SEARCH HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface SearchArchiveInput {
  query: string;
  limit?: number;
  minRelevance?: number;
  denseWeight?: number;
  sparseWeight?: number;
  sourceFilter?: {
    conversationIds?: string[];
    dateRange?: { start?: number; end?: number };
  };
}

export async function handleSearchArchive(args: SearchArchiveInput): Promise<MCPResult> {
  try {
    if (!args.query || args.query.length < 2) {
      return errorResult('Query must be at least 2 characters');
    }

    const embedder = await getEmbedder();
    const embedding = await embedder(args.query);

    // Note: In production, this would connect to HybridSearchService with PostgresContentStore
    // For now, we return a simulated structure showing what the search would return
    return jsonResult({
      query: args.query,
      embedding: {
        dimensions: embedding.length,
        preview: embedding.slice(0, 5).map(n => n.toFixed(4)),
      },
      message: 'Search executed. Connect to PostgresContentStore for full results.',
      parameters: {
        limit: args.limit ?? 20,
        minRelevance: args.minRelevance ?? 0.5,
        denseWeight: args.denseWeight ?? 0.6,
        sparseWeight: args.sparseWeight ?? 0.4,
      },
    });
  } catch (err) {
    return errorResult(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface FindSimilarInput {
  text: string;
  limit?: number;
  excludeIds?: string[];
}

export async function handleFindSimilar(args: FindSimilarInput): Promise<MCPResult> {
  try {
    if (!args.text || args.text.length < 10) {
      return errorResult('Text must be at least 10 characters');
    }

    const embedder = await getEmbedder();
    const embedding = await embedder(args.text);

    return jsonResult({
      query: args.text.substring(0, 100) + '...',
      embedding: {
        dimensions: embedding.length,
        preview: embedding.slice(0, 5).map(n => n.toFixed(4)),
      },
      message: 'Similarity search ready. Connect to content store for results.',
      parameters: {
        limit: args.limit ?? 10,
        excludeIds: args.excludeIds ?? [],
      },
    });
  } catch (err) {
    return errorResult(`Find similar failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CLUSTERING HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface ClusterContentInput {
  contentIds?: string[];
  query?: string;
  minClusterSize?: number;
  maxClusters?: number;
  computeCentroids?: boolean;
}

export async function handleClusterContent(args: ClusterContentInput): Promise<MCPResult> {
  try {
    // If query provided, we'd first search then cluster
    // For now demonstrate clustering capability
    if (!args.contentIds && !args.query) {
      return errorResult('Provide either contentIds or query');
    }

    const service = new ClusteringService({
      hdbscan: {
        minClusterSize: args.minClusterSize ?? 3,
        metric: 'cosine',
      },
      maxClusters: args.maxClusters ?? 10,
      computeCentroids: args.computeCentroids ?? true,
    });

    // Demo with query - would search first in production
    if (args.query) {
      const embedder = await getEmbedder();
      const embedding = await embedder(args.query);

      return jsonResult({
        message: 'Clustering service initialized. Connect to content store to cluster actual content.',
        query: args.query,
        queryEmbedding: {
          dimensions: embedding.length,
        },
        config: {
          minClusterSize: args.minClusterSize ?? 3,
          maxClusters: args.maxClusters ?? 10,
          computeCentroids: args.computeCentroids ?? true,
        },
      });
    }

    return jsonResult({
      message: 'Clustering service ready. Provide content embeddings to cluster.',
      contentIds: args.contentIds,
      config: {
        minClusterSize: args.minClusterSize ?? 3,
        maxClusters: args.maxClusters ?? 10,
      },
    });
  } catch (err) {
    return errorResult(`Clustering failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// ANCHOR HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface CreateAnchorInput {
  name: string;
  text: string;
  type?: 'positive' | 'negative';
}

export async function handleCreateAnchor(args: CreateAnchorInput): Promise<MCPResult> {
  try {
    if (!args.name || !args.text) {
      return errorResult('Name and text are required');
    }

    if (args.text.length < 10) {
      return errorResult('Text must be at least 10 characters');
    }

    const embedder = await getEmbedder();
    const embedding = await embedder(args.text);

    const anchor = createAnchor(
      `anchor-${Date.now()}`,
      args.name,
      embedding
    );

    return jsonResult({
      anchor: {
        id: anchor.id,
        name: anchor.name,
        type: args.type ?? 'positive',
        dimensions: embedding.length,
        createdAt: new Date(anchor.createdAt).toISOString(),
        textPreview: args.text.substring(0, 100) + (args.text.length > 100 ? '...' : ''),
      },
      message: 'Anchor created. Use with refine_by_anchors or find_between_anchors.',
    });
  } catch (err) {
    return errorResult(`Create anchor failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface RefineByAnchorsInput {
  query: string;
  positiveAnchors?: Array<{ name: string; text: string }>;
  negativeAnchors?: Array<{ name: string; text: string }>;
  limit?: number;
}

export async function handleRefineByAnchors(args: RefineByAnchorsInput): Promise<MCPResult> {
  try {
    if (!args.query) {
      return errorResult('Query is required');
    }

    const embedder = await getEmbedder();

    // Create query embedding
    const queryEmbedding = await embedder(args.query);

    // Create anchor embeddings
    const positiveAnchors: SemanticAnchor[] = [];
    for (const anchor of args.positiveAnchors ?? []) {
      const embedding = await embedder(anchor.text);
      positiveAnchors.push(createAnchor(`pos-${Date.now()}`, anchor.name, embedding));
    }

    const negativeAnchors: SemanticAnchor[] = [];
    for (const anchor of args.negativeAnchors ?? []) {
      const embedding = await embedder(anchor.text);
      negativeAnchors.push(createAnchor(`neg-${Date.now()}`, anchor.name, embedding));
    }

    const anchorSet = createAnchorSet(positiveAnchors, negativeAnchors);

    return jsonResult({
      query: args.query,
      queryEmbedding: {
        dimensions: queryEmbedding.length,
      },
      anchors: {
        positive: positiveAnchors.map(a => ({ id: a.id, name: a.name })),
        negative: negativeAnchors.map(a => ({ id: a.id, name: a.name })),
      },
      message: 'Anchors prepared. Connect to search results to apply refinement.',
      note: 'Use search_archive first, then apply refineByAnchors to filter/boost results',
    });
  } catch (err) {
    return errorResult(`Refine by anchors failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface FindBetweenAnchorsInput {
  anchor1: { name: string; text: string };
  anchor2: { name: string; text: string };
  balanceThreshold?: number;
  limit?: number;
}

export async function handleFindBetweenAnchors(args: FindBetweenAnchorsInput): Promise<MCPResult> {
  try {
    if (!args.anchor1?.text || !args.anchor2?.text) {
      return errorResult('Both anchors with text are required');
    }

    const embedder = await getEmbedder();

    const embedding1 = await embedder(args.anchor1.text);
    const embedding2 = await embedder(args.anchor2.text);

    const anchor1 = createAnchor('anchor1', args.anchor1.name, embedding1);
    const anchor2 = createAnchor('anchor2', args.anchor2.name, embedding2);

    // Compute similarity between anchors
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));

    return jsonResult({
      anchor1: { name: args.anchor1.name, preview: args.anchor1.text.substring(0, 50) },
      anchor2: { name: args.anchor2.name, preview: args.anchor2.text.substring(0, 50) },
      anchorSimilarity: similarity.toFixed(4),
      balanceThreshold: args.balanceThreshold ?? 0.2,
      message: 'Anchors prepared. Connect to search results to find content between them.',
      interpretation: similarity > 0.7
        ? 'Anchors are similar - results will be close to both'
        : similarity > 0.3
          ? 'Anchors are moderately different - good for finding bridges'
          : 'Anchors are very different - few results may qualify',
    });
  } catch (err) {
    return errorResult(`Find between anchors failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// HARVEST HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface HarvestForThreadInput {
  theme: string;
  queries: string[];
  existingPassageIds?: string[];
  limit?: number;
}

export async function handleHarvestForThread(args: HarvestForThreadInput): Promise<MCPResult> {
  try {
    if (!args.theme || !args.queries || args.queries.length === 0) {
      return errorResult('Theme and at least one query are required');
    }

    const embedder = await getEmbedder();

    // Embed all queries
    const queryEmbeddings = await Promise.all(
      args.queries.map(async q => ({
        query: q,
        embedding: await embedder(q),
      }))
    );

    return jsonResult({
      theme: args.theme,
      queries: queryEmbeddings.map(qe => ({
        text: qe.query,
        embeddingDimensions: qe.embedding.length,
      })),
      parameters: {
        limit: args.limit ?? 20,
        excludeCount: args.existingPassageIds?.length ?? 0,
      },
      message: 'Harvest queries prepared. Connect to content store to execute.',
      workflow: [
        '1. Search for each query',
        '2. Deduplicate results',
        '3. Filter by minimum relevance',
        '4. Exclude existing passage IDs',
        '5. Return top results sorted by relevance',
      ],
    });
  } catch (err) {
    return errorResult(`Harvest failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface DiscoverConnectionsInput {
  seedTexts: string[];
  explorationDepth?: number;
}

export async function handleDiscoverConnections(args: DiscoverConnectionsInput): Promise<MCPResult> {
  try {
    if (!args.seedTexts || args.seedTexts.length === 0) {
      return errorResult('At least one seed text is required');
    }

    const embedder = await getEmbedder();

    const seedEmbeddings = await Promise.all(
      args.seedTexts.map(async (text, i) => ({
        index: i,
        preview: text.substring(0, 100),
        embedding: await embedder(text),
      }))
    );

    // Compute pairwise similarity between seeds
    const pairwiseSimilarities: Array<{ i: number; j: number; similarity: number }> = [];
    for (let i = 0; i < seedEmbeddings.length; i++) {
      for (let j = i + 1; j < seedEmbeddings.length; j++) {
        let dot = 0, norm1 = 0, norm2 = 0;
        const e1 = seedEmbeddings[i].embedding;
        const e2 = seedEmbeddings[j].embedding;
        for (let k = 0; k < e1.length; k++) {
          dot += e1[k] * e2[k];
          norm1 += e1[k] * e1[k];
          norm2 += e2[k] * e2[k];
        }
        pairwiseSimilarities.push({
          i, j,
          similarity: dot / (Math.sqrt(norm1) * Math.sqrt(norm2)),
        });
      }
    }

    return jsonResult({
      seedCount: args.seedTexts.length,
      seeds: seedEmbeddings.map(s => ({
        index: s.index,
        preview: s.preview + '...',
      })),
      pairwiseSimilarities: pairwiseSimilarities.map(p => ({
        seeds: [p.i, p.j],
        similarity: p.similarity.toFixed(4),
      })),
      explorationDepth: args.explorationDepth ?? 1,
      message: 'Discovery prepared. Connect to content store to find tangential connections.',
      algorithm: [
        '1. Search semantically near each seed',
        '2. Find content that is related but not too similar',
        '3. Group discoveries by theme',
        '4. Return unexpected connections',
      ],
    });
  } catch (err) {
    return errorResult(`Discover connections failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface ExpandThreadInput {
  theme: string;
  existingTexts: string[];
  direction: 'deeper' | 'broader' | 'contrasting';
  limit?: number;
}

export async function handleExpandThread(args: ExpandThreadInput): Promise<MCPResult> {
  try {
    if (!args.theme || !args.existingTexts || args.existingTexts.length === 0) {
      return errorResult('Theme and existing texts are required');
    }

    const embedder = await getEmbedder();

    // Create expansion query based on direction
    let expansionQuery: string;
    switch (args.direction) {
      case 'deeper':
        expansionQuery = `detailed analysis of ${args.theme}`;
        break;
      case 'broader':
        expansionQuery = `context and implications of ${args.theme}`;
        break;
      case 'contrasting':
        expansionQuery = `alternative perspectives on ${args.theme}`;
        break;
    }

    const expansionEmbedding = await embedder(expansionQuery);

    // Compute centroid of existing texts
    const existingEmbeddings = await Promise.all(
      args.existingTexts.map(t => embedder(t))
    );
    const centroid = computeCentroid(existingEmbeddings);

    return jsonResult({
      theme: args.theme,
      direction: args.direction,
      expansionQuery,
      existingCount: args.existingTexts.length,
      centroidComputed: true,
      message: 'Expansion prepared. Connect to content store to find new content.',
      strategy: args.direction === 'deeper'
        ? 'Find more specific, detailed content'
        : args.direction === 'broader'
          ? 'Find related but wider context'
          : 'Find opposing or alternative viewpoints',
    });
  } catch (err) {
    return errorResult(`Expand thread failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMPOSITION HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface CreateOutlineInput {
  theme: string;
  passages: Array<{
    id?: string;
    text: string;
    role?: 'anchor' | 'supporting' | 'contrast' | 'evidence';
  }>;
  targetLength?: number;
}

export async function handleCreateOutline(args: CreateOutlineInput): Promise<MCPResult> {
  try {
    if (!args.theme || !args.passages || args.passages.length === 0) {
      return errorResult('Theme and passages are required');
    }

    // Analyze passages and create a basic outline structure
    const passagesWithRoles = args.passages.map((p, i) => ({
      id: p.id ?? `passage-${i}`,
      preview: p.text.substring(0, 100) + '...',
      role: p.role ?? 'supporting',
      wordCount: p.text.split(/\s+/).length,
    }));

    const totalWords = passagesWithRoles.reduce((sum, p) => sum + p.wordCount, 0);
    const targetLength = args.targetLength ?? 2000;

    // Create outline structure
    const outline = {
      theme: args.theme,
      suggestedTitle: args.theme,
      estimatedLength: targetLength,
      sections: [
        {
          type: 'opening',
          purpose: 'Introduce the theme and hook the reader',
          passageIds: passagesWithRoles.filter(p => p.role === 'anchor').slice(0, 1).map(p => p.id),
        },
        {
          type: 'body',
          purpose: 'Develop the main argument with supporting evidence',
          passageIds: passagesWithRoles.filter(p => ['supporting', 'evidence'].includes(p.role)).map(p => p.id),
        },
        ...(passagesWithRoles.some(p => p.role === 'contrast') ? [{
          type: 'transition',
          purpose: 'Address counterpoints or alternative perspectives',
          passageIds: passagesWithRoles.filter(p => p.role === 'contrast').map(p => p.id),
        }] : []),
        {
          type: 'conclusion',
          purpose: 'Synthesize insights and provide closure',
          passageIds: [],
        },
      ],
    };

    return jsonResult({
      outline,
      passages: passagesWithRoles,
      stats: {
        passageCount: args.passages.length,
        totalSourceWords: totalWords,
        targetLength,
        expansionRatio: (targetLength / totalWords).toFixed(2),
      },
      message: 'Outline created. Use compose_chapter to generate full draft.',
    });
  } catch (err) {
    return errorResult(`Create outline failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface ComposeChapterInput {
  title: string;
  theme: string;
  passages: Array<{
    id?: string;
    text: string;
    role?: 'anchor' | 'supporting' | 'contrast' | 'evidence';
  }>;
  targetLength?: number;
  styleGuidelines?: string;
  persona?: string;
}

export async function handleComposeChapter(args: ComposeChapterInput): Promise<MCPResult> {
  try {
    if (!args.title || !args.theme || !args.passages || args.passages.length === 0) {
      return errorResult('Title, theme, and passages are required');
    }

    await ensureNpeLoaded();

    // Create outline first
    const outlineResult = await handleCreateOutline({
      theme: args.theme,
      passages: args.passages,
      targetLength: args.targetLength,
    });

    const outlineData = JSON.parse(outlineResult.content[0].text!);

    // In production, this would call BuilderAgent.composeChapter()
    // For now, return the composition plan
    return jsonResult({
      title: args.title,
      theme: args.theme,
      outline: outlineData.outline,
      compositionPlan: {
        passageCount: args.passages.length,
        targetLength: args.targetLength ?? 2000,
        styleGuidelines: args.styleGuidelines ?? 'natural, flowing prose',
        persona: args.persona ?? null,
      },
      message: 'Composition plan ready. Connect to BuilderAgent for full chapter generation.',
      note: 'Full composition requires LLM integration via BuilderAgent.composeChapter()',
    });
  } catch (err) {
    return errorResult(`Compose chapter failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface AnalyzeStructureInput {
  content: string;
}

export async function handleAnalyzeStructure(args: AnalyzeStructureInput): Promise<MCPResult> {
  try {
    if (!args.content || args.content.length < 100) {
      return errorResult('Content must be at least 100 characters');
    }

    const wordCount = args.content.split(/\s+/).length;
    const paragraphs = args.content.split(/\n\s*\n/).filter(p => p.trim());
    const sentences = args.content.split(/[.!?]+/).filter(s => s.trim());

    // Basic structural analysis
    const avgWordsPerParagraph = wordCount / paragraphs.length;
    const avgWordsPerSentence = wordCount / sentences.length;

    // Estimate pacing (varied paragraph lengths = better pacing)
    const paragraphLengths = paragraphs.map(p => p.split(/\s+/).length);
    const avgLength = paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length;
    const variance = paragraphLengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / paragraphLengths.length;
    const stdDev = Math.sqrt(variance);
    const pacingScore = Math.min(1, stdDev / (avgLength * 0.5));

    // Detect narrative arc (simplified)
    const hasOpening = paragraphs.length > 0 && paragraphs[0].length > 50;
    const hasConclusion = paragraphs.length > 1 && paragraphs[paragraphs.length - 1].length > 50;
    const narrativeArc = hasOpening && hasConclusion ? 'resolution' : hasOpening ? 'building' : 'flat';

    return jsonResult({
      structure: {
        wordCount,
        paragraphCount: paragraphs.length,
        sentenceCount: sentences.length,
        avgWordsPerParagraph: avgWordsPerParagraph.toFixed(1),
        avgWordsPerSentence: avgWordsPerSentence.toFixed(1),
      },
      analysis: {
        narrativeArc,
        pacingScore: pacingScore.toFixed(2),
        issues: [
          ...(avgWordsPerSentence > 30 ? ['Long sentences may reduce readability'] : []),
          ...(avgWordsPerParagraph > 200 ? ['Consider breaking up long paragraphs'] : []),
          ...(pacingScore < 0.3 ? ['Paragraph lengths are very uniform - vary pacing'] : []),
          ...(!hasConclusion ? ['Chapter may need a stronger conclusion'] : []),
        ],
        suggestions: [
          ...(narrativeArc === 'flat' ? ['Add a clear opening hook and concluding insight'] : []),
          ...(pacingScore < 0.5 ? ['Vary paragraph lengths for better rhythm'] : []),
        ],
      },
    });
  } catch (err) {
    return errorResult(`Analyze structure failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface SuggestImprovementsInput {
  content: string;
}

export async function handleSuggestImprovements(args: SuggestImprovementsInput): Promise<MCPResult> {
  try {
    if (!args.content || args.content.length < 100) {
      return errorResult('Content must be at least 100 characters');
    }

    // Get structure analysis first
    const structureResult = await handleAnalyzeStructure(args);
    const structureData = JSON.parse(structureResult.content[0].text!);

    // Generate improvement suggestions based on analysis
    const suggestions: Array<{
      type: string;
      location: string;
      issue: string;
      fix: string;
    }> = [];

    if (structureData.analysis.issues.length > 0) {
      structureData.analysis.issues.forEach((issue: string, i: number) => {
        suggestions.push({
          type: 'structure',
          location: 'throughout',
          issue,
          fix: structureData.analysis.suggestions[i] || 'Review and revise as needed',
        });
      });
    }

    // Check for common issues
    const content = args.content;
    if (content.includes('very ') || content.includes('really ')) {
      suggestions.push({
        type: 'clarity',
        location: 'various',
        issue: 'Weak intensifiers detected (very, really)',
        fix: 'Replace with more specific, vivid words',
      });
    }

    if ((content.match(/\bit\b/gi) || []).length > 10) {
      suggestions.push({
        type: 'clarity',
        location: 'various',
        issue: 'Frequent use of "it" may cause ambiguity',
        fix: 'Replace some instances with specific nouns',
      });
    }

    return jsonResult({
      suggestions,
      structureAnalysis: structureData.analysis,
      message: suggestions.length === 0
        ? 'No major issues detected. Content looks good.'
        : `Found ${suggestions.length} areas for improvement.`,
    });
  } catch (err) {
    return errorResult(`Suggest improvements failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXTRACTION HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface ExtractTermsInput {
  text: string;
  types?: Array<'keywords' | 'entities' | 'themes' | 'phrases'>;
  limit?: number;
}

export async function handleExtractTerms(args: ExtractTermsInput): Promise<MCPResult> {
  try {
    if (!args.text || args.text.length < 50) {
      return errorResult('Text must be at least 50 characters');
    }

    const types = args.types ?? ['keywords', 'themes'];
    const limit = args.limit ?? 10;

    // Basic keyword extraction (word frequency)
    const words = args.text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);

    const wordFreq = new Map<string, number>();
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    // Remove common words
    const stopWords = new Set(['that', 'this', 'with', 'from', 'have', 'been', 'were', 'they', 'their', 'what', 'when', 'where', 'which', 'would', 'could', 'should', 'about', 'into', 'more', 'some', 'them', 'then', 'than', 'very', 'just', 'also', 'only']);
    stopWords.forEach(sw => wordFreq.delete(sw));

    const keywords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, count]) => ({ term: word, frequency: count }));

    // Extract phrases (bigrams)
    const phrases: Array<{ term: string; frequency: number }> = [];
    if (types.includes('phrases')) {
      const bigramFreq = new Map<string, number>();
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        bigramFreq.set(bigram, (bigramFreq.get(bigram) || 0) + 1);
      }
      phrases.push(
        ...Array.from(bigramFreq.entries())
          .filter(([_, count]) => count > 1)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([phrase, count]) => ({ term: phrase, frequency: count }))
      );
    }

    const result: Record<string, unknown> = {};
    if (types.includes('keywords')) result.keywords = keywords;
    if (types.includes('phrases')) result.phrases = phrases;
    if (types.includes('themes')) {
      result.themes = keywords.slice(0, 5).map(k => k.term);
      result.themesNote = 'Basic frequency-based themes. Use LLM for deeper analysis.';
    }
    if (types.includes('entities')) {
      result.entities = [];
      result.entitiesNote = 'Entity extraction requires NER model. Use LLM for named entities.';
    }

    return jsonResult({
      ...result,
      stats: {
        textLength: args.text.length,
        wordCount: words.length,
        uniqueWords: wordFreq.size,
      },
    });
  } catch (err) {
    return errorResult(`Extract terms failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface ComputeCentroidInput {
  texts: string[];
  name: string;
}

export async function handleComputeCentroid(args: ComputeCentroidInput): Promise<MCPResult> {
  try {
    if (!args.texts || args.texts.length < 2) {
      return errorResult('At least 2 texts are required');
    }

    if (!args.name) {
      return errorResult('Name is required');
    }

    const embedder = await getEmbedder();

    const embeddings = await Promise.all(
      args.texts.map(t => embedder(t))
    );

    const centroid = computeCentroid(embeddings);
    const anchor = createAnchor(`centroid-${Date.now()}`, args.name, centroid);

    return jsonResult({
      anchor: {
        id: anchor.id,
        name: anchor.name,
        type: 'synthetic',
        dimensions: centroid.length,
        sourceCount: args.texts.length,
        createdAt: new Date(anchor.createdAt).toISOString(),
      },
      sources: args.texts.map((t, i) => ({
        index: i,
        preview: t.substring(0, 50) + '...',
      })),
      message: 'Centroid anchor created. Represents the semantic "center" of the input texts.',
    });
  } catch (err) {
    return errorResult(`Compute centroid failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER REGISTRY
// ═══════════════════════════════════════════════════════════════════

export const BOOKMAKING_HANDLERS: Record<string, (args: unknown) => Promise<MCPResult>> = {
  // Search
  search_archive: handleSearchArchive as (args: unknown) => Promise<MCPResult>,
  find_similar: handleFindSimilar as (args: unknown) => Promise<MCPResult>,

  // Clustering
  cluster_content: handleClusterContent as (args: unknown) => Promise<MCPResult>,

  // Anchors
  create_anchor: handleCreateAnchor as (args: unknown) => Promise<MCPResult>,
  refine_by_anchors: handleRefineByAnchors as (args: unknown) => Promise<MCPResult>,
  find_between_anchors: handleFindBetweenAnchors as (args: unknown) => Promise<MCPResult>,

  // Harvest
  harvest_for_thread: handleHarvestForThread as (args: unknown) => Promise<MCPResult>,
  discover_connections: handleDiscoverConnections as (args: unknown) => Promise<MCPResult>,
  expand_thread: handleExpandThread as (args: unknown) => Promise<MCPResult>,

  // Composition
  create_outline: handleCreateOutline as (args: unknown) => Promise<MCPResult>,
  compose_chapter: handleComposeChapter as (args: unknown) => Promise<MCPResult>,
  analyze_structure: handleAnalyzeStructure as (args: unknown) => Promise<MCPResult>,
  suggest_improvements: handleSuggestImprovements as (args: unknown) => Promise<MCPResult>,

  // Extraction
  extract_terms: handleExtractTerms as (args: unknown) => Promise<MCPResult>,
  compute_centroid: handleComputeCentroid as (args: unknown) => Promise<MCPResult>,
};
