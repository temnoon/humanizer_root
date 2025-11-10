/**
 * Domain Models - V2 ρ-Centric Architecture
 *
 * Philosophy: "Agent in Field of Agency"
 * - Narrative = text + metadata (mortal, mutable)
 * - NarrativeState (ρ) = quantum state (persistent, versioned, immortal)
 * - Lineage = genealogical graph (transformations create descendants)
 */

import { z } from 'zod';

// ============================================================================
// Narrative - Text Body + Metadata
// ============================================================================

export const NarrativeSource = z.enum(['user_upload', 'transformation', 'import']);

export const Narrative = z.object({
  id: z.string(),
  user_id: z.string(),
  text: z.string(),
  embedding_vector: z.array(z.number()).optional(), // 768d BGE embedding
  source: NarrativeSource,
  title: z.string().optional(),
  created_at: z.number(), // Unix timestamp (ms)
  updated_at: z.number(),
  deleted_at: z.number().optional(), // Soft delete
});

export type Narrative = z.infer<typeof Narrative>;

// ============================================================================
// Narrative State (ρ) - Density Matrix
// ============================================================================

export const NarrativeScope = z.enum(['narrative', 'sentence', 'paragraph']);

export const NarrativeState = z.object({
  id: z.string(),
  narrative_id: z.string(),
  scope: NarrativeScope,
  scope_index: z.number().optional(), // NULL for narrative-level, sentence# otherwise
  eigenvalues: z.array(z.number()), // 32 eigenvalues (diagonal of ρ)
  purity: z.number(), // Tr(ρ²) ∈ [1/32, 1]
  entropy: z.number(), // -Tr(ρ log ρ)
  trace: z.number(), // Should be ~1.0
  coherence: z.number().optional(), // POVM measurement coherence
  full_matrix_blob: z.instanceof(Uint8Array).optional(), // Optional full 32×32 matrix
  created_at: z.number(),
});

export type NarrativeState = z.infer<typeof NarrativeState>;

/**
 * DensityMatrixState - Internal representation used by quantum services
 * This is what density-matrix-simple.ts produces
 */
export interface DensityMatrixState {
  matrix: number[][]; // 32×32 diagonal
  purity: number;
  entropy: number;
  eigenvalues: number[];
  trace: number;
  timestamp: string;
}

/**
 * Convert DensityMatrixState to NarrativeState record
 */
export function densityMatrixToNarrativeState(
  id: string,
  narrative_id: string,
  scope: 'narrative' | 'sentence' | 'paragraph',
  scope_index: number | undefined,
  dm: DensityMatrixState,
  coherence?: number
): NarrativeState {
  return {
    id,
    narrative_id,
    scope,
    scope_index,
    eigenvalues: dm.eigenvalues,
    purity: dm.purity,
    entropy: dm.entropy,
    trace: dm.trace,
    coherence,
    created_at: Date.now(),
  };
}

// ============================================================================
// Narrative Lineage - Genealogical Relationships
// ============================================================================

export const OperationType = z.enum(['transform', 'measure', 'edit']);

export const TransformationType = z.enum([
  'allegorical',
  'round_trip',
  'personalizer',
  'maieutic',
  'ai_detect',
  'povm_measurement',
]);

export const NarrativeLineage = z.object({
  id: z.string(),
  parent_narrative_id: z.string(),
  child_narrative_id: z.string(),
  parent_rho_id: z.string().optional(),
  child_rho_id: z.string().optional(),
  operation_type: OperationType,
  operation_id: z.string().optional(), // FK to transformation_operations
  transformation_type: TransformationType.optional(),
  params: z.record(z.unknown()).optional(), // JSON params
  influence_strength: z.number(), // [0.0, 1.0] - genetic influence decay
  created_at: z.number(),
});

export type NarrativeLineage = z.infer<typeof NarrativeLineage>;

// ============================================================================
// Transformation Operation - Audit Log
// ============================================================================

export const OperationStatus = z.enum(['pending', 'running', 'completed', 'failed']);

export const TransformationOperation = z.object({
  id: z.string(),
  user_id: z.string(),
  operation_type: OperationType,
  transformation_type: TransformationType.optional(),
  input_narrative_id: z.string(),
  output_narrative_id: z.string().optional(),
  input_rho_id: z.string(),
  output_rho_id: z.string().optional(),
  params: z.record(z.unknown()).optional(),
  status: OperationStatus,
  error_message: z.string().optional(),
  created_at: z.number(),
  started_at: z.number().optional(),
  completed_at: z.number().optional(),
});

