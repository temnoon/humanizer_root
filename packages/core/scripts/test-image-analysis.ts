#!/usr/bin/env npx tsx
/**
 * Test script for ImageAnalysisService
 *
 * This script validates the Ollama vision model integration:
 * 1. Checks if Ollama is running
 * 2. Checks for vision-capable models
 * 3. Tests OCR on a sample image (if provided)
 *
 * Usage:
 *   npx tsx scripts/test-image-analysis.ts [image-file]
 *
 * Prerequisites:
 *   1. Ollama running: ollama serve
 *   2. Vision model installed: ollama pull llava:7b
 */

import {
  ImageAnalysisService,
  SUPPORTED_IMAGE_FORMATS,
} from '../src/services/image-analysis-service.js';
import { getModelRegistry, initModelRegistry } from '../src/models/index.js';
import { existsSync } from 'fs';

// ═══════════════════════════════════════════════════════════════════
// TEST UTILITIES
// ═══════════════════════════════════════════════════════════════════

function log(level: 'info' | 'success' | 'warn' | 'error', message: string): void {
  const icons = {
    info: '\x1b[34mℹ\x1b[0m',
    success: '\x1b[32m✓\x1b[0m',
    warn: '\x1b[33m⚠\x1b[0m',
    error: '\x1b[31m✗\x1b[0m',
  };
  console.log(`${icons[level]} ${message}`);
}

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

async function testOllamaConnection(): Promise<boolean> {
  console.log('\n=== Testing Ollama Connection ===\n');

  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) {
      log('error', `Ollama API returned status ${response.status}`);
      return false;
    }

    const data = (await response.json()) as { models?: Array<{ name: string }> };
    const models = data.models || [];

    log('success', `Ollama is running with ${models.length} models installed`);

    if (models.length > 0) {
      console.log('\nInstalled models:');
      for (const model of models) {
        const isVision = ['llava', 'bakllava', 'moondream'].some((v) =>
          model.name.toLowerCase().includes(v)
        );
        log(isVision ? 'success' : 'info', `  ${model.name}${isVision ? ' (vision)' : ''}`);
      }
    }

    return true;
  } catch (error) {
    log('error', `Cannot connect to Ollama: ${(error as Error).message}`);
    log('info', 'Start Ollama with: ollama serve');
    return false;
  }
}

async function testVisionModels(): Promise<string | null> {
  console.log('\n=== Testing Vision Model Availability ===\n');

  // Initialize model registry
  initModelRegistry();
  const registry = getModelRegistry();

  // Get vision-capable models
  const visionModels = await registry.getForCapability('vision');
  const localVisionModels = visionModels.filter((m) => m.provider === 'ollama');

  console.log(`Registry has ${localVisionModels.length} local vision models:`);
  for (const model of localVisionModels) {
    console.log(`  - ${model.id}: ${model.description}`);
  }

  // Check which are actually installed
  const service = new ImageAnalysisService();
  const availability = await service.checkModelAvailability();

  if (availability.available) {
    log('success', `Vision model available: ${availability.model}`);
    return availability.model!;
  } else {
    log('error', availability.error || 'No vision model available');
    return null;
  }
}

async function testSupportedFormats(): Promise<void> {
  console.log('\n=== Supported Image Formats ===\n');

  console.log('Supported formats:', SUPPORTED_IMAGE_FORMATS.join(', '));

  const testFiles = [
    'screenshot.png',
    'photo.jpg',
    'document.pdf',
    'video.mp4',
    'image.webp',
  ];

  console.log('\nFormat detection:');
  for (const file of testFiles) {
    const supported = ImageAnalysisService.isSupported(file);
    log(supported ? 'success' : 'warn', `  ${file}: ${supported ? 'Supported' : 'Not supported'}`);
  }
}

