/**
 * POVM Service - Measurement Operations on ρ
 *
 * Philosophy: Measurement is intentional focus collapsing superposition
 * - POVM {Eₖ} defines aspect of attention
 * - Measurement produces probabilities + post-measurement ρ'
 * - Coherence α measures quality of the measurement
 */

import { v4 as uuidv4 } from 'uuid';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  POVMMeasurementResult,
  NarrativeState,
  RhoInspectionResponse,
} from './models';
import { NarrativeRepository } from './narrative-repository';
import {
  measureSentenceTetralemma,
  type POVMMeasurementResult as POVMResult,
} from '../services/quantum-reading/povm-measurement';
import {
  constructDensityMatrix,
  updateDensityMatrixAfterMeasurement,
  getTopEigenvalues,
} from '../services/quantum-reading/density-matrix-simple';
import { generateEmbedding } from '../services/quantum-reading/embeddings';

export class POVMService {
  constructor(
    private db: D1Database,
    private ai: any,
    private narrativeRepo: NarrativeRepository
  ) {}

  /**
   * Compute normalized entropy of a probability distribution
   * Returns 0 for perfectly ordered (all probability in one outcome)
   * Returns 1 for maximally disordered (uniform distribution)
   */
  private computeNormalizedEntropy(probabilities: number[]): number {
    const n = probabilities.length;
    if (n <= 1) return 0;

    // Shannon entropy: H = -Σ p_i log(p_i)
    let entropy = 0;
    for (const p of probabilities) {
      if (p > 0) {
        entropy -= p * Math.log(p);
      }
    }

    // Normalize by max entropy (log(n)) to get value in [0, 1]
    const maxEntropy = Math.log(n);
    return entropy / maxEntropy;
  }

  /**
   * Perform POVM measurement on a narrative's ρ state
   *
   * Process:
   * 1. Get current ρ for narrative
   * 2. Get narrative text
   * 3. Perform POVM measurement (LLM-based Tetralemma)
   * 4. Update ρ based on measurement outcome
   * 5. Create new ρ version (post-measurement collapse)
   * 6. Return measurement result + new ρ
   *
   * Philosophy: Measurement collapses superposition, creates new ρ'
   */
  async measureNarrative(
    narrative_id: string,
    axis: string = 'literalness'
  ): Promise<POVMMeasurementResult> {
    // Get narrative with current ρ
    const narrativeData = await this.narrativeRepo.get(narrative_id);
    if (!narrativeData) {
      throw new Error(`Narrative ${narrative_id} not found`);
    }

    const { narrative, rho: rho_before } = narrativeData;

    // Perform POVM measurement using LLM
    // Note: axis parameter currently not used, hardcoded to literalness
    const povmResult = await measureSentenceTetralemma(
      this.ai,
      narrative.text,
      0 // sentence index (0 for narrative-level measurement)
    );

    // Extract probabilities from measurement object
    const probabilities: Record<string, number> = {
      literal: povmResult.measurement.literal.probability,
      metaphorical: povmResult.measurement.metaphorical.probability,
      both: povmResult.measurement.both.probability,
      neither: povmResult.measurement.neither.probability,
    };

    // Extract evidence
    const evidence: Record<string, string> = {
      literal: povmResult.measurement.literal.evidence,
      metaphorical: povmResult.measurement.metaphorical.evidence,
      both: povmResult.measurement.both.evidence,
      neither: povmResult.measurement.neither.evidence,
    };

    // Compute coherence from measurement (1 - entropy of probabilities)
    // High coherence = concentrated in one corner, Low coherence = spread evenly
    const coherence = 1 - this.computeNormalizedEntropy(Object.values(probabilities));

    // Update ρ based on measurement outcome
    // We'll construct a new ρ from a weighted embedding
    // (In future: proper ρ collapse using POVM operators)
    const embeddingResult = narrative.embedding_vector
      ? { embedding: narrative.embedding_vector }
      : await generateEmbedding(this.ai, narrative.text);
    const embedding = Array.from(embeddingResult.embedding || embeddingResult);
    const rho_dm = constructDensityMatrix(embedding);

    // Create new ρ version with coherence
    const rho_after = await this.narrativeRepo.createRhoVersion(
      narrative_id,
      rho_dm,
      {
        coherence,
      }
    );

    // Create measurement result
    const measurement_id = uuidv4();
    const result: POVMMeasurementResult = {
      measurement_id,
      rho_id_before: rho_before.id,
      rho_id_after: rho_after.id,
      axis,
      probabilities,
      evidence,
      coherence,
      created_at: Date.now(),
    };

    return result;
  }

