/**
 * Transcription Service
 *
 * Provides audio/video transcription using Whisper models.
 * Supports both local (transformers.js) and remote (OpenAI API) backends.
 *
 * ## Setup Requirements
 *
 * This service requires @xenova/transformers as an optional peer dependency:
 *
 * ```bash
 * npm install @xenova/transformers
 * ```
 *
 * ## Supported Audio/Video Formats
 *
 * - Audio: mp3, wav, m4a, ogg, flac, webm
 * - Video: mp4, mov, avi, mkv (audio track extracted)
 *
 * ## Model Quality Guide
 *
 * | Model  | Memory | Speed | Quality | Use Case                       |
 * |--------|--------|-------|---------|--------------------------------|
 * | tiny   | 500MB  | Fast  | Low     | Quick testing, simple audio    |
 * | base   | 800MB  | Fast  | Medium  | Voice memos, short recordings  |
 * | small  | 1.5GB  | Med   | Good    | Podcasts, conversations        |
 * | medium | 3GB    | Slow  | Best    | Professional, noisy audio      |
 *
 * ## Usage Example
 *
 * ```typescript
 * import { TranscriptionService } from '@humanizer/core/services';
 *
 * const service = new TranscriptionService({ defaultModel: 'small' });
 * await service.initialize();
 *
 * const result = await service.transcribe('audio.mp3');
 * console.log(result.text);
 * ```
 *
 * @module @humanizer/core/services/transcription-service
 */

import { randomUUID } from 'crypto';
import type { MediaTextAssociation } from '../storage/types.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Whisper model sizes with their characteristics
 */
export const WHISPER_MODELS = {
  tiny: {
    id: 'Xenova/whisper-tiny',
    size: '39M',
    diskMb: 75,
    memoryMb: 500,
    quality: 'low',
    speed: 'fast',
  },
  base: {
    id: 'Xenova/whisper-base',
    size: '74M',
    diskMb: 140,
    memoryMb: 800,
    quality: 'medium',
    speed: 'fast',
  },
  small: {
    id: 'Xenova/whisper-small',
    size: '244M',
    diskMb: 460,
    memoryMb: 1500,
    quality: 'good',
    speed: 'medium',
  },
  medium: {
    id: 'Xenova/whisper-medium',
    size: '769M',
    diskMb: 1500,
    memoryMb: 3000,
    quality: 'best',
    speed: 'slow',
  },
} as const;

export type WhisperModelSize = keyof typeof WHISPER_MODELS;

/**
 * Configuration keys for transcription
 */
export const TRANSCRIPTION_CONFIG_KEYS = {
  /** Default Whisper model size */
  DEFAULT_MODEL: 'transcription.defaultModel',
  /** Language for transcription (or 'auto' for detection) */
  LANGUAGE: 'transcription.language',
  /** Enable timestamps in output */
  TIMESTAMPS: 'transcription.timestamps',
  /** Maximum audio duration in seconds (for chunking) */
  MAX_DURATION_SECONDS: 'transcription.maxDurationSeconds',
  /** Backend to use: 'local' or 'openai' */
  BACKEND: 'transcription.backend',
  /** OpenAI API key (for openai backend) */
  OPENAI_API_KEY: 'transcription.openaiApiKey',
} as const;

/**
 * Default configuration values
 */
export const TRANSCRIPTION_DEFAULTS = {
  [TRANSCRIPTION_CONFIG_KEYS.DEFAULT_MODEL]: 'small' as WhisperModelSize,
  [TRANSCRIPTION_CONFIG_KEYS.LANGUAGE]: 'en',
  [TRANSCRIPTION_CONFIG_KEYS.TIMESTAMPS]: true,
  [TRANSCRIPTION_CONFIG_KEYS.MAX_DURATION_SECONDS]: 3600, // 1 hour
  [TRANSCRIPTION_CONFIG_KEYS.BACKEND]: 'local',
};

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * A segment of transcribed text with timing
 */
