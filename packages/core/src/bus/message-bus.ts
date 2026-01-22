/**
 * Agent Message Bus
 *
 * Event-driven communication layer for the Agent Council.
 * Provides pub/sub messaging and request/response patterns.
 */

import type {
  Agent,
  AgentMessage,
  AgentResponse,
  BusMessage,
  MessageHandler,
  Unsubscribe,
  CouncilEvent,
  CouncilEventListener,
} from '../runtime/types.js';

// ═══════════════════════════════════════════════════════════════════
// MESSAGE BUS INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface MessageBus {
  // ─────────────────────────────────────────────────────────────────
  // PUB/SUB
  // ─────────────────────────────────────────────────────────────────

  /**
   * Subscribe to a topic
   */
  subscribe(topic: string, handler: MessageHandler): Unsubscribe;

  /**
   * Subscribe to multiple topics with a pattern (e.g., 'project:*')
   */
  subscribePattern(pattern: string, handler: MessageHandler): Unsubscribe;

  /**
   * Publish a message to a topic
   */
  publish(topic: string, payload: unknown, options?: PublishOptions): void;

  // ─────────────────────────────────────────────────────────────────
  // REQUEST/RESPONSE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Send a message to a specific agent and wait for response
   */
  request(
    targetAgentId: string,
    message: Omit<AgentMessage, 'id' | 'to' | 'timestamp' | 'from'>,
    timeout?: number
  ): Promise<AgentResponse>;

  /**
   * Broadcast a message to all agents and collect responses
   */
  broadcast(
    message: Omit<AgentMessage, 'id' | 'to' | 'timestamp' | 'from'>,
    timeout?: number
  ): Promise<AgentResponse[]>;

  /**
   * Route a message to an agent by capability
   */
  routeToCapability(
    capability: string,
    message: Omit<AgentMessage, 'id' | 'to' | 'timestamp' | 'from'>
  ): Promise<AgentResponse>;

  // ─────────────────────────────────────────────────────────────────
  // AGENT MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Register an agent with the bus
   */
  registerAgent(agent: Agent): void;

  /**
   * Unregister an agent from the bus
   */
  unregisterAgent(agentId: string): void;

  /**
   * Get a registered agent by ID
   */
  getAgent(agentId: string): Agent | undefined;

  /**
   * List all registered agents
   */
  listAgents(): Agent[];

  /**
   * Find agents by capability
   */
  findByCapability(capability: string): Agent[];

  // ─────────────────────────────────────────────────────────────────
  // EVENTS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add a council event listener
   */
  onEvent(listener: CouncilEventListener): Unsubscribe;

  /**
   * Emit a council event
   */
  emitEvent(event: CouncilEvent): void;
}

export interface PublishOptions {
  projectId?: string;
  priority?: number;
}

// ═══════════════════════════════════════════════════════════════════
// MESSAGE BUS IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

/**
 * In-memory message bus implementation
 */
export class InMemoryMessageBus implements MessageBus {
  private agents: Map<string, Agent> = new Map();
  private subscribers: Map<string, Set<MessageHandler>> = new Map();
  private patternSubscribers: Map<string, Set<MessageHandler>> = new Map();
  private eventListeners: Set<CouncilEventListener> = new Set();
  private pendingRequests: Map<string, {
    resolve: (response: AgentResponse) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = new Map();

  private publisherId = 'message-bus';

  // ─────────────────────────────────────────────────────────────────
  // PUB/SUB
  // ─────────────────────────────────────────────────────────────────

  subscribe(topic: string, handler: MessageHandler): Unsubscribe {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }
    this.subscribers.get(topic)!.add(handler);

    return () => {
      this.subscribers.get(topic)?.delete(handler);
    };
  }

  subscribePattern(pattern: string, handler: MessageHandler): Unsubscribe {
    if (!this.patternSubscribers.has(pattern)) {
      this.patternSubscribers.set(pattern, new Set());
    }
    this.patternSubscribers.get(pattern)!.add(handler);

    return () => {
      this.patternSubscribers.get(pattern)?.delete(handler);
    };
  }

  publish(topic: string, payload: unknown, options?: PublishOptions): void {
    const message: BusMessage = {
      topic,
      publisher: this.publisherId,
      payload,
      timestamp: Date.now(),
      projectId: options?.projectId,
    };

    // Direct topic subscribers
    const handlers = this.subscribers.get(topic);
    if (handlers) {
      Array.from(handlers).forEach(handler => {
        this.safeCall(handler, message);
      });
    }

    // Pattern subscribers
    Array.from(this.patternSubscribers.entries()).forEach(([pattern, patternHandlers]) => {
      if (this.matchPattern(topic, pattern)) {
        Array.from(patternHandlers).forEach(handler => {
          this.safeCall(handler, message);
        });
      }
    });
  }

