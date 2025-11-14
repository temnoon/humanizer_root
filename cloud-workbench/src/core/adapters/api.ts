import ky from "ky";
import { z } from "zod";

// Cache-bust: V1 transformations (reliable, production-ready)
// Version: 1.0.0 - Using V1 transformations with semantic analysis
export type ProcessingTarget = "local" | "remote";

// Deployment version constant
export const WORKBENCH_VERSION = "1.0.0-stable";

export const ApiConfig = {
  workbenchVersion: WORKBENCH_VERSION,
  baseUrlRemote: (import.meta.env.VITE_API_BASE_REMOTE as string) ?? "https://npe-api.tem-527.workers.dev",
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
  timeout: 60000, // 60 seconds for long-running transformations
  prefixUrl: ApiConfig.baseUrl,
  hooks: {
    beforeRequest: [
      (request) => {
        console.log('[HTTP] Making request to:', request.url);
        console.log('[HTTP] Method:', request.method);
        console.log('[HTTP] Base URL:', ApiConfig.baseUrl);
        console.log('[HTTP] Processing target:', ApiConfig.processingTarget);

        // Inject auth token for remote API
        if (ApiConfig.processingTarget === "remote") {
          const token = localStorage.getItem("auth_token");
          if (token) {
            request.headers.set("Authorization", `Bearer ${token}`);
            console.log('[HTTP] Auth token added');
          } else {
            console.log('[HTTP] No auth token found');
          }
        }
      }
    ],
    afterResponse: [
      async (request, _options, response) => {
        console.log('[HTTP] Response from:', request.url);
        console.log('[HTTP] Status:', response.status);

        // Extract error message from response body for non-2xx responses
        if (!response.ok) {
          try {
            const errorData = await response.clone().json();
            if (errorData.error) {
              // Throw custom error with backend message
              const error = new Error(errorData.error);
              error.name = 'BackendError';
              throw error;
            }
          } catch (e: any) {
            // If parsing fails, let ky's default error handling take over
            if (e?.name === 'BackendError') throw e;
          }
        }

        return response;
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
// Allegorical Response (ρ-based API)
export const AllegoricalStage = z.object({
  stage_name: z.string(),
  stage_number: z.number(),
  input_text: z.string(),
  output_text: z.string(),
  rho_before: z.object({
    id: z.string(),
    purity: z.number(),
    entropy: z.number(),
    top_eigenvalues: z.array(z.number()),
  }),
  rho_after: z.object({
    id: z.string(),
    purity: z.number(),
    entropy: z.number(),
    top_eigenvalues: z.array(z.number()),
  }),
  povm_measurement: z.object({
    axis: z.string(),
    probabilities: z.record(z.string(), z.number()),
    coherence: z.number(),
  }).optional(),
  transformation_description: z.string(),
});

export const AllegoricalResponse = z.object({
  transformation_id: z.string(),
  narrative_id: z.string(),
  original_text: z.string(),
  final_text: z.string(),
  stages: z.array(AllegoricalStage),
  overall_metrics: z.object({
    initial_purity: z.number(),
    final_purity: z.number(),
    purity_delta: z.number(),
    initial_entropy: z.number(),
    final_entropy: z.number(),
    entropy_delta: z.number(),
    total_coherence: z.number(),
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
  verdict: z.enum(['human', 'ai', 'uncertain']),
  confidence: z.number(),
  explanation: z.string(),
  method: z.enum(['local', 'gptzero', 'hybrid']),
  signals: z.object({
    burstiness: z.number(),
    tellWordScore: z.number(),
    readabilityPattern: z.number(),
    lexicalDiversity: z.number(),
  }),
  metrics: z.object({
    fleschReadingEase: z.number(),
    gunningFog: z.number(),
    wordCount: z.number(),
    sentenceCount: z.number(),
    avgSentenceLength: z.number(),
  }),
  detectedTellWords: z.array(z.object({
    word: z.string(),
    category: z.string(),
    count: z.number(),
  })),
  processingTimeMs: z.number(),
  message: z.string().optional(),
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

/** Story Generation Types */
export const StoryCharacter = z.object({
  name: z.string(),
  role: z.string(),
  motivation: z.string(),
});
export type StoryCharacter = z.infer<typeof StoryCharacter>;

export const StorySkeleton = z.object({
  characters: z.array(StoryCharacter),
  setting: z.string(),
  conflict: z.string(),
  stakes: z.string(),
});
export type StorySkeleton = z.infer<typeof StorySkeleton>;

export const StoryGenerationResult = z.object({
  story_id: z.string(),
  final_story: z.string(),
  skeleton: StorySkeleton,
  plot_summary: z.string(),
  metadata: z.object({
    word_count: z.number(),
    generation_time_ms: z.number(),
    model_used: z.string(),
  }),
});
export type StoryGenerationResult = z.infer<typeof StoryGenerationResult>;

export const StoryExample = z.object({
  title: z.string(),
  description: z.string(),
  attributes: z.object({
    persona: z.string(),
    namespace: z.string(),
    style: z.string(),
  }),
  seed: z.string().optional(),
});
export type StoryExample = z.infer<typeof StoryExample>;

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

  // Story Generation
  storyGenerate(input: {
    persona: string;
    namespace: string;
    style: string;
    length?: 'short' | 'medium' | 'long';
    seed?: string;
    model?: string;
  }): Promise<StoryGenerationResult>;

  getStoryExamples(): Promise<StoryExample[]>;

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

  // Secure Archive
  getArchiveSalt(): Promise<string>;
  uploadArchiveFile(
    file: Blob,
    iv: number[],
    filename: string,
    contentType: string,
    folder: string | null,
    conversationMetadata?: any,
    parentFileId?: string | null,
    fileRole?: string,
    relativePath?: string
  ): Promise<any>;
  listArchiveFiles(folder?: string): Promise<{ files: any[]; folders: string[]; total: number }>;
  downloadArchiveFile(fileId: string): Promise<any>;
  deleteArchiveFile(fileId: string): Promise<any>;
  deleteArchiveFolder(folderName: string): Promise<any>;
}

/** V1 API implementation - Simple, reliable transformations */
const implementation: WorkbenchAPI = {
  // Gems/narratives - use transformation history instead
  async listGems(_q) {
    // Return empty for now - not critical for transformations
    return [];
  },

  async getGem(id) {
    // Stub - not critical for transformations
    return {
      gem: Gem.parse({ id, title: "Untitled" }),
      text: ""
    };
  },

  // Analysis operations - stub for now (not needed for basic transformations)
  async extractFacets(_b) {
    return {};
  },

  async evalPOVM(_b) {
    // Return neutral POVM weights
    return POVMWeights.parse({
      T: 0.25, F: 0.25, B: 0.25, N: 0.25, alpha: 0.5,
    });
  },

  async rhoInspect(_b) {
    // Return empty eigenvalues
    return { projections: [] };
  },

  async rhoMove(b) {
    // Not implemented - return input text unchanged
    const text = (b as any).text || "";
    return { text, metrics: {} };
  },

  // Quantum Reading
  async quantumStart(b) {
    const r = await http.post(`quantum-analysis/start`, { json: b }).json<any>();
    // Backend returns different structure, map to expected format
    return QuantumSession.parse({
      session_id: r.session_id,
      total_sentences: r.total_sentences,
      current_index: 0,
      initial_state: {
        purity: r.initial_rho.purity,
        entropy: r.initial_rho.entropy
      }
    });
  },

  async quantumStep(id) {
    const r = await http.post(`quantum-analysis/${id}/step`).json<any>();
    return QuantumStep.parse(r);
  },

  async quantumTrace(id) {
    const r = await http.get(`quantum-analysis/${id}/trace`).json<any>();
    return { measurements: z.array(QuantumStep).parse(r.measurements ?? []) };
  },

  // NPE Transformations
  async allegorical(b) {
    // Use V1 allegorical endpoint with proper 5-stage pipeline
    const r = await http.post(`transformations/allegorical`, { json: b }).json<any>();

    // Backend returns: final_projection, reflection, stages: { deconstruct, map, reconstruct, stylize }
    const finalText = r.final_projection || "";

    // Map backend's 5-stage process to UI format
    const stages: any[] = [];

    if (r.stages?.deconstruct) {
      stages.push({
        stage_name: "Deconstruct",
        stage_number: 1,
        input_text: b.text,
        output_text: r.stages.deconstruct,
        rho_before: { id: "n/a", purity: 0, entropy: 0, top_eigenvalues: [] },
        rho_after: { id: "n/a", purity: 0, entropy: 0, top_eigenvalues: [] },
        transformation_description: "Phenomenological reduction - isolating core intentionality",
      });
    }

    if (r.stages?.map) {
      stages.push({
        stage_name: "Map",
        stage_number: 2,
        input_text: r.stages.deconstruct || b.text,
        output_text: r.stages.map,
        rho_before: { id: "n/a", purity: 0, entropy: 0, top_eigenvalues: [] },
        rho_after: { id: "n/a", purity: 0, entropy: 0, top_eigenvalues: [] },
        transformation_description: `Projection into ${b.namespace} namespace`,
      });
    }

    if (r.stages?.reconstruct) {
      stages.push({
        stage_name: "Reconstruct",
        stage_number: 3,
        input_text: r.stages.map || b.text,
        output_text: r.stages.reconstruct,
        rho_before: { id: "n/a", purity: 0, entropy: 0, top_eigenvalues: [] },
        rho_after: { id: "n/a", purity: 0, entropy: 0, top_eigenvalues: [] },
        transformation_description: `Embodiment through ${b.persona} persona`,
      });
    }

    if (r.stages?.stylize) {
      stages.push({
        stage_name: "Stylize",
        stage_number: 4,
        input_text: r.stages.reconstruct || b.text,
        output_text: r.stages.stylize,
        rho_before: { id: "n/a", purity: 0, entropy: 0, top_eigenvalues: [] },
        rho_after: { id: "n/a", purity: 0, entropy: 0, top_eigenvalues: [] },
        transformation_description: `Application of ${b.style} style`,
      });
    }

    if (r.reflection) {
      stages.push({
        stage_name: "Reflect",
        stage_number: 5,
        input_text: r.stages?.stylize || finalText,
        output_text: r.reflection,
        rho_before: { id: "n/a", purity: 0, entropy: 0, top_eigenvalues: [] },
        rho_after: { id: "n/a", purity: 0, entropy: 0, top_eigenvalues: [] },
        transformation_description: "Critical reflection on transformation process",
      });
    }

    return AllegoricalResponse.parse({
      transformation_id: r.transformation_id || "unknown",
      narrative_id: "n/a",
      original_text: b.text,
      final_text: finalText,
      stages: stages.length > 0 ? stages : [{
        stage_name: "allegorical",
        stage_number: 1,
        input_text: b.text,
        output_text: finalText,
        rho_before: { id: "n/a", purity: 0, entropy: 0, top_eigenvalues: [] },
        rho_after: { id: "n/a", purity: 0, entropy: 0, top_eigenvalues: [] },
        transformation_description: `${b.persona} × ${b.namespace} × ${b.style}`,
      }],
      overall_metrics: {
        initial_purity: 0, final_purity: 0, purity_delta: 0,
        initial_entropy: 0, final_entropy: 0, entropy_delta: 0,
        total_coherence: 0,
      },
    });
  },

  async roundTrip(b) {
    // Map 'language' to 'intermediate_language' for backend
    const payload = {
      text: b.text,
      intermediate_language: b.language
    };
    const r = await http.post(`transformations/round-trip`, { json: payload }).json<any>();

    // Backend returns different structure, map to expected format
    return RoundTripResponse.parse({
      transformation_id: r.transformation_id,
      original_text: b.text,
      final_text: r.backward_translation,
      intermediate_translations: [
        { language: b.language, text: r.forward_translation }
      ],
      drift_analysis: r.semantic_drift || ''
    });
  },

  async aiDetect(b) {
    const r = await http.post(`ai-detection/detect`, { json: b }).json<any>();
    return AIDetectionResponse.parse(r);
  },

  async personalizer(b) {
    // Map voice_profile to persona_id for backend
    const payload = {
      text: b.text,
      persona_id: b.voice_profile,
      style_id: undefined // Backend allows persona OR style
    };
    const r = await http.post(`transformations/personalizer`, { json: payload }).json<any>();
    return PersonalizerResponse.parse({
      transformation_id: r.transformation_id,
      personalized_text: r.personalized_text,
      similarity_score: r.similarity_score || 0,
      voice_profile: b.voice_profile,
      analysis: r.analysis
    });
  },

  async maieutic(b) {
    const r = await http.post(`transformations/maieutic/start`, { json: b }).json<any>();
    return MaieuticResponse.parse(r);
  },

  // Story Generation
  async storyGenerate(b) {
    const r = await http.post(`story-generation/generate`, { json: b }).json<any>();
    return StoryGenerationResult.parse(r);
  },

  async getStoryExamples() {
    const r = await http.get(`story-generation/examples`).json<any>();
    return z.array(StoryExample).parse(r.examples ?? r);
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
    const languages = r.languages ?? r;

    // Backend returns array of strings, map to {code, name} format
    // Note: Backend expects full language name (e.g., "spanish") not ISO codes
    if (Array.isArray(languages) && typeof languages[0] === 'string') {
      return languages.map((lang: string) => ({
        code: lang, // Use full language name as code (backend expects this)
        name: lang.charAt(0).toUpperCase() + lang.slice(1) // Capitalize for display
      }));
    }

    return languages;
  },

  // History & Sessions (use v1 routes)
  async getTransformationHistory(f) {
    const p = new URLSearchParams();
    if (f?.type) p.set('type', f.type);
    if (f?.favorite !== undefined) p.set('favorite', String(f.favorite));
    if (f?.limit) p.set('limit', String(f.limit));
    if (f?.offset) p.set('offset', String(f.offset));

    const r = await http.get(`transformation-history?${p.toString()}`).json<any>();
    return z.array(TransformationHistoryItem).parse(r.transformations ?? r.items ?? r);
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

  // Secure Archive
  async getArchiveSalt() {
    const r = await http.get(`secure-archive/salt`).json<any>();
    return r.salt;
  },

  async uploadArchiveFile(
    file: Blob,
    iv: number[],
    filename: string,
    contentType: string,
    folder: string | null,
    conversationMetadata?: any,
    parentFileId?: string | null,
    fileRole?: string,
    relativePath?: string
  ) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('iv', JSON.stringify(iv));
    formData.append('filename', filename);
    formData.append('contentType', contentType);
    if (folder) formData.append('folder', folder);
    if (conversationMetadata) formData.append('conversationMetadata', JSON.stringify(conversationMetadata));
    if (parentFileId) formData.append('parentFileId', parentFileId);
    if (fileRole) formData.append('fileRole', fileRole);
    if (relativePath) formData.append('relativePath', relativePath);

    const r = await http.post(`secure-archive/upload`, { body: formData }).json<any>();
    return r;
  },

  async listArchiveFiles(folder?: string) {
    const params = folder ? `?folder=${encodeURIComponent(folder)}` : '';
    const r = await http.get(`secure-archive/files${params}`).json<any>();
    return r;
  },

  async downloadArchiveFile(fileId: string) {
    const r = await http.get(`secure-archive/files/${fileId}`).json<any>();
    return r;
  },

  async deleteArchiveFile(fileId: string) {
    const r = await http.delete(`secure-archive/files/${fileId}`).json<any>();
    return r;
  },

  async deleteArchiveFolder(folderName: string) {
    const r = await http.delete(`secure-archive/folders/${encodeURIComponent(folderName)}`).json<any>();
    return r;
  },
};

// Export the single ρ-centric API implementation
export const api: WorkbenchAPI = implementation;
