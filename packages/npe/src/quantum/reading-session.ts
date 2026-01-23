/**
 * Quantum Reading Session
 *
 * Manages sentence-by-sentence reading analysis with density matrix evolution.
 *
 * HONEST REBRANDING:
 * This tracks how a reader's "semantic state" (represented as a density matrix
 * derived from embeddings) evolves as they read text sentence by sentence.
 * It's inspired by quantum mechanics but operates on classical probability
 * distributions over embedding dimensions.
 *
 * The philosophical insight remains valid:
 * "Reading changes how we read. Each sentence transforms the reader's state."
 */

import type { LlmAdapter, EmbeddingResponse } from '../llm/types.js';
import type { DensityMatrixState, POVMMeasurement, QuantumSession } from '../types.js';
import {
  createMaximallyMixedState,
  constructDensityMatrix,
  updateAfterMeasurement,
} from './density-matrix.js';
import { measureTetralemma, type POVMAxis } from './tetralemma.js';
import { splitIntoSentences } from '../sic/chunk.js';

/**
 * Embedder function type
 */
export type EmbedderFn = (text: string) => Promise<number[]>;

/**
 * Reading session options
 */
export interface ReadingSessionOptions {
  /** POVM axis to measure */
  axis?: POVMAxis;
  /** Blend weight for state updates (0-1) */
  updateWeight?: number;
}

/**
 * Reading step result
 */
export interface ReadingStep {
  sentenceIndex: number;
  sentence: string;
  measurement: POVMMeasurement;
  rhoBefore: DensityMatrixState;
  rhoAfter: DensityMatrixState;
  rhoDistance: number;
}

/**
 * Quantum Reading Session Manager
 */
export class ReadingSessionManager {
  private adapter: LlmAdapter;
  private embedder: EmbedderFn;
  private sessions: Map<string, QuantumSession> = new Map();

  constructor(adapter: LlmAdapter, embedder: EmbedderFn) {
    this.adapter = adapter;
    this.embedder = embedder;
  }

  /**
   * Start a new reading session
   */
  async startSession(text: string): Promise<QuantumSession> {
    const id = crypto.randomUUID();
    const sentences = splitIntoSentences(text);
    const rhoState = createMaximallyMixedState();

    const session: QuantumSession = {
      id,
      text,
      sentences,
      currentSentenceIndex: 0,
      rhoState,
      measurements: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Process next sentence in session
   */
  async stepSession(
    sessionId: string,
    options: ReadingSessionOptions = {}
  ): Promise<ReadingStep | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.currentSentenceIndex >= session.sentences.length) {
      return null; // Session complete
    }

    const { axis = 'literalness', updateWeight = 0.3 } = options;
    const sentenceIndex = session.currentSentenceIndex;
    const sentence = session.sentences[sentenceIndex];
    const rhoBefore = { ...session.rhoState };

    // Generate embedding for sentence
    const embedding = await this.embedder(sentence);

    // Measure using Tetralemma
    const measurement = await measureTetralemma(
      this.adapter,
      sentence,
      sentenceIndex,
      axis
    );

    // Update density matrix
    const rhoAfter = updateAfterMeasurement(rhoBefore, embedding, updateWeight);

    // Calculate distance
    const rhoDistance = this.calculateDistance(rhoBefore, rhoAfter);

    // Update session
    session.rhoState = rhoAfter;
    session.currentSentenceIndex++;
    session.measurements.push(measurement);
    session.updatedAt = new Date().toISOString();

    return {
      sentenceIndex,
      sentence,
      measurement,
      rhoBefore,
      rhoAfter,
      rhoDistance,
    };
  }

  /**
   * Get session state
   */
  getSession(sessionId: string): QuantumSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get full trace (all steps)
   */
  getTrace(sessionId: string): POVMMeasurement[] {
    const session = this.sessions.get(sessionId);
    return session?.measurements || [];
  }

  /**
   * Check if session is complete
   */
  isComplete(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    return session.currentSentenceIndex >= session.sentences.length;
  }

  /**
   * Get remaining sentences
   */
  getRemainingCount(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;
    return Math.max(0, session.sentences.length - session.currentSentenceIndex);
  }

  /**
   * Calculate distance between states
   */
  private calculateDistance(rho1: DensityMatrixState, rho2: DensityMatrixState): number {
    let distance = 0;
    const len = Math.min(rho1.eigenvalues.length, rho2.eigenvalues.length);
    for (let i = 0; i < len; i++) {
      distance += Math.abs((rho1.eigenvalues[i] || 0) - (rho2.eigenvalues[i] || 0));
    }
    return 0.5 * distance;
  }

  /**
   * Clear session
   */
  clearSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }
}
