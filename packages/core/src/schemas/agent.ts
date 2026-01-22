/**
 * Agent Schemas - Validation for agent messages and responses
 */

import { z } from 'zod';
import {
  IdSchema,
  AgentIdSchema,
  TimestampSchema,
  ProjectIdSchema,
  PrioritySchema,
  MetadataSchema,
  HouseTypeSchema,
  AgentStatusSchema,
  AgentHealthSchema,
  generateUUID,
} from './common.js';

// ═══════════════════════════════════════════════════════════════════
// AGENT MESSAGE
// ═══════════════════════════════════════════════════════════════════

/**
 * Message sent to an agent
 */
export const AgentMessageSchema = z.object({
  /** Unique message ID */
  id: IdSchema,

  /** Message type - determines handler */
  type: z.string().min(1).max(64),

  /** Sender agent ID (or 'system' / 'user') */
  from: z.string().min(1).max(64),

  /** Target agent ID */
  to: AgentIdSchema,

  /** Message payload */
  payload: z.unknown(),

  /** Correlation ID for request/response */
  correlationId: IdSchema.optional(),

  /** When the message was created */
  timestamp: TimestampSchema,

  /** Priority (higher = more urgent) */
  priority: PrioritySchema.optional(),

  /** Project context if applicable */
  projectId: ProjectIdSchema.optional(),
});

export type AgentMessage = z.infer<typeof AgentMessageSchema>;

// ═══════════════════════════════════════════════════════════════════
// AGENT RESPONSE
// ═══════════════════════════════════════════════════════════════════

/**
 * Response from an agent (without circular proposal reference)
 */
export const AgentResponseSchema = z.object({
  /** Original message ID */
  messageId: IdSchema,

  /** Whether the operation succeeded */
  success: z.boolean(),

  /** Response data */
  data: z.unknown().optional(),

  /** Error message if failed */
  error: z.string().optional(),

  /** Processing time in ms */
  processingTimeMs: z.number().int().nonnegative(),

  /** Proposal if action requires approval - validated separately */
  proposal: z.unknown().optional(),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// ═══════════════════════════════════════════════════════════════════
// BUS MESSAGE
// ═══════════════════════════════════════════════════════════════════

/**
 * Bus message for pub/sub
 */
export const BusMessageSchema = z.object({
  /** Topic the message was published to */
  topic: z.string().min(1).max(128),

  /** Publisher agent ID */
  publisher: AgentIdSchema,

  /** Message payload */
  payload: z.unknown(),

  /** When published */
  timestamp: TimestampSchema,

  /** Project context if applicable */
  projectId: ProjectIdSchema.optional(),
});

export type BusMessage = z.infer<typeof BusMessageSchema>;

// ═══════════════════════════════════════════════════════════════════
// AGENT INFO
// ═══════════════════════════════════════════════════════════════════

/**
 * Agent registration info
 */
export const AgentInfoSchema = z.object({
  id: AgentIdSchema,
  name: z.string().min(1).max(128),
  house: HouseTypeSchema,
  capabilities: z.array(z.string().min(1).max(64)),
  status: AgentStatusSchema,
});

export type AgentInfo = z.infer<typeof AgentInfoSchema>;

// ═══════════════════════════════════════════════════════════════════
// AGENT STATE
// ═══════════════════════════════════════════════════════════════════

/**
 * Agent state (persisted to SQLite)
 */
export const AgentStateSchema = z.record(z.string(), z.unknown());

export type AgentState = z.infer<typeof AgentStateSchema>;

// ═══════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Validate an agent message with safe parsing
 */
export function validateAgentMessage(data: unknown): {
  success: true;
  data: AgentMessage;
} | {
  success: false;
  error: z.ZodError;
} {
  const result = AgentMessageSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validate an agent response with safe parsing
 */
export function validateAgentResponse(data: unknown): {
  success: true;
  data: AgentResponse;
} | {
  success: false;
  error: z.ZodError;
} {
  const result = AgentResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Create a valid agent message
 */
export function createAgentMessage(
  type: string,
  from: string,
  to: string,
  payload: unknown,
  options?: {
    correlationId?: string;
    priority?: number;
    projectId?: string;
  }
): AgentMessage {
  return AgentMessageSchema.parse({
    id: generateUUID(),
    type,
    from,
    to,
    payload,
    timestamp: Date.now(),
    ...options,
  });
}
