// Helper functions for transformation history persistence

import type { D1Database } from '@cloudflare/workers-types';

export interface TransformationHistoryInput {
  id: string;
  user_id: string;
  transformation_type: 'allegorical' | 'round-trip' | 'maieutic' | 'ai-detection';
  input_text: string;
  input_params?: Record<string, any>;
}

export interface TransformationHistoryUpdate {
  id: string;
  user_id: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  output_data?: any;
  error_message?: string;
}

/**
 * Save a new transformation to history
 */
export async function saveTransformationToHistory(
  db: D1Database,
  input: TransformationHistoryInput
): Promise<void> {
  const { id, user_id, transformation_type, input_text, input_params } = input;

  const now = Date.now();

  await db.prepare(`
    INSERT INTO transformation_history (
      id, user_id, transformation_type, input_text, input_params, status, created_at
    )
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).bind(
    id,
    user_id,
    transformation_type,
    input_text,
    input_params ? JSON.stringify(input_params) : null,
    now
  ).run();
}

/**
 * Update transformation status and results
 */
export async function updateTransformationHistory(
  db: D1Database,
  update: TransformationHistoryUpdate
): Promise<void> {
  const { id, user_id, status, output_data, error_message } = update;

  const updates: string[] = [];
  const params: any[] = [];

  if (status) {
    updates.push('status = ?');
    params.push(status);
  }

  if (output_data !== undefined) {
    updates.push('output_data = ?');
    params.push(typeof output_data === 'string' ? output_data : JSON.stringify(output_data));
  }

  if (error_message !== undefined) {
    updates.push('error_message = ?');
    params.push(error_message);
  }

  if (status === 'completed' || status === 'failed') {
    updates.push('completed_at = ?');
    params.push(Date.now());
  }

  if (updates.length === 0) {
    return;
  }

  params.push(id, user_id);

  await db.prepare(`
    UPDATE transformation_history
    SET ${updates.join(', ')}
    WHERE id = ? AND user_id = ?
  `).bind(...params).run();
}

/**
 * Check if user has exceeded storage quota
 */
export async function checkStorageQuota(
  db: D1Database,
  user_id: string,
  role: string
): Promise<{ allowed: boolean; current: number; max: number }> {
  const STORAGE_QUOTAS: Record<string, number> = {
    free: 10,
    member: 50,
    pro: 200,
    premium: -1,  // unlimited
    admin: -1     // unlimited
  };

  const maxQuota = STORAGE_QUOTAS[role] || STORAGE_QUOTAS.free;

  if (maxQuota < 0) {
    return { allowed: true, current: 0, max: -1 };
  }

  const countResult = await db.prepare(
    'SELECT COUNT(*) as total FROM transformation_history WHERE user_id = ? AND status != ?'
  ).bind(user_id, 'failed').first();

  const current = (countResult?.total as number) || 0;

  return {
    allowed: current < maxQuota,
    current,
    max: maxQuota
  };
}
