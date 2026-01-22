/**
 * Canon - What the Agent KNOWS
 *
 * The Canon represents the accumulated knowledge an agent can draw upon:
 * - Known formats and signatures
 * - Learned patterns from experience
 * - Domain knowledge graphs
 * - Archive apex summaries (user's accumulated content)
 *
 * Canon is loaded into the agent context BEFORE any LLM call,
 * reducing the need for the model to "know" things - it can reference instead.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * A recognizable format signature
 *
 * Used to identify content types, file formats, or structural patterns.
 */
export interface FormatSignature {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this format is */
  description: string;

  /** Patterns that identify this format */
  patterns: FormatPattern[];

  /** MIME type if applicable */
  mimeType?: string;

  /** File extensions if applicable */
  extensions?: string[];

  /** How to parse/handle this format */
  parser?: string;

  /** Confidence threshold for identification */
  confidenceThreshold: number;

  /** Tags for categorization */
  tags: string[];
}

/**
 * A pattern for identifying a format
 */
export interface FormatPattern {
  /** Type of pattern */
  type: 'regex' | 'prefix' | 'suffix' | 'contains' | 'structure';

  /** The pattern to match */
  pattern: string;

  /** Weight in identification (0-1) */
  weight: number;

  /** Where to apply this pattern */
  target: 'content' | 'filename' | 'metadata' | 'structure';
}

/**
 * A learned pattern from experience
 *
 * Agents learn patterns over time from successful operations.
 */
export interface LearnedPattern {
  /** Unique identifier */
  id: string;

  /** What domain this pattern applies to */
  domain: string;

  /** The pattern description */
  description: string;

  /** When this pattern was learned */
  learnedAt: number;

  /** How many times this pattern has been applied */
  applicationCount: number;

  /** Success rate when applied */
  successRate: number;

  /** The actual pattern (could be a template, rule, or heuristic) */
  pattern: unknown;

  /** Source of learning (manual, observed, extracted) */
  source: 'manual' | 'observed' | 'extracted';

  /** Confidence in this pattern */
  confidence: number;
}

/**
 * A node in the knowledge graph
 */
export interface KnowledgeNode {
  /** Unique identifier */
  id: string;

  /** Node type (concept, entity, relation, etc.) */
  type: 'concept' | 'entity' | 'relation' | 'fact';

  /** Label for this node */
  label: string;

  /** Description */
  description?: string;

  /** Properties */
  properties: Record<string, unknown>;

  /** Outgoing edges */
  edges: KnowledgeEdge[];

  /** Embedding for similarity search */
  embedding?: number[];

  /** Source of this knowledge */
  source?: string;

  /** When added */
  createdAt: number;
}

/**
 * An edge in the knowledge graph
 */
export interface KnowledgeEdge {
  /** Target node ID */
  targetId: string;

  /** Relationship type */
  relation: string;

  /** Weight/strength of the relationship */
  weight: number;

  /** Properties of the edge */
  properties?: Record<string, unknown>;
}

/**
 * The knowledge graph
 */
export interface KnowledgeGraph {
  /** All nodes */
  nodes: Map<string, KnowledgeNode>;

  /** Index by type */
  byType: Map<string, Set<string>>;

  /** Index by label (for quick lookup) */
  byLabel: Map<string, string>;
}

/**
 * Archive apex summary
 *
 * A high-level summary of the user's entire archive,
 * providing context without loading all content.
 */
export interface ApexSummary {
  /** When this apex was generated */
  generatedAt: number;

  /** Total content items in archive */
  totalItems: number;

  /** Date range of content */
  dateRange: { start: number; end: number };

  /** Key themes discovered */
  themes: ThemeSummary[];

  /** Notable entities mentioned */
  entities: EntitySummary[];

  /** Writing style characteristics */
  styleProfile: StyleProfile;

  /** Topic distribution */
  topicDistribution: Record<string, number>;

  /** Temporal patterns */
  temporalPatterns?: TemporalPattern[];
}

/**
 * Summary of a discovered theme
 */
export interface ThemeSummary {
  /** Theme name */
  name: string;

  /** Description */
  description: string;

  /** How prevalent (0-1) */
  prevalence: number;

  /** Representative quotes/passages */
  exemplars: string[];

  /** Related themes */
  relatedThemes: string[];
}

/**
 * Summary of a notable entity
 */
export interface EntitySummary {
  /** Entity name */
  name: string;

  /** Entity type (person, place, concept, etc.) */
  type: string;

  /** Mention count */
  mentionCount: number;

