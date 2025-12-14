/**
 * Subjective Intentional Constraint (SIC) - Engine
 *
 * The core SIC evaluation engine. Implements three main methods:
 * - sic(): Core Subjective Intentional Constraint evaluation
 * - style_check(): Style consistency check (supporting tool)
 * - vetProfileText(): Profile factory gate
 *
 * Architecture:
 * - Two-pass evaluation: Extractor (cheap) → Judge (stronger)
 * - Genre-aware baseline calibration
 * - Evidence-backed scoring (every score has quotes)
 */

import type {
  LlmAdapter,
  SicResult,
  StyleCheckResult,
  ProfileVettingResult,
  Genre,
  SicFeatureKey,
  FeatureScore,
  InflectionPoint,
  EvidenceQuote,
  TextChunk,
} from './types';
import {
  DEFAULT_SIC_WEIGHTS,
  GENRE_BASELINES,
} from './types';
import {
  chunkText,
  safeJsonParse,
  runQuickHeuristics,
  calculateTextStats,
  clamp,
} from './chunk';
import {
  GENRE_DETECTION_PROMPT,
  SIC_EXTRACTOR_PROMPT,
  getSicJudgePrompt,
  STYLE_CHECK_EXTRACTOR_PROMPT,
  STYLE_CHECK_JUDGE_PROMPT,
  VET_PROFILE_TEXT_PROMPT,
  AI_PROBABILITY_PROMPT,
  SIC_FEATURE_KEYS,
} from './prompts';

/**
 * Options for SIC analysis
 */
export interface SicOptions {
  /** Hint for genre (skips detection if provided) */
  genreHint?: Genre;
  /** Maximum chunks to analyze */
  maxChunks?: number;
  /** Skip genre detection pass */
  skipGenreDetection?: boolean;
  /** Model for extraction pass */
  extractorModel?: string;
  /** Model for judge pass */
  judgeModel?: string;
}

/**
 * Options for style check
 */
export interface StyleCheckOptions {
  /** The style profile to compare against */
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
   * Core Subjective Intentional Constraint evaluation
   *
   * @param text - The text to analyze
   * @param options - Analysis options
   * @returns SicResult with scores, evidence, and diagnostics
   */
  async sic(text: string, options: SicOptions = {}): Promise<SicResult> {
    this.llmCallCount = 0;
    const startTime = Date.now();

    // Quick stats and heuristics (free, no LLM)
    const stats = calculateTextStats(text);
    const heuristics = runQuickHeuristics(text);

    // Chunk the text
    const chunks = chunkText(text);
    const maxChunks = options.maxChunks || 10;
    const analyzedChunks = chunks.slice(0, maxChunks);

    // Pass 0: Genre detection (unless skipped or hinted)
    let genre: Genre = options.genreHint || 'unknown';
    if (!options.genreHint && !options.skipGenreDetection) {
      genre = await this.detectGenre(text);
    }

    // Pass 1: Extract evidence from each chunk
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

    // Add metadata
    result.llmCallCount = this.llmCallCount;

    console.log(`SIC analysis completed in ${Date.now() - startTime}ms, ${this.llmCallCount} LLM calls`);

    return result;
  }