export type TransformationOperation = z.infer<typeof TransformationOperation>;

// ============================================================================
// POVM Pack - Measurement Axis Definitions
// ============================================================================

export const POVMPackType = z.enum(['tetralemma', 'tone', 'ontology', 'pragmatics', 'custom']);

export const POVMAxisDefinition = z.object({
  name: z.string(),
  description: z.string(),
  corners: z.array(z.string()), // e.g., ['literal', 'metaphorical', 'both', 'neither']
});

export const POVMPack = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  pack_type: POVMPackType,
  axes: z.array(POVMAxisDefinition), // Array of axis definitions
  is_system: z.boolean(),
  user_id: z.string().optional(),
  created_at: z.number(),
});

export type POVMPack = z.infer<typeof POVMPack>;

// ============================================================================
// Quantum Session - Multi-Step Measurements
// ============================================================================

export const SessionType = z.enum(['quantum_reading', 'maieutic_dialogue']);
export const SessionStatus = z.enum(['active', 'completed', 'abandoned']);

export const QuantumSession = z.object({
  id: z.string(),
  user_id: z.string(),
  session_type: SessionType,
  root_narrative_id: z.string(),
  current_narrative_id: z.string().optional(),
  current_rho_id: z.string().optional(),
  total_steps: z.number(),
  current_step: z.number(),
  status: SessionStatus,
  metadata: z.record(z.unknown()).optional(),
  created_at: z.number(),
  updated_at: z.number(),
});

export type QuantumSession = z.infer<typeof QuantumSession>;

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response when creating a narrative - returns both narrative and its initial ρ
 */
export const CreateNarrativeResponse = z.object({
  narrative: Narrative,
  rho: NarrativeState,
});

export type CreateNarrativeResponse = z.infer<typeof CreateNarrativeResponse>;

/**
 * Response when getting a narrative - includes current ρ and lineage summary
 */
export const GetNarrativeResponse = z.object({
  narrative: Narrative,
  rho: NarrativeState, // Current/latest ρ
  rho_history_count: z.number(), // Total ρ versions
  ancestor_count: z.number(),
  descendant_count: z.number(),
});

export type GetNarrativeResponse = z.infer<typeof GetNarrativeResponse>;

/**
 * POVM Measurement Result
 */
export const POVMMeasurementResult = z.object({
  measurement_id: z.string(),
  rho_id_before: z.string(),
  rho_id_after: z.string(),
  axis: z.string(),
  probabilities: z.record(z.number()), // e.g., { literal: 0.7, metaphorical: 0.2, both: 0.05, neither: 0.05 }
  evidence: z.record(z.string()).optional(), // LLM reasoning for each corner
  coherence: z.number(),
  created_at: z.number(),
});

export type POVMMeasurementResult = z.infer<typeof POVMMeasurementResult>;

/**
 * ρ Inspection Response
 */
export const RhoInspectionResponse = z.object({
  rho_id: z.string(),
  eigenvalues: z.array(z.number()),
  purity: z.number(),
  entropy: z.number(),
  trace: z.number(),
  top_eigenvalues: z.array(z.number()), // Top 10 for visualization
  state_classification: z.enum(['pure', 'nearly_pure', 'mixed', 'maximally_mixed']),
  interpretation: z.string(), // Human-readable description
});

export type RhoInspectionResponse = z.infer<typeof RhoInspectionResponse>;

/**
 * Lineage Graph Node
 */
export const LineageNode = z.object({
  narrative_id: z.string(),
  narrative: Narrative.optional(),
  rho_id: z.string().optional(),
  depth: z.number(), // Distance from query node
  generation: z.number(), // Ancestor depth (negative) or descendant depth (positive)
});

export type LineageNode = z.infer<typeof LineageNode>;

/**
 * Lineage Graph Edge
 */
export const LineageEdge = z.object({
  lineage_id: z.string(),
  from_narrative_id: z.string(),
  to_narrative_id: z.string(),
  transformation_type: TransformationType.optional(),
  influence_strength: z.number(),
});

export type LineageEdge = z.infer<typeof LineageEdge>;

/**
 * Lineage Graph Response
 */
export const LineageGraphResponse = z.object({
  root_narrative_id: z.string(),
  nodes: z.array(LineageNode),
  edges: z.array(LineageEdge),
  max_ancestor_depth: z.number(),
  max_descendant_depth: z.number(),
  total_ancestors: z.number(),
  total_descendants: z.number(),
});

export type LineageGraphResponse = z.infer<typeof LineageGraphResponse>;