  /** Sentiment toward this entity */
  sentiment: number;

  /** Context of mentions */
  contexts: string[];
}

/**
 * Style profile extracted from content
 */
export interface StyleProfile {
  /** Formality level (0 = casual, 1 = formal) */
  formality: number;

  /** Average sentence length */
  avgSentenceLength: number;

  /** Vocabulary complexity (0-1) */
  vocabularyComplexity: number;

  /** Preferred structures */
  preferredStructures: string[];

  /** Common phrases */
  commonPhrases: string[];

  /** Tone descriptors */
  toneDescriptors: string[];
}

/**
 * A temporal pattern in the archive
 */
export interface TemporalPattern {
  /** Pattern type */
  type: 'cyclical' | 'trend' | 'burst' | 'decline';

  /** What this pattern is about */
  subject: string;

  /** Time granularity */
  granularity: 'hour' | 'day' | 'week' | 'month' | 'year';

  /** Description */
  description: string;
}

// ═══════════════════════════════════════════════════════════════════
// CANON INTERFACE
// ═══════════════════════════════════════════════════════════════════

/**
 * The Canon - what an agent knows
 */
export interface Canon {
  /** Known format signatures */
  knownFormats: FormatSignature[];

  /** Learned patterns from experience */
  learnedPatterns: LearnedPattern[];

  /** Domain knowledge graph */
  domainKnowledge: KnowledgeGraph;

  /** Archive apex summary (if available) */
  archiveApex?: ApexSummary;
}

/**
 * Canon provider interface
 *
 * Implementations may load canon from:
 * - In-memory (testing)
 * - SQLite database
 * - Remote API
 */
export interface CanonProvider {
  /**
   * Load the full canon
   */
  loadCanon(): Promise<Canon>;

  /**
   * Get format signatures
   */
  getFormats(tags?: string[]): Promise<FormatSignature[]>;

  /**
   * Identify format of content
   */
  identifyFormat(content: string, filename?: string): Promise<{
    format: FormatSignature | null;
    confidence: number;
  }>;

  /**
   * Get learned patterns for a domain
   */
  getPatterns(domain: string): Promise<LearnedPattern[]>;

  /**
   * Record a new learned pattern
   */
  learnPattern(pattern: Omit<LearnedPattern, 'id' | 'learnedAt' | 'applicationCount' | 'successRate'>): Promise<string>;

  /**
   * Update pattern success rate
   */
  recordPatternApplication(patternId: string, success: boolean): Promise<void>;

  /**
   * Query the knowledge graph
   */
  queryKnowledge(query: {
    type?: string;
    label?: string;
    properties?: Record<string, unknown>;
  }): Promise<KnowledgeNode[]>;

  /**
   * Add to knowledge graph
   */
  addKnowledge(node: Omit<KnowledgeNode, 'id' | 'createdAt'>): Promise<string>;

  /**
   * Get archive apex summary
   */
  getApex(): Promise<ApexSummary | undefined>;

  /**
   * Generate/update archive apex summary
   */
  generateApex(): Promise<ApexSummary>;
}

// ═══════════════════════════════════════════════════════════════════
// IN-MEMORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Simple in-memory Canon provider for testing and standalone use
 */
export class InMemoryCanonProvider implements CanonProvider {
  private formats: Map<string, FormatSignature> = new Map();
  private patterns: Map<string, LearnedPattern> = new Map();
  private knowledge: KnowledgeGraph = {
    nodes: new Map(),
    byType: new Map(),
    byLabel: new Map(),
  };
  private apex?: ApexSummary;

  async loadCanon(): Promise<Canon> {
    return {
      knownFormats: Array.from(this.formats.values()),
      learnedPatterns: Array.from(this.patterns.values()),
      domainKnowledge: this.knowledge,
      archiveApex: this.apex,
    };
  }

  async getFormats(tags?: string[]): Promise<FormatSignature[]> {
    const formats = Array.from(this.formats.values());
    if (!tags || tags.length === 0) return formats;
    return formats.filter(f => f.tags.some(t => tags.includes(t)));
  }