  /**
   * Style consistency check (supporting tool)
   *
   * @param profile - The style profile to compare against
   * @param text - The text to check
   * @returns StyleCheckResult
   */
  async style_check(
    profile: StyleCheckOptions['profile'],
    text: string
  ): Promise<StyleCheckResult> {
    this.llmCallCount = 0;

    // Build profile description for the prompt
    const profileDesc = JSON.stringify(profile, null, 2);

    // Extract style features
    const extractorResponse = await this.callLlm(
      this.extractorAdapter,
      STYLE_CHECK_EXTRACTOR_PROMPT,
      `Profile:\n${profileDesc}\n\nText to analyze:\n${text}`
    );

    const extracted = safeJsonParse(
      this.normalize(extractorResponse),
      { matches: [], deviations: [], metrics: {} }
    );

    // Judge consistency
    const judgeResponse = await this.callLlm(
      this.judgeAdapter,
      STYLE_CHECK_JUDGE_PROMPT,
      JSON.stringify(extracted)
    );

    const judged = safeJsonParse(
      this.normalize(judgeResponse),
      {
        consistencyScore: 50,
        profileMatchScore: 50,
        deviations: [],
        metrics: {},
      }
    );

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
   * Vet a text sample for profile extraction suitability
   *
   * @param sample - The text sample to vet
   * @returns ProfileVettingResult
   */
  async vetProfileText(sample: string): Promise<ProfileVettingResult> {
    this.llmCallCount = 0;

    const stats = calculateTextStats(sample);
    const heuristics = runQuickHeuristics(sample);

    // Quick checks
    const concerns: string[] = [];
    const recommendations: string[] = [];

    if (stats.wordCount < 200) {
      concerns.push(`Text is short (${stats.wordCount} words). 500+ words recommended.`);
      recommendations.push('Provide a longer sample for better profile extraction.');
    }

    if (stats.sentenceCount < 10) {
      concerns.push(`Few sentences (${stats.sentenceCount}). More variety needed.`);
    }

    // Check for AI signals via heuristics
    if (heuristics.managerVoiceSignals > 3) {
      concerns.push('High "manager voice" signals detected. May indicate AI generation.');
    }

    if (heuristics.symmetrySignals > 2) {
      concerns.push('Symmetry/balancing patterns detected. May indicate AI generation.');
    }

    if (heuristics.irreversibilitySignals === 0 && heuristics.epistemicReversalSignals === 0) {
      concerns.push('No commitment or epistemic reversal signals. May lack authentic voice.');
      recommendations.push('Choose a sample with more personal stakes or decision-making.');
    }

    // LLM vetting
    const vetResponse = await this.callLlm(
      this.judgeAdapter,
      VET_PROFILE_TEXT_PROMPT,
      sample
    );

    const vetted = safeJsonParse(
      this.normalize(vetResponse),
      {
        suitable: true,
        qualityScore: 50,
        sicScore: 50,
        concerns: [],
        recommendations: [],
      }
    );

    // Merge concerns and recommendations
    const allConcerns = [...concerns, ...(vetted.concerns || [])];
    const allRecommendations = [...recommendations, ...(vetted.recommendations || [])];

    // Final suitability determination
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

  /**
   * Detect the genre of the text
   */
  private async detectGenre(text: string): Promise<Genre> {
    // Use a sample for genre detection (first 1000 chars)
    const sample = text.slice(0, 1000);

    const response = await this.callLlm(
      this.extractorAdapter,
      GENRE_DETECTION_PROMPT,
      sample
    );

    const parsed = safeJsonParse(
      this.normalize(response),
      { genre: 'unknown', confidence: 0.5, notes: '' }
    );

    const validGenres: Genre[] = ['narrative', 'argument', 'technical', 'legal', 'marketing', 'unknown'];
    const genre = validGenres.includes(parsed.genre) ? parsed.genre : 'unknown';

    return genre;
  }

  /**
   * Extract features from chunks (Pass 1)
   */
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

      const parsed = safeJsonParse(
        this.normalize(response),
        { features: {}, preliminary_notes: '' }
      );

      allExtractions.set(chunk.id, parsed);
    }

    return allExtractions;
  }

