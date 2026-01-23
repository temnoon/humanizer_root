/**
 * Council Orchestrator
 *
 * The coordination layer for the Agent Council.
 * Manages sessions, task routing, signoff workflows, and consensus.
 */

import type {
  Agent,
  AgentTask,
  Proposal,
  ProposalStatus,
  CouncilEvent,
  CouncilEventListener,
  Unsubscribe,
  ProjectCouncilConfig,
  TaskResult,
} from '../runtime/types.js';
import { getAgentRegistry } from '../runtime/registry.js';
import { getMessageBus } from '../bus/message-bus.js';
import { getTaskQueue, type QueuedTask, type TaskQueueStats } from '../tasks/queue.js';
import {
  getAgentStore,
  type StoredSession,
  type StoredSignoff,
  type StoredProjectCouncilConfig,
} from '../state/store.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface CouncilSession {
  id: string;
  projectId?: string;
  status: 'active' | 'paused' | 'completed';
  startedAt: number;
  endedAt?: number;
  summary?: string;
  taskCount: number;
  completedCount: number;
  failedCount: number;
}

export interface SignoffRequestParams {
  changeType: string;
  changeId?: string;
  title: string;
  description?: string;
  payload?: unknown;
  projectId: string;
  strictness?: 'none' | 'advisory' | 'required' | 'blocking';
}

export interface SignoffResult {
  id: string;
  status: 'approved' | 'rejected' | 'pending';
  votes: Record<string, 'approve' | 'reject' | 'abstain'>;
  requiredApprovals: number;
  currentApprovals: number;
  blockers: string[];
}

export interface CouncilProposedAction {
  type: string;
  title: string;
  description?: string;
  payload?: unknown;
  projectId?: string;
  requiresApproval: boolean;
  urgency?: 'low' | 'normal' | 'high' | 'critical';
}

export interface OrchestratorConfig {
  defaultSignoffStrictness: 'none' | 'advisory' | 'required' | 'blocking';
  proposalExpirationMs: number;
  signoffExpirationMs: number;
  autoStartProcessor: boolean;
}

export interface TaskOptions {
  priority?: number;
  timeoutMs?: number;
  maxRetries?: number;
  dependsOn?: string[];
  sessionId?: string;
}

export interface OrchestratorStats {
  activeSessions: number;
  totalSessions: number;
  pendingProposals: number;
  pendingSignoffs: number;
  taskStats: TaskQueueStats;
  registeredAgents: number;
  activeAgents: number;
}

// ═══════════════════════════════════════════════════════════════════
// ORCHESTRATOR INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface CouncilOrchestrator {
  // Session Management
  startSession(projectId?: string): Promise<CouncilSession>;
  endSession(sessionId: string, summary?: string): Promise<void>;
  pauseSession(sessionId: string): Promise<void>;
  resumeSession(sessionId: string): Promise<void>;
  getSession(sessionId: string): CouncilSession | undefined;
  getActiveSession(projectId?: string): CouncilSession | undefined;

  // Task Routing
  assignTask(task: Omit<AgentTask, 'id'>, options?: TaskOptions): Promise<string>;
  getTaskStatus(taskId: string): QueuedTask | undefined;
  cancelTask(taskId: string, reason?: string): Promise<void>;
  getTaskStats(): TaskQueueStats;

  // Signoff Workflow
  requestSignoff(request: SignoffRequestParams): Promise<SignoffResult>;
  submitVote(signoffId: string, agentId: string, vote: 'approve' | 'reject' | 'abstain', reason?: string): Promise<void>;
  getSignoffStatus(signoffId: string): SignoffResult | undefined;
  getPendingSignoffs(projectId?: string): StoredSignoff[];

  // Proposals
  submitProposal(agentId: string, action: CouncilProposedAction): Promise<string>;
  approveProposal(proposalId: string, decidedBy?: string): Promise<void>;
  rejectProposal(proposalId: string, decidedBy?: string): Promise<void>;
  getPendingProposals(projectId?: string): Proposal[];

  // Project Config
  getProjectConfig(projectId: string): ProjectCouncilConfig | undefined;
  setProjectConfig(config: Omit<ProjectCouncilConfig, 'createdAt' | 'updatedAt'>): void;

  // Event System
  onEvent(listener: CouncilEventListener): Unsubscribe;
  emitEvent(event: CouncilEvent): void;

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // Stats
  getStats(): OrchestratorStats;
}

