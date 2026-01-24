/**
 * Session Manager
 *
 * Manages search sessions for iterative refinement.
 * Sessions maintain state across multiple searches including:
 * - Current results
 * - Search history
 * - Positive/negative anchors
 * - Manual exclusions and pins
 */

import { randomUUID } from 'crypto';
import type {
  SearchSession,
  AgenticSearchResult,
  SearchHistoryEntry,
  SessionMetadata,
} from './types.js';
import type { SemanticAnchor } from '../retrieval/types.js';
import {
  DEFAULT_MAX_SESSIONS,
  DEFAULT_SESSION_TIMEOUT_MS,
  MAX_HISTORY_ENTRIES,
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// SESSION MANAGER OPTIONS
// ═══════════════════════════════════════════════════════════════════

export interface SessionManagerOptions {
  /** Maximum sessions to keep */
  maxSessions?: number;

  /** Session timeout (ms) */
  sessionTimeoutMs?: number;

  /** Enable session persistence (future) */
  persistSessions?: boolean;

  /** Verbose logging */
  verbose?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// SESSION MANAGER
// ═══════════════════════════════════════════════════════════════════

/**
 * SessionManager handles creation, retrieval, and lifecycle of search sessions.
 */
export class SessionManager {
  private sessions: Map<string, SearchSession> = new Map();
  private maxSessions: number;
  private sessionTimeoutMs: number;
  private verbose: boolean;

  constructor(options?: SessionManagerOptions) {
    this.maxSessions = options?.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.sessionTimeoutMs = options?.sessionTimeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS;
    this.verbose = options?.verbose ?? false;
  }

  // ─────────────────────────────────────────────────────────────────
  // SESSION LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a new search session.
   */
  createSession(options?: { name?: string; notes?: string }): SearchSession {
    // Clean up old sessions if at capacity
    if (this.sessions.size >= this.maxSessions) {
      this.evictOldestSession();
    }

    const now = Date.now();
    const session: SearchSession = {
      id: randomUUID(),
      name: options?.name,
      results: [],
      history: [],
      positiveAnchors: [],
      negativeAnchors: [],
      excludedIds: new Set(),
      pinnedIds: new Set(),
      metadata: {
        createdAt: now,
        updatedAt: now,
        searchCount: 0,
        notes: options?.notes,
      },
    };

    this.sessions.set(session.id, session);

    if (this.verbose) {
      console.log(`[SessionManager] Created session: ${session.id}`);
    }

    return session;
  }

  /**
   * Get a session by ID.
   */
  getSession(id: string): SearchSession | undefined {
    const session = this.sessions.get(id);

    if (session) {
      // Check if session has expired
      if (this.isSessionExpired(session)) {
        this.deleteSession(id);
        return undefined;
      }
    }

    return session;
  }

  /**
   * Delete a session.
   */
  deleteSession(id: string): boolean {
    const deleted = this.sessions.delete(id);

    if (deleted && this.verbose) {
      console.log(`[SessionManager] Deleted session: ${id}`);
    }

    return deleted;
  }

  /**
   * List all active sessions.
   */
  listSessions(): SearchSession[] {
    const sessions: SearchSession[] = [];

    for (const session of this.sessions.values()) {
      if (!this.isSessionExpired(session)) {
        sessions.push(session);
      }
    }

    // Sort by last updated
    sessions.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt);

    return sessions;
  }

  /**
   * Clear all sessions.
   */
  clearAllSessions(): number {
    const count = this.sessions.size;
    this.sessions.clear();
    return count;
  }

  // ─────────────────────────────────────────────────────────────────
  // RESULTS MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add results to a session.
   */
  addResults(sessionId: string, results: AgenticSearchResult[]): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.results = results;
    session.metadata.updatedAt = Date.now();
  }

  /**
   * Clear results from a session.
   */
  clearResults(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.results = [];
    session.metadata.updatedAt = Date.now();
  }

  /**
   * Get results from a session.
   */
  getResults(sessionId: string): AgenticSearchResult[] {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return session.results;
  }

  // ─────────────────────────────────────────────────────────────────
  // HISTORY MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add a history entry to a session.
   */
  addHistoryEntry(sessionId: string, entry: SearchHistoryEntry): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.history.push(entry);

    // Trim history if too long
    if (session.history.length > MAX_HISTORY_ENTRIES) {
      session.history = session.history.slice(-MAX_HISTORY_ENTRIES);
    }

    session.metadata.searchCount++;
    session.metadata.lastQuery = entry.query;
    session.metadata.updatedAt = Date.now();
  }

  /**
   * Get history from a session.
   */
  getHistory(sessionId: string): SearchHistoryEntry[] {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return session.history;
  }

  // ─────────────────────────────────────────────────────────────────
  // ANCHOR MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add a positive anchor to a session.
   */
  addPositiveAnchor(sessionId: string, anchor: SemanticAnchor): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Avoid duplicates
    const exists = session.positiveAnchors.some(a => a.id === anchor.id);
    if (!exists) {
      session.positiveAnchors.push(anchor);
      session.metadata.updatedAt = Date.now();
    }
  }

  /**
   * Add a negative anchor to a session.
   */
  addNegativeAnchor(sessionId: string, anchor: SemanticAnchor): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Avoid duplicates
    const exists = session.negativeAnchors.some(a => a.id === anchor.id);
    if (!exists) {
      session.negativeAnchors.push(anchor);
      session.metadata.updatedAt = Date.now();
    }
  }

  /**
   * Remove an anchor (positive or negative) from a session.
   */
  removeAnchor(sessionId: string, anchorId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const positiveIndex = session.positiveAnchors.findIndex(a => a.id === anchorId);
    if (positiveIndex >= 0) {
      session.positiveAnchors.splice(positiveIndex, 1);
      session.metadata.updatedAt = Date.now();
      return true;
    }

    const negativeIndex = session.negativeAnchors.findIndex(a => a.id === anchorId);
    if (negativeIndex >= 0) {
      session.negativeAnchors.splice(negativeIndex, 1);
      session.metadata.updatedAt = Date.now();
      return true;
    }

    return false;
  }

  /**
   * Clear all anchors from a session.
   */
  clearAnchors(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.positiveAnchors = [];
    session.negativeAnchors = [];
    session.metadata.updatedAt = Date.now();
  }

  /**
   * Get all anchors from a session.
   */
  getAnchors(sessionId: string): { positive: SemanticAnchor[]; negative: SemanticAnchor[] } {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return {
      positive: session.positiveAnchors,
      negative: session.negativeAnchors,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // EXCLUSION & PIN MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Exclude results from a session.
   */
  excludeResults(sessionId: string, resultIds: string[]): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    for (const id of resultIds) {
      // Don't exclude pinned results
      if (!session.pinnedIds.has(id)) {
        session.excludedIds.add(id);
      }
    }

    session.metadata.updatedAt = Date.now();
  }

  /**
   * Remove exclusion for results.
   */
  unexcludeResults(sessionId: string, resultIds: string[]): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    for (const id of resultIds) {
      session.excludedIds.delete(id);
    }

    session.metadata.updatedAt = Date.now();
  }

  /**
   * Pin results (protect from exclusion).
   */
  pinResults(sessionId: string, resultIds: string[]): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    for (const id of resultIds) {
      session.pinnedIds.add(id);
      // Remove from excluded if it was there
      session.excludedIds.delete(id);
    }

    session.metadata.updatedAt = Date.now();
  }

  /**
   * Unpin results.
   */
  unpinResults(sessionId: string, resultIds: string[]): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    for (const id of resultIds) {
      session.pinnedIds.delete(id);
    }

    session.metadata.updatedAt = Date.now();
  }

  /**
   * Check if a result is excluded.
   */
  isExcluded(sessionId: string, resultId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    return session.excludedIds.has(resultId);
  }

  /**
   * Check if a result is pinned.
   */
  isPinned(sessionId: string, resultId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    return session.pinnedIds.has(resultId);
  }

  // ─────────────────────────────────────────────────────────────────
  // SESSION METADATA
  // ─────────────────────────────────────────────────────────────────

  /**
   * Update session name.
   */
  setSessionName(sessionId: string, name: string): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.name = name;
    session.metadata.updatedAt = Date.now();
  }

  /**
   * Update session notes.
   */
  setSessionNotes(sessionId: string, notes: string): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.metadata.notes = notes;
    session.metadata.updatedAt = Date.now();
  }

  // ─────────────────────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Check if a session has expired.
   */
  private isSessionExpired(session: SearchSession): boolean {
    const now = Date.now();
    return now - session.metadata.updatedAt > this.sessionTimeoutMs;
  }

  /**
   * Evict the oldest session.
   */
  private evictOldestSession(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, session] of this.sessions) {
      if (session.metadata.updatedAt < oldestTime) {
        oldestTime = session.metadata.updatedAt;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.deleteSession(oldestId);
    }
  }

  /**
   * Get session statistics.
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    totalSearches: number;
    totalResults: number;
  } {
    let activeSessions = 0;
    let totalSearches = 0;
    let totalResults = 0;

    for (const session of this.sessions.values()) {
      if (!this.isSessionExpired(session)) {
        activeSessions++;
        totalSearches += session.metadata.searchCount;
        totalResults += session.results.length;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      totalSearches,
      totalResults,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// GLOBAL INSTANCE
// ═══════════════════════════════════════════════════════════════════

let _sessionManager: SessionManager | null = null;

/**
 * Initialize the global session manager.
 */
export function initSessionManager(options?: SessionManagerOptions): SessionManager {
  _sessionManager = new SessionManager(options);
  return _sessionManager;
}

/**
 * Get the global session manager.
 */
export function getSessionManager(): SessionManager {
  if (!_sessionManager) {
    _sessionManager = new SessionManager();
  }
  return _sessionManager;
}

/**
 * Reset the global session manager (for testing).
 */
export function resetSessionManager(): void {
  _sessionManager = null;
}
