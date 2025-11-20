// ============================================================
// HUMANIZER API CLIENT
// Integrates with the existing npe-api Cloudflare Workers backend
// ============================================================

import type {
  Narrative,
  TransformConfig,
  TransformResult,
  APIError,
} from '../types';

// Configuration - can be overridden via environment variables
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://npe-api.tem-527.workers.dev';

class HumanizerAPI {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
    // Try to load token from localStorage
    this.token = localStorage.getItem('narrative-studio-auth-token');
  }

  // ============================================================
  // AUTHENTICATION
  // ============================================================

  async login(email: string, password: string): Promise<{ token: string }> {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await this.handleError(response);
      throw error;
    }

    const data = await response.json();
    this.token = data.token;
    localStorage.setItem('narrative-studio-auth-token', data.token);
    return data;
  }

  async logout(): Promise<void> {
    this.token = null;
    localStorage.removeItem('narrative-studio-auth-token');
  }

  async me(): Promise<{ email: string; role: string }> {
    return this.authenticatedFetch('/auth/me');
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  // ============================================================
  // TRANSFORMATIONS
  // ============================================================

  async runTransformation(
    text: string,
    config: TransformConfig
  ): Promise<TransformResult> {
    const endpoint = this.getTransformEndpoint(config.type);

    return this.authenticatedFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        text,
        ...config.parameters,
      }),
    });
  }

  private getTransformEndpoint(type: TransformConfig['type']): string {
    switch (type) {
      case 'computer-humanizer':
        return '/transformations/computer-humanizer';
      case 'allegorical':
        return '/transformations/allegorical';
      case 'persona':
        return '/transformations/persona';
      case 'namespace':
        return '/transformations/namespace';
      case 'style':
        return '/transformations/style';
      case 'ai-detection':
        return '/transformations/ai-detection';
      default:
        throw new Error(`Unknown transformation type: ${type}`);
    }
  }

  // ============================================================
  // ARCHIVE (Encrypted Conversations)
  // ============================================================

  async getConversations(): Promise<unknown[]> {
    return this.authenticatedFetch('/archive/conversations');
  }

  async getConversation(conversationId: string): Promise<unknown> {
    return this.authenticatedFetch(`/archive/conversations/${conversationId}`);
  }

  async getMessages(conversationId: string): Promise<unknown[]> {
    return this.authenticatedFetch(`/archive/conversations/${conversationId}/messages`);
  }

  async uploadArchive(file: File, password: string): Promise<unknown> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);

    return this.authenticatedFetch('/archive/upload', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary
      headers: {},
    });
  }

  async decryptMessage(
    conversationId: string,
    messageId: string,
    password: string
  ): Promise<{ content: string }> {
    return this.authenticatedFetch('/archive/decrypt', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: conversationId,
        message_id: messageId,
        password,
      }),
    });
  }

  // ============================================================
  // NARRATIVES (Local + API)
  // Note: The current API doesn't have dedicated narrative endpoints.
  // These methods work with localStorage and can be extended when API adds support.
  // ============================================================

  async getNarratives(): Promise<Narrative[]> {
    // For now, load from localStorage
    // Future: sync with API
    const stored = localStorage.getItem('narrative-studio-narratives');
    if (!stored) return [];

    try {
      const narratives = JSON.parse(stored);
      // Ensure dates are Date objects
      return narratives.map((n: Narrative) => ({
        ...n,
        createdAt: new Date(n.createdAt),
        updatedAt: new Date(n.updatedAt),
      }));
    } catch {
      return [];
    }
  }

  async getNarrative(id: string): Promise<Narrative | null> {
    const narratives = await this.getNarratives();
    return narratives.find((n) => n.id === id) || null;
  }

  async saveNarrative(narrative: Narrative): Promise<Narrative> {
    const narratives = await this.getNarratives();
    const existing = narratives.findIndex((n) => n.id === narrative.id);

    const updated = {
      ...narrative,
      updatedAt: new Date(),
    };

    if (existing >= 0) {
      narratives[existing] = updated;
    } else {
      narratives.push(updated);
    }

    localStorage.setItem('narrative-studio-narratives', JSON.stringify(narratives));
    return updated;
  }

  async deleteNarrative(id: string): Promise<void> {
    const narratives = await this.getNarratives();
    const filtered = narratives.filter((n) => n.id !== id);
    localStorage.setItem('narrative-studio-narratives', JSON.stringify(filtered));
  }

  // ============================================================
  // CONFIGURATION - Personas, Namespaces, Styles
  // ============================================================

  async getPersonas(): Promise<Array<{ id: number; name: string; description: string }>> {
    const response = await fetch(`${this.baseURL}/config/personas`);
    if (!response.ok) {
      throw new Error('Failed to fetch personas');
    }
    return response.json();
  }

  async getNamespaces(): Promise<Array<{ id: number; name: string; description: string }>> {
    const response = await fetch(`${this.baseURL}/config/namespaces`);
    if (!response.ok) {
      throw new Error('Failed to fetch namespaces');
    }
    return response.json();
  }

  async getStyles(): Promise<Array<{ id: number; name: string; style_prompt: string }>> {
    const response = await fetch(`${this.baseURL}/config/styles`);
    if (!response.ok) {
      throw new Error('Failed to fetch styles');
    }
    return response.json();
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private async authenticatedFetch(
    endpoint: string,
    options: RequestInit & { headers?: Record<string, string> } = {}
  ): Promise<any> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
      ...(options.headers || {}),
    };

    // Remove Content-Type if body is FormData
    if (options.body instanceof FormData && headers instanceof Object) {
      delete (headers as Record<string, string>)['Content-Type'];
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await this.handleError(response);
      throw error;
    }

    return response.json();
  }

  private async handleError(response: Response): Promise<APIError> {
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }

    return {
      message: `API Error: ${response.status} ${response.statusText}`,
      status: response.status,
      details,
    };
  }
}

// Export singleton instance
export const api = new HumanizerAPI();
