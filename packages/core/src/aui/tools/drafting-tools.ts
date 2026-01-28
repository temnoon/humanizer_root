/**
 * Drafting Tool Handlers
 *
 * Tool handlers for the drafting subsystem.
 * Provides iterative content creation from multiple sources.
 *
 * @module @humanizer/core/aui/tools/drafting-tools
 */

import type { ToolResult } from '../types.js';
import type { ToolRegistration, ToolHandler } from '../tool-registry.js';
import type { DraftingMethods } from '../service/drafting.js';
import { DRAFTING_TOOLS } from '../tool-definitions.js';

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create drafting tool handlers bound to DraftingMethods
 */
export function createDraftingToolHandlers(
  drafting: DraftingMethods
): ToolRegistration[] {
  const handlers: Record<string, ToolHandler> = {
    // ─────────────────────────────────────────────────────────────────────────
    // SESSION LIFECYCLE
    // ─────────────────────────────────────────────────────────────────────────

    draft_start: async (args) => {
      const session = await drafting.startDrafting({
        title: args.title as string,
        sources: args.sources as any[],
        narratorPersonaId: args.narratorPersonaId as string | undefined,
        userId: args.userId as string | undefined,
      });

      return {
        success: true,
        data: {
          sessionId: session.id,
          title: session.title,
          status: session.status,
          sourceCount: session.sources.length,
        },
      };
    },

    draft_gather: async (args) => {
      const result = await drafting.gatherMaterial(args.sessionId as string);

      return {
        success: true,
        data: {
          passageCount: result.passages.length,
          sourceStats: result.sourceStats,
          durationMs: result.totalDurationMs,
        },
      };
    },

    draft_generate: async (args) => {
      const version = await drafting.generateDraft(
        args.sessionId as string,
        {
          targetWordCount: args.targetWordCount as number | undefined,
          guidance: args.guidance as string | undefined,
          focusPassageIds: args.focusPassageIds as string[] | undefined,
        }
      );

      return {
        success: true,
        data: {
          version: version.version,
          wordCount: version.wordCount,
          contentPreview: version.content.substring(0, 500) + '...',
          generationMs: version.generationMs,
        },
      };
    },

    draft_revise: async (args) => {
      const version = await drafting.reviseDraft(
        args.sessionId as string,
        {
          feedback: {
            text: args.feedback as string,
            sectionsToRevise: args.sectionsToRevise as string[] | undefined,
            toneAdjustments: args.toneAdjustments as string[] | undefined,
            addContent: args.addContent as string[] | undefined,
            removeContent: args.removeContent as string[] | undefined,
          },
          targetWordCount: args.targetWordCount as number | undefined,
        }
      );

      return {
        success: true,
        data: {
          version: version.version,
          wordCount: version.wordCount,
          changesSummary: version.changesSummary,
          generationMs: version.generationMs,
        },
      };
    },

    draft_finalize: async (args) => {
      const formats = (args.formats as string[]) ?? ['markdown', 'html'];
      const artifacts = await drafting.finalizeDraft(
        args.sessionId as string,
        {
          formats: formats as ('markdown' | 'html' | 'json')[],
          outputDir: args.outputDir as string | undefined,
        }
      );

      return {
        success: true,
        data: {
          exportCount: artifacts.length,
          exports: artifacts.map(a => ({
            format: a.format,
            sizeBytes: a.sizeBytes,
            filePath: a.filePath,
          })),
        },
      };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SESSION QUERIES
    // ─────────────────────────────────────────────────────────────────────────

    draft_get: async (args) => {
      const session = drafting.getDraftingSession(args.sessionId as string);

      if (!session) {
        return { success: false, error: `Session "${args.sessionId}" not found` };
      }

      return {
        success: true,
        data: {
          id: session.id,
          title: session.title,
          status: session.status,
          currentVersion: session.currentVersion,
          versionCount: session.versions.length,
          passageCount: session.gatheredMaterial?.passages.length ?? 0,
          createdAt: session.metadata.createdAt,
          updatedAt: session.metadata.updatedAt,
        },
      };
    },

    draft_list: async (args) => {
      const sessions = drafting.listDraftingSessions({
        userId: args.userId as string | undefined,
        status: args.status as any | undefined,
        limit: args.limit as number | undefined,
      });

      return {
        success: true,
        data: sessions.map(s => ({
          id: s.id,
          title: s.title,
          status: s.status,
          currentVersion: s.currentVersion,
          updatedAt: s.metadata.updatedAt,
        })),
      };
    },

    draft_version: async (args) => {
      const version = drafting.getDraftVersion(
        args.sessionId as string,
        args.version as number
      );

      if (!version) {
        return {
          success: false,
          error: `Version ${args.version} not found in session "${args.sessionId}"`,
        };
      }

      return {
        success: true,
        data: {
          version: version.version,
          wordCount: version.wordCount,
          content: version.content,
          createdAt: version.createdAt,
          feedbackApplied: version.feedbackApplied?.text,
          changesSummary: version.changesSummary,
        },
      };
    },

    draft_compare: async (args) => {
      const comparison = drafting.compareDraftVersions(
        args.sessionId as string,
        args.fromVersion as number,
        args.toVersion as number
      );

      if (!comparison) {
        return {
          success: false,
          error: `Could not compare versions ${args.fromVersion} and ${args.toVersion}`,
        };
      }

      return {
        success: true,
        data: comparison,
      };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // DESTRUCTIVE
    // ─────────────────────────────────────────────────────────────────────────

    draft_delete: async (args) => {
      const deleted = drafting.deleteDraftingSession(args.sessionId as string);

      return {
        success: deleted,
        data: deleted ? { deleted: args.sessionId } : undefined,
        error: deleted ? undefined : `Session "${args.sessionId}" not found`,
      };
    },
  };

  // Build registrations from definitions
  return DRAFTING_TOOLS.map(def => ({
    definition: def,
    handler: handlers[def.name],
    category: 'drafting' as const,
  })).filter(reg => reg.handler !== undefined);
}
