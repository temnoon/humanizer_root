/**
 * Services module
 *
 * Standalone services that can be used across the codebase.
 *
 * @module @humanizer/core/services
 */

export {
  // Types
  type TranscriptSegment,
  type TranscriptionResult,
  type TranscriptionOptions,
  type TranscriptionServiceConfig,
  type WhisperModelSize,
  // Constants
  WHISPER_MODELS,
  TRANSCRIPTION_CONFIG_KEYS,
  TRANSCRIPTION_DEFAULTS,
  // Service
  TranscriptionService,
  // Singleton
  initTranscriptionService,
  getTranscriptionService,
  resetTranscriptionService,
} from './transcription-service.js';

export {
  // Types
  type TextExtractionResult,
  type ImageDescriptionResult,
  type ImageAnalysisResult,
  type ImageAnalysisOptions,
  type ImageAnalysisServiceConfig,
  // Constants
  SUPPORTED_IMAGE_FORMATS,
  IMAGE_ANALYSIS_CONFIG_KEYS,
  IMAGE_ANALYSIS_DEFAULTS,
  // Service
  ImageAnalysisService,
  // Singleton
  initImageAnalysisService,
  getImageAnalysisService,
  resetImageAnalysisService,
} from './image-analysis-service.js';
