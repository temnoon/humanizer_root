/**
 * Agent Council - Core Types
 *
 * The foundational type definitions for the multi-agent coordination system.
 * The "House of Houses" where specialized agents work together to advance
 * Book and Node projects.
 */

// ═══════════════════════════════════════════════════════════════════
// HOUSE TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * The Houses of the Council
 * Each house has a specialized domain and responsibilities
 */
/**
 * AppAgent Houses - Power the Humanizer application features
 */
export type AppAgentHouse =
  | 'model-master'     // AI model routing and control
  | 'project-manager'  // Project lifecycle and advancement
  | 'curator'          // Content quality assessment
  | 'builder'          // Chapter composition
  | 'harvester'        // Archive search and extraction
  | 'reviewer'         // Quality checks and signoffs
  | 'explorer'         // Format discovery and import intelligence
  | 'prospector'       // Excellence scoring and raw gem detection
  | 'refiner'          // Expression polishing and insight extraction
  | 'archivist';       // Expression indexing and canonical finding

/**
 * CodeGuard Houses - Enforce code quality standards during development
 */
export type CodeGuardHouse =
  | 'architect'        // Structure and patterns
  | 'stylist'          // Code style management
  | 'security'         // Auth and privacy
  | 'accessibility'    // A11y compliance
  | 'data';            // Schema and interface validation

/**
 * All house types (combined for backward compatibility)
 */
export type HouseType = AppAgentHouse | CodeGuardHouse;

/**
 * Agent status in the council
 */
export type AgentStatus =
  | 'idle'       // Waiting for work
  | 'working'    // Processing a task
  | 'waiting'    // Waiting for approval or dependency
  | 'error'      // In error state
  | 'disabled';  // Manually disabled

// ═══════════════════════════════════════════════════════════════════
// AGENT INTERFACE
// ═══════════════════════════════════════════════════════════════════

/**
 * Core agent interface - all house agents implement this
 */
export interface Agent {
  /** Unique agent identifier */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Which house this agent belongs to */
  readonly house: HouseType;

  /** Capabilities this agent provides */
  readonly capabilities: string[];

  /** Current status */
  status: AgentStatus;

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  /** Initialize the agent */
  initialize(): Promise<void>;

  /** Graceful shutdown */
  shutdown(): Promise<void>;

  /** Health check */
  healthCheck(): Promise<AgentHealth>;

  // ─────────────────────────────────────────────────────────────────
  // MESSAGING
  // ─────────────────────────────────────────────────────────────────

  /** Handle an incoming message */
  handleMessage(message: AgentMessage): Promise<AgentResponse>;

  /** Subscribe to a topic */
  subscribe(topic: string): void;

  /** Unsubscribe from a topic */
  unsubscribe(topic: string): void;

  /** Publish to a topic */
  publish(topic: string, payload: unknown): void;

  // ─────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────

  /** Get agent's current state */
  getState(): AgentState;

  /** Update agent's state */
  setState(state: Partial<AgentState>): void;

  /** Get a specific state key */
  getStateKey<T>(key: string): T | undefined;

  /** Set a specific state key */
  setStateKey<T>(key: string, value: T): void;
}

/**
 * Agent health information
 */
export interface AgentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastActive: number;
  tasksCompleted: number;
  tasksFailed: number;
  errorMessage?: string;
}

/**
 * Agent state (persisted to SQLite)
 */
export interface AgentState {
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════
// MESSAGING TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Message sent to an agent
 */
export interface AgentMessage {
  /** Unique message ID */
  id: string;

  /** Message type - determines handler */
  type: string;

  /** Sender agent ID (or 'system' / 'user') */
  from: string;

  /** Target agent ID */
  to: string;

  /** Message payload */
  payload: unknown;

  /** Correlation ID for request/response */
  correlationId?: string;

  /** When the message was created */
  timestamp: number;

  /** Priority (higher = more urgent) */
  priority?: number;

  /** Project context if applicable */
  projectId?: string;
}

/**
 * Response from an agent
 */
export interface AgentResponse {
  /** Original message ID */
  messageId: string;

  /** Whether the operation succeeded */
  success: boolean;

  /** Response data */
  data?: unknown;

  /** Error message if failed */
  error?: string;

  /** Processing time in ms */
  processingTimeMs: number;

  /** Proposal if action requires approval */
  proposal?: Proposal;
}

/**
 * Bus message for pub/sub
 */
export interface BusMessage {
  /** Topic the message was published to */
  topic: string;

  /** Publisher agent ID */
  publisher: string;

  /** Message payload */
  payload: unknown;

  /** When published */
  timestamp: number;

