import ky from "ky";
import { z } from "zod";

// Cache-bust: CORS fix deployed 2025-11-10
// Version: 1.1.0 - Force bundle rehash
/** Toggle at runtime; start with 'v1' */
export type ApiVersion = "v1" | "v2";
export type ProcessingTarget = "local" | "remote";

// Deployment version constant to force bundle hash change
export const WORKBENCH_VERSION = "1.1.0-cors-fix";

export const ApiConfig = {
  workbenchVersion: WORKBENCH_VERSION, // Force new bundle hash
  version: (import.meta.env.VITE_API_VERSION as ApiVersion) ?? "v1",
  baseUrlRemote: (import.meta.env.VITE_API_BASE_REMOTE as string) ?? "https://api.humanizer.com",
  baseUrlLocal: (import.meta.env.VITE_API_BASE_LOCAL as string) ?? "http://localhost:8000",
  processingTarget: (import.meta.env.VITE_PROCESSING_TARGET as ProcessingTarget) ?? "remote",

  // Helper to get current base URL
  get baseUrl(): string {
    return this.processingTarget === "local" ? this.baseUrlLocal : this.baseUrlRemote;
  },

  // Helper to switch backend at runtime
  setProcessingTarget(target: ProcessingTarget) {
    this.processingTarget = target;
    // Force HTTP client re-creation
    location.reload(); // Simple approach, can be optimized later
  },
};

// Create HTTP client that uses current baseUrl
const createHttpClient = () => ky.create({
  retry: 0,
  prefixUrl: ApiConfig.baseUrl,
  hooks: {
    beforeRequest: [
      (request) => {
        // Inject auth token for remote API
        if (ApiConfig.processingTarget === "remote") {
          const token = localStorage.getItem("auth_token");
          if (token) {
            request.headers.set("Authorization", `Bearer ${token}`);
          }
        }
      }
    ]
  }
});

const http = createHttpClient();

/** Common shapes (stable across v1/v2) */
export const Gem = z.object({
  id: z.string(),
  title: z.string().default("Untitled"),
  snippet: z.string().optional(),
  tokens: z.number().optional(),
});
export type Gem = z.infer<typeof Gem>;

export const POVMWeights = z.object({
  T: z.number(), F: z.number(), B: z.number(), N: z.number(), alpha: z.number(),
});
export type POVMWeights = z.infer<typeof POVMWeights>;

export const Metrics = z.object({
  deltaCos: z.number().optional(),
  fidelity: z.number().optional(),
  rhoDelta: z.number().optional(),
  povmBefore: POVMWeights.optional(),
  povmAfter: POVMWeights.optional(),
});
export type Metrics = z.infer<typeof Metrics>;

/** Quantum reading types */
export const QuantumSession = z.object({
  session_id: z.string(),
  total_sentences: z.number(),
  current_index: z.number(),
  initial_state: z.object({
    purity: z.number(),
    entropy: z.number(),
  }),
});
export type QuantumSession = z.infer<typeof QuantumSession>;

export const TetralemmaReading = z.object({
  literal: z.number(),
  metaphorical: z.number(),
  both: z.number(),
  neither: z.number(),
  evidence: z.object({
    literal: z.string(),
    metaphorical: z.string(),
    both: z.string(),
    neither: z.string(),
  }),
});
export type TetralemmaReading = z.infer<typeof TetralemmaReading>;

export const QuantumStep = z.object({
  sentence: z.string(),
  index: z.number(),
  measurement: TetralemmaReading,
  rho_state: z.object({
    purity: z.number(),
    entropy: z.number(),
    top_eigenvalues: z.array(z.number()).optional(),
  }),
});
export type QuantumStep = z.infer<typeof QuantumStep>;

/** NPE Transformation types */
export const AllegoricalResponse = z.object({
  transformation_id: z.string().optional(),
  final_projection: z.string(),
  reflection: z.string(),
  stages: z.object({
    deconstruct: z.string(),
    map: z.string(),
    reconstruct: z.string(),
    stylize: z.string(),
  }),
});
export type AllegoricalResponse = z.infer<typeof AllegoricalResponse>;

export const RoundTripResponse = z.object({
  transformation_id: z.string().optional(),
  original_text: z.string(),
  final_text: z.string(),
  intermediate_translations: z.array(z.object({
    language: z.string(),
    text: z.string(),
  })),
  drift_analysis: z.string(),
});
export type RoundTripResponse = z.infer<typeof RoundTripResponse>;

/** Transformation History types */
export const TransformationHistoryItem = z.object({
  id: z.string(),
  user_id: z.string(),
  transformation_type: z.string(),
  input_text: z.string(),
  output_text: z.string(),
  config: z.record(z.string(), z.unknown()).optional(),
  is_favorite: z.boolean(),
  created_at: z.string(),
});
export type TransformationHistoryItem = z.infer<typeof TransformationHistoryItem>;

