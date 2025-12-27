/**
 * Agent-AUI Bridge
 *
 * Connects the Electron Agent Council to the AUI (Agentic User Interface).
 * This bridge:
 * - Listens for agent proposals and displays them in chat
 * - Handles user approval/rejection of proposals
 * - Executes AUI tools on behalf of agents
 * - Respects automation mode (guided vs autonomous)
 * - Reports results back to agents
 *
 * Philosophy:
 * The bridge makes the agent system visible to the user through the chat
 * interface, maintaining the "show don't tell" principle. Users see what
 * agents want to do and can approve, reject, or learn from the proposals.
 */

import type { AUIToolResult, AUIContext } from './tools';
import type { AUISettings } from './settings';
import { executeAllTools } from './tools';

// ═══════════════════════════════════════════════════════════════════
// SECURITY: ALLOWED TOOL WHITELIST
// ═══════════════════════════════════════════════════════════════════

/**
 * Whitelist of AUI tools that agents are allowed to execute.
 * This prevents malicious injection of arbitrary tool names.
 * Update this list when adding new tools to tools.ts.
 */
const ALLOWED_AUI_TOOLS = new Set([
  // Chapter tools
  'update_chapter', 'create_chapter', 'delete_chapter', 'render_book',
  'list_chapters', 'get_chapter',
  // Workspace tools
  'get_workspace', 'save_to_chapter',
  // Archive tools
  'search_archive', 'search_facebook', 'list_conversations', 'harvest_archive',
  // Passage tools
  'add_passage', 'list_passages', 'mark_passage',
  // Image tools
  'describe_image', 'search_images', 'classify_image', 'find_similar_images',
  'cluster_images', 'add_image_passage',
  // Persona/Style tools
  'list_personas', 'list_styles', 'apply_persona', 'apply_style',
  'extract_persona', 'extract_style', 'discover_voices',
  'create_persona', 'create_style',
  // Transformation tools
  'humanize', 'detect_ai', 'translate', 'analyze_text', 'quantum_read',
  // Pyramid tools
  'build_pyramid', 'get_pyramid', 'search_pyramid',
  // Draft tools
  'generate_first_draft',
  // Agent tools
  'list_agents', 'get_agent_status', 'list_pending_proposals', 'request_agent',
  // Workflow tools
  'discover_threads', 'start_book_workflow',
]);

/**
 * Validate that a tool name is in the allowed whitelist.
 * Returns true if allowed, false if blocked.
 */
function isAllowedTool(toolName: string | undefined): toolName is string {
  return !!toolName && ALLOWED_AUI_TOOLS.has(toolName);
}

// ═══════════════════════════════════════════════════════════════════
// ELECTRON API TYPES (matching preload.ts)
// ═══════════════════════════════════════════════════════════════════

interface ElectronAgentProposal {
  id: string;
  agentId: string;
  agentName?: string;
  actionType: string;
  title: string;
  description?: string;
  payload: unknown;
  urgency: string;
  projectId?: string;
  createdAt: number;
  expiresAt?: number;
  status: string;
}

interface ElectronAgentInfo {
  id: string;
  name: string;
  house: string;
  status: string;
  capabilities: string[];
}

interface ElectronAgentEvent {
  type: string;
  proposal?: ElectronAgentProposal;
  agent?: ElectronAgentInfo;
  sessionId?: string;
  projectId?: string;
  taskId?: string;
  error?: string;
  timestamp: number;
}

interface ElectronAgentAPI {
  agents: {
    listAgents: () => Promise<ElectronAgentInfo[]>;
    getAgent: (agentId: string) => Promise<ElectronAgentInfo | null>;
    getPendingProposals: (projectId?: string) => Promise<ElectronAgentProposal[]>;
    approveProposal: (proposalId: string) => Promise<{ success: boolean; error?: string }>;
    rejectProposal: (proposalId: string, reason?: string) => Promise<{ success: boolean }>;
    requestTask: (request: { agentId: string; taskType: string; payload: unknown; projectId?: string }) => Promise<{ taskId?: string; error?: string }>;
    getTaskStatus: (taskId: string) => Promise<{ status: string; result?: unknown; error?: string }>;
    startSession: (projectId?: string) => Promise<{ sessionId: string }>;
    endSession: (sessionId: string, summary?: string) => Promise<{ success: boolean }>;
    getStats: () => Promise<{ activeSessions: number; pendingProposals: number; registeredAgents: number; activeAgents: number }>;
    onProposal: (callback: (event: ElectronAgentEvent) => void) => () => void;
    onAgentStatus: (callback: (event: ElectronAgentEvent) => void) => () => void;
    onSessionEvent: (callback: (event: ElectronAgentEvent) => void) => () => void;
  };
}

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Proposal from an agent that may require user approval
 */
