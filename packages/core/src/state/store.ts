/**
 * Agent State Store
 *
 * In-memory state storage for agent council.
 * Handles agents, tasks, proposals, signoffs, and sessions.
 *
 * NOTE: This is an in-memory implementation for portability.
 * A SQLite-backed implementation can be added later for persistence.
 */

import type {
  AgentStatus,
  TaskStatus,
  ProposalStatus,
  HouseType,
} from '../runtime/types.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface StoredAgent {
  id: string;
  house: HouseType;
  name: string;
  status: AgentStatus;
  capabilities: string[];
  config?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface StoredTask {
  id: string;
  type: string;
  agentId?: string;
  projectId?: string;
  payload?: unknown;
  status: TaskStatus;
  priority: number;
  createdAt: number;
  assignedAt?: number;
  startedAt?: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
  retries: number;
  maxRetries: number;
  timeoutMs: number;
}

export interface StoredProposal {
  id: string;
  agentId: string;
  projectId?: string;
  actionType: string;
  title: string;
  description?: string;
  payload?: unknown;
  status: ProposalStatus;
  requiresApproval: boolean;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  createdAt: number;
  decidedAt?: number;
  decidedBy?: string;
  expiresAt?: number;
}

export interface StoredSignoff {
  id: string;
  projectId: string;
  changeType: string;
  changeId?: string;
  title: string;
  description?: string;
  payload?: unknown;
  requiredAgents: string[];
  votes: Record<string, 'approve' | 'reject' | 'abstain'>;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  strictness: 'none' | 'advisory' | 'required' | 'blocking';
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface StoredSession {
  id: string;
  projectId?: string;
  status: 'active' | 'paused' | 'completed';
  startedAt: number;
  endedAt?: number;
  summary?: string;
  stats?: Record<string, unknown>;
}

export interface AgentLogEntry {
  id: number;
  agentId: string;
  eventType: 'info' | 'warn' | 'error' | 'task' | 'proposal';
  projectId?: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface StoredProjectCouncilConfig {
  projectId: string;
  signoffStrictness: 'none' | 'advisory' | 'required' | 'blocking';
  enabledAgents: string[];
  phaseConfig?: Record<string, 'none' | 'advisory' | 'required' | 'blocking'>;
  autoApprove?: {
    passageHarvest?: boolean;
    minorChapterEdits?: boolean;
    pyramidRebuilds?: boolean;
  };
  createdAt: number;
  updatedAt: number;
}

// ═══════════════════════════════════════════════════════════════════
// FILTER TYPES
// ═══════════════════════════════════════════════════════════════════

export interface TaskFilter {
  status?: TaskStatus | TaskStatus[];
  agentId?: string;
  projectId?: string;
  type?: string;
  limit?: number;
}

export interface ProposalFilter {
  status?: ProposalStatus | ProposalStatus[];
  agentId?: string;
  projectId?: string;
  limit?: number;
}

export interface SignoffFilter {
  status?: string | string[];
  projectId?: string;
  strictness?: string;
  limit?: number;
}

export interface LogFilter {
  agentId?: string;
  projectId?: string;
  eventType?: string | string[];
  since?: number;
  limit?: number;
}

export interface StoreStats {
  agents: number;
  tasks: { total: number; pending: number; running: number; completed: number; failed: number };
  proposals: { total: number; pending: number };
  signoffs: { total: number; pending: number };
  sessions: { total: number; active: number };
  logs: number;
}

// ═══════════════════════════════════════════════════════════════════
// STORE INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface AgentStore {
  // Agents
  saveAgent(agent: StoredAgent): void;
  getAgent(id: string): StoredAgent | undefined;
  listAgents(): StoredAgent[];
  updateAgentStatus(id: string, status: AgentStatus): void;
  deleteAgent(id: string): void;

  // Agent State (key-value)
  setState(agentId: string, key: string, value: unknown): void;
  getState<T = unknown>(agentId: string, key: string): T | undefined;
  getAllState(agentId: string): Record<string, unknown>;
  deleteState(agentId: string, key: string): void;

  // Tasks
  createTask(task: Omit<StoredTask, 'createdAt'>): StoredTask;
  getTask(id: string): StoredTask | undefined;
  listTasks(filter?: TaskFilter): StoredTask[];
  updateTask(id: string, updates: Partial<StoredTask>): void;
  deleteTask(id: string): void;
  getNextPendingTask(agentId?: string): StoredTask | undefined;

