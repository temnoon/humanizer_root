import { ipcMain, BrowserWindow } from 'electron';
import { spawn, ChildProcess, execSync } from 'node:child_process';

const OLLAMA_ENDPOINT = 'http://localhost:11434';

/**
 * Ollama status
 */
export interface OllamaStatus {
  installed: boolean;
  running: boolean;
  version?: string;
  endpoint: string;
}

/**
 * Ollama model info
 */
export interface OllamaModel {
  name: string;
  size: number;
  modified: string;
  digest: string;
}

/**
 * Ollama pull progress
 */
export interface OllamaPullProgress {
  model: string;
  status: string;
  completed: number;
  total: number;
  percent: number;
}

// Keep track of any Ollama process we started
let ollamaProcess: ChildProcess | null = null;

/**
 * Check if Ollama is installed
 */
export function isOllamaInstalled(): boolean {
  try {
    // Check if ollama binary exists in PATH
    execSync('which ollama', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Ollama version
 */
export function getOllamaVersion(): string | null {
  try {
    const output = execSync('ollama --version', { encoding: 'utf-8' });
    // Extract version from output like "ollama version 0.1.23"
    const match = output.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Check if Ollama server is running
 */
export async function isOllamaRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_ENDPOINT}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get full Ollama status
 */
export async function getOllamaStatus(): Promise<OllamaStatus> {
  const installed = isOllamaInstalled();
  const running = await isOllamaRunning();
  const version = installed ? getOllamaVersion() : undefined;

  return {
    installed,
    running,
    version: version ?? undefined,
    endpoint: OLLAMA_ENDPOINT
  };
}

/**
 * Start Ollama server
 */
export async function startOllamaServer(): Promise<boolean> {
  if (await isOllamaRunning()) {
    return true; // Already running
  }

  if (!isOllamaInstalled()) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      ollamaProcess = spawn('ollama', ['serve'], {
        detached: true,
        stdio: 'ignore'
      });

      ollamaProcess.unref();

      // Wait for server to start
      let attempts = 0;
      const checkInterval = setInterval(async () => {
        attempts++;
        if (await isOllamaRunning()) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (attempts > 10) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 500);
    } catch (error) {
      console.error('Failed to start Ollama:', error);
      resolve(false);
    }
  });
}

/**
 * Stop Ollama server (only if we started it)
 */
export async function stopOllamaServer(): Promise<boolean> {
  if (ollamaProcess) {
    ollamaProcess.kill();
    ollamaProcess = null;
    return true;
  }
  return false;
}

/**
 * List installed models
 */
export async function listModels(): Promise<OllamaModel[]> {
  try {
    const response = await fetch(`${OLLAMA_ENDPOINT}/api/tags`);
    if (!response.ok) {
      return [];
    }

    const data = await response.json() as { models?: Array<{ name: string; size: number; modified_at: string; digest: string }> };
    return (data.models || []).map((model) => ({
      name: model.name,
      size: model.size,
      modified: model.modified_at,
      digest: model.digest
    }));
  } catch {
    return [];
  }
}

/**
 * Pull a model with progress updates
 */
export async function pullModel(
  modelName: string,
  onProgress?: (progress: OllamaPullProgress) => void
): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_ENDPOINT}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName })
    });

    if (!response.ok || !response.body) {
      return false;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);

          if (onProgress && data.total) {
            onProgress({
              model: modelName,
              status: data.status || 'downloading',
              completed: data.completed || 0,
              total: data.total || 0,
              percent: data.total ? Math.round((data.completed / data.total) * 100) : 0
            });
          }

          if (data.status === 'success') {
            return true;
          }
        } catch {
          // Ignore JSON parse errors
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to pull model:', error);
    return false;
  }
}

/**
 * Generate text with Ollama
 */
export async function generate(
  prompt: string,
  model: string = 'llama3.2:3b'
): Promise<string> {
  const response = await fetch(`${OLLAMA_ENDPOINT}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama generate failed: ${response.statusText}`);
  }

  const data = await response.json() as { response: string };
  return data.response;
}

/**
 * Register Ollama IPC handlers
 */
export function registerOllamaHandlers() {
  ipcMain.handle('ollama-status', async () => {
    return getOllamaStatus();
  });

  ipcMain.handle('ollama-start', async () => {
    return startOllamaServer();
  });

  ipcMain.handle('ollama-stop', async () => {
    return stopOllamaServer();
  });

  ipcMain.handle('ollama-list-models', async () => {
    return listModels();
  });

  ipcMain.handle('ollama-pull', async (event, modelName: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    return pullModel(modelName, (progress) => {
      // Send progress to renderer
      window?.webContents.send('ollama-progress', progress);
    });
  });

  ipcMain.handle('ollama-generate', async (_event, prompt: string, model?: string) => {
    return generate(prompt, model);
  });
}
