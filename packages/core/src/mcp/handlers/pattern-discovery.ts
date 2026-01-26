/**
 * Pattern Discovery Handlers
 *
 * MCP handler implementations for the Pattern Discovery System.
 * Provides lazy initialization and follows the established handler pattern.
 * Uses PatternStore for persistence so patterns survive server restarts.
 */

import type { MCPResult, HandlerContext } from '../types.js';
import { getContentStore } from '../../storage/index.js';
import { PatternSystem } from '../../agentic-search/pattern-discovery-system.js';
import { PatternStore, initPatternStore, getPatternStore } from '../../storage/pattern-store.js';

// ═══════════════════════════════════════════════════════════════════
// LAZY-LOADED DEPENDENCIES
// ═══════════════════════════════════════════════════════════════════

let OllamaAdapter: typeof import('@humanizer/npe').OllamaAdapter | null = null;
let adapter: InstanceType<typeof import('@humanizer/npe').OllamaAdapter> | null = null;
let patternSystem: PatternSystem | null = null;
let patternStore: PatternStore | null = null;

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

async function getPatternStoreInstance(): Promise<PatternStore> {
  if (!patternStore) {
    const store = getContentStore();
    const pool = store.getPool();
    patternStore = initPatternStore(pool);
  }
  return patternStore;
}

async function getPatternSystem(): Promise<PatternSystem> {
  if (!patternSystem) {
    const store = getContentStore();
    const pool = store.getPool();
    const embedFn = await getEmbedder();
    const patternStoreInstance = await getPatternStoreInstance();

    patternSystem = new PatternSystem(pool, embedFn, {
      store: patternStoreInstance,
    });

    // Ensure patterns are loaded from store
    await patternSystem.ensureLoaded();
  }
  return patternSystem;
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
// DISCOVERY HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface DiscoverInput {
  sourceTypes?: string[];
  minInstances?: number;
  limit?: number;
}

