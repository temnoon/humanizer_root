/**
 * Humanizer Desktop - Electron Main Process
 *
 * Features:
 * - macOS title bar with traffic lights
 * - Optional: Archive server for local archive browsing
 * - Optional: Ollama for local LLM transformations
 */

import { app, BrowserWindow, shell, ipcMain, dialog, protocol, net } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { createServer } from 'net';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Store = require('electron-store');

// Queue system
import { initQueueManager, getQueueManager, type QueueJobSpec, type JobQueryOptions } from './queue';

// Chat service
import { getChatService, closeChatService, type ChatServiceConfig, type SendMessageOptions } from './chat';

// Agent Council
import { getCouncilOrchestrator, type CouncilOrchestrator, type ProposedAction, type TaskOptions } from './agents/council/orchestrator';
import { getAgentRegistry } from './agents/runtime/registry';

// Set app name for macOS menu bar (development mode)
// In production, this comes from electron-builder.json productName
app.name = 'Humanizer';

// Paths
const RENDERER_DEV_URL = process.env.VITE_DEV_SERVER_URL;
const DIST = path.join(__dirname, '../apps/web/dist');

// Initialize store for persistent settings
const store = new Store({
  name: 'humanizer-desktop',
  defaults: {
    windowBounds: { width: 1400, height: 900, x: undefined, y: undefined },
    archiveServerEnabled: false,
    archivePath: null,
    ollamaEnabled: false,
    ollamaModel: 'llama3.2:3b',
    firstRunComplete: false,
  },
});

// Keep references to prevent garbage collection
let mainWindow: BrowserWindow | null = null;
let archiveServerProcess: ChildProcess | null = null;
let archiveServerPort: number | null = null;

// ============================================================
// WINDOW MANAGEMENT
// ============================================================

async function createWindow() {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1024,
    minHeight: 768,
    // macOS title bar - shows traffic lights, hides title
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
    backgroundColor: '#fafaf9',
  });

  // Save window bounds on resize/move
  mainWindow.on('resized', saveBounds);
  mainWindow.on('moved', saveBounds);

  // Show when ready
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Load the app
  if (RENDERER_DEV_URL) {
    await mainWindow.loadURL(RENDERER_DEV_URL);
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(DIST, 'index.html'));
  }
}

function saveBounds() {
  if (mainWindow) {
    store.set('windowBounds', mainWindow.getBounds());
  }
}

// ============================================================
// ARCHIVE SERVER (Optional)
// ============================================================

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error('Could not get port'));
      }
    });
    server.on('error', reject);
  });
}

async function checkServerRunning(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function startArchiveServer(): Promise<number | null> {
  if (!store.get('archiveServerEnabled')) {
    console.log('Archive server disabled');
    return null;
  }

  const devPort = 3002;
  if (!app.isPackaged) {
    const externalRunning = await checkServerRunning(devPort);
    if (externalRunning) {
      console.log(`Using external archive server on port ${devPort}`);
      archiveServerPort = devPort;
      return devPort;
    }
  }

  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, 'archive-server.js')
    : path.join(__dirname, '../../narrative-studio/archive-server.js');

  if (!fs.existsSync(serverPath)) {
    console.warn('Archive server not found at:', serverPath);
    return null;
  }

  const port = app.isPackaged ? await findFreePort() : devPort;
  const archivePath = store.get('archivePath');

  console.log(`Starting archive server on port ${port}...`);

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PORT: port.toString(),
  };

  if (archivePath) {
    env.ARCHIVE_PATH = archivePath;
  }

  const command = app.isPackaged ? 'node' : 'npx';
  const args = app.isPackaged ? [serverPath] : ['tsx', serverPath];

  archiveServerProcess = spawn(command, args, {
    env,
    cwd: path.dirname(serverPath),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  archiveServerProcess.stdout?.on('data', (data) => {
    console.log(`[Archive] ${data}`);
  });

  archiveServerProcess.stderr?.on('data', (data) => {
    console.error(`[Archive Error] ${data}`);
  });

  archiveServerProcess.on('exit', (code) => {
    console.log(`Archive server exited (${code})`);
    archiveServerProcess = null;
  });

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await checkServerRunning(port)) {
      console.log('Archive server ready');
      archiveServerPort = port;
      return port;
    }
  }

  console.error('Archive server failed to start');
  return null;
}

function stopArchiveServer() {
  if (archiveServerProcess) {
    archiveServerProcess.kill();
    archiveServerProcess = null;
    archiveServerPort = null;
  }
}

