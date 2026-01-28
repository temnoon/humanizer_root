/**
 * Media Tool Handlers
 *
 * Tool handlers for media and transcription operations.
 * Provides media listing, transcription jobs, and version management.
 *
 * @module @humanizer/core/aui/tools/media-tools
 */

import type { ToolResult } from '../types.js';
import type { ToolRegistration, ToolHandler } from '../tool-registry.js';
import type { TranscriptionMethods } from '../service/transcription.js';
import { MEDIA_TOOLS } from '../tool-definitions.js';

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create media/transcription tool handlers
 */
export function createMediaToolHandlers(
  transcription: TranscriptionMethods
): ToolRegistration[] {
  const handlers: Record<string, ToolHandler> = {
    // ─────────────────────────────────────────────────────────────────────────
    // MEDIA LISTING (stub - requires media store integration)
    // ─────────────────────────────────────────────────────────────────────────

    media_list: async (args) => {
      // Media listing requires integration with media storage
      // For now, return a stub response indicating the tool exists
      return {
        success: true,
        data: {
          archiveId: args.archiveId,
          type: args.type ?? 'all',
          message: 'Media listing requires media store integration',
          items: [],
        },
      };
    },

    media_get: async (args) => {
      return {
        success: false,
        error: 'Media get requires media store integration',
        data: { mediaId: args.mediaId },
      };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // TRANSCRIPTION JOBS
    // ─────────────────────────────────────────────────────────────────────────

    transcribe_start: async (args) => {
      const result = await transcription.startTranscription(
        {
          mediaId: args.mediaId as string,
          archiveId: args.archiveId as string,
          type: args.type as 'audio' | 'ocr' | 'caption' | 'description',
          modelId: args.modelId as string | undefined,
          priority: args.priority as 'low' | 'normal' | 'high' | undefined,
        },
        {
          id: (args.modelId as string) ?? 'whisper-large-v3',
          provider: 'ollama',
        }
      );

      return {
        success: true,
        data: {
          jobId: result.job.id,
          versionId: result.versionId,
          status: result.job.status,
          type: args.type,
          mediaId: args.mediaId,
        },
      };
    },

    transcribe_status: async (args) => {
      const job = await transcription.getJob(args.jobId as string);

      if (!job) {
        return { success: false, error: `Job "${args.jobId}" not found` };
      }

      return {
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          type: job.type,
          mediaId: job.mediaId,
          archiveId: job.archiveId,
          progress: job.progress,
          queuedAt: job.queuedAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
        },
      };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // TRANSCRIPTION VERSIONS
    // ─────────────────────────────────────────────────────────────────────────

    transcription_list: async (args) => {
      const versions = await transcription.getVersionsForMedia(
        args.mediaId as string,
        args.archiveId as string
      );

      return {
        success: true,
        data: versions.map(v => ({
          id: v.id,
          type: v.type,
          status: v.status,
          versionNumber: v.versionNumber,
          isPreferred: v.isPreferred,
          model: v.model,
          wordCount: v.quality.wordCount,
          language: v.quality.language,
          createdAt: v.createdAt,
        })),
      };
    },

    transcription_get: async (args) => {
      const version = await transcription.getVersion(args.versionId as string);

      if (!version) {
        return { success: false, error: `Version "${args.versionId}" not found` };
      }

      return {
        success: true,
        data: {
          id: version.id,
          type: version.type,
          status: version.status,
          text: version.text,
          segments: version.segments,
          model: version.model,
          quality: version.quality,
          versionNumber: version.versionNumber,
          isPreferred: version.isPreferred,
          createdAt: version.createdAt,
          completedAt: version.completedAt,
          processingDurationMs: version.processingDurationMs,
        },
      };
    },

    transcription_set_preferred: async (args) => {
      const result = await transcription.setPreferredVersion(args.versionId as string);

      return {
        success: result.success,
        data: result.success ? {
          versionId: args.versionId,
          previousPreferredId: result.previousPreferredId,
          newPreferredId: result.newPreferredId,
        } : undefined,
      };
    },

    transcription_summary: async (args) => {
      const summary = await transcription.getSummary(
        args.mediaId as string,
        args.archiveId as string
      );

      if (!summary) {
        return {
          success: true,
          data: {
            mediaId: args.mediaId,
            archiveId: args.archiveId,
            totalVersions: 0,
            hasPreferred: false,
          },
        };
      }

      return {
        success: true,
        data: summary,
      };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // DESTRUCTIVE
    // ─────────────────────────────────────────────────────────────────────────

    transcription_delete: async (args) => {
      const deleted = await transcription.deleteVersion(args.versionId as string);

      return {
        success: deleted,
        data: deleted ? { deleted: args.versionId } : undefined,
        error: deleted ? undefined : `Version "${args.versionId}" not found`,
      };
    },
  };

  // Build registrations from definitions
  return MEDIA_TOOLS.map(def => ({
    definition: def,
    handler: handlers[def.name],
    category: 'media' as const,
  })).filter(reg => reg.handler !== undefined);
}
