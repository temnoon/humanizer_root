/**
 * Explorer Agent
 *
 * The format discovery specialist. Explores unknown file structures,
 * formulates hypotheses about data formats, and learns from user feedback.
 *
 * Concerns:
 * - Folder structure exploration and mapping
 * - File format detection and hypothesis generation
 * - Interactive discovery through user queries
 * - Pattern learning and persistence
 * - Parser generation recommendations
 *
 * NOTE: This agent uses ConfigManager for all thresholds and prompts.
 * NO hardcoded literals allowed.
 */

import { AgentBase } from '../runtime/agent-base.js';
import type { AgentMessage, HouseType } from '../runtime/types.js';
import { getConfigManager, THRESHOLD_KEYS } from '../config/index.js';
import type { ConfigManager } from '../config/types.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIG KEYS FOR EXPLORER
// ═══════════════════════════════════════════════════════════════════

/**
 * Explorer specific config keys
 */
export const EXPLORER_CONFIG = {
  // Exploration limits
  MAX_DEPTH: 'explorer.maxDepth',
  MAX_FILES: 'explorer.maxFiles',
  MAX_SAMPLE_SIZE: 'explorer.maxSampleSize',

  // Confidence thresholds
  HIGH_CONFIDENCE_THRESHOLD: 'explorer.highConfidenceThreshold',
  MEDIUM_CONFIDENCE_THRESHOLD: 'explorer.mediumConfidenceThreshold',
} as const;

// ═══════════════════════════════════════════════════════════════════
// EXPLORER TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Structure insight from folder exploration
 */
export interface StructureInsight {
  path: string;
  type: 'folder' | 'file';
  name: string;
  children?: StructureInsight[];
  fileCount?: number;
  folderCount?: number;
  sizeBytes?: number;

  // For files
  extension?: string;
  mimeType?: string;

  // Pattern detection
  patterns?: DetectedPattern[];
}

/**
 * Detected pattern in the structure
 */
export interface DetectedPattern {
  type: 'naming' | 'nesting' | 'content' | 'meta';
  pattern: string;
  confidence: number;
  examples: string[];
  description: string;
}

/**
 * Format hypothesis generated from exploration
 */
export interface FormatHypothesis {
  id: string;
  formatName: string;
  confidence: number;
  source: 'known' | 'inferred' | 'user-confirmed';

  // Evidence
  evidence: Array<{
    type: 'file-pattern' | 'folder-structure' | 'content-sample' | 'user-input';
    description: string;
    weight: number;
  }>;

  // Related known formats
  similarTo?: string[];

  // Recommended parser
  parserRecommendation?: {
    useExisting?: string;
    createNew?: boolean;
    modifications?: string[];
  };
}

/**
 * Sample from probing a file
 */
export interface ProbeSample {
  path: string;
  success: boolean;
  content?: unknown;
  structure?: Record<string, unknown>;
  error?: string;

  // For JSON/structured data
  keys?: string[];
  arrayLength?: number;
  sampleValues?: Record<string, unknown>;
}

/**
 * User query for clarification
 */
export interface UserQuery {
  id: string;
  question: string;
  options?: string[];
  context?: string;
  response?: string;
  respondedAt?: number;
}

/**
 * Learned format pattern
 */
export interface LearnedFormat {
  id: string;
  name: string;
  description: string;

  // Detection signatures
  signatures: Array<{
    type: 'folder-name' | 'file-pattern' | 'json-structure' | 'content-marker';
    pattern: string;
    required: boolean;
  }>;

  // Parser mapping
  parserName: string;
  parserConfig?: Record<string, unknown>;

  // Learning metadata
  learnedAt: number;
  confirmedByUser: boolean;
  successfulImports: number;
}

/**
 * Discovery session state
 */
export interface DiscoverySession {
  id: string;
  sourcePath: string;
  startedAt: number;

  // Exploration results
  structure?: StructureInsight;
  samples: ProbeSample[];

  // Hypotheses
  hypotheses: FormatHypothesis[];
  selectedHypothesis?: string;

  // User interaction
  queries: UserQuery[];

  // Final result
  status: 'exploring' | 'awaiting-input' | 'confirmed' | 'failed';
  result?: {
    formatName: string;
    parser: string;
    config?: Record<string, unknown>;
  };
}

/**
 * Known format signature definition
 */
export interface KnownFormatSignature {
  name: string;
  signatures: Array<{
    type: 'folder' | 'file' | 'json-key' | 'json-structure';
    pattern: string | RegExp;
    weight: number;
  }>;
  parser: string;
  description: string;
}

// ═══════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

