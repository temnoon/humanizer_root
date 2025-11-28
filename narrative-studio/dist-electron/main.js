import { ipcMain as a, BrowserWindow as m, dialog as k, app as o, shell as C } from "electron";
import { fileURLToPath as I } from "node:url";
import s from "node:path";
import { spawn as O, execSync as D } from "node:child_process";
import { createServer as F } from "node:net";
import R from "electron-store";
import { statfs as W } from "node:fs/promises";
import { existsSync as E } from "node:fs";
function z() {
  a.handle("select-folder", async () => {
    const t = m.getFocusedWindow(), e = await k.showOpenDialog(t, {
      properties: ["openDirectory", "createDirectory"],
      title: "Select Archive Folder",
      buttonLabel: "Select"
    });
    return e.canceled || e.filePaths.length === 0 ? null : e.filePaths[0];
  }), a.handle("select-archive", async () => {
    const t = m.getFocusedWindow(), e = await k.showOpenDialog(t, {
      properties: ["openFile", "openDirectory"],
      title: "Select Archive",
      buttonLabel: "Import",
      filters: [
        { name: "Archives", extensions: ["zip"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    return e.canceled || e.filePaths.length === 0 ? null : e.filePaths[0];
  }), a.handle("get-disk-space", async (t, e) => {
    try {
      let r = e;
      for (; !E(r) && r !== s.dirname(r); )
        r = s.dirname(r);
      const n = await W(r);
      return {
        free: n.bfree * n.bsize,
        total: n.blocks * n.bsize
      };
    } catch (r) {
      return console.error("Failed to get disk space:", r), {
        free: 0,
        total: 0
      };
    }
  });
}
function H() {
  a.handle("detect-archive", async (t, e) => {
    const { detectArchiveType: r } = await import("./archive-detector-B0OossDK.js");
    return r(e);
  }), a.handle("validate-archive-path", async (t, e) => {
    try {
      if (!E(e))
        return { valid: !1, error: "Path does not exist" };
      const r = s.dirname(e);
      try {
        return await import("node:fs/promises").then((n) => n.access(r, n.constants.W_OK)), { valid: !0 };
      } catch {
        return { valid: !1, error: "Cannot write to directory" };
      }
    } catch (r) {
      return { valid: !1, error: String(r) };
    }
  });
}
function B() {
  z(), H();
}
const v = "http://localhost:11434";
let g = null;
function _() {
  try {
    return D("which ollama", { stdio: "ignore" }), !0;
  } catch {
    return !1;
  }
}
function L() {
  try {
    const e = D("ollama --version", { encoding: "utf-8" }).match(/(\d+\.\d+\.\d+)/);
    return e ? e[1] : null;
  } catch {
    return null;
  }
}
async function b() {
  try {
    return (await fetch(`${v}/api/tags`)).ok;
  } catch {
    return !1;
  }
}
async function N() {
  const t = _(), e = await b(), r = t ? L() : void 0;
  return {
    installed: t,
    running: e,
    version: r ?? void 0,
    endpoint: v
  };
}
async function U() {
  return await b() ? !0 : _() ? new Promise((t) => {
    try {
      g = O("ollama", ["serve"], {
        detached: !0,
        stdio: "ignore"
      }), g.unref();
      let e = 0;
      const r = setInterval(async () => {
        e++, await b() ? (clearInterval(r), t(!0)) : e > 10 && (clearInterval(r), t(!1));
      }, 500);
    } catch (e) {
      console.error("Failed to start Ollama:", e), t(!1);
    }
  }) : !1;
}
async function V() {
  return g ? (g.kill(), g = null, !0) : !1;
}
async function M() {
  try {
    const t = await fetch(`${v}/api/tags`);
    return t.ok ? ((await t.json()).models || []).map((r) => ({
      name: r.name,
      size: r.size,
      modified: r.modified_at,
      digest: r.digest
    })) : [];
  } catch {
    return [];
  }
}
async function J(t, e) {
  try {
    const r = await fetch(`${v}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: t })
    });
    if (!r.ok || !r.body)
      return !1;
    const n = r.body.getReader(), p = new TextDecoder();
    for (; ; ) {
      const { done: S, value: w } = await n.read();
      if (S) break;
      const $ = p.decode(w, { stream: !0 }).split(`
`).filter(Boolean);
      for (const T of $)
        try {
          const u = JSON.parse(T);
          if (e && u.total && e({
            model: t,
            status: u.status || "downloading",
            completed: u.completed || 0,
            total: u.total || 0,
            percent: u.total ? Math.round(u.completed / u.total * 100) : 0
          }), u.status === "success")
            return !0;
        } catch {
        }
    }
    return !0;
  } catch (r) {
    return console.error("Failed to pull model:", r), !1;
  }
}
async function q(t, e = "llama3.2:3b") {
  const r = await fetch(`${v}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: e,
      prompt: t,
      stream: !1
    })
  });
  if (!r.ok)
    throw new Error(`Ollama generate failed: ${r.statusText}`);
  return (await r.json()).response;
}
function K() {
  a.handle("ollama-status", async () => N()), a.handle("ollama-start", async () => U()), a.handle("ollama-stop", async () => V()), a.handle("ollama-list-models", async () => M()), a.handle("ollama-pull", async (t, e) => {
    const r = m.fromWebContents(t.sender);
    return J(e, (n) => {
      r?.webContents.send("ollama-progress", n);
    });
  }), a.handle("ollama-generate", async (t, e, r) => q(e, r));
}
const G = new R(), h = {
  /**
   * Default archive storage location
   * User can customize this during setup
   */
  archives: () => {
    const t = G.get("archivePath");
    return t || s.join(o.getPath("documents"), "Humanizer Archives");
  },
  /**
   * Session data storage (history buffer, pinned items, etc.)
   */
  sessions: () => s.join(o.getPath("userData"), "sessions"),
  /**
   * Downloaded ML models (if we ever bundle any locally)
   */
  models: () => s.join(o.getPath("userData"), "models"),
  /**
   * Temporary file storage (uploads, extractions, etc.)
   */
  temp: () => s.join(o.getPath("temp"), "humanizer-studio"),
  /**
   * Application logs
   */
  logs: () => s.join(o.getPath("logs"), "humanizer-studio"),
  /**
   * User data directory (settings, cache, etc.)
   */
  userData: () => o.getPath("userData"),
  /**
   * Get the path to a specific archive by name
   */
  archive: (t) => s.join(h.archives(), t),
  /**
   * Get the embeddings database path for an archive
   */
  archiveEmbeddings: (t) => s.join(h.archive(t), ".embeddings.db"),
  /**
   * Get the config file path for an archive
   */
  archiveConfig: (t) => s.join(h.archive(t), "archive-config.json")
};
async function f(t) {
  const { mkdir: e } = await import("node:fs/promises");
  await e(t, { recursive: !0 });
}
async function Q() {
  await Promise.all([
    f(h.archives()),
    f(h.sessions()),
    f(h.models()),
    f(h.temp()),
    f(h.logs())
  ]);
}
const X = I(import.meta.url), P = s.dirname(X), x = process.env.VITE_DEV_SERVER_URL, Y = s.join(P, "../dist");
s.join(P, "../dist-electron");
const c = new R({
  defaults: {
    archivePath: null,
    ollamaModel: "llama3.2:3b",
    provider: "local",
    cloudToken: null,
    firstRunComplete: !1,
    windowBounds: { width: 1400, height: 900, x: void 0, y: void 0 }
  }
});
let i = null, l = null, y = null;
async function Z() {
  return new Promise((t, e) => {
    const r = F();
    r.listen(0, () => {
      const n = r.address();
      if (n && typeof n == "object") {
        const p = n.port;
        r.close(() => t(p));
      } else
        e(new Error("Could not get port"));
    }), r.on("error", e);
  });
}
async function ee(t) {
  try {
    return (await fetch(`http://localhost:${t}/health`)).ok;
  } catch {
    return !1;
  }
}
async function A() {
  if (!o.isPackaged) {
    if (await ee(3002))
      return console.log("Using external archive server on port 3002"), y = 3002, 3002;
    console.log("No external archive server found, starting internal server...");
  }
  const e = o.isPackaged ? await Z() : 3002, r = o.isPackaged ? s.join(process.resourcesPath, "archive-server.js") : s.join(P, "../archive-server.js");
  console.log(`Starting archive server on port ${e}...`), console.log(`Server path: ${r}`);
  const n = c.get("archivePath");
  n && console.log(`Using archive path from settings: ${n}`);
  const p = o.isPackaged ? "node" : "npx", S = o.isPackaged ? [r] : ["tsx", r], w = {
    ...process.env,
    PORT: e.toString(),
    NODE_OPTIONS: "--max-old-space-size=8192"
  };
  return n && (w.ARCHIVE_PATH = n), l = O(p, S, {
    env: w,
    cwd: s.dirname(r),
    stdio: ["ignore", "pipe", "pipe"],
    detached: !1
  }), l.stdout?.on("data", (d) => {
    console.log(`[Archive Server] ${d}`);
  }), l.stderr?.on("data", (d) => {
    console.error(`[Archive Server Error] ${d}`);
  }), l.on("error", (d) => {
    console.error("Failed to start archive server:", d);
  }), l.on("exit", (d) => {
    console.log(`Archive server exited with code ${d}`), l = null;
  }), await te(e), y = e, e;
}
async function te(t, e = 30) {
  for (let r = 0; r < e; r++) {
    try {
      if ((await fetch(`http://localhost:${t}/api/archives`)).ok) {
        console.log(`Archive server ready on port ${t}`);
        return;
      }
    } catch {
    }
    await new Promise((n) => setTimeout(n, 500));
  }
  throw new Error("Archive server failed to start");
}
async function j() {
  const t = c.get("windowBounds");
  i = new m({
    width: t.width,
    height: t.height,
    x: t.x,
    y: t.y,
    minWidth: 1024,
    minHeight: 768,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: s.join(P, "preload.js"),
      nodeIntegration: !1,
      contextIsolation: !0,
      sandbox: !1
      // Required for better-sqlite3
    },
    show: !1,
    // Don't show until ready
    backgroundColor: "#1a1a2e"
  }), i.on("resized", () => {
    if (i) {
      const e = i.getBounds();
      c.set("windowBounds", e);
    }
  }), i.on("moved", () => {
    if (i) {
      const e = i.getBounds();
      c.set("windowBounds", e);
    }
  }), i.on("ready-to-show", () => {
    i?.show();
  }), i.webContents.setWindowOpenHandler(({ url: e }) => ((e.startsWith("https:") || e.startsWith("http:")) && C.openExternal(e), { action: "deny" })), x ? (await i.loadURL(x), i.webContents.openDevTools()) : await i.loadFile(s.join(Y, "index.html"));
}
function re() {
  a.handle("store-get", (t, e) => c.get(e)), a.handle("store-set", (t, e, r) => (c.set(e, r), !0)), a.handle("get-archive-server-port", () => y), a.handle("get-paths", () => ({
    documents: o.getPath("documents"),
    userData: o.getPath("userData"),
    temp: o.getPath("temp"),
    logs: o.getPath("logs"),
    home: o.getPath("home")
  })), a.handle("is-first-run", () => !c.get("firstRunComplete")), a.handle("complete-first-run", () => (c.set("firstRunComplete", !0), !0)), a.handle("get-platform-info", () => ({
    platform: process.platform,
    arch: process.arch,
    version: o.getVersion(),
    isPackaged: o.isPackaged
  })), a.handle("restart-archive-server", async (t, e) => {
    console.log(`Restarting archive server with new path: ${e}`), c.set("archivePath", e), l && (console.log("Stopping existing archive server..."), l.kill(), l = null, y = null, await new Promise((r) => setTimeout(r, 500)));
    try {
      return { success: !0, port: await A() };
    } catch (r) {
      return console.error("Failed to restart archive server:", r), { success: !1, error: String(r) };
    }
  }), a.handle("get-archive-path", () => c.get("archivePath"));
}
o.whenReady().then(async () => {
  console.log("Humanizer Studio starting..."), await Q(), re(), B(), K();
  try {
    await A();
  } catch (t) {
    console.error("Failed to start archive server:", t);
  }
  await j(), o.on("activate", async () => {
    m.getAllWindows().length === 0 && await j();
  });
});
o.on("window-all-closed", () => {
  process.platform !== "darwin" && o.quit();
});
o.on("before-quit", () => {
  console.log("Shutting down..."), l && (l.kill(), l = null);
});
process.on("uncaughtException", (t) => {
  console.error("Uncaught Exception:", t);
});
process.on("unhandledRejection", (t, e) => {
  console.error("Unhandled Rejection at:", e, "reason:", t);
});
//# sourceMappingURL=main.js.map
