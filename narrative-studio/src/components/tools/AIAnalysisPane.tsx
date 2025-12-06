/**
 * AIAnalysisPane - Unified AI detection tool
 *
 * Combines native detection with optional GPTZero analysis.
 * GPTZero checkbox is tier-gated (pro/admin only).
 *
 * Features:
 * - Native analysis with sentence-level scoring
 * - Burstiness visualization
 * - Tell-phrase highlighting
 * - Optional GPTZero integration (paid)
 * - Combined results display
 */

import { useState, useEffect } from 'react';
import { useToolState } from '../../contexts/ToolTabContext';
import { useAuth } from '../../contexts/AuthContext';
import { aiDetection as runAIDetection } from '../../services/transformationService';

interface SentenceAnalysis {
  text: string;
  aiProbability: number;
  tellPhrases: string[];
}

interface NativeAnalysisResult {
  ai_likelihood: number;
  label: 'likely_human' | 'mixed' | 'likely_ai';
  confidence: 'low' | 'medium' | 'high';
  metrics: {
    burstiness: number;
    avgSentenceLength: number;
    sentenceLengthStd: number;
    typeTokenRatio: number;
    repeatedNgrams: number;
  };
  phraseHits: Array<{
    phrase: string;
    count: number;
    weight: number;
    category: string;
  }>;
  highlights: Array<{
    start: number;
    end: number;
    reason: string;
    score?: number;
  }>;
  // Enhanced: sentence-level analysis
  sentences?: SentenceAnalysis[];
  heuristicScore?: number;
}

interface GPTZeroResult {
  verdict: 'human' | 'ai' | 'mixed';
  confidence: number;
  details: {
    completely_generated_prob: number;
    average_generated_prob: number;
    sentences: Array<{
      sentence: string;
      generated_prob: number;
      highlight_sentence_for_ai: boolean;
    }>;
  };
  result_message: string;
}

interface CombinedResult {
  native: NativeAnalysisResult;
  gptzero?: GPTZeroResult;
  agreement?: number; // 0-100 how much they agree
}

interface AIAnalysisPaneProps {
  content: string;
  onHighlightText?: (highlights: Array<{ start: number; end: number; reason: string }>) => void;
}

