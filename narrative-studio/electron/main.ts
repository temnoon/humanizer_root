import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import Store from 'electron-store';
import { registerAllIPCHandlers } from './ipc-handlers.js';
import { registerOllamaHandlers } from './ollama-manager.js';
import { ensureAppDirectories } from './app-paths.js';

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const RENDERER_DEV_URL = process.env.VITE_DEV_SERVER_URL;
const DIST = path.join(__dirname, '../dist');
const DIST_ELECTRON = path.join(__dirname, '../dist-electron');

// Initialize store for persistent settings
const store = new Store({
  defaults: {
    archivePath: null,
    ollamaModel: 'llama3.2:3b',
    provider: 'local',
    cloudToken: null,
    firstRunComplete: false,
    windowBounds: { width: 1400, height: 900, x: undefined, y: undefined }
  }
});

// Keep references to prevent garbage collection
let mainWindow: BrowserWindow | null = null;
let archiveServerProcess: ChildProcess | null = null;
let archiveServerPort: number | null = null;

/**
 * Find an available port
 */
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

/**
 * Check if archive server is already running
 */
async function checkExternalServer(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Start the archive server as a child process
 */
async function startArchiveServer(): Promise<number> {
  // In development, check if server is already running externally (e.g., via `npx tsx archive-server.js`)
  const devPort = 3002;
  if (!app.isPackaged) {
    const externalRunning = await checkExternalServer(devPort);
    if (externalRunning) {
      console.log(`Using external archive server on port ${devPort}`);
      archiveServerPort = devPort;
      return devPort;
    }
    console.log('No external archive server found, starting internal server...');
  }

  const port = app.isPackaged ? await findFreePort() : devPort;

  // Path to archive-server.js
  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, 'archive-server.js')
    : path.join(__dirname, '../archive-server.js');

  console.log(`Starting archive server on port ${port}...`);
  console.log(`Server path: ${serverPath}`);

  // Get archive path from store (if configured during setup)
  const archivePath = store.get('archivePath') as string | null;
  if (archivePath) {
    console.log(`Using archive path from settings: ${archivePath}`);
  }

  // Use node for packaged app, npx tsx for development
  const command = app.isPackaged ? 'node' : 'npx';
  const args = app.isPackaged ? [serverPath] : ['tsx', serverPath];

  // Build environment with optional ARCHIVE_PATH
  const serverEnv: Record<string, string> = {
    ...process.env as Record<string, string>,
    PORT: port.toString(),
    NODE_OPTIONS: '--max-old-space-size=8192'
  };

  // Only set ARCHIVE_PATH if configured (custom archive mode)
  if (archivePath) {
    serverEnv.ARCHIVE_PATH = archivePath;
  }

  archiveServerProcess = spawn(command, args, {
    env: serverEnv,
    cwd: path.dirname(serverPath),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });

  archiveServerProcess.stdout?.on('data', (data) => {
    console.log(`[Archive Server] ${data}`);
  });

  archiveServerProcess.stderr?.on('data', (data) => {
    console.error(`[Archive Server Error] ${data}`);
  });

  archiveServerProcess.on('error', (err) => {
    console.error('Failed to start archive server:', err);
  });

  archiveServerProcess.on('exit', (code) => {
    console.log(`Archive server exited with code ${code}`);
    archiveServerProcess = null;
  });

  // Wait for server to be ready
  await waitForServer(port);

  archiveServerPort = port;
  return port;
}

/**
 * Wait for server to be ready
 */
async function waitForServer(port: number, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/api/archives`);
      if (response.ok) {
        console.log(`Archive server ready on port ${port}`);
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Archive server failed to start');
}

/**
 * Create the main application window
 */
async function createWindow() {
  // Get saved window bounds
  const bounds = store.get('windowBounds') as { width: number; height: number; x?: number; y?: number };

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1024,
    minHeight: 768,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false // Required for better-sqlite3
    },
    show: false, // Don't show until ready
    backgroundColor: '#1a1a2e'
  });

  // Save window bounds on resize/move
  mainWindow.on('resized', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', bounds);
    }
  });

  mainWindow.on('moved', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', bounds);
    }
  });

  // Show window when ready
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
    // Development: load from Vite dev server
    await mainWindow.loadURL(RENDERER_DEV_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load from dist
    await mainWindow.loadFile(path.join(DIST, 'index.html'));
  }
}

/**
 * Register IPC handlers
 */
function registerIPCHandlers() {
  // Store operations
  ipcMain.handle('store-get', (_event, key: string) => {
    return store.get(key);
  });

  ipcMain.handle('store-set', (_event, key: string, value: unknown) => {
    store.set(key, value);
    return true;
  });

  // Get archive server port
  ipcMain.handle('get-archive-server-port', () => {
    return archiveServerPort;
  });

  // Get app paths
  ipcMain.handle('get-paths', () => {
    return {
      documents: app.getPath('documents'),
      userData: app.getPath('userData'),
      temp: app.getPath('temp'),
      logs: app.getPath('logs'),
      home: app.getPath('home')
    };
  });

  // Check if first run
  ipcMain.handle('is-first-run', () => {
    return !store.get('firstRunComplete');
  });

  // Mark first run complete
  ipcMain.handle('complete-first-run', () => {
    store.set('firstRunComplete', true);
    return true;
  });

  // Get platform info
  ipcMain.handle('get-platform-info', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      version: app.getVersion(),
      isPackaged: app.isPackaged
    };
  });

  // Restart archive server with new path
  ipcMain.handle('restart-archive-server', async (_event, newArchivePath: string) => {
    console.log(`Restarting archive server with new path: ${newArchivePath}`);

    // Update the store
    store.set('archivePath', newArchivePath);

    // Kill existing server if running
    if (archiveServerProcess) {
      console.log('Stopping existing archive server...');
      archiveServerProcess.kill();
      archiveServerProcess = null;
      archiveServerPort = null;

      // Wait a bit for the process to terminate
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Start new server with updated path
    try {
      const port = await startArchiveServer();
      return { success: true, port };
    } catch (error) {
      console.error('Failed to restart archive server:', error);
      return { success: false, error: String(error) };
    }
  });

  // Get current archive path
  ipcMain.handle('get-archive-path', () => {
    return store.get('archivePath') as string | null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  console.log('Humanizer Studio starting...');

  // Ensure app directories exist
  await ensureAppDirectories();

  // Register IPC handlers
  registerIPCHandlers();
  registerAllIPCHandlers();
  registerOllamaHandlers();

  // Start archive server
  try {
    await startArchiveServer();
  } catch (err) {
    console.error('Failed to start archive server:', err);
    // Continue without server - will show error in UI
  }

  // Create main window
  await createWindow();

  // macOS: re-create window when dock icon clicked
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  // On macOS, apps typically stay active until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on quit
app.on('before-quit', () => {
  console.log('Shutting down...');

  // Kill archive server
  if (archiveServerProcess) {
    archiveServerProcess.kill();
    archiveServerProcess = null;
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