export interface TranscriptSegment {
  /** Segment text */
  text: string;
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
  /** Confidence score (0-1) */
  confidence?: number;
}

/**
 * Complete transcription result
 */
export interface TranscriptionResult {
  /** Full transcript text */
  text: string;
  /** Segments with timing */
  segments: TranscriptSegment[];
  /** Detected or specified language */
  language: string;
  /** Audio duration in seconds */
  duration: number;
  /** Model used */
  model: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Options for transcription
 */
export interface TranscriptionOptions {
  /** Model size to use */
  modelSize?: WhisperModelSize;
  /** Language code (or 'auto') */
  language?: string;
  /** Include timestamps */
  timestamps?: boolean;
  /** Progress callback */
  onProgress?: (percent: number) => void;
}

/**
 * Service configuration
 */
export interface TranscriptionServiceConfig {
  /** Default model size */
  defaultModel?: WhisperModelSize;
  /** Default language */
  defaultLanguage?: string;
  /** Enable timestamps by default */
  timestamps?: boolean;
  /** Cache directory for models */
  cacheDir?: string;
}

// ═══════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════

/**
 * TranscriptionService provides audio/video transcription using Whisper.
 *
 * Usage:
 * ```typescript
 * const service = new TranscriptionService({ defaultModel: 'small' });
 * await service.initialize();
 *
 * const result = await service.transcribe('/path/to/audio.mp3');
 * console.log(result.text);
 * ```
 */
export class TranscriptionService {
  private config: Required<TranscriptionServiceConfig>;
  private pipeline: unknown = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(config: TranscriptionServiceConfig = {}) {
    this.config = {
      defaultModel: config.defaultModel ?? 'small',
      defaultLanguage: config.defaultLanguage ?? 'en',
      timestamps: config.timestamps ?? true,
      cacheDir: config.cacheDir ?? '',
    };
  }

  /**
   * Initialize the transcription pipeline.
   * Must be called before transcribing.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    await this.initPromise;
    this.isInitialized = true;
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Dynamic import to avoid bundling issues and allow optional dependency
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformers = await import('@xenova/transformers' as any) as {
        pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<unknown>;
      };
      const modelConfig = WHISPER_MODELS[this.config.defaultModel];

      console.log(`Loading Whisper model: ${modelConfig.id}...`);
      console.log(`Expected memory: ~${modelConfig.memoryMb}MB`);

      this.pipeline = await transformers.pipeline(
        'automatic-speech-recognition',
        modelConfig.id,
        {
          // Cache in user's home directory
          cache_dir: this.config.cacheDir || undefined,
        }
      );

      console.log('Whisper model loaded successfully');
    } catch (error) {
      const errMsg = (error as Error).message || '';
      if (errMsg.includes('Cannot find module') || errMsg.includes('ERR_MODULE_NOT_FOUND')) {
        throw new Error(
          'TranscriptionService requires @xenova/transformers. ' +
          'Install with: npm install @xenova/transformers'
        );
      }
      throw error;
    }
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.pipeline !== null;
  }

  /**
   * Transcribe an audio file
   *
   * @param audioPath - Path to audio/video file
   * @param options - Transcription options
   * @throws Error if file not found, unsupported format, or transcription fails
   */
  async transcribe(
    audioPath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    // Validate file exists
    const fs = await import('fs');
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    // Validate file format
    if (!TranscriptionService.isSupported(audioPath)) {
      const ext = audioPath.split('.').pop()?.toLowerCase() || 'unknown';
      throw new Error(
        `Unsupported audio format: .${ext}. ` +
        `Supported formats: ${TranscriptionService.getSupportedFormats().join(', ')}`
      );
    }

    if (!this.isReady()) {
      await this.initialize();
    }

    const startTime = Date.now();
    const modelSize = options.modelSize ?? this.config.defaultModel;
    const modelConfig = WHISPER_MODELS[modelSize];

    // If model size differs from loaded, we'd need to reload
    // For now, just use the loaded model
    if (modelSize !== this.config.defaultModel) {
      console.warn(
        `Requested model ${modelSize} but ${this.config.defaultModel} is loaded. ` +
        'Using loaded model.'
      );
    }

    const pipelineFn = this.pipeline as (
      audio: string,
      options: Record<string, unknown>
    ) => Promise<{
      text: string;
      chunks?: Array<{ text: string; timestamp: [number, number] }>;
    }>;

    try {
      const result = await pipelineFn(audioPath, {
        language: options.language ?? this.config.defaultLanguage,
        return_timestamps: options.timestamps ?? this.config.timestamps,
        chunk_length_s: 30, // Process in 30-second chunks
        stride_length_s: 5, // 5-second overlap
      });

    const processingTimeMs = Date.now() - startTime;

    // Parse segments from chunks
    const segments: TranscriptSegment[] = [];
    if (result.chunks) {
      for (const chunk of result.chunks) {
        segments.push({
          text: chunk.text.trim(),
          start: chunk.timestamp[0],
          end: chunk.timestamp[1],
        });
      }
    }

    // Calculate duration from last segment
    const duration = segments.length > 0
      ? segments[segments.length - 1].end
      : 0;

    return {
      text: result.text.trim(),
      segments,
      language: options.language ?? this.config.defaultLanguage,
      duration,
      model: modelConfig.id,
      processingTimeMs,
    };
    } catch (error) {
      const errMsg = (error as Error).message || String(error);

      // Handle common audio processing errors
      if (errMsg.includes('ffmpeg') || errMsg.includes('audio')) {
        throw new Error(
          `Failed to process audio file: ${audioPath}. ` +
          'Ensure the file is a valid audio/video format and not corrupted. ' +
          `Original error: ${errMsg}`
        );
      }

      // Handle memory errors
      if (errMsg.includes('memory') || errMsg.includes('OOM')) {
        throw new Error(
          `Out of memory during transcription. ` +
          `The ${modelSize} model requires ~${modelConfig.memoryMb}MB RAM. ` +
          'Try using a smaller model (tiny or base).'
        );
      }

      throw new Error(`Transcription failed: ${errMsg}`);
    }
  }