  // Proposals
  createProposal(proposal: Omit<StoredProposal, 'createdAt'>): StoredProposal;
  getProposal(id: string): StoredProposal | undefined;
  listProposals(filter?: ProposalFilter): StoredProposal[];
  updateProposal(id: string, updates: Partial<StoredProposal>): void;
  deleteProposal(id: string): void;

  // Signoffs
  createSignoff(signoff: Omit<StoredSignoff, 'createdAt'>): StoredSignoff;
  getSignoff(id: string): StoredSignoff | undefined;
  listSignoffs(filter?: SignoffFilter): StoredSignoff[];
  updateSignoff(id: string, updates: Partial<StoredSignoff>): void;
  recordVote(signoffId: string, agentId: string, vote: 'approve' | 'reject' | 'abstain'): void;

  // Sessions
  createSession(projectId?: string): StoredSession;
  getSession(id: string): StoredSession | undefined;
  getActiveSession(projectId?: string): StoredSession | undefined;
  updateSession(id: string, updates: Partial<StoredSession>): void;
  endSession(id: string, summary?: string): void;
  addTaskToSession(sessionId: string, taskId: string): void;
  getSessionTasks(sessionId: string): StoredTask[];

  // Logging
  log(entry: Omit<AgentLogEntry, 'id' | 'createdAt'>): void;
  getLogs(filter?: LogFilter): AgentLogEntry[];

  // Project Config
  getProjectConfig(projectId: string): StoredProjectCouncilConfig | undefined;
  saveProjectConfig(config: Omit<StoredProjectCouncilConfig, 'createdAt' | 'updatedAt'>): void;

  // Maintenance
  getStats(): StoreStats;
  clear(): void;
}

// ═══════════════════════════════════════════════════════════════════
// IN-MEMORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class InMemoryAgentStore implements AgentStore {
  private agents: Map<string, StoredAgent> = new Map();
  private agentState: Map<string, Map<string, unknown>> = new Map();
  private tasks: Map<string, StoredTask> = new Map();
  private proposals: Map<string, StoredProposal> = new Map();
  private signoffs: Map<string, StoredSignoff> = new Map();
  private sessions: Map<string, StoredSession> = new Map();
  private sessionTasks: Map<string, Set<string>> = new Map();
  private logs: AgentLogEntry[] = [];
  private projectConfigs: Map<string, StoredProjectCouncilConfig> = new Map();
  private logIdCounter = 0;

  // ─────────────────────────────────────────────────────────────────
  // AGENTS
  // ─────────────────────────────────────────────────────────────────

  saveAgent(agent: StoredAgent): void {
    this.agents.set(agent.id, { ...agent, updatedAt: Date.now() });
  }

  getAgent(id: string): StoredAgent | undefined {
    return this.agents.get(id);
  }

  listAgents(): StoredAgent[] {
    return Array.from(this.agents.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  updateAgentStatus(id: string, status: AgentStatus): void {
    const agent = this.agents.get(id);
    if (agent) {
      agent.status = status;
      agent.updatedAt = Date.now();
    }
  }

  deleteAgent(id: string): void {
    this.agents.delete(id);
    this.agentState.delete(id);
  }

  // ─────────────────────────────────────────────────────────────────
  // AGENT STATE
  // ─────────────────────────────────────────────────────────────────

  setState(agentId: string, key: string, value: unknown): void {
    if (!this.agentState.has(agentId)) {
      this.agentState.set(agentId, new Map());
    }
    this.agentState.get(agentId)!.set(key, value);
  }

  getState<T = unknown>(agentId: string, key: string): T | undefined {
    return this.agentState.get(agentId)?.get(key) as T | undefined;
  }

  getAllState(agentId: string): Record<string, unknown> {
    const stateMap = this.agentState.get(agentId);
    if (!stateMap) return {};
    const state: Record<string, unknown> = {};
    stateMap.forEach((value, key) => {
      state[key] = value;
    });
    return state;
  }

  deleteState(agentId: string, key: string): void {
    this.agentState.get(agentId)?.delete(key);
  }

  // ─────────────────────────────────────────────────────────────────
  // TASKS
  // ─────────────────────────────────────────────────────────────────

  createTask(task: Omit<StoredTask, 'createdAt'>): StoredTask {
    const createdAt = Date.now();
    const fullTask: StoredTask = { ...task, createdAt };
    this.tasks.set(task.id, fullTask);
    return fullTask;
  }

  getTask(id: string): StoredTask | undefined {
    return this.tasks.get(id);
  }

  listTasks(filter?: TaskFilter): StoredTask[] {
    let tasks = Array.from(this.tasks.values());

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      tasks = tasks.filter(t => statuses.includes(t.status));
    }
    if (filter?.agentId) {
      tasks = tasks.filter(t => t.agentId === filter.agentId);
    }
    if (filter?.projectId) {
      tasks = tasks.filter(t => t.projectId === filter.projectId);
    }
    if (filter?.type) {
      tasks = tasks.filter(t => t.type === filter.type);
    }

    // Sort by priority DESC, createdAt ASC
    tasks.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.createdAt - b.createdAt;
    });

