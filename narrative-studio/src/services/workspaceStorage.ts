// ============================================================
// WORKSPACE STORAGE SERVICE
// ============================================================
// Handles persistence of workspaces to localStorage.
// Future: Can be extended to use backend API for cloud sync.
// ============================================================

import type { Workspace, WorkspaceSummary, WorkspaceSource } from '../types/workspace';

// Storage key constants
const WORKSPACE_PREFIX = 'humanizer-workspace-';
const WORKSPACE_INDEX_KEY = 'humanizer-workspace-index';

// Storage quota warning threshold (5MB of 10MB typical limit)
const STORAGE_WARNING_THRESHOLD = 5 * 1024 * 1024;

/**
 * Generate a preview text from content (first 100 chars).
 */
function generatePreview(content: string): string {
  const cleaned = content.replace(/[#*_`>\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > 100 ? cleaned.slice(0, 97) + '...' : cleaned;
}

/**
 * Find the best (lowest) AI score among analyzed buffers.
 */
function findBestAiScore(workspace: Workspace): number | undefined {
  let best: number | undefined;
  for (const buffer of Object.values(workspace.buffers)) {
    if (buffer.analysis?.aiScore !== undefined) {
      if (best === undefined || buffer.analysis.aiScore < best) {
        best = buffer.analysis.aiScore;
      }
    }
  }
  return best;
}

/**
 * Create a summary from a full workspace.
 */
function createSummary(workspace: Workspace): WorkspaceSummary {
  const rootBuffer = workspace.buffers[workspace.rootBufferId];
  return {
    id: workspace.id,
    name: workspace.name,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    source: workspace.source,
    bufferCount: Object.keys(workspace.buffers).length,
    starredCount: workspace.starredBufferIds.length,
    archived: workspace.archived,
    previewText: rootBuffer ? generatePreview(rootBuffer.content) : undefined,
    bestAiScore: findBestAiScore(workspace),
  };
}

/**
 * Check localStorage usage and warn if approaching quota.
 */
function checkStorageQuota(): { used: number; remaining: number; nearQuota: boolean } {
  let used = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        used += key.length + value.length;
      }
    }
  }
  // Assume 10MB quota (typical for localStorage)
  const quota = 10 * 1024 * 1024;
  return {
    used,
    remaining: quota - used,
    nearQuota: used > STORAGE_WARNING_THRESHOLD,
  };
}

class WorkspaceStorageService {
  /**
   * Save a workspace to localStorage.
   * Also updates the workspace index.
   */
  async saveWorkspace(workspace: Workspace): Promise<void> {
    try {
      // Check storage quota
      const quota = checkStorageQuota();
      if (quota.nearQuota) {
        console.warn('⚠️ Workspace storage: approaching localStorage quota');
      }

      // Save the full workspace
      const key = `${WORKSPACE_PREFIX}${workspace.id}`;
      const data = JSON.stringify(workspace);
      localStorage.setItem(key, data);

      // Update the index
      await this.updateIndex(workspace);
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        throw new Error('Storage quota exceeded. Please delete some workspaces to free up space.');
      }
      throw error;
    }
  }

  /**
   * Load a workspace by ID.
   * Returns null if not found.
   */
  async loadWorkspace(id: string): Promise<Workspace | null> {
    try {
      const key = `${WORKSPACE_PREFIX}${id}`;
      const data = localStorage.getItem(key);
      if (!data) {
        return null;
      }
      return JSON.parse(data) as Workspace;
    } catch (error) {
      console.error('Failed to load workspace:', error);
      return null;
    }
  }

  /**
   * Delete a workspace by ID.
   * Also removes from the index.
   */
  async deleteWorkspace(id: string): Promise<void> {
    const key = `${WORKSPACE_PREFIX}${id}`;
    localStorage.removeItem(key);
    await this.removeFromIndex(id);
  }

  /**
   * List all workspace summaries.
   * Returns summaries sorted by updatedAt (most recent first).
   */
  async listWorkspaces(): Promise<WorkspaceSummary[]> {
    try {
      const indexData = localStorage.getItem(WORKSPACE_INDEX_KEY);
      if (!indexData) {
        return [];
      }
      const summaries: WorkspaceSummary[] = JSON.parse(indexData);
      // Sort by most recently updated
      return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.error('Failed to list workspaces:', error);
      return [];
    }
  }

  /**
   * Get storage statistics.
   */
  getStorageStats(): { workspaceCount: number; totalSize: number; nearQuota: boolean } {
    let workspaceCount = 0;
    let totalSize = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(WORKSPACE_PREFIX)) {
        workspaceCount++;
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }
    }

    const quota = checkStorageQuota();
    return {
      workspaceCount,
      totalSize,
      nearQuota: quota.nearQuota,
    };
  }

  /**
   * Rebuild the index from stored workspaces.
   * Useful for recovery or migration.
   */
  async rebuildIndex(): Promise<void> {
    const summaries: WorkspaceSummary[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(WORKSPACE_PREFIX) && key !== WORKSPACE_INDEX_KEY) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const workspace: Workspace = JSON.parse(data);
            summaries.push(createSummary(workspace));
          }
        } catch (error) {
          console.error(`Failed to parse workspace ${key}:`, error);
        }
      }
    }

    localStorage.setItem(WORKSPACE_INDEX_KEY, JSON.stringify(summaries));
  }

  /**
   * Update a workspace in the index.
   */
  private async updateIndex(workspace: Workspace): Promise<void> {
    const summaries = await this.listWorkspaces();
    const existingIndex = summaries.findIndex(s => s.id === workspace.id);
    const newSummary = createSummary(workspace);

    if (existingIndex >= 0) {
      summaries[existingIndex] = newSummary;
    } else {
      summaries.push(newSummary);
    }

    localStorage.setItem(WORKSPACE_INDEX_KEY, JSON.stringify(summaries));
  }

  /**
   * Remove a workspace from the index.
   */
  private async removeFromIndex(id: string): Promise<void> {
    const summaries = await this.listWorkspaces();
    const filtered = summaries.filter(s => s.id !== id);
    localStorage.setItem(WORKSPACE_INDEX_KEY, JSON.stringify(filtered));
  }

  /**
   * Check if any legacy sessions exist for migration.
   */
  hasLegacySessions(): boolean {
    // Check for old session storage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('humanizer-session-') || key === 'humanizer-sessions-index') {
        return true;
      }
    }
    return false;
  }

  /**
   * Migrate legacy sessions to workspace format.
   * Returns the number of sessions migrated.
   */
  async migrateLegacySessions(): Promise<number> {
    // This will be implemented if we find legacy sessions to migrate
    // For now, just return 0 as sessions were stored in D1, not localStorage
    console.log('No legacy session migration needed (sessions were in D1)');
    return 0;
  }
}

// Export singleton instance
export const workspaceStorage = new WorkspaceStorageService();

// Export utility functions for use elsewhere
export { generatePreview, findBestAiScore, createSummary, checkStorageQuota };
