// Cloud API Client for NPE Workers API
// Provides typed fetch wrappers for authentication, transformations, and configuration

import type {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  AllegoricalProjectionResponse,
  RoundTripTranslationRequest,
  RoundTripTranslationResponse,
  MaieuticStartRequest,
  MaieuticStartResponse,
  MaieuticRespondRequest,
  MaieuticRespondResponse,
  NPEPersona,
  NPENamespace,
  NPEStyle
} from '../../../workers/shared/types';

// API base URL - will be set based on environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

class CloudAPIClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // Load token from localStorage if available
    this.token = localStorage.getItem('npe_auth_token');
  }

  /**
   * Set authentication token
   */
  setToken(token: string) {
    this.token = token;
    localStorage.setItem('npe_auth_token', token);
  }

  /**
   * Clear authentication token
   */
  clearToken() {
    this.token = null;
    localStorage.removeItem('npe_auth_token');
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Generic fetch wrapper with auth headers
   */
  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };

    // Add auth token if available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ========== AUTHENTICATION ==========

  /**
   * Register new user account
   */
  async register(email: string, password: string): Promise<AuthResponse> {
    const request: RegisterRequest = { email, password };
    const response = await this.fetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(request)
    });

    // Store token
    this.setToken(response.token);

    return response;
  }

  /**
   * Login existing user
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const request: LoginRequest = { email, password };
    const response = await this.fetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(request)
    });

    // Store token
    this.setToken(response.token);

    return response;
  }

  /**
   * Get current user info
   */
  async getCurrentUser() {
    return this.fetch('/auth/me', { method: 'GET' });
  }

  /**
   * Logout (clear token)
   */
  logout() {
    this.clearToken();
  }

  // ========== TRANSFORMATIONS ==========

  /**
   * Create allegorical projection
   */
  async createAllegoricalProjection(
    text: string,
    persona: string,
    namespace: string,
    style: string,
    model?: string,
    length_preference?: 'shorter' | 'same' | 'longer' | 'much_longer'
  ): Promise<AllegoricalProjectionResponse> {
    const request: any = { text, persona, namespace, style };

    // Add optional parameters if provided
    if (model) request.model = model;
    if (length_preference) request.length_preference = length_preference;

    return this.fetch<AllegoricalProjectionResponse>('/transformations/allegorical', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  /**
   * Create round-trip translation
   */
  async createRoundTripTranslation(
    text: string,
    intermediate_language: string
  ): Promise<RoundTripTranslationResponse> {
    const request: RoundTripTranslationRequest = { text, intermediate_language };
    return this.fetch<RoundTripTranslationResponse>('/transformations/round-trip', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  /**
   * Start maieutic dialogue session
   */
  async startMaieuticDialogue(
    text: string,
    goal: string = 'understand'
  ): Promise<MaieuticStartResponse> {
    const request: MaieuticStartRequest = { text, goal };
    return this.fetch<MaieuticStartResponse>('/transformations/maieutic/start', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  /**
   * Continue maieutic dialogue with answer
   */
  async respondToMaieuticQuestion(
    sessionId: string,
    answer: string
  ): Promise<MaieuticRespondResponse> {
    const request: MaieuticRespondRequest = { answer };
    return this.fetch<MaieuticRespondResponse>(
      `/transformations/maieutic/${sessionId}/respond`,
      {
        method: 'POST',
        body: JSON.stringify(request)
      }
    );
  }

  /**
   * Get maieutic session state
   */
  async getMaieuticSession(sessionId: string) {
    return this.fetch(`/transformations/maieutic/${sessionId}`, { method: 'GET' });
  }

  // ========== CONFIGURATION ==========

  /**
   * Get available personas
   */
  async getPersonas(): Promise<NPEPersona[]> {
    return this.fetch<NPEPersona[]>('/config/personas', { method: 'GET' });
  }

  /**
   * Get available namespaces
   */
  async getNamespaces(): Promise<NPENamespace[]> {
    return this.fetch<NPENamespace[]>('/config/namespaces', { method: 'GET' });
  }

  /**
   * Get available styles
   */
  async getStyles(): Promise<NPEStyle[]> {
    return this.fetch<NPEStyle[]>('/config/styles', { method: 'GET' });
  }

  /**
   * Get supported languages
   */
  async getLanguages(): Promise<string[]> {
    const response = await this.fetch<{ languages: string[] }>('/config/languages', {
      method: 'GET'
    });
    return response.languages;
  }

  /**
   * Start quantum reading analysis session
   */
  async startQuantumAnalysis(text: string): Promise<any> {
    return this.fetch('/quantum-analysis/start', {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  }

  /**
   * Process next sentence in quantum analysis
   */
  async quantumAnalysisStep(sessionId: string): Promise<any> {
    return this.fetch(`/quantum-analysis/${sessionId}/step`, {
      method: 'POST'
    });
  }

  /**
   * Get quantum analysis session state
   */
  async getQuantumAnalysisSession(sessionId: string): Promise<any> {
    return this.fetch(`/quantum-analysis/${sessionId}`, {
      method: 'GET'
    });
  }

  /**
   * Get quantum analysis trace (full history)
   */
  async getQuantumAnalysisTrace(sessionId: string): Promise<any> {
    return this.fetch(`/quantum-analysis/${sessionId}/trace`, {
      method: 'GET'
    });
  }

  // ========== MODEL SELECTION ==========

  /**
   * Get available LLM models (tier-based)
   * Returns Cloudflare models + external models if API keys configured
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    const response = await this.fetch<{ models: ModelInfo[] }>('/config/models', {
      method: 'GET'
    });
    return response.models;
  }

  // ========== API KEY MANAGEMENT ==========

  /**
   * Set or update API keys (PRO+ only)
   */
  async setAPIKeys(keys: {
    openai_api_key?: string | null;
    anthropic_api_key?: string | null;
    google_api_key?: string | null;
  }): Promise<void> {
    await this.fetch('/user/api-keys', {
      method: 'POST',
      body: JSON.stringify(keys)
    });
  }

  /**
   * Get API key status (which providers have keys configured)
   */
  async getAPIKeyStatus(): Promise<APIKeyStatus> {
    return this.fetch<APIKeyStatus>('/user/api-keys/status', {
      method: 'GET'
    });
  }

  /**
   * Delete a specific API key
   */
  async deleteAPIKey(provider: 'openai' | 'anthropic' | 'google'): Promise<void> {
    await this.fetch(`/user/api-keys/${provider}`, {
      method: 'DELETE'
    });
  }

  /**
   * Test an API key connection
   */
  async testAPIKeyConnection(provider: 'openai' | 'anthropic' | 'google', apiKey: string): Promise<boolean> {
    try {
      // We'll do a simple test by temporarily setting the key and trying to fetch models
      // In a real implementation, you might want a dedicated test endpoint
      await this.setAPIKeys({ [`${provider}_api_key`]: apiKey });
      const models = await this.getAvailableModels();
      return models.some(m => m.provider === provider);
    } catch {
      return false;
    }
  }

  // ========== USER PREFERENCES ==========

  /**
   * Get user preferences (model, length, etc.)
   */
  async getUserPreferences(): Promise<UserPreferences> {
    return this.fetch<UserPreferences>('/user/preferences', {
      method: 'GET'
    });
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(prefs: {
    preferred_model?: string;
    preferred_length?: 'shorter' | 'same' | 'longer' | 'much_longer';
  }): Promise<void> {
    await this.fetch('/user/preferences', {
      method: 'PATCH',
      body: JSON.stringify(prefs)
    });
  }

  // ========== PERSONALIZER (VOICE/STYLE MANAGEMENT) ==========

  /**
   * Upload a writing sample for voice discovery
   */
  async uploadWritingSample(
    content: string,
    source_type: 'manual' | 'chatgpt' | 'claude' | 'other',
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; sample_id: number; word_count: number }> {
    return this.fetch('/personal/samples/upload', {
      method: 'POST',
      body: JSON.stringify({ content, source_type, metadata })
    });
  }

  /**
   * Get user's writing samples
   */
  async getWritingSamples(): Promise<any[]> {
    const response = await this.fetch<{ samples: any[]; total: number; total_words: number }>(
      '/personal/samples',
      { method: 'GET' }
    );
    return response.samples;
  }

  /**
   * Delete a writing sample
   */
  async deleteWritingSample(sampleId: number): Promise<void> {
    await this.fetch(`/personal/samples/${sampleId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get user's personal personas (discovered + custom)
   */
  async getPersonalPersonas(): Promise<any[]> {
    const response = await this.fetch<{ personas: any[]; total: number; discovered: number; custom: number }>(
      '/personal/personas',
      { method: 'GET' }
    );
    return response.personas;
  }

  /**
   * Create a custom persona
   */
  async createPersonalPersona(
    name: string,
    description?: string,
    example_texts?: string[],
    metadata?: Record<string, any>
  ): Promise<any> {
    const response = await this.fetch<{ persona: any }>('/personal/personas', {
      method: 'POST',
      body: JSON.stringify({ name, description, example_texts, metadata })
    });
    return response.persona;
  }

  /**
   * Update a persona (name, description, metadata only)
   */
  async updatePersonalPersona(
    personaId: number,
    name?: string,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<any> {
    const response = await this.fetch<{ persona: any }>(`/personal/personas/${personaId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description, metadata })
    });
    return response.persona;
  }

  /**
   * Delete a persona
   */
  async deletePersonalPersona(personaId: number): Promise<void> {
    await this.fetch(`/personal/personas/${personaId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Discover voices from writing samples (analyze + cluster)
   */
  async discoverPersonalVoices(
    min_clusters: number = 3,
    max_clusters: number = 7
  ): Promise<any> {
    return this.fetch('/personal/personas/discover-voices', {
      method: 'POST',
      body: JSON.stringify({ min_clusters, max_clusters })
    });
  }

  /**
   * Get user's personal styles (discovered + custom)
   */
  async getPersonalStyles(): Promise<any[]> {
    const response = await this.fetch<{ styles: any[]; total: number; discovered: number; custom: number }>(
      '/personal/styles',
      { method: 'GET' }
    );
    return response.styles;
  }

  /**
   * Create a custom style
   */
  async createPersonalStyle(
    name: string,
    description?: string,
    formality_score?: number,
    complexity_score?: number,
    tone_markers?: string[],
    example_texts?: string[],
    metadata?: Record<string, any>
  ): Promise<any> {
    const response = await this.fetch<{ style: any }>('/personal/styles', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        formality_score,
        complexity_score,
        tone_markers,
        example_texts,
        metadata
      })
    });
    return response.style;
  }

  /**
   * Update a style
   */
  async updatePersonalStyle(
    styleId: number,
    updates: {
      name?: string;
      description?: string;
      formality_score?: number;
      complexity_score?: number;
      tone_markers?: string[];
      metadata?: Record<string, any>;
    }
  ): Promise<any> {
    const response = await this.fetch<{ style: any }>(`/personal/styles/${styleId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return response.style;
  }

  /**
   * Delete a style
   */
  async deletePersonalStyle(styleId: number): Promise<void> {
    await this.fetch(`/personal/styles/${styleId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Transform text using personal persona and/or style
   */
  async transformWithPersonalizer(
    text: string,
    persona_id?: number,
    style_id?: number,
    model?: string
  ): Promise<any> {
    return this.fetch('/transformations/personalizer', {
      method: 'POST',
      body: JSON.stringify({ text, persona_id, style_id, model })
    });
  }

  /**
   * Get personalizer transformation history
   */
  async getPersonalizerHistory(limit: number = 10, offset: number = 0): Promise<any> {
    return this.fetch(`/transformations/personalizer/history?limit=${limit}&offset=${offset}`, {
      method: 'GET'
    });
  }

  // ========== AI DETECTION ==========

  /**
   * Detect if text is AI-generated
   */
  async detectAI(text: string, useAPI: boolean = false): Promise<any> {
    return this.fetch('/ai-detection/detect', {
      method: 'POST',
      body: JSON.stringify({ text, useAPI })
    });
  }

  /**
   * Get AI detection status (check if API is available)
   */
  async getAIDetectionStatus(): Promise<{
    localDetection: boolean;
    apiDetection: boolean;
    userTier: string;
    canUseAPI: boolean;
  }> {
    return this.fetch('/ai-detection/status', {
      method: 'GET'
    });
  }

  /**
   * Get the dictionary of AI tell-words
   */
  async getTellWords(): Promise<any> {
    return this.fetch('/ai-detection/tell-words', {
      method: 'GET'
    });
  }
}

// ========== TYPES ==========

export interface ModelInfo {
  id: string;
  name: string;
  provider: 'cloudflare' | 'openai' | 'anthropic' | 'google';
  description: string;
  requires_api_key: boolean;
  max_tokens: number;
  recommended_use?: string;
}

export interface APIKeyStatus {
  has_openai_key: boolean;
  has_anthropic_key: boolean;
  has_google_key: boolean;
  last_updated: number | null;
}

export interface UserPreferences {
  preferred_model: string;
  preferred_length: 'shorter' | 'same' | 'longer' | 'much_longer';
}

// Export singleton instance
export const cloudAPI = new CloudAPIClient();
