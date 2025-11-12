/**
 * Operation Recorder Utility
 *
 * Purpose: Record transformation operations for narrative pipeline tracking
 * Used by transformation routes to optionally save operations to narratives
 *
 * Usage:
 * - Transformation routes can optionally accept a `narrative_id` parameter
 * - If provided, operation is recorded for that narrative
 * - If not provided, transformation works as before (no recording)
 */

import { v4 as uuidv4 } from 'uuid';

export interface RecordOperationParams {
  DB: any; // D1Database
  userId: string;
  narrativeId: string;
  operationType: string; // 'allegorical', 'round_trip', 'maieutic', etc.
  inputText: string;
  outputText: string;
  params: Record<string, any>; // Operation parameters (persona, namespace, style, etc.)
  durationMs?: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
}

/**
 * Record a transformation operation for a narrative
 *
 * @param params - Operation recording parameters
 * @returns Operation ID
 */
export async function recordOperation(params: RecordOperationParams): Promise<string> {
  const {
    DB,
    userId,
    narrativeId,
    operationType,
    inputText,
    outputText,
    params: opParams,
    durationMs,
    status = 'completed'
  } = params;

  // Verify narrative exists and belongs to user
  const narrative = await DB.prepare(`
    SELECT id FROM narratives WHERE id = ? AND user_id = ?
  `).bind(narrativeId, userId).first();

  if (!narrative) {
    throw new Error('Narrative not found or does not belong to user');
  }

  const operationId = uuidv4();
  const now = Date.now();

  await DB.prepare(`
    INSERT INTO operations (id, user_id, narrative_id, operation_type, input_text, output_text, params, status, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    operationId,
    userId,
    narrativeId,
    operationType,
    inputText,
    outputText,
    JSON.stringify(opParams),
    status,
    durationMs || null,
    now
  ).run();

  return operationId;
}

/**
 * Get operations for a narrative
 *
 * @param DB - D1Database
 * @param userId - User ID
 * @param narrativeId - Narrative ID
 * @returns Array of operations
 */
export async function getOperations(
  DB: any,
  userId: string,
  narrativeId: string
): Promise<any[]> {
  const operations = await DB.prepare(`
    SELECT id, operation_type, input_text, output_text, params, status, duration_ms, created_at
    FROM operations
    WHERE narrative_id = ? AND user_id = ?
    ORDER BY created_at ASC
  `).bind(narrativeId, userId).all();

  return operations.results.map((op: any) => ({
    id: op.id,
    operation_type: op.operation_type,
    input_text: op.input_text,
    output_text: op.output_text,
    params: JSON.parse(op.params as string),
    status: op.status,
    duration_ms: op.duration_ms,
    created_at: op.created_at
  }));
}
