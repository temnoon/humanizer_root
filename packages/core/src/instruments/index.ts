/**
 * Instruments - What the Agent CAN DO
 *
 * The Instruments define the capabilities available to an agent:
 * - Tools (functions the agent can call)
 * - Search capabilities
 * - Transform capabilities
 * - User interaction capabilities
 *
 * Instruments are registered with agents and determine what actions
 * they can propose and execute.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * A tool that an agent can use
 */
export interface Tool {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this tool does */
  description: string;

  /** Input schema (JSON Schema format) */
  inputSchema: Record<string, unknown>;

  /** Output schema (JSON Schema format) */
  outputSchema?: Record<string, unknown>;

  /** Tags for categorization */
  tags: string[];

  /** Whether this tool requires user approval to execute */
  requiresApproval: boolean;

  /** Whether this tool can modify state */
  modifiesState: boolean;

  /** Rate limit (calls per minute) */
  rateLimit?: number;

  /** Timeout in milliseconds */
  timeoutMs?: number;

  /** Which houses can use this tool */
  allowedHouses?: string[];
}

/**
 * Result of a tool execution
 */
export interface ToolResult<T = unknown> {
  /** Whether execution succeeded */
  success: boolean;

  /** Result data if successful */
  data?: T;

  /** Error message if failed */
  error?: string;

  /** Execution time in ms */
  executionTimeMs: number;

  /** Any metadata about the execution */
  metadata?: Record<string, unknown>;
}

/**
 * Search capability
 */
export interface SearchCapability {
  /** Available search types */
  types: SearchType[];

  /** Maximum results per search */
  maxResults: number;

  /** Supported filters */
  filters: SearchFilter[];

  /** Whether semantic search is available */
  semanticSearchAvailable: boolean;
}

/**
 * Search type
 */
export interface SearchType {
  /** Type identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description */
  description: string;

  /** What content this searches */
  targets: ('messages' | 'passages' | 'chapters' | 'documents' | 'all')[];
}

/**
 * Search filter
 */
export interface SearchFilter {
  /** Filter identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Filter type */
  type: 'date-range' | 'category' | 'tag' | 'source' | 'similarity';

  /** Default value */
  defaultValue?: unknown;
}

/**
 * Transform capability
 */
export interface TransformCapability {
  /** Available transformation types */
  types: TransformType[];

  /** Whether chaining is supported */
  chainingSupported: boolean;

  /** Maximum chain length */
  maxChainLength: number;
}

/**
 * Transform type
 */
export interface TransformType {
  /** Type identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description */
  description: string;

  /** Input requirements */
  inputRequirements: {
    minLength?: number;
    maxLength?: number;
    contentTypes?: string[];
  };

  /** Parameters this transform accepts */
  parameters: TransformParameter[];
}

/**
 * Transform parameter
 */
export interface TransformParameter {
  /** Parameter name */
  name: string;

  /** Description */
  description: string;

  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'select' | 'json';

  /** Required? */
  required: boolean;

  /** Default value */
  defaultValue?: unknown;

  /** Options for select type */
  options?: string[];
}

/**
 * A proposed action
 */
export interface ProposedAction {
  /** Action type */
  type: string;

  /** Description for user */
  title: string;

  /** Detailed description */
  description?: string;

  /** The action payload */
  payload: unknown;

  /** Why this action is being proposed */
  rationale: string;

  /** Expected outcome */
  expectedOutcome?: string;

  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high';

  /** Reversible? */
  reversible: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// INSTRUMENTS INTERFACE
// ═══════════════════════════════════════════════════════════════════

/**
 * The Instruments - what an agent can do
 */
export interface Instruments {
  /** Available tools */
  tools: Tool[];

  /** Search capabilities */
  search: SearchCapability;

  /** Transform capabilities */
  transform: TransformCapability;

  /** Ask the user a question */
  askUser: (question: string, options?: AskUserOptions) => Promise<string>;

  /** Propose an action for user approval */
  proposeAction: (action: ProposedAction) => Promise<boolean>;
}

/**
 * Options for asking the user
 */
export interface AskUserOptions {
  /** Suggested answers */
  suggestions?: string[];

  /** Input type */
  inputType?: 'text' | 'select' | 'confirm';

  /** Default value */
  defaultValue?: string;

  /** Timeout in ms */
  timeoutMs?: number;
}

/**
 * Tool executor function type
 */
export type ToolExecutor<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context: ToolExecutionContext
) => Promise<ToolResult<TOutput>>;

/**
 * Context for tool execution
 */
export interface ToolExecutionContext {
  /** Agent ID executing the tool */
  agentId: string;

  /** Project ID if applicable */
  projectId?: string;

