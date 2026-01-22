/**
 * Agent Base Class
 *
 * Abstract base class for all council agents.
 * Provides common functionality for messaging, state, and lifecycle.
 */

import type {
  Agent,
  HouseType,
  AgentStatus,
  AgentMessage,
  AgentResponse,
  AgentState,
  AgentHealth,
  Proposal,
  ProposalStatus,
  BusMessage,
  Unsubscribe,
} from './types.js';
import { getMessageBus, type MessageBus } from '../bus/message-bus.js';

// ═══════════════════════════════════════════════════════════════════
// AGENT BASE CLASS
// ═══════════════════════════════════════════════════════════════════

/**
 * Abstract base class for council agents
 */
export abstract class AgentBase implements Agent {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly house: HouseType;
  abstract readonly capabilities: string[];

  status: AgentStatus = 'idle';

  protected bus: MessageBus;
  protected state: AgentState = {};
  protected subscriptions: Unsubscribe[] = [];
  protected health: AgentHealth = {
    status: 'healthy',
    lastActive: Date.now(),
    tasksCompleted: 0,
    tasksFailed: 0,
  };

  // Pending proposals awaiting user decision
  protected pendingProposals: Map<string, {
    proposal: Proposal;
    resolve: (status: ProposalStatus) => void;
  }> = new Map();

  constructor() {
    this.bus = getMessageBus();
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    console.log(`[${this.name}] Initializing...`);

    // Register with message bus
    this.bus.registerAgent(this);

    // Subscribe to standard topics
    this.subscribeToStandardTopics();

    // Call subclass initialization
    await this.onInitialize();

    this.status = 'idle';
    console.log(`[${this.name}] Initialized`);
  }

  async shutdown(): Promise<void> {
    console.log(`[${this.name}] Shutting down...`);

    // Call subclass cleanup
    await this.onShutdown();

    // Unsubscribe from all topics
    for (const unsubscribe of this.subscriptions) {
      unsubscribe();
    }
    this.subscriptions = [];

    // Unregister from message bus
    this.bus.unregisterAgent(this.id);

    this.status = 'disabled';
    console.log(`[${this.name}] Shutdown complete`);
  }