export interface AgentProposal {
  id: string;
  agentId: string;
  agentName: string;
  actionType: string;
  title: string;
  description?: string;
  payload: unknown;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  projectId?: string;
  createdAt: number;
  expiresAt?: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'auto';
  /** Mapped AUI tool to execute if approved */
  auiTool?: string;
  /** Parameters for the AUI tool */
  auiToolParams?: Record<string, unknown>;
}

/**
 * Tool execution request from an agent
 */
export interface AgentToolRequest {
  requestId: string;
  agentId: string;
  agentName: string;
  tool: string;
  params: Record<string, unknown>;
  projectId?: string;
  /** Whether to show in chat (some operations are silent) */
  showInChat: boolean;
}

/**
 * Bridge event types for the AUI to listen to
 */
export type BridgeEvent =
  | { type: 'proposal:received'; proposal: AgentProposal }
  | { type: 'proposal:expired'; proposalId: string }
  | { type: 'tool:executing'; request: AgentToolRequest }
  | { type: 'tool:completed'; requestId: string; result: AUIToolResult }
  | { type: 'tool:failed'; requestId: string; error: string }
  | { type: 'agent:status'; agentId: string; status: string }
  | { type: 'session:started'; sessionId: string; projectId?: string }
  | { type: 'session:ended'; sessionId: string };

export type BridgeEventListener = (event: BridgeEvent) => void;

/**
 * Agent information for display
 */
export interface AgentInfo {
  id: string;
  name: string;
  house: string;
  status: 'idle' | 'working' | 'waiting' | 'error' | 'disabled';
  capabilities: string[];
}

/**
 * Bridge configuration
 */
export interface BridgeConfig {
  /** Automation mode from settings */
  automationMode: 'guided' | 'autonomous';
  /** Auto-approve low-risk operations */
  autoApproveLowRisk: boolean;
  /** Show proposals in chat */
  showProposals: boolean;
  /** Proposal timeout (ms) */
  proposalTimeout: number;
}

// ═══════════════════════════════════════════════════════════════════
// AGENT-TO-AUI TOOL MAPPING
// ═══════════════════════════════════════════════════════════════════

/**
 * Maps agent action types to AUI tools
 * This allows agents to trigger AUI operations via their proposals
 */
const ACTION_TO_TOOL_MAP: Record<string, {
  tool: string;
  paramTransform?: (payload: unknown) => Record<string, unknown>;
  isLowRisk: boolean;
}> = {
  // Harvester actions
  'add-passages-to-thread': {
    tool: 'harvest_archive',
    paramTransform: (p) => {
      const payload = p as { passages?: Array<{ text: string }>; threadId?: string };
      return {
        query: payload.passages?.[0]?.text?.substring(0, 100) || '',
        limit: payload.passages?.length || 10,
      };
    },
    isLowRisk: false,
  },
  'search-archive': {
    tool: 'search_archive',
    paramTransform: (p) => p as Record<string, unknown>,
    isLowRisk: true,
  },

  // Curator actions
  'feature-gem': {
    tool: 'mark_passage',
    paramTransform: (p) => {
      const payload = p as { passageId?: string };
      return { passageId: payload.passageId, status: 'gem' };
    },
    isLowRisk: true,
  },
  'approve-passage': {
    tool: 'mark_passage',
    paramTransform: (p) => {
      const payload = p as { passageId?: string };
      return { passageId: payload.passageId, status: 'approved' };
    },
    isLowRisk: true,
  },
  'skip-passage': {
    tool: 'mark_passage',
    paramTransform: (p) => {
      const payload = p as { passageId?: string };
      return { passageId: payload.passageId, status: 'skipped' };
    },
    isLowRisk: true,
  },

  // Builder actions
  'create-chapter': {
    tool: 'create_chapter',
    paramTransform: (p) => {
      const payload = p as { title?: string; content?: string };
      return { title: payload.title, content: payload.content };
    },
    isLowRisk: false,
  },
  'update-chapter': {
    tool: 'update_chapter',
    paramTransform: (p) => {
      const payload = p as { chapterId?: string; content?: string };
      return { chapterId: payload.chapterId, content: payload.content };
    },
    isLowRisk: false,
  },
  'build-chapter-draft': {
    tool: 'generate_first_draft',
    paramTransform: (p) => {
      const payload = p as { title?: string; passageIds?: string[] };
      return { chapterTitle: payload.title, passageIds: payload.passageIds };
    },
    isLowRisk: false,
  },

  // Reviewer actions
  'detect-ai': {
    tool: 'detect_ai',
    paramTransform: (p) => {
      const payload = p as { text?: string };
      return { text: payload.text };
    },
    isLowRisk: true,
  },

  // Discovery actions
  'create-discovered-thread': {
    tool: 'add_passage',
    paramTransform: (p) => {
      const payload = p as { discovery?: { passages?: Array<{ text: string }>; theme?: string } };
      const firstPassage = payload.discovery?.passages?.[0];
      return {
        content: firstPassage?.text || '',
        conversationTitle: payload.discovery?.theme || 'Discovered',
        tags: ['discovered', 'thread'],
      };
    },
    isLowRisk: false,
  },
};

