/**
 * BufferManager - Named pointers into the content graph
 *
 * Buffers are lightweight references that can move through the graph.
 * Each buffer maintains its own history for undo/redo.
 * Forking creates a new buffer pointing to the same node.
 */

import type { Buffer, BufferEvent } from './types';

// ═══════════════════════════════════════════════════════════════════
// ID GENERATION
// ═══════════════════════════════════════════════════════════════════

let bufferCounter = 0;

function generateBufferId(): string {
  return `buf-${Date.now()}-${++bufferCounter}`;
}

// ═══════════════════════════════════════════════════════════════════
// BUFFER MANAGER CLASS
// ═══════════════════════════════════════════════════════════════════

export class BufferManager {
  private buffers: Map<string, Buffer> = new Map();
  private activeBufferId: string | null = null;
  private listeners: Set<(event: BufferEvent) => void> = new Set();

  // ─────────────────────────────────────────────────────────────────
  // EVENT SYSTEM
  // ─────────────────────────────────────────────────────────────────

  subscribe(listener: (event: BufferEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: BufferEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // BUFFER CRUD
  // ─────────────────────────────────────────────────────────────────

  createBuffer(name: string, nodeId: string, pinned = false): Buffer {
    const id = generateBufferId();
    const now = Date.now();

    const buffer: Buffer = {
      id,
      name,
      nodeId,
      pinned,
      history: [nodeId],
      historyIndex: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.buffers.set(id, buffer);
    this.emit({ type: 'buffer-created', bufferId: id });

    // Auto-activate if first buffer
    if (this.buffers.size === 1) {
      this.setActiveBuffer(id);
    }

    return buffer;
  }

  getBuffer(bufferId: string): Buffer | null {
    return this.buffers.get(bufferId) ?? null;
  }

  getAllBuffers(): Buffer[] {
    return Array.from(this.buffers.values());
  }

  deleteBuffer(bufferId: string): boolean {
    if (!this.buffers.has(bufferId)) return false;

    this.buffers.delete(bufferId);
    this.emit({ type: 'buffer-deleted', bufferId });

    // If we deleted the active buffer, activate another
    if (this.activeBufferId === bufferId) {
      const remaining = Array.from(this.buffers.keys());
      this.setActiveBuffer(remaining[0] ?? null);
    }

    return true;
  }

  renameBuffer(bufferId: string, name: string): boolean {
    const buffer = this.buffers.get(bufferId);
    if (!buffer) return false;

    // Create new buffer object (immutable update)
    this.buffers.set(bufferId, {
      ...buffer,
      name,
      updatedAt: Date.now(),
    });

    this.emit({ type: 'buffer-updated', bufferId });
    return true;
  }

  setPinned(bufferId: string, pinned: boolean): boolean {
    const buffer = this.buffers.get(bufferId);
    if (!buffer) return false;

    this.buffers.set(bufferId, {
      ...buffer,
      pinned,
      updatedAt: Date.now(),
    });

    this.emit({ type: 'buffer-updated', bufferId });
    return true;
  }

  // ─────────────────────────────────────────────────────────────────
  // ACTIVE BUFFER
  // ─────────────────────────────────────────────────────────────────

  getActiveBuffer(): Buffer | null {
    if (!this.activeBufferId) return null;
    return this.buffers.get(this.activeBufferId) ?? null;
  }

  getActiveBufferId(): string | null {
    return this.activeBufferId;
  }

  setActiveBuffer(bufferId: string | null): void {
    if (bufferId !== null && !this.buffers.has(bufferId)) {
      return; // Buffer doesn't exist
    }

    this.activeBufferId = bufferId;
    this.emit({ type: 'active-buffer-changed', bufferId });
  }

  // ─────────────────────────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Move buffer to a new node (adds to history)
   */
  navigateTo(bufferId: string, nodeId: string): boolean {
    const buffer = this.buffers.get(bufferId);
    if (!buffer) return false;

    // If we're in the middle of history, truncate forward history
    const newHistory = buffer.history.slice(0, buffer.historyIndex + 1);
    newHistory.push(nodeId);

    this.buffers.set(bufferId, {
      ...buffer,
      nodeId,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      updatedAt: Date.now(),
    });

    this.emit({ type: 'buffer-updated', bufferId });
    this.emit({ type: 'operation-applied', bufferId, nodeId });
    return true;
  }

  /**
   * Set cursor position (for array content)
   */
  setCursor(bufferId: string, cursor: number): boolean {
    const buffer = this.buffers.get(bufferId);
    if (!buffer) return false;

    this.buffers.set(bufferId, {
      ...buffer,
      cursor,
      updatedAt: Date.now(),
    });

    this.emit({ type: 'buffer-updated', bufferId });
    return true;
  }

  // ─────────────────────────────────────────────────────────────────
  // HISTORY (UNDO/REDO)
  // ─────────────────────────────────────────────────────────────────

  canUndo(bufferId: string): boolean {
    const buffer = this.buffers.get(bufferId);
    if (!buffer) return false;
    return buffer.historyIndex > 0;
  }

  canRedo(bufferId: string): boolean {
    const buffer = this.buffers.get(bufferId);
    if (!buffer) return false;
    return buffer.historyIndex < buffer.history.length - 1;
  }

  undo(bufferId: string): string | null {
    const buffer = this.buffers.get(bufferId);
    if (!buffer || buffer.historyIndex <= 0) return null;

    const newIndex = buffer.historyIndex - 1;
    const nodeId = buffer.history[newIndex];

    this.buffers.set(bufferId, {
      ...buffer,
      nodeId,
      historyIndex: newIndex,
      updatedAt: Date.now(),
    });

    this.emit({ type: 'buffer-updated', bufferId });
    return nodeId;
  }

  redo(bufferId: string): string | null {
    const buffer = this.buffers.get(bufferId);
    if (!buffer || buffer.historyIndex >= buffer.history.length - 1) return null;

    const newIndex = buffer.historyIndex + 1;
    const nodeId = buffer.history[newIndex];

    this.buffers.set(bufferId, {
      ...buffer,
      nodeId,
      historyIndex: newIndex,
      updatedAt: Date.now(),
    });

    this.emit({ type: 'buffer-updated', bufferId });
    return nodeId;
  }

  // ─────────────────────────────────────────────────────────────────
  // FORKING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a new buffer pointing to the same node
   */
  forkBuffer(bufferId: string, newName?: string): Buffer | null {
    const source = this.buffers.get(bufferId);
    if (!source) return null;

    const name = newName ?? `${source.name} (fork)`;
    return this.createBuffer(name, source.nodeId, false);
  }

  // ─────────────────────────────────────────────────────────────────
  // PINNED NODE IDS (for garbage collection)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get all node IDs that should not be garbage collected
   */
  getPinnedNodeIds(): Set<string> {
    const pinned = new Set<string>();

    for (const buffer of this.buffers.values()) {
      // Current node is always retained
      pinned.add(buffer.nodeId);

      // If buffer is pinned, retain all history
      if (buffer.pinned) {
        for (const nodeId of buffer.history) {
          pinned.add(nodeId);
        }
      }
    }

    return pinned;
  }

  // ─────────────────────────────────────────────────────────────────
  // SERIALIZATION
  // ─────────────────────────────────────────────────────────────────

  toJSON(): { buffers: Record<string, Buffer>; activeBufferId: string | null } {
    const buffers: Record<string, Buffer> = {};
    for (const [id, buffer] of this.buffers) {
      buffers[id] = buffer;
    }
    return { buffers, activeBufferId: this.activeBufferId };
  }

  static fromJSON(data: { buffers: Record<string, Buffer>; activeBufferId: string | null }): BufferManager {
    const manager = new BufferManager();
    for (const [id, buffer] of Object.entries(data.buffers)) {
      manager.buffers.set(id, buffer);
    }
    manager.activeBufferId = data.activeBufferId;
    return manager;
  }

  // ─────────────────────────────────────────────────────────────────
  // DEBUG
  // ─────────────────────────────────────────────────────────────────

  getStats(): { bufferCount: number; pinnedCount: number; totalHistorySize: number } {
    let pinnedCount = 0;
    let totalHistorySize = 0;

    for (const buffer of this.buffers.values()) {
      if (buffer.pinned) pinnedCount++;
      totalHistorySize += buffer.history.length;
    }

    return {
      bufferCount: this.buffers.size,
      pinnedCount,
      totalHistorySize,
    };
  }
}