  async identifyFormat(content: string, filename?: string): Promise<{
    format: FormatSignature | null;
    confidence: number;
  }> {
    let bestMatch: FormatSignature | null = null;
    let bestConfidence = 0;

    for (const format of this.formats.values()) {
      let score = 0;
      let totalWeight = 0;

      for (const pattern of format.patterns) {
        totalWeight += pattern.weight;
        const target = pattern.target === 'filename' ? filename || '' : content;

        let matches = false;
        switch (pattern.type) {
          case 'regex':
            matches = new RegExp(pattern.pattern).test(target);
            break;
          case 'prefix':
            matches = target.startsWith(pattern.pattern);
            break;
          case 'suffix':
            matches = target.endsWith(pattern.pattern);
            break;
          case 'contains':
            matches = target.includes(pattern.pattern);
            break;
        }

        if (matches) {
          score += pattern.weight;
        }
      }

      const confidence = totalWeight > 0 ? score / totalWeight : 0;
      if (confidence > bestConfidence && confidence >= format.confidenceThreshold) {
        bestMatch = format;
        bestConfidence = confidence;
      }
    }

    return { format: bestMatch, confidence: bestConfidence };
  }

  async getPatterns(domain: string): Promise<LearnedPattern[]> {
    return Array.from(this.patterns.values()).filter(p => p.domain === domain);
  }

  async learnPattern(
    pattern: Omit<LearnedPattern, 'id' | 'learnedAt' | 'applicationCount' | 'successRate'>
  ): Promise<string> {
    const id = `pattern-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const fullPattern: LearnedPattern = {
      ...pattern,
      id,
      learnedAt: Date.now(),
      applicationCount: 0,
      successRate: 0,
    };
    this.patterns.set(id, fullPattern);
    return id;
  }

  async recordPatternApplication(patternId: string, success: boolean): Promise<void> {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return;

    const newCount = pattern.applicationCount + 1;
    const successes = pattern.successRate * pattern.applicationCount + (success ? 1 : 0);
    pattern.applicationCount = newCount;
    pattern.successRate = successes / newCount;
  }

  async queryKnowledge(query: {
    type?: string;
    label?: string;
    properties?: Record<string, unknown>;
  }): Promise<KnowledgeNode[]> {
    let nodes = Array.from(this.knowledge.nodes.values());

    if (query.type) {
      const typeIds = this.knowledge.byType.get(query.type);
      if (typeIds) {
        nodes = nodes.filter(n => typeIds.has(n.id));
      } else {
        return [];
      }
    }

    if (query.label) {
      const id = this.knowledge.byLabel.get(query.label);
      if (id) {
        nodes = nodes.filter(n => n.id === id);
      } else {
        return [];
      }
    }

    if (query.properties) {
      nodes = nodes.filter(n => {
        for (const [key, value] of Object.entries(query.properties!)) {
          if (n.properties[key] !== value) return false;
        }
        return true;
      });
    }

    return nodes;
  }

  async addKnowledge(node: Omit<KnowledgeNode, 'id' | 'createdAt'>): Promise<string> {
    const id = `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const fullNode: KnowledgeNode = {
      ...node,
      id,
      createdAt: Date.now(),
    };

    this.knowledge.nodes.set(id, fullNode);

    // Update type index
    if (!this.knowledge.byType.has(node.type)) {
      this.knowledge.byType.set(node.type, new Set());
    }
    this.knowledge.byType.get(node.type)!.add(id);

    // Update label index
    this.knowledge.byLabel.set(node.label, id);

    return id;
  }

  async getApex(): Promise<ApexSummary | undefined> {
    return this.apex;
  }

  async generateApex(): Promise<ApexSummary> {
    // In a real implementation, this would analyze the archive
    // For now, return a placeholder
    this.apex = {
      generatedAt: Date.now(),
      totalItems: 0,
      dateRange: { start: Date.now(), end: Date.now() },
      themes: [],
      entities: [],
      styleProfile: {
        formality: 0.5,
        avgSentenceLength: 15,
        vocabularyComplexity: 0.5,
        preferredStructures: [],
        commonPhrases: [],
        toneDescriptors: [],
      },
      topicDistribution: {},
    };
    return this.apex;
  }

  // ─────────────────────────────────────────────────────────────────
  // SEED DATA
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add a format signature
   */
  addFormat(format: FormatSignature): void {
    this.formats.set(format.id, format);
  }

  /**
   * Set the apex summary
   */
  setApex(apex: ApexSummary): void {
    this.apex = apex;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _canonProvider: CanonProvider | null = null;

/**
 * Get the canon provider
 */
export function getCanonProvider(): CanonProvider {
  if (!_canonProvider) {
    _canonProvider = new InMemoryCanonProvider();
  }
  return _canonProvider;
}

/**
 * Set a custom canon provider
 */
export function setCanonProvider(provider: CanonProvider): void {
  _canonProvider = provider;
}

/**
 * Reset the canon provider (for testing)
 */
export function resetCanonProvider(): void {
  _canonProvider = null;
}