export function AIAnalysisPane({ content, onHighlightText }: AIAnalysisPaneProps) {
  const [state, setState] = useToolState('ai-analysis');
  const { user, isAuthenticated } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CombinedResult | null>(null);
  const [showSentences, setShowSentences] = useState(false);

  // Check if user can access GPTZero
  const canUseGPTZero = user?.role === 'admin' || user?.role === 'pro';

  // Run analysis
  const handleAnalyze = async () => {
    if (!content.trim()) {
      setError('No content to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Run lite detection via transformationService (handles mapping properly)
      const detectionResult = await runAIDetection(content, {
        detectorType: 'lite',
        useLLMJudge: state.useLLMJudge,
      });

      // Extract aiDetection from the properly mapped response
      const aiDetectionData = detectionResult.metadata?.aiDetection;

      // Map from transformationService format to NativeAnalysisResult format
      // Service provides: confidence (0-100), verdict, burstiness, avgSentenceLength, etc.
      const nativeResult: NativeAnalysisResult = {
        // confidence is 0-100 from service, convert to 0-1
        ai_likelihood: (aiDetectionData?.confidence ?? 50) / 100,
        label: aiDetectionData?.verdict ?? 'mixed',
        confidence: aiDetectionData?.confidence_level ?? 'medium',
        metrics: {
          burstiness: aiDetectionData?.burstiness ?? 0,
          avgSentenceLength: aiDetectionData?.avgSentenceLength ?? 0,
          sentenceLengthStd: aiDetectionData?.sentenceLengthStd ?? 0,
          typeTokenRatio: aiDetectionData?.typeTokenRatio ?? 0,
          repeatedNgrams: aiDetectionData?.repeatedNgrams ?? 0,
        },
        // tellWords now has full structure: { word, category, count, weight }
        phraseHits: aiDetectionData?.tellWords?.map((tw: any) => ({
          phrase: tw.word,
          count: tw.count ?? 1,
          weight: tw.weight ?? 0.5,
          category: tw.category ?? 'unknown',
        })) ?? [],
        highlights: aiDetectionData?.highlights ?? [],
        heuristicScore: aiDetectionData?.heuristicScore ?? (aiDetectionData?.confidence ? aiDetectionData.confidence / 100 : 0.5),
      };

      let gptzeroResult: GPTZeroResult | undefined;

      // Run GPTZero if enabled and user has access
      if (state.includeGPTZero && canUseGPTZero) {
        try {
          const gptzeroResponse = await runAIDetection(content, {
            detectorType: 'gptzero',
          });
          // GPTZero response has different structure - extract from aiDetection
          const gptzeroData = gptzeroResponse.metadata?.aiDetection;
          if (gptzeroData && gptzeroData.method === 'gptzero') {
            gptzeroResult = {
              verdict: gptzeroData.verdict,
              confidence: gptzeroData.confidence,
              details: {
                completely_generated_prob: gptzeroData.confidence / 100,
                average_generated_prob: gptzeroData.confidence / 100,
                sentences: gptzeroData.highlightedSentences?.map((s: string) => ({
                  sentence: s,
                  generated_prob: 0.9,
                  highlight_sentence_for_ai: true,
                })) || [],
              },
              result_message: gptzeroData.reasoning || '',
            };
          }
        } catch (gptzeroError) {
          console.error('GPTZero analysis failed:', gptzeroError);
          // Continue with native-only result
        }
      }

      // Calculate agreement if both results exist
      let agreement: number | undefined;
      if (gptzeroResult) {
        const nativeScore = nativeResult.ai_likelihood;
        const gptzeroScore = gptzeroResult.confidence / 100;
        const diff = Math.abs(nativeScore - gptzeroScore);
        agreement = Math.round((1 - diff) * 100);
      }

      const combinedResult: CombinedResult = {
        native: nativeResult,
        gptzero: gptzeroResult,
        agreement,
      };

      setResult(combinedResult);
      setState({ lastResult: combinedResult });

      // Send highlights to parent
      if (onHighlightText && nativeResult.highlights) {
        onHighlightText(nativeResult.highlights);
      }
    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Score color
  const getScoreColor = (score: number): string => {
    if (score < 0.35) return 'var(--success)';
    if (score < 0.65) return 'var(--warning)';
    return 'var(--error)';
  };

  // Burstiness interpretation
  const getBurstinessLabel = (burstiness: number): string => {
    if (burstiness >= 70) return 'High (human-like)';
    if (burstiness >= 40) return 'Medium';
    return 'Low (AI-like)';
  };

  return (
    <div className="ai-analysis-pane" style={{ padding: '12px' }}>
      {/* Options - compact row */}
      <div style={{ marginBottom: '12px' }}>
        {/* LLM Judge */}
        <label
          className="flex items-center gap-2 cursor-pointer"
          style={{ color: 'var(--text-primary)', fontSize: '0.8125rem', marginBottom: '8px' }}
        >
          <input
            type="checkbox"
            checked={state.useLLMJudge}
            onChange={(e) => setState({ useLLMJudge: e.target.checked })}
            style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
          />
          <span>LLM Meta-Judge</span>
        </label>

        {/* GPTZero Option (tier-gated) - compact */}
        <div
          style={{
            padding: '8px 10px',
            backgroundColor: canUseGPTZero ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            opacity: canUseGPTZero ? 1 : 0.6,
          }}
        >
          <label
            className="flex items-center gap-2 cursor-pointer"
            style={{ color: canUseGPTZero ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: '0.8125rem' }}
          >
            <input
              type="checkbox"
              checked={state.includeGPTZero && canUseGPTZero}
              onChange={(e) => setState({ includeGPTZero: e.target.checked })}
              disabled={!canUseGPTZero}
              style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
            />
            <span>GPTZero</span>
            {!canUseGPTZero && <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>🔒 Pro</span>}
          </label>
        </div>
      </div>

      {/* Run Button - compact */}
      <button
        onClick={handleAnalyze}
        disabled={isAnalyzing || !content.trim()}
        style={{
          width: '100%',
          backgroundImage: 'var(--accent-primary-gradient)',
          backgroundColor: 'transparent',
          color: 'var(--text-inverse)',
          padding: '10px 12px',
          fontSize: '0.875rem',
          minHeight: '40px',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          fontWeight: 600,
          cursor: isAnalyzing || !content.trim() ? 'not-allowed' : 'pointer',
          opacity: isAnalyzing || !content.trim() ? 0.5 : 1,
        }}
      >
        {isAnalyzing ? '⏳ Analyzing...' : '🔍 Analyze'}
      </button>

      {/* Error - compact */}
      {error && (
        <div style={{ marginTop: '8px', padding: '6px 8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--error)', fontSize: '0.6875rem' }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ marginTop: '12px' }}>
          {/* Native Results - compact */}
          <div
            style={{
              padding: '10px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '8px',
            }}
          >
            {/* Score header - compact */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>AI Likelihood</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: getScoreColor(result.native.ai_likelihood) }}>
                {Math.round(result.native.ai_likelihood * 100)}%
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
              <div style={{ width: `${result.native.ai_likelihood * 100}%`, height: '100%', backgroundColor: getScoreColor(result.native.ai_likelihood) }} />
            </div>

            {/* Metrics Grid - compact 2x2 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              <div style={{ padding: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.5625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Burstiness</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round(result.native.metrics.burstiness)}</div>
              </div>
              <div style={{ padding: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.5625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Diversity</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{(result.native.metrics.typeTokenRatio * 100).toFixed(0)}%</div>
              </div>
              <div style={{ padding: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.5625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Avg Sent</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{result.native.metrics.avgSentenceLength.toFixed(0)}</div>
              </div>
              <div style={{ padding: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.5625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Tell Phrases</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{result.native.phraseHits.length}</div>
              </div>
            </div>

            {/* Tell Phrases - compact chips */}
            {result.native.phraseHits.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                {result.native.phraseHits.slice(0, 6).map((hit, i) => (
                  <span key={i} style={{ padding: '2px 6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '3px', fontSize: '0.5625rem', color: 'var(--error)' }}>
                    {hit.phrase}
                  </span>
                ))}
                {result.native.phraseHits.length > 6 && (
                  <span style={{ padding: '2px 6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', fontSize: '0.5625rem', color: 'var(--text-tertiary)' }}>
                    +{result.native.phraseHits.length - 6}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* GPTZero Results (if available) - compact */}
          {result.gptzero && (
            <div
              style={{
                padding: '10px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '8px',
                borderLeft: '3px solid var(--accent-primary)',
              }}
            >
              {/* GPTZero header + score */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  GPTZERO <span style={{ fontSize: '0.5rem', padding: '1px 4px', backgroundColor: 'var(--accent-primary)', color: 'var(--text-inverse)', borderRadius: '2px' }}>PRO</span>
                </span>
                <span style={{ fontSize: '1.125rem', fontWeight: 700, color: getScoreColor(result.gptzero.confidence / 100) }}>
                  {result.gptzero.confidence.toFixed(0)}%
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{ width: `${result.gptzero.confidence}%`, height: '100%', backgroundColor: getScoreColor(result.gptzero.confidence / 100) }} />
              </div>

              {/* Sentence toggle - compact */}
              {result.gptzero.details.sentences.length > 0 && (
                <button
                  onClick={() => setShowSentences(!showSentences)}
                  style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '3px', padding: '3px 8px', fontSize: '0.625rem', color: 'var(--text-secondary)', cursor: 'pointer', width: '100%' }}
                >
                  {showSentences ? '▼' : '▶'} {result.gptzero.details.sentences.filter(s => s.highlight_sentence_for_ai).length} flagged sentences
                </button>
              )}

              {showSentences && (
                <div style={{ marginTop: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                  {result.gptzero.details.sentences.map((sentence, i) => (
                    <div key={i} style={{ padding: '4px 6px', marginBottom: '3px', backgroundColor: sentence.highlight_sentence_for_ai ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-tertiary)', borderRadius: '3px', borderLeft: sentence.highlight_sentence_for_ai ? '2px solid var(--error)' : 'none' }}>
                      <div style={{ fontSize: '0.625rem', color: 'var(--text-primary)' }}>{sentence.sentence.slice(0, 80)}{sentence.sentence.length > 80 ? '...' : ''}</div>
                      <div style={{ fontSize: '0.5625rem', color: sentence.highlight_sentence_for_ai ? 'var(--error)' : 'var(--text-tertiary)' }}>{(sentence.generated_prob * 100).toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Agreement Score - compact inline */}
          {result.agreement !== undefined && (
            <div style={{ padding: '8px 10px', backgroundColor: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Agreement</span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: result.agreement >= 80 ? 'var(--success)' : result.agreement >= 60 ? 'var(--warning)' : 'var(--error)' }}>
                {result.agreement}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* No content - minimal */}
      {!content.trim() && !result && (
        <div style={{ marginTop: '12px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
          Select text to analyze
        </div>
      )}
    </div>
  );
}
