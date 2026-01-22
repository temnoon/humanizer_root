/**
 * Signoff Schemas - Validation for agent signoff requests
 */

import { z } from 'zod';
import {
  IdSchema,
  AgentIdSchema,
  TimestampSchema,
  ProjectIdSchema,
  generateUUID,
} from './common.js';

// ═══════════════════════════════════════════════════════════════════
// SIGNOFF LEVELS
// ═══════════════════════════════════════════════════════════════════

/**
 * Signoff strictness levels (per AGENT.md)
 */
export const SignoffLevelSchema = z.enum([
  'none',      // No signoff needed
  'advisory',  // Suggestions only, user decides
  'required',  // Must review before merge
  'blocking',  // Must approve all changes
]);

export type SignoffLevel = z.infer<typeof SignoffLevelSchema>;

// ═══════════════════════════════════════════════════════════════════
// SIGNOFF VOTE
// ═══════════════════════════════════════════════════════════════════

/**
 * Vote on a signoff request
 */
export const SignoffVoteSchema = z.enum([
  'approve',
  'reject',
  'abstain',
  'pending',
]);

export type SignoffVote = z.infer<typeof SignoffVoteSchema>;

// ═══════════════════════════════════════════════════════════════════
// SIGNOFF STATUS
// ═══════════════════════════════════════════════════════════════════

/**
 * Signoff request status
 */
export const SignoffStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'expired',
]);

export type SignoffStatus = z.infer<typeof SignoffStatusSchema>;

// ═══════════════════════════════════════════════════════════════════
// SIGNOFF REQUEST
// ═══════════════════════════════════════════════════════════════════

/**
 * A request for agent signoff on a change
 */
export const SignoffRequestSchema = z.object({
  /** Unique request ID */
  id: IdSchema,

  /** Type of change being reviewed */
  changeType: z.string().min(1).max(64),

  /** ID of the thing being changed */
  changeId: IdSchema.optional(),

  /** Project context */
  projectId: ProjectIdSchema,

  /** Agents required to review */
  requiredAgents: z.array(AgentIdSchema).min(1),

  /** Current votes */
  votes: z.record(AgentIdSchema, SignoffVoteSchema),

  /** Strictness level for this request */
  strictness: SignoffLevelSchema,

  /** Current status */
  status: SignoffStatusSchema,

  /** When created */
  createdAt: TimestampSchema,

  /** When resolved */
  resolvedAt: TimestampSchema.optional(),

  /** Change payload for review */
  payload: z.unknown().optional(),
});

export type SignoffRequest = z.infer<typeof SignoffRequestSchema>;

// ═══════════════════════════════════════════════════════════════════
// SIGNOFF CREATION INPUT
// ═══════════════════════════════════════════════════════════════════

/**
 * Input for creating a new signoff request
 */
export const CreateSignoffRequestInputSchema = z.object({
  changeType: z.string().min(1).max(64),
  changeId: IdSchema.optional(),
  projectId: ProjectIdSchema,
  requiredAgents: z.array(AgentIdSchema).min(1),
  strictness: SignoffLevelSchema.default('required'),
  payload: z.unknown().optional(),
});

export type CreateSignoffRequestInput = z.infer<typeof CreateSignoffRequestInputSchema>;

// ═══════════════════════════════════════════════════════════════════
// SIGNOFF VOTE INPUT
// ═══════════════════════════════════════════════════════════════════

/**
 * Input for casting a vote on a signoff request
 */
export const CastSignoffVoteInputSchema = z.object({
  requestId: IdSchema,
  agentId: AgentIdSchema,
  vote: SignoffVoteSchema.exclude(['pending']),
  reason: z.string().max(1024).optional(),
});

export type CastSignoffVoteInput = z.infer<typeof CastSignoffVoteInputSchema>;

// ═══════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Validate a signoff request with safe parsing
 */
export function validateSignoffRequest(data: unknown): {
  success: true;
  data: SignoffRequest;
} | {
  success: false;
  error: z.ZodError;
} {
  const result = SignoffRequestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Create a valid signoff request
 */
export function createSignoffRequest(input: CreateSignoffRequestInput): SignoffRequest {
  const validated = CreateSignoffRequestInputSchema.parse(input);
  
  // Initialize votes as pending for all required agents
  const votes: Record<string, SignoffVote> = {};
  for (const agentId of validated.requiredAgents) {
    votes[agentId] = 'pending';
  }

  return {
    id: generateUUID(),
    changeType: validated.changeType,
    changeId: validated.changeId,
    projectId: validated.projectId,
    requiredAgents: validated.requiredAgents,
    votes,
    strictness: validated.strictness,
    status: 'pending',
    createdAt: Date.now(),
    payload: validated.payload,
  };
}

/**
 * Determine the overall status of a signoff request based on votes
 */
export function resolveSignoffStatus(
  request: SignoffRequest
): SignoffStatus {
  const votes = Object.values(request.votes);
  
  // If any blocking rejection, the request is rejected
  if (request.strictness === 'blocking' && votes.includes('reject')) {
    return 'rejected';
  }

  // If all required agents have approved
  const approvedCount = votes.filter(v => v === 'approve').length;
  const pendingCount = votes.filter(v => v === 'pending').length;

  if (pendingCount === 0 && approvedCount === request.requiredAgents.length) {
    return 'approved';
  }

  // If any rejection in required mode
  if (request.strictness === 'required' && votes.includes('reject')) {
    return 'rejected';
  }

  return 'pending';
}

/**
 * Check if a signoff request can proceed (is approved)
 */
export function isSignoffApproved(request: SignoffRequest): boolean {
  return request.status === 'approved';
}

/**
 * Get agents who haven't voted yet
 */
export function getPendingVoters(request: SignoffRequest): string[] {
  return request.requiredAgents.filter(
    agentId => request.votes[agentId] === 'pending'
  );
}
