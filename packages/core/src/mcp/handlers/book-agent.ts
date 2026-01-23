/**
 * BookAgent Handlers
 *
 * MCP tool handlers for BookAgent operations.
 * Uses OllamaAdapter for local LLM inference and embeddings.
 */

import type {
  MCPResult,
  AnalyzeTextRhoInput,
  TransformWithPersonaInput,
  TransformWithStyleInput,
  FindLoadBearingSentencesInput,
} from '../types.js';
import { AVAILABLE_PERSONAS, AVAILABLE_STYLES } from '../tools/book-agent.js';

// Lazy imports to avoid loading heavy dependencies at startup
let BookAgent: typeof import('@humanizer/npe').BookAgent | null = null;
let OllamaAdapter: typeof import('@humanizer/npe').OllamaAdapter | null = null;
let BUILTIN_PERSONAS: typeof import('@humanizer/npe').BUILTIN_PERSONAS | null = null;
let BUILTIN_STYLES: typeof import('@humanizer/npe').BUILTIN_STYLES | null = null;

// Singleton instances (lazy initialized)
let adapter: InstanceType<typeof import('@humanizer/npe').OllamaAdapter> | null = null;
let agent: InstanceType<typeof import('@humanizer/npe').BookAgent> | null = null;

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
// LAZY LOADING
// ═══════════════════════════════════════════════════════════════════

async function ensureNpeLoaded(): Promise<void> {
  if (!BookAgent) {
    const npe = await import('@humanizer/npe');
    BookAgent = npe.BookAgent;
    OllamaAdapter = npe.OllamaAdapter;
    BUILTIN_PERSONAS = npe.BUILTIN_PERSONAS;
    BUILTIN_STYLES = npe.BUILTIN_STYLES;
  }
}

async function getAgent(): Promise<InstanceType<typeof import('@humanizer/npe').BookAgent>> {
  await ensureNpeLoaded();

  if (!agent) {
    adapter = new OllamaAdapter!();

    // Check if Ollama is available
    const isAvailable = await adapter.isAvailable();
    if (!isAvailable) {
      throw new Error('Ollama is not available. Please ensure Ollama is running on localhost:11434');
    }

    const embedder = async (text: string) => {
      const result = await adapter!.embed(text);
      return result.embedding;
    };

    agent = new BookAgent!(adapter, embedder, { verbose: false });
  }

  return agent;
}

// ═══════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Analyze text using quantum density matrix evolution
 */
