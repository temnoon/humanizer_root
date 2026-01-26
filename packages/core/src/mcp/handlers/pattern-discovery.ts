/**
 * Pattern Discovery Handlers
 *
 * MCP handler implementations for the Pattern Discovery System.
 */

import type { Pool } from 'pg';
import { PatternSystem } from '../../agentic-search/pattern-discovery-system.js';
import type { MCPToolResult } from '../types.js';

// ═══════════════════════════════════════════════════════════════════
// HANDLER CLASS
// ═══════════════════════════════════════════════════════════════════

export class PatternDiscoveryHandler {
  private system: PatternSystem | null = null;
  private pool: Pool;
  private embedFn: (text: string) => Promise<number[]>;

  constructor(pool: Pool, embedFn: (text: string) => Promise<number[]>) {
    this.pool = pool;
    this.embedFn = embedFn;
  }

  /**
   * Lazy initialization of the pattern system
   */
  private getSystem(): PatternSystem {
    if (!this.system) {
      this.system = new PatternSystem(this.pool, this.embedFn);
    }
    return this.system;
  }

  // ─────────────────────────────────────────────────────────────────
  // DISCOVERY
  // ─────────────────────────────────────────────────────────────────

  /**
   * Autonomously discover patterns in the archive
   */
  async discover(args: {
    sourceTypes?: string[];
    minInstances?: number;
    limit?: number;
  }): Promise<MCPToolResult> {
    try {
      const system = this.getSystem();
      const patterns = await system.discovery.discover({
        sourceTypes: args.sourceTypes,
        minInstances: args.minInstances || 5,
      });

      const limited = patterns.slice(0, args.limit || 10);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
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
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PATTERN MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a pattern from natural language description
   */
  async describe(args: {
    description: string;
    name?: string;
    tags?: string[];
  }): Promise<MCPToolResult> {
    try {
      const system = this.getSystem();
      const pattern = await system.describe(args.description);

      // Update name if provided
      if (args.name) {
        pattern.name = args.name;
      }

      // Add tags if provided
      if (args.tags) {
        pattern.tags = [...new Set([...pattern.tags, ...args.tags])];
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
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
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Execute a pattern to find matches
   */
  async execute(args: {
    patternName: string;
    limit?: number;
    minConfidence?: number;
  }): Promise<MCPToolResult> {
    try {
      const system = this.getSystem();
      const results = await system.execute(args.patternName);

      // Filter by confidence if specified
      let filtered = results;
      if (args.minConfidence) {
        filtered = results.filter((r: any) => r.confidence >= args.minConfidence!);
      }

      // Limit results
      const limited = filtered.slice(0, args.limit || 100);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
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
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * List all available patterns
   */
  async list(args: {
    includeBuiltin?: boolean;
    tags?: string[];
  }): Promise<MCPToolResult> {
    try {
      const system = this.getSystem();
      let patterns = system.composer.list();

      // Filter by tags if specified
      if (args.tags && args.tags.length > 0) {
        patterns = patterns.filter(p =>
          args.tags!.some(tag => p.tags.includes(tag))
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              patternCount: patterns.length,
              patterns: patterns.map(p => ({
                name: p.name,
                type: p.definition.type,
                description: p.description.substring(0, 100),
                tags: p.tags,
                usageCount: p.usageCount,
              })),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Get pattern details
   */
  async get(args: { patternName: string }): Promise<MCPToolResult> {
    try {
      const system = this.getSystem();
      const pattern = system.composer.get(args.patternName);

      if (!pattern) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Pattern not found: ${args.patternName}`,
              }),
            },
          ],
          isError: true,
        };
      }

      // Get learned constraints
      const constraints = system.learner.getConstraints(pattern.id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
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
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // FEEDBACK
  // ─────────────────────────────────────────────────────────────────

  /**
   * Provide feedback on a pattern match
   */
  async feedback(args: {
    patternName: string;
    contentId: string;
    judgment: 'correct' | 'incorrect' | 'partial';
    explanation?: string;
  }): Promise<MCPToolResult> {
    try {
      const system = this.getSystem();
      await system.feedback(
        args.patternName,
        args.contentId,
        args.judgment,
        args.explanation
      );

      // Check if we learned anything
      const pattern = system.composer.get(args.patternName);
      const constraints = pattern ? system.learner.getConstraints(pattern.id) : [];

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Recorded ${args.judgment} feedback for ${args.contentId.slice(0, 8)}`,
              learnedConstraintsCount: constraints.length,
              learnedConstraints: constraints.slice(-3).map(c => c.description),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Get learned constraints for a pattern
   */
  async getConstraints(args: { patternName: string }): Promise<MCPToolResult> {
    try {
      const system = this.getSystem();
      const pattern = system.composer.get(args.patternName);

      if (!pattern) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Pattern not found: ${args.patternName}`,
              }),
            },
          ],
          isError: true,
        };
      }

      const constraints = system.learner.getConstraints(pattern.id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
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
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // COMPOSITION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Compose patterns using algebra
   */
  async compose(args: {
    name: string;
    description: string;
    operator: 'AND' | 'OR' | 'NOT' | 'SEQUENCE' | 'REFINE';
    patterns: string[];
  }): Promise<MCPToolResult> {
    try {
      const system = this.getSystem();

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
            throw new Error('NOT operator requires exactly 2 patterns: [base, exclusion]');
          }
          composed = system.composer.not(args.name, args.description, args.patterns[0], args.patterns[1]);
          break;
        case 'SEQUENCE':
          composed = system.composer.sequence(args.name, args.description, true, ...args.patterns);
          break;
        case 'REFINE':
          if (args.patterns.length < 2) {
            throw new Error('REFINE operator requires exactly 2 patterns: [base, refinement]');
          }
          composed = system.composer.refine(args.name, args.description, args.patterns[0], args.patterns[1]);
          break;
        default:
          throw new Error(`Unknown operator: ${args.operator}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Composed pattern "${composed.name}" created`,
              pattern: {
                name: composed.name,
                id: composed.id,
                description: composed.description,
                operator: args.operator,
                operands: args.patterns,
              },
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Specialize a pattern
   */
  async specialize(args: {
    name: string;
    description: string;
    basePattern: string;
    specialization: string;
  }): Promise<MCPToolResult> {
    try {
      const system = this.getSystem();

      // First create the specialization filter
      const filter = await system.describe(args.specialization);

      // Then refine the base pattern with it
      const specialized = system.composer.refine(
        args.name,
        args.description,
        args.basePattern,
        filter.name
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Specialized pattern "${specialized.name}" created`,
              pattern: {
                name: specialized.name,
                id: specialized.id,
                description: specialized.description,
                basePattern: args.basePattern,
                specialization: args.specialization,
              },
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TOOL DISPATCH
  // ─────────────────────────────────────────────────────────────────

  /**
   * Dispatch tool call to appropriate handler
   */
  async handleToolCall(name: string, args: any): Promise<MCPToolResult> {
    switch (name) {
      case 'pattern_discover':
        return this.discover(args);
      case 'pattern_describe':
        return this.describe(args);
      case 'pattern_execute':
        return this.execute(args);
      case 'pattern_list':
        return this.list(args);
      case 'pattern_get':
        return this.get(args);
      case 'pattern_feedback':
        return this.feedback(args);
      case 'pattern_get_constraints':
        return this.getConstraints(args);
      case 'pattern_compose':
        return this.compose(args);
      case 'pattern_specialize':
        return this.specialize(args);
      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Unknown tool: ${name}`,
              }),
            },
          ],
          isError: true,
        };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export function createPatternDiscoveryHandler(
  pool: Pool,
  embedFn: (text: string) => Promise<number[]>
): PatternDiscoveryHandler {
  return new PatternDiscoveryHandler(pool, embedFn);
}
