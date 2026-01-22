/**
 * Common Schema Tests
 */

import { describe, it, expect } from 'vitest';
import {
  AppAgentHouseSchema,
  CodeGuardHouseSchema,
  HouseTypeSchema,
  AgentStatusSchema,
  SeveritySchema,
  UrgencySchema,
  IdSchema,
  ProjectIdSchema,
  AgentIdSchema,
  TimestampSchema,
  MetadataSchema,
  HealthStatusSchema,
  AgentHealthSchema,
  generateUUID,
} from './common.js';

describe('Common Schemas', () => {
  describe('AppAgentHouseSchema', () => {
    it('accepts valid app agent houses', () => {
      expect(AppAgentHouseSchema.parse('model-master')).toBe('model-master');
      expect(AppAgentHouseSchema.parse('harvester')).toBe('harvester');
      expect(AppAgentHouseSchema.parse('curator')).toBe('curator');
      expect(AppAgentHouseSchema.parse('builder')).toBe('builder');
      expect(AppAgentHouseSchema.parse('reviewer')).toBe('reviewer');
      expect(AppAgentHouseSchema.parse('project-manager')).toBe('project-manager');
      expect(AppAgentHouseSchema.parse('explorer')).toBe('explorer');
    });

    it('rejects invalid house types', () => {
      expect(() => AppAgentHouseSchema.parse('invalid')).toThrow();
      expect(() => AppAgentHouseSchema.parse('architect')).toThrow(); // CodeGuard, not AppAgent
    });
  });

  describe('CodeGuardHouseSchema', () => {
    it('accepts valid codeguard houses', () => {
      expect(CodeGuardHouseSchema.parse('architect')).toBe('architect');
      expect(CodeGuardHouseSchema.parse('stylist')).toBe('stylist');
      expect(CodeGuardHouseSchema.parse('security')).toBe('security');
      expect(CodeGuardHouseSchema.parse('accessibility')).toBe('accessibility');
      expect(CodeGuardHouseSchema.parse('data')).toBe('data');
    });

    it('rejects invalid house types', () => {
      expect(() => CodeGuardHouseSchema.parse('invalid')).toThrow();
      expect(() => CodeGuardHouseSchema.parse('harvester')).toThrow(); // AppAgent, not CodeGuard
    });
  });

  describe('HouseTypeSchema', () => {
    it('accepts both AppAgent and CodeGuard houses', () => {
      // AppAgent
      expect(HouseTypeSchema.parse('harvester')).toBe('harvester');
      // CodeGuard
      expect(HouseTypeSchema.parse('architect')).toBe('architect');
    });

    it('rejects invalid types', () => {
      expect(() => HouseTypeSchema.parse('unknown')).toThrow();
    });
  });

  describe('AgentStatusSchema', () => {
    it('accepts valid statuses', () => {
      expect(AgentStatusSchema.parse('idle')).toBe('idle');
      expect(AgentStatusSchema.parse('working')).toBe('working');
      expect(AgentStatusSchema.parse('waiting')).toBe('waiting');
      expect(AgentStatusSchema.parse('error')).toBe('error');
      expect(AgentStatusSchema.parse('disabled')).toBe('disabled');
    });

    it('rejects invalid statuses', () => {
      expect(() => AgentStatusSchema.parse('running')).toThrow();
    });
  });

  describe('SeveritySchema', () => {
    it('accepts valid severities', () => {
      expect(SeveritySchema.parse('info')).toBe('info');
      expect(SeveritySchema.parse('warning')).toBe('warning');
      expect(SeveritySchema.parse('error')).toBe('error');
      expect(SeveritySchema.parse('critical')).toBe('critical');
    });
  });

  describe('UrgencySchema', () => {
    it('accepts valid urgency levels', () => {
      expect(UrgencySchema.parse('low')).toBe('low');
      expect(UrgencySchema.parse('normal')).toBe('normal');
      expect(UrgencySchema.parse('high')).toBe('high');
      expect(UrgencySchema.parse('critical')).toBe('critical');
    });
  });

  describe('IdSchema', () => {
    it('accepts valid IDs', () => {
      expect(IdSchema.parse('abc123')).toBe('abc123');
      expect(IdSchema.parse('a'.repeat(128))).toBe('a'.repeat(128));
    });

    it('rejects empty strings', () => {
      expect(() => IdSchema.parse('')).toThrow();
    });

    it('rejects strings over 128 chars', () => {
      expect(() => IdSchema.parse('a'.repeat(129))).toThrow();
    });
  });

  describe('TimestampSchema', () => {
    it('accepts valid timestamps', () => {
      const now = Date.now();
      expect(TimestampSchema.parse(now)).toBe(now);
    });

    it('rejects negative timestamps', () => {
      expect(() => TimestampSchema.parse(-1)).toThrow();
    });

    it('rejects non-integers', () => {
      expect(() => TimestampSchema.parse(1.5)).toThrow();
    });
  });

  describe('MetadataSchema', () => {
    it('accepts valid metadata objects', () => {
      const metadata = { key: 'value', nested: { a: 1 } };
      expect(MetadataSchema.parse(metadata)).toEqual(metadata);
    });

    it('accepts empty objects', () => {
      expect(MetadataSchema.parse({})).toEqual({});
    });
  });

  describe('AgentHealthSchema', () => {
    it('accepts valid health objects', () => {
      const health = {
        status: 'healthy',
        lastActive: Date.now(),
        tasksCompleted: 10,
        tasksFailed: 2,
      };
      expect(AgentHealthSchema.parse(health)).toEqual(health);
    });

    it('accepts health with optional error message', () => {
      const health = {
        status: 'unhealthy',
        lastActive: Date.now(),
        tasksCompleted: 5,
        tasksFailed: 5,
        errorMessage: 'Connection failed',
      };
      expect(AgentHealthSchema.parse(health)).toEqual(health);
    });

    it('rejects invalid status', () => {
      expect(() => AgentHealthSchema.parse({
        status: 'unknown',
        lastActive: Date.now(),
        tasksCompleted: 0,
        tasksFailed: 0,
      })).toThrow();
    });
  });

  describe('generateUUID', () => {
    it('generates valid UUIDs', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('generates unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });
});