  /** Project context if applicable */
  projectId?: string;
}

// ═══════════════════════════════════════════════════════════════════
// TASK TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Task status
 */
export type TaskStatus =
  | 'pending'     // In queue, not yet assigned
  | 'assigned'    // Assigned to an agent
  | 'running'     // Currently being executed
  | 'completed'   // Successfully completed
  | 'failed'      // Failed with error
  | 'cancelled'   // Cancelled before completion
  | 'blocked';    // Waiting for dependency or approval

/**
 * A task for an agent to execute
 */
export interface AgentTask {
  /** Unique task ID */
  id: string;

  /** Task type - determines which agent handles it */
  type: string;

  /** Target agent ID (or capability for routing) */
  targetAgent?: string;

  /** Target capability for routing */
  targetCapability?: string;

  /** Task payload */
  payload: unknown;

  /** Priority (higher = more urgent) */
  priority: number;

  /** Project context */
  projectId?: string;

  /** Dependencies - task IDs that must complete first */
  dependencies?: string[];

  /** Whether this task requires approval before execution */
  requiresApproval?: boolean;

  /** Timeout in ms */
  timeout?: number;

  /** Metadata */
  metadata?: Record<string, unknown>;

  // Runtime fields
  status?: TaskStatus;
  assignedTo?: string;
  createdAt?: number;
  startedAt?: number;
  completedAt?: number;
  result?: TaskResult;
  error?: string;
}

/**
 * Result of a completed task
 */
export interface TaskResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metrics?: {
    processingTimeMs: number;
    tokensUsed?: number;
    cost?: number;
  };
}

// ═══════════════════════════════════════════════════════════════════
// PROPOSAL TYPES (Semi-Autonomous Behavior)
// ═══════════════════════════════════════════════════════════════════

/**
 * Proposal status
 */
export type ProposalStatus =
  | 'pending'    // Awaiting decision
  | 'approved'   // User approved
  | 'rejected'   // User rejected
  | 'expired'    // Timed out without decision
  | 'auto';      // Auto-approved based on rules

/**
 * A proposed action that may require user approval
 */
export interface Proposal {
  /** Unique proposal ID */
  id: string;

  /** Agent proposing the action */
  agentId: string;

  /** Type of action being proposed */
  actionType: string;

  /** Description for the user */
  title: string;
  description?: string;

  /** The action payload */
  payload: unknown;

  /** Whether this requires explicit approval */
  requiresApproval: boolean;

  /** How urgent this decision is */
  urgency: 'low' | 'normal' | 'high' | 'critical';

  /** Project context */
  projectId?: string;

  /** Current status */
  status: ProposalStatus;

  /** When created */
  createdAt: number;

  /** When decided (if decided) */
  decidedAt?: number;

  /** Who decided ('user' or 'auto') */
  decidedBy?: 'user' | 'auto';

  /** Reason for decision */
  decisionReason?: string;

  /** Expiration time (ms since epoch) */
  expiresAt?: number;
}

// ═══════════════════════════════════════════════════════════════════
// SIGNOFF TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Signoff strictness levels (per AGENT.md)
 */
export type SignoffLevel =
  | 'none'       // No signoff needed
  | 'advisory'   // Suggestions only, user decides
  | 'required'   // Must review before merge
  | 'blocking';  // Must approve all changes

/**
 * Vote on a signoff request
 */
export type SignoffVote =
  | 'approve'
  | 'reject'
  | 'abstain'
  | 'pending';

/**
 * Signoff request status
 */
export type SignoffStatus =
  | 'pending'    // Awaiting votes
  | 'approved'   // All required approvals received
  | 'rejected'   // One or more blocking rejections
  | 'expired';   // Timed out

/**
 * A request for agent signoff on a change
 */
export interface SignoffRequest {
  /** Unique request ID */
  id: string;

  /** Type of change being reviewed */
  changeType: string;

  /** ID of the thing being changed */
  changeId?: string;

  /** Project context */
  projectId: string;

  /** Agents required to review */
  requiredAgents: string[];

  /** Current votes */
  votes: Record<string, SignoffVote>;

  /** Strictness level for this request */
  strictness: SignoffLevel;

  /** Current status */
  status: SignoffStatus;

  /** When created */
  createdAt: number;

  /** When resolved */
  resolvedAt?: number;

  /** Change payload for review */
  payload?: unknown;
}

// ═══════════════════════════════════════════════════════════════════
// PROJECT TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Project phases
 */
export type ProjectPhase =
  | 'planning'     // Defining threads, persona, style
  | 'harvesting'   // Searching archive for passages
  | 'curating'     // Reviewing and organizing passages
  | 'drafting'     // Writing chapters
  | 'mastering'    // Final polish and review
  | 'complete';    // Published

/**
 * Project event types
 */
export type ProjectEventType =
  | 'created'
  | 'phase-changed'
  | 'passage-added'
  | 'passage-curated'
  | 'chapter-created'
  | 'chapter-updated'
  | 'chapter-reviewed'
  | 'thread-updated'
  | 'settings-changed'
  | 'completed';

/**
 * Event emitted when project state changes
 */
