import { contextBridge as s, ipcRenderer as e } from "electron";
s.exposeInMainWorld("electronAPI", {
  // Store operations
  store: {
    get: (r) => e.invoke("store-get", r),
    set: (r, t) => e.invoke("store-set", r, t)
  },
  // App info
  getArchiveServerPort: () => e.invoke("get-archive-server-port"),
  getPaths: () => e.invoke("get-paths"),
  isFirstRun: () => e.invoke("is-first-run"),
  completeFirstRun: () => e.invoke("complete-first-run"),
  getPlatformInfo: () => e.invoke("get-platform-info"),
  // Archive management
  getArchivePath: () => e.invoke("get-archive-path"),
  restartArchiveServer: (r) => e.invoke("restart-archive-server", r),
  // File dialogs
  selectFolder: () => e.invoke("select-folder"),
  selectArchive: () => e.invoke("select-archive"),
  getDiskSpace: (r) => e.invoke("get-disk-space", r),
  // Ollama operations
  ollama: {
    getStatus: () => e.invoke("ollama-status"),
    startServer: () => e.invoke("ollama-start"),
    stopServer: () => e.invoke("ollama-stop"),
    pullModel: (r) => e.invoke("ollama-pull", r),
    listModels: () => e.invoke("ollama-list-models")
  },
  // Event listeners
  onArchiveServerReady: (r) => {
    e.on("archive-server-ready", (t, o) => r(o));
  },
  onOllamaProgress: (r) => {
    e.on("ollama-progress", (t, o) => r(o));
  },
  removeAllListeners: (r) => {
    e.removeAllListeners(r);
  }
});
s.exposeInMainWorld("isElectron", !0);
//# sourceMappingURL=preload.js.map
