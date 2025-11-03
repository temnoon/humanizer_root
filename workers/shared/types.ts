// Shared types between NPE Workers API and Cloud Frontend

export interface User {
  id: string;
  email: string;
  created_at: number;
  last_login?: number;
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

export type TransformationType = 'allegorical' | 'round_trip' | 'maieutic';

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

// Cloudflare Workers bindings
export interface Env {
  DB: any; // D1Database - only needed in Workers context
  AI: any; // Cloudflare AI binding
  KV: any; // KVNamespace - only needed in Workers context
  MAIEUTIC_SESSION: any; // DurableObjectNamespace - only needed in Workers context
  JWT_SECRET: string;
  ENVIRONMENT: string;
}