export interface ProjectEvent {
  type: ProjectEventType;
  projectId: string;
  data: unknown;
  timestamp: number;
  triggeredBy?: string;  // Agent ID or 'user'
}

/**
 * Council configuration for a project
 */
export interface ProjectCouncilConfig {
  /** Project ID this config applies to */
  projectId: string;

  /** Overall signoff strictness */
  signoffStrictness: SignoffLevel;

  /** Per-phase overrides */
  phaseConfig?: Partial<Record<ProjectPhase, SignoffLevel>>;

  /** Which agents are enabled for this project */
  enabledAgents: string[];

  /** Auto-approve settings */
  autoApprove?: {
    passageHarvest?: boolean;
    minorChapterEdits?: boolean;
    pyramidRebuilds?: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Council-level events
 */
export type CouncilEvent =
  // Agent events
  | { type: 'agent:registered'; agent: AgentInfo }
  | { type: 'agent:unregistered'; agentId: string }
  | { type: 'agent:status-changed'; agentId: string; status: AgentStatus }
  // Task events
  | { type: 'task:created'; taskId: string; taskType: string; priority: number }
  | { type: 'task:assigned'; taskId: string; agentId: string }
  | { type: 'task:started'; taskId: string; agentId?: string }
  | { type: 'task:completed'; taskId: string; agentId?: string; result: TaskResult; processingTimeMs?: number }
  | { type: 'task:failed'; taskId: string; agentId?: string; error: string }
  | { type: 'task:cancelled'; taskId: string; reason?: string }
  | { type: 'task:retry'; taskId: string; attempt: number; maxRetries: number; error: string }
  // Proposal events
  | { type: 'proposal:created'; proposal: Proposal }
  | { type: 'proposal:approved'; proposalId: string; agentId: string }
  | { type: 'proposal:rejected'; proposalId: string; agentId: string }
  | { type: 'proposal:auto-approved'; proposalId: string; agentId: string }
  | { type: 'proposal:decided'; proposalId: string; status: ProposalStatus }
  // Signoff events
  | { type: 'signoff:requested'; signoffId: string; changeType: string; projectId: string }
  | { type: 'signoff:voted'; requestId: string; agentId: string; vote: SignoffVote }
  | { type: 'signoff:approved'; signoffId: string; votes: Record<string, SignoffVote> }
  | { type: 'signoff:rejected'; signoffId: string; votes: Record<string, SignoffVote> }
  | { type: 'signoff:resolved'; requestId: string; status: SignoffStatus }
  // Session events
  | { type: 'session:started'; sessionId: string; projectId?: string }
  | { type: 'session:ended'; sessionId: string; summary?: string }
  | { type: 'session:paused'; sessionId: string }
  | { type: 'session:resumed'; sessionId: string }
  // Council lifecycle
  | { type: 'council:initialized' }
  | { type: 'council:shutdown' }
  // Project config
  | { type: 'project:config-updated'; projectId: string; config: unknown }
  | { type: 'project:event'; event: ProjectEvent };

/**
 * Agent registration info
 */
export interface AgentInfo {
  id: string;
  name: string;
  house: HouseType;
  capabilities: string[];
  status: AgentStatus;
}

// ═══════════════════════════════════════════════════════════════════
// TOPICS
// ═══════════════════════════════════════════════════════════════════

/**
 * Standard message bus topics
 */
export const TOPICS = {
  // Agent lifecycle
  AGENT_REGISTERED: 'agent:registered',
  AGENT_UNREGISTERED: 'agent:unregistered',
  AGENT_STATUS: 'agent:status',

  // Tasks
  TASK_CREATED: 'task:created',
  TASK_ASSIGNED: 'task:assigned',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',

  // Proposals
  PROPOSAL_CREATED: 'proposal:created',
  PROPOSAL_DECIDED: 'proposal:decided',

  // Signoffs
  SIGNOFF_REQUESTED: 'signoff:requested',
  SIGNOFF_VOTED: 'signoff:voted',
  SIGNOFF_RESOLVED: 'signoff:resolved',

  // Project events
  PROJECT_CREATED: 'project:created',
  PROJECT_PHASE_CHANGED: 'project:phase-changed',
  PROJECT_UPDATED: 'project:updated',

  // Content events
  PASSAGE_ADDED: 'content:passage-added',
  PASSAGE_CURATED: 'content:passage-curated',
  CHAPTER_CREATED: 'content:chapter-created',
  CHAPTER_UPDATED: 'content:chapter-updated',
} as const;

export type Topic = typeof TOPICS[keyof typeof TOPICS];

// ═══════════════════════════════════════════════════════════════════
// HANDLER TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Message handler function
 */
export type MessageHandler = (message: BusMessage) => void | Promise<void>;

/**
 * Unsubscribe function returned by subscribe
 */
export type Unsubscribe = () => void;

/**
 * Event listener for council events
 */
export type CouncilEventListener = (event: CouncilEvent) => void | Promise<void>;