export async function handleAnalyzeTextRho(args: AnalyzeTextRhoInput): Promise<MCPResult> {
  try {
    if (!args.text || args.text.length < 10) {
      return errorResult('Text must be at least 10 characters');
    }

    const bookAgent = await getAgent();
    const analysis = await bookAgent.analyzeRho(args.text);

    return jsonResult({
      purity: analysis.finalState.purity,
      entropy: analysis.finalState.entropy,
      quality: analysis.quality,
      sentenceCount: analysis.steps.length,
      purityTrajectory: analysis.purityTrajectory,
      entropyTrajectory: analysis.entropyTrajectory,
      loadBearingSentences: analysis.loadBearingSentences.slice(0, 3).map((s) => ({
        index: s.index,
        sentence: s.sentence.substring(0, 100) + (s.sentence.length > 100 ? '...' : ''),
        distance: s.distance,
      })),
      interpretation: {
        purity:
          analysis.finalState.purity >= 0.25
            ? 'high (concentrated meaning)'
            : analysis.finalState.purity >= 0.15
              ? 'medium (moderate concentration)'
              : 'low (diffuse meaning)',
        entropy:
          analysis.finalState.entropy <= 2.5
            ? 'low (coherent theme)'
            : analysis.finalState.entropy <= 3.0
              ? 'medium (some dispersion)'
              : 'high (dispersed themes)',
      },
    });
  } catch (err) {
    return errorResult(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Transform text with persona and Rho quality control
 */
export async function handleTransformWithPersona(args: TransformWithPersonaInput): Promise<MCPResult> {
  try {
    if (!args.text || args.text.length < 10) {
      return errorResult('Text must be at least 10 characters');
    }

    if (!args.persona || !AVAILABLE_PERSONAS.includes(args.persona as typeof AVAILABLE_PERSONAS[number])) {
      return errorResult(`Invalid persona. Available: ${AVAILABLE_PERSONAS.join(', ')}`);
    }

    await ensureNpeLoaded();
    const bookAgent = await getAgent();

    const personaDefinition = BUILTIN_PERSONAS![args.persona];
    if (!personaDefinition) {
      return errorResult(`Persona "${args.persona}" not found in built-in personas`);
    }

    const result = await bookAgent.transformWithPersona(args.text, personaDefinition);

    return jsonResult({
      success: result.success,
      text: result.text,
      attemptsCount: result.attempts.length,
      totalDurationMs: result.totalDurationMs,
      qualityDelta: result.qualityDelta,
      original: {
        purity: result.originalAnalysis.finalState.purity,
        entropy: result.originalAnalysis.finalState.entropy,
        quality: result.originalAnalysis.quality,
      },
      final: {
        purity: result.finalAnalysis.finalState.purity,
        entropy: result.finalAnalysis.finalState.entropy,
        quality: result.finalAnalysis.quality,
      },
      attempts: result.attempts.map((a) => ({
        attempt: a.attempt,
        passed: a.passed,
        failureReason: a.failureReason,
        durationMs: a.durationMs,
      })),
    });
  } catch (err) {
    return errorResult(`Transformation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Transform text with style and Rho quality control
 */
export async function handleTransformWithStyle(args: TransformWithStyleInput): Promise<MCPResult> {
  try {
    if (!args.text || args.text.length < 10) {
      return errorResult('Text must be at least 10 characters');
    }

    if (!args.style || !AVAILABLE_STYLES.includes(args.style as typeof AVAILABLE_STYLES[number])) {
      return errorResult(`Invalid style. Available: ${AVAILABLE_STYLES.join(', ')}`);
    }

    await ensureNpeLoaded();
    const bookAgent = await getAgent();

    const styleDefinition = BUILTIN_STYLES![args.style];
    if (!styleDefinition) {
      return errorResult(`Style "${args.style}" not found in built-in styles`);
    }

    const result = await bookAgent.transformWithStyle(args.text, styleDefinition);

    return jsonResult({
      success: result.success,
      text: result.text,
      attemptsCount: result.attempts.length,
      totalDurationMs: result.totalDurationMs,
      qualityDelta: result.qualityDelta,
      original: {
        purity: result.originalAnalysis.finalState.purity,
        entropy: result.originalAnalysis.finalState.entropy,
        quality: result.originalAnalysis.quality,
      },
      final: {
        purity: result.finalAnalysis.finalState.purity,
        entropy: result.finalAnalysis.finalState.entropy,
        quality: result.finalAnalysis.quality,
      },
      attempts: result.attempts.map((a) => ({
        attempt: a.attempt,
        passed: a.passed,
        failureReason: a.failureReason,
        durationMs: a.durationMs,
      })),
    });
  } catch (err) {
    return errorResult(`Transformation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Find load-bearing sentences in text
 */
export async function handleFindLoadBearingSentences(args: FindLoadBearingSentencesInput): Promise<MCPResult> {
  try {
    if (!args.text || args.text.length < 10) {
      return errorResult('Text must be at least 10 characters');
    }

    const topN = args.topN ?? 5;
    if (topN < 1 || topN > 20) {
      return errorResult('topN must be between 1 and 20');
    }

    const bookAgent = await getAgent();
    const sentences = await bookAgent.findLoadBearingSentences(args.text, topN);

    return jsonResult({
      count: sentences.length,
      sentences: sentences.map((s) => ({
        index: s.index,
        sentence: s.sentence,
        weight: s.weight,
        fragility: s.fragility,
        interpretation:
          s.fragility === 'high'
            ? 'Critical - removing would significantly alter meaning'
            : s.fragility === 'medium'
              ? 'Important - contributes notably to meaning'
              : 'Supporting - provides context but is less essential',
      })),
    });
  } catch (err) {
    return errorResult(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER REGISTRY
// ═══════════════════════════════════════════════════════════════════

export const BOOK_AGENT_HANDLERS: Record<string, (args: unknown) => Promise<MCPResult>> = {
  analyze_text_rho: handleAnalyzeTextRho as (args: unknown) => Promise<MCPResult>,
  transform_with_persona: handleTransformWithPersona as (args: unknown) => Promise<MCPResult>,
  transform_with_style: handleTransformWithStyle as (args: unknown) => Promise<MCPResult>,
  find_load_bearing_sentences: handleFindLoadBearingSentences as (args: unknown) => Promise<MCPResult>,
};