  /** User ID if applicable */
  userId?: string;

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

// ═══════════════════════════════════════════════════════════════════
// INSTRUMENTS PROVIDER
// ═══════════════════════════════════════════════════════════════════

/**
 * Instruments provider interface
 */
export interface InstrumentsProvider {
  /**
   * Get all available instruments
   */
  getInstruments(): Promise<Instruments>;

  /**
   * Get available tools
   */
  getTools(filter?: { tags?: string[]; house?: string }): Promise<Tool[]>;

  /**
   * Get a specific tool
   */
  getTool(id: string): Promise<Tool | undefined>;

  /**
   * Execute a tool
   */
  executeTool<TInput, TOutput>(
    toolId: string,
    input: TInput,
    context: ToolExecutionContext
  ): Promise<ToolResult<TOutput>>;

  /**
   * Register a tool
   */
  registerTool(tool: Tool, executor: ToolExecutor): void;

  /**
   * Unregister a tool
   */
  unregisterTool(toolId: string): void;

  /**
   * Get search capability
   */
  getSearchCapability(): Promise<SearchCapability>;

  /**
   * Get transform capability
   */
  getTransformCapability(): Promise<TransformCapability>;
}

// ═══════════════════════════════════════════════════════════════════
// IN-MEMORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

/**
 * In-memory Instruments provider
 */
export class InMemoryInstrumentsProvider implements InstrumentsProvider {
  private tools: Map<string, Tool> = new Map();
  private executors: Map<string, ToolExecutor> = new Map();
  private searchCapability: SearchCapability;
  private transformCapability: TransformCapability;

  // User interaction handlers (to be set by the application)
  private askUserHandler?: (question: string, options?: AskUserOptions) => Promise<string>;
  private proposeActionHandler?: (action: ProposedAction) => Promise<boolean>;

  constructor() {
    // Initialize with default capabilities
    this.searchCapability = {
      types: [
        {
          id: 'semantic',
          name: 'Semantic Search',
          description: 'Search by meaning, not just keywords',
          targets: ['messages', 'passages', 'all'],
        },
        {
          id: 'keyword',
          name: 'Keyword Search',
          description: 'Exact keyword matching',
          targets: ['all'],
        },
      ],
      maxResults: 50,
      filters: [
        { id: 'date-range', name: 'Date Range', type: 'date-range' },
        { id: 'similarity', name: 'Similarity Threshold', type: 'similarity', defaultValue: 0.6 },
      ],
      semanticSearchAvailable: true,
    };

    this.transformCapability = {
      types: [
        {
          id: 'persona',
          name: 'Persona Transform',
          description: 'Transform text using a persona',
          inputRequirements: { minLength: 10, maxLength: 10000 },
          parameters: [
            { name: 'personaId', description: 'Persona to use', type: 'string', required: true },
          ],
        },
        {
          id: 'style',
          name: 'Style Transform',
          description: 'Transform text style',
          inputRequirements: { minLength: 10, maxLength: 10000 },
          parameters: [
            { name: 'styleId', description: 'Style to apply', type: 'string', required: true },
          ],
        },
        {
          id: 'summarize',
          name: 'Summarize',
          description: 'Create a summary of text',
          inputRequirements: { minLength: 100 },
          parameters: [
            { name: 'targetLength', description: 'Target summary length', type: 'number', required: false, defaultValue: 200 },
          ],
        },
      ],
      chainingSupported: true,
      maxChainLength: 5,
    };
  }

  async getInstruments(): Promise<Instruments> {
    return {
      tools: Array.from(this.tools.values()),
      search: this.searchCapability,
      transform: this.transformCapability,
      askUser: this.askUser.bind(this),
      proposeAction: this.proposeAction.bind(this),
    };
  }

  async getTools(filter?: { tags?: string[]; house?: string }): Promise<Tool[]> {
    let tools = Array.from(this.tools.values());

    if (filter?.tags) {
      tools = tools.filter(t => t.tags.some(tag => filter.tags!.includes(tag)));
    }

    if (filter?.house) {
      tools = tools.filter(t => !t.allowedHouses || t.allowedHouses.includes(filter.house!));
    }

    return tools;
  }

  async getTool(id: string): Promise<Tool | undefined> {
    return this.tools.get(id);
  }

