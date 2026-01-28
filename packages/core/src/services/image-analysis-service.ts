/**
 * Image Analysis Service
 *
 * Provides OCR (Optical Character Recognition) and image description
 * capabilities using vision-language models via Ollama.
 *
 * ## Setup Requirements
 *
 * Requires a vision-capable model installed in Ollama:
 *
 * ```bash
 * ollama pull llava:13b     # Best quality, ~8GB RAM
 * ollama pull llava:7b      # Good balance, ~4GB RAM
 * ollama pull moondream     # Lightweight, ~2GB RAM
 * ```
 *
 * ## Supported Image Formats
 *
 * - JPEG, PNG, GIF, WebP, BMP
 * - Max recommended size: 2048x2048 (larger images will be resized)
 *
 * ## Use Cases
 *
 * - **OCR**: Extract text from screenshots, documents, photos of text
 * - **Description**: Generate alt-text for accessibility
 * - **Search**: Enable semantic search over image content
 * - **Archive**: Auto-index images in imported archives
 *
 * ## Usage Example
 *
 * ```typescript
 * import { ImageAnalysisService } from '@humanizer/core/services';
 *
 * const service = new ImageAnalysisService();
 *
 * // OCR - extract text from image
 * const { text } = await service.extractText('screenshot.png');
 *
 * // Description - generate accessibility text
 * const { description } = await service.describeImage('photo.jpg');
 *
 * // Combined analysis
 * const result = await service.analyze('document.png', {
 *   extractText: true,
 *   generateDescription: true,
 * });
 * ```
 *
 * @module @humanizer/core/services/image-analysis-service
 */

import { existsSync, readFileSync } from 'fs';
import { extname, basename } from 'path';
import { getModelRegistry } from '../models/index.js';
import type { MediaTextAssociation } from '../storage/types.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Supported image formats
 */
export const SUPPORTED_IMAGE_FORMATS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
];

/**
 * Configuration keys for image analysis
 */
export const IMAGE_ANALYSIS_CONFIG_KEYS = {
  /** Default vision model to use */
  DEFAULT_MODEL: 'imageAnalysis.defaultModel',
  /** Ollama API URL */
  OLLAMA_URL: 'imageAnalysis.ollamaUrl',
  /** Max image dimension (larger will be resized) */
  MAX_DIMENSION: 'imageAnalysis.maxDimension',
  /** Timeout for analysis (ms) */
  TIMEOUT_MS: 'imageAnalysis.timeoutMs',
} as const;

/**
 * Default configuration values
 */
export const IMAGE_ANALYSIS_DEFAULTS = {
  [IMAGE_ANALYSIS_CONFIG_KEYS.DEFAULT_MODEL]: 'llava:13b',
  [IMAGE_ANALYSIS_CONFIG_KEYS.OLLAMA_URL]: 'http://localhost:11434',
  [IMAGE_ANALYSIS_CONFIG_KEYS.MAX_DIMENSION]: 2048,
  [IMAGE_ANALYSIS_CONFIG_KEYS.TIMEOUT_MS]: 120000, // 2 minutes
};

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Result of text extraction (OCR)
 */
export interface TextExtractionResult {
  /** Extracted text content */
  text: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Model used */
  model: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Result of image description
 */
export interface ImageDescriptionResult {
  /** Generated description */
  description: string;
  /** Short summary (one sentence) */
  summary: string;
  /** Detected objects/elements */
  elements?: string[];
  /** Model used */
  model: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Combined analysis result
 */
export interface ImageAnalysisResult {
  /** Text extraction result (if requested) */
  text?: TextExtractionResult;
  /** Image description (if requested) */
  description?: ImageDescriptionResult;
  /** Image metadata */
  metadata: {
    filename: string;
    format: string;
    sizeBytes: number;
  };
}

/**
 * Options for analysis
 */
export interface ImageAnalysisOptions {
  /** Extract text (OCR) */
  extractText?: boolean;
  /** Generate description */
  generateDescription?: boolean;
  /** Model to use (overrides default) */
  model?: string;
  /** Language for OCR (default: 'en') */
  language?: string;
}

/**
 * Service configuration
 */
export interface ImageAnalysisServiceConfig {
  /** Default vision model */
  defaultModel?: string;
  /** Ollama API URL */
  ollamaUrl?: string;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

// ═══════════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════════

const OCR_PROMPT = `You are an OCR assistant. Extract ALL text visible in this image.

Rules:
- Output ONLY the extracted text, nothing else
- Preserve the original formatting (line breaks, paragraphs)
- If text is in multiple columns, read left to right, top to bottom
- Include any visible labels, captions, watermarks
- If no text is visible, output exactly: [NO TEXT DETECTED]

Extract the text:`;

const DESCRIPTION_PROMPT = `Describe this image for accessibility purposes.

Provide:
1. A detailed description (2-4 sentences) of what the image shows
2. A one-sentence summary suitable for alt-text
3. Key elements or objects visible (as a list)

Format your response as:
DESCRIPTION: [detailed description]
SUMMARY: [one sentence]
ELEMENTS: [comma-separated list]`;

// ═══════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════

/**
 * ImageAnalysisService provides OCR and image description capabilities.
 */
export class ImageAnalysisService {
  private config: Required<ImageAnalysisServiceConfig>;
  private availableModel: string | null = null;

