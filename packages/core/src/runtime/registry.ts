/**
 * Agent Registry
 *
 * Central registry for all council agents.
 * Handles agent discovery, lifecycle, and capability mapping.
 */

import type {
  Agent,
  AgentInfo,
  AgentStatus,
  HouseType,
  AgentHealth,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════
// REGISTRY INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface AgentRegistry {
  /**
   * Register an agent
   */
  register(agent: Agent): Promise<void>;

  /**
   * Unregister an agent
   */
  unregister(agentId: string): Promise<void>;

  /**
   * Get an agent by ID
   */
  get(agentId: string): Agent | undefined;

  /**
   * List all registered agents
   */
  list(): AgentInfo[];

  /**
   * Find agents by house
   */
  findByHouse(house: HouseType): Agent[];

  /**
   * Find agents by capability
   */
  findByCapability(capability: string): Agent[];

  /**
   * Find agents by status
   */
  findByStatus(status: AgentStatus): Agent[];

  /**
   * Get agent health status
   */
  getHealth(agentId: string): Promise<AgentHealth | undefined>;

  /**
   * Get all agent health statuses
   */
  getAllHealth(): Promise<Map<string, AgentHealth>>;

  /**
   * Initialize all agents
   */
  initializeAll(): Promise<void>;

  /**
   * Shutdown all agents
   */
  shutdownAll(): Promise<void>;

  /**
   * Get capability map
   */
  getCapabilityMap(): Map<string, string[]>;

  /**
   * Get statistics
   */
  getStats(): RegistryStats;
}

export interface RegistryStats {
  totalAgents: number;
  capabilityCount: number;
  houseCount: number;
  statusCounts: Record<AgentStatus, number>;
  initialized: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// REGISTRY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class InMemoryAgentRegistry implements AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private capabilityMap: Map<string, Set<string>> = new Map();
  private houseMap: Map<HouseType, Set<string>> = new Map();
  private initialized = false;

  async register(agent: Agent): Promise<void> {
    if (this.agents.has(agent.id)) {
      console.warn(`[AgentRegistry] Agent ${agent.id} already registered`);
      return;
    }

    this.agents.set(agent.id, agent);

    // Update capability map
    for (const capability of agent.capabilities) {
      if (!this.capabilityMap.has(capability)) {
        this.capabilityMap.set(capability, new Set());
      }
      this.capabilityMap.get(capability)!.add(agent.id);
    }

    // Update house map
    if (!this.houseMap.has(agent.house)) {
      this.houseMap.set(agent.house, new Set());
    }
    this.houseMap.get(agent.house)!.add(agent.id);

    console.log(`[AgentRegistry] Registered: ${agent.name} (${agent.id})`);
  }

  async unregister(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    // Remove from capability map
    for (const capability of agent.capabilities) {
      this.capabilityMap.get(capability)?.delete(agentId);
    }

    // Remove from house map
    this.houseMap.get(agent.house)?.delete(agentId);

    this.agents.delete(agentId);
    console.log(`[AgentRegistry] Unregistered: ${agentId}`);
  }

  get(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  list(): AgentInfo[] {
    return Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      name: agent.name,
      house: agent.house,
      capabilities: agent.capabilities,
      status: agent.status,
    }));
  }

  findByHouse(house: HouseType): Agent[] {
    const agentIds = this.houseMap.get(house);
    if (!agentIds) return [];
    return Array.from(agentIds).map(id => this.agents.get(id)!).filter(Boolean);
  }

  findByCapability(capability: string): Agent[] {
    const agentIds = this.capabilityMap.get(capability);
    if (!agentIds) return [];
    return Array.from(agentIds).map(id => this.agents.get(id)!).filter(Boolean);
  }

  findByStatus(status: AgentStatus): Agent[] {
    return Array.from(this.agents.values()).filter(agent => agent.status === status);
  }

  async getHealth(agentId: string): Promise<AgentHealth | undefined> {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;
    return agent.healthCheck();
  }

  async getAllHealth(): Promise<Map<string, AgentHealth>> {
    const healthMap = new Map<string, AgentHealth>();
    const entries = Array.from(this.agents.entries());

    for (let i = 0; i < entries.length; i++) {
      const [id, agent] = entries[i];
      try {
        const health = await agent.healthCheck();
        healthMap.set(id, health);
      } catch (error) {
        healthMap.set(id, {
          status: 'unhealthy',
          lastActive: 0,
          tasksCompleted: 0,
          tasksFailed: 0,
          errorMessage: error instanceof Error ? error.message : 'Health check failed',
        });
      }
    }

    return healthMap;
  }

  async initializeAll(): Promise<void> {
    if (this.initialized) {
      console.warn('[AgentRegistry] Already initialized');
      return;
    }

    console.log(`[AgentRegistry] Initializing ${this.agents.size} agents...`);

    const initPromises = Array.from(this.agents.values()).map(async agent => {
      try {
        await agent.initialize();
      } catch (error) {
        console.error(`[AgentRegistry] Failed to initialize ${agent.id}:`, error);
        agent.status = 'error';
      }
    });

    await Promise.all(initPromises);
    this.initialized = true;
    console.log('[AgentRegistry] All agents initialized');
  }

  async shutdownAll(): Promise<void> {
    console.log(`[AgentRegistry] Shutting down ${this.agents.size} agents...`);

    const shutdownPromises = Array.from(this.agents.values()).map(async agent => {
      try {
        await agent.shutdown();
      } catch (error) {
        console.error(`[AgentRegistry] Failed to shutdown ${agent.id}:`, error);
      }
    });

    await Promise.all(shutdownPromises);
    this.initialized = false;
    console.log('[AgentRegistry] All agents shut down');
  }

  getCapabilityMap(): Map<string, string[]> {
    const result = new Map<string, string[]>();
    const entries = Array.from(this.capabilityMap.entries());
    for (let i = 0; i < entries.length; i++) {
      const [capability, agentIds] = entries[i];
      result.set(capability, Array.from(agentIds));
    }
    return result;
  }

  getStats(): RegistryStats {
    const statusCounts: Record<AgentStatus, number> = {
      idle: 0,
      working: 0,
      waiting: 0,
      error: 0,
      disabled: 0,
    };
    const agentValues = Array.from(this.agents.values());

    for (let i = 0; i < agentValues.length; i++) {
      statusCounts[agentValues[i].status]++;
    }

    return {
      totalAgents: this.agents.size,
      capabilityCount: this.capabilityMap.size,
      houseCount: this.houseMap.size,
      statusCounts,
      initialized: this.initialized,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _registry: AgentRegistry | null = null;

/**
 * Get the singleton agent registry
 */
export function getAgentRegistry(): AgentRegistry {
  if (!_registry) {
    _registry = new InMemoryAgentRegistry();
  }
  return _registry;
}

/**
 * Set a custom registry (for testing)
 */
export function setAgentRegistry(registry: AgentRegistry): void {
  _registry = registry;
}

/**
 * Reset the registry (for testing)
 */
export function resetAgentRegistry(): void {
  _registry = null;
}
