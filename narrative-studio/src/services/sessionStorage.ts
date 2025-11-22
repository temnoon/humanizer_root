import { STORAGE_PATHS } from '../config/storage-paths';

export interface Session {
  sessionId: string;
  name: string;
  created: string;
  updated: string;
  sourceArchive: string;
  sourceMessageId?: string;
  buffers: SessionBuffer[];
  activeBufferId: string;
  viewMode: 'split' | 'single-original' | 'single-transformed';
}

export interface SessionBuffer {
  bufferId: string;
  type: 'original' | 'transformation' | 'analysis' | 'edited';
  displayName: string;
  sourceBufferId?: string;
  sourceRef?: string;
  sourceSelection?: { start: number; end: number };
  tool?: string;
  settings?: Record<string, any>;
  text?: string;
  resultText?: string;
  analysisResult?: any;
  metadata?: Record<string, any>;
  userEdits?: Edit[];
  isEdited: boolean;
  created: string;
}

export interface Edit {
  timestamp: string;
  type: 'replace' | 'insert' | 'delete';
  position: { start: number; end: number };
  oldText: string;
  newText: string;
}

class SessionStorageService {
  private baseUrl: string;

  constructor() {
    // Detect environment
    const isLocalhost = window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';

    this.baseUrl = isLocalhost
      ? `${STORAGE_PATHS.archiveServerUrl}${STORAGE_PATHS.sessionEndpoint}`
      : '/api/sessions'; // Cloud endpoint
  }

  async createSession(session: Session): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });

    if (!response.ok) {
      throw new Error('Failed to create session');
    }
  }

  async listSessions(): Promise<Session[]> {
    const response = await fetch(this.baseUrl);

    if (!response.ok) {
      throw new Error('Failed to list sessions');
    }

    return response.json();
  }

  async getSession(sessionId: string): Promise<Session> {
    const response = await fetch(`${this.baseUrl}/${sessionId}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Session not found');
      }
      throw new Error('Failed to get session');
    }

    return response.json();
  }

  async updateSession(session: Session): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${session.sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });

    if (!response.ok) {
      throw new Error('Failed to update session');
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${sessionId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to delete session');
    }
  }

  async renameSession(sessionId: string, name: string): Promise<Session> {
    const response = await fetch(`${this.baseUrl}/${sessionId}/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      throw new Error('Failed to rename session');
    }

    const result = await response.json();
    return result.session;
  }
}

export const sessionStorage = new SessionStorageService();