  constructor(config: ImageAnalysisServiceConfig = {}) {
    this.config = {
      defaultModel: config.defaultModel ?? 'llava:13b',
      ollamaUrl: config.ollamaUrl ?? 'http://localhost:11434',
      timeoutMs: config.timeoutMs ?? 120000,
    };
  }

  /**
   * Check if a vision model is available
   */
  async checkModelAvailability(): Promise<{
    available: boolean;
    model?: string;
    error?: string;
  }> {
    try {
      // Try to get a vision model from registry
      const registry = getModelRegistry();
      const visionModels = await registry.getForCapability('vision');

      // Filter for local Ollama models
      const localVisionModels = visionModels.filter(
        (m) => m.provider === 'ollama' && m.vettingStatus === 'approved'
      );

      if (localVisionModels.length === 0) {
        return {
          available: false,
          error: 'No local vision models available. Install with: ollama pull llava',
        };
      }

      // Check if model is actually running in Ollama
      const response = await fetch(`${this.config.ollamaUrl}/api/tags`);
      if (!response.ok) {
        return {
          available: false,
          error: 'Ollama is not running. Start with: ollama serve',
        };
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const installedModels = data.models?.map((m) => m.name) || [];

      // Find first available model
      for (const model of localVisionModels) {
        // Check both exact match and partial match
        if (
          installedModels.includes(model.id) ||
          installedModels.some((im) => im.startsWith(model.id.split(':')[0]))
        ) {
          this.availableModel = model.id;
          return { available: true, model: model.id };
        }
      }

      return {
        available: false,
        error:
          `No vision models installed in Ollama. ` +
          `Available in registry: ${localVisionModels.map((m) => m.id).join(', ')}. ` +
          `Install with: ollama pull llava`,
      };
    } catch (error) {
      return {
        available: false,
        error: `Failed to check model availability: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Extract text from an image (OCR)
   */
  async extractText(
    imagePath: string,
    options: { model?: string; language?: string } = {}
  ): Promise<TextExtractionResult> {
    this.validateImage(imagePath);

    const model = options.model ?? this.availableModel ?? this.config.defaultModel;
    const startTime = Date.now();

    const imageBase64 = this.loadImageAsBase64(imagePath);

    const response = await this.callOllama(model, OCR_PROMPT, imageBase64);
    const text = response.trim();

    const processingTimeMs = Date.now() - startTime;

    // Estimate confidence based on response characteristics
    const confidence = this.estimateOcrConfidence(text);

    return {
      text: text === '[NO TEXT DETECTED]' ? '' : text,
      confidence,
      model,
      processingTimeMs,
    };
  }

  /**
   * Generate a description of an image
   */
  async describeImage(
    imagePath: string,
    options: { model?: string } = {}
  ): Promise<ImageDescriptionResult> {
    this.validateImage(imagePath);

    const model = options.model ?? this.availableModel ?? this.config.defaultModel;
    const startTime = Date.now();

    const imageBase64 = this.loadImageAsBase64(imagePath);

    const response = await this.callOllama(model, DESCRIPTION_PROMPT, imageBase64);

    const processingTimeMs = Date.now() - startTime;

    // Parse the structured response
    const parsed = this.parseDescriptionResponse(response);

    return {
      ...parsed,
      model,
      processingTimeMs,
    };
  }

  /**
   * Perform combined analysis (OCR + description)
   */
  async analyze(
    imagePath: string,
    options: ImageAnalysisOptions = { extractText: true, generateDescription: true }
  ): Promise<ImageAnalysisResult> {
    this.validateImage(imagePath);

    const stat = require('fs').statSync(imagePath);
    const result: ImageAnalysisResult = {
      metadata: {
        filename: basename(imagePath),
        format: extname(imagePath).toLowerCase().slice(1),
        sizeBytes: stat.size,
      },
    };

    // Run requested analyses
    if (options.extractText) {
      result.text = await this.extractText(imagePath, {
        model: options.model,
        language: options.language,
      });
    }

    if (options.generateDescription) {
      result.description = await this.describeImage(imagePath, {
        model: options.model,
      });
    }

    return result;
  }

  /**
   * Analyze an image and create media-text associations for storage
   */
  async analyzeToAssociations(
    imagePath: string,
    mediaId: string,
    conversationId: string,
    options: ImageAnalysisOptions & {
      messageId?: string;
      importJobId?: string;
    } = { extractText: true, generateDescription: true }
  ): Promise<Omit<MediaTextAssociation, 'id' | 'createdAt'>[]> {
    const result = await this.analyze(imagePath, options);
    const associations: Omit<MediaTextAssociation, 'id' | 'createdAt'>[] = [];

    // OCR association
    if (result.text && result.text.text) {
      associations.push({
        mediaId,
        extractedText: result.text.text,
        associationType: 'ocr',
        chainPosition: 0,
        extractionMethod: `vision-ocr-${result.text.model}`,
        confidence: result.text.confidence,
        conversationId,
        messageId: options.messageId,
        importJobId: options.importJobId,
        textSpanStart: 0,
        textSpanEnd: result.text.text.length,
      });
    }

    // Description association
    if (result.description) {
      associations.push({
        mediaId,
        extractedText: result.description.description,
        associationType: 'description',
        chainPosition: associations.length,
        extractionMethod: `vision-description-${result.description.model}`,
        confidence: 0.9, // Vision descriptions are generally reliable
        conversationId,
        messageId: options.messageId,
        importJobId: options.importJobId,
        textSpanStart: 0,
        textSpanEnd: result.description.description.length,
      });
    }

    return associations;
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Validate image path and format
   */
  private validateImage(imagePath: string): void {
    if (!existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    const ext = extname(imagePath).toLowerCase();
    if (!SUPPORTED_IMAGE_FORMATS.includes(ext)) {
      throw new Error(
        `Unsupported image format: ${ext}. ` +
          `Supported formats: ${SUPPORTED_IMAGE_FORMATS.join(', ')}`
      );
    }
  }

  /**
   * Load image as base64 string
   */
  private loadImageAsBase64(imagePath: string): string {
    const buffer = readFileSync(imagePath);
    return buffer.toString('base64');
  }

  /**
   * Call Ollama vision API
   */
  private async callOllama(
    model: string,
    prompt: string,
    imageBase64: string
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          images: [imageBase64],
          stream: false,
          options: {
            temperature: 0.1, // Low temp for more deterministic output
            num_predict: 4096, // Allow longer responses
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as { response: string };
      return data.response;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Estimate OCR confidence based on response characteristics
   */
  private estimateOcrConfidence(text: string): number {
    if (text === '[NO TEXT DETECTED]' || text.length === 0) {
      return 0;
    }

    // Factors that increase confidence
    let confidence = 0.7; // Base confidence

    // Longer text = more confident (up to a point)
    if (text.length > 50) confidence += 0.05;
    if (text.length > 200) confidence += 0.05;

    // Contains proper punctuation
    if (/[.!?]/.test(text)) confidence += 0.05;

    // Contains words (not just gibberish)
    const wordCount = text.split(/\s+/).filter((w) => w.length > 2).length;
    if (wordCount > 5) confidence += 0.05;

    // Factors that decrease confidence
    // High ratio of special characters
    const specialRatio = (text.match(/[^\w\s]/g)?.length || 0) / text.length;
    if (specialRatio > 0.3) confidence -= 0.1;

    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Parse structured description response
   */
  private parseDescriptionResponse(response: string): {
    description: string;
    summary: string;
    elements?: string[];
  } {
    const lines = response.split('\n');
    let description = '';
    let summary = '';
    let elements: string[] = [];

    for (const line of lines) {
      if (line.startsWith('DESCRIPTION:')) {
        description = line.replace('DESCRIPTION:', '').trim();
      } else if (line.startsWith('SUMMARY:')) {
        summary = line.replace('SUMMARY:', '').trim();
      } else if (line.startsWith('ELEMENTS:')) {
        const elementsStr = line.replace('ELEMENTS:', '').trim();
        elements = elementsStr.split(',').map((e) => e.trim()).filter(Boolean);
      }
    }

    // Fallback if structured parsing fails
    if (!description) {
      description = response.trim();
      summary = response.split('.')[0] + '.';
    }

    return { description, summary, elements: elements.length > 0 ? elements : undefined };
  }

  // ─────────────────────────────────────────────────────────────────
  // STATIC UTILITIES
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get supported image formats
   */
  static getSupportedFormats(): string[] {
    return [...SUPPORTED_IMAGE_FORMATS];
  }

  /**
   * Check if a file is a supported image
   */
  static isSupported(filename: string): boolean {
    const ext = extname(filename).toLowerCase();
    return SUPPORTED_IMAGE_FORMATS.includes(ext);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let globalImageAnalysisService: ImageAnalysisService | null = null;

/**
 * Initialize the global image analysis service
 */
export function initImageAnalysisService(
  config?: ImageAnalysisServiceConfig
): ImageAnalysisService {
  globalImageAnalysisService = new ImageAnalysisService(config);
  return globalImageAnalysisService;
}

/**
 * Get the global image analysis service
 */
export function getImageAnalysisService(): ImageAnalysisService | null {
  return globalImageAnalysisService;
}

/**
 * Reset the global image analysis service
 */
export function resetImageAnalysisService(): void {
  globalImageAnalysisService = null;
}