export const QuantumAnalysisSession = z.object({
  id: z.string(),
  user_id: z.string(),
  original_text: z.string(),
  total_sentences: z.number(),
  current_index: z.number(),
  status: z.enum(['in_progress', 'completed', 'abandoned']),
  created_at: z.string(),
  updated_at: z.string(),
});
export type QuantumAnalysisSession = z.infer<typeof QuantumAnalysisSession>;

/** AI Detection types */
export const AIDetectionResponse = z.object({
  transformation_id: z.string().optional(),
  is_ai_generated: z.boolean(),
  confidence: z.number(),
  tell_words: z.array(z.object({
    word: z.string(),
    position: z.number(),
    severity: z.enum(['low', 'medium', 'high']),
  })),
  analysis: z.string(),
  grade: z.enum(['clearly_human', 'likely_human', 'uncertain', 'likely_ai', 'clearly_ai']),
});
export type AIDetectionResponse = z.infer<typeof AIDetectionResponse>;

/** Personalizer types */
export const PersonalizerResponse = z.object({
  transformation_id: z.string().optional(),
  personalized_text: z.string(),
  similarity_score: z.number(),
  voice_profile: z.string(),
  analysis: z.string().optional(),
});
export type PersonalizerResponse = z.infer<typeof PersonalizerResponse>;

/** Maieutic types */
export const MaieuticResponse = z.object({
  transformation_id: z.string().optional(),
  question: z.string(),
  reasoning: z.string(),
  depth: z.number(),
  conversation: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
});
export type MaieuticResponse = z.infer<typeof MaieuticResponse>;

/** API surface the UI expects; filled by v1 or v2 impls */
export interface WorkbenchAPI {
  // Original workbench endpoints
  listGems(q?: string): Promise<Gem[]>;
  getGem(id: string): Promise<{ gem: Gem; text: string }>;
  extractFacets(input: { text?: string; gemId?: string }): Promise<Record<string, unknown>>;
  evalPOVM(input: { text: string; axis: string }): Promise<POVMWeights>;
  rhoInspect(input: { text: string }): Promise<{ projections: number[] }>;
  rhoMove(input: {
    text?: string; gemId?: string;
    params: { axis: string; corner?: string; step?: number };
    guardrails?: { maxEdits?: number; fidelity?: number; toxicity?: boolean };
    chunking?: { strategy: "sentence"|"paragraph"|"window"; size?: number };
  }): Promise<{ text: string; metrics: Metrics }>;

  // Quantum reading (sentence-by-sentence)
  quantumStart(input: { text: string }): Promise<QuantumSession>;
  quantumStep(session_id: string): Promise<QuantumStep>;
  quantumTrace(session_id: string): Promise<{ measurements: QuantumStep[] }>;

  // NPE Transformations
  allegorical(input: {
    text: string;
    persona: string;
    namespace: string;
    style: string;
    model?: string;
    length_preference?: string;
  }): Promise<AllegoricalResponse>;

  roundTrip(input: {
    text: string;
    language: string;
  }): Promise<RoundTripResponse>;

  aiDetect(input: {
    text: string;
  }): Promise<AIDetectionResponse>;

  personalizer(input: {
    text: string;
    voice_profile?: string;
    voice_samples?: string[];
  }): Promise<PersonalizerResponse>;

  maieutic(input: {
    text: string;
    depth: number;
    conversation_history?: Array<{ role: string; content: string }>;
  }): Promise<MaieuticResponse>;

  // Config endpoints
  getPersonas(): Promise<Array<{ id: string; name: string; description: string }>>;
  getNamespaces(): Promise<Array<{ id: string; name: string; description: string }>>;
  getStyles(): Promise<Array<{ id: string; name: string; description: string }>>;
  getLanguages(): Promise<Array<{ code: string; name: string }>>;

