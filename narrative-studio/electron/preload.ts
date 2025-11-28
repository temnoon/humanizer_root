import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script - runs in renderer context with access to Node.js
 * Exposes a safe API to the renderer via contextBridge
 */

// Types for the exposed API
export interface ElectronAPI {
  // Store operations
  store: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<boolean>;
  };

  // App info
  getArchiveServerPort: () => Promise<number | null>;
  getPaths: () => Promise<{
    documents: string;
    userData: string;
    temp: string;
    logs: string;
    home: string;
  }>;
  isFirstRun: () => Promise<boolean>;
  completeFirstRun: () => Promise<boolean>;
  getPlatformInfo: () => Promise<{
    platform: NodeJS.Platform;
    arch: string;
    version: string;
    isPackaged: boolean;
  }>;

  // Archive management
  getArchivePath: () => Promise<string | null>;
  restartArchiveServer: (newPath: string) => Promise<{ success: boolean; port?: number; error?: string }>;

  // File dialogs
  selectFolder: () => Promise<string | null>;
  selectArchive: () => Promise<string | null>;
  getDiskSpace: (path: string) => Promise<{ free: number; total: number }>;

  // Ollama operations
  ollama: {
    getStatus: () => Promise<OllamaStatus>;
    startServer: () => Promise<boolean>;
    stopServer: () => Promise<boolean>;
    pullModel: (name: string, onProgress?: (progress: number) => void) => Promise<boolean>;
    listModels: () => Promise<OllamaModel[]>;
  };

  // Event listeners
  onArchiveServerReady: (callback: (port: number) => void) => void;
  onOllamaProgress: (callback: (progress: OllamaProgress) => void) => void;
  removeAllListeners: (channel: string) => void;
}

export interface OllamaStatus {
  installed: boolean;
  running: boolean;
  version?: string;
  endpoint: string;
}

export interface OllamaModel {
  name: string;
  size: number;
  modified: string;
  digest: string;
}

export interface OllamaProgress {
  model: string;
  status: string;
  completed: number;
  total: number;
  percent: number;
}

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Store operations
  store: {
    get: (key: string) => ipcRenderer.invoke('store-get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store-set', key, value)
  },

  // App info
  getArchiveServerPort: () => ipcRenderer.invoke('get-archive-server-port'),
  getPaths: () => ipcRenderer.invoke('get-paths'),
  isFirstRun: () => ipcRenderer.invoke('is-first-run'),
  completeFirstRun: () => ipcRenderer.invoke('complete-first-run'),
  getPlatformInfo: () => ipcRenderer.invoke('get-platform-info'),

  // Archive management
  getArchivePath: () => ipcRenderer.invoke('get-archive-path'),
  restartArchiveServer: (newPath: string) => ipcRenderer.invoke('restart-archive-server', newPath),

  // File dialogs
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectArchive: () => ipcRenderer.invoke('select-archive'),
  getDiskSpace: (path: string) => ipcRenderer.invoke('get-disk-space', path),

  // Ollama operations
  ollama: {
    getStatus: () => ipcRenderer.invoke('ollama-status'),
    startServer: () => ipcRenderer.invoke('ollama-start'),
    stopServer: () => ipcRenderer.invoke('ollama-stop'),
    pullModel: (name: string) => ipcRenderer.invoke('ollama-pull', name),
    listModels: () => ipcRenderer.invoke('ollama-list-models')
  },

  // Event listeners
  onArchiveServerReady: (callback: (port: number) => void) => {
    ipcRenderer.on('archive-server-ready', (_event, port) => callback(port));
  },
  onOllamaProgress: (callback: (progress: OllamaProgress) => void) => {
    ipcRenderer.on('ollama-progress', (_event, progress) => callback(progress));
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
} as ElectronAPI);

// Also expose a way to check if running in Electron
contextBridge.exposeInMainWorld('isElectron', true);