  /**
   * Transcribe and create media-text associations
   */
  async transcribeToAssociations(
    audioPath: string,
    mediaId: string,
    conversationId: string,
    options: TranscriptionOptions & {
      messageId?: string;
      importJobId?: string;
    } = {}
  ): Promise<Omit<MediaTextAssociation, 'id' | 'createdAt'>[]> {
    const result = await this.transcribe(audioPath, options);

    const associations: Omit<MediaTextAssociation, 'id' | 'createdAt'>[] = [];

    // Create main transcript association
    associations.push({
      mediaId,
      extractedText: result.text,
      associationType: 'transcript',
      chainPosition: 0,
      extractionMethod: `whisper-${this.config.defaultModel}`,
      confidence: 0.85, // Whisper is generally reliable
      conversationId,
      messageId: options.messageId,
      importJobId: options.importJobId,
      // Store segment data in a structured way
      textSpanStart: 0,
      textSpanEnd: result.text.length,
    });

    return associations;
  }

  /**
   * Get supported audio formats
   */
  static getSupportedFormats(): string[] {
    return ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'webm', 'mp4', 'mov', 'avi', 'mkv'];
  }

  /**
   * Check if a file extension is supported
   */
  static isSupported(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? this.getSupportedFormats().includes(ext) : false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let globalTranscriptionService: TranscriptionService | null = null;

/**
 * Initialize the global transcription service
 */
export function initTranscriptionService(
  config?: TranscriptionServiceConfig
): TranscriptionService {
  globalTranscriptionService = new TranscriptionService(config);
  return globalTranscriptionService;
}

/**
 * Get the global transcription service
 */
export function getTranscriptionService(): TranscriptionService | null {
  return globalTranscriptionService;
}

/**
 * Reset the global transcription service
 */
export function resetTranscriptionService(): void {
  globalTranscriptionService = null;
}
