/**
 * SIC Engine
 *
 * Core Subjective Intentional Constraint evaluation.
 *
 * Architecture:
 * - Two-pass evaluation: Extractor (cheap) → Judge (stronger)
 * - Genre-aware baseline calibration
 * - Evidence-backed scoring
 */

import type { LlmAdapter } from '../llm/types.js';
import { safeJsonParse } from '../llm/normalizer.js';
import type {
  SicResult,
  StyleCheckResult,
  ProfileVettingResult,
  Genre,
  SicFeatureKey,
  FeatureScore,
  InflectionPoint,
  TextChunk,
  NarrativeModeCaveat,
} from '../types.js';
import { DEFAULT_SIC_WEIGHTS, GENRE_BASELINES, SIC_FEATURE_KEYS } from './constants.js';
import {
  chunkText,
  runQuickHeuristics,
  calculateTextStats,
  clamp,
  detectNarrativeMode,
} from './chunk.js';
import {
  GENRE_DETECTION_PROMPT,
  SIC_EXTRACTOR_PROMPT,
  getSicJudgePrompt,
  STYLE_CHECK_EXTRACTOR_PROMPT,
  STYLE_CHECK_JUDGE_PROMPT,
  VET_PROFILE_TEXT_PROMPT,
} from './prompts.js';

/**
 * SIC analysis options
 */
export interface SicOptions {
  genreHint?: Genre;
  maxChunks?: number;
  skipGenreDetection?: boolean;
  extractorModel?: string;
  judgeModel?: string;
}

/**
 * Style check options
 */
export interface StyleCheckOptions {
  profile: {
    patterns?: string[];
    vocabulary?: string[];
    sentenceStructure?: string;
    formality?: 'informal' | 'neutral' | 'formal';
  };
}

/**
 * The SIC Engine
 */
export class SicEngine {
  private extractorAdapter: LlmAdapter;
  private judgeAdapter: LlmAdapter;
  private llmCallCount: number = 0;

  constructor(extractorAdapter: LlmAdapter, judgeAdapter?: LlmAdapter) {
    this.extractorAdapter = extractorAdapter;
    this.judgeAdapter = judgeAdapter || extractorAdapter;
  }

  /**
   * Core SIC evaluation
   */
  async sic(text: string, options: SicOptions = {}): Promise<SicResult> {
    this.llmCallCount = 0;
    const startTime = Date.now();

    // Quick stats and heuristics
    const stats = calculateTextStats(text);
    const heuristics = runQuickHeuristics(text);

    // Chunk the text
    const chunks = chunkText(text);
    const maxChunks = options.maxChunks || 10;
    const analyzedChunks = chunks.slice(0, maxChunks);

    // Pass 0: Genre detection
    let genre: Genre = options.genreHint || 'unknown';
    if (!options.genreHint && !options.skipGenreDetection) {
      genre = await this.detectGenre(text);
    }

    // Pass 1: Extract evidence
    const extractedFeatures = await this.extractFeatures(analyzedChunks, options);

    // Pass 2: Judge and score
    const result = await this.judgeFeatures(
      text,
      genre,
      extractedFeatures,
      analyzedChunks,
      heuristics,
      options
    );

    result.llmCallCount = this.llmCallCount;

    console.log(`SIC analysis: ${Date.now() - startTime}ms, ${this.llmCallCount} LLM calls`);

    return result;
  }

  /**
   * Style consistency check
   */
  async style_check(profile: StyleCheckOptions['profile'], text: string): Promise<StyleCheckResult> {
    this.llmCallCount = 0;

    const profileDesc = JSON.stringify(profile, null, 2);

    const extractorResponse = await this.callLlm(
      this.extractorAdapter,
      STYLE_CHECK_EXTRACTOR_PROMPT,
      `Profile:\n${profileDesc}\n\nText to analyze:\n${text}`
    );

    const extracted = safeJsonParse(
      this.normalize(extractorResponse),
      { matches: [], deviations: [], metrics: {} }
    );

    const judgeResponse = await this.callLlm(
      this.judgeAdapter,
      STYLE_CHECK_JUDGE_PROMPT,
      JSON.stringify(extracted)
    );

    const judged = safeJsonParse<{
      consistencyScore?: number;
      profileMatchScore?: number;
      deviations?: string[];
      metrics?: {
        perplexity?: number;
        burstiness?: number;
        avgSentenceLength?: number;
        typeTokenRatio?: number;
      };
    }>(this.normalize(judgeResponse), {
      consistencyScore: 50,
      profileMatchScore: 50,
      deviations: [],
      metrics: {},
    });

    return {
      version: 'style_check.v1',
      consistencyScore: clamp(judged.consistencyScore || 50, 0, 100),
      profileMatchScore: clamp(judged.profileMatchScore || 50, 0, 100),
      deviations: judged.deviations || [],
      metrics: {
        perplexity: judged.metrics?.perplexity,
        burstiness: judged.metrics?.burstiness,
        avgSentenceLength: judged.metrics?.avgSentenceLength,
        typeTokenRatio: judged.metrics?.typeTokenRatio,
      },
    };
  }

