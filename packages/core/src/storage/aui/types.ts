/**
 * AUI PostgreSQL Store - Public Types
 *
 * Type definitions for AUI storage entities and options.
 *
 * @module @humanizer/core/storage/aui/types
 */

// ═══════════════════════════════════════════════════════════════════
// ARTIFACT TYPES
// ═══════════════════════════════════════════════════════════════════

export interface AuiArtifact {
  id: string;
  userId?: string;
  name: string;
  artifactType: 'markdown' | 'pdf' | 'epub' | 'html' | 'json' | 'zip';
  content?: string;
  contentBinary?: Buffer;
  mimeType: string;
  sizeBytes?: number;
  sourceType?: string;
  sourceId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  expiresAt?: Date;
  downloadCount: number;
  lastDownloadedAt?: Date;
}

export interface CreateArtifactOptions {
  userId?: string;
  name: string;
  artifactType: AuiArtifact['artifactType'];
  content?: string;
  contentBinary?: Buffer;
  mimeType: string;
  sourceType?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

// ═══════════════════════════════════════════════════════════════════
// PERSONA PROFILE TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Style guide for persona-consistent writing
 */
export interface StyleGuide {
  /** Phrases that should never appear in generated text */
  forbiddenPhrases: string[];
  /** Preferred patterns to use naturally */
  preferredPatterns: string[];
  /** Sentence variety level */
  sentenceVariety: 'low' | 'medium' | 'high';
  /** Paragraph length style */
  paragraphStyle: 'short' | 'medium' | 'long';
  /** Whether to use contractions */
  useContractions: boolean;
  /** Whether to use rhetorical questions */
  useRhetoricalQuestions: boolean;
}

/**
 * Quantitative voice fingerprint extracted from reference examples
 */
export interface VoiceFingerprint {
  /** Average sentence length in words */
  avgSentenceLength: number;
  /** Sentence length variance */
  sentenceLengthVariance: number;
  /** Contraction frequency (0-1) */
  contractionFrequency: number;
  /** Question frequency (0-1) */
  questionFrequency: number;
  /** First person frequency (0-1) */
  firstPersonFrequency: number;
  /** Common n-grams with frequency */
  commonPhrases: Array<{ phrase: string; frequency: number }>;
  /** Vocabulary richness score (0-1) */
  vocabularyRichness: number;
  /** Embedding of combined reference examples */
  referenceEmbedding?: number[];
}

/**
 * Persona profile for voice-consistent book creation
 */
export interface PersonaProfile {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  /** Voice characteristics */
  voiceTraits: string[];
  /** Tone markers */
  toneMarkers: string[];
  /** Formality range (0=casual, 1=formal) */
  formalityRange: [number, number];
  /** Writing style guide */
  styleGuide: StyleGuide;
  /** Reference examples demonstrating the voice */
  referenceExamples: string[];
  /** Quantitative voice fingerprint */
  voiceFingerprint?: VoiceFingerprint;
  /** Whether this is the user's default persona */
  isDefault: boolean;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePersonaProfileOptions {
  userId?: string;
  name: string;
  description?: string;
  voiceTraits?: string[];
  toneMarkers?: string[];
  formalityRange?: [number, number];
  styleGuide?: Partial<StyleGuide>;
  referenceExamples?: string[];
  voiceFingerprint?: VoiceFingerprint;
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════
// STYLE PROFILE TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Style profile for context-specific writing styles
 *
 * Enables persona -> many styles relationship:
 * - One persona can have multiple styles (Academic, Casual, Newsletter, etc.)
 * - Each style has its own forbidden phrases, formality level, etc.
 */
export interface StyleProfile {
  id: string;
  personaId: string;
  name: string;
  description?: string;
  /** When to use this style (e.g., "Use for academic papers") */
  context?: string;
  forbiddenPhrases: string[];
  preferredPatterns: string[];
  sentenceVariety: 'low' | 'medium' | 'high';
  paragraphStyle: 'short' | 'medium' | 'long';
  useContractions: boolean;
  useRhetoricalQuestions: boolean;
  /** Formality level (0=casual, 1=formal) */
  formalityLevel: number;
  /** Whether this is the default style for the persona */
  isDefault: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStyleProfileOptions {
  personaId: string;
  name: string;
  description?: string;
  context?: string;
  forbiddenPhrases?: string[];
  preferredPatterns?: string[];
  sentenceVariety?: 'low' | 'medium' | 'high';
  paragraphStyle?: 'short' | 'medium' | 'long';
  useContractions?: boolean;
  useRhetoricalQuestions?: boolean;
  formalityLevel?: number;
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════
// STORE OPTIONS
// ═══════════════════════════════════════════════════════════════════

export interface AuiPostgresStoreOptions {
  /** Maximum version history to keep per buffer */
  maxVersionHistory?: number;
  /** Session expiration time in ms (default: 7 days) */
  sessionExpirationMs?: number;
  /** Cluster cache expiration in days (default: 30) */
  clusterCacheDays?: number;
  /** Artifact expiration in days (default: 7) */
  artifactExpirationDays?: number;
}

export const DEFAULT_STORE_OPTIONS: Required<AuiPostgresStoreOptions> = {
  maxVersionHistory: 100,
  sessionExpirationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  clusterCacheDays: 30,
  artifactExpirationDays: 7,
};
