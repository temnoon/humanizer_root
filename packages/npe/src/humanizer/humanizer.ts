/**
 * Humanizer Service
 *
 * LLM-based text humanization that transforms AI-generated text
 * to read more naturally using detection feedback.
 */

import type { LlmAdapter } from '../llm/types.js';
import type {
  HumanizationOptions,
  HumanizationResult,
  HumanizationIntensity,
  DetectionResult,
} from './types.js';
import { detect } from './detector.js';
import { getReplacementSuggestions } from './tell-phrases.js';

// ═══════════════════════════════════════════════════════════════════════════
// Humanization Prompts
// ═══════════════════════════════════════════════════════════════════════════

const HUMANIZATION_SYSTEM = `You are a text humanization specialist. Your task is to make AI-generated text read more naturally and authentically human.

CRITICAL RULES:
1. Preserve ALL meaning, facts, and information
2. Keep the same tone and register
3. Do not add new information or opinions
4. Output ONLY the rewritten text - no explanations`;

function createHumanizationPrompt(
  text: string,
  detection: DetectionResult,
  intensity: HumanizationIntensity
): string {
  const suggestions = getReplacementSuggestions(detection.tellPhrases);
  const tellPhraseSection = suggestions.length > 0
    ? `\nAI TELL-PHRASES TO REMOVE/REPLACE:\n${suggestions.slice(0, 5).map(s =>
        `- "${s.phrase}" → consider "${s.replacements[0]}"`
      ).join('\n')}`
    : '';

  const intensityGuidance = {
    light: `LIGHT HUMANIZATION:
- Fix only the most obvious AI patterns
- Keep most of the original structure
- Focus on: removing AI tell-phrases, slight sentence variation`,

    moderate: `MODERATE HUMANIZATION:
- Address clear AI patterns
- Vary sentence structure more
- Add occasional contractions
- Remove formal transition words
- Focus on: tell-phrases, burstiness, punctuation variety`,

    aggressive: `AGGRESSIVE HUMANIZATION:
- Thoroughly rework AI patterns
- Significantly vary sentence lengths
- Use natural contractions throughout
- Replace all formal phrases with casual equivalents
- Add semicolons where clauses connect
- Make it read like authentic human writing`,
  };

  const featureSection = `
CURRENT DETECTION SCORES:
- AI Likelihood: ${detection.aiLikelihood.toFixed(1)}%
- Burstiness: ${detection.features.burstiness.toFixed(3)} (human ~0.87, lower = more AI-like)
- Semicolon Rate: ${detection.features.semicolonRate.toFixed(2)}% (human ~1.45%, AI rarely uses)
- Em-Dash Rate: ${detection.features.emDashRate.toFixed(2)}% (AI overuses)
- Tell-Phrase Score: ${detection.features.tellPhraseScore.toFixed(2)} (positive = AI-like)`;

  return `${intensityGuidance[intensity]}
${featureSection}
${tellPhraseSection}

RECOMMENDATIONS:
${detection.humanizationRecommendations.slice(0, 3).map(r =>
  `- [${r.priority.toUpperCase()}] ${r.description}`
).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
TEXT TO HUMANIZE:
═══════════════════════════════════════════════════════════════════════════════
${text}

═══════════════════════════════════════════════════════════════════════════════
HUMANIZED OUTPUT:
═══════════════════════════════════════════════════════════════════════════════`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Humanizer Service
// ═══════════════════════════════════════════════════════════════════════════

export class HumanizerService {
  private adapter: LlmAdapter;

  constructor(adapter: LlmAdapter) {
    this.adapter = adapter;
  }

  /**
   * Humanize text to make it read more naturally.
   *
   * @param text - The text to humanize
   * @param options - Humanization options
   * @returns Humanization result with before/after detection
   */
  async humanize(text: string, options: HumanizationOptions = {}): Promise<HumanizationResult> {
    const startTime = Date.now();

    const {
      intensity = 'moderate',
      preserveFormatting = true,
      skipIfHuman = false,
      minAiLikelihood = 40,
    } = options;

    // Run baseline detection
    const baselineDetection = detect(text, {
      returnSentenceAnalysis: false,
      returnHumanizationRecommendations: true,
    });

    // Check if we should skip
    if (skipIfHuman && baselineDetection.aiLikelihood < minAiLikelihood) {
      return {
        humanizedText: text,
        baseline: { detection: baselineDetection },
        final: { detection: baselineDetection },
        improvement: {
          aiConfidenceDrop: 0,
          burstinessIncrease: 0,
          tellWordsRemoved: 0,
        },
        processing: {
          totalDurationMs: Date.now() - startTime,
        },
        skipped: true,
        skipReason: `AI likelihood ${baselineDetection.aiLikelihood.toFixed(1)}% below threshold ${minAiLikelihood}%`,
      };
    }

    // Create humanization prompt
    const prompt = createHumanizationPrompt(text, baselineDetection, intensity);

    // Call LLM for humanization
    const humanizedRaw = await this.adapter.complete(HUMANIZATION_SYSTEM, prompt);

    // Clean up the output
    const humanizedText = this.sanitizeOutput(humanizedRaw, preserveFormatting);

    // Run final detection
    const finalDetection = detect(humanizedText, {
      returnSentenceAnalysis: false,
      returnHumanizationRecommendations: true,
    });

    // Calculate improvement metrics
    const aiConfidenceDrop = baselineDetection.aiLikelihood - finalDetection.aiLikelihood;
    const burstinessIncrease = finalDetection.features.burstiness - baselineDetection.features.burstiness;
    const tellWordsRemoved = baselineDetection.tellPhrases.matches.filter(m => m.direction === 'ai').length -
      finalDetection.tellPhrases.matches.filter(m => m.direction === 'ai').length;

    return {
      humanizedText,
      baseline: { detection: baselineDetection },
      final: { detection: finalDetection },
      improvement: {
        aiConfidenceDrop,
        burstinessIncrease,
        tellWordsRemoved: Math.max(0, tellWordsRemoved),
      },
      modelUsed: options.model || this.adapter.defaultModel,
      processing: {
        totalDurationMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Iteratively humanize until below threshold or max iterations.
   */
  async humanizeIterative(
    text: string,
    options: HumanizationOptions & { maxIterations?: number; targetAiLikelihood?: number } = {}
  ): Promise<HumanizationResult & { iterations: number }> {
    const {
      maxIterations = 3,
      targetAiLikelihood = 35,
      ...humanizeOptions
    } = options;

    let currentText = text;
    let lastResult: HumanizationResult | null = null;
    let iterations = 0;

    // Escalate intensity with iterations
    const intensities: HumanizationIntensity[] = ['light', 'moderate', 'aggressive'];

    for (let i = 0; i < maxIterations; i++) {
      const intensity = intensities[Math.min(i, intensities.length - 1)];

      const result = await this.humanize(currentText, {
        ...humanizeOptions,
        intensity,
        skipIfHuman: true,
        minAiLikelihood: targetAiLikelihood,
      });

      iterations++;
      lastResult = result;

      if (result.skipped || result.final.detection.aiLikelihood <= targetAiLikelihood) {
        break;
      }

      currentText = result.humanizedText;
    }

    // Build final result combining first baseline with last final
    const finalResult: HumanizationResult & { iterations: number } = {
      ...lastResult!,
      iterations,
    };

    return finalResult;
  }

  /**
   * Analyze text and recommend humanization intensity.
   */
  analyzeForHumanization(text: string): {
    detection: DetectionResult;
    recommendedIntensity: HumanizationIntensity;
    estimatedImprovement: string;
  } {
    const detection = detect(text, {
      returnHumanizationRecommendations: true,
    });

    let recommendedIntensity: HumanizationIntensity;
    let estimatedImprovement: string;

    if (detection.aiLikelihood >= 70) {
      recommendedIntensity = 'aggressive';
      estimatedImprovement = 'Expect 20-40% AI likelihood reduction';
    } else if (detection.aiLikelihood >= 50) {
      recommendedIntensity = 'moderate';
      estimatedImprovement = 'Expect 15-25% AI likelihood reduction';
    } else if (detection.aiLikelihood >= 35) {
      recommendedIntensity = 'light';
      estimatedImprovement = 'Expect 5-15% AI likelihood reduction';
    } else {
      recommendedIntensity = 'light';
      estimatedImprovement = 'Text already appears human-like';
    }

    return {
      detection,
      recommendedIntensity,
      estimatedImprovement,
    };
  }

  /**
   * Sanitize LLM output to remove artifacts.
   */
  private sanitizeOutput(text: string, preserveFormatting: boolean): string {
    let result = text;

    // Remove common LLM artifacts
    const patterns = [
      /^(Here('s| is) the|The following is|Below is).*?:\s*/i,
      /^(Let me|I'll|I will).*?:\s*/i,
      /\n\n(Let me know|Hope this helps|Feel free to).*$/i,
      /^(Sure|Certainly|Of course)[,!]?\s*/i,
      /\n*---+\n*$/,
    ];

    for (const pattern of patterns) {
      result = result.replace(pattern, '');
    }

    // Trim whitespace
    result = result.trim();

    // Normalize line breaks if not preserving formatting
    if (!preserveFormatting) {
      result = result.replace(/\n{3,}/g, '\n\n');
    }

    return result;
  }
}

/**
 * Create a humanizer service with the given LLM adapter.
 */
export function createHumanizer(adapter: LlmAdapter): HumanizerService {
  return new HumanizerService(adapter);
}