// ═══════════════════════════════════════════════════════════════════
// AGENT-AUI BRIDGE
// ═══════════════════════════════════════════════════════════════════

export class AgentAUIBridge {
  private listeners: Set<BridgeEventListener> = new Set();
  private pendingProposals: Map<string, AgentProposal> = new Map();
  private pendingToolRequests: Map<string, AgentToolRequest> = new Map();
  private config: BridgeConfig;
  private auiContext: AUIContext | null = null;

  // Agent orchestrator connection (will be set from Electron IPC or direct import)
  private orchestratorConnected = false;
  private mockAgents: AgentInfo[] = [];

  constructor(config?: Partial<BridgeConfig>) {
    this.config = {
      automationMode: config?.automationMode ?? 'guided',
      autoApproveLowRisk: config?.autoApproveLowRisk ?? false,
      showProposals: config?.showProposals ?? true,
      proposalTimeout: config?.proposalTimeout ?? 60000, // 1 minute default
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Initialize the bridge with AUI context
   */
  initialize(context: AUIContext): void {
    this.auiContext = context;

    // Try to connect to the orchestrator
    this.connectToOrchestrator();

    console.log('[AgentBridge] Initialized');
  }

  /**
   * Update configuration from AUI settings
   */
  updateConfig(settings: AUISettings): void {
    this.config = {
      automationMode: settings.automation.mode,
      autoApproveLowRisk: settings.automation.autoApproveLowRisk,
      showProposals: settings.automation.showProposals,
      proposalTimeout: this.config.proposalTimeout,
    };
  }

  /**
   * Connect to the agent orchestrator
   * In Electron, this uses IPC. In web, this is a no-op until wired.
   */
  private connectToOrchestrator(): void {
    // Check if we're in Electron with access to the agent council
    if (typeof window === 'undefined') {
      this.setupMockConnection();
      return;
    }

    const win = window as Window & { electronAPI?: ElectronAgentAPI };
    const electronAPI = win.electronAPI;

    if (electronAPI && electronAPI.agents) {
      try {
        this.setupElectronConnection(electronAPI.agents);
      } catch (error) {
        console.warn('[AgentBridge] Failed to connect to orchestrator:', error);
        this.setupMockConnection();
      }
    } else {
      // Web environment - use mock for now
      this.setupMockConnection();
    }
  }

  /**
   * Set up real Electron IPC connection
   */
  private setupElectronConnection(agentsAPI: ElectronAgentAPI['agents']): void {
    this.orchestratorConnected = true;
    this.electronAgentsAPI = agentsAPI;

    // Subscribe to proposal events from Electron
    const unsubProposal = agentsAPI.onProposal((event: ElectronAgentEvent) => {
      if (event.type === 'proposal:received' && event.proposal) {
        // Receive the proposal through the bridge
        this.receiveProposal({
          id: event.proposal.id,
          agentId: event.proposal.agentId,
          agentName: event.proposal.agentName || event.proposal.agentId,
          actionType: event.proposal.actionType,
          title: event.proposal.title,
          description: event.proposal.description,
          payload: event.proposal.payload,
          urgency: event.proposal.urgency as 'low' | 'normal' | 'high' | 'critical',
          projectId: event.proposal.projectId,
          createdAt: event.proposal.createdAt,
          expiresAt: event.proposal.expiresAt,
        });
      }
    });

    // Subscribe to agent status updates
    const unsubStatus = agentsAPI.onAgentStatus((event: ElectronAgentEvent) => {
      if (event.agent) {
        this.emit({ type: 'agent:status', agentId: event.agent.id, status: event.agent.status });
        // Refresh agents list
        this.refreshAgents();
      }
    });

    // Subscribe to session events
    const unsubSession = agentsAPI.onSessionEvent((event: ElectronAgentEvent) => {
      if (event.type === 'session:started') {
        this.emit({ type: 'session:started', sessionId: event.sessionId || '', projectId: event.projectId });
      } else if (event.type === 'session:ended') {
        this.emit({ type: 'session:ended', sessionId: event.sessionId || '' });
      }
    });

    // Store unsubscribe functions for cleanup
    this._ipcUnsubscribes = [unsubProposal, unsubStatus, unsubSession];

    // Initial load of agents
    this.refreshAgents();

    console.log('[AgentBridge] Connected via Electron IPC');
  }

  private _ipcUnsubscribes: Array<() => void> = [];
  private electronAgentsAPI: ElectronAgentAPI['agents'] | null = null;

  /**
   * Refresh agents list from Electron
   */
  private async refreshAgents(): Promise<void> {
    if (this.electronAgentsAPI) {
      try {
        const agents = await this.electronAgentsAPI.listAgents();
        this.mockAgents = agents.map((a: ElectronAgentInfo) => ({
          id: a.id,
          name: a.name,
          house: a.house,
          status: a.status as AgentInfo['status'],
          capabilities: a.capabilities,
        }));
      } catch (error) {
        console.warn('[AgentBridge] Failed to refresh agents:', error);
      }
    }
  }

  /**
   * Clean up IPC subscriptions
   */
  cleanup(): void {
    for (const unsub of this._ipcUnsubscribes) {
      unsub();
    }
    this._ipcUnsubscribes = [];
    this.electronAgentsAPI = null;
    this.orchestratorConnected = false;
    console.log('[AgentBridge] Cleaned up');
  }

  /**
   * Set up mock connection for development/testing
   */
  private setupMockConnection(): void {
    this.orchestratorConnected = true;
    this.mockAgents = [
      { id: 'harvester', name: 'The Harvester', house: 'harvester', status: 'idle', capabilities: ['search-archive', 'harvest-for-thread'] },
      { id: 'curator', name: 'The Curator', house: 'curator', status: 'idle', capabilities: ['assess-quality', 'organize-content'] },
      { id: 'builder', name: 'The Builder', house: 'builder', status: 'idle', capabilities: ['compose-chapter', 'structure-content'] },
      { id: 'reviewer', name: 'The Reviewer', house: 'reviewer', status: 'idle', capabilities: ['review-content', 'detect-ai'] },
    ];
    console.log('[AgentBridge] Connected (mock mode)');
  }

  // ─────────────────────────────────────────────────────────────────
  // EVENT SYSTEM
  // ─────────────────────────────────────────────────────────────────

  /**
   * Subscribe to bridge events
   */
  onEvent(listener: BridgeEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: BridgeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[AgentBridge] Event listener error:', error);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PROPOSAL HANDLING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Receive a proposal from an agent
   * Called by the orchestrator when an agent proposes an action
   */
  receiveProposal(proposal: Omit<AgentProposal, 'status'>): string {
    const fullProposal: AgentProposal = {
      ...proposal,
      status: 'pending',
    };

    // Map action type to AUI tool
    const mapping = ACTION_TO_TOOL_MAP[proposal.actionType];
    if (mapping) {
      fullProposal.auiTool = mapping.tool;
      fullProposal.auiToolParams = mapping.paramTransform?.(proposal.payload) ?? {};
    }

    this.pendingProposals.set(proposal.id, fullProposal);

    // Check if we should auto-approve
    if (this.shouldAutoApprove(fullProposal)) {
      fullProposal.status = 'auto';
      this.executeProposal(fullProposal);
    } else if (this.config.showProposals) {
      // Emit event for AUI to display
      this.emit({ type: 'proposal:received', proposal: fullProposal });
    }

    // Set expiration timeout
    if (proposal.expiresAt) {
      const timeout = proposal.expiresAt - Date.now();
      setTimeout(() => {
        const p = this.pendingProposals.get(proposal.id);
        if (p && p.status === 'pending') {
          p.status = 'expired';
          this.pendingProposals.delete(proposal.id);
          this.emit({ type: 'proposal:expired', proposalId: proposal.id });
        }
      }, timeout);
    }

    return proposal.id;
  }

  /**
   * Check if a proposal should be auto-approved based on settings
   */
  private shouldAutoApprove(proposal: AgentProposal): boolean {
    // In autonomous mode, auto-approve everything
    if (this.config.automationMode === 'autonomous') {
      return true;
    }

    // In guided mode, check if low-risk auto-approval is enabled
    if (this.config.autoApproveLowRisk) {
      const mapping = ACTION_TO_TOOL_MAP[proposal.actionType];
      if (mapping?.isLowRisk) {
        return true;
      }
    }

    return false;
  }

  /**
   * Approve a proposal (called by AUI when user approves)
   */
  async approveProposal(proposalId: string): Promise<AUIToolResult | null> {
    const proposal = this.pendingProposals.get(proposalId);
    if (!proposal) {
      console.warn(`[AgentBridge] Unknown proposal: ${proposalId}`);
      return null;
    }

    proposal.status = 'approved';
    this.pendingProposals.delete(proposalId);

    return this.executeProposal(proposal);
  }

  /**
   * Reject a proposal (called by AUI when user rejects)
   */
  rejectProposal(proposalId: string, reason?: string): void {
    const proposal = this.pendingProposals.get(proposalId);
    if (!proposal) {
      console.warn(`[AgentBridge] Unknown proposal: ${proposalId}`);
      return;
    }

    proposal.status = 'rejected';
    this.pendingProposals.delete(proposalId);

    // Notify the orchestrator
    // TODO: Wire to actual orchestrator
    console.log(`[AgentBridge] Proposal rejected: ${proposalId}`, reason);
  }

  /**
   * Execute an approved proposal
   */
  private async executeProposal(proposal: AgentProposal): Promise<AUIToolResult | null> {
    if (!proposal.auiTool || !this.auiContext) {
      console.warn(`[AgentBridge] Cannot execute proposal - no tool mapped or no context`);
      return null;
    }

    // SECURITY: Validate tool name against whitelist
    if (!isAllowedTool(proposal.auiTool)) {
      console.error(`[AgentBridge] SECURITY: Blocked attempt to execute non-whitelisted tool: ${proposal.auiTool}`);
      return {
        success: false,
        error: `Security: tool '${proposal.auiTool}' is not in the allowed whitelist`,
      };
    }

    // Create a USE_TOOL string for the tool executor
    const toolUseString = `USE_TOOL(${proposal.auiTool}, ${JSON.stringify(proposal.auiToolParams || {})})`;

    try {
      const { results } = await executeAllTools(toolUseString, this.auiContext);
      return results[0] || null;
    } catch (error) {
      console.error(`[AgentBridge] Failed to execute proposal:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all pending proposals
   */
  getPendingProposals(): AgentProposal[] {
    return Array.from(this.pendingProposals.values());
  }

  // ─────────────────────────────────────────────────────────────────
  // TOOL EXECUTION (Direct Agent Requests)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Execute a tool on behalf of an agent
   * Used for immediate tool execution (not proposals)
   */
  async executeTool(request: AgentToolRequest): Promise<AUIToolResult> {
    if (!this.auiContext) {
      return {
        success: false,
        error: 'AUI context not available',
      };
    }

    this.pendingToolRequests.set(request.requestId, request);

    if (request.showInChat) {
      this.emit({ type: 'tool:executing', request });
    }

    // SECURITY: Validate tool name against whitelist
    if (!isAllowedTool(request.tool)) {
      console.error(`[AgentBridge] SECURITY: Blocked attempt to execute non-whitelisted tool: ${request.tool}`);
      const error = { success: false, error: `Security: tool '${request.tool}' is not in the allowed whitelist` };
      this.pendingToolRequests.delete(request.requestId);
      this.emit({ type: 'tool:completed', requestId: request.requestId, result: error });
      return error;
    }

    const toolUseString = `USE_TOOL(${request.tool}, ${JSON.stringify(request.params)})`;

    try {
      const { results } = await executeAllTools(toolUseString, this.auiContext);
      const result = results[0] || { success: true, message: 'Tool executed' };

      this.pendingToolRequests.delete(request.requestId);
      this.emit({ type: 'tool:completed', requestId: request.requestId, result });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.pendingToolRequests.delete(request.requestId);
      this.emit({ type: 'tool:failed', requestId: request.requestId, error: errorMessage });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // AGENT QUERIES
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get list of available agents
   */
  getAgents(): AgentInfo[] {
    // When connected to real orchestrator, query it
    // For now, return mock agents
    return this.mockAgents;
  }

  /**
   * Check if orchestrator is connected
   */
  isConnected(): boolean {
    return this.orchestratorConnected;
  }

  /**
   * Request an agent to perform work
   * This is how the AUI can trigger agent activity
   */
  async requestAgentWork(
    agentId: string,
    taskType: string,
    payload: unknown,
    projectId?: string
  ): Promise<{ taskId: string } | { error: string }> {
    // Try to use Electron IPC if available
    if (this.electronAgentsAPI) {
      try {
        const result = await this.electronAgentsAPI.requestTask({
          agentId,
          taskType,
          payload,
          projectId,
        });

        if (result.error) {
          return { error: result.error };
        }
        return { taskId: result.taskId || `task-${Date.now()}` };
      } catch (error) {
        console.error('[AgentBridge] Failed to request task via IPC:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    // Fallback for web environment
    console.log(`[AgentBridge] Work requested from ${agentId}:`, { taskType, payload, projectId });
    return { taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER: Format Proposal for Chat Display
  // ─────────────────────────────────────────────────────────────────

  /**
   * Format a proposal for display in the AUI chat
   */
  formatProposalForChat(proposal: AgentProposal): string {
    const urgencyEmoji = {
      low: '📋',
      normal: '📝',
      high: '⚡',
      critical: '🚨',
    };

    return [
      `${urgencyEmoji[proposal.urgency]} **${proposal.agentName}** proposes:`,
      `**${proposal.title}**`,
      proposal.description ? `_${proposal.description}_` : '',
      '',
      `Action: \`${proposal.actionType}\``,
      proposal.auiTool ? `Tool: \`${proposal.auiTool}\`` : '',
      '',
      `[Approve] [Reject]`,
    ].filter(Boolean).join('\n');
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _bridge: AgentAUIBridge | null = null;

/**
 * Get the singleton bridge instance
 */
export function getAgentBridge(): AgentAUIBridge {
  if (!_bridge) {
    _bridge = new AgentAUIBridge();
  }
  return _bridge;
}

/**
 * Initialize the bridge with context
 */
export function initializeAgentBridge(context: AUIContext): AgentAUIBridge {
  const bridge = getAgentBridge();
  bridge.initialize(context);
  return bridge;
}

// ═══════════════════════════════════════════════════════════════════
// REACT HOOK
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';

/**
 * React hook for interacting with the agent bridge
 */
export function useAgentBridge() {
  const [pendingProposals, setPendingProposals] = useState<AgentProposal[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const bridge = getAgentBridge();

    // Initial state
    setPendingProposals(bridge.getPendingProposals());
    setAgents(bridge.getAgents());
    setIsConnected(bridge.isConnected());

    // Subscribe to events
    const unsubscribe = bridge.onEvent((event) => {
      switch (event.type) {
        case 'proposal:received':
          setPendingProposals(bridge.getPendingProposals());
          break;
        case 'proposal:expired':
          setPendingProposals(bridge.getPendingProposals());
          break;
        case 'agent:status':
          setAgents(bridge.getAgents());
          break;
      }
    });

    return unsubscribe;
  }, []);

  const approveProposal = useCallback(async (proposalId: string) => {
    const bridge = getAgentBridge();
    const result = await bridge.approveProposal(proposalId);
    setPendingProposals(bridge.getPendingProposals());
    return result;
  }, []);

  const rejectProposal = useCallback((proposalId: string, reason?: string) => {
    const bridge = getAgentBridge();
    bridge.rejectProposal(proposalId, reason);
    setPendingProposals(bridge.getPendingProposals());
  }, []);

  const requestWork = useCallback(
    async (agentId: string, taskType: string, payload: unknown, projectId?: string) => {
      const bridge = getAgentBridge();
      return bridge.requestAgentWork(agentId, taskType, payload, projectId);
    },
    []
  );

  return {
    pendingProposals,
    agents,
    isConnected,
    approveProposal,
    rejectProposal,
    requestWork,
  };
}