async function handleDiscover(args: DiscoverInput): Promise<MCPResult> {
  try {
    const system = await getPatternSystem();
    const patterns = await system.discovery.discover({
      sourceTypes: args.sourceTypes,
      minInstances: args.minInstances || 5,
    });

    const limited = patterns.slice(0, args.limit || 10);

    return jsonResult({
      success: true,
      patternsFound: limited.length,
      patterns: limited.map(p => ({
        id: p.id,
        observation: p.observation,
        confidence: p.confidence,
        instanceCount: p.instanceCount,
        discoveryMethod: p.discoveryMethod,
        status: p.status,
        dimensions: p.dimensions.map(d => ({
          type: d.type,
          description: d.description,
          weight: d.weight,
        })),
      })),
    });
  } catch (err) {
    return errorResult(`Pattern discovery failed: ${(err as Error).message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// PATTERN MANAGEMENT HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface DescribeInput {
  description: string;
  name?: string;
  tags?: string[];
}

async function handleDescribe(args: DescribeInput): Promise<MCPResult> {
  try {
    const system = await getPatternSystem();
    const pattern = await system.describe(args.description);

    // Update name if provided
    if (args.name) {
      pattern.name = args.name;
    }

    // Add tags if provided
    if (args.tags) {
      pattern.tags = [...new Set([...pattern.tags, ...args.tags])];
    }

    return jsonResult({
      success: true,
      pattern: {
        name: pattern.name,
        id: pattern.id,
        description: pattern.description,
        tags: pattern.tags,
        type: pattern.definition.type,
        dimensionCount: pattern.definition.type === 'atomic'
          ? pattern.definition.dimensions.length
          : 'composed',
      },
      message: `Pattern "${pattern.name}" created. Use pattern_execute to run it.`,
    });
  } catch (err) {
    return errorResult(`Pattern describe failed: ${(err as Error).message}`);
  }
}

interface ExecuteInput {
  patternName: string;
  limit?: number;
  minConfidence?: number;
}

async function handleExecute(args: ExecuteInput): Promise<MCPResult> {
  try {
    const system = await getPatternSystem();
    const results = await system.execute(args.patternName);

    // Filter by confidence if specified
    let filtered = results;
    if (args.minConfidence) {
      filtered = results.filter((r: any) => r.confidence >= args.minConfidence!);
    }

    // Limit results
    const limited = filtered.slice(0, args.limit || 100);

    return jsonResult({
      success: true,
      patternName: args.patternName,
      totalMatches: results.length,
      returnedMatches: limited.length,
      matches: limited.map((r: any) => ({
        id: r.id,
        authorRole: r.author_role,
        sourceType: r.source_type,
        preview: (r.text || '').substring(0, 300),
        hasMedia: r.media_refs && r.media_refs !== '[]',
      })),
    });
  } catch (err) {
    return errorResult(`Pattern execute failed: ${(err as Error).message}`);
  }
}

interface ListInput {
  includeBuiltin?: boolean;
  tags?: string[];
}

async function handleList(args: ListInput): Promise<MCPResult> {
  try {
    const system = await getPatternSystem();
    let patterns = system.composer.list();

    // Filter by tags if specified
    if (args.tags && args.tags.length > 0) {
      patterns = patterns.filter(p =>
        args.tags!.some(tag => p.tags.includes(tag))
      );
    }

    return jsonResult({
      success: true,
      patternCount: patterns.length,
      patterns: patterns.map(p => ({
        name: p.name,
        type: p.definition.type,
        description: p.description.substring(0, 100),
        tags: p.tags,
        usageCount: p.usageCount,
      })),
    });
  } catch (err) {
    return errorResult(`Pattern list failed: ${(err as Error).message}`);
  }
}

interface GetInput {
  patternName: string;
}

async function handleGet(args: GetInput): Promise<MCPResult> {
  try {
    const system = await getPatternSystem();
    const pattern = system.composer.get(args.patternName);

    if (!pattern) {
      return errorResult(`Pattern not found: ${args.patternName}`);
    }

    // Get learned constraints
    const constraints = system.learner.getConstraints(pattern.id);

    return jsonResult({
      success: true,
      pattern: {
        name: pattern.name,
        id: pattern.id,
        description: pattern.description,
        type: pattern.definition.type,
        tags: pattern.tags,
        usageCount: pattern.usageCount,
        successRate: pattern.successRate,
        createdAt: pattern.createdAt,
        lastUsedAt: pattern.lastUsedAt,
        dimensions: pattern.definition.type === 'atomic'
          ? pattern.definition.dimensions.map(d => ({
              type: d.type,
              description: d.description,
              weight: d.weight,
              learned: d.learned,
            }))
          : 'composed',
      },
      learnedConstraints: constraints.map(c => ({
        description: c.description,
        type: c.constraint.type,
        confidence: c.confidence,
        learnedAt: c.learnedAt,
      })),
    });
  } catch (err) {
    return errorResult(`Pattern get failed: ${(err as Error).message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// FEEDBACK HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface FeedbackInput {
  patternName: string;
  contentId: string;
  judgment: 'correct' | 'incorrect' | 'partial';
  explanation?: string;
}

async function handleFeedback(args: FeedbackInput): Promise<MCPResult> {
  try {
    const system = await getPatternSystem();
    await system.feedback(
      args.patternName,
      args.contentId,
      args.judgment,
      args.explanation
    );

    // Check if we learned anything
    const pattern = system.composer.get(args.patternName);
    const constraints = pattern ? system.learner.getConstraints(pattern.id) : [];

    return jsonResult({
      success: true,
      message: `Recorded ${args.judgment} feedback for ${args.contentId.slice(0, 8)}`,
      learnedConstraintsCount: constraints.length,
      learnedConstraints: constraints.slice(-3).map(c => c.description),
    });
  } catch (err) {
    return errorResult(`Pattern feedback failed: ${(err as Error).message}`);
  }
}

interface GetConstraintsInput {
  patternName: string;
}

async function handleGetConstraints(args: GetConstraintsInput): Promise<MCPResult> {
  try {
    const system = await getPatternSystem();
    const pattern = system.composer.get(args.patternName);

    if (!pattern) {
      return errorResult(`Pattern not found: ${args.patternName}`);
    }

    const constraints = system.learner.getConstraints(pattern.id);

    return jsonResult({
      success: true,
      patternName: args.patternName,
      constraintCount: constraints.length,
      constraints: constraints.map(c => ({
        id: c.id,
        description: c.description,
        type: c.constraint.type,
        confidence: c.confidence,
        sourceFeedbackCount: c.sourceFeeback.length,
        learnedAt: c.learnedAt,
      })),
    });
  } catch (err) {
    return errorResult(`Pattern get constraints failed: ${(err as Error).message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMPOSITION HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface ComposeInput {
  name: string;
  description: string;
  operator: 'AND' | 'OR' | 'NOT' | 'SEQUENCE' | 'REFINE';
  patterns: string[];
}

async function handleCompose(args: ComposeInput): Promise<MCPResult> {
  try {
    const system = await getPatternSystem();

    let composed;
    switch (args.operator) {
      case 'AND':
        composed = system.composer.and(args.name, args.description, ...args.patterns);
        break;
      case 'OR':
        composed = system.composer.or(args.name, args.description, ...args.patterns);
        break;
      case 'NOT':
        if (args.patterns.length < 2) {
          return errorResult('NOT operator requires exactly 2 patterns: [base, exclusion]');
        }
        composed = system.composer.not(args.name, args.description, args.patterns[0], args.patterns[1]);
        break;
      case 'SEQUENCE':
        composed = system.composer.sequence(args.name, args.description, true, ...args.patterns);
        break;
      case 'REFINE':
        if (args.patterns.length < 2) {
          return errorResult('REFINE operator requires exactly 2 patterns: [base, refinement]');
        }
        composed = system.composer.refine(args.name, args.description, args.patterns[0], args.patterns[1]);
        break;
      default:
        return errorResult(`Unknown operator: ${args.operator}`);
    }

    return jsonResult({
      success: true,
      message: `Composed pattern "${composed.name}" created`,
      pattern: {
        name: composed.name,
        id: composed.id,
        description: composed.description,
        operator: args.operator,
        operands: args.patterns,
      },
    });
  } catch (err) {
    return errorResult(`Pattern compose failed: ${(err as Error).message}`);
  }
}

interface SpecializeInput {
  name: string;
  description: string;
  basePattern: string;
  specialization: string;
}

async function handleSpecialize(args: SpecializeInput): Promise<MCPResult> {
  try {
    const system = await getPatternSystem();

    // First create the specialization filter
    const filter = await system.describe(args.specialization);

    // Then refine the base pattern with it
    const specialized = system.composer.refine(
      args.name,
      args.description,
      args.basePattern,
      filter.name
    );

    return jsonResult({
      success: true,
      message: `Specialized pattern "${specialized.name}" created`,
      pattern: {
        name: specialized.name,
        id: specialized.id,
        description: specialized.description,
        basePattern: args.basePattern,
        specialization: args.specialization,
      },
    });
  } catch (err) {
    return errorResult(`Pattern specialize failed: ${(err as Error).message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER REGISTRY
// ═══════════════════════════════════════════════════════════════════

export const PATTERN_DISCOVERY_HANDLERS: Record<
  string,
  (args: unknown, context?: HandlerContext) => Promise<MCPResult>
> = {
  // Discovery
  pattern_discover: handleDiscover as (args: unknown) => Promise<MCPResult>,

  // Pattern management
  pattern_describe: handleDescribe as (args: unknown) => Promise<MCPResult>,
  pattern_execute: handleExecute as (args: unknown) => Promise<MCPResult>,
  pattern_list: handleList as (args: unknown) => Promise<MCPResult>,
  pattern_get: handleGet as (args: unknown) => Promise<MCPResult>,

  // Feedback
  pattern_feedback: handleFeedback as (args: unknown) => Promise<MCPResult>,
  pattern_get_constraints: handleGetConstraints as (args: unknown) => Promise<MCPResult>,

  // Composition
  pattern_compose: handleCompose as (args: unknown) => Promise<MCPResult>,
  pattern_specialize: handleSpecialize as (args: unknown) => Promise<MCPResult>,
};
