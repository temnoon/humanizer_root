// Shared types between NPE Workers API and Cloud Frontend

export type UserRole = 'admin' | 'premium' | 'pro' | 'member' | 'free';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: number;
  last_login?: number;
  monthly_transformations?: number;
  monthly_tokens_used?: number;
  last_reset_date?: number;
}

export interface NPEPersona {
  id: number;
  name: string;
  description: string;
  system_prompt: string;
}

export interface NPENamespace {
  id: number;
  name: string;
  description: string;
  context_prompt: string;
}

export interface NPEStyle {
  id: number;
  name: string;
  style_prompt: string;
}

export type TransformationType = 'allegorical' | 'round_trip' | 'maieutic' | 'personalizer';

export interface Transformation {
  id: string;
  user_id: string;
  type: TransformationType;
  source_text: string;
  result_text?: string;
  parameters: Record<string, any>;
  trm_evaluation?: Record<string, any>;
  created_at: number;
}

export interface AllegoricalProjection {
  id: string;
  transformation_id: string;
  persona_id: number;
  namespace_id: number;
  style_id: number;
  stage_1_deconstruct?: string;
  stage_2_map?: string;
  stage_3_reconstruct?: string;
  stage_4_stylize?: string;
  stage_5_reflect?: string;
}

export interface RoundTripTranslation {
  id: string;
  transformation_id: string;
  intermediate_language: string;
  forward_translation?: string;
  backward_translation?: string;
  semantic_drift?: number;
  preserved_elements?: string[];
  lost_elements?: string[];
  gained_elements?: string[];
}

export interface MaieuticSession {
  id: string;
  transformation_id: string;
  goal: string;
  final_understanding?: string;
  extracted_elements?: string[];
  created_at: number;
}

export interface MaieuticTurn {
  id: string;
  session_id: string;
  turn_number: number;
  depth_level: number; // 0-4
  question: string;
  answer?: string;
  insights?: string[];
  created_at: number;
}

// API Request/Response types

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface AllegoricalProjectionRequest {
  text: string;
  persona: string;
  namespace: string;
  style: string;
}

export interface AllegoricalProjectionResponse {
  transformation_id: string;
  final_projection: string;
  reflection: string;
  stages: {
    deconstruct: string;
    map: string;
    reconstruct: string;
    stylize: string;
  };
}

export interface RoundTripTranslationRequest {
  text: string;
  intermediate_language: string;
}

export interface RoundTripTranslationResponse {
  transformation_id: string;
  forward_translation: string;
  backward_translation: string;
  semantic_drift: number;
  preserved_elements: string[];
  lost_elements: string[];
  gained_elements: string[];
}

export interface MaieuticStartRequest {
  text: string;
  goal: string;
}

export interface MaieuticStartResponse {
  session_id: string;
  question: string;
  depth_level: number;
}

export interface MaieuticRespondRequest {
  answer: string;
}

export interface MaieuticRespondResponse {
  turn_number: number;
  depth_level: number;
  question: string;
  insights: string[];
  is_complete: boolean;
  final_understanding?: string;
}

export interface MailingListSignupRequest {
  name: string;
  email: string;
  interest_comment?: string;
}

export interface MailingListSignupResponse {
  success: boolean;
  message: string;
}

export interface MailingListEntry {
  id: number;
  name: string;
  email: string;
  interest_comment?: string;
  created_at: string;
}

// Personalizer types

export type WritingSampleSource = 'manual' | 'chatgpt' | 'claude' | 'other';

export interface WritingSample {
  id: number;
  user_id: number;
  source_type: WritingSampleSource;
  content: string;
  word_count: number;
  custom_metadata?: Record<string, any>;
  created_at: string;
}

export interface PersonalPersona {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  auto_discovered: boolean;
  embedding_signature?: number[]; // Representative embedding vector
  example_texts?: string[];
  custom_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PersonalStyle {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  auto_discovered: boolean;
  formality_score?: number; // 0.0-1.0
  complexity_score?: number; // 0.0-1.0
  avg_sentence_length?: number;
  vocab_diversity?: number; // Type-token ratio
  tone_markers?: string[];
  example_texts?: string[];
  custom_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PersonalizerTransformation {
  id: number;
  user_id: number;
  persona_id?: number;
  style_id?: number;
  input_text: string;
  output_text: string;
  model_used: string;
  tokens_used: number;
  semantic_similarity?: number;
  created_at: string;
}

// API Request/Response types for Personalizer

export interface UploadWritingSampleRequest {
  content: string;
  source_type: WritingSampleSource;
  metadata?: Record<string, any>;
}

export interface UploadWritingSampleResponse {
  success: boolean;
  sample_id: number;
  word_count: number;
}

export interface CreatePersonaRequest {
  name: string;
  description?: string;
  example_texts?: string[];
  metadata?: Record<string, any>;
}

export interface CreateStyleRequest {
  name: string;
  description?: string;
  formality_score?: number;
  complexity_score?: number;
  tone_markers?: string[];
  example_texts?: string[];
  metadata?: Record<string, any>;
}

export interface PersonaResponse {
  persona: PersonalPersona;
}

export interface StyleResponse {
  style: PersonalStyle;
}

export interface DiscoverVoicesRequest {
  min_clusters?: number; // Default: 3
  max_clusters?: number; // Default: 7
}

export interface DiscoverVoicesResponse {
  personas_discovered: number;
  styles_discovered: number;
  personas: PersonalPersona[];
  styles: PersonalStyle[];
  total_words_analyzed: number;
}

export interface PersonalizerTransformRequest {
  text: string;
  persona_id?: number;
  style_id?: number;
}

export interface PersonalizerTransformResponse {
  transformation_id: number;
  output_text: string;
  semantic_similarity: number;
  tokens_used: number;
  model_used: string;
}

// OAuth Account types
export type OAuthProvider = 'google' | 'github' | 'discord' | 'facebook' | 'apple';

export interface OAuthAccount {
  id: string;
  userId: string;
  provider: OAuthProvider;
  providerUserId: string;
  providerEmail: string | null;
  providerUsername: string | null;
  providerAvatarUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

// Cloudflare Workers bindings
export interface Env {
  DB: any; // D1Database - only needed in Workers context
  AI: any; // Cloudflare AI binding
  KV: any; // KVNamespace - only needed in Workers context
  R2_ARCHIVE: any; // R2Bucket - for encrypted file storage
  MAIEUTIC_SESSION: any; // DurableObjectNamespace - only needed in Workers context
  JWT_SECRET: string;
  ENVIRONMENT: string;
  NTFY_TOPIC?: string; // ntfy.sh topic for signup notifications
  GPTZERO_API_KEY?: string; // Optional GPTZero API key for advanced AI detection
  
  // OAuth Provider Credentials (optional - only needed providers)
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  FACEBOOK_CLIENT_ID?: string;
  FACEBOOK_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;

  // Signup Controls
  ALLOW_NEW_SIGNUPS?: string; // 'true' to allow new signups, any other value blocks them
  ADMIN_EMAILS?: string; // Comma-separated list of emails that can always sign up

  // Stripe Billing
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
}
