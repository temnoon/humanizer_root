/**
 * Project Schemas - Validation for project configuration and events
 */

import { z } from 'zod';
import {
  IdSchema,
  ProjectIdSchema,
  TimestampSchema,
  AgentIdSchema,
} from './common.js';
import { SignoffLevelSchema, SignoffLevel } from './signoff.js';

// ═══════════════════════════════════════════════════════════════════
// PROJECT PHASE
// ═══════════════════════════════════════════════════════════════════

/**
 * Project phases
 */
export const ProjectPhaseSchema = z.enum([
  'planning',
  'harvesting',
  'curating',
  'drafting',
  'mastering',
  'complete',
]);

export type ProjectPhase = z.infer<typeof ProjectPhaseSchema>;

// ═══════════════════════════════════════════════════════════════════
// PROJECT EVENT TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Project event types
 */
export const ProjectEventTypeSchema = z.enum([
  'created',
  'phase-changed',
  'passage-added',
  'passage-curated',
  'chapter-created',
  'chapter-updated',
  'chapter-reviewed',
  'thread-updated',
  'settings-changed',
  'completed',
]);

export type ProjectEventType = z.infer<typeof ProjectEventTypeSchema>;

// ═══════════════════════════════════════════════════════════════════
// PROJECT EVENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Event emitted when project state changes
 */
export const ProjectEventSchema = z.object({
  type: ProjectEventTypeSchema,
  projectId: ProjectIdSchema,
  data: z.unknown(),
  timestamp: TimestampSchema,
  triggeredBy: z.string().optional(), // Agent ID or 'user'
});

export type ProjectEvent = z.infer<typeof ProjectEventSchema>;

// ═══════════════════════════════════════════════════════════════════
// PROJECT COUNCIL CONFIG
// ═══════════════════════════════════════════════════════════════════

/**
 * Auto-approve settings for a project
 */
export const AutoApproveSettingsSchema = z.object({
  passageHarvest: z.boolean().optional(),
  minorChapterEdits: z.boolean().optional(),
  pyramidRebuilds: z.boolean().optional(),
});

export type AutoApproveSettings = z.infer<typeof AutoApproveSettingsSchema>;

/**
 * Council configuration for a project
 */
export const ProjectCouncilConfigSchema = z.object({
  /** Project ID this config applies to */
  projectId: ProjectIdSchema,

  /** Overall signoff strictness */
  signoffStrictness: SignoffLevelSchema,

  /** Per-phase overrides */
  phaseConfig: z.record(ProjectPhaseSchema, SignoffLevelSchema).optional(),

  /** Which agents are enabled for this project */
  enabledAgents: z.array(AgentIdSchema),

  /** Auto-approve settings */
  autoApprove: AutoApproveSettingsSchema.optional(),
});

export type ProjectCouncilConfig = z.infer<typeof ProjectCouncilConfigSchema>;

// ═══════════════════════════════════════════════════════════════════
// PROJECT CREATION INPUT
// ═══════════════════════════════════════════════════════════════════

/**
 * Input for creating project council config
 */
export const CreateProjectConfigInputSchema = z.object({
  projectId: ProjectIdSchema,
  signoffStrictness: SignoffLevelSchema.default('required'),
  phaseConfig: z.record(ProjectPhaseSchema, SignoffLevelSchema).optional(),
  enabledAgents: z.array(AgentIdSchema).default([]),
  autoApprove: AutoApproveSettingsSchema.optional(),
});

export type CreateProjectConfigInput = z.infer<typeof CreateProjectConfigInputSchema>;

// ═══════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Validate project council config with safe parsing
 */
export function validateProjectConfig(data: unknown): {
  success: true;
  data: ProjectCouncilConfig;
} | {
  success: false;
  error: z.ZodError;
} {
  const result = ProjectCouncilConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Create default project council config
 */
export function createProjectConfig(input: CreateProjectConfigInput): ProjectCouncilConfig {
  return ProjectCouncilConfigSchema.parse(input);
}

/**
 * Get signoff level for a specific phase
 */
export function getPhaseSignoffLevel(
  config: ProjectCouncilConfig,
  phase: ProjectPhase
): SignoffLevel {
  if (config.phaseConfig?.[phase]) {
    return config.phaseConfig[phase];
  }
  return config.signoffStrictness;
}

/**
 * Check if auto-approve is enabled for a specific action
 */
export function isAutoApproveEnabled(
  config: ProjectCouncilConfig,
  action: keyof AutoApproveSettings
): boolean {
  return config.autoApprove?.[action] ?? false;
}

/**
 * Create a project event
 */
export function createProjectEvent(
  type: ProjectEventType,
  projectId: string,
  data: unknown,
  triggeredBy?: string
): ProjectEvent {
  return ProjectEventSchema.parse({
    type,
    projectId,
    data,
    timestamp: Date.now(),
    triggeredBy,
  });
}
