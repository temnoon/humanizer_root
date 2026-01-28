#!/usr/bin/env npx tsx
/**
 * Test script for TranscriptionService
 *
 * This script validates the Whisper transcription integration:
 * 1. Checks if @xenova/transformers is available
 * 2. Tests model loading (whisper-small by default)
 * 3. Tests transcription on a sample audio file (if provided)
 *
 * Usage:
 *   npx tsx scripts/test-transcription-service.ts [audio-file]
 *
 * Prerequisites:
 *   npm install @xenova/transformers
 */

import {
  TranscriptionService,
  WHISPER_MODELS,
  type WhisperModelSize,
} from '../src/services/transcription-service.js';
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

async function checkTransformersAvailable(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await import('@xenova/transformers' as any);
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

async function testModelInfo(): Promise<void> {
  console.log('\n=== Whisper Model Information ===\n');

  const models = Object.entries(WHISPER_MODELS) as [WhisperModelSize, typeof WHISPER_MODELS[WhisperModelSize]][];

  console.log('Available models:\n');
  console.log('| Model  | Size   | Disk    | Memory  | Quality | Speed  |');
  console.log('|--------|--------|---------|---------|---------|--------|');

  for (const [name, config] of models) {
    console.log(
      `| ${name.padEnd(6)} | ${config.size.padEnd(6)} | ${String(config.diskMb).padStart(4)}MB | ${String(config.memoryMb).padStart(4)}MB | ${config.quality.padEnd(7)} | ${config.speed.padEnd(6)} |`
    );
  }

  console.log('\nRecommended models:');
  log('info', 'tiny: Quick testing, low quality');
  log('info', 'small: Good balance of speed/quality (default)');
  log('info', 'medium: Best quality, requires ~3GB RAM');
}

async function testSupportedFormats(): Promise<void> {
  console.log('\n=== Supported Audio/Video Formats ===\n');

  const formats = TranscriptionService.getSupportedFormats();
  console.log('Supported formats:', formats.join(', '));

  // Test extension detection
  const testFiles = [
    'audio.mp3',
    'podcast.wav',
    'voice_memo.m4a',
    'video.mp4',
    'recording.ogg',
    'unsupported.txt',
  ];

  console.log('\nExtension detection tests:');
  for (const file of testFiles) {
    const supported = TranscriptionService.isSupported(file);
    log(supported ? 'success' : 'warn', `${file}: ${supported ? 'Supported' : 'Not supported'}`);
  }
}

async function testServiceInitialization(modelSize: WhisperModelSize = 'tiny'): Promise<TranscriptionService | null> {
  console.log(`\n=== Testing Service Initialization (${modelSize}) ===\n`);

  // Check if transformers is available
  const hasTransformers = await checkTransformersAvailable();
  if (!hasTransformers) {
    log('error', '@xenova/transformers is not installed');
    log('info', 'Install with: npm install @xenova/transformers');
    return null;
  }
  log('success', '@xenova/transformers is available');

  const modelConfig = WHISPER_MODELS[modelSize];
  log('info', `Loading ${modelSize} model (${modelConfig.id})`);
  log('info', `Expected memory usage: ~${modelConfig.memoryMb}MB`);

  try {
    const startTime = Date.now();
    const service = new TranscriptionService({ defaultModel: modelSize });
    await service.initialize();
    const loadTime = Date.now() - startTime;

    log('success', `Model loaded successfully in ${(loadTime / 1000).toFixed(1)}s`);
    log('success', `Service is ready: ${service.isReady()}`);

    return service;
  } catch (error) {
    log('error', `Failed to initialize service: ${(error as Error).message}`);
    return null;
  }
}

async function testTranscription(service: TranscriptionService, audioPath: string): Promise<void> {
  console.log('\n=== Testing Transcription ===\n');

  if (!existsSync(audioPath)) {
    log('error', `Audio file not found: ${audioPath}`);
    return;
  }

  if (!TranscriptionService.isSupported(audioPath)) {
    log('error', `Unsupported file format: ${audioPath}`);
    return;
  }

  log('info', `Transcribing: ${audioPath}`);

  try {
    const startTime = Date.now();
    const result = await service.transcribe(audioPath, {
      timestamps: true,
    });
    const transcriptionTime = Date.now() - startTime;

    log('success', `Transcription completed in ${(transcriptionTime / 1000).toFixed(1)}s`);

    console.log('\n--- Results ---\n');
    console.log(`Language: ${result.language}`);
    console.log(`Duration: ${result.duration.toFixed(1)}s`);
    console.log(`Model: ${result.model}`);
    console.log(`Processing time: ${(result.processingTimeMs / 1000).toFixed(1)}s`);
    console.log(`Real-time factor: ${(result.duration / (result.processingTimeMs / 1000)).toFixed(2)}x`);

    console.log('\n--- Transcript ---\n');
    console.log(result.text);

    if (result.segments.length > 0) {
      console.log('\n--- Segments (first 5) ---\n');
      for (const segment of result.segments.slice(0, 5)) {
        console.log(`[${segment.start.toFixed(1)}s - ${segment.end.toFixed(1)}s] ${segment.text}`);
      }
      if (result.segments.length > 5) {
        console.log(`... and ${result.segments.length - 5} more segments`);
      }
    }
  } catch (error) {
    log('error', `Transcription failed: ${(error as Error).message}`);
    console.error(error);
  }
}

async function testAssociations(service: TranscriptionService, audioPath: string): Promise<void> {
  console.log('\n=== Testing Media-Text Associations ===\n');

  if (!existsSync(audioPath)) {
    log('warn', 'Skipping associations test (no audio file)');
    return;
  }

  try {
    const associations = await service.transcribeToAssociations(
      audioPath,
      'test-media-id',
      'test-conversation-id',
      {
        messageId: 'test-message-id',
        importJobId: 'test-import-job-id',
      }
    );

    log('success', `Created ${associations.length} association(s)`);

    for (const assoc of associations) {
      console.log('\nAssociation:');
      console.log(`  Type: ${assoc.associationType}`);
      console.log(`  Method: ${assoc.extractionMethod}`);
      console.log(`  Confidence: ${assoc.confidence}`);
      console.log(`  Text length: ${assoc.extractedText.length} chars`);
    }
  } catch (error) {
    log('error', `Associations failed: ${(error as Error).message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           Transcription Service Test Suite                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  const audioPath = process.argv[2];

  // Always show model info and formats
  await testModelInfo();
  await testSupportedFormats();

  // Test initialization (uses tiny model for speed)
  const service = await testServiceInitialization('tiny');

  if (!service) {
    console.log('\n--- Setup Instructions ---\n');
    console.log('To enable transcription:');
    console.log('1. Install the transformers package:');
    console.log('   npm install @xenova/transformers');
    console.log('');
    console.log('2. Run this test again with an audio file:');
    console.log('   npx tsx scripts/test-transcription-service.ts path/to/audio.mp3');
    console.log('');
    process.exit(1);
  }

  // Test transcription if audio file provided
  if (audioPath) {
    await testTranscription(service, audioPath);
    await testAssociations(service, audioPath);
  } else {
    console.log('\n--- Test with Audio ---\n');
    log('info', 'No audio file provided. To test transcription:');
    console.log('   npx tsx scripts/test-transcription-service.ts path/to/audio.mp3');
  }

  console.log('\n=== Tests Complete ===\n');
}

main().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