  async healthCheck(): Promise<AgentHealth> {
    // Update health status based on recent activity
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    if (this.status === 'error') {
      this.health.status = 'unhealthy';
    } else if (now - this.health.lastActive > inactiveThreshold) {
      this.health.status = 'degraded';
    } else {
      this.health.status = 'healthy';
    }

    return { ...this.health };
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGING
  // ─────────────────────────────────────────────────────────────────

  async handleMessage(message: AgentMessage): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      this.status = 'working';
      this.health.lastActive = Date.now();

      // Delegate to subclass
      const result = await this.onMessage(message);

      this.status = 'idle';
      this.health.tasksCompleted++;

      return {
        messageId: message.id,
        success: true,
        data: result,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      this.status = 'error';
      this.health.tasksFailed++;
      this.health.errorMessage = error instanceof Error ? error.message : String(error);

      return {
        messageId: message.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  subscribe(topic: string): void {
    const unsubscribe = this.bus.subscribe(topic, (message) => {
      this.onBusMessage(message);
    });
    this.subscriptions.push(unsubscribe);
  }

  unsubscribe(topic: string): void {
    // Note: This is a simplified implementation
    // In a real system, we'd track which unsubscribe belongs to which topic
    console.warn(`[${this.name}] unsubscribe(${topic}) - not fully implemented`);
  }

  publish(topic: string, payload: unknown): void {
    this.bus.publish(topic, payload, {
      projectId: this.getCurrentProjectId(),
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────

  getState(): AgentState {
    return { ...this.state };
  }

  setState(state: Partial<AgentState>): void {
    this.state = { ...this.state, ...state };
    this.onStateChanged();
  }

  getStateKey<T>(key: string): T | undefined {
    return this.state[key] as T | undefined;
  }

  setStateKey<T>(key: string, value: T): void {
    this.state[key] = value;
    this.onStateChanged();
  }

  // ─────────────────────────────────────────────────────────────────
  // PROPOSALS (Semi-Autonomous Behavior)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Propose an action that may require user approval
   */
  protected async proposeAction(
    actionType: string,
    title: string,
    description: string,
    payload: unknown,
    options?: {
      requiresApproval?: boolean;
      urgency?: Proposal['urgency'];
      projectId?: string;
      expiresIn?: number;
    }
  ): Promise<ProposalStatus> {
    const proposal: Proposal = {
      id: this.generateId('proposal'),
      agentId: this.id,
      actionType,
      title,
      description,
      payload,
      requiresApproval: options?.requiresApproval ?? true,
      urgency: options?.urgency ?? 'normal',
      projectId: options?.projectId,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: options?.expiresIn ? Date.now() + options.expiresIn : undefined,
    };

    // If no approval needed, auto-approve
    if (!proposal.requiresApproval) {
      proposal.status = 'auto';
      proposal.decidedAt = Date.now();
      proposal.decidedBy = 'auto';
      return 'auto';
    }

    // Emit proposal event
    this.bus.emitEvent({
      type: 'proposal:created',
      proposal,
    });

    this.publish('proposal:created', proposal);

    // Wait for decision
    return new Promise((resolve) => {
      this.pendingProposals.set(proposal.id, { proposal, resolve });

      // Set expiration timeout if specified
      if (proposal.expiresAt) {
        const timeout = proposal.expiresAt - Date.now();
        setTimeout(() => {
          const pending = this.pendingProposals.get(proposal.id);
          if (pending && pending.proposal.status === 'pending') {
            pending.proposal.status = 'expired';
            pending.resolve('expired');
            this.pendingProposals.delete(proposal.id);
          }
        }, timeout);
      }
    });
  }

  /**
   * Handle a proposal decision (called by UI or orchestrator)
   */
  public resolveProposal(proposalId: string, status: 'approved' | 'rejected', reason?: string): void {
    const pending = this.pendingProposals.get(proposalId);
    if (!pending) {
      console.warn(`[${this.name}] Unknown proposal: ${proposalId}`);
      return;
    }

    pending.proposal.status = status;
    pending.proposal.decidedAt = Date.now();
    pending.proposal.decidedBy = 'user';
    pending.proposal.decisionReason = reason;

    pending.resolve(status);
    this.pendingProposals.delete(proposalId);

    this.bus.emitEvent({
      type: 'proposal:decided',
      proposalId,
      status,
    });
  }

  /**
   * Get all pending proposals
   */
  public getPendingProposals(): Proposal[] {
    return Array.from(this.pendingProposals.values()).map(p => p.proposal);
  }

  // ─────────────────────────────────────────────────────────────────
  // PROTECTED METHODS (For Subclasses)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Called during initialization - override in subclass
   */
  protected async onInitialize(): Promise<void> {
    // Override in subclass
  }

  /**
   * Called during shutdown - override in subclass
   */
  protected async onShutdown(): Promise<void> {
    // Override in subclass
  }

  /**
   * Handle an incoming message - override in subclass
   */
  protected abstract onMessage(message: AgentMessage): Promise<unknown>;

  /**
   * Handle a bus message (pub/sub) - override in subclass
   */
  protected onBusMessage(_message: BusMessage): void {
    // Override in subclass if needed
  }

  /**
   * Called when state changes - override in subclass
   */
  protected onStateChanged(): void {
    // Override in subclass if needed
  }

  /**
   * Subscribe to standard topics all agents should listen to
   */
  protected subscribeToStandardTopics(): void {
    // Subscribe to project events
    this.subscribe('project:*');
  }

  /**
   * Get the current project ID from state
   */
  protected getCurrentProjectId(): string | undefined {
    return this.getStateKey<string>('currentProjectId');
  }

  /**
   * Set the current project context
   */
  protected setCurrentProject(projectId: string): void {
    this.setStateKey('currentProjectId', projectId);
  }

  /**
   * Request another agent to perform work
   */
  protected async requestAgent(
    targetAgentId: string,
    type: string,
    payload: unknown
  ): Promise<AgentResponse> {
    return this.bus.request(targetAgentId, {
      type,
      payload,
    });
  }

  /**
   * Request an agent by capability
   */
  protected async requestCapability(
    capability: string,
    type: string,
    payload: unknown
  ): Promise<AgentResponse> {
    return this.bus.routeToCapability(capability, {
      type,
      payload,
    });
  }

  /**
   * Generate a unique ID
   */
  protected generateId(prefix: string = 'id'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Log with agent context
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    const prefix = `[${this.name}]`;
    switch (level) {
      case 'debug':
        console.debug(prefix, message, data);
        break;
      case 'info':
        console.log(prefix, message, data);
        break;
      case 'warn':
        console.warn(prefix, message, data);
        break;
      case 'error':
        console.error(prefix, message, data);
        break;
    }
  }
}