  /**
   * Judge and score features (Pass 2)
   */
  private async judgeFeatures(
    fullText: string,
    genre: Genre,
    extractedFeatures: Map<string, unknown>,
    chunks: TextChunk[],
    heuristics: ReturnType<typeof runQuickHeuristics>,
    options: SicOptions
  ): Promise<SicResult> {
    // Compile all extracted evidence
    const compiledEvidence = this.compileEvidence(extractedFeatures);

    // Build judge input
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

    const judged = safeJsonParse(
      this.normalize(response),
      this.getDefaultJudgeResult()
    );

    // Build feature scores
    const features = this.buildFeatureScores(judged.features || {});

    // Calculate final SIC score
    const sicScore = this.calculateSicScore(features, genre);

    // Get inflection points
    const inflectionPoints = this.parseInflectionPoints(judged.inflectionPoints || []);

    // Determine AI probability
    const aiProbability = this.calculateAiProbability(
      sicScore,
      genre,
      heuristics,
      judged.aiProbability,
      features
    );

    // Build diagnostics
    const diagnostics = {
      genreBaselineUsed: genre !== 'unknown' && genre !== 'narrative',
      corporateBureaucratRisk:
        (genre === 'technical' || genre === 'legal') && sicScore < 40,
      highFluencyLowCommitmentPattern:
        heuristics.irreversibilitySignals === 0 &&
        heuristics.managerVoiceSignals > 2,
    };

    // Generate human-readable notes
    const notes = this.generateNotes(sicScore, genre, features, diagnostics);

    return {
      version: 'sic.v1',
      sicScore,
      aiProbability,
      genre,
      features,
      inflectionPoints,
      diagnostics,
      notes,
    };
  }