  async executeTool<TInput, TOutput>(
    toolId: string,
    input: TInput,
    context: ToolExecutionContext
  ): Promise<ToolResult<TOutput>> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolId}`,
        executionTimeMs: 0,
      };
    }

    const executor = this.executors.get(toolId);
    if (!executor) {
      return {
        success: false,
        error: `No executor registered for tool: ${toolId}`,
        executionTimeMs: 0,
      };
    }

    const startTime = Date.now();

    try {
      // Set up timeout if specified
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;

      const timeoutPromise = tool.timeoutMs
        ? new Promise<ToolResult<TOutput>>((_, reject) => {
            timeoutId = setTimeout(() => {
              timedOut = true;
              reject(new Error(`Tool execution timed out after ${tool.timeoutMs}ms`));
            }, tool.timeoutMs);
          })
        : null;

      // Execute the tool
      const resultPromise = executor(input, context) as Promise<ToolResult<TOutput>>;

      const result = timeoutPromise
        ? await Promise.race([resultPromise, timeoutPromise])
        : await resultPromise;

      if (timeoutId) clearTimeout(timeoutId);

      return {
        ...result,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  registerTool(tool: Tool, executor: ToolExecutor): void {
    this.tools.set(tool.id, tool);
    this.executors.set(tool.id, executor);
  }

  unregisterTool(toolId: string): void {
    this.tools.delete(toolId);
    this.executors.delete(toolId);
  }

  async getSearchCapability(): Promise<SearchCapability> {
    return this.searchCapability;
  }

  async getTransformCapability(): Promise<TransformCapability> {
    return this.transformCapability;
  }

  // ─────────────────────────────────────────────────────────────────
  // USER INTERACTION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Set the handler for user questions
   */
  setAskUserHandler(handler: (question: string, options?: AskUserOptions) => Promise<string>): void {
    this.askUserHandler = handler;
  }

  /**
   * Set the handler for action proposals
   */
  setProposeActionHandler(handler: (action: ProposedAction) => Promise<boolean>): void {
    this.proposeActionHandler = handler;
  }

  private async askUser(question: string, options?: AskUserOptions): Promise<string> {
    if (!this.askUserHandler) {
      throw new Error('No askUser handler registered');
    }
    return this.askUserHandler(question, options);
  }

  private async proposeAction(action: ProposedAction): Promise<boolean> {
    if (!this.proposeActionHandler) {
      throw new Error('No proposeAction handler registered');
    }
    return this.proposeActionHandler(action);
  }

  // ─────────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Update search capability
   */
  setSearchCapability(capability: SearchCapability): void {
    this.searchCapability = capability;
  }

  /**
   * Update transform capability
   */
  setTransformCapability(capability: TransformCapability): void {
    this.transformCapability = capability;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _instrumentsProvider: InstrumentsProvider | null = null;

/**
 * Get the instruments provider
 */
export function getInstrumentsProvider(): InstrumentsProvider {
  if (!_instrumentsProvider) {
    _instrumentsProvider = new InMemoryInstrumentsProvider();
  }
  return _instrumentsProvider;
}

/**
 * Set a custom instruments provider
 */
export function setInstrumentsProvider(provider: InstrumentsProvider): void {
  _instrumentsProvider = provider;
}

/**
 * Reset the instruments provider (for testing)
 */
export function resetInstrumentsProvider(): void {
  _instrumentsProvider = null;
}

// ═══════════════════════════════════════════════════════════════════
// STANDARD TOOLS
// ═══════════════════════════════════════════════════════════════════

/**
 * Standard tool definitions (seed data)
 */
export const STANDARD_TOOLS: Tool[] = [
  {
    id: 'search-archive',
    name: 'Search Archive',
    description: 'Search the user\'s archive for relevant content',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Maximum results', default: 20 },
        filters: { type: 'object', description: 'Optional filters' },
      },
      required: ['query'],
    },
    tags: ['search', 'archive'],
    requiresApproval: false,
    modifiesState: false,
    rateLimit: 60,
    timeoutMs: 15000,
  },
  {
    id: 'transform-text',
    name: 'Transform Text',
    description: 'Apply a transformation to text',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to transform' },
        transformType: { type: 'string', enum: ['persona', 'style', 'summarize'] },
        parameters: { type: 'object', description: 'Transform parameters' },
      },
      required: ['text', 'transformType'],
    },
    tags: ['transform'],
    requiresApproval: false,
    modifiesState: false,
    rateLimit: 20,
    timeoutMs: 60000,
  },
  {
    id: 'harvest-passage',
    name: 'Harvest Passage',
    description: 'Add a passage to the current project',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Passage text' },
        source: { type: 'object', description: 'Source reference' },
        rating: { type: 'number', description: 'Quality rating', minimum: 1, maximum: 5 },
      },
      required: ['text'],
    },
    tags: ['harvest', 'project'],
    requiresApproval: true,
    modifiesState: true,
    allowedHouses: ['harvester', 'curator'],
  },
  {
    id: 'create-chapter',
    name: 'Create Chapter',
    description: 'Create a new chapter in the current book',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Chapter title' },
        outline: { type: 'string', description: 'Chapter outline' },
        position: { type: 'number', description: 'Chapter position' },
      },
      required: ['title'],
    },
    tags: ['chapter', 'project'],
    requiresApproval: true,
    modifiesState: true,
    allowedHouses: ['builder', 'project-manager'],
  },
];
