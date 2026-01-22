/**
 * Hooks Handlers
 *
 * MCP tool handlers for review hooks operations.
 * Allows triggering reviews and managing hook configuration.
 */

import type { MCPResult, TriggerReviewInput } from '../types.js';
import type { DevelopmentHouseType, ReviewResult, CodeFile } from '../../houses/codeguard/types.js';
import {
  getArchitectAgent,
  getStylistAgent,
  getSecurityAgent,
  getAccessibilityAgent,
  getDataAgent,
} from '../../houses/codeguard/index.js';
import {
  triggerFileChangeReview,
  runFullReview,
  setReviewHooksEnabled,
  areReviewHooksEnabled,
  getReviewTriggers,
} from '../../hooks/review-hooks.js';

// ═══════════════════════════════════════════════════════════════════
// RESULT HELPERS
// ═══════════════════════════════════════════════════════════════════

function jsonResult(data: unknown): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════

export async function handleTriggerReview(args: TriggerReviewInput): Promise<MCPResult> {
  try {
    const { files, agents } = args;
    
    // Create a file change event
    const event = {
      files,
      changeType: 'modify' as const,
      timestamp: Date.now(),
    };
    
    // Trigger review with specified agents or all agents
    const results = await triggerFileChangeReview(event, agents);
    
    // Summarize results
    const summary = {
      filesReviewed: files.length,
      agentsRun: results.length,
      passed: results.every(r => r.passed),
      results: results.map(r => ({
        agent: r.agent,
        passed: r.passed,
        blockers: r.blockers.length,
        warnings: r.warnings.length,
        summary: r.summary,
      })),
    };
    
    return jsonResult(summary);
  } catch (err) {
    return errorResult(`Review trigger failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleRunFullReview(args: { files: string[] }): Promise<MCPResult> {
  try {
    const results = await runFullReview(args.files);
    
    // Aggregate results
    const totalBlockers = results.reduce((sum, r) => sum + r.blockers.length, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
    const allPassed = results.every(r => r.passed);
    
    return jsonResult({
      filesReviewed: args.files.length,
      agentsRun: results.length,
      passed: allPassed,
      totalBlockers,
      totalWarnings,
      results: results.map(r => ({
        agent: r.agent,
        passed: r.passed,
        blockers: r.blockers,
        warnings: r.warnings,
        summary: r.summary,
      })),
    });
  } catch (err) {
    return errorResult(`Full review failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleGetHooksConfig(): Promise<MCPResult> {
  try {
    const enabled = await areReviewHooksEnabled();
    const triggers = getReviewTriggers();
    
    return jsonResult({
      enabled,
      triggers: triggers.map(t => ({
        agent: t.agent,
        condition: t.condition,
        filePatterns: t.filePatterns,
        enabled: t.enabled,
      })),
    });
  } catch (err) {
    return errorResult(`Failed to get hooks config: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleSetHooksEnabled(args: { enabled: boolean }): Promise<MCPResult> {
  try {
    await setReviewHooksEnabled(args.enabled);
    
    return jsonResult({
      success: true,
      enabled: args.enabled,
      message: args.enabled ? 'Review hooks enabled' : 'Review hooks disabled',
    });
  } catch (err) {
    return errorResult(`Failed to set hooks enabled: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER REGISTRY
// ═══════════════════════════════════════════════════════════════════

export const HOOKS_HANDLERS: Record<string, (args: unknown) => Promise<MCPResult>> = {
  trigger_review: handleTriggerReview as (args: unknown) => Promise<MCPResult>,
  run_full_review: handleRunFullReview as (args: unknown) => Promise<MCPResult>,
  get_hooks_config: handleGetHooksConfig,
  set_hooks_enabled: handleSetHooksEnabled as (args: unknown) => Promise<MCPResult>,
};
