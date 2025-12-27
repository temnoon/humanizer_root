/**
 * Humanizer Desktop - Preload Script
 *
 * Exposes safe APIs to the renderer process via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export interface ElectronAPI {
  // Store
  store: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<boolean>;
  };

  // App info
  app: {
    paths: () => Promise<{
      documents: string;
      userData: string;
      home: string;
      temp: string;
    }>;
    info: () => Promise<{
      platform: NodeJS.Platform;
      arch: string;
      version: string;
      isPackaged: boolean;
    }>;
    isFirstRun: () => Promise<boolean>;
    completeFirstRun: () => Promise<boolean>;
  };

  // File dialogs
  dialog: {
    selectFolder: () => Promise<string | null>;
    selectFile: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
  };

  // Archive server (optional)
  archive: {
    port: () => Promise<number | null>;
    enabled: () => Promise<boolean>;
    enable: (archivePath?: string) => Promise<{ success: boolean; port?: number }>;
    disable: () => Promise<{ success: boolean }>;
    restart: (newPath?: string) => Promise<{ success: boolean; port?: number }>;
  };

  // Ollama (optional)
  ollama: {
    enabled: () => Promise<boolean>;
    enable: () => Promise<boolean>;
    disable: () => Promise<boolean>;
    status: () => Promise<{ installed: boolean; running: boolean }>;
  };

  // Cloud drives (to be added)
  cloudDrives: {
    listDrives: () => Promise<CloudDrive[]>;
    google: GoogleDriveAPI;
  };

  // Queue system for batch processing
  queue: QueueAPI;

  // Chat service (AUI)
  chat: ChatAPI;

  // Agent Council
  agents: AgentAPI;
}

export interface CloudDrive {
  id: string;
  provider: 'google' | 'dropbox' | 'onedrive' | 's3';
  name: string;
  icon: string;
}

export interface GoogleDriveAPI {
  connect: () => Promise<{ success: boolean; error?: string }>;
  isConnected: () => Promise<boolean>;
  disconnect: () => Promise<{ success: boolean }>;
  list: (folderId?: string, pageToken?: string) => Promise<{
    success: boolean;
    files?: GoogleDriveFile[];
    nextPageToken?: string;
    error?: string;
  }>;
  search: (query: string, pageToken?: string) => Promise<{
    success: boolean;
    files?: GoogleDriveFile[];
    nextPageToken?: string;
    error?: string;
  }>;
  download: (fileId: string) => Promise<{ success: boolean; content?: ArrayBuffer; error?: string }>;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  isFolder: boolean;
}

// ============================================================
// QUEUE TYPES (simplified for preload)
// ============================================================

export type QueueJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused';
export type QueueJobType = 'image-analysis' | 'image-embedding' | 'summarize' | 'extract' | 'transform' | 'index' | 'batch-read';

export interface QueueFileItem {
  path: string;
  size: number;
  id?: string;
  source?: 'local' | 'r2' | 'gdrive' | 'url';
}

export interface QueueJobSpec {
  type: QueueJobType;
  priority?: number;
  files: QueueFileItem[];
  options?: Record<string, unknown>;
  timeoutPerFile?: number;
  maxRetries?: number;
  concurrency?: number;
}

export interface QueueProgress {
  jobId: string;
  processed: number;
  total: number;
  percentComplete: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
  currentFile?: string;
  bytesProcessed: number;
  totalBytes: number;
  successCount: number;
  errorCount: number;
}

export interface QueueJob {
  id: string;
  spec: QueueJobSpec;
  status: QueueJobStatus;
  progress: QueueProgress;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  results: Array<{
    filePath: string;
    success: boolean;
    data?: unknown;
    error?: string;
    processingTimeMs: number;
  }>;
  error?: string;
}

export interface QueueState {
  isPaused: boolean;
  pendingCount: number;
  processingCount: number;
  totalJobs: number;
  activeConcurrency: number;
  maxConcurrency: number;
}

export interface QueueEvent {
  type: string;
  jobId?: string;
  job?: QueueJob;
  progress?: QueueProgress;
  timestamp: number;
}

export interface QueueAPI {
  createJob: (spec: QueueJobSpec) => Promise<{ success: boolean; jobId?: string; error?: string }>;
  getJob: (jobId: string) => Promise<QueueJob | null>;
  listJobs: (options?: { status?: QueueJobStatus | QueueJobStatus[]; type?: QueueJobType; limit?: number }) => Promise<QueueJob[]>;
  cancelJob: (jobId: string) => Promise<boolean>;
  deleteJob: (jobId: string) => Promise<boolean>;
  pause: () => Promise<boolean>;
  resume: () => Promise<boolean>;
  getState: () => Promise<QueueState>;
  onEvent: (callback: (event: QueueEvent) => void) => () => void;
}

// ============================================================
// CHAT TYPES
// ============================================================

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  toolResults?: ChatToolResult[];
  metadata?: Record<string, unknown>;
}

export interface ChatToolResult {
  toolName: string;
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
  agentId?: string;
  teaching?: {
    whatHappened: string;
    guiPath?: string[];
    shortcut?: string;
    why?: string;
  };
}

export interface ChatConversation {
  id: string;
  title: string;
  startedAt: number;
  endedAt?: number;
  messageCount: number;
  tags: string[];
  archived: boolean;
  projectId?: string;
  preview?: string;
}

export interface ChatEvent {
  type: string;
  message?: ChatMessage;
  result?: ChatToolResult;
  error?: string;
  timestamp: number;
}

export interface ChatAPI {
  startConversation: (options?: { projectId?: string; tags?: string[] }) => Promise<ChatConversation>;
  getConversation: () => Promise<ChatConversation | null>;
  loadConversation: (id: string) => Promise<ChatConversation | null>;
  listConversations: (options?: { limit?: number; projectId?: string }) => Promise<ChatConversation[]>;
  getMessages: (conversationId?: string) => Promise<ChatMessage[]>;
  sendMessage: (content: string, options?: { projectId?: string; context?: string; executeTools?: boolean }) => Promise<ChatMessage[]>;
  endConversation: () => Promise<{ success: boolean }>;
  archiveConversation: (conversationId: string) => Promise<{ success: boolean }>;
  searchMessages: (query: string) => Promise<ChatMessage[]>;
  getStats: () => Promise<{ totalConversations: number; totalMessages: number; archivedConversations: number; toolExecutions: number }>;
  updateConfig: (updates: { llm?: { provider?: string; model?: string; apiKey?: string }; archiveUrl?: string; autoArchive?: boolean }) => Promise<{ success: boolean }>;
  onMessage: (callback: (event: ChatEvent) => void) => () => void;
  onToolExecuted: (callback: (event: ChatEvent) => void) => () => void;
  onError: (callback: (event: ChatEvent) => void) => () => void;
}

// ============================================================
// AGENT TYPES
// ============================================================

export type AgentStatus = 'idle' | 'working' | 'waiting' | 'error' | 'disabled';

export interface AgentInfo {
  id: string;
  name: string;
  house: string;
  status: AgentStatus;
  capabilities: string[];
}

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
}

export interface AgentEvent {
  type: string;
  proposal?: AgentProposal;
  agent?: AgentInfo;
  taskId?: string;
  error?: string;
  timestamp: number;
}

export interface AgentTaskRequest {
  agentId: string;
  taskType: string;
  payload: unknown;
  projectId?: string;
}

export interface AgentAPI {
  // Agent queries
  listAgents: () => Promise<AgentInfo[]>;
  getAgent: (agentId: string) => Promise<AgentInfo | null>;

  // Proposal management
  getPendingProposals: (projectId?: string) => Promise<AgentProposal[]>;
  approveProposal: (proposalId: string) => Promise<{ success: boolean; error?: string }>;
  rejectProposal: (proposalId: string, reason?: string) => Promise<{ success: boolean }>;

  // Task dispatch
  requestTask: (request: AgentTaskRequest) => Promise<{ taskId?: string; error?: string }>;
  getTaskStatus: (taskId: string) => Promise<{ status: string; result?: unknown; error?: string }>;

  // Session management
  startSession: (projectId?: string) => Promise<{ sessionId: string }>;
  endSession: (sessionId: string, summary?: string) => Promise<{ success: boolean }>;

  // Stats
  getStats: () => Promise<{
    activeSessions: number;
    pendingProposals: number;
    registeredAgents: number;
    activeAgents: number;
  }>;

  // Event subscriptions
  onProposal: (callback: (event: AgentEvent) => void) => () => void;
  onAgentStatus: (callback: (event: AgentEvent) => void) => () => void;
  onSessionEvent: (callback: (event: AgentEvent) => void) => () => void;
}

// ============================================================
// EXPOSE API
// ============================================================

contextBridge.exposeInMainWorld('electronAPI', {
  // Store
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
  },

  // App info
  app: {
    paths: () => ipcRenderer.invoke('app:paths'),
    info: () => ipcRenderer.invoke('app:info'),
    isFirstRun: () => ipcRenderer.invoke('app:is-first-run'),
    completeFirstRun: () => ipcRenderer.invoke('app:complete-first-run'),
  },

  // File dialogs
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
    selectFile: (options) => ipcRenderer.invoke('dialog:select-file', options),
  },

  // Archive server
  archive: {
    port: () => ipcRenderer.invoke('archive:port'),
    enabled: () => ipcRenderer.invoke('archive:enabled'),
    enable: (archivePath?: string) => ipcRenderer.invoke('archive:enable', archivePath),
    disable: () => ipcRenderer.invoke('archive:disable'),
    restart: (newPath?: string) => ipcRenderer.invoke('archive:restart', newPath),
  },

  // Ollama
  ollama: {
    enabled: () => ipcRenderer.invoke('ollama:enabled'),
    enable: () => ipcRenderer.invoke('ollama:enable'),
    disable: () => ipcRenderer.invoke('ollama:disable'),
    status: () => ipcRenderer.invoke('ollama:status'),
  },

  // Cloud drives - stubs for now, will be implemented
  cloudDrives: {
    listDrives: () => ipcRenderer.invoke('cloud:list-drives'),
    google: {
      connect: () => ipcRenderer.invoke('cloud:google:connect'),
      isConnected: () => ipcRenderer.invoke('cloud:google:is-connected'),
      disconnect: () => ipcRenderer.invoke('cloud:google:disconnect'),
      list: (folderId?: string, pageToken?: string) =>
        ipcRenderer.invoke('cloud:google:list', folderId, pageToken),
      search: (query: string, pageToken?: string) =>
        ipcRenderer.invoke('cloud:google:search', query, pageToken),
      download: (fileId: string) => ipcRenderer.invoke('cloud:google:download', fileId),
    },
  },

  // Queue system for batch processing
  queue: {
    createJob: (spec: QueueJobSpec) => ipcRenderer.invoke('queue:create-job', spec),
    getJob: (jobId: string) => ipcRenderer.invoke('queue:get-job', jobId),
    listJobs: (options) => ipcRenderer.invoke('queue:list-jobs', options),
    cancelJob: (jobId: string) => ipcRenderer.invoke('queue:cancel-job', jobId),
    deleteJob: (jobId: string) => ipcRenderer.invoke('queue:delete-job', jobId),
    pause: () => ipcRenderer.invoke('queue:pause'),
    resume: () => ipcRenderer.invoke('queue:resume'),
    getState: () => ipcRenderer.invoke('queue:state'),
    onEvent: (callback: (event: QueueEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, queueEvent: QueueEvent) => {
        callback(queueEvent);
      };
      ipcRenderer.on('queue:event', handler);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener('queue:event', handler);
      };
    },
  },

  // Chat service (AUI)
  chat: {
    startConversation: (options) => ipcRenderer.invoke('chat:start-conversation', options),
    getConversation: () => ipcRenderer.invoke('chat:get-conversation'),
    loadConversation: (id: string) => ipcRenderer.invoke('chat:load-conversation', id),
    listConversations: (options) => ipcRenderer.invoke('chat:list-conversations', options),
    getMessages: (conversationId?: string) => ipcRenderer.invoke('chat:get-messages', conversationId),
    sendMessage: (content: string, options) => ipcRenderer.invoke('chat:send-message', content, options),
    endConversation: () => ipcRenderer.invoke('chat:end-conversation'),
    archiveConversation: (conversationId: string) => ipcRenderer.invoke('chat:archive-conversation', conversationId),
    searchMessages: (query: string) => ipcRenderer.invoke('chat:search-messages', query),
    getStats: () => ipcRenderer.invoke('chat:stats'),
    updateConfig: (updates) => ipcRenderer.invoke('chat:update-config', updates),
    onMessage: (callback: (event: ChatEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, chatEvent: ChatEvent) => {
        callback(chatEvent);
      };
      ipcRenderer.on('chat:message', handler);
      return () => {
        ipcRenderer.removeListener('chat:message', handler);
      };
    },
    onToolExecuted: (callback: (event: ChatEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, chatEvent: ChatEvent) => {
        callback(chatEvent);
      };
      ipcRenderer.on('chat:tool-executed', handler);
      return () => {
        ipcRenderer.removeListener('chat:tool-executed', handler);
      };
    },
    onError: (callback: (event: ChatEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, chatEvent: ChatEvent) => {
        callback(chatEvent);
      };
      ipcRenderer.on('chat:error', handler);
      return () => {
        ipcRenderer.removeListener('chat:error', handler);
      };
    },
  },

  // Agent Council
  agents: {
    // Agent queries
    listAgents: () => ipcRenderer.invoke('agents:list'),
    getAgent: (agentId: string) => ipcRenderer.invoke('agents:get', agentId),

    // Proposal management
    getPendingProposals: (projectId?: string) => ipcRenderer.invoke('agents:proposals:pending', projectId),
    approveProposal: (proposalId: string) => ipcRenderer.invoke('agents:proposals:approve', proposalId),
    rejectProposal: (proposalId: string, reason?: string) => ipcRenderer.invoke('agents:proposals:reject', proposalId, reason),

    // Task dispatch
    requestTask: (request: AgentTaskRequest) => ipcRenderer.invoke('agents:task:request', request),
    getTaskStatus: (taskId: string) => ipcRenderer.invoke('agents:task:status', taskId),

    // Session management
    startSession: (projectId?: string) => ipcRenderer.invoke('agents:session:start', projectId),
    endSession: (sessionId: string, summary?: string) => ipcRenderer.invoke('agents:session:end', sessionId, summary),

    // Stats
    getStats: () => ipcRenderer.invoke('agents:stats'),

    // Event subscriptions
    onProposal: (callback: (event: AgentEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, agentEvent: AgentEvent) => {
        callback(agentEvent);
      };
      ipcRenderer.on('agents:proposal', handler);
      return () => {
        ipcRenderer.removeListener('agents:proposal', handler);
      };
    },
    onAgentStatus: (callback: (event: AgentEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, agentEvent: AgentEvent) => {
        callback(agentEvent);
      };
      ipcRenderer.on('agents:status', handler);
      return () => {
        ipcRenderer.removeListener('agents:status', handler);
      };
    },
    onSessionEvent: (callback: (event: AgentEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, agentEvent: AgentEvent) => {
        callback(agentEvent);
      };
      ipcRenderer.on('agents:session', handler);
      return () => {
        ipcRenderer.removeListener('agents:session', handler);
      };
    },
  },
} as ElectronAPI);

// Flag to detect Electron environment
contextBridge.exposeInMainWorld('isElectron', true);
