/**
 * Narrative Repository - CRUD for Narratives and their ρ States
 *
 * Philosophy: "Narratives should never be casually lost"
 * - Every create automatically generates embedding + ρ
 * - Every update creates new ρ version (never overwrites)
 * - Soft delete (deleted_at) preserves lineage
 */

import { v4 as uuidv4 } from 'uuid';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  Narrative,
  NarrativeState,
  CreateNarrativeResponse,
  GetNarrativeResponse,
  DensityMatrixState,
} from './models';
import { densityMatrixToNarrativeState } from './models';
import {
  constructDensityMatrix,
  serializeDensityMatrix,
  deserializeDensityMatrix,
  type DensityMatrixState as DMState,
} from '../services/quantum-reading/density-matrix-simple';
import { generateEmbedding } from '../services/quantum-reading/embeddings';

export class NarrativeRepository {
  constructor(
    private db: D1Database,
    private ai: any // Cloudflare AI binding
  ) {}

  /**
   * Create a narrative from text
   * Automatically:
   * - Generates embedding (BGE 768d)
   * - Constructs initial ρ from embedding
   * - Saves both narrative and ρ state
   *
   * Philosophy: Creation is sacred - capture the quantum state at birth
   */
  async create(
    user_id: string,
    text: string,
    options?: {
      source?: 'user_upload' | 'transformation' | 'import';
      title?: string;
    }
  ): Promise<CreateNarrativeResponse> {
    const narrative_id = uuidv4();
    const rho_id = uuidv4();
    const now = Date.now();

    // Generate embedding
    const embeddingResult = await generateEmbedding(this.ai, text);
    // Convert to plain array (AI binding might return proxy/typed array)
    const embedding = Array.from(embeddingResult.embedding);

    // Construct ρ from embedding
    const rho_dm = constructDensityMatrix(embedding);

    // Convert to NarrativeState
    const rho: NarrativeState = densityMatrixToNarrativeState(
      rho_id,
      narrative_id,
      'narrative',
      undefined,
      rho_dm
    );

    // Insert narrative
    await this.db
      .prepare(
        `INSERT INTO narratives
        (id, user_id, text, embedding_vector, source, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        narrative_id,
        user_id,
        text,
        JSON.stringify(embedding),
        options?.source || 'user_upload',
        options?.title || null,
        now,
        now
      )
      .run();

    // Insert ρ state
    console.log('[DEBUG] ρ state:', {
      id: rho.id,
      narrative_id: rho.narrative_id,
      scope: rho.scope,
      scope_index: rho.scope_index,
      eigenvalues_length: rho.eigenvalues?.length,
      purity: rho.purity,
      entropy: rho.entropy,
      trace: rho.trace,
      created_at: rho.created_at
    });

    await this.db
      .prepare(
        `INSERT INTO narrative_states
        (id, narrative_id, scope, scope_index, eigenvalues, purity, entropy, trace, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        rho.id,
        rho.narrative_id,
        rho.scope,
        rho.scope_index || null,
        JSON.stringify(rho.eigenvalues),
        rho.purity,
        rho.entropy,
        rho.trace,
        rho.created_at
      )
      .run();

    const narrative: Narrative = {
      id: narrative_id,
      user_id,
      text,
      embedding_vector: embedding,
      source: options?.source || 'user_upload',
      title: options?.title,
      created_at: now,
      updated_at: now,
    };

    return { narrative, rho };
  }

  /**
   * Get narrative by ID with current ρ and lineage summary
   */
  async get(narrative_id: string): Promise<GetNarrativeResponse | null> {
    // Get narrative
    const narrativeResult = await this.db
      .prepare(`SELECT * FROM narratives WHERE id = ? AND deleted_at IS NULL`)
      .bind(narrative_id)
      .first<any>();

    if (!narrativeResult) {
      return null;
    }

    // Get latest ρ (most recent created_at)
    const rhoResult = await this.db
      .prepare(
        `SELECT * FROM narrative_states
         WHERE narrative_id = ? AND scope = 'narrative'
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .bind(narrative_id)
      .first<any>();

    if (!rhoResult) {
      throw new Error(`Narrative ${narrative_id} exists but has no ρ state`);
    }

    // Count ρ history
    const rhoCountResult = await this.db
      .prepare(
        `SELECT COUNT(*) as count FROM narrative_states WHERE narrative_id = ?`
      )
      .bind(narrative_id)
      .first<{ count: number }>();

    // Count ancestors
    const ancestorCountResult = await this.db
      .prepare(
        `SELECT COUNT(*) as count FROM narrative_lineages WHERE child_narrative_id = ?`
      )
      .bind(narrative_id)
      .first<{ count: number }>();

    // Count descendants
    const descendantCountResult = await this.db
      .prepare(
        `SELECT COUNT(*) as count FROM narrative_lineages WHERE parent_narrative_id = ?`
      )
      .bind(narrative_id)
      .first<{ count: number }>();

    const narrative: Narrative = {
      id: narrativeResult.id,
      user_id: narrativeResult.user_id,
      text: narrativeResult.text,
      embedding_vector: narrativeResult.embedding_vector
        ? JSON.parse(narrativeResult.embedding_vector)
        : undefined,
      source: narrativeResult.source,
      title: narrativeResult.title,
      created_at: narrativeResult.created_at,
      updated_at: narrativeResult.updated_at,
      deleted_at: narrativeResult.deleted_at,
    };

    const rho: NarrativeState = {
      id: rhoResult.id,
      narrative_id: rhoResult.narrative_id,
      scope: rhoResult.scope,
      scope_index: rhoResult.scope_index,
      eigenvalues: JSON.parse(rhoResult.eigenvalues),
      purity: rhoResult.purity,
      entropy: rhoResult.entropy,
      trace: rhoResult.trace,
      coherence: rhoResult.coherence,
      created_at: rhoResult.created_at,
    };

    return {
      narrative,
      rho,
      rho_history_count: rhoCountResult?.count || 0,
      ancestor_count: ancestorCountResult?.count || 0,
      descendant_count: descendantCountResult?.count || 0,
    };
  }

  /**
   * Get ρ state by ID
   */
  async getRho(rho_id: string): Promise<NarrativeState | null> {
    const result = await this.db
      .prepare(`SELECT * FROM narrative_states WHERE id = ?`)
      .bind(rho_id)
      .first<any>();

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      narrative_id: result.narrative_id,
      scope: result.scope,
      scope_index: result.scope_index,
      eigenvalues: JSON.parse(result.eigenvalues),
      purity: result.purity,
      entropy: result.entropy,
      trace: result.trace,
      coherence: result.coherence,
      created_at: result.created_at,
    };
  }

  /**
   * Get all ρ history for a narrative
   */
  async getRhoHistory(
    narrative_id: string,
    scope?: 'narrative' | 'sentence' | 'paragraph'
  ): Promise<NarrativeState[]> {
    let query = `SELECT * FROM narrative_states WHERE narrative_id = ?`;
    const bindings: any[] = [narrative_id];

    if (scope) {
      query += ` AND scope = ?`;
      bindings.push(scope);
    }

    query += ` ORDER BY created_at DESC`;

    const results = await this.db.prepare(query).bind(...bindings).all<any>();

    return (results.results || []).map((r) => ({
      id: r.id,
      narrative_id: r.narrative_id,
      scope: r.scope,
      scope_index: r.scope_index,
      eigenvalues: JSON.parse(r.eigenvalues),
      purity: r.purity,
      entropy: r.entropy,
      trace: r.trace,
      coherence: r.coherence,
      created_at: r.created_at,
    }));
  }

  /**
   * Create a new ρ version for a narrative
   * Used after transformations or measurements
   */
  async createRhoVersion(
    narrative_id: string,
    rho_dm: DensityMatrixState,
    options?: {
      scope?: 'narrative' | 'sentence' | 'paragraph';
      scope_index?: number;
      coherence?: number;
    }
  ): Promise<NarrativeState> {
    const rho_id = uuidv4();

    const rho = densityMatrixToNarrativeState(
      rho_id,
      narrative_id,
      options?.scope || 'narrative',
      options?.scope_index,
      rho_dm,
      options?.coherence
    );

    await this.db
      .prepare(
        `INSERT INTO narrative_states
        (id, narrative_id, scope, scope_index, eigenvalues, purity, entropy, trace, coherence, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        rho.id,
        rho.narrative_id,
        rho.scope,
        rho.scope_index || null,
        JSON.stringify(rho.eigenvalues),
        rho.purity,
        rho.entropy,
        rho.trace,
        rho.coherence || null,
        rho.created_at
      )
      .run();

    return rho;
  }

  /**
   * Update narrative text
   * Creates new embedding and new ρ version
   * Philosophy: Mutation creates new quantum state, preserves old
   */
  async update(narrative_id: string, text: string): Promise<Narrative> {
    const now = Date.now();

    // Generate new embedding
    const embeddingResult = await generateEmbedding(this.ai, text);
    // Convert to plain array (AI binding might return proxy/typed array)
    const embedding = Array.from(embeddingResult.embedding);

    // Construct new ρ
    const rho_dm = constructDensityMatrix(embedding);

    // Create new ρ version
    await this.createRhoVersion(narrative_id, rho_dm);

    // Update narrative
    await this.db
      .prepare(
        `UPDATE narratives
         SET text = ?, embedding_vector = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(text, JSON.stringify(embedding), now, narrative_id)
      .run();

    // Return updated narrative
    const result = await this.get(narrative_id);
    if (!result) {
      throw new Error(`Failed to retrieve updated narrative ${narrative_id}`);
    }

    return result.narrative;
  }

  /**
   * Soft delete narrative
   * Philosophy: Never truly delete - preserve lineage
   */
  async delete(narrative_id: string): Promise<void> {
    const now = Date.now();
    await this.db
      .prepare(`UPDATE narratives SET deleted_at = ? WHERE id = ?`)
      .bind(now, narrative_id)
      .run();
  }

  /**
   * Search narratives by text (simple LIKE for now, can add FTS later)
   */
  async search(
    user_id: string,
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      source?: 'user_upload' | 'transformation' | 'import';
    }
  ): Promise<Narrative[]> {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    let sql = `
      SELECT * FROM narratives
      WHERE user_id = ? AND deleted_at IS NULL AND text LIKE ?
    `;
    const bindings: any[] = [user_id, `%${query}%`];

    if (options?.source) {
      sql += ` AND source = ?`;
      bindings.push(options.source);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const results = await this.db.prepare(sql).bind(...bindings).all<any>();

    return (results.results || []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      text: r.text,
      embedding_vector: r.embedding_vector ? JSON.parse(r.embedding_vector) : undefined,
      source: r.source,
      title: r.title,
      created_at: r.created_at,
      updated_at: r.updated_at,
      deleted_at: r.deleted_at,
    }));
  }
}
