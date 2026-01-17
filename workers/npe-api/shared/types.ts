/**
 * Shared Types for NPE Workers API
 *
 * Environment bindings, domain types, and request/response interfaces.
 */

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT BINDINGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cloudflare Worker environment bindings
 */
export interface Env {
  // Database
  DB: D1Database;

  // KV Namespace (rate limiting, sessions)
  KV: KVNamespace;

  // R2 Bucket (encrypted file storage)
  R2_ARCHIVE: R2Bucket;

  // AI Model binding
  AI: Ai;

  // Durable Objects
  MAIEUTIC_SESSION: DurableObjectNamespace;

  // Secrets
  JWT_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  GPTZERO_API_KEY?: string;
  CONFIG_ENCRYPTION_KEY?: string;

  // OAuth Secrets
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;

  // LLM Provider Keys (optional, for cloud providers)
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GROQ_API_KEY?: string;

  // Admin config
  ADMIN_EMAILS?: string;
  ALLOW_NEW_SIGNUPS?: string;

  // Environment indicator
  ENVIRONMENT?: 'development' | 'production';
}

// ═══════════════════════════════════════════════════════════════════════════
// USER & AUTH TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type UserRole = 'free' | 'member' | 'pro' | 'premium' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: number;
  updated_at: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAILING LIST TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface MailingListSignupRequest {
  name?: string;
  email: string;
  interest_comment?: string;
}

export interface MailingListSignupResponse {
  success: boolean;
  message: string;
  position?: number;
}

export interface MailingListEntry {
  id: string;
  email: string;
  name?: string;
  interest_comment?: string;
  source?: string;
  created_at: number;
  promo_code_sent?: boolean;
  promo_code_used?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// NPE DOMAIN TYPES (Personas, Namespaces, Styles)
// ═══════════════════════════════════════════════════════════════════════════

export interface NPEPersona {
  id: string;
  name: string;
  description?: string;
  voice_profile?: VoiceProfile;
  created_at: number;
  updated_at: number;
}

export interface NPENamespace {
  id: string;
  name: string;
  description?: string;
  vocabulary?: string[];
  phrases?: string[];
  created_at: number;
  updated_at: number;
}

export interface NPEStyle {
  id: string;
  name: string;
  description?: string;
  characteristics?: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export interface VoiceProfile {
  patterns?: string[];
  vocabulary?: string[];
  characteristics?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSFORMATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TransformationRequest {
  text: string;
  persona_id?: string;
  namespace_id?: string;
  style_id?: string;
  options?: TransformationOptions;
}

export interface TransformationOptions {
  preserve_formatting?: boolean;
  intensity?: 'light' | 'medium' | 'heavy';
  target_length?: 'shorter' | 'same' | 'longer';
}

export interface TransformationResult {
  original: string;
  transformed: string;
  metadata?: {
    tokens_used?: number;
    model?: string;
    duration_ms?: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AI DETECTION TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface DetectionRequest {
  text: string;
  options?: DetectionOptions;
}

export interface DetectionOptions {
  include_gptzero?: boolean;
  include_local?: boolean;
}

export interface DetectionResult {
  overall_score: number;
  is_ai_generated: boolean;
  confidence: number;
  details?: {
    gptzero?: GPTZeroResult;
    local?: LocalDetectorResult;
  };
}

export interface GPTZeroResult {
  completely_generated_prob: number;
  overall_burstiness: number;
  paragraphs?: Array<{
    completely_generated_prob: number;
    start_index: number;
    end_index: number;
  }>;
}

export interface LocalDetectorResult {
  score: number;
  signals: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════════
// STRIPE / BILLING TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface SubscriptionInfo {
  tier: UserRole;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
  current_period_end: number;
  cancel_at_period_end: boolean;
}

export interface DayPassInfo {
  active: boolean;
  purchased_at?: number;
  expires_at?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ARCHIVE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface Archive {
  id: string;
  user_id: string;
  name: string;
  source: 'chatgpt' | 'claude' | 'custom';
  conversation_count: number;
  created_at: number;
  updated_at: number;
}

export interface Conversation {
  id: string;
  archive_id: string;
  title: string;
  message_count: number;
  created_at: number;
  updated_at: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUANTUM ANALYSIS TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface QuantumAnalysisRequest {
  text: string;
  options?: QuantumAnalysisOptions;
}

export interface QuantumAnalysisOptions {
  include_density_matrix?: boolean;
  include_povm?: boolean;
  povm_packs?: string[];
}

export interface QuantumAnalysisResult {
  tetralemma?: TetralemmaResult;
  density_matrix?: number[][];
  povm_measurements?: Record<string, POVMMeasurement>;
}

export interface TetralemmaResult {
  affirmation: number;
  negation: number;
  both: number;
  neither: number;
  stance: string;
}

export interface POVMMeasurement {
  probabilities: number[];
  labels: string[];
  dominant: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SIC (Subjective Intentional Constraint) TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface SICAnalysisRequest {
  text: string;
  options?: SICAnalysisOptions;
}

export interface SICAnalysisOptions {
  include_chunks?: boolean;
  include_metadata?: boolean;
}

export interface SICAnalysisResult {
  overall_score: number;
  interpretation: string;
  chunks?: SICChunk[];
}

export interface SICChunk {
  text: string;
  score: number;
  start: number;
  end: number;
}