interface ExploreRequest {
  path: string;
  maxDepth?: number;
  maxFiles?: number;
}

interface DetectRequest {
  path: string;
}

interface ProbeRequest {
  path: string;
  parseJson?: boolean;
  sampleSize?: number;
}

interface UserResponsePayload {
  sessionId: string;
  queryId: string;
  response: string;
}

interface ConfirmFormatPayload {
  sessionId: string;
  formatName: string;
  parser: string;
  config?: Record<string, unknown>;
}

interface StartDiscoveryRequest {
  path: string;
}

// ═══════════════════════════════════════════════════════════════════
// EXPLORER AGENT
// ═══════════════════════════════════════════════════════════════════

export class ExplorerAgent extends AgentBase {
  readonly id = 'explorer';
  readonly name = 'The Explorer';
  readonly house: HouseType = 'explorer';
  readonly capabilities = [
    'explore-structure',
    'detect-format',
    'probe-file',
    'query-user',
    'learn-format',
    'recommend-parser',
  ];

  private configManager: ConfigManager;

  // Active discovery sessions
  private sessions: Map<string, DiscoverySession> = new Map();

  // Learned formats from user confirmations
  private learnedFormats: LearnedFormat[] = [];

  // Known format signatures (could also be loaded from config)
  private knownFormats: KnownFormatSignature[] = [];

