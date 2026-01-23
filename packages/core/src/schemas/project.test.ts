/**
 * Project Schema Tests
 */

import { describe, it, expect } from 'vitest';
import {
  ProjectPhaseSchema,
  ProjectEventTypeSchema,
  ProjectEventSchema,
  AutoApproveSettingsSchema,
  ProjectCouncilConfigSchema,
  CreateProjectConfigInputSchema,
  validateProjectConfig,
  createProjectConfig,
  getPhaseSignoffLevel,
  isAutoApproveEnabled,
  createProjectEvent,
} from './project.js';
import type { ProjectCouncilConfig, ProjectPhase } from './project.js';

describe('Project Schemas', () => {
  describe('ProjectPhaseSchema', () => {
    it('accepts valid phases', () => {
      const validPhases = ['planning', 'harvesting', 'curating', 'drafting', 'mastering', 'complete'];
      validPhases.forEach(phase => {
        expect(ProjectPhaseSchema.parse(phase)).toBe(phase);
      });
    });

    it('rejects invalid phases', () => {
      expect(() => ProjectPhaseSchema.parse('starting')).toThrow();
      expect(() => ProjectPhaseSchema.parse('finished')).toThrow();
    });
  });

  describe('ProjectEventTypeSchema', () => {
    it('accepts valid event types', () => {
      const validTypes = [
        'created', 'phase-changed', 'passage-added', 'passage-curated',
        'chapter-created', 'chapter-updated', 'chapter-reviewed',
        'thread-updated', 'settings-changed', 'completed',
      ];
      validTypes.forEach(type => {
        expect(ProjectEventTypeSchema.parse(type)).toBe(type);
      });
    });

    it('rejects invalid event types', () => {
      expect(() => ProjectEventTypeSchema.parse('started')).toThrow();
      expect(() => ProjectEventTypeSchema.parse('deleted')).toThrow();
    });
  });

  describe('ProjectEventSchema', () => {
    it('accepts valid events', () => {
      const event = {
        type: 'phase-changed',
        projectId: 'proj-123',
        data: { from: 'planning', to: 'harvesting' },
        timestamp: Date.now(),
      };
      expect(ProjectEventSchema.parse(event)).toEqual(event);
    });

    it('accepts events with triggeredBy', () => {
      const event = {
        type: 'passage-added',
        projectId: 'proj-123',
        data: { passageId: 'p-1' },
        timestamp: Date.now(),
        triggeredBy: 'harvester',
      };
      expect(ProjectEventSchema.parse(event)).toEqual(event);
    });
  });

  describe('AutoApproveSettingsSchema', () => {
    it('accepts valid settings', () => {
      const settings = {
        passageHarvest: true,
        minorChapterEdits: false,
        pyramidRebuilds: true,
      };
      expect(AutoApproveSettingsSchema.parse(settings)).toEqual(settings);
    });

    it('accepts partial settings', () => {
      expect(AutoApproveSettingsSchema.parse({ passageHarvest: true })).toEqual({ passageHarvest: true });
      expect(AutoApproveSettingsSchema.parse({})).toEqual({});
    });
  });

  describe('ProjectCouncilConfigSchema', () => {
    const validConfig: ProjectCouncilConfig = {
      projectId: 'proj-123',
      signoffStrictness: 'required',
      enabledAgents: ['architect', 'reviewer'],
    };

    it('accepts valid config', () => {
      expect(ProjectCouncilConfigSchema.parse(validConfig)).toEqual(validConfig);
    });

    it('accepts config with all optional fields', () => {
      const fullConfig = {
        ...validConfig,
        phaseConfig: {
          planning: 'advisory',
          drafting: 'blocking',
        },
        autoApprove: {
          passageHarvest: true,
          minorChapterEdits: true,
        },
      };
      expect(ProjectCouncilConfigSchema.parse(fullConfig)).toEqual(fullConfig);
    });

    it('accepts empty enabledAgents', () => {
      const config = {
        ...validConfig,
        enabledAgents: [],
      };
      expect(ProjectCouncilConfigSchema.parse(config)).toEqual(config);
    });

    it('rejects invalid signoffStrictness', () => {
      expect(() => ProjectCouncilConfigSchema.parse({
        ...validConfig,
        signoffStrictness: 'optional',
      })).toThrow();
    });
  });

  describe('CreateProjectConfigInputSchema', () => {
    it('accepts valid input', () => {
      const input = {
        projectId: 'proj-123',
      };
      const result = CreateProjectConfigInputSchema.parse(input);
      expect(result.signoffStrictness).toBe('required'); // default
      expect(result.enabledAgents).toEqual([]); // default
    });

    it('applies defaults', () => {
      const result = CreateProjectConfigInputSchema.parse({
        projectId: 'proj-1',
      });
      expect(result.signoffStrictness).toBe('required');
      expect(result.enabledAgents).toEqual([]);
    });

    it('accepts custom values', () => {
      const result = CreateProjectConfigInputSchema.parse({
        projectId: 'proj-1',
        signoffStrictness: 'blocking',
        enabledAgents: ['architect', 'security'],
      });
      expect(result.signoffStrictness).toBe('blocking');
      expect(result.enabledAgents).toEqual(['architect', 'security']);
    });
  });

  describe('validateProjectConfig', () => {
    it('returns success for valid configs', () => {
      const result = validateProjectConfig({
        projectId: 'proj-123',
        signoffStrictness: 'required',
        enabledAgents: ['architect'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projectId).toBe('proj-123');
      }
    });

    it('returns error for invalid configs', () => {
      const result = validateProjectConfig({ invalid: true });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('createProjectConfig', () => {
    it('creates a valid config with defaults', () => {
      const config = createProjectConfig({
        projectId: 'proj-123',
      });

      expect(config.projectId).toBe('proj-123');
      expect(config.signoffStrictness).toBe('required');
      expect(config.enabledAgents).toEqual([]);
    });

    it('accepts all parameters', () => {
      const config = createProjectConfig({
        projectId: 'proj-123',
        signoffStrictness: 'blocking',
        enabledAgents: ['architect', 'reviewer', 'security'],
        phaseConfig: {
          planning: 'advisory',
          mastering: 'blocking',
        },
        autoApprove: {
          passageHarvest: true,
        },
      });

      expect(config.signoffStrictness).toBe('blocking');
      expect(config.enabledAgents).toHaveLength(3);
      expect(config.phaseConfig?.planning).toBe('advisory');
      expect(config.autoApprove?.passageHarvest).toBe(true);
    });
  });

  describe('getPhaseSignoffLevel', () => {
    const baseConfig: ProjectCouncilConfig = {
      projectId: 'proj-1',
      signoffStrictness: 'required',
      enabledAgents: ['architect'],
    };

    it('returns default strictness when no phase override', () => {
      expect(getPhaseSignoffLevel(baseConfig, 'planning')).toBe('required');
      expect(getPhaseSignoffLevel(baseConfig, 'drafting')).toBe('required');
    });

    it('returns phase-specific strictness when configured', () => {
      const config: ProjectCouncilConfig = {
        ...baseConfig,
        phaseConfig: {
          planning: 'advisory',
          mastering: 'blocking',
        },
      };

      expect(getPhaseSignoffLevel(config, 'planning')).toBe('advisory');
      expect(getPhaseSignoffLevel(config, 'mastering')).toBe('blocking');
      expect(getPhaseSignoffLevel(config, 'drafting')).toBe('required'); // falls back
    });

    it('handles all phases', () => {
      const phases: ProjectPhase[] = ['planning', 'harvesting', 'curating', 'drafting', 'mastering', 'complete'];
      phases.forEach(phase => {
        expect(getPhaseSignoffLevel(baseConfig, phase)).toBe('required');
      });
    });
  });

  describe('isAutoApproveEnabled', () => {
    const baseConfig: ProjectCouncilConfig = {
      projectId: 'proj-1',
      signoffStrictness: 'required',
      enabledAgents: ['architect'],
    };

    it('returns false when autoApprove not configured', () => {
      expect(isAutoApproveEnabled(baseConfig, 'passageHarvest')).toBe(false);
      expect(isAutoApproveEnabled(baseConfig, 'minorChapterEdits')).toBe(false);
    });

    it('returns false when specific action not configured', () => {
      const config: ProjectCouncilConfig = {
        ...baseConfig,
        autoApprove: {
          passageHarvest: true,
        },
      };

      expect(isAutoApproveEnabled(config, 'minorChapterEdits')).toBe(false);
      expect(isAutoApproveEnabled(config, 'pyramidRebuilds')).toBe(false);
    });

    it('returns true when action is enabled', () => {
      const config: ProjectCouncilConfig = {
        ...baseConfig,
        autoApprove: {
          passageHarvest: true,
          minorChapterEdits: true,
        },
      };

      expect(isAutoApproveEnabled(config, 'passageHarvest')).toBe(true);
      expect(isAutoApproveEnabled(config, 'minorChapterEdits')).toBe(true);
    });

    it('returns false when action is explicitly disabled', () => {
      const config: ProjectCouncilConfig = {
        ...baseConfig,
        autoApprove: {
          passageHarvest: false,
        },
      };

      expect(isAutoApproveEnabled(config, 'passageHarvest')).toBe(false);
    });
  });

  describe('createProjectEvent', () => {
    it('creates a valid event', () => {
      const event = createProjectEvent(
        'phase-changed',
        'proj-123',
        { from: 'planning', to: 'harvesting' }
      );

      expect(event.type).toBe('phase-changed');
      expect(event.projectId).toBe('proj-123');
      expect(event.data).toEqual({ from: 'planning', to: 'harvesting' });
      expect(event.timestamp).toBeLessThanOrEqual(Date.now());
      expect(event.triggeredBy).toBeUndefined();
    });

    it('accepts triggeredBy parameter', () => {
      const event = createProjectEvent(
        'passage-added',
        'proj-123',
        { passageId: 'p-1' },
        'harvester'
      );

      expect(event.triggeredBy).toBe('harvester');
    });

    it('accepts user as triggeredBy', () => {
      const event = createProjectEvent(
        'settings-changed',
        'proj-123',
        { setting: 'strictness', value: 'blocking' },
        'user'
      );

      expect(event.triggeredBy).toBe('user');
    });

    it('creates events for all event types', () => {
      const eventTypes = [
        'created', 'phase-changed', 'passage-added', 'passage-curated',
        'chapter-created', 'chapter-updated', 'chapter-reviewed',
        'thread-updated', 'settings-changed', 'completed',
      ] as const;

      eventTypes.forEach(type => {
        const event = createProjectEvent(type, 'proj-1', {});
        expect(event.type).toBe(type);
      });
    });
  });
});
