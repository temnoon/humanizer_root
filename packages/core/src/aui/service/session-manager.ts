/**
 * AUI Session Manager
 *
 * In-memory session management with auto-cleanup and expiration.
 *
 * @module @humanizer/core/aui/service/session-manager
 */

import { randomUUID } from 'crypto';
import type { UnifiedAuiSession } from '../types.js';
import { AUI_DEFAULTS } from '../constants.js';

/**
 * AuiSessionManager handles in-memory session lifecycle.
 *
 * Features:
 * - Session creation with auto-generated IDs
 * - Expiration-based cleanup
 * - LRU eviction when at capacity
 * - Activity tracking via touch()
 */
export class AuiSessionManager {
  private sessions: Map<string, UnifiedAuiSession> = new Map();
  private maxSessions: number;
  private sessionTimeoutMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options?: { maxSessions?: number; sessionTimeoutMs?: number; cleanupIntervalMs?: number }) {
    this.maxSessions = options?.maxSessions ?? AUI_DEFAULTS.maxSessions;
    this.sessionTimeoutMs = options?.sessionTimeoutMs ?? AUI_DEFAULTS.sessionTimeoutMs;

    // Start cleanup interval
    const cleanupIntervalMs = options?.cleanupIntervalMs ?? AUI_DEFAULTS.cleanupIntervalMs;
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  /**
   * Create a new session.
   */
  create(options?: { userId?: string; name?: string }): UnifiedAuiSession {
    // Evict old sessions if at capacity
    if (this.sessions.size >= this.maxSessions) {
      this.evictOldest();
    }

    const now = Date.now();
    const session: UnifiedAuiSession = {
      id: randomUUID(),
      name: options?.name,
      userId: options?.userId,
      buffers: new Map(),
      taskHistory: [],
      commandHistory: [],
      variables: new Map(),
      createdAt: now,
      updatedAt: now,
      expiresAt: now + this.sessionTimeoutMs,
      metadata: {
        commandCount: 0,
        searchCount: 0,
        taskCount: 0,
      },
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Get a session by ID.
   * Returns undefined if expired or not found.
   */
  get(id: string): UnifiedAuiSession | undefined {
    const session = this.sessions.get(id);
    if (session && this.isExpired(session)) {
      this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  /**
   * Delete a session.
   */
  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  /**
   * List all active (non-expired) sessions.
   */
  list(): UnifiedAuiSession[] {
    const sessions: UnifiedAuiSession[] = [];
    for (const session of this.sessions.values()) {
      if (!this.isExpired(session)) {
        sessions.push(session);
      }
    }
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Update session activity timestamp.
   */
  touch(session: UnifiedAuiSession): void {
    session.updatedAt = Date.now();
    session.expiresAt = session.updatedAt + this.sessionTimeoutMs;
  }

  /**
   * Check if a session has expired.
   */
  private isExpired(session: UnifiedAuiSession): boolean {
    return session.expiresAt ? Date.now() > session.expiresAt : false;
  }

  /**
   * Evict the oldest session by updatedAt.
   */
  private evictOldest(): void {
    let oldest: UnifiedAuiSession | null = null;
    for (const session of this.sessions.values()) {
      if (!oldest || session.updatedAt < oldest.updatedAt) {
        oldest = session;
      }
    }
    if (oldest) {
      this.sessions.delete(oldest.id);
    }
  }

  /**
   * Clean up expired sessions.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt && now > session.expiresAt) {
        this.sessions.delete(id);
      }
    }
  }

  /**
   * Stop cleanup interval and clear all sessions.
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
  }
}