  private matchPattern(topic: string, pattern: string): boolean {
    // Simple wildcard matching: 'project:*' matches 'project:created'
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return topic.startsWith(prefix);
    }
    return topic === pattern;
  }

  private async safeCall(handler: MessageHandler, message: BusMessage): Promise<void> {
    try {
      await handler(message);
    } catch (error) {
      console.error('[MessageBus] Handler error:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // REQUEST/RESPONSE
  // ─────────────────────────────────────────────────────────────────

  async request(
    targetAgentId: string,
    message: Omit<AgentMessage, 'id' | 'to' | 'timestamp' | 'from'>,
    timeout = 30000
  ): Promise<AgentResponse> {
    const agent = this.agents.get(targetAgentId);
    if (!agent) {
      throw new Error(`Agent not found: ${targetAgentId}`);
    }

    const messageId = this.generateId();
    const fullMessage: AgentMessage = {
      ...message,
      id: messageId,
      from: this.publisherId,
      to: targetAgentId,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new Error(`Request to ${targetAgentId} timed out after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(messageId, {
        resolve: (response) => {
          clearTimeout(timeoutHandle);
          this.pendingRequests.delete(messageId);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeoutHandle);
          this.pendingRequests.delete(messageId);
          reject(error);
        },
        timeout: timeoutHandle,
      });

      // Send to agent
      agent.handleMessage(fullMessage)
        .then(response => {
          const pending = this.pendingRequests.get(messageId);
          if (pending) {
            pending.resolve(response);
          }
        })
        .catch(error => {
          const pending = this.pendingRequests.get(messageId);
          if (pending) {
            pending.reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
    });
  }

  async broadcast(
    message: Omit<AgentMessage, 'id' | 'to' | 'timestamp' | 'from'>,
    timeout = 30000
  ): Promise<AgentResponse[]> {
    const promises = Array.from(this.agents.keys()).map(agentId =>
      this.request(agentId, message, timeout).catch(error => ({
        messageId: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTimeMs: 0,
      } as AgentResponse))
    );

    return Promise.all(promises);
  }

  async routeToCapability(
    capability: string,
    message: Omit<AgentMessage, 'id' | 'to' | 'timestamp' | 'from'>
  ): Promise<AgentResponse> {
    const agents = this.findByCapability(capability);
    if (agents.length === 0) {
      throw new Error(`No agent found with capability: ${capability}`);
    }

    // Route to first available agent with the capability
    // (Could be smarter - load balancing, priority, etc.)
    const agent = agents.find(a => a.status === 'idle') || agents[0];
    return this.request(agent.id, message);
  }

  // ─────────────────────────────────────────────────────────────────
  // AGENT MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  registerAgent(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      console.warn(`[MessageBus] Agent ${agent.id} already registered, replacing`);
    }
    this.agents.set(agent.id, agent);

    this.emitEvent({
      type: 'agent:registered',
      agent: {
        id: agent.id,
        name: agent.name,
        house: agent.house,
        capabilities: agent.capabilities,
        status: agent.status,
      },
    });
  }

  unregisterAgent(agentId: string): void {
    if (this.agents.has(agentId)) {
      this.agents.delete(agentId);
      this.emitEvent({
        type: 'agent:unregistered',
        agentId,
      });
    }
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  findByCapability(capability: string): Agent[] {
    return Array.from(this.agents.values()).filter(agent =>
      agent.capabilities.includes(capability)
    );
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
    Array.from(this.eventListeners).forEach(listener => {
      try {
        const result = listener(event);
        if (result instanceof Promise) {
          result.catch(error => {
            console.error('[MessageBus] Event listener error:', error);
          });
        }
      } catch (error) {
        console.error('[MessageBus] Event listener error:', error);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Set the publisher ID (used for messages from this bus)
   */
  setPublisherId(id: string): void {
    this.publisherId = id;
  }

  /**
   * Get statistics about the bus
   */
  getStats(): BusStats {
    return {
      agentCount: this.agents.size,
      topicCount: this.subscribers.size,
      patternCount: this.patternSubscribers.size,
      pendingRequestCount: this.pendingRequests.size,
      eventListenerCount: this.eventListeners.size,
    };
  }
}

export interface BusStats {
  agentCount: number;
  topicCount: number;
  patternCount: number;
  pendingRequestCount: number;
  eventListenerCount: number;
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _messageBus: MessageBus | null = null;

/**
 * Get the singleton message bus
 */
export function getMessageBus(): MessageBus {
  if (!_messageBus) {
    _messageBus = new InMemoryMessageBus();
  }
  return _messageBus;
}

/**
 * Set a custom message bus (for testing)
 */
export function setMessageBus(bus: MessageBus): void {
  _messageBus = bus;
}

/**
 * Reset the message bus (for testing)
 */
export function resetMessageBus(): void {
  _messageBus = null;
}