  // History & Sessions
  getTransformationHistory(filters?: {
    type?: string;
    favorite?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<TransformationHistoryItem[]>;
  toggleFavorite(id: string): Promise<{ is_favorite: boolean }>;
  deleteTransformation(id: string): Promise<void>;
  getQuantumSessions(): Promise<QuantumAnalysisSession[]>;
  getQuantumSession(id: string): Promise<QuantumAnalysisSession>;
  deleteQuantumSession(id: string): Promise<void>;
}

/** V1 implementation (uses current routes) */
const v1: WorkbenchAPI = {
  async listGems(q) {
    const res = await http.get(`gems${q ? `?q=${encodeURIComponent(q)}` : ""}`).json<any>();
    return z.array(Gem).parse(res.items ?? res);
  },
  async getGem(id) {
    const res = await http.get(`gems/${id}`).json<any>();
    return { gem: Gem.parse(res.meta), text: String(res.text) };
  },
  async extractFacets(body) {
    const res = await http.post(`facets/extract`, { json: body }).json<any>();
    return res;
  },
  async evalPOVM(body) {
    const res = await http.post(`eval/povm`, { json: body }).json<any>();
    return POVMWeights.parse(res);
  },
  async rhoInspect(body) {
    const res = await http.post(`rho/inspect`, { json: body }).json<any>();
    return { projections: res.projections ?? [] };
  },
  async rhoMove(body) {
    const res = await http.post(`transform/rho-move`, { json: body }).json<any>();
    return { text: res.text, metrics: Metrics.parse(res.metrics ?? {}) };
  },
  async quantumStart(body) {
    const res = await http.post(`quantum-analysis/start`, { json: body }).json<any>();
    return QuantumSession.parse(res);
  },
  async quantumStep(session_id) {
    const res = await http.post(`quantum-analysis/${session_id}/step`).json<any>();
    return QuantumStep.parse(res);
  },
  async quantumTrace(session_id) {
    const res = await http.get(`quantum-analysis/${session_id}/trace`).json<any>();
    return { measurements: z.array(QuantumStep).parse(res.measurements ?? []) };
  },

  // NPE Transformations
  async allegorical(body) {
    const res = await http.post(`transformations/allegorical`, { json: body }).json<any>();
    return AllegoricalResponse.parse(res);
  },
  async roundTrip(body) {
    const res = await http.post(`transformations/round-trip`, { json: body }).json<any>();
    return RoundTripResponse.parse(res);
  },
  async aiDetect(body) {
    const res = await http.post(`ai-detection/detect`, { json: body }).json<any>();
    return AIDetectionResponse.parse(res);
  },
  async personalizer(body) {
    const res = await http.post(`transformations/personalizer`, { json: body }).json<any>();
    return PersonalizerResponse.parse(res);
  },
  async maieutic(body) {
    const res = await http.post(`transformations/maieutic/start`, { json: body }).json<any>();
    return MaieuticResponse.parse(res);
  },

  // Config endpoints
  async getPersonas() {
    const res = await http.get(`config/personas`).json<any>();
    return res.personas ?? res;
  },
  async getNamespaces() {
    const res = await http.get(`config/namespaces`).json<any>();
    return res.namespaces ?? res;
  },
  async getStyles() {
    const res = await http.get(`config/styles`).json<any>();
    return res.styles ?? res;
  },
  async getLanguages() {
    const res = await http.get(`config/languages`).json<any>();
    return res.languages ?? res;
  },

  // History & Sessions
  async getTransformationHistory(filters) {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.favorite !== undefined) params.set('favorite', String(filters.favorite));
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));

    const res = await http.get(`transformation-history?${params.toString()}`).json<any>();
    return z.array(TransformationHistoryItem).parse(res.items ?? res);
  },
  async toggleFavorite(id) {
    const res = await http.post(`transformation-history/${id}/favorite`).json<any>();
    return { is_favorite: res.is_favorite };
  },
  async deleteTransformation(id) {
    await http.delete(`transformation-history/${id}`);
  },
  async getQuantumSessions() {
    const res = await http.get(`quantum-analysis/sessions`).json<any>();
    return z.array(QuantumAnalysisSession).parse(res.sessions ?? res);
  },
  async getQuantumSession(id) {
    const res = await http.get(`quantum-analysis/${id}`).json<any>();
    return QuantumAnalysisSession.parse(res);
  },
  async deleteQuantumSession(id) {
    await http.delete(`quantum-analysis/sessions/${id}`);
  },
};

