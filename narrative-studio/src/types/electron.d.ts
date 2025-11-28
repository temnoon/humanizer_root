/**
 * Electron API types exposed via preload
 */

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

export interface AppPaths {
  documents: string;
  userData: string;
  temp: string;
  logs: string;
  home: string;
}

export interface PlatformInfo {
  platform: NodeJS.Platform;
  arch: string;
  version: string;
  isPackaged: boolean;
}

export interface ElectronAPI {
  // Store operations
  store: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<boolean>;
  };

  // App info
  getArchiveServerPort: () => Promise<number | null>;
  getPaths: () => Promise<AppPaths>;
  isFirstRun: () => Promise<boolean>;
  completeFirstRun: () => Promise<boolean>;
  getPlatformInfo: () => Promise<PlatformInfo>;

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
    pullModel: (name: string) => Promise<boolean>;
    listModels: () => Promise<OllamaModel[]>;
  };

  // Event listeners
  onArchiveServerReady: (callback: (port: number) => void) => void;
  onOllamaProgress: (callback: (progress: OllamaProgress) => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    isElectron?: boolean;
  }
}

export {};
