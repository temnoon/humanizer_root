/**
 * Proposal Schemas - Validation for semi-autonomous actions
 */

import { z } from 'zod';
import {
  IdSchema,
  AgentIdSchema,
  TimestampSchema,
  ProjectIdSchema,
  UrgencySchema,
  generateUUID,
} from './common.js';

// ═══════════════════════════════════════════════════════════════════
// PROPOSAL STATUS
// ═══════════════════════════════════════════════════════════════════

/**
 * Proposal status
 */
export const ProposalStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'expired',
  'auto',
]);

export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;

// ═══════════════════════════════════════════════════════════════════
// PROPOSAL
// ═══════════════════════════════════════════════════════════════════

/**
 * A proposed action that may require user approval
 */
export const ProposalSchema = z.object({
  /** Unique proposal ID */
  id: IdSchema,

  /** Agent proposing the action */
  agentId: AgentIdSchema,

  /** Type of action being proposed */
  actionType: z.string().min(1).max(64),

  /** Description for the user */
  title: z.string().min(1).max(256),
  description: z.string().max(2048).optional(),

  /** The action payload */
  payload: z.unknown(),

  /** Whether this requires explicit approval */
  requiresApproval: z.boolean(),

  /** How urgent this decision is */
  urgency: UrgencySchema,

  /** Project context */
  projectId: ProjectIdSchema.optional(),

  /** Current status */
  status: ProposalStatusSchema,

  /** When created */
  createdAt: TimestampSchema,

  /** When decided (if decided) */
  decidedAt: TimestampSchema.optional(),

  /** Who decided ('user' or 'auto') */
  decidedBy: z.enum(['user', 'auto']).optional(),

  /** Reason for decision */
  decisionReason: z.string().max(1024).optional(),

  /** Expiration time (ms since epoch) */
  expiresAt: TimestampSchema.optional(),
});

export type Proposal = z.infer<typeof ProposalSchema>;

// ═══════════════════════════════════════════════════════════════════
// PROPOSAL CREATION INPUT
// ═══════════════════════════════════════════════════════════════════

/**
 * Input for creating a new proposal
 */
export const CreateProposalInputSchema = z.object({
  agentId: AgentIdSchema,
  actionType: z.string().min(1).max(64),
  title: z.string().min(1).max(256),
  description: z.string().max(2048).optional(),
  payload: z.unknown(),
  requiresApproval: z.boolean().default(true),
  urgency: UrgencySchema.default('normal'),
  projectId: ProjectIdSchema.optional(),
  /** Time in ms until expiration (default: 1 hour) */
  expiresInMs: z.number().int().positive().optional(),
});

export type CreateProposalInput = z.infer<typeof CreateProposalInputSchema>;

// ═══════════════════════════════════════════════════════════════════
// PROPOSAL DECISION
// ═══════════════════════════════════════════════════════════════════

/**
 * Decision on a proposal
 */
export const ProposalDecisionSchema = z.object({
  proposalId: IdSchema,
  decision: z.enum(['approve', 'reject']),
  reason: z.string().max(1024).optional(),
  decidedBy: z.enum(['user', 'auto']),
});

export type ProposalDecision = z.infer<typeof ProposalDecisionSchema>;

// ═══════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Validate a proposal with safe parsing
 */
export function validateProposal(data: unknown): {
  success: true;
  data: Proposal;
} | {
  success: false;
  error: z.ZodError;
} {
  const result = ProposalSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Create a valid proposal
 */
export function createProposal(input: CreateProposalInput): Proposal {
  const validated = CreateProposalInputSchema.parse(input);
  const now = Date.now();
  
  return {
    id: generateUUID(),
    agentId: validated.agentId,
    actionType: validated.actionType,
    title: validated.title,
    description: validated.description,
    payload: validated.payload,
    requiresApproval: validated.requiresApproval,
    urgency: validated.urgency,
    projectId: validated.projectId,
    status: 'pending',
    createdAt: now,
    expiresAt: validated.expiresInMs ? now + validated.expiresInMs : now + 3600000, // 1 hour default
  };
}

/**
 * Check if a proposal is expired
 */
export function isProposalExpired(proposal: Proposal): boolean {
  if (!proposal.expiresAt) return false;
  return Date.now() > proposal.expiresAt;
}

/**
 * Check if a proposal is pending decision
 */
export function isProposalPending(proposal: Proposal): boolean {
  return proposal.status === 'pending' && !isProposalExpired(proposal);
}
