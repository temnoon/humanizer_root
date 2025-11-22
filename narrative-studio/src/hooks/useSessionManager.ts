import { useState, useCallback, useEffect, useRef } from 'react';
import type { Session, SessionBuffer } from '../services/sessionStorage';
import { sessionStorage } from '../services/sessionStorage';
import { APP_CONFIG } from '../config/app-config';
import { getSessionLimit } from '../config/session-limits';

interface SessionManagerState {
  currentSession: Session | null;
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
}

export function useSessionManager(userTier: string = 'free', archiveName: string = 'main') {
  const [state, setState] = useState<SessionManagerState>({
    currentSession: null,
    sessions: [],
    isLoading: false,
    error: null
  });

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const limits = getSessionLimit(userTier);

  // Auto-save current session (debounced)
  const autoSave = useCallback(() => {
    if (!state.currentSession) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await sessionStorage.updateSession({
          ...state.currentSession,
          updated: new Date().toISOString()
        });
        console.log(`✓ Auto-saved session: ${state.currentSession.sessionId}`);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, APP_CONFIG.autoSaveDebounceMs);
  }, [state.currentSession]);

  // Create new session
  const createSession = useCallback(async (
    name?: string,
    buffers: SessionBuffer[] = [],
    sourceMessageId?: string
  ): Promise<Session | null> => {
    // Check session limit
    if (state.sessions.length >= limits.sessions) {
      setState(prev => ({
        ...prev,
        error: `Session limit reached: ${limits.sessions}`
      }));
      return null;
    }

    const timestamp = new Date().toISOString();
    const sessionName = name || `${APP_CONFIG.sessionNamePrefix} ${new Date().toLocaleString()}`;

    const newSession: Session = {
      sessionId: `session-${Date.now()}`,
      name: sessionName,
      created: timestamp,
      updated: timestamp,
      sourceArchive: archiveName,
      sourceMessageId,
      buffers,
      activeBufferId: buffers[0]?.bufferId || 'buffer-0',
      viewMode: APP_CONFIG.defaultViewMode
    };

    try {
      setState(prev => ({ ...prev, isLoading: true }));
      await sessionStorage.createSession(newSession);

      setState(prev => ({
        ...prev,
        currentSession: newSession,
        sessions: [newSession, ...prev.sessions],
        isLoading: false,
        error: null
      }));

      console.log(`✓ Created session: ${newSession.sessionId} (${sessionName})`);
      return newSession;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }));
      console.error('Failed to create session:', error);
      return null;
    }
  }, [state.sessions.length, limits.sessions, archiveName]);

  // Auto-create session on first operation (if enabled)
  const autoCreateSession = useCallback(async (
    buffers: SessionBuffer[],
    sourceMessageId?: string
  ): Promise<Session | null> => {
    if (!APP_CONFIG.autoCreateSession) {
      return null;
    }

    if (state.currentSession) {
      // Already have a session
      return state.currentSession;
    }

    return createSession(undefined, buffers, sourceMessageId);
  }, [state.currentSession, createSession]);

  // Load session by ID
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const session = await sessionStorage.getSession(sessionId);

      setState(prev => ({
        ...prev,
        currentSession: session,
        isLoading: false,
        error: null
      }));

      console.log(`✓ Loaded session: ${sessionId} (${session.name})`);
      return session;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }));
      console.error('Failed to load session:', error);
      return null;
    }
  }, []);

  // List all sessions
  const refreshSessions = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const sessions = await sessionStorage.listSessions();

      setState(prev => ({
        ...prev,
        sessions,
        isLoading: false,
        error: null
      }));

      return sessions;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }));
      console.error('Failed to list sessions:', error);
      return [];
    }
  }, []);

  // Update current session
  const updateSession = useCallback((updates: Partial<Session>) => {
    if (!state.currentSession) return;

    const updatedSession = {
      ...state.currentSession,
      ...updates,
      updated: new Date().toISOString()
    };

    setState(prev => ({
      ...prev,
      currentSession: updatedSession,
      sessions: prev.sessions.map(s =>
        s.sessionId === updatedSession.sessionId ? updatedSession : s
      )
    }));

    // Trigger auto-save
    autoSave();
  }, [state.currentSession, autoSave]);

  // Update buffers in current session
  const updateBuffers = useCallback((buffers: SessionBuffer[], activeBufferId: string) => {
    updateSession({ buffers, activeBufferId });
  }, [updateSession]);

  // Update view mode
  const updateViewMode = useCallback((viewMode: Session['viewMode']) => {
    updateSession({ viewMode });
  }, [updateSession]);

  // Rename session
  const renameSession = useCallback(async (sessionId: string, name: string) => {
    try {
      const updatedSession = await sessionStorage.renameSession(sessionId, name);

      setState(prev => ({
        ...prev,
        currentSession: prev.currentSession?.sessionId === sessionId ? updatedSession : prev.currentSession,
        sessions: prev.sessions.map(s =>
          s.sessionId === sessionId ? updatedSession : s
        )
      }));

      console.log(`✓ Renamed session: ${sessionId} → "${name}"`);
      return updatedSession;
    } catch (error) {
      console.error('Failed to rename session:', error);
      return null;
    }
  }, []);

  // Delete session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await sessionStorage.deleteSession(sessionId);

      setState(prev => ({
        ...prev,
        currentSession: prev.currentSession?.sessionId === sessionId ? null : prev.currentSession,
        sessions: prev.sessions.filter(s => s.sessionId !== sessionId)
      }));

      console.log(`✓ Deleted session: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete session:', error);
      return false;
    }
  }, []);

  // Close current session (save and clear)
  const closeSession = useCallback(async () => {
    if (!state.currentSession) return;

    try {
      // Final save
      await sessionStorage.updateSession({
        ...state.currentSession,
        updated: new Date().toISOString()
      });

      setState(prev => ({
        ...prev,
        currentSession: null
      }));

      console.log(`✓ Closed session: ${state.currentSession.sessionId}`);
    } catch (error) {
      console.error('Failed to close session:', error);
    }
  }, [state.currentSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    currentSession: state.currentSession,
    sessions: state.sessions,
    isLoading: state.isLoading,
    error: state.error,
    hasSession: state.currentSession !== null,
    createSession,
    autoCreateSession,
    loadSession,
    refreshSessions,
    updateSession,
    updateBuffers,
    updateViewMode,
    renameSession,
    deleteSession,
    closeSession,
    autoSave
  };
}
