import { ipcMain, dialog, BrowserWindow } from 'electron';
import { statfs } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Register additional IPC handlers for file operations
 * These handlers are registered separately from the core handlers in main.ts
 */
export function registerFileHandlers() {
  // Select folder dialog
  ipcMain.handle('select-folder', async () => {
    const window = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(window!, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Archive Folder',
      buttonLabel: 'Select'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // Select archive (file or folder)
  ipcMain.handle('select-archive', async () => {
    const window = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(window!, {
      properties: ['openFile', 'openDirectory'],
      title: 'Select Archive',
      buttonLabel: 'Import',
      filters: [
        { name: 'Archives', extensions: ['zip'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // Get disk space for a path
  ipcMain.handle('get-disk-space', async (_event, targetPath: string) => {
    try {
      // Use the parent directory if the path doesn't exist
      let checkPath = targetPath;
      while (!existsSync(checkPath) && checkPath !== path.dirname(checkPath)) {
        checkPath = path.dirname(checkPath);
      }

      const stats = await statfs(checkPath);
      return {
        free: stats.bfree * stats.bsize,
        total: stats.blocks * stats.bsize
      };
    } catch (error) {
      console.error('Failed to get disk space:', error);
      return {
        free: 0,
        total: 0
      };
    }
  });
}

/**
 * Archive detection result
 */
export interface ArchiveDetectionResult {
  type: 'zip' | 'openai-export' | 'humanizer-archive' | 'unknown';
  needsExtraction: boolean;
  needsImport: boolean;
  path: string;
  estimatedSize?: number;
  conversationCount?: number;
}

/**
 * Register archive detection handlers
 */
export function registerArchiveHandlers() {
  // Detect archive type
  ipcMain.handle('detect-archive', async (_event, archivePath: string): Promise<ArchiveDetectionResult> => {
    const { detectArchiveType } = await import('./archive-detector.js');
    return detectArchiveType(archivePath);
  });

  // Validate archive path
  ipcMain.handle('validate-archive-path', async (_event, archivePath: string) => {
    try {
      if (!existsSync(archivePath)) {
        return { valid: false, error: 'Path does not exist' };
      }

      // Check if we can write to parent directory
      const parentDir = path.dirname(archivePath);
      try {
        await import('node:fs/promises').then(fs => fs.access(parentDir, fs.constants.W_OK));
        return { valid: true };
      } catch {
        return { valid: false, error: 'Cannot write to directory' };
      }
    } catch (error) {
      return { valid: false, error: String(error) };
    }
  });
}

/**
 * Register all IPC handlers
 */
export function registerAllIPCHandlers() {
  registerFileHandlers();
  registerArchiveHandlers();
}
