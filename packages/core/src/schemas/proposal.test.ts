/**
 * Proposal Schema Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ProposalStatusSchema,
  ProposalSchema,
  CreateProposalInputSchema,
  ProposalDecisionSchema,
  validateProposal,
  createProposal,
  isProposalExpired,
  isProposalPending,
} from './proposal.js';
import type { Proposal } from './proposal.js';

describe('Proposal Schemas', () => {
  describe('ProposalStatusSchema', () => {
    it('accepts valid statuses', () => {
      const validStatuses = ['pending', 'approved', 'rejected', 'expired', 'auto'];
      validStatuses.forEach(status => {
        expect(ProposalStatusSchema.parse(status)).toBe(status);
      });
    });

    it('rejects invalid statuses', () => {
      expect(() => ProposalStatusSchema.parse('invalid')).toThrow();
      expect(() => ProposalStatusSchema.parse('cancelled')).toThrow();
    });
  });

  describe('ProposalSchema', () => {
    const validProposal: Proposal = {
      id: 'prop-123',
      agentId: 'harvester',
      actionType: 'add-passage',
      title: 'Add passage to chapter 1',
      payload: { passageId: 'passage-456', chapterId: 'ch-1' },
      requiresApproval: true,
      urgency: 'normal',
      status: 'pending',
      createdAt: Date.now(),
    };

    it('accepts valid proposals', () => {
      expect(ProposalSchema.parse(validProposal)).toEqual(validProposal);
    });

    it('accepts proposals with all optional fields', () => {
      const fullProposal = {
        ...validProposal,
        description: 'This passage fits the chapter theme perfectly',
        projectId: 'proj-789',
        decidedAt: Date.now(),
        decidedBy: 'user' as const,
        decisionReason: 'Approved for quality',
        expiresAt: Date.now() + 3600000,
      };
      expect(ProposalSchema.parse(fullProposal)).toEqual(fullProposal);
    });

    it('rejects proposals with invalid urgency', () => {
      expect(() => ProposalSchema.parse({
        ...validProposal,
        urgency: 'super-urgent',
      })).toThrow();
    });

    it('rejects proposals with empty title', () => {
      expect(() => ProposalSchema.parse({
        ...validProposal,
        title: '',
      })).toThrow();
    });

    it('rejects proposals with title exceeding max length', () => {
      expect(() => ProposalSchema.parse({
        ...validProposal,
        title: 'x'.repeat(257),
      })).toThrow();
    });

    it('rejects proposals with description exceeding max length', () => {
      expect(() => ProposalSchema.parse({
        ...validProposal,
        description: 'x'.repeat(2049),
      })).toThrow();
    });

    it('accepts valid decidedBy values', () => {
      expect(ProposalSchema.parse({
        ...validProposal,
        decidedBy: 'user',
      }).decidedBy).toBe('user');

      expect(ProposalSchema.parse({
        ...validProposal,
        decidedBy: 'auto',
      }).decidedBy).toBe('auto');
    });
  });

  describe('CreateProposalInputSchema', () => {
    it('accepts valid input', () => {
      const input = {
        agentId: 'curator',
        actionType: 'rate-passage',
        title: 'Rate passage quality',
        payload: { passageId: 'p-1' },
      };
      const result = CreateProposalInputSchema.parse(input);
      expect(result.requiresApproval).toBe(true); // default
      expect(result.urgency).toBe('normal'); // default
    });

    it('applies defaults', () => {
      const result = CreateProposalInputSchema.parse({
        agentId: 'curator',
        actionType: 'rate-passage',
        title: 'Rate passage',
        payload: {},
      });
      expect(result.requiresApproval).toBe(true);
      expect(result.urgency).toBe('normal');
    });

    it('accepts expiresInMs for custom expiration', () => {
      const result = CreateProposalInputSchema.parse({
        agentId: 'curator',
        actionType: 'rate-passage',
        title: 'Rate passage',
        payload: {},
        expiresInMs: 1800000, // 30 minutes
      });
      expect(result.expiresInMs).toBe(1800000);
    });
  });

  describe('ProposalDecisionSchema', () => {
    it('accepts valid approve decision', () => {
      const decision = {
        proposalId: 'prop-123',
        decision: 'approve',
        decidedBy: 'user',
        reason: 'Looks good',
      };
      expect(ProposalDecisionSchema.parse(decision)).toEqual(decision);
    });

    it('accepts valid reject decision', () => {
      const decision = {
        proposalId: 'prop-123',
        decision: 'reject',
        decidedBy: 'auto',
      };
      expect(ProposalDecisionSchema.parse(decision)).toEqual(decision);
    });

    it('rejects invalid decision values', () => {
      expect(() => ProposalDecisionSchema.parse({
        proposalId: 'prop-123',
        decision: 'maybe',
        decidedBy: 'user',
      })).toThrow();
    });
  });

  describe('validateProposal', () => {
    it('returns success for valid proposals', () => {
      const result = validateProposal({
        id: 'prop-123',
        agentId: 'harvester',
        actionType: 'add-passage',
        title: 'Add passage',
        payload: {},
        requiresApproval: true,
        urgency: 'normal',
        status: 'pending',
        createdAt: Date.now(),
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('prop-123');
      }
    });

    it('returns error for invalid proposals', () => {
      const result = validateProposal({ invalid: true });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('createProposal', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-22T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('creates a valid proposal with auto-generated id and timestamps', () => {
      const proposal = createProposal({
        agentId: 'harvester',
        actionType: 'add-passage',
        title: 'Add passage to chapter',
        payload: { passageId: 'p-1' },
      });

      expect(proposal.id).toBeDefined();
      expect(proposal.id.length).toBeGreaterThan(0);
      expect(proposal.agentId).toBe('harvester');
      expect(proposal.actionType).toBe('add-passage');
      expect(proposal.status).toBe('pending');
      expect(proposal.createdAt).toBe(Date.now());
      expect(proposal.expiresAt).toBe(Date.now() + 3600000); // 1 hour default
    });

    it('uses custom expiration', () => {
      const proposal = createProposal({
        agentId: 'harvester',
        actionType: 'urgent-action',
        title: 'Urgent action needed',
        payload: {},
        expiresInMs: 300000, // 5 minutes
      });

      expect(proposal.expiresAt).toBe(Date.now() + 300000);
    });

    it('applies default values', () => {
      const proposal = createProposal({
        agentId: 'curator',
        actionType: 'rate',
        title: 'Rate quality',
        payload: {},
      });

      expect(proposal.requiresApproval).toBe(true);
      expect(proposal.urgency).toBe('normal');
    });
  });

  describe('isProposalExpired', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-22T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const baseProposal: Proposal = {
      id: 'prop-1',
      agentId: 'harvester',
      actionType: 'add',
      title: 'Test',
      payload: {},
      requiresApproval: true,
      urgency: 'normal',
      status: 'pending',
      createdAt: Date.now(),
    };

    it('returns false for proposals without expiresAt', () => {
      expect(isProposalExpired(baseProposal)).toBe(false);
    });

    it('returns false for proposals not yet expired', () => {
      const proposal: Proposal = {
        ...baseProposal,
        expiresAt: Date.now() + 3600000, // 1 hour in future
      };
      expect(isProposalExpired(proposal)).toBe(false);
    });

    it('returns true for expired proposals', () => {
      const proposal: Proposal = {
        ...baseProposal,
        expiresAt: Date.now() - 1, // 1ms in past
      };
      expect(isProposalExpired(proposal)).toBe(true);
    });
  });

  describe('isProposalPending', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-22T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const baseProposal: Proposal = {
      id: 'prop-1',
      agentId: 'harvester',
      actionType: 'add',
      title: 'Test',
      payload: {},
      requiresApproval: true,
      urgency: 'normal',
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    };

    it('returns true for pending non-expired proposals', () => {
      expect(isProposalPending(baseProposal)).toBe(true);
    });

    it('returns false for approved proposals', () => {
      expect(isProposalPending({ ...baseProposal, status: 'approved' })).toBe(false);
    });

    it('returns false for rejected proposals', () => {
      expect(isProposalPending({ ...baseProposal, status: 'rejected' })).toBe(false);
    });

    it('returns false for expired pending proposals', () => {
      const expiredProposal: Proposal = {
        ...baseProposal,
        expiresAt: Date.now() - 1000, // expired
      };
      expect(isProposalPending(expiredProposal)).toBe(false);
    });
  });
});
