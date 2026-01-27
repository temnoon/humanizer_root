/**
 * Audit Service
 *
 * Immutable audit logging for security, compliance, and debugging.
 * Records all significant system events with actor, target, and metadata.
 *
 * @module @humanizer/core/aui/service/audit-service
 */

import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import {
  INSERT_AUI_AUDIT_EVENT,
  GET_AUI_AUDIT_EVENT,
  LIST_AUI_AUDIT_EVENTS,
  COUNT_AUI_AUDIT_EVENTS,
  SEARCH_AUI_AUDIT_EVENTS,
} from '../../storage/schema-aui.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type AuditCategory = 'auth' | 'admin' | 'billing' | 'api' | 'system';
export type ActorType = 'user' | 'system' | 'api_key';

export interface AuditActor {
  type: ActorType;
  id: string;
  email?: string;
}

export interface AuditTarget {
  type: string;
  id: string;
  name?: string;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  action: string;
  category: AuditCategory;
  actor: AuditActor;
  target?: AuditTarget;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}

export interface AuditEventInput {
  action: string;
  category: AuditCategory;
  actor: AuditActor;
  target?: AuditTarget;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
}

export interface AuditListOptions {
  category?: AuditCategory;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditListResult {
  events: AuditEvent[];
  total: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROW CONVERSION
// ═══════════════════════════════════════════════════════════════════════════

interface AuditEventRow {
  id: string;
  tenant_id: string;
  action: string;
  category: string;
  actor_type: string;
  actor_id: string;
  actor_email: string | null;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  metadata: unknown;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  error_message: string | null;
  created_at: Date;
}

function rowToAuditEvent(row: AuditEventRow): AuditEvent {
  const event: AuditEvent = {
    id: row.id,
    tenantId: row.tenant_id,
    action: row.action,
    category: row.category as AuditCategory,
    actor: {
      type: row.actor_type as ActorType,
      id: row.actor_id,
      email: row.actor_email ?? undefined,
    },
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    ipAddress: row.ip_address ?? undefined,
    userAgent: row.user_agent ?? undefined,
    success: row.success,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
  };

  if (row.target_type && row.target_id) {
    event.target = {
      type: row.target_type,
      id: row.target_id,
      name: row.target_name ?? undefined,
    };
  }

  return event;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

export class AuditService {
  private pool: Pool;
  private tenantId: string;

  constructor(pool: Pool, tenantId = 'humanizer') {
    this.pool = pool;
    this.tenantId = tenantId;
  }

  /**
   * Record an audit event
   */
  async log(input: AuditEventInput): Promise<AuditEvent> {
    const id = randomUUID();
    const now = new Date();

    const result = await this.pool.query<AuditEventRow>(INSERT_AUI_AUDIT_EVENT, [
      id,
      this.tenantId,
      input.action,
      input.category,
      input.actor.type,
      input.actor.id,
      input.actor.email ?? null,
      input.target?.type ?? null,
      input.target?.id ?? null,
      input.target?.name ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.ipAddress ?? null,
      input.userAgent ?? null,
      input.success ?? true,
      input.errorMessage ?? null,
      now,
    ]);

    return rowToAuditEvent(result.rows[0]);
  }

  /**
   * Get a specific audit event by ID
   */
  async getEvent(id: string): Promise<AuditEvent | null> {
    const result = await this.pool.query<AuditEventRow>(GET_AUI_AUDIT_EVENT, [id, this.tenantId]);
    return result.rows[0] ? rowToAuditEvent(result.rows[0]) : null;
  }

  /**
   * List audit events with filters
   */
  async listEvents(options: AuditListOptions = {}): Promise<AuditListResult> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    // Get events
    const result = await this.pool.query<AuditEventRow>(LIST_AUI_AUDIT_EVENTS, [
      this.tenantId,
      options.category ?? null,
      options.success ?? null,
      options.startDate ?? null,
      options.endDate ?? null,
      limit,
      offset,
    ]);

    // Get total count
    const countResult = await this.pool.query<{ count: string }>(COUNT_AUI_AUDIT_EVENTS, [
      this.tenantId,
      options.category ?? null,
      options.success ?? null,
    ]);

    return {
      events: result.rows.map(rowToAuditEvent),
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
    };
  }

  /**
   * Search audit events by action, email, or target name
   */
  async searchEvents(
    query: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<AuditEvent[]> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const result = await this.pool.query<AuditEventRow>(SEARCH_AUI_AUDIT_EVENTS, [
      this.tenantId,
      query,
      limit,
      offset,
    ]);

    return result.rows.map(rowToAuditEvent);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVENIENCE METHODS FOR COMMON EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Log a user login event
   */
  async logLogin(
    userId: string,
    email: string,
    options: { method?: string; provider?: string; ip?: string; success?: boolean; error?: string }
  ): Promise<AuditEvent> {
    return this.log({
      action: options.success !== false ? 'user.login' : 'user.login_failed',
      category: 'auth',
      actor: { type: 'user', id: userId, email },
      metadata: {
        method: options.method ?? 'password',
        provider: options.provider,
      },
      ipAddress: options.ip,
      success: options.success !== false,
      errorMessage: options.error,
    });
  }

  /**
   * Log an admin action
   */
  async logAdminAction(
    adminId: string,
    adminEmail: string,
    action: string,
    target: AuditTarget,
    metadata: Record<string, unknown> = {}
  ): Promise<AuditEvent> {
    return this.log({
      action: `admin.${action}`,
      category: 'admin',
      actor: { type: 'user', id: adminId, email: adminEmail },
      target,
      metadata,
      success: true,
    });
  }

  /**
   * Log an API key action
   */
  async logApiKeyAction(
    keyId: string,
    action: string,
    metadata: Record<string, unknown> = {}
  ): Promise<AuditEvent> {
    return this.log({
      action: `api.${action}`,
      category: 'api',
      actor: { type: 'api_key', id: keyId },
      metadata,
      success: true,
    });
  }

  /**
   * Log a system event
   */
  async logSystemEvent(
    action: string,
    metadata: Record<string, unknown> = {},
    success = true,
    error?: string
  ): Promise<AuditEvent> {
    return this.log({
      action: `system.${action}`,
      category: 'system',
      actor: { type: 'system', id: 'scheduler' },
      metadata,
      success,
      errorMessage: error,
    });
  }

  /**
   * Log a billing event
   */
  async logBillingEvent(
    userId: string,
    email: string,
    action: string,
    metadata: Record<string, unknown> = {}
  ): Promise<AuditEvent> {
    return this.log({
      action: `billing.${action}`,
      category: 'billing',
      actor: { type: 'user', id: userId, email },
      metadata,
      success: true,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let auditServiceInstance: AuditService | null = null;

export function initAuditService(pool: Pool, tenantId?: string): AuditService {
  auditServiceInstance = new AuditService(pool, tenantId);
  return auditServiceInstance;
}

export function getAuditService(): AuditService | null {
  return auditServiceInstance;
}