    if (filter?.limit) {
      tasks = tasks.slice(0, filter.limit);
    }

    return tasks;
  }

  updateTask(id: string, updates: Partial<StoredTask>): void {
    const task = this.tasks.get(id);
    if (task) {
      Object.assign(task, updates);
    }
  }

  deleteTask(id: string): void {
    this.tasks.delete(id);
  }

  getNextPendingTask(agentId?: string): StoredTask | undefined {
    const tasks = this.listTasks({
      status: 'pending',
      agentId,
      limit: 1,
    });
    return tasks[0];
  }

  // ─────────────────────────────────────────────────────────────────
  // PROPOSALS
  // ─────────────────────────────────────────────────────────────────

  createProposal(proposal: Omit<StoredProposal, 'createdAt'>): StoredProposal {
    const createdAt = Date.now();
    const fullProposal: StoredProposal = { ...proposal, createdAt };
    this.proposals.set(proposal.id, fullProposal);
    return fullProposal;
  }

  getProposal(id: string): StoredProposal | undefined {
    return this.proposals.get(id);
  }

  listProposals(filter?: ProposalFilter): StoredProposal[] {
    let proposals = Array.from(this.proposals.values());

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      proposals = proposals.filter(p => statuses.includes(p.status));
    }
    if (filter?.agentId) {
      proposals = proposals.filter(p => p.agentId === filter.agentId);
    }
    if (filter?.projectId) {
      proposals = proposals.filter(p => p.projectId === filter.projectId);
    }

    proposals.sort((a, b) => b.createdAt - a.createdAt);

    if (filter?.limit) {
      proposals = proposals.slice(0, filter.limit);
    }

    return proposals;
  }

  updateProposal(id: string, updates: Partial<StoredProposal>): void {
    const proposal = this.proposals.get(id);
    if (proposal) {
      Object.assign(proposal, updates);
    }
  }

  deleteProposal(id: string): void {
    this.proposals.delete(id);
  }

  // ─────────────────────────────────────────────────────────────────
  // SIGNOFFS
  // ─────────────────────────────────────────────────────────────────

  createSignoff(signoff: Omit<StoredSignoff, 'createdAt'>): StoredSignoff {
    const createdAt = Date.now();
    const fullSignoff: StoredSignoff = { ...signoff, createdAt };
    this.signoffs.set(signoff.id, fullSignoff);
    return fullSignoff;
  }

  getSignoff(id: string): StoredSignoff | undefined {
    return this.signoffs.get(id);
  }

  listSignoffs(filter?: SignoffFilter): StoredSignoff[] {
    let signoffs = Array.from(this.signoffs.values());

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      signoffs = signoffs.filter(s => statuses.includes(s.status));
    }
    if (filter?.projectId) {
      signoffs = signoffs.filter(s => s.projectId === filter.projectId);
    }
    if (filter?.strictness) {
      signoffs = signoffs.filter(s => s.strictness === filter.strictness);
    }

    signoffs.sort((a, b) => b.createdAt - a.createdAt);

    if (filter?.limit) {
      signoffs = signoffs.slice(0, filter.limit);
    }

    return signoffs;
  }

  updateSignoff(id: string, updates: Partial<StoredSignoff>): void {
    const signoff = this.signoffs.get(id);
    if (signoff) {
      Object.assign(signoff, updates);
    }
  }

  recordVote(signoffId: string, agentId: string, vote: 'approve' | 'reject' | 'abstain'): void {
    const signoff = this.signoffs.get(signoffId);
    if (signoff) {
      signoff.votes = { ...signoff.votes, [agentId]: vote };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // SESSIONS
  // ─────────────────────────────────────────────────────────────────

  createSession(projectId?: string): StoredSession {
    const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const session: StoredSession = {
      id,
      projectId,
      status: 'active',
      startedAt: Date.now(),
    };
    this.sessions.set(id, session);
    this.sessionTasks.set(id, new Set());
    return session;
  }

  getSession(id: string): StoredSession | undefined {
    return this.sessions.get(id);
  }

  getActiveSession(projectId?: string): StoredSession | undefined {
    const sessions = Array.from(this.sessions.values())
      .filter(s => s.status === 'active')
      .filter(s => !projectId || s.projectId === projectId)
      .sort((a, b) => b.startedAt - a.startedAt);
    return sessions[0];
  }

  updateSession(id: string, updates: Partial<StoredSession>): void {
    const session = this.sessions.get(id);
    if (session) {
      Object.assign(session, updates);
    }
  }

  endSession(id: string, summary?: string): void {
    this.updateSession(id, {
      status: 'completed',
      endedAt: Date.now(),
      summary,
    });
  }

  addTaskToSession(sessionId: string, taskId: string): void {
    if (!this.sessionTasks.has(sessionId)) {
      this.sessionTasks.set(sessionId, new Set());
    }
    this.sessionTasks.get(sessionId)!.add(taskId);
  }

  getSessionTasks(sessionId: string): StoredTask[] {
    const taskIds = this.sessionTasks.get(sessionId);
    if (!taskIds) return [];
    return Array.from(taskIds)
      .map(id => this.tasks.get(id))
      .filter((t): t is StoredTask => t !== undefined)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  // ─────────────────────────────────────────────────────────────────
  // LOGGING
  // ─────────────────────────────────────────────────────────────────

  log(entry: Omit<AgentLogEntry, 'id' | 'createdAt'>): void {
    this.logs.push({
      ...entry,
      id: ++this.logIdCounter,
      createdAt: Date.now(),
    });
  }

  getLogs(filter?: LogFilter): AgentLogEntry[] {
    let logs = [...this.logs];

    if (filter?.agentId) {
      logs = logs.filter(l => l.agentId === filter.agentId);
    }
    if (filter?.projectId) {
      logs = logs.filter(l => l.projectId === filter.projectId);
    }
    if (filter?.eventType) {
      const types = Array.isArray(filter.eventType) ? filter.eventType : [filter.eventType];
      logs = logs.filter(l => types.includes(l.eventType));
    }
    if (filter?.since) {
      logs = logs.filter(l => l.createdAt >= filter.since!);
    }

    logs.sort((a, b) => b.createdAt - a.createdAt);

    if (filter?.limit) {
      logs = logs.slice(0, filter.limit);
    }

    return logs;
  }

  // ─────────────────────────────────────────────────────────────────
  // PROJECT CONFIG
  // ─────────────────────────────────────────────────────────────────

  getProjectConfig(projectId: string): StoredProjectCouncilConfig | undefined {
    return this.projectConfigs.get(projectId);
  }

  saveProjectConfig(config: Omit<StoredProjectCouncilConfig, 'createdAt' | 'updatedAt'>): void {
    const now = Date.now();
    const existing = this.projectConfigs.get(config.projectId);
    this.projectConfigs.set(config.projectId, {
      ...config,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // MAINTENANCE
  // ─────────────────────────────────────────────────────────────────

  getStats(): StoreStats {
    const taskArray = Array.from(this.tasks.values());
    const proposalArray = Array.from(this.proposals.values());
    const signoffArray = Array.from(this.signoffs.values());
    const sessionArray = Array.from(this.sessions.values());

    return {
      agents: this.agents.size,
      tasks: {
        total: taskArray.length,
        pending: taskArray.filter(t => t.status === 'pending').length,
        running: taskArray.filter(t => t.status === 'running').length,
        completed: taskArray.filter(t => t.status === 'completed').length,
        failed: taskArray.filter(t => t.status === 'failed').length,
      },
      proposals: {
        total: proposalArray.length,
        pending: proposalArray.filter(p => p.status === 'pending').length,
      },
      signoffs: {
        total: signoffArray.length,
        pending: signoffArray.filter(s => s.status === 'pending').length,
      },
      sessions: {
        total: sessionArray.length,
        active: sessionArray.filter(s => s.status === 'active').length,
      },
      logs: this.logs.length,
    };
  }

  clear(): void {
    this.agents.clear();
    this.agentState.clear();
    this.tasks.clear();
    this.proposals.clear();
    this.signoffs.clear();
    this.sessions.clear();
    this.sessionTasks.clear();
    this.logs = [];
    this.projectConfigs.clear();
    this.logIdCounter = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _store: AgentStore | null = null;

/**
 * Get the singleton agent store
 */
export function getAgentStore(): AgentStore {
  if (!_store) {
    _store = new InMemoryAgentStore();
  }
  return _store;
}

/**
 * Set a custom store (for testing)
 */
export function setAgentStore(store: AgentStore): void {
  _store = store;
}

/**
 * Reset the store (for testing)
 */
export function resetAgentStore(): void {
  _store = null;
}