// ============================================================
// IPC HANDLERS
// ============================================================

function registerIPCHandlers() {
  // Store
  ipcMain.handle('store:get', (_e, key: string) => store.get(key));
  ipcMain.handle('store:set', (_e, key: string, value: unknown) => {
    store.set(key, value);
    return true;
  });

  // App Info
  ipcMain.handle('app:paths', () => ({
    documents: app.getPath('documents'),
    userData: app.getPath('userData'),
    home: app.getPath('home'),
    temp: app.getPath('temp'),
  }));

  ipcMain.handle('app:info', () => ({
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    isPackaged: app.isPackaged,
  }));

  ipcMain.handle('app:is-first-run', () => !store.get('firstRunComplete'));
  ipcMain.handle('app:complete-first-run', () => {
    store.set('firstRunComplete', true);
    return true;
  });

  // File Dialogs
  ipcMain.handle('dialog:select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:select-file', async (_e, options?: { filters?: Electron.FileFilter[] }) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: options?.filters,
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Archive Server
  ipcMain.handle('archive:port', () => archiveServerPort);
  ipcMain.handle('archive:enabled', () => store.get('archiveServerEnabled'));

  ipcMain.handle('archive:enable', async (_e, archivePath?: string) => {
    store.set('archiveServerEnabled', true);
    if (archivePath) {
      store.set('archivePath', archivePath);
    }
    const port = await startArchiveServer();
    return { success: !!port, port };
  });

  ipcMain.handle('archive:disable', () => {
    store.set('archiveServerEnabled', false);
    stopArchiveServer();
    return { success: true };
  });

  ipcMain.handle('archive:restart', async (_e, newPath?: string) => {
    if (newPath) {
      store.set('archivePath', newPath);
    }
    stopArchiveServer();
    const port = await startArchiveServer();
    return { success: !!port, port };
  });

  // Ollama
  ipcMain.handle('ollama:enabled', () => store.get('ollamaEnabled'));
  ipcMain.handle('ollama:enable', () => {
    store.set('ollamaEnabled', true);
    return true;
  });
  ipcMain.handle('ollama:disable', () => {
    store.set('ollamaEnabled', false);
    return true;
  });

  ipcMain.handle('ollama:status', async () => {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        return { installed: true, running: true };
      }
    } catch {
      // Not running
    }
    return { installed: false, running: false };
  });

  // Cloud drives - stubs
  ipcMain.handle('cloud:list-drives', () => []);
  ipcMain.handle('cloud:google:connect', () => ({ success: false, error: 'Not implemented' }));
  ipcMain.handle('cloud:google:is-connected', () => false);
  ipcMain.handle('cloud:google:disconnect', () => ({ success: true }));
  ipcMain.handle('cloud:google:list', () => ({ success: false, error: 'Not implemented' }));
  ipcMain.handle('cloud:google:search', () => ({ success: false, error: 'Not implemented' }));
  ipcMain.handle('cloud:google:download', () => ({ success: false, error: 'Not implemented' }));

  // ============================================================
  // QUEUE SYSTEM
  // ============================================================

  // Initialize queue manager with store for persistence
  const queueManager = initQueueManager({ store });

  // Forward queue events to renderer
  queueManager.onEvent((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('queue:event', event);
    }
  });

  // Job lifecycle
  ipcMain.handle('queue:create-job', async (_e, spec: QueueJobSpec) => {
    return queueManager.createJob(spec);
  });

  ipcMain.handle('queue:get-job', (_e, jobId: string) => {
    return queueManager.getJob(jobId);
  });

  ipcMain.handle('queue:list-jobs', (_e, options?: JobQueryOptions) => {
    return queueManager.listJobs(options);
  });

  ipcMain.handle('queue:cancel-job', async (_e, jobId: string) => {
    return queueManager.cancelJob(jobId);
  });

  ipcMain.handle('queue:delete-job', (_e, jobId: string) => {
    return queueManager.deleteJob(jobId);
  });

  // Queue control
  ipcMain.handle('queue:pause', () => {
    queueManager.pauseQueue();
    return true;
  });

  ipcMain.handle('queue:resume', () => {
    queueManager.resumeQueue();
    return true;
  });

  ipcMain.handle('queue:state', () => {
    return queueManager.getState();
  });

  console.log('IPC handlers registered (including queue system)');

  // ============================================================
  // CHAT SERVICE
  // ============================================================

  // Initialize chat service
  const chatDbPath = path.join(app.getPath('userData'), 'chat.db');
  const chatConfig: ChatServiceConfig = {
    dbPath: chatDbPath,
    llm: {
      provider: 'ollama',
      model: store.get('ollamaModel') || 'llama3.2',
      baseUrl: 'http://localhost:11434',
    },
    archiveUrl: archiveServerPort ? `http://localhost:${archiveServerPort}` : undefined,
    autoArchive: true,
  };

  const chatService = getChatService(chatConfig);

  // Forward chat events to renderer
  chatService.on('message:created', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat:message', event);
    }
  });

  chatService.on('tool:executed', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat:tool-executed', event);
    }
  });

  chatService.on('error', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat:error', event);
    }
  });

  // Chat IPC handlers
  ipcMain.handle('chat:start-conversation', (_e, options?: { projectId?: string; tags?: string[] }) => {
    return chatService.startConversation(options);
  });

  ipcMain.handle('chat:get-conversation', () => {
    return chatService.getCurrentConversation();
  });

  ipcMain.handle('chat:load-conversation', (_e, id: string) => {
    return chatService.loadConversation(id);
  });

  ipcMain.handle('chat:list-conversations', (_e, options?: { limit?: number; projectId?: string }) => {
    return chatService.listConversations(options);
  });

  ipcMain.handle('chat:get-messages', (_e, conversationId?: string) => {
    return chatService.getMessages(conversationId);
  });

  ipcMain.handle('chat:send-message', async (_e, content: string, options?: SendMessageOptions) => {
    return chatService.sendMessage(content, options);
  });

  ipcMain.handle('chat:end-conversation', () => {
    chatService.endConversation();
    return { success: true };
  });

  ipcMain.handle('chat:archive-conversation', async (_e, conversationId: string) => {
    await chatService.archiveConversation(conversationId);
    return { success: true };
  });

  ipcMain.handle('chat:search-messages', (_e, query: string) => {
    return chatService.searchMessages(query);
  });

  ipcMain.handle('chat:stats', () => {
    return chatService.getStats();
  });

  ipcMain.handle('chat:update-config', (_e, updates: Partial<ChatServiceConfig>) => {
    chatService.updateConfig(updates);
    return { success: true };
  });

  console.log('Chat service initialized');

  // ============================================================
  // AGENT COUNCIL
  // ============================================================

  // Initialize orchestrator
  const orchestrator = getCouncilOrchestrator();
  const agentRegistry = getAgentRegistry();

  // Initialize orchestrator (will start agents)
  orchestrator.initialize().catch((err) => {
    console.error('Failed to initialize agent orchestrator:', err);
  });

  // Forward orchestrator events to renderer
  orchestrator.onEvent((event) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const timestamp = Date.now();

    switch (event.type) {
      case 'proposal:created':
        // Transform proposal to renderer format
        const proposal = (event as { proposal?: { id: string; agentId: string; actionType: string; title: string; description?: string; payload?: unknown; projectId?: string; urgency?: string; createdAt: number; expiresAt?: number; status: string } }).proposal;
        if (proposal) {
          const agent = agentRegistry.get(proposal.agentId);
          mainWindow.webContents.send('agents:proposal', {
            type: 'proposal:received',
            proposal: {
              id: proposal.id,
              agentId: proposal.agentId,
              agentName: agent?.name || proposal.agentId,
              actionType: proposal.actionType,
              title: proposal.title,
              description: proposal.description,
              payload: proposal.payload,
              urgency: proposal.urgency || 'normal',
              projectId: proposal.projectId,
              createdAt: proposal.createdAt,
              expiresAt: proposal.expiresAt,
              status: proposal.status,
            },
            timestamp,
          });
        }
        break;

      case 'proposal:approved':
      case 'proposal:rejected':
        mainWindow.webContents.send('agents:proposal', {
          type: event.type,
          proposalId: (event as { proposalId?: string }).proposalId,
          timestamp,
        });
        break;

      case 'session:started':
      case 'session:ended':
      case 'session:paused':
      case 'session:resumed':
        mainWindow.webContents.send('agents:session', {
          type: event.type,
          sessionId: (event as { sessionId?: string }).sessionId,
          projectId: (event as { projectId?: string }).projectId,
          timestamp,
        });
        break;
    }
  });

  // Agent IPC handlers
  ipcMain.handle('agents:list', () => {
    const agents = agentRegistry.list();
    return agents.map((a) => ({
      id: a.id,
      name: a.name,
      house: a.house,
      status: a.status,
      capabilities: a.capabilities || [],
    }));
  });

  ipcMain.handle('agents:get', (_e, agentId: string) => {
    const agent = agentRegistry.get(agentId);
    if (!agent) return null;
    return {
      id: agent.id,
      name: agent.name,
      house: agent.house,
      status: agent.status,
      capabilities: agent.capabilities || [],
    };
  });

  // Proposal handlers
  ipcMain.handle('agents:proposals:pending', (_e, projectId?: string) => {
    const proposals = orchestrator.getPendingProposals(projectId);
    return proposals.map((p) => {
      const agent = agentRegistry.get(p.agentId);
      return {
        id: p.id,
        agentId: p.agentId,
        agentName: agent?.name || p.agentId,
        actionType: p.actionType,
        title: p.title,
        description: p.description,
        payload: p.payload,
        urgency: p.urgency || 'normal',
        projectId: p.projectId,
        createdAt: p.createdAt,
        expiresAt: p.expiresAt,
        status: p.status,
      };
    });
  });

  ipcMain.handle('agents:proposals:approve', async (_e, proposalId: string) => {
    try {
      await orchestrator.approveProposal(proposalId, 'user');
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('agents:proposals:reject', async (_e, proposalId: string, reason?: string) => {
    try {
      await orchestrator.rejectProposal(proposalId, 'user');
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Task handlers
  ipcMain.handle('agents:task:request', async (_e, request: { agentId: string; taskType: string; payload: unknown; projectId?: string }) => {
    try {
      const taskId = await orchestrator.assignTask({
        targetAgent: request.agentId,
        type: request.taskType,
        payload: request.payload,
        projectId: request.projectId,
        priority: 5, // Default medium priority
      });
      return { taskId };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('agents:task:status', (_e, taskId: string) => {
    const task = orchestrator.getTaskStatus(taskId);
    if (!task) return { status: 'not_found' };
    return {
      status: task.status,
      result: task.result,
      error: task.error,
    };
  });

  // Session handlers
  ipcMain.handle('agents:session:start', async (_e, projectId?: string) => {
    const session = await orchestrator.startSession(projectId);
    return { sessionId: session.id };
  });

  ipcMain.handle('agents:session:end', async (_e, sessionId: string, summary?: string) => {
    await orchestrator.endSession(sessionId, summary);
    return { success: true };
  });

  // Stats
  ipcMain.handle('agents:stats', () => {
    const stats = orchestrator.getStats();
    return {
      activeSessions: stats.activeSessions,
      pendingProposals: stats.pendingProposals,
      registeredAgents: stats.registeredAgents,
      activeAgents: stats.activeAgents,
    };
  });

  console.log('Agent council initialized');
}

// ============================================================
// CUSTOM PROTOCOL FOR LOCAL MEDIA
// ============================================================

// Register the scheme as privileged (must be before app ready)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function registerLocalMediaProtocol() {
  // Handle local-media:// URLs by serving files directly from disk
  // URL format: local-media://serve/<absolute-path-to-file>
  protocol.handle('local-media', async (request) => {
    try {
      // Parse the URL - format: local-media://serve/path/to/file.jpg
      const url = new URL(request.url);
      // The pathname will be like /serve/Users/tem/path/file.jpg
      // Remove the leading /serve/ to get the actual path
      let filePath = decodeURIComponent(url.pathname);

      // Remove leading /serve/ if present
      if (filePath.startsWith('/serve/')) {
        filePath = '/' + filePath.slice(7); // Keep the leading / for absolute path
      } else if (filePath.startsWith('/serve')) {
        filePath = '/' + filePath.slice(6);
      }

      // Security: only allow serving from known safe directories
      // For now, allow any absolute path (Electron app is trusted)
      // In production, you might want to restrict to specific directories

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return new Response('File not found', { status: 404 });
      }

      // Get MIME type based on extension
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg',
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';

      // Use net.fetch with file:// URL for efficient streaming
      const fileUrl = pathToFileURL(filePath).href;
      const response = await net.fetch(fileUrl);

      // Return with proper content type
      return new Response(response.body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        },
      });
    } catch (error) {
      console.error('Error serving local media:', error);
      return new Response('Internal error', { status: 500 });
    }
  });

  console.log('Local media protocol registered');
}

// ============================================================
// APP LIFECYCLE
// ============================================================

app.whenReady().then(async () => {
  console.log('Humanizer Desktop starting...');

  // Register custom protocol for local file serving
  registerLocalMediaProtocol();

  registerIPCHandlers();

  if (store.get('archiveServerEnabled')) {
    await startArchiveServer();
  }

  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  console.log('Shutting down...');
  stopArchiveServer();
  closeChatService();
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