  constructor() {
    super();
    this.configManager = getConfigManager();
    this.initializeKnownFormats();
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    this.log('info', 'Explorer awakening - ready to discover new formats');

    // Subscribe to import events
    this.subscribe('import:unknown-format');
    this.subscribe('import:discovery-request');

    // Load learned formats from state store
    await this.loadLearnedFormats();
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', 'Explorer retiring - saving learned patterns');
    await this.saveLearnedFormats();
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE HANDLING
  // ─────────────────────────────────────────────────────────────────

  protected async onMessage(message: AgentMessage): Promise<unknown> {
    switch (message.type) {
      case 'explore-structure':
        return this.exploreStructure(message.payload as ExploreRequest);

      case 'detect-format':
        return this.detectFormat(message.payload as DetectRequest);

      case 'probe-file':
        return this.probeFile(message.payload as ProbeRequest);

      case 'user-response':
        return this.handleUserResponse(message.payload as UserResponsePayload);

      case 'confirm-format':
        return this.confirmFormat(message.payload as ConfirmFormatPayload);

      case 'start-discovery':
        return this.startDiscoverySession(message.payload as StartDiscoveryRequest);

      case 'get-session':
        return this.getSession(message.payload as { sessionId: string });

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // KNOWN FORMAT INITIALIZATION
  // ─────────────────────────────────────────────────────────────────

  private initializeKnownFormats(): void {
    // These could also be loaded from config
    this.knownFormats = [
      {
        name: 'instagram-export',
        signatures: [
          { type: 'folder', pattern: 'your_instagram_activity', weight: 0.9 },
          { type: 'folder', pattern: /messages\/(inbox|message_requests)/, weight: 0.8 },
          { type: 'file', pattern: /message_\d+\.json$/, weight: 0.7 },
          { type: 'json-key', pattern: 'participants', weight: 0.5 },
          { type: 'json-key', pattern: 'sender_name', weight: 0.6 },
        ],
        parser: 'instagram',
        description: 'Instagram data export from Meta',
      },
      {
        name: 'facebook-export',
        signatures: [
          { type: 'folder', pattern: 'messages/inbox', weight: 0.9 },
          { type: 'folder', pattern: 'posts', weight: 0.6 },
          { type: 'file', pattern: /message_\d+\.json$/, weight: 0.7 },
          { type: 'json-key', pattern: 'participants', weight: 0.5 },
          { type: 'json-key', pattern: 'sender_name', weight: 0.6 },
        ],
        parser: 'facebook',
        description: 'Facebook data export',
      },
      {
        name: 'openai-export',
        signatures: [
          { type: 'file', pattern: 'conversations.json', weight: 0.9 },
          { type: 'json-key', pattern: 'mapping', weight: 0.9 },
          { type: 'json-key', pattern: 'current_node', weight: 0.7 },
        ],
        parser: 'openai',
        description: 'ChatGPT data export',
      },
      {
        name: 'gemini-export',
        signatures: [
          { type: 'json-key', pattern: 'source', weight: 0.5 },
          { type: 'json-structure', pattern: 'source:Gemini', weight: 0.95 },
          { type: 'json-structure', pattern: 'content.parts', weight: 0.8 },
          { type: 'json-key', pattern: 'role:model', weight: 0.7 },
        ],
        parser: 'gemini',
        description: 'Google Gemini conversation export',
      },
      {
        name: 'claude-export',
        signatures: [
          { type: 'file', pattern: 'conversations.json', weight: 0.5 },
          { type: 'file', pattern: 'users.json', weight: 0.8 },
          { type: 'json-key', pattern: 'chat_messages', weight: 0.9 },
          { type: 'json-key', pattern: 'uuid', weight: 0.5 },
        ],
        parser: 'claude',
        description: 'Claude data export',
      },
    ];
  }

  // ─────────────────────────────────────────────────────────────────
  // STRUCTURE EXPLORATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Explore a folder structure
   * Note: This is a simulation - actual file system access would be in Electron/Node
   */
  async exploreStructure(request: ExploreRequest): Promise<StructureInsight> {
    const { path: sourcePath } = request;

    // Get limits from config
    const maxDepth = request.maxDepth ?? await this.configManager.getOrDefault<number>(
      'limits',
      EXPLORER_CONFIG.MAX_DEPTH,
      3
    );
    const maxFiles = request.maxFiles ?? await this.configManager.getOrDefault<number>(
      'limits',
      EXPLORER_CONFIG.MAX_FILES,
      100
    );

    // In the actual implementation, this would use fs APIs
    // For now, return a placeholder structure
    const structure: StructureInsight = {
      path: sourcePath,
      type: 'folder',
      name: sourcePath.split('/').pop() || 'root',
      children: [],
      fileCount: 0,
      folderCount: 0,
      patterns: [],
    };

    // Publish exploration started event
    this.publish('explorer:exploration-started', {
      path: sourcePath,
      maxDepth,
      maxFiles,
    });

    return structure;
  }

  // ─────────────────────────────────────────────────────────────────
  // FORMAT DETECTION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Detect the format of a source path
   */
  async detectFormat(request: DetectRequest): Promise<FormatHypothesis[]> {
    const { path: sourcePath } = request;

    // Get confidence thresholds from config
    const highConfidence = await this.configManager.getOrDefault<number>(
      'thresholds',
      EXPLORER_CONFIG.HIGH_CONFIDENCE_THRESHOLD,
      0.8
    );
    const mediumConfidence = await this.configManager.getOrDefault<number>(
      'thresholds',
      EXPLORER_CONFIG.MEDIUM_CONFIDENCE_THRESHOLD,
      0.3
    );

    // Explore structure first
    const structure = await this.exploreStructure({ path: sourcePath });

    const hypotheses: FormatHypothesis[] = [];

    // Check against known formats
    for (const known of this.knownFormats) {
      const evidence: FormatHypothesis['evidence'] = [];
      let totalWeight = 0;
      let matchedWeight = 0;

      for (const sig of known.signatures) {
        totalWeight += sig.weight;
        const matched = this.checkSignature(structure, sig);
        if (matched) {
          matchedWeight += sig.weight;
          evidence.push({
            type: sig.type === 'folder' || sig.type === 'file' ? 'folder-structure' : 'content-sample',
            description: `Matched ${sig.type}: ${sig.pattern}`,
            weight: sig.weight,
          });
        }
      }

      const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 0;
      if (confidence >= mediumConfidence) {
        hypotheses.push({
          id: `hyp-${known.name}-${Date.now()}`,
          formatName: known.name,
          confidence,
          source: 'known',
          evidence,
          parserRecommendation: {
            useExisting: known.parser,
          },
        });
      }
    }

    // Check learned formats
    for (const learned of this.learnedFormats) {
      const matched = this.checkLearnedFormat(structure, learned);
      if (matched >= mediumConfidence) {
        hypotheses.push({
          id: `hyp-learned-${learned.id}`,
          formatName: learned.name,
          confidence: matched,
          source: 'inferred',
          evidence: [{
            type: 'content-sample',
            description: `Matched learned format: ${learned.description}`,
            weight: matched,
          }],
          parserRecommendation: {
            useExisting: learned.parserName,
            modifications: learned.parserConfig ? ['Apply custom config'] : undefined,
          },
        });
      }
    }

    // Sort by confidence
    hypotheses.sort((a, b) => b.confidence - a.confidence);

    return hypotheses;
  }

  private checkSignature(
    structure: StructureInsight,
    signature: { type: string; pattern: string | RegExp; weight: number }
  ): boolean {
    const patternStr = signature.pattern instanceof RegExp
      ? signature.pattern.source
      : signature.pattern;

    switch (signature.type) {
      case 'folder':
        return this.findInStructure(structure, 'folder', patternStr);
      case 'file':
        return this.findInStructure(structure, 'file', patternStr);
      case 'json-key':
        // Would need to probe files to check this
        return false;
      case 'json-structure':
        // Would need to probe files to check this
        return false;
      default:
        return false;
    }
  }

  private findInStructure(
    structure: StructureInsight,
    type: 'folder' | 'file',
    pattern: string
  ): boolean {
    const regex = new RegExp(pattern);

    const search = (node: StructureInsight): boolean => {
      if (node.type === type && regex.test(node.path)) {
        return true;
      }
      if (node.children) {
        return node.children.some(search);
      }
      return false;
    };

    return search(structure);
  }

  private checkLearnedFormat(
    structure: StructureInsight,
    format: LearnedFormat
  ): number {
    let matched = 0;

    for (const sig of format.signatures) {
      let found = false;
      switch (sig.type) {
        case 'folder-name':
          found = this.findInStructure(structure, 'folder', sig.pattern);
          break;
        case 'file-pattern':
          found = this.findInStructure(structure, 'file', sig.pattern);
          break;
        // Other types would need file probing
      }

      if (found) matched++;
    }

    return format.signatures.length > 0 ? matched / format.signatures.length : 0;
  }

  // ─────────────────────────────────────────────────────────────────
  // FILE PROBING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Probe a file to understand its structure
   * Note: Actual implementation would read file content
   */
  async probeFile(request: ProbeRequest): Promise<ProbeSample> {
    const { path: filePath, parseJson = true } = request;

    // Get sample size from config
    const sampleSize = request.sampleSize ?? await this.configManager.getOrDefault<number>(
      'limits',
      EXPLORER_CONFIG.MAX_SAMPLE_SIZE,
      5000
    );

    // This would actually read the file in production
    return {
      path: filePath,
      success: true,
      content: `[Probe sample - max ${sampleSize} bytes]`,
      keys: [],
      sampleValues: {},
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // DISCOVERY SESSION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Start an interactive discovery session
   */
  async startDiscoverySession(request: StartDiscoveryRequest): Promise<DiscoverySession> {
    const sessionId = `discovery-${Date.now()}`;

    const session: DiscoverySession = {
      id: sessionId,
      sourcePath: request.path,
      startedAt: Date.now(),
      samples: [],
      hypotheses: [],
      queries: [],
      status: 'exploring',
    };

    this.sessions.set(sessionId, session);

    // Start exploration
    this.log('info', `Starting discovery session for: ${request.path}`);

    try {
      // Explore structure
      session.structure = await this.exploreStructure({ path: request.path });

      // Detect format
      session.hypotheses = await this.detectFormat({ path: request.path });

      // Get confidence thresholds
      const highConfidence = await this.configManager.getOrDefault<number>(
        'thresholds',
        EXPLORER_CONFIG.HIGH_CONFIDENCE_THRESHOLD,
        0.8
      );

      // Determine next step
      if (session.hypotheses.length > 0 && session.hypotheses[0].confidence >= highConfidence) {
        // High confidence - propose confirmation
        session.status = 'awaiting-input';

        const topHypothesis = session.hypotheses[0];
        session.queries.push({
          id: `query-${Date.now()}`,
          question: `This looks like a ${topHypothesis.formatName} export. Is that correct?`,
          options: ['Yes', 'No, it\'s something else', 'I\'m not sure'],
          context: `Confidence: ${(topHypothesis.confidence * 100).toFixed(0)}%`,
        });

        // Publish for UI
        this.publish('explorer:query', {
          sessionId,
          query: session.queries[session.queries.length - 1],
        });

      } else if (session.hypotheses.length > 0) {
        // Medium confidence - ask for clarification
        session.status = 'awaiting-input';

        session.queries.push({
          id: `query-${Date.now()}`,
          question: 'What type of export is this?',
          options: session.hypotheses.map(h => h.formatName).slice(0, 4),
          context: 'I detected multiple possible formats.',
        });

        this.publish('explorer:query', {
          sessionId,
          query: session.queries[session.queries.length - 1],
        });

      } else {
        // Unknown format - ask user
        session.status = 'awaiting-input';

        session.queries.push({
          id: `query-${Date.now()}`,
          question: 'I don\'t recognize this format. What application or service created this export?',
          context: this.describeStructure(session.structure),
        });

        this.publish('explorer:query', {
          sessionId,
          query: session.queries[session.queries.length - 1],
        });
      }

    } catch (err) {
      session.status = 'failed';
      this.log('error', `Discovery failed: ${err}`);
    }

    return session;
  }

  private describeStructure(structure: StructureInsight): string {
    const parts: string[] = [];

    if (structure.folderCount) {
      parts.push(`${structure.folderCount} folders`);
    }
    if (structure.fileCount) {
      parts.push(`${structure.fileCount} files`);
    }
    if (structure.children) {
      const topFolders = structure.children
        .filter(c => c.type === 'folder')
        .slice(0, 5)
        .map(c => c.name);
      if (topFolders.length > 0) {
        parts.push(`Top folders: ${topFolders.join(', ')}`);
      }
    }

    return parts.join(' | ');
  }

  /**
   * Handle user response to a query
   */
  async handleUserResponse(payload: UserResponsePayload): Promise<DiscoverySession> {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${payload.sessionId}`);
    }

    // Update the query with response
    const query = session.queries.find(q => q.id === payload.queryId);
    if (query) {
      query.response = payload.response;
      query.respondedAt = Date.now();
    }

    // Process response
    if (payload.response === 'Yes' && session.hypotheses.length > 0) {
      // User confirmed top hypothesis
      const confirmed = session.hypotheses[0];
      session.selectedHypothesis = confirmed.id;
      session.status = 'confirmed';
      session.result = {
        formatName: confirmed.formatName,
        parser: confirmed.parserRecommendation?.useExisting || 'unknown',
      };

      // Learn from this confirmation
      await this.learnFromConfirmation(session, confirmed);

    } else if (session.hypotheses.some(h => h.formatName === payload.response)) {
      // User selected a specific format
      const selected = session.hypotheses.find(h => h.formatName === payload.response)!;
      session.selectedHypothesis = selected.id;
      session.status = 'confirmed';
      session.result = {
        formatName: selected.formatName,
        parser: selected.parserRecommendation?.useExisting || 'unknown',
      };

      await this.learnFromConfirmation(session, selected);

    } else {
      // User provided custom response - need to learn new format
      session.queries.push({
        id: `query-${Date.now()}`,
        question: 'What would you call this format? (e.g., "twitter-export", "whatsapp-backup")',
        context: `You said: "${payload.response}"`,
      });

      this.publish('explorer:query', {
        sessionId: session.id,
        query: session.queries[session.queries.length - 1],
      });
    }

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(payload: { sessionId: string }): DiscoverySession | undefined {
    return this.sessions.get(payload.sessionId);
  }

  /**
   * Confirm format and finalize session
   */
  async confirmFormat(payload: ConfirmFormatPayload): Promise<DiscoverySession> {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${payload.sessionId}`);
    }

    session.status = 'confirmed';
    session.result = {
      formatName: payload.formatName,
      parser: payload.parser,
      config: payload.config,
    };

    // Publish result
    this.publish('explorer:format-confirmed', {
      sessionId: session.id,
      result: session.result,
    });

    return session;
  }

  // ─────────────────────────────────────────────────────────────────
  // LEARNING
  // ─────────────────────────────────────────────────────────────────

  private async learnFromConfirmation(session: DiscoverySession, hypothesis: FormatHypothesis): Promise<void> {
    // Check if we already know this format
    const existing = this.learnedFormats.find(f => f.name === hypothesis.formatName);
    if (existing) {
      existing.successfulImports++;
      return;
    }

    // Create new learned format
    const learned: LearnedFormat = {
      id: `learned-${Date.now()}`,
      name: hypothesis.formatName,
      description: `Learned from ${session.sourcePath}`,
      signatures: [],
      parserName: hypothesis.parserRecommendation?.useExisting || 'unknown',
      learnedAt: Date.now(),
      confirmedByUser: true,
      successfulImports: 1,
    };

    // Extract signatures from the structure
    if (session.structure?.children) {
      const topFolders = session.structure.children
        .filter(c => c.type === 'folder')
        .slice(0, 3);

      for (const folder of topFolders) {
        learned.signatures.push({
          type: 'folder-name',
          pattern: folder.name,
          required: false,
        });
      }
    }

    this.learnedFormats.push(learned);
    this.log('info', `Learned new format: ${learned.name}`);
  }

  private async loadLearnedFormats(): Promise<void> {
    // In production, would load from persistent storage
    // For now, start with empty array
    this.learnedFormats = [];
  }

  private async saveLearnedFormats(): Promise<void> {
    // In production, would save to persistent storage
    this.log('info', `Would save ${this.learnedFormats.length} learned formats`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _explorer: ExplorerAgent | null = null;

export function getExplorerAgent(): ExplorerAgent {
  if (!_explorer) {
    _explorer = new ExplorerAgent();
  }
  return _explorer;
}

/**
 * Reset the Explorer agent (for testing)
 */
export function resetExplorerAgent(): void {
  _explorer = null;
}