async function testOcr(service: ImageAnalysisService, imagePath: string): Promise<void> {
  console.log('\n=== Testing OCR (Text Extraction) ===\n');

  log('info', `Image: ${imagePath}`);

  try {
    const startTime = Date.now();
    const result = await service.extractText(imagePath);
    const totalTime = Date.now() - startTime;

    log('success', `OCR completed in ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`\nModel: ${result.model}`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`Processing time: ${(result.processingTimeMs / 1000).toFixed(1)}s`);

    console.log('\n--- Extracted Text ---\n');
    console.log(result.text || '[No text detected]');
  } catch (error) {
    log('error', `OCR failed: ${(error as Error).message}`);
  }
}

async function testDescription(service: ImageAnalysisService, imagePath: string): Promise<void> {
  console.log('\n=== Testing Image Description ===\n');

  log('info', `Image: ${imagePath}`);

  try {
    const startTime = Date.now();
    const result = await service.describeImage(imagePath);
    const totalTime = Date.now() - startTime;

    log('success', `Description generated in ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`\nModel: ${result.model}`);
    console.log(`Processing time: ${(result.processingTimeMs / 1000).toFixed(1)}s`);

    console.log('\n--- Description ---\n');
    console.log(result.description);

    console.log('\n--- Summary (Alt-text) ---\n');
    console.log(result.summary);

    if (result.elements && result.elements.length > 0) {
      console.log('\n--- Elements Detected ---\n');
      console.log(result.elements.join(', '));
    }
  } catch (error) {
    log('error', `Description failed: ${(error as Error).message}`);
  }
}

async function testCombinedAnalysis(service: ImageAnalysisService, imagePath: string): Promise<void> {
  console.log('\n=== Testing Combined Analysis ===\n');

  log('info', `Image: ${imagePath}`);

  try {
    const startTime = Date.now();
    const result = await service.analyze(imagePath, {
      extractText: true,
      generateDescription: true,
    });
    const totalTime = Date.now() - startTime;

    log('success', `Combined analysis completed in ${(totalTime / 1000).toFixed(1)}s`);

    console.log('\n--- Metadata ---');
    console.log(`  Filename: ${result.metadata.filename}`);
    console.log(`  Format: ${result.metadata.format}`);
    console.log(`  Size: ${(result.metadata.sizeBytes / 1024).toFixed(1)} KB`);

    if (result.text) {
      console.log('\n--- OCR Result ---');
      console.log(`  Confidence: ${(result.text.confidence * 100).toFixed(0)}%`);
      console.log(`  Text: ${result.text.text?.slice(0, 100)}${result.text.text && result.text.text.length > 100 ? '...' : ''}`);
    }

    if (result.description) {
      console.log('\n--- Description Result ---');
      console.log(`  Summary: ${result.description.summary}`);
    }
  } catch (error) {
    log('error', `Combined analysis failed: ${(error as Error).message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║            Image Analysis Service Test Suite                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  const imagePath = process.argv[2];

  // Test format detection
  await testSupportedFormats();

  // Test Ollama connection
  const ollamaRunning = await testOllamaConnection();
  if (!ollamaRunning) {
    console.log('\n--- Setup Instructions ---\n');
    console.log('1. Install Ollama: https://ollama.com/download');
    console.log('2. Start Ollama: ollama serve');
    console.log('3. Install a vision model: ollama pull llava:7b');
    console.log('4. Run this test again with an image: npx tsx scripts/test-image-analysis.ts image.png');
    process.exit(1);
  }

  // Test vision models
  const availableModel = await testVisionModels();
  if (!availableModel) {
    console.log('\n--- Setup Instructions ---\n');
    console.log('Install a vision model with one of these commands:');
    console.log('  ollama pull llava:7b       # Good balance (4GB RAM)');
    console.log('  ollama pull llava:13b      # Better quality (8GB RAM)');
    console.log('  ollama pull moondream      # Lightweight (2GB RAM)');
    process.exit(1);
  }

  // Run image tests if path provided
  if (imagePath) {
    if (!existsSync(imagePath)) {
      log('error', `Image file not found: ${imagePath}`);
      process.exit(1);
    }

    if (!ImageAnalysisService.isSupported(imagePath)) {
      log('error', `Unsupported image format: ${imagePath}`);
      process.exit(1);
    }

    const service = new ImageAnalysisService({ defaultModel: availableModel });

    // Run all tests
    await testOcr(service, imagePath);
    await testDescription(service, imagePath);
    await testCombinedAnalysis(service, imagePath);
  } else {
    console.log('\n--- Test with Image ---\n');
    log('info', 'No image file provided. To test OCR and description:');
    console.log('   npx tsx scripts/test-image-analysis.ts path/to/image.png');
  }

  console.log('\n=== Tests Complete ===\n');
}

main().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