  /**
   * Vet text for profile extraction suitability
   */
  async vetProfileText(sample: string): Promise<ProfileVettingResult> {
    this.llmCallCount = 0;

    const stats = calculateTextStats(sample);
    const heuristics = runQuickHeuristics(sample);

    const concerns: string[] = [];
    const recommendations: string[] = [];

    if (stats.wordCount < 200) {
      concerns.push(`Text is short (${stats.wordCount} words). 500+ recommended.`);
      recommendations.push('Provide a longer sample.');
    }

    if (stats.sentenceCount < 10) {
      concerns.push(`Few sentences (${stats.sentenceCount}). More variety needed.`);
    }

    if (heuristics.managerVoiceSignals > 3) {
      concerns.push('High "manager voice" signals. May indicate AI generation.');
    }

    if (heuristics.symmetrySignals > 2) {
      concerns.push('Symmetry patterns detected. May indicate AI generation.');
    }

    if (heuristics.irreversibilitySignals === 0 && heuristics.epistemicReversalSignals === 0) {
      concerns.push('No commitment signals. May lack authentic voice.');
      recommendations.push('Choose a sample with more personal stakes.');
    }

    const vetResponse = await this.callLlm(
      this.judgeAdapter,
      VET_PROFILE_TEXT_PROMPT,
      sample
    );

    const vetted = safeJsonParse(this.normalize(vetResponse), {
      suitable: true,
      qualityScore: 50,
      sicScore: 50,
      concerns: [],
      recommendations: [],
    });

    const allConcerns = [...concerns, ...(vetted.concerns || [])];
    const allRecommendations = [...recommendations, ...(vetted.recommendations || [])];

    const suitable = allConcerns.length < 3 && (vetted.qualityScore || 50) >= 40;

    return {
      version: 'profile_vet.v1',
      suitable,
      qualityScore: clamp(vetted.qualityScore || 50, 0, 100),
      sicScore: clamp(vetted.sicScore || 50, 0, 100),
      concerns: allConcerns,
      recommendations: allRecommendations,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════

  private async detectGenre(text: string): Promise<Genre> {
    const sample = text.slice(0, 1000);

    const response = await this.callLlm(
      this.extractorAdapter,
      GENRE_DETECTION_PROMPT,
      sample
    );

    const parsed = safeJsonParse(this.normalize(response), {
      genre: 'unknown',
      confidence: 0.5,
    });

    const validGenres: Genre[] = ['narrative', 'argument', 'technical', 'legal', 'marketing', 'unknown'];
    const detectedGenre = parsed.genre as string;
    return validGenres.includes(detectedGenre as Genre) ? (detectedGenre as Genre) : 'unknown';
  }

  private async extractFeatures(
    chunks: TextChunk[],
    options: SicOptions
  ): Promise<Map<string, unknown>> {
    const allExtractions = new Map<string, unknown>();

    for (const chunk of chunks) {
      const response = await this.callLlm(
        this.extractorAdapter,
        SIC_EXTRACTOR_PROMPT,
        chunk.text,
        { model: options.extractorModel }
      );

      const parsed = safeJsonParse(this.normalize(response), {
        features: {},
        preliminary_notes: '',
      });

      allExtractions.set(chunk.id, parsed);
    }

    return allExtractions;
  }

  private async judgeFeatures(
    fullText: string,
    genre: Genre,
    extractedFeatures: Map<string, unknown>,
    chunks: TextChunk[],
    heuristics: ReturnType<typeof runQuickHeuristics>,
    options: SicOptions
  ): Promise<SicResult> {
    const compiledEvidence = this.compileEvidence(extractedFeatures);

    const judgeInput = {
      genre,
      textLength: fullText.length,
      chunkCount: chunks.length,
      heuristics,
      extractedEvidence: compiledEvidence,
    };

    const response = await this.callLlm(
      this.judgeAdapter,
      getSicJudgePrompt(genre),
      JSON.stringify(judgeInput, null, 2),
      { model: options.judgeModel }
    );

    const judged = safeJsonParse<{
      features?: Record<string, unknown>;
      inflectionPoints?: unknown[];
      aiProbability?: number;
    }>(this.normalize(response), this.getDefaultJudgeResult());

    const features = this.buildFeatureScores(judged.features || {});
    const sicScore = this.calculateSicScore(features, genre);
    const inflectionPoints = this.parseInflectionPoints(judged.inflectionPoints || []);
    const aiProbability = this.calculateAiProbability(sicScore, genre, heuristics, judged.aiProbability, features);
    const narrativeModeCaveat = detectNarrativeMode(fullText, genre);

    const diagnostics = {
      genreBaselineUsed: genre !== 'unknown' && genre !== 'narrative',
      corporateBureaucratRisk: (genre === 'technical' || genre === 'legal') && sicScore < 40,
      highFluencyLowCommitmentPattern:
        heuristics.irreversibilitySignals === 0 && heuristics.managerVoiceSignals > 2,
    };

    const notes = this.generateNotes(sicScore, genre, features, diagnostics, narrativeModeCaveat);

    return {
      version: 'sic.v1',
      sicScore,
      aiProbability,
      genre,
      features,
      inflectionPoints,
      diagnostics,
      notes,
      narrativeModeCaveat,
    };
  }

  private compileEvidence(extractedFeatures: Map<string, unknown>): Record<string, unknown[]> {
    const compiled: Record<string, unknown[]> = {};
    for (const key of SIC_FEATURE_KEYS) {
      compiled[key] = [];
    }

    for (const [chunkId, extraction] of extractedFeatures) {
      const features = (extraction as { features?: Record<string, unknown> })?.features || {};
      for (const [key, value] of Object.entries(features)) {
        if (compiled[key]) {
          compiled[key].push({ chunkId, ...(value as object) });
        }
      }
    }

    return compiled;
  }

  private buildFeatureScores(judgedFeatures: Record<string, unknown>): Record<SicFeatureKey, FeatureScore> {
    const features = {} as Record<SicFeatureKey, FeatureScore>;

    for (const key of SIC_FEATURE_KEYS) {
      const judged = judgedFeatures[key] as {
        score?: number;
        notes?: string;
        evidence?: Array<{ quote: string; rationale: string }>;
      } | undefined;

      features[key] = {
        score: clamp(judged?.score ?? 50, 0, 100),
        notes: judged?.notes || 'No specific notes',
        evidence: (judged?.evidence || []).map((e) => ({
          quote: e.quote || '',
          rationale: e.rationale || '',
        })),
      };
    }

    return features;
  }

  private calculateSicScore(features: Record<SicFeatureKey, FeatureScore>, genre: Genre): number {
    const weights = DEFAULT_SIC_WEIGHTS;

    let positiveScore = 0;
    positiveScore += features.commitment_irreversibility.score * weights.commitment_irreversibility;
    positiveScore += features.epistemic_risk_uncertainty.score * weights.epistemic_risk_uncertainty;
    positiveScore += features.time_pressure_tradeoffs.score * weights.time_pressure_tradeoffs;
    positiveScore += features.situatedness_body_social.score * weights.situatedness_body_social;
    positiveScore += features.scar_tissue_specificity.score * weights.scar_tissue_specificity;
    positiveScore += features.bounded_viewpoint.score * weights.bounded_viewpoint;
    positiveScore += features.anti_smoothing.score * 0.1;

    let rawScore = positiveScore - (features.meta_contamination.score * 0.15);
    const baseline = GENRE_BASELINES[genre] || 0;
    const adjustedScore = rawScore + baseline;

    return clamp(Math.round(adjustedScore), 0, 100);
  }

  private parseInflectionPoints(raw: unknown[]): InflectionPoint[] {
    if (!Array.isArray(raw)) return [];

    const validKinds = ['commitment', 'reversal', 'reframe', 'stakes', 'constraint-reveal'];

    return raw
      .filter((ip): ip is object => typeof ip === 'object' && ip !== null)
      .map((ip: unknown) => {
        const item = ip as Record<string, unknown>;
        return {
          chunkId: String(item.chunkId || 'chunk_0'),
          kind: validKinds.includes(String(item.kind))
            ? (item.kind as InflectionPoint['kind'])
            : 'commitment',
          quote: String(item.quote || ''),
          whyItMatters: String(item.whyItMatters || ''),
        };
      })
      .filter((ip) => ip.quote.length > 0);
  }

  private calculateAiProbability(
    sicScore: number,
    genre: Genre,
    heuristics: ReturnType<typeof runQuickHeuristics>,
    llmEstimate?: number,
    features?: Record<SicFeatureKey, FeatureScore>
  ): number {
    let baseProbability = (100 - sicScore) / 100;

    if (genre === 'technical' || genre === 'legal') {
      baseProbability *= 0.7;
    }

    if (genre === 'argument' && features) {
      const antiSmooth = features.anti_smoothing?.score ?? 50;
      const antiSmoothAdjustment = (50 - antiSmooth) / 250;
      baseProbability += antiSmoothAdjustment;
    }

    if (heuristics.managerVoiceSignals > 3) baseProbability += 0.1;
    if (heuristics.symmetrySignals > 2) baseProbability += 0.05;
    if (heuristics.formulaicApologySignals > 2) baseProbability += 0.1;
    if (heuristics.irreversibilitySignals > 2) baseProbability -= 0.1;
    if (heuristics.scarTissueSignals > 0) baseProbability -= 0.15;
    if (heuristics.scarTissueSignals > 2) baseProbability -= 0.1;

    if (typeof llmEstimate === 'number' && llmEstimate >= 0 && llmEstimate <= 1) {
      if (genre === 'argument') {
        baseProbability = baseProbability * 0.75 + llmEstimate * 0.25;
      } else {
        baseProbability = (baseProbability + llmEstimate) / 2;
      }
    }

    return clamp(baseProbability, 0, 1);
  }

  private generateNotes(
    sicScore: number,
    genre: Genre,
    features: Record<SicFeatureKey, FeatureScore>,
    diagnostics: SicResult['diagnostics'],
    narrativeModeCaveat?: NarrativeModeCaveat
  ): string {
    const notes: string[] = [];

    if (sicScore >= 70) {
      notes.push('High constraint density. Strong traces of situated authorship.');
    } else if (sicScore >= 40) {
      notes.push('Moderate constraint density. Some traces of situated authorship.');
    } else {
      notes.push('Low constraint density. Few traces of situated authorship.');
    }

    if (diagnostics.genreBaselineUsed) {
      notes.push(`Genre "${genre}" detected; baseline calibration applied.`);
    }

    if (diagnostics.corporateBureaucratRisk) {
      notes.push('Low SIC may reflect intentional professional suppression.');
    }

    if (diagnostics.highFluencyLowCommitmentPattern) {
      notes.push('Pattern: high fluency with low commitment—a primary AI signal.');
    }

    if (narrativeModeCaveat && !narrativeModeCaveat.standardScoringApplies) {
      notes.push(`CAVEAT: ${narrativeModeCaveat.interpretationNote}`);
    }

    const sorted = Object.entries(features)
      .filter(([key]) => !key.startsWith('meta'))
      .sort((a, b) => b[1].score - a[1].score);

    if (sorted.length > 0) {
      const top = sorted[0];
      const bottom = sorted[sorted.length - 1];
      notes.push(`Strongest: ${top[0].replace(/_/g, ' ')} (${top[1].score}).`);
      notes.push(`Weakest: ${bottom[0].replace(/_/g, ' ')} (${bottom[1].score}).`);
    }

    return notes.join(' ');
  }

  private getDefaultJudgeResult(): Record<string, unknown> {
    const features: Record<string, unknown> = {};
    for (const key of SIC_FEATURE_KEYS) {
      features[key] = { score: 50, notes: 'Unable to determine', evidence: [] };
    }

    return {
      features,
      inflectionPoints: [],
      sicScore: 50,
      aiProbability: 0.5,
      diagnostics: {
        genreBaselineUsed: false,
        corporateBureaucratRisk: false,
        highFluencyLowCommitmentPattern: false,
      },
      notes: 'Analysis incomplete',
    };
  }

  private async callLlm(
    adapter: LlmAdapter,
    systemPrompt: string,
    userInput: string,
    options?: { model?: string; temperature?: number; max_tokens?: number }
  ): Promise<string> {
    this.llmCallCount++;
    return adapter.complete(systemPrompt, userInput, options);
  }

  private normalize(response: string): string {
    return this.extractorAdapter.normalize?.(response) || response;
  }
}