  /**
   * Compile evidence from all chunk extractions
   */
  private compileEvidence(extractedFeatures: Map<string, unknown>): Record<string, unknown[]> {
    const compiled: Record<string, unknown[]> = {};

    for (const featureKey of SIC_FEATURE_KEYS) {
      compiled[featureKey] = [];
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

  /**
   * Build feature scores from judge output
   */
  private buildFeatureScores(
    judgedFeatures: Record<string, unknown>
  ): Record<SicFeatureKey, FeatureScore> {
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

  /**
   * Calculate final SIC score with genre baseline
   */
  private calculateSicScore(
    features: Record<SicFeatureKey, FeatureScore>,
    genre: Genre
  ): number {
    const weights = DEFAULT_SIC_WEIGHTS;

    // Positive features (weighted sum)
    let positiveScore = 0;
    positiveScore += features.commitment_irreversibility.score * weights.commitment_irreversibility;
    positiveScore += features.epistemic_risk_uncertainty.score * weights.epistemic_risk_uncertainty;
    positiveScore += features.time_pressure_tradeoffs.score * weights.time_pressure_tradeoffs;
    positiveScore += features.situatedness_body_social.score * weights.situatedness_body_social;
    positiveScore += features.scar_tissue_specificity.score * weights.scar_tissue_specificity;
    positiveScore += features.bounded_viewpoint.score * weights.bounded_viewpoint;

    // Anti-smoothing is positive (high score = good)
    positiveScore += features.anti_smoothing.score * 0.1;

    // Meta-contamination is negative (penalize high scores)
    const metaPenalty = (100 - features.meta_contamination.score) * weights.meta_contamination_penalty;

    // Raw score
    let rawScore = positiveScore - (features.meta_contamination.score * 0.15);

    // Apply genre baseline
    const baseline = GENRE_BASELINES[genre] || 0;
    const adjustedScore = rawScore + baseline;

    return clamp(Math.round(adjustedScore), 0, 100);
  }

  /**
   * Parse inflection points from judge output
   */
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

  /**
   * Calculate AI probability with genre awareness
   */
  private calculateAiProbability(
    sicScore: number,
    genre: Genre,
    heuristics: ReturnType<typeof runQuickHeuristics>,
    llmEstimate?: number,
    features?: Record<SicFeatureKey, FeatureScore>
  ): number {
    // Base probability from SIC score (inverse relationship)
    let baseProbability = (100 - sicScore) / 100;

    // Adjust for genre (technical/legal should have lower AI probability for same SIC)
    if (genre === 'technical' || genre === 'legal') {
      baseProbability *= 0.7; // Reduce AI probability estimate
    }

    // For argument genre, anti_smoothing is the KEY signal
    // High anti_smoothing (chose a side, refused balance) = human
    // Low anti_smoothing (hedging, "both sides") = AI
    if (genre === 'argument' && features) {
      const antiSmooth = features.anti_smoothing?.score ?? 50;
      // Scale: 0 = +0.2 AI prob, 100 = -0.2 AI prob
      const antiSmoothAdjustment = (50 - antiSmooth) / 250;
      baseProbability += antiSmoothAdjustment;
    }

    // Heuristic adjustments
    if (heuristics.managerVoiceSignals > 3) {
      baseProbability += 0.1;
    }
    if (heuristics.symmetrySignals > 2) {
      baseProbability += 0.05;
    }
    // Formulaic apology language is an AI signal
    if (heuristics.formulaicApologySignals > 2) {
      baseProbability += 0.1;
    }
    if (heuristics.irreversibilitySignals > 2) {
      baseProbability -= 0.1;
    }
    // Real scar tissue (persistent involuntary residue) is a strong human signal
    if (heuristics.scarTissueSignals > 0) {
      baseProbability -= 0.15;
    }
    if (heuristics.scarTissueSignals > 2) {
      baseProbability -= 0.1; // Additional reduction for multiple scar tissue markers
    }

    // Blend with LLM estimate if provided
    // For argument genre, trust our calculation more (LLM often confused by hedging)
    if (typeof llmEstimate === 'number' && llmEstimate >= 0 && llmEstimate <= 1) {
      if (genre === 'argument') {
        // 75% our calculation, 25% LLM for argument genre
        baseProbability = baseProbability * 0.75 + llmEstimate * 0.25;
      } else {
        // 50/50 blend for other genres
        baseProbability = (baseProbability + llmEstimate) / 2;
      }
    }

    return clamp(baseProbability, 0, 1);
  }

  /**
   * Generate human-readable notes
   */
  private generateNotes(
    sicScore: number,
    genre: Genre,
    features: Record<SicFeatureKey, FeatureScore>,
    diagnostics: SicResult['diagnostics']
  ): string {
    const notes: string[] = [];

    // Overall assessment
    if (sicScore >= 70) {
      notes.push('High constraint density detected. Text shows strong traces of situated authorship.');
    } else if (sicScore >= 40) {
      notes.push('Moderate constraint density. Some traces of situated authorship present.');
    } else {
      notes.push('Low constraint density. Text shows few traces of situated authorship.');
    }

    // Genre context
    if (diagnostics.genreBaselineUsed) {
      notes.push(`Genre "${genre}" detected; baseline calibration applied.`);
    }

    if (diagnostics.corporateBureaucratRisk) {
      notes.push('Low SIC may reflect intentional professional suppression of subjectivity, not AI generation.');
    }

    if (diagnostics.highFluencyLowCommitmentPattern) {
      notes.push('Pattern detected: high fluency with low commitment—a primary AI signal.');
    }

    // Top features
    const sorted = Object.entries(features)
      .filter(([key]) => !key.startsWith('meta'))
      .sort((a, b) => b[1].score - a[1].score);

    if (sorted.length > 0) {
      const top = sorted[0];
      const bottom = sorted[sorted.length - 1];
      notes.push(`Strongest signal: ${top[0].replace(/_/g, ' ')} (${top[1].score}).`);
      notes.push(`Weakest signal: ${bottom[0].replace(/_/g, ' ')} (${bottom[1].score}).`);
    }

    return notes.join(' ');
  }

  /**
   * Default judge result for fallback
   */
  private getDefaultJudgeResult(): Record<string, unknown> {
    const features: Record<string, unknown> = {};
    for (const key of SIC_FEATURE_KEYS) {
      features[key] = {
        score: 50,
        notes: 'Unable to determine',
        evidence: [],
      };
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

  /**
   * Call an LLM adapter with tracking
   */
  private async callLlm(
    adapter: LlmAdapter,
    systemPrompt: string,
    userInput: string,
    options?: { model?: string; temperature?: number; max_tokens?: number }
  ): Promise<string> {
    this.llmCallCount++;
    return adapter.complete(systemPrompt, userInput, options);
  }

  /**
   * Normalize a response using the adapter
   */
  private normalize(response: string): string {
    return this.extractorAdapter.normalize?.(response) || response;
  }
}
