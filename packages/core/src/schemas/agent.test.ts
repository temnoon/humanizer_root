/**
 * Agent Schema Tests
 */

import { describe, it, expect } from 'vitest';
import {
  AgentMessageSchema,
  AgentResponseSchema,
  BusMessageSchema,
  AgentInfoSchema,
  AgentStateSchema,
  validateAgentMessage,
  validateAgentResponse,
  createAgentMessage,
} from './agent.js';

describe('Agent Schemas', () => {
  describe('AgentMessageSchema', () => {
    const validMessage = {
      id: 'msg-123',
      type: 'review-code',
      from: 'user',
      to: 'architect',
      payload: { files: ['src/index.ts'] },
      timestamp: Date.now(),
    };

    it('accepts valid messages', () => {
      expect(AgentMessageSchema.parse(validMessage)).toEqual(validMessage);
    });

    it('accepts messages with optional fields', () => {
      const msgWithOptionals = {
        ...validMessage,
        correlationId: 'corr-456',
        priority: 75,
        projectId: 'proj-789',
      };
      expect(AgentMessageSchema.parse(msgWithOptionals)).toEqual(msgWithOptionals);
    });

    it('rejects messages without required fields', () => {
      const { id, ...withoutId } = validMessage;
      expect(() => AgentMessageSchema.parse(withoutId)).toThrow();
    });

    it('rejects messages with invalid type (empty string)', () => {
      expect(() => AgentMessageSchema.parse({ ...validMessage, type: '' })).toThrow();
    });

    it('rejects messages with invalid priority (out of range)', () => {
      expect(() => AgentMessageSchema.parse({ ...validMessage, priority: 150 })).toThrow();
      expect(() => AgentMessageSchema.parse({ ...validMessage, priority: -1 })).toThrow();
    });
  });

  describe('AgentResponseSchema', () => {
    const validResponse = {
      messageId: 'msg-123',
      success: true,
      processingTimeMs: 150,
    };

    it('accepts valid responses', () => {
      expect(AgentResponseSchema.parse(validResponse)).toEqual(validResponse);
    });

    it('accepts responses with data', () => {
      const respWithData = {
        ...validResponse,
        data: { issues: [], recommendations: [] },
      };
      expect(AgentResponseSchema.parse(respWithData)).toEqual(respWithData);
    });

    it('accepts error responses', () => {
      const errorResp = {
        messageId: 'msg-123',
        success: false,
        error: 'Agent not available',
        processingTimeMs: 10,
      };
      expect(AgentResponseSchema.parse(errorResp)).toEqual(errorResp);
    });
  });

  describe('BusMessageSchema', () => {
    it('accepts valid bus messages', () => {
      const busMsg = {
        topic: 'agent:status',
        publisher: 'architect',
        payload: { status: 'idle' },
        timestamp: Date.now(),
      };
      expect(BusMessageSchema.parse(busMsg)).toEqual(busMsg);
    });

    it('accepts bus messages with project context', () => {
      const busMsg = {
        topic: 'task:completed',
        publisher: 'harvester',
        payload: { taskId: 'task-123' },
        timestamp: Date.now(),
        projectId: 'proj-456',
      };
      expect(BusMessageSchema.parse(busMsg)).toEqual(busMsg);
    });
  });

  describe('AgentInfoSchema', () => {
    it('accepts valid agent info', () => {
      const info = {
        id: 'architect',
        name: 'The Architect',
        house: 'architect',
        capabilities: ['review-architecture', 'detect-anti-patterns'],
        status: 'idle',
      };
      expect(AgentInfoSchema.parse(info)).toEqual(info);
    });

    it('rejects agent info with invalid house', () => {
      expect(() => AgentInfoSchema.parse({
        id: 'test',
        name: 'Test Agent',
        house: 'invalid-house',
        capabilities: [],
        status: 'idle',
      })).toThrow();
    });
  });

  describe('AgentStateSchema', () => {
    it('accepts any record of strings to unknown', () => {
      const state = {
        lastReviewTime: Date.now(),
        reviewCount: 42,
        config: { strict: true },
      };
      expect(AgentStateSchema.parse(state)).toEqual(state);
    });
  });

  describe('validateAgentMessage', () => {
    it('returns success for valid messages', () => {
      const result = validateAgentMessage({
        id: 'msg-123',
        type: 'test',
        from: 'user',
        to: 'agent',
        payload: {},
        timestamp: Date.now(),
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('msg-123');
      }
    });

    it('returns error for invalid messages', () => {
      const result = validateAgentMessage({ invalid: true });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('validateAgentResponse', () => {
    it('returns success for valid responses', () => {
      const result = validateAgentResponse({
        messageId: 'msg-123',
        success: true,
        processingTimeMs: 100,
      });
      expect(result.success).toBe(true);
    });

    it('returns error for invalid responses', () => {
      const result = validateAgentResponse({ success: 'yes' }); // should be boolean
      expect(result.success).toBe(false);
    });
  });

  describe('createAgentMessage', () => {
    it('creates a valid message with auto-generated id and timestamp', () => {
      const msg = createAgentMessage('review', 'user', 'architect', { file: 'test.ts' });
      
      expect(msg.id).toBeDefined();
      expect(msg.id.length).toBeGreaterThan(0);
      expect(msg.type).toBe('review');
      expect(msg.from).toBe('user');
      expect(msg.to).toBe('architect');
      expect(msg.payload).toEqual({ file: 'test.ts' });
      expect(msg.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('accepts optional parameters', () => {
      const msg = createAgentMessage('task', 'system', 'harvester', {}, {
        correlationId: 'corr-123',
        priority: 90,
        projectId: 'proj-456',
      });
      
      expect(msg.correlationId).toBe('corr-123');
      expect(msg.priority).toBe(90);
      expect(msg.projectId).toBe('proj-456');
    });
  });
});
