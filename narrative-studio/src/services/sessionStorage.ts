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
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 second

  constructor() {
    // Sessions always go through npe-api (D1 backed)
    // This works consistently across local dev, cloud, and Electron
    this.baseUrl = `${STORAGE_PATHS.npeApiUrl}${STORAGE_PATHS.sessionEndpoint}`;
  }

  /**
   * Retry logic with exponential backoff
   * Only retries on network errors, not on 404/422 (client errors)
   */
  private async fetchWithRetry(
    url: string,
    options?: RequestInit,
    retryCount = 0
  ): Promise<Response> {
    try {
      const response = await fetch(url, options);

      // Don't retry on client errors (404, 422, etc.)
      if (!response.ok && response.status >= 400 && response.status < 500) {
        return response;
      }

      // Retry on server errors (5xx) or network issues
      if (!response.ok && retryCount < this.MAX_RETRIES) {
        const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        console.warn(`⚠️  Request failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }

      return response;
    } catch (error) {
      // Network error - retry if attempts remaining
      if (retryCount < this.MAX_RETRIES) {
        const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        console.warn(`⚠️  Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.MAX_RETRIES})`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }

      // Max retries exhausted
      throw error;
    }
  }

  async createSession(session: Session): Promise<void> {
    const response = await this.fetchWithRetry(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });

    if (!response.ok) {
      throw new Error('Failed to create session');
    }
  }

  async listSessions(): Promise<Session[]> {
    const response = await this.fetchWithRetry(this.baseUrl);

    if (!response.ok) {
      throw new Error('Failed to list sessions');
    }

    return response.json();
  }

  async getSession(sessionId: string): Promise<Session> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/${sessionId}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Session not found');
      }
      if (response.status === 422) {
        throw new Error('Session file is corrupted');
      }
      throw new Error('Failed to get session');
    }

    return response.json();
  }

  async updateSession(session: Session): Promise<void> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/${session.sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });

    if (!response.ok) {
      throw new Error('Failed to update session');
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/${sessionId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to delete session');
    }
  }

  async renameSession(sessionId: string, name: string): Promise<Session> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/${sessionId}/rename`, {
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