  /**
   * Inspect ρ state - return eigenvalue spectrum and classification
   */
  async inspectRho(rho_id: string): Promise<RhoInspectionResponse> {
    const rho = await this.narrativeRepo.getRho(rho_id);
    if (!rho) {
      throw new Error(`ρ state ${rho_id} not found`);
    }

    // Get top 10 eigenvalues for visualization
    const topEigenvalues = rho.eigenvalues.slice(0, 10);

    // Classify state based on purity
    let state_classification: 'pure' | 'nearly_pure' | 'mixed' | 'maximally_mixed';
    let interpretation: string;

    if (rho.purity > 0.9) {
      state_classification = 'pure';
      interpretation = 'Nearly pure state - narrative has focused, coherent meaning with minimal ambiguity.';
    } else if (rho.purity > 0.5) {
      state_classification = 'nearly_pure';
      interpretation = 'Mostly coherent state - narrative has dominant interpretation with some alternative readings.';
    } else if (rho.purity > 0.1) {
      state_classification = 'mixed';
      interpretation = 'Mixed state - narrative has multiple competing interpretations in superposition.';
    } else {
      state_classification = 'maximally_mixed';
      interpretation = 'Maximally mixed state - narrative has no dominant interpretation, all possibilities equally likely.';
    }

    // Add entropy interpretation
    if (rho.entropy > 2.5) {
      interpretation += ' High entropy indicates rich semantic complexity.';
    } else if (rho.entropy < 1.0) {
      interpretation += ' Low entropy indicates semantic simplicity.';
    }

    return {
      rho_id,
      eigenvalues: rho.eigenvalues,
      purity: rho.purity,
      entropy: rho.entropy,
      trace: rho.trace,
      top_eigenvalues: topEigenvalues,
      state_classification,
      interpretation,
    };
  }

  /**
   * Compute distance between two ρ states
   * Uses trace distance: D(ρ₁, ρ₂) = (1/2) Tr|ρ₁ - ρ₂|
   *
   * Philosophy: How far apart are two narrative states in the quantum sense?
   */
  async computeDistance(
    rho_id_1: string,
    rho_id_2: string
  ): Promise<{ trace_distance: number; fidelity: number }> {
    const rho1 = await this.narrativeRepo.getRho(rho_id_1);
    const rho2 = await this.narrativeRepo.getRho(rho_id_2);

    if (!rho1 || !rho2) {
      throw new Error('One or both ρ states not found');
    }

    // Simplified trace distance (diagonal approximation)
    // D = (1/2) Σ |λ₁ᵢ - λ₂ᵢ|
    let trace_distance = 0;
    for (let i = 0; i < rho1.eigenvalues.length; i++) {
      trace_distance += Math.abs(rho1.eigenvalues[i] - rho2.eigenvalues[i]);
    }
    trace_distance *= 0.5;

    // Fidelity F = (Σ √(λ₁ᵢ λ₂ᵢ))²
    let fidelity_sum = 0;
    for (let i = 0; i < rho1.eigenvalues.length; i++) {
      fidelity_sum += Math.sqrt(rho1.eigenvalues[i] * rho2.eigenvalues[i]);
    }
    const fidelity = fidelity_sum * fidelity_sum;

    return { trace_distance, fidelity };
  }
}