/** V2 implementation (ρ-centric architecture) */
const v2: WorkbenchAPI = {
  // V2 uses narratives as first-class citizens
  async listGems(q) {
    const r = await http.get(`v2/narratives`, { searchParams: q ? { q } : {} }).json<any>();
    return z.array(Gem).parse(r.narratives ?? r.items ?? r);
  },

  async getGem(id) {
    const r = await http.get(`v2/narratives/${id}`).json<any>();
    // V2 returns { narrative, rho, ... }
    return {
      gem: Gem.parse({ id: r.narrative.id, title: r.narrative.title ?? "Untitled" }),
      text: String(r.narrative.text)
    };
  },

  // V2 ρ-centric operations
  async extractFacets(b) {
    // TODO: Implement v2/facets/extract when endpoint is ready
    return http.post(`v2/facets/extract`, { json: b }).json<any>();
  },

  async evalPOVM(b) {
    // V2 uses /v2/rho/measure with narrative_id
    // First create narrative if text provided
    let narrative_id = (b as any).narrative_id;
    if (!narrative_id && (b as any).text) {
      const createRes = await http.post(`v2/narratives`, {
        json: { text: (b as any).text, title: "POVM Analysis" }
      }).json<any>();
      narrative_id = createRes.narrative.id;
    }

    const r = await http.post(`v2/rho/measure`, {
      json: { narrative_id, axis: (b as any).axis ?? 'literalness' }
    }).json<any>();

    // Convert POVM response to POVMWeights format
    return POVMWeights.parse({
      T: r.probabilities.literal,
      F: r.probabilities.metaphorical,
      B: r.probabilities.both,
      N: r.probabilities.neither,
      alpha: r.coherence,
    });
  },

  async rhoInspect(b) {
    // V2 uses /v2/rho/inspect with rho_id
    // First create narrative if text provided
    let rho_id = (b as any).rho_id;
    if (!rho_id && (b as any).text) {
      const createRes = await http.post(`v2/narratives`, {
        json: { text: (b as any).text, title: "ρ Inspection" }
      }).json<any>();
      rho_id = createRes.rho.id;
    }

    const r = await http.post(`v2/rho/inspect`, {
      json: { rho_id }
    }).json<any>();

    return { projections: r.top_eigenvalues ?? r.eigenvalues ?? [] };
  },

  async rhoMove(b) {
    // TODO: Implement v2/transform/rho-move when endpoint is ready
    const r = await http.post(`v2/transform/rho-move`, { json: b }).json<any>();
    return { text: r.text, metrics: Metrics.parse(r.metrics ?? {}) };
  },

  // V2 Quantum Reading (uses v1 endpoints for now, will migrate)
  async quantumStart(b) {
    const r = await http.post(`quantum-analysis/start`, { json: b }).json<any>();
    return QuantumSession.parse(r);
  },

  async quantumStep(id) {
    const r = await http.post(`quantum-analysis/${id}/step`).json<any>();
    return QuantumStep.parse(r);
  },

  async quantumTrace(id) {
    const r = await http.get(`quantum-analysis/${id}/trace`).json<any>();
    return { measurements: z.array(QuantumStep).parse(r.measurements ?? []) };
  },

  // NPE Transformations (use v1 routes, will migrate to ρ-centric later)
  async allegorical(b) {
    const r = await http.post(`transformations/allegorical`, { json: b }).json<any>();
    return AllegoricalResponse.parse(r);
  },

  async roundTrip(b) {
    const r = await http.post(`transformations/round-trip`, { json: b }).json<any>();
    return RoundTripResponse.parse(r);
  },

  async aiDetect(b) {
    const r = await http.post(`ai-detection/detect`, { json: b }).json<any>();
    return AIDetectionResponse.parse(r);
  },

  async personalizer(b) {
    const r = await http.post(`transformations/personalizer`, { json: b }).json<any>();
    return PersonalizerResponse.parse(r);
  },

  async maieutic(b) {
    const r = await http.post(`transformations/maieutic/start`, { json: b }).json<any>();
    return MaieuticResponse.parse(r);
  },

  // Config endpoints (use v1 routes)
  async getPersonas() {
    const r = await http.get(`config/personas`).json<any>();
    return r.personas ?? r;
  },

  async getNamespaces() {
    const r = await http.get(`config/namespaces`).json<any>();
    return r.namespaces ?? r;
  },

  async getStyles() {
    const r = await http.get(`config/styles`).json<any>();
    return r.styles ?? r;
  },

  async getLanguages() {
    const r = await http.get(`config/languages`).json<any>();
    return r.languages ?? r;
  },

  // History & Sessions (use v1 routes)
  async getTransformationHistory(f) {
    const p = new URLSearchParams();
    if (f?.type) p.set('type', f.type);
    if (f?.favorite !== undefined) p.set('favorite', String(f.favorite));
    if (f?.limit) p.set('limit', String(f.limit));
    if (f?.offset) p.set('offset', String(f.offset));

    const r = await http.get(`transformation-history?${p.toString()}`).json<any>();
    return z.array(TransformationHistoryItem).parse(r.items ?? r);
  },

  async toggleFavorite(id) {
    const r = await http.post(`transformation-history/${id}/favorite`).json<any>();
    return { is_favorite: r.is_favorite };
  },

  async deleteTransformation(id) {
    await http.delete(`transformation-history/${id}`);
  },

  async getQuantumSessions() {
    const r = await http.get(`quantum-analysis/sessions`).json<any>();
    return z.array(QuantumAnalysisSession).parse(r.sessions ?? r);
  },

  async getQuantumSession(id) {
    const r = await http.get(`quantum-analysis/${id}`).json<any>();
    return QuantumAnalysisSession.parse(r);
  },

  async deleteQuantumSession(id) {
    await http.delete(`quantum-analysis/sessions/${id}`);
  },
};

export const api: WorkbenchAPI = ApiConfig.version === "v2" ? v2 : v1;
