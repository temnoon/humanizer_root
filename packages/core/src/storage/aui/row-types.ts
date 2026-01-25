/**
 * AUI PostgreSQL Store - Database Row Types
 *
 * Internal type definitions for database rows.
 *
 * @module @humanizer/core/storage/aui/row-types
 */

import type { NarrativeArc, SessionMetadata } from '../../aui/types.js';
import type {
  BufferOrigin,
  BufferContentFormat,
  BufferState,
  BufferOperation,
  QualityMetrics,
} from '../../buffer/types.js';
import type { StyleGuide, VoiceFingerprint } from './types.js';

export interface DbSessionRow {
  id: string;
  user_id: string | null;
  name: string | null;
  active_buffer_name: string | null;
  search_session_id: string | null;
  command_history: string[];
  variables: Record<string, unknown>;
  metadata: SessionMetadata;
  created_at: Date;
  updated_at: Date;
  expires_at: Date | null;
  last_accessed_at: Date | null;
}

export interface DbBufferRow {
  id: string;
  session_id: string;
  name: string;
  current_branch: string;
  working_content: unknown[];
  is_dirty: boolean;
  schema: unknown | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbBranchRow {
  id: string;
  buffer_id: string;
  name: string;
  head_version_id: string | null;
  parent_branch: string | null;
  description: string | null;
  created_at: Date;
}

export interface DbVersionRow {
  id: string;
  buffer_id: string;
  content: unknown[];
  message: string;
  parent_id: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface DbTaskRow {
  id: string;
  session_id: string | null;
  request: string;
  status: string;
  steps: unknown[];
  plan: unknown[] | null;
  result: unknown | null;
  error: string | null;
  priority: number;
  total_tokens: number;
  total_cost_cents: number;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
}

export interface DbBookRow {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  arc: NarrativeArc | null;
  status: string;
  source_cluster_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface DbChapterRow {
  id: string;
  book_id: string;
  title: string;
  content: string;
  position: number;
  word_count: number;
  passage_ids: string[];
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface DbClusterRow {
  id: string;
  user_id: string | null;
  label: string;
  description: string | null;
  passages: unknown[];
  total_passages: number;
  coherence: number | null;
  keywords: string[];
  source_distribution: Record<string, number>;
  date_range: { earliest: string | null; latest: string | null } | null;
  avg_word_count: number | null;
  centroid: string | number[] | null;
  discovery_options: unknown | null;
  created_at: Date;
  expires_at: Date | null;
}

export interface DbArtifactRow {
  id: string;
  user_id: string | null;
  name: string;
  artifact_type: string;
  content: string | null;
  content_binary: Buffer | null;
  mime_type: string;
  size_bytes: number | null;
  source_type: string | null;
  source_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  expires_at: Date | null;
  download_count: number;
  last_downloaded_at: Date | null;
}

export interface DbPersonaProfileRow {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  voice_traits: string[];
  tone_markers: string[];
  formality_min: number;
  formality_max: number;
  style_guide: StyleGuide;
  reference_examples: string[];
  voice_fingerprint: VoiceFingerprint | null;
  is_default: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface DbStyleProfileRow {
  id: string;
  persona_id: string;
  name: string;
  description: string | null;
  context: string | null;
  forbidden_phrases: string[];
  preferred_patterns: string[];
  sentence_variety: 'low' | 'medium' | 'high';
  paragraph_style: 'short' | 'medium' | 'long';
  use_contractions: boolean;
  use_rhetorical_questions: boolean;
  formality_level: number;
  is_default: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface DbContentBufferRow {
  id: string;
  content_hash: string;
  text: string;
  word_count: number;
  format: BufferContentFormat;
  state: BufferState;
  origin: BufferOrigin;
  quality_metrics: QualityMetrics | null;
  embedding: string | number[] | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbProvenanceChainRow {
  id: string;
  root_buffer_id: string;
  current_buffer_id: string;
  branch_name: string;
  branch_description: string | null;
  is_main: boolean;
  parent_chain_id: string | null;
  child_chain_ids: string[];
  transformation_count: number;
  created_at: Date;
}

export interface DbBufferOperationRow {
  id: string;
  chain_id: string;
  sequence_number: number;
  operation_type: string;
  performer: BufferOperation['performer'];
  parameters: Record<string, unknown>;
  before_hash: string;
  after_hash: string;
  delta_hash: string | null;
  quality_impact: BufferOperation['qualityImpact'] | null;
  description: string;
  duration_ms: number | null;
  cost_cents: number | null;
  created_at: Date;
}
