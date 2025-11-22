import React, { createContext, useContext, ReactNode } from 'react';
import { useBufferManager } from '../hooks/useBufferManager';
import { useSessionManager } from '../hooks/useSessionManager';
import { Session, Buffer, Edit } from '../services/sessionStorage';

interface SessionContextValue {
  // Session Manager
  currentSession: Session | null;
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  hasSession: boolean;
  createSession: (name?: string, buffers?: Buffer[], sourceMessageId?: string) => Promise<Session | null>;
  autoCreateSession: (buffers: Buffer[], sourceMessageId?: string) => Promise<Session | null>;
  loadSession: (sessionId: string) => Promise<Session | null>;
  refreshSessions: () => Promise<Session[]>;
  updateSession: (updates: Partial<Session>) => void;
  updateViewMode: (viewMode: Session['viewMode']) => void;
  renameSession: (sessionId: string, name: string) => Promise<Session | null>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  closeSession: () => Promise<void>;

  // Buffer Manager
  buffers: Buffer[];
  activeBufferId: string;
  sourceBufferForNextOp: string | null;
  isChainMode: boolean;
  createBuffer: (bufferData: Partial<Buffer>) => Buffer | null;
  createOriginalBuffer: (text: string, archiveRef: string, messageId?: string) => Buffer | null;
  createTransformationBuffer: (
    tool: string,
    settings: Record<string, any>,
    resultText: string,
    sourceBufferId?: string
  ) => Buffer | null;
  createAnalysisBuffer: (
    tool: string,
    analysisResult: any,
    sourceBufferId?: string
  ) => Buffer | null;
  getActiveBuffer: () => Buffer | null;
  getBuffer: (bufferId: string) => Buffer | null;
  setActiveBuffer: (bufferId: string) => void;
  enableChainMode: () => void;
  disableChainMode: () => void;
  addEdit: (bufferId: string, edit: Edit) => void;
  updateBufferText: (bufferId: string, newText: string, oldText: string) => void;
  closeBuffer: (bufferId: string) => void;
  loadBuffers: (buffers: Buffer[], activeBufferId: string) => void;
  clearBuffers: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
  userTier?: string;
  archiveName?: string;
}

export function SessionProvider({ children, userTier = 'free', archiveName = 'main' }: SessionProviderProps) {
  const bufferManager = useBufferManager(userTier);
  const sessionManager = useSessionManager(userTier, archiveName);

  // Sync buffers with session whenever they change
  // Use ref to track if we should sync (avoid infinite loop)
  const syncRef = React.useRef(false);

  React.useEffect(() => {
    if (sessionManager.hasSession && syncRef.current) {
      sessionManager.updateBuffers(bufferManager.buffers, bufferManager.activeBufferId);
    }
    syncRef.current = true;
  }, [bufferManager.buffers, bufferManager.activeBufferId, sessionManager.hasSession]);

  const value: SessionContextValue = {
    // Session Manager
    ...sessionManager,

    // Buffer Manager
    ...bufferManager
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
