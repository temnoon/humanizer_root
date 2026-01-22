/**
 * Signoff Schema Tests
 */

import { describe, it, expect } from 'vitest';
import {
  SignoffLevelSchema,
  SignoffVoteSchema,
  SignoffStatusSchema,
  SignoffRequestSchema,
  CreateSignoffRequestInputSchema,
  CastSignoffVoteInputSchema,
  validateSignoffRequest,
  createSignoffRequest,
  resolveSignoffStatus,
  isSignoffApproved,
  getPendingVoters,
} from './signoff.js';
import type { SignoffRequest } from './signoff.js';

describe('Signoff Schemas', () => {
  describe('SignoffLevelSchema', () => {
    it('accepts valid levels', () => {
      const validLevels = ['none', 'advisory', 'required', 'blocking'];
      validLevels.forEach(level => {
        expect(SignoffLevelSchema.parse(level)).toBe(level);
      });
    });

    it('rejects invalid levels', () => {
      expect(() => SignoffLevelSchema.parse('optional')).toThrow();
      expect(() => SignoffLevelSchema.parse('mandatory')).toThrow();
    });
  });

  describe('SignoffVoteSchema', () => {
    it('accepts valid votes', () => {
      const validVotes = ['approve', 'reject', 'abstain', 'pending'];
      validVotes.forEach(vote => {
        expect(SignoffVoteSchema.parse(vote)).toBe(vote);
      });
    });

    it('rejects invalid votes', () => {
      expect(() => SignoffVoteSchema.parse('maybe')).toThrow();
      expect(() => SignoffVoteSchema.parse('yes')).toThrow();
    });
  });

  describe('SignoffStatusSchema', () => {
    it('accepts valid statuses', () => {
      const validStatuses = ['pending', 'approved', 'rejected', 'expired'];
      validStatuses.forEach(status => {
        expect(SignoffStatusSchema.parse(status)).toBe(status);
      });
    });

    it('rejects invalid statuses', () => {
      expect(() => SignoffStatusSchema.parse('cancelled')).toThrow();
    });
  });

  describe('SignoffRequestSchema', () => {
    const validRequest: SignoffRequest = {
      id: 'signoff-123',
      changeType: 'chapter-update',
      projectId: 'proj-456',
      requiredAgents: ['architect', 'reviewer'],
      votes: {
        architect: 'pending',
        reviewer: 'pending',
      },
      strictness: 'required',
      status: 'pending',
      createdAt: Date.now(),
    };

    it('accepts valid signoff requests', () => {
      expect(SignoffRequestSchema.parse(validRequest)).toEqual(validRequest);
    });

    it('accepts requests with all optional fields', () => {
      const fullRequest = {
        ...validRequest,
        changeId: 'change-789',
        resolvedAt: Date.now(),
        payload: { diff: '+added\n-removed' },
      };
      expect(SignoffRequestSchema.parse(fullRequest)).toEqual(fullRequest);
    });

    it('rejects requests with empty requiredAgents', () => {
      expect(() => SignoffRequestSchema.parse({
        ...validRequest,
        requiredAgents: [],
      })).toThrow();
    });

    it('rejects requests with invalid strictness', () => {
      expect(() => SignoffRequestSchema.parse({
        ...validRequest,
        strictness: 'optional',
      })).toThrow();
    });
  });

  describe('CreateSignoffRequestInputSchema', () => {
    it('accepts valid input', () => {
      const input = {
        changeType: 'chapter-create',
        projectId: 'proj-123',
        requiredAgents: ['architect'],
      };
      const result = CreateSignoffRequestInputSchema.parse(input);
      expect(result.strictness).toBe('required'); // default
    });

    it('applies default strictness', () => {
      const result = CreateSignoffRequestInputSchema.parse({
        changeType: 'update',
        projectId: 'proj-1',
        requiredAgents: ['reviewer'],
      });
      expect(result.strictness).toBe('required');
    });

    it('accepts custom strictness', () => {
      const result = CreateSignoffRequestInputSchema.parse({
        changeType: 'update',
        projectId: 'proj-1',
        requiredAgents: ['reviewer'],
        strictness: 'blocking',
      });
      expect(result.strictness).toBe('blocking');
    });

    it('rejects input with empty requiredAgents', () => {
      expect(() => CreateSignoffRequestInputSchema.parse({
        changeType: 'update',
        projectId: 'proj-1',
        requiredAgents: [],
      })).toThrow();
    });
  });

  describe('CastSignoffVoteInputSchema', () => {
    it('accepts valid approve vote', () => {
      const input = {
        requestId: 'signoff-123',
        agentId: 'architect',
        vote: 'approve',
        reason: 'Code looks good',
      };
      expect(CastSignoffVoteInputSchema.parse(input)).toEqual(input);
    });

    it('accepts valid reject vote', () => {
      const input = {
        requestId: 'signoff-123',
        agentId: 'security',
        vote: 'reject',
        reason: 'Security vulnerability found',
      };
      expect(CastSignoffVoteInputSchema.parse(input)).toEqual(input);
    });

    it('accepts abstain vote', () => {
      const input = {
        requestId: 'signoff-123',
        agentId: 'stylist',
        vote: 'abstain',
      };
      expect(CastSignoffVoteInputSchema.parse(input)).toEqual(input);
    });

    it('rejects pending as a vote (cannot cast pending)', () => {
      expect(() => CastSignoffVoteInputSchema.parse({
        requestId: 'signoff-123',
        agentId: 'architect',
        vote: 'pending',
      })).toThrow();
    });
  });

  describe('validateSignoffRequest', () => {
    it('returns success for valid requests', () => {
      const result = validateSignoffRequest({
        id: 'signoff-123',
        changeType: 'update',
        projectId: 'proj-1',
        requiredAgents: ['architect'],
        votes: { architect: 'pending' },
        strictness: 'required',
        status: 'pending',
        createdAt: Date.now(),
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('signoff-123');
      }
    });

    it('returns error for invalid requests', () => {
      const result = validateSignoffRequest({ invalid: true });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('createSignoffRequest', () => {
    it('creates a valid request with auto-generated id and timestamp', () => {
      const request = createSignoffRequest({
        changeType: 'chapter-create',
        projectId: 'proj-123',
        requiredAgents: ['architect', 'reviewer'],
      });

      expect(request.id).toBeDefined();
      expect(request.id.length).toBeGreaterThan(0);
      expect(request.changeType).toBe('chapter-create');
      expect(request.projectId).toBe('proj-123');
      expect(request.status).toBe('pending');
      expect(request.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('initializes all required agent votes as pending', () => {
      const request = createSignoffRequest({
        changeType: 'update',
        projectId: 'proj-1',
        requiredAgents: ['architect', 'stylist', 'security'],
      });

      expect(request.votes).toEqual({
        architect: 'pending',
        stylist: 'pending',
        security: 'pending',
      });
    });
  });

  describe('resolveSignoffStatus', () => {
    const baseRequest: SignoffRequest = {
      id: 'signoff-1',
      changeType: 'update',
      projectId: 'proj-1',
      requiredAgents: ['architect', 'reviewer'],
      votes: { architect: 'pending', reviewer: 'pending' },
      strictness: 'required',
      status: 'pending',
      createdAt: Date.now(),
    };

    it('returns approved when all agents approve', () => {
      const request: SignoffRequest = {
        ...baseRequest,
        votes: { architect: 'approve', reviewer: 'approve' },
      };
      expect(resolveSignoffStatus(request)).toBe('approved');
    });

    it('returns pending when some votes are pending', () => {
      const request: SignoffRequest = {
        ...baseRequest,
        votes: { architect: 'approve', reviewer: 'pending' },
      };
      expect(resolveSignoffStatus(request)).toBe('pending');
    });

    it('returns rejected for required strictness with any rejection', () => {
      const request: SignoffRequest = {
        ...baseRequest,
        strictness: 'required',
        votes: { architect: 'approve', reviewer: 'reject' },
      };
      expect(resolveSignoffStatus(request)).toBe('rejected');
    });

    it('returns rejected immediately for blocking strictness with any rejection', () => {
      const request: SignoffRequest = {
        ...baseRequest,
        strictness: 'blocking',
        votes: { architect: 'reject', reviewer: 'pending' },
      };
      expect(resolveSignoffStatus(request)).toBe('rejected');
    });

    it('handles abstain votes (counted as complete, not blocking)', () => {
      const request: SignoffRequest = {
        ...baseRequest,
        votes: { architect: 'approve', reviewer: 'abstain' },
      };
      // Abstain doesn't count as approval - only approves count
      expect(resolveSignoffStatus(request)).toBe('pending');
    });
  });

  describe('isSignoffApproved', () => {
    const baseRequest: SignoffRequest = {
      id: 'signoff-1',
      changeType: 'update',
      projectId: 'proj-1',
      requiredAgents: ['architect'],
      votes: { architect: 'approve' },
      strictness: 'required',
      status: 'pending',
      createdAt: Date.now(),
    };

    it('returns true for approved requests', () => {
      expect(isSignoffApproved({ ...baseRequest, status: 'approved' })).toBe(true);
    });

    it('returns false for pending requests', () => {
      expect(isSignoffApproved({ ...baseRequest, status: 'pending' })).toBe(false);
    });

    it('returns false for rejected requests', () => {
      expect(isSignoffApproved({ ...baseRequest, status: 'rejected' })).toBe(false);
    });

    it('returns false for expired requests', () => {
      expect(isSignoffApproved({ ...baseRequest, status: 'expired' })).toBe(false);
    });
  });

  describe('getPendingVoters', () => {
    const baseRequest: SignoffRequest = {
      id: 'signoff-1',
      changeType: 'update',
      projectId: 'proj-1',
      requiredAgents: ['architect', 'stylist', 'security'],
      votes: {
        architect: 'pending',
        stylist: 'pending',
        security: 'pending',
      },
      strictness: 'required',
      status: 'pending',
      createdAt: Date.now(),
    };

    it('returns all agents when none have voted', () => {
      const pending = getPendingVoters(baseRequest);
      expect(pending).toEqual(['architect', 'stylist', 'security']);
    });

    it('returns only agents who have not voted', () => {
      const request: SignoffRequest = {
        ...baseRequest,
        votes: {
          architect: 'approve',
          stylist: 'pending',
          security: 'reject',
        },
      };
      expect(getPendingVoters(request)).toEqual(['stylist']);
    });

    it('returns empty array when all have voted', () => {
      const request: SignoffRequest = {
        ...baseRequest,
        votes: {
          architect: 'approve',
          stylist: 'approve',
          security: 'approve',
        },
      };
      expect(getPendingVoters(request)).toEqual([]);
    });
  });
});
