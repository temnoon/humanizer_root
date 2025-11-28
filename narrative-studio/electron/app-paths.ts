import { app } from 'electron';
import path from 'node:path';
import Store from 'electron-store';

const store = new Store();

/**
 * Application paths configuration
 * All paths are resolved dynamically based on app state and user settings
 */
export const paths = {
  /**
   * Default archive storage location
   * User can customize this during setup
   */
  archives: (): string => {
    const customPath = store.get('archivePath') as string | null;
    if (customPath) {
      return customPath;
    }
    return path.join(app.getPath('documents'), 'Humanizer Archives');
  },

  /**
   * Session data storage (history buffer, pinned items, etc.)
   */
  sessions: (): string => {
    return path.join(app.getPath('userData'), 'sessions');
  },

  /**
   * Downloaded ML models (if we ever bundle any locally)
   */
  models: (): string => {
    return path.join(app.getPath('userData'), 'models');
  },

  /**
   * Temporary file storage (uploads, extractions, etc.)
   */
  temp: (): string => {
    return path.join(app.getPath('temp'), 'humanizer-studio');
  },

  /**
   * Application logs
   */
  logs: (): string => {
    return path.join(app.getPath('logs'), 'humanizer-studio');
  },

  /**
   * User data directory (settings, cache, etc.)
   */
  userData: (): string => {
    return app.getPath('userData');
  },

  /**
   * Get the path to a specific archive by name
   */
  archive: (name: string): string => {
    return path.join(paths.archives(), name);
  },

  /**
   * Get the embeddings database path for an archive
   */
  archiveEmbeddings: (archiveName: string): string => {
    return path.join(paths.archive(archiveName), '.embeddings.db');
  },

  /**
   * Get the config file path for an archive
   */
  archiveConfig: (archiveName: string): string => {
    return path.join(paths.archive(archiveName), 'archive-config.json');
  }
};

/**
 * Ensure a directory exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(dirPath, { recursive: true });
}

/**
 * Ensure all app directories exist
 */
export async function ensureAppDirectories(): Promise<void> {
  await Promise.all([
    ensureDir(paths.archives()),
    ensureDir(paths.sessions()),
    ensureDir(paths.models()),
    ensureDir(paths.temp()),
    ensureDir(paths.logs())
  ]);
}

/**
 * Get all paths as a plain object (for IPC)
 */
export function getAllPaths(): Record<string, string> {
  return {
    archives: paths.archives(),
    sessions: paths.sessions(),
    models: paths.models(),
    temp: paths.temp(),
    logs: paths.logs(),
    userData: paths.userData()
  };
}
