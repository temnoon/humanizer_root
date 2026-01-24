/**
 * Versioned Buffer Manager
 *
 * Git-like version control for in-memory buffers.
 * Supports branching, committing, merging, diffing, and rollback.
 *
 * @module @humanizer/core/aui/buffer-manager
 */

import { randomUUID } from 'crypto';
import type {
  VersionedBuffer,
  BufferVersion,
  BufferBranch,
  BufferDiff,
  DiffModification,
  DiffStats,
  MergeResult,
  MergeConflict,
  MergeStrategy,
  SerializedBuffer,
  ContentSchema,
} from './types.js';
import {
  AUI_DEFAULTS,
  DEFAULT_BRANCH_NAME,
  VERSION_ID_LENGTH,
  MAX_BUFFER_ITEMS,
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a short version ID from UUID.
 */
function generateVersionId(): string {
  return randomUUID().replace(/-/g, '').substring(0, VERSION_ID_LENGTH);
}

/**
 * Deep clone an array of items.
 */
function cloneContent(content: unknown[]): unknown[] {
  return JSON.parse(JSON.stringify(content));
}

/**
 * Check if two items are equal (deep comparison).
 */
function itemsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Compute a simple hash for content (for duplicate detection).
 */
function hashContent(content: unknown[]): string {
  const str = JSON.stringify(content);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER MANAGER
// ═══════════════════════════════════════════════════════════════════════════

export interface BufferManagerOptions {
  /** Maximum versions per buffer */
  maxVersions?: number;

  /** Maximum branches per buffer */
  maxBranches?: number;

  /** Auto-commit on certain operations */
  autoCommit?: boolean;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * BufferManager provides git-like version control for in-memory buffers.
 *
 * Each buffer can have:
 * - Multiple branches (like git branches)
 * - Version history (like git commits)
 * - Working content (uncommitted changes)
 * - Tags for important versions
 * - Merge capabilities with conflict detection
 */
export class BufferManager {
  private buffers: Map<string, VersionedBuffer> = new Map();
  private maxVersions: number;
  private maxBranches: number;
  private autoCommit: boolean;
  private verbose: boolean;

  constructor(options?: BufferManagerOptions) {
    this.maxVersions = options?.maxVersions ?? AUI_DEFAULTS.maxVersions;
    this.maxBranches = options?.maxBranches ?? AUI_DEFAULTS.maxBranches;
    this.autoCommit = options?.autoCommit ?? AUI_DEFAULTS.autoCommit;
    this.verbose = options?.verbose ?? false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUFFER LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new versioned buffer.
   */
  createBuffer(
    name: string,
    initialContent: unknown[] = [],
    options?: { schema?: ContentSchema; description?: string }
  ): VersionedBuffer {
    if (this.buffers.has(name)) {
      throw new Error(`Buffer "${name}" already exists`);
    }

    const now = Date.now();
    const initialVersionId = generateVersionId();

    // Create initial version
    const initialVersion: BufferVersion = {
      id: initialVersionId,
      content: cloneContent(initialContent),
      message: 'Initial commit',
      timestamp: now,
      parentId: null,
      tags: [],
      metadata: {},
    };

    // Create main branch
    const mainBranch: BufferBranch = {
      name: DEFAULT_BRANCH_NAME,
      headVersionId: initialVersionId,
      createdAt: now,
      description: 'Main branch',
    };

    const buffer: VersionedBuffer = {
      id: randomUUID(),
      name,
      branches: new Map([[DEFAULT_BRANCH_NAME, mainBranch]]),
      versions: new Map([[initialVersionId, initialVersion]]),
      currentBranch: DEFAULT_BRANCH_NAME,
      workingContent: cloneContent(initialContent),
      isDirty: false,
      createdAt: now,
      updatedAt: now,
      schema: options?.schema,
    };

    this.buffers.set(name, buffer);

    if (this.verbose) {
      console.log(`[BufferManager] Created buffer "${name}" with ${initialContent.length} items`);
    }

    return buffer;
  }

  /**
   * Get a buffer by name.
   */
  getBuffer(name: string): VersionedBuffer | undefined {
    return this.buffers.get(name);
  }

  /**
   * Delete a buffer.
   */
  deleteBuffer(name: string): boolean {
    const deleted = this.buffers.delete(name);

    if (deleted && this.verbose) {
      console.log(`[BufferManager] Deleted buffer "${name}"`);
    }

    return deleted;
  }

  /**
   * List all buffers.
   */
  listBuffers(): VersionedBuffer[] {
    return Array.from(this.buffers.values());
  }

  /**
   * Check if a buffer exists.
   */
  hasBuffer(name: string): boolean {
    return this.buffers.has(name);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKING CONTENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get working content (uncommitted) from a buffer.
   */
  getWorkingContent(bufferName: string): unknown[] {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }
    return buffer.workingContent;
  }

  /**
   * Set working content (replaces all content).
   */
  setWorkingContent(bufferName: string, content: unknown[]): void {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    if (content.length > MAX_BUFFER_ITEMS) {
      throw new Error(`Content exceeds maximum buffer size (${MAX_BUFFER_ITEMS} items)`);
    }

    buffer.workingContent = cloneContent(content);
    buffer.isDirty = !this.contentMatchesHead(buffer);
    buffer.updatedAt = Date.now();
  }

  /**
   * Append items to working content.
   */
  appendToBuffer(bufferName: string, items: unknown[]): void {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    const newLength = buffer.workingContent.length + items.length;
    if (newLength > MAX_BUFFER_ITEMS) {
      throw new Error(`Append would exceed maximum buffer size (${MAX_BUFFER_ITEMS} items)`);
    }

    buffer.workingContent.push(...cloneContent(items));
    buffer.isDirty = true;
    buffer.updatedAt = Date.now();

    if (this.autoCommit) {
      this.commit(bufferName, `Auto-commit: Added ${items.length} items`);
    }
  }

  /**
   * Clear working content.
   */
  clearWorkingContent(bufferName: string): void {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    buffer.workingContent = [];
    buffer.isDirty = !this.contentMatchesHead(buffer);
    buffer.updatedAt = Date.now();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VERSION CONTROL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Commit working content as a new version.
   */
  commit(bufferName: string, message: string, metadata?: Record<string, unknown>): BufferVersion {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    if (!buffer.isDirty) {
      throw new Error('Nothing to commit - working content matches HEAD');
    }

    const branch = buffer.branches.get(buffer.currentBranch);
    if (!branch) {
      throw new Error(`Current branch "${buffer.currentBranch}" not found`);
    }

    const versionId = generateVersionId();
    const now = Date.now();

    const version: BufferVersion = {
      id: versionId,
      content: cloneContent(buffer.workingContent),
      message,
      timestamp: now,
      parentId: branch.headVersionId,
      tags: [],
      metadata: metadata ?? {},
    };

    buffer.versions.set(versionId, version);
    branch.headVersionId = versionId;
    buffer.isDirty = false;
    buffer.updatedAt = now;

    // Prune old versions if needed
    this.pruneVersions(buffer);

    if (this.verbose) {
      console.log(`[BufferManager] Committed ${versionId} to "${bufferName}": ${message}`);
    }

    return version;
  }

  /**
   * Tag a version for easy reference.
   */
  tag(bufferName: string, versionId: string, tagName: string): void {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    const version = buffer.versions.get(versionId);
    if (!version) {
      throw new Error(`Version "${versionId}" not found`);
    }

    // Check tag doesn't exist on another version
    for (const v of buffer.versions.values()) {
      if (v.tags.includes(tagName)) {
        throw new Error(`Tag "${tagName}" already exists on version ${v.id}`);
      }
    }

    version.tags.push(tagName);
    buffer.updatedAt = Date.now();
  }

  /**
   * Get version history for the current branch.
   */
  getHistory(bufferName: string, limit?: number): BufferVersion[] {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    const branch = buffer.branches.get(buffer.currentBranch);
    if (!branch) {
      throw new Error(`Current branch "${buffer.currentBranch}" not found`);
    }

    const history: BufferVersion[] = [];
    let currentId: string | null = branch.headVersionId;
    const maxVersions = limit ?? this.maxVersions;

    while (currentId && history.length < maxVersions) {
      const version = buffer.versions.get(currentId);
      if (!version) break;

      history.push(version);
      currentId = version.parentId;
    }

    return history;
  }

  /**
   * Get a specific version by ID or tag.
   */
  getVersion(bufferName: string, versionIdOrTag: string): BufferVersion | undefined {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    // Try direct ID lookup
    let version = buffer.versions.get(versionIdOrTag);
    if (version) return version;

    // Try tag lookup
    for (const v of buffer.versions.values()) {
      if (v.tags.includes(versionIdOrTag)) {
        return v;
      }
    }

    return undefined;
  }

  /**
   * Checkout a specific version (discards uncommitted changes).
   */
  checkout(bufferName: string, versionIdOrTag: string): void {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    const version = this.getVersion(bufferName, versionIdOrTag);
    if (!version) {
      throw new Error(`Version "${versionIdOrTag}" not found`);
    }

    buffer.workingContent = cloneContent(version.content);
    buffer.isDirty = false;
    buffer.updatedAt = Date.now();

    // Update branch head if checking out to a specific version
    const branch = buffer.branches.get(buffer.currentBranch);
    if (branch) {
      branch.headVersionId = version.id;
    }

    if (this.verbose) {
      console.log(`[BufferManager] Checked out version ${version.id} in "${bufferName}"`);
    }
  }

  /**
   * Rollback to a previous version.
   */
  rollback(bufferName: string, steps: number = 1): BufferVersion {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    const history = this.getHistory(bufferName, steps + 1);
    if (history.length <= steps) {
      throw new Error(`Cannot rollback ${steps} steps - only ${history.length - 1} versions available`);
    }

    const targetVersion = history[steps];
    this.checkout(bufferName, targetVersion.id);

    if (this.verbose) {
      console.log(`[BufferManager] Rolled back ${steps} version(s) in "${bufferName}"`);
    }

    return targetVersion;
  }

  /**
   * Discard uncommitted changes.
   */
  discardChanges(bufferName: string): void {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    const branch = buffer.branches.get(buffer.currentBranch);
    if (!branch) {
      throw new Error(`Current branch "${buffer.currentBranch}" not found`);
    }

    const headVersion = buffer.versions.get(branch.headVersionId);
    if (!headVersion) {
      throw new Error('HEAD version not found');
    }

    buffer.workingContent = cloneContent(headVersion.content);
    buffer.isDirty = false;
    buffer.updatedAt = Date.now();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BRANCHING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new branch from current HEAD.
   */
  createBranch(bufferName: string, branchName: string, description?: string): BufferBranch {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    if (buffer.branches.has(branchName)) {
      throw new Error(`Branch "${branchName}" already exists`);
    }

    if (buffer.branches.size >= this.maxBranches) {
      throw new Error(`Maximum branches (${this.maxBranches}) reached`);
    }

    const currentBranch = buffer.branches.get(buffer.currentBranch);
    if (!currentBranch) {
      throw new Error(`Current branch "${buffer.currentBranch}" not found`);
    }

    const newBranch: BufferBranch = {
      name: branchName,
      headVersionId: currentBranch.headVersionId,
      createdAt: Date.now(),
      description,
      parentBranch: buffer.currentBranch,
    };

    buffer.branches.set(branchName, newBranch);
    buffer.updatedAt = Date.now();

    if (this.verbose) {
      console.log(`[BufferManager] Created branch "${branchName}" in "${bufferName}"`);
    }

    return newBranch;
  }

  /**
   * Switch to a different branch.
   */
  switchBranch(bufferName: string, branchName: string): void {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    if (buffer.isDirty) {
      throw new Error('Cannot switch branches with uncommitted changes. Commit or discard first.');
    }

    const branch = buffer.branches.get(branchName);
    if (!branch) {
      throw new Error(`Branch "${branchName}" not found`);
    }

    const headVersion = buffer.versions.get(branch.headVersionId);
    if (!headVersion) {
      throw new Error(`HEAD version for branch "${branchName}" not found`);
    }

    buffer.currentBranch = branchName;
    buffer.workingContent = cloneContent(headVersion.content);
    buffer.isDirty = false;
    buffer.updatedAt = Date.now();

    if (this.verbose) {
      console.log(`[BufferManager] Switched to branch "${branchName}" in "${bufferName}"`);
    }
  }

  /**
   * List all branches in a buffer.
   */
  listBranches(bufferName: string): BufferBranch[] {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    return Array.from(buffer.branches.values());
  }

  /**
   * Delete a branch (cannot delete current branch).
   */
  deleteBranch(bufferName: string, branchName: string): boolean {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    if (branchName === buffer.currentBranch) {
      throw new Error('Cannot delete the current branch');
    }

    if (branchName === DEFAULT_BRANCH_NAME) {
      throw new Error(`Cannot delete the "${DEFAULT_BRANCH_NAME}" branch`);
    }

    const deleted = buffer.branches.delete(branchName);
    if (deleted) {
      buffer.updatedAt = Date.now();
    }

    return deleted;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MERGE & DIFF
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Compute diff between two versions.
   */
  diff(bufferName: string, fromVersion: string, toVersion: string): BufferDiff {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    const from = this.getVersion(bufferName, fromVersion);
    const to = this.getVersion(bufferName, toVersion);

    if (!from) {
      throw new Error(`Version "${fromVersion}" not found`);
    }
    if (!to) {
      throw new Error(`Version "${toVersion}" not found`);
    }

    return this.computeDiff(from.content, to.content, fromVersion, toVersion);
  }

  /**
   * Diff current working content against last commit.
   */
  diffWorking(bufferName: string): BufferDiff {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    const branch = buffer.branches.get(buffer.currentBranch);
    if (!branch) {
      throw new Error(`Current branch "${buffer.currentBranch}" not found`);
    }

    const headVersion = buffer.versions.get(branch.headVersionId);
    if (!headVersion) {
      throw new Error('HEAD version not found');
    }

    return this.computeDiff(headVersion.content, buffer.workingContent, branch.headVersionId, 'working');
  }

  /**
   * Merge a branch into the current branch.
   */
  merge(
    bufferName: string,
    sourceBranch: string,
    message?: string,
    strategy: MergeStrategy = 'auto'
  ): MergeResult {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    if (buffer.isDirty) {
      throw new Error('Cannot merge with uncommitted changes. Commit or discard first.');
    }

    const source = buffer.branches.get(sourceBranch);
    if (!source) {
      throw new Error(`Source branch "${sourceBranch}" not found`);
    }

    const target = buffer.branches.get(buffer.currentBranch);
    if (!target) {
      throw new Error(`Current branch "${buffer.currentBranch}" not found`);
    }

    if (source.headVersionId === target.headVersionId) {
      return {
        success: true,
        conflicts: [],
        strategy,
        details: 'Already up to date',
      };
    }

    const sourceVersion = buffer.versions.get(source.headVersionId);
    const targetVersion = buffer.versions.get(target.headVersionId);

    if (!sourceVersion || !targetVersion) {
      throw new Error('Could not find HEAD versions for merge');
    }

    // Perform the merge
    const { merged, conflicts } = this.performMerge(
      targetVersion.content,
      sourceVersion.content,
      strategy
    );

    if (conflicts.length > 0 && strategy === 'auto') {
      return {
        success: false,
        conflicts,
        strategy,
        details: `Merge has ${conflicts.length} conflict(s) that need resolution`,
      };
    }

    // Create merge commit
    const mergeMessage = message ?? `Merge branch '${sourceBranch}' into ${buffer.currentBranch}`;
    buffer.workingContent = merged;
    buffer.isDirty = true;

    const mergeVersion = this.commit(bufferName, mergeMessage, {
      merge: true,
      sourceBranch,
      sourceVersionId: source.headVersionId,
    });

    return {
      success: true,
      conflicts: [],
      mergedContent: merged,
      newVersionId: mergeVersion.id,
      strategy,
      details: `Successfully merged ${sourceBranch} into ${buffer.currentBranch}`,
    };
  }

  /**
   * Resolve a merge conflict.
   */
  resolveConflict(
    bufferName: string,
    conflictIndex: number,
    resolution: unknown
  ): void {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    if (conflictIndex < 0 || conflictIndex >= buffer.workingContent.length) {
      throw new Error(`Invalid conflict index: ${conflictIndex}`);
    }

    buffer.workingContent[conflictIndex] = resolution;
    buffer.isDirty = true;
    buffer.updatedAt = Date.now();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if buffer has uncommitted changes.
   */
  isDirty(bufferName: string): boolean {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }
    return buffer.isDirty;
  }

  /**
   * Export buffer state for persistence.
   */
  export(bufferName: string): SerializedBuffer {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    return {
      id: buffer.id,
      name: buffer.name,
      branches: Array.from(buffer.branches.entries()),
      versions: Array.from(buffer.versions.entries()),
      currentBranch: buffer.currentBranch,
      workingContent: buffer.workingContent,
      isDirty: buffer.isDirty,
      createdAt: buffer.createdAt,
      updatedAt: buffer.updatedAt,
      schema: buffer.schema,
    };
  }

  /**
   * Import buffer from serialized state.
   */
  import(data: SerializedBuffer): VersionedBuffer {
    if (this.buffers.has(data.name)) {
      throw new Error(`Buffer "${data.name}" already exists`);
    }

    const buffer: VersionedBuffer = {
      id: data.id,
      name: data.name,
      branches: new Map(data.branches),
      versions: new Map(data.versions),
      currentBranch: data.currentBranch,
      workingContent: data.workingContent,
      isDirty: data.isDirty,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      schema: data.schema,
    };

    this.buffers.set(data.name, buffer);
    return buffer;
  }

  /**
   * Get statistics about a buffer.
   */
  getStats(bufferName: string): {
    name: string;
    itemCount: number;
    versionCount: number;
    branchCount: number;
    isDirty: boolean;
    currentBranch: string;
    createdAt: number;
    updatedAt: number;
  } {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer "${bufferName}" not found`);
    }

    return {
      name: buffer.name,
      itemCount: buffer.workingContent.length,
      versionCount: buffer.versions.size,
      branchCount: buffer.branches.size,
      isDirty: buffer.isDirty,
      currentBranch: buffer.currentBranch,
      createdAt: buffer.createdAt,
      updatedAt: buffer.updatedAt,
    };
  }

  /**
   * Clear all buffers.
   */
  clear(): void {
    this.buffers.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if working content matches HEAD.
   */
  private contentMatchesHead(buffer: VersionedBuffer): boolean {
    const branch = buffer.branches.get(buffer.currentBranch);
    if (!branch) return false;

    const headVersion = buffer.versions.get(branch.headVersionId);
    if (!headVersion) return false;

    return hashContent(buffer.workingContent) === hashContent(headVersion.content);
  }

  /**
   * Compute diff between two content arrays.
   */
  private computeDiff(
    fromContent: unknown[],
    toContent: unknown[],
    fromVersion: string,
    toVersion: string
  ): BufferDiff {
    const added: unknown[] = [];
    const removed: unknown[] = [];
    const modified: DiffModification[] = [];

    const fromSet = new Set(fromContent.map(i => JSON.stringify(i)));
    const toSet = new Set(toContent.map(i => JSON.stringify(i)));

    // Find added items
    for (const item of toContent) {
      const key = JSON.stringify(item);
      if (!fromSet.has(key)) {
        added.push(item);
      }
    }

    // Find removed items
    for (const item of fromContent) {
      const key = JSON.stringify(item);
      if (!toSet.has(key)) {
        removed.push(item);
      }
    }

    // Find modified items (same index, different content)
    const minLength = Math.min(fromContent.length, toContent.length);
    for (let i = 0; i < minLength; i++) {
      if (!itemsEqual(fromContent[i], toContent[i])) {
        // Check if it's a modification vs add/remove
        const fromKey = JSON.stringify(fromContent[i]);
        const toKey = JSON.stringify(toContent[i]);

        // If both were counted as add/remove, it's actually a modification
        if (!toSet.has(fromKey) && !fromSet.has(toKey)) {
          modified.push({
            index: i,
            old: fromContent[i],
            new: toContent[i],
          });
        }
      }
    }

    const stats: DiffStats = {
      addedCount: added.length,
      removedCount: removed.length,
      modifiedCount: modified.length,
      unchangedCount: Math.max(0, minLength - modified.length),
    };

    const summary = this.generateDiffSummary(stats, fromVersion, toVersion);

    return {
      fromVersion,
      toVersion,
      added,
      removed,
      modified,
      summary,
      stats,
    };
  }

  /**
   * Generate human-readable diff summary.
   */
  private generateDiffSummary(stats: DiffStats, from: string, to: string): string {
    const parts: string[] = [];

    if (stats.addedCount > 0) {
      parts.push(`+${stats.addedCount} added`);
    }
    if (stats.removedCount > 0) {
      parts.push(`-${stats.removedCount} removed`);
    }
    if (stats.modifiedCount > 0) {
      parts.push(`~${stats.modifiedCount} modified`);
    }

    if (parts.length === 0) {
      return `No changes between ${from} and ${to}`;
    }

    return `${from}..${to}: ${parts.join(', ')}`;
  }

  /**
   * Perform merge operation.
   */
  private performMerge(
    ours: unknown[],
    theirs: unknown[],
    strategy: MergeStrategy
  ): { merged: unknown[]; conflicts: MergeConflict[] } {
    const conflicts: MergeConflict[] = [];

    if (strategy === 'ours') {
      return { merged: cloneContent(ours), conflicts: [] };
    }

    if (strategy === 'theirs') {
      return { merged: cloneContent(theirs), conflicts: [] };
    }

    if (strategy === 'union') {
      // Combine both, deduplicating
      const seen = new Set<string>();
      const merged: unknown[] = [];

      for (const item of [...ours, ...theirs]) {
        const key = JSON.stringify(item);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      }

      return { merged, conflicts: [] };
    }

    // Auto strategy: try to merge, report conflicts
    const merged: unknown[] = [];
    const maxLength = Math.max(ours.length, theirs.length);

    for (let i = 0; i < maxLength; i++) {
      const ourItem = i < ours.length ? ours[i] : undefined;
      const theirItem = i < theirs.length ? theirs[i] : undefined;

      if (ourItem === undefined) {
        merged.push(theirItem);
      } else if (theirItem === undefined) {
        merged.push(ourItem);
      } else if (itemsEqual(ourItem, theirItem)) {
        merged.push(ourItem);
      } else {
        // Conflict
        conflicts.push({
          index: i,
          ours: ourItem,
          theirs: theirItem,
        });
        // Keep ours for now, user can resolve
        merged.push(ourItem);
      }
    }

    return { merged, conflicts };
  }

  /**
   * Prune old versions to stay under limit.
   */
  private pruneVersions(buffer: VersionedBuffer): void {
    if (buffer.versions.size <= this.maxVersions) {
      return;
    }

    // Get all versions sorted by timestamp (oldest first)
    const versions = Array.from(buffer.versions.values())
      .sort((a, b) => a.timestamp - b.timestamp);

    // Collect all head version IDs (protected from deletion)
    const headVersions = new Set<string>();
    for (const branch of buffer.branches.values()) {
      headVersions.add(branch.headVersionId);
    }

    // Delete oldest versions that aren't heads
    const toDelete = versions.length - this.maxVersions;
    let deleted = 0;

    for (const version of versions) {
      if (deleted >= toDelete) break;
      if (!headVersions.has(version.id) && version.tags.length === 0) {
        buffer.versions.delete(version.id);
        deleted++;
      }
    }

    if (this.verbose && deleted > 0) {
      console.log(`[BufferManager] Pruned ${deleted} old versions from "${buffer.name}"`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let _bufferManager: BufferManager | null = null;

/**
 * Initialize the global buffer manager.
 */
export function initBufferManager(options?: BufferManagerOptions): BufferManager {
  _bufferManager = new BufferManager(options);
  return _bufferManager;
}

/**
 * Get the global buffer manager.
 */
export function getBufferManager(): BufferManager {
  if (!_bufferManager) {
    _bufferManager = new BufferManager();
  }
  return _bufferManager;
}

/**
 * Reset the global buffer manager (for testing).
 */
export function resetBufferManager(): void {
  _bufferManager = null;
}
