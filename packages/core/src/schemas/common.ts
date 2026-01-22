/**
 * Common Schemas - Shared validation primitives
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';

// ═══════════════════════════════════════════════════════════════════
// HOUSE TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * AppAgent Houses - Power the Humanizer application features
 */
export const AppAgentHouseSchema = z.enum([
  'model-master',
  'project-manager',
  'curator',
  'builder',
  'harvester',
  'reviewer',
  'explorer',
]);

export type AppAgentHouse = z.infer<typeof AppAgentHouseSchema>;

/**
 * CodeGuard Houses - Enforce code quality standards during development
 */
export const CodeGuardHouseSchema = z.enum([
  'architect',
  'stylist',
  'security',
  'accessibility',
  'data',
]);

export type CodeGuardHouse = z.infer<typeof CodeGuardHouseSchema>;

/**
 * All house types combined
 */
export const HouseTypeSchema = z.union([
  AppAgentHouseSchema,
  CodeGuardHouseSchema,
]);

export type HouseType = z.infer<typeof HouseTypeSchema>;

// ═══════════════════════════════════════════════════════════════════
// STATUS TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Agent status in the council
 */
export const AgentStatusSchema = z.enum([
  'idle',
  'working',
  'waiting',
  'error',
  'disabled',
]);

export type AgentStatus = z.infer<typeof AgentStatusSchema>;

// ═══════════════════════════════════════════════════════════════════
// SEVERITY & PRIORITY
// ═══════════════════════════════════════════════════════════════════

/**
 * Issue severity levels
 */
export const SeveritySchema = z.enum([
  'info',
  'warning',
  'error',
  'critical',
]);

export type Severity = z.infer<typeof SeveritySchema>;

/**
 * Priority levels for tasks and proposals
 */
export const PrioritySchema = z.number().int().min(0).max(100);

/**
 * Urgency levels for proposals
 */
export const UrgencySchema = z.enum([
  'low',
  'normal',
  'high',
  'critical',
]);

export type Urgency = z.infer<typeof UrgencySchema>;

// ═══════════════════════════════════════════════════════════════════
// IDENTIFIERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Standard ID format (UUID or custom)
 */
export const IdSchema = z.string().min(1).max(128);

/**
 * Project ID format
 */
export const ProjectIdSchema = z.string().min(1).max(64);

/**
 * Agent ID format
 */
export const AgentIdSchema = z.string().min(1).max(64);

/**
 * Timestamp (Unix ms)
 */
export const TimestampSchema = z.number().int().positive();

// ═══════════════════════════════════════════════════════════════════
// METADATA
// ═══════════════════════════════════════════════════════════════════

/**
 * Generic metadata object
 */
export const MetadataSchema = z.record(z.string(), z.unknown());

export type Metadata = z.infer<typeof MetadataSchema>;

// ═══════════════════════════════════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════════════════════════════════

/**
 * Agent health status
 */
export const HealthStatusSchema = z.enum([
  'healthy',
  'degraded',
  'unhealthy',
]);

export type HealthStatus = z.infer<typeof HealthStatusSchema>;

/**
 * Agent health information
 */
export const AgentHealthSchema = z.object({
  status: HealthStatusSchema,
  lastActive: TimestampSchema,
  tasksCompleted: z.number().int().nonnegative(),
  tasksFailed: z.number().int().nonnegative(),
  errorMessage: z.string().optional(),
});

export type AgentHealth = z.infer<typeof AgentHealthSchema>;

// ═══════════════════════════════════════════════════════════════════
// UUID HELPER
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a UUID (works in Node.js)
 */
export function generateUUID(): string {
  return randomUUID();
}