// ═══════════════════════════════════════════════════════════════════
// IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class DefaultCouncilOrchestrator implements CouncilOrchestrator {
  private config: OrchestratorConfig;
  private initialized = false;
  private eventListeners: Set<CouncilEventListener> = new Set();

  private registry = getAgentRegistry();
  private bus = getMessageBus();
  private queue = getTaskQueue();
  private store = getAgentStore();

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = {
      defaultSignoffStrictness: config?.defaultSignoffStrictness || 'advisory',
      proposalExpirationMs: config?.proposalExpirationMs || 24 * 60 * 60 * 1000, // 24 hours
      signoffExpirationMs: config?.signoffExpirationMs || 7 * 24 * 60 * 60 * 1000, // 7 days
      autoStartProcessor: config?.autoStartProcessor ?? true,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[Orchestrator] Already initialized');
      return;
    }

    console.log('[Orchestrator] Initializing...');

    // Subscribe to events
    this.bus.onEvent((event) => {
      this.handleBusEvent(event);
    });

    // Start task queue processor
    if (this.config.autoStartProcessor) {
      this.queue.startProcessor();
    }

    // Initialize all registered agents
    await this.registry.initializeAll();

    this.initialized = true;
    console.log('[Orchestrator] Initialized');

    this.emitEvent({ type: 'council:initialized' });
  }

  async shutdown(): Promise<void> {
    console.log('[Orchestrator] Shutting down...');

    // Stop task processor
    this.queue.stopProcessor();

    // Shutdown all agents
    await this.registry.shutdownAll();

    this.initialized = false;
    console.log('[Orchestrator] Shutdown complete');

    this.emitEvent({ type: 'council:shutdown' });
  }

  private handleBusEvent(event: CouncilEvent): void {
    // Forward to listeners
    this.emitEvent(event);

    // Handle specific events
    switch (event.type) {
      case 'proposal:created':
        this.handleProposalCreated(event);
        break;
      case 'task:completed':
        this.handleTaskCompleted(event);
        break;
      case 'task:failed':
        this.handleTaskFailed(event);
        break;
    }
  }

  private handleProposalCreated(event: Extract<CouncilEvent, { type: 'proposal:created' }>): void {
    // Log proposal creation
    this.store.log({
      agentId: event.proposal.agentId,
      eventType: 'proposal',
      projectId: event.proposal.projectId,
      message: `Proposal created: ${event.proposal.title}`,
      metadata: { proposalId: event.proposal.id },
    });
  }

  private handleTaskCompleted(_event: Extract<CouncilEvent, { type: 'task:completed' }>): void {
    // Update session stats if task was part of a session
    // This would require tracking task-session association
  }

  private handleTaskFailed(event: Extract<CouncilEvent, { type: 'task:failed' }>): void {
    // Log task failure
    console.error(`[Orchestrator] Task failed: ${event.taskId}`, event.error);
  }

  // ─────────────────────────────────────────────────────────────────
  // SESSION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  async startSession(projectId?: string): Promise<CouncilSession> {
    // Check for existing active session
    const existing = this.store.getActiveSession(projectId);
    if (existing) {
      console.warn(`[Orchestrator] Active session already exists for project ${projectId}`);
      return this.storedToSession(existing);
    }

    const session = this.store.createSession(projectId);

    this.emitEvent({
      type: 'session:started',
      sessionId: session.id,
      projectId,
    });

    console.log(`[Orchestrator] Started session ${session.id}${projectId ? ` for project ${projectId}` : ''}`);

    return this.storedToSession(session);
  }

  async endSession(sessionId: string, summary?: string): Promise<void> {
    this.store.endSession(sessionId, summary);

    // Calculate session stats
    const tasks = this.store.getSessionTasks(sessionId);
    const completed = tasks.filter(t => t.status === 'completed').length;
    const failed = tasks.filter(t => t.status === 'failed').length;

    this.store.updateSession(sessionId, {
      stats: {
        taskCount: tasks.length,
        completedCount: completed,
        failedCount: failed,
      },
    });

    this.emitEvent({
      type: 'session:ended',
      sessionId,
      summary,
    });

    console.log(`[Orchestrator] Ended session ${sessionId}`);
  }

  async pauseSession(sessionId: string): Promise<void> {
    this.store.updateSession(sessionId, { status: 'paused' });

    this.emitEvent({
      type: 'session:paused',
      sessionId,
    });
  }

  async resumeSession(sessionId: string): Promise<void> {
    this.store.updateSession(sessionId, { status: 'active' });

    this.emitEvent({
      type: 'session:resumed',
      sessionId,
    });
  }

  getSession(sessionId: string): CouncilSession | undefined {
    const stored = this.store.getSession(sessionId);
    return stored ? this.storedToSession(stored) : undefined;
  }

  getActiveSession(projectId?: string): CouncilSession | undefined {
    const stored = this.store.getActiveSession(projectId);
    return stored ? this.storedToSession(stored) : undefined;
  }

  private storedToSession(stored: StoredSession): CouncilSession {
    const tasks = this.store.getSessionTasks(stored.id);
    const completed = tasks.filter(t => t.status === 'completed').length;
    const failed = tasks.filter(t => t.status === 'failed').length;

    return {
      id: stored.id,
      projectId: stored.projectId,
      status: stored.status,
      startedAt: stored.startedAt,
      endedAt: stored.endedAt,
      summary: stored.summary,
      taskCount: tasks.length,
      completedCount: completed,
      failedCount: failed,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // TASK ROUTING
  // ─────────────────────────────────────────────────────────────────

  async assignTask(task: Omit<AgentTask, 'id'>, options?: TaskOptions): Promise<string> {
    const taskId = await this.queue.enqueue(task, {
      priority: options?.priority,
      timeoutMs: options?.timeoutMs,
      maxRetries: options?.maxRetries,
      dependsOn: options?.dependsOn,
      projectId: task.projectId,
    });

    // Associate with session if provided
    if (options?.sessionId) {
      this.store.addTaskToSession(options.sessionId, taskId);
    } else {
      // Try to find active session for project
      const session = task.projectId ? this.store.getActiveSession(task.projectId) : undefined;
      if (session) {
        this.store.addTaskToSession(session.id, taskId);
      }
    }

    return taskId;
  }

  getTaskStatus(taskId: string): QueuedTask | undefined {
    return this.queue.get(taskId);
  }

  async cancelTask(taskId: string, reason?: string): Promise<void> {
    await this.queue.cancel(taskId, reason);
  }

  getTaskStats(): TaskQueueStats {
    return this.queue.getStats();
  }

  // ─────────────────────────────────────────────────────────────────
  // SIGNOFF WORKFLOW
  // ─────────────────────────────────────────────────────────────────

  async requestSignoff(request: SignoffRequestParams): Promise<SignoffResult> {
    // Get project config for strictness
    const projectConfig = this.store.getProjectConfig(request.projectId);
    const strictness = request.strictness ||
      projectConfig?.signoffStrictness ||
      this.config.defaultSignoffStrictness;

    // Determine required agents based on change type
    const requiredAgents = this.determineRequiredAgents(request.changeType, projectConfig);

    const signoff = this.store.createSignoff({
      id: this.generateId('signoff'),
      projectId: request.projectId,
      changeType: request.changeType,
      changeId: request.changeId,
      title: request.title,
      description: request.description,
      payload: request.payload,
      requiredAgents,
      votes: {},
      status: 'pending',
      strictness,
    });

    // Request votes from agents
    for (let i = 0; i < requiredAgents.length; i++) {
      const agentId = requiredAgents[i];
      try {
        await this.bus.request(agentId, {
          type: 'review-signoff',
          payload: {
            signoffId: signoff.id,
            changeType: request.changeType,
            changeId: request.changeId,
            title: request.title,
            description: request.description,
            payload: request.payload,
          },
        }, 30000);
      } catch (error) {
        console.warn(`[Orchestrator] Failed to request vote from ${agentId}:`, error);
      }
    }

    this.emitEvent({
      type: 'signoff:requested',
      signoffId: signoff.id,
      changeType: request.changeType,
      projectId: request.projectId,
    });

    return this.buildSignoffResult(signoff);
  }

  async submitVote(
    signoffId: string,
    agentId: string,
    vote: 'approve' | 'reject' | 'abstain',
    _reason?: string
  ): Promise<void> {
    this.store.recordVote(signoffId, agentId, vote);

    const signoff = this.store.getSignoff(signoffId);
    if (!signoff) return;

    // Check if signoff is resolved
    const result = this.buildSignoffResult(signoff);

    if (result.status !== 'pending') {
      this.store.updateSignoff(signoffId, {
        status: result.status,
        resolvedAt: Date.now(),
        resolvedBy: 'council',
      });

      this.emitEvent({
        type: result.status === 'approved' ? 'signoff:approved' : 'signoff:rejected',
        signoffId,
        votes: result.votes,
      });
    }
  }

  getSignoffStatus(signoffId: string): SignoffResult | undefined {
    const signoff = this.store.getSignoff(signoffId);
    return signoff ? this.buildSignoffResult(signoff) : undefined;
  }

  getPendingSignoffs(projectId?: string): StoredSignoff[] {
    return this.store.listSignoffs({
      status: 'pending',
      projectId,
    });
  }

  private determineRequiredAgents(changeType: string, config?: StoredProjectCouncilConfig): string[] {
    // Map change types to reviewing agents
    const reviewerMap: Record<string, string[]> = {
      'chapter-draft': ['reviewer', 'curator'],
      'passage-harvest': ['curator'],
      'style-change': ['reviewer'],
      'pyramid-rebuild': ['builder'],
      'content-delete': ['reviewer', 'curator'],
      'phase-advance': ['project-manager', 'reviewer'],
    };

    let agents = reviewerMap[changeType] || ['reviewer'];

    // Filter by enabled agents in project config
    if (config?.enabledAgents) {
      agents = agents.filter(a => config.enabledAgents.includes(a));
    }

    return agents;
  }

  private buildSignoffResult(signoff: StoredSignoff): SignoffResult {
    const requiredApprovals = signoff.strictness === 'blocking'
      ? signoff.requiredAgents.length
      : Math.ceil(signoff.requiredAgents.length / 2);

    const votes = signoff.votes;
    const approvals = Object.values(votes).filter(v => v === 'approve').length;
    const rejections = Object.values(votes).filter(v => v === 'reject').length;
    const blockers = Object.entries(votes)
      .filter(([, v]) => v === 'reject')
      .map(([agentId]) => agentId);

    let status: 'approved' | 'rejected' | 'pending' = 'pending';

    if (signoff.strictness === 'blocking') {
      // All must approve, any rejection blocks
      if (rejections > 0) {
        status = 'rejected';
      } else if (approvals >= requiredApprovals) {
        status = 'approved';
      }
    } else if (signoff.strictness === 'required') {
      // Majority must approve
      if (approvals >= requiredApprovals) {
        status = 'approved';
      } else if (rejections > signoff.requiredAgents.length - requiredApprovals) {
        status = 'rejected';
      }
    } else {
      // Advisory - auto-approve after all votes received
      if (Object.keys(votes).length >= signoff.requiredAgents.length) {
        status = approvals >= rejections ? 'approved' : 'rejected';
      }
    }

    return {
      id: signoff.id,
      status,
      votes,
      requiredApprovals,
      currentApprovals: approvals,
      blockers,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PROPOSALS
  // ─────────────────────────────────────────────────────────────────

  async submitProposal(agentId: string, action: CouncilProposedAction): Promise<string> {
    const proposal = this.store.createProposal({
      id: this.generateId('proposal'),
      agentId,
      projectId: action.projectId,
      actionType: action.type,
      title: action.title,
      description: action.description,
      payload: action.payload,
      status: action.requiresApproval ? 'pending' : 'auto',
      requiresApproval: action.requiresApproval,
      urgency: action.urgency || 'normal',
      expiresAt: Date.now() + this.config.proposalExpirationMs,
    });

    this.emitEvent({
      type: 'proposal:created',
      proposal: {
        id: proposal.id,
        agentId,
        actionType: action.type,
        title: action.title,
        description: action.description,
        payload: action.payload,
        projectId: action.projectId,
        status: proposal.status,
        requiresApproval: action.requiresApproval,
        urgency: action.urgency || 'normal',
        createdAt: proposal.createdAt,
        expiresAt: proposal.expiresAt,
      },
    });

    // If auto-approved, notify agent
    if (!action.requiresApproval) {
      this.bus.publish('proposal:auto-approved', {
        proposalId: proposal.id,
        agentId,
      });
    }

    return proposal.id;
  }

  async approveProposal(proposalId: string, decidedBy?: string): Promise<void> {
    const proposal = this.store.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    this.store.updateProposal(proposalId, {
      status: 'approved',
      decidedAt: Date.now(),
      decidedBy: decidedBy || 'user',
    });

    // Notify the agent
    this.bus.publish('proposal:approved', {
      proposalId,
      agentId: proposal.agentId,
    });

    this.emitEvent({
      type: 'proposal:approved',
      proposalId,
      agentId: proposal.agentId,
    });
  }

  async rejectProposal(proposalId: string, decidedBy?: string): Promise<void> {
    const proposal = this.store.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    this.store.updateProposal(proposalId, {
      status: 'rejected',
      decidedAt: Date.now(),
      decidedBy: decidedBy || 'user',
    });

    // Notify the agent
    this.bus.publish('proposal:rejected', {
      proposalId,
      agentId: proposal.agentId,
    });

    this.emitEvent({
      type: 'proposal:rejected',
      proposalId,
      agentId: proposal.agentId,
    });
  }

  getPendingProposals(projectId?: string): Proposal[] {
    const stored = this.store.listProposals({
      status: 'pending',
      projectId,
    });

    return stored.map(p => ({
      id: p.id,
      agentId: p.agentId,
      actionType: p.actionType,
      title: p.title,
      description: p.description,
      payload: p.payload,
      projectId: p.projectId,
      status: p.status,
      requiresApproval: p.requiresApproval,
      urgency: p.urgency,
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
    }));
  }

  // ─────────────────────────────────────────────────────────────────
  // PROJECT CONFIG
  // ─────────────────────────────────────────────────────────────────

  getProjectConfig(projectId: string): ProjectCouncilConfig | undefined {
    return this.store.getProjectConfig(projectId);
  }

  setProjectConfig(config: Omit<ProjectCouncilConfig, 'createdAt' | 'updatedAt'>): void {
    this.store.saveProjectConfig(config);

    this.emitEvent({
      type: 'project:config-updated',
      projectId: config.projectId,
      config,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // EVENTS
  // ─────────────────────────────────────────────────────────────────

  onEvent(listener: CouncilEventListener): Unsubscribe {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  emitEvent(event: CouncilEvent): void {
    const listeners = Array.from(this.eventListeners);
    for (let i = 0; i < listeners.length; i++) {
      try {
        const result = listeners[i](event);
        if (result instanceof Promise) {
          result.catch(error => {
            console.error('[Orchestrator] Event listener error:', error);
          });
        }
      } catch (error) {
        console.error('[Orchestrator] Event listener error:', error);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────────────────────────

  getStats(): OrchestratorStats {
    const agents = this.registry.list();
    const activeAgents = agents.filter(a => a.status === 'working' || a.status === 'idle').length;

    const storeStats = this.store.getStats();

    return {
      activeSessions: storeStats.sessions.active,
      totalSessions: storeStats.sessions.total,
      pendingProposals: storeStats.proposals.pending,
      pendingSignoffs: storeStats.signoffs.pending,
      taskStats: this.queue.getStats(),
      registeredAgents: agents.length,
      activeAgents,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _orchestrator: CouncilOrchestrator | null = null;

/**
 * Get the singleton council orchestrator
 */
export function getCouncilOrchestrator(): CouncilOrchestrator {
  if (!_orchestrator) {
    _orchestrator = new DefaultCouncilOrchestrator();
  }
  return _orchestrator;
}

/**
 * Set a custom orchestrator (for testing)
 */
export function setCouncilOrchestrator(orchestrator: CouncilOrchestrator): void {
  _orchestrator = orchestrator;
}

/**
 * Reset the orchestrator (for testing)
 */
export function resetCouncilOrchestrator(): void {
  _orchestrator = null;
}
