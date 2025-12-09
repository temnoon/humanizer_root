/**
 * AIAnalysisPane - Enhanced AI detection tool
 *
 * Features:
 * - Native analysis with sentence-level scoring
 * - Suspect sentence highlighting
 * - Burstiness and metrics visualization
 * - Tell-phrase categorization
 * - Optional GPTZero integration (paid)
 * - Sentence highlighting toggle for main pane
 */

import { useState, useEffect } from 'react';
import { useToolState } from '../../contexts/ToolTabContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspaceTools } from '../../hooks/useWorkspaceTools';
import { aiDetection as runAIDetection } from '../../services/transformationService';

interface SentenceAnalysis {
  sentence: string;
  index: number;
  aiScore: number;
  tellPhrases: Array<{ phrase: string; category: string; weight: number }>;
  patterns: string[];
}

interface NativeAnalysisResult {
  ai_likelihood: number;
  label: 'likely_human' | 'mixed' | 'likely_ai' | 'human' | 'ai';
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
  sentenceAnalysis?: SentenceAnalysis[];
  suspectSentences?: SentenceAnalysis[];
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
  agreement?: number;
}

interface HighlightRange {
  start: number;
  end: number;
  reason: string;
  type?: 'tellword' | 'suspect' | 'gptzero';
}

interface AIAnalysisPaneProps {
  content: string;
  onHighlightText?: (highlights: HighlightRange[]) => void;
}

export function AIAnalysisPane({ content, onHighlightText }: AIAnalysisPaneProps) {
  const [state, setState] = useToolState('ai-analysis');
  const { user } = useAuth();
  const workspaceTools = useWorkspaceTools();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CombinedResult | null>(null);
  const [highlightMode, setHighlightMode] = useState<'off' | 'tellwords' | 'suspects' | 'gptzero' | 'all'>('off');

  const canUseGPTZero = user?.role === 'admin' || user?.role === 'pro';

  // Update highlights when mode changes
  useEffect(() => {
    if (!result || !onHighlightText) return;

    if (highlightMode === 'tellwords' && result.native.highlights) {
      const highlights = result.native.highlights.map(h => ({
        ...h,
        type: 'tellword' as const,
        reason: h.reason || 'Tell-word'
      }));
      onHighlightText(highlights);
    } else if (highlightMode === 'suspects' && result.native.suspectSentences) {
      const highlights = result.native.suspectSentences.map(s => {
        const start = content.indexOf(s.sentence);
        return {
          start,
          end: start + s.sentence.length,
          type: 'suspect' as const,
          reason: `AI Score: ${s.aiScore}% - ${s.patterns.join(', ')}`
        };
      }).filter(h => h.start >= 0);
      onHighlightText(highlights);
    } else if (highlightMode === 'gptzero' && result.gptzero?.details.sentences) {
      const highlights = result.gptzero.details.sentences
        .filter(s => s.highlight_sentence_for_ai)
        .map(s => {
          const start = content.indexOf(s.sentence);
          return {
            start,
            end: start + s.sentence.length,
            type: 'gptzero' as const,
            reason: `GPTZero: ${(s.generated_prob * 100).toFixed(0)}% AI`
          };
        }).filter(h => h.start >= 0);
      onHighlightText(highlights);
    } else if (highlightMode === 'all') {
      const allHighlights: Array<{ start: number; end: number; type: string; reason: string }> = [];

      if (result.native.highlights) {
        result.native.highlights.forEach(h => {
          allHighlights.push({ ...h, type: 'tellword', reason: h.reason || 'Tell-word' });
        });
      }

      if (result.native.suspectSentences) {
        result.native.suspectSentences.forEach(s => {
          const start = content.indexOf(s.sentence);
          if (start >= 0) {
            allHighlights.push({
              start,
              end: start + s.sentence.length,
              type: 'suspect',
              reason: `AI Score: ${s.aiScore}%`
            });
          }
        });
      }

      if (result.gptzero?.details.sentences) {
        result.gptzero.details.sentences
          .filter(s => s.highlight_sentence_for_ai)
          .forEach(s => {
            const start = content.indexOf(s.sentence);
            if (start >= 0) {
              allHighlights.push({
                start,
                end: start + s.sentence.length,
                type: 'gptzero',
                reason: `GPTZero: ${(s.generated_prob * 100).toFixed(0)}% AI`
              });
            }
          });
      }

      onHighlightText(allHighlights);
    } else {
      onHighlightText([]);
    }
  }, [highlightMode, result, content, onHighlightText]);

  const handleAnalyze = async () => {
    if (!content.trim()) {
      setError('No content to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const detectionResult = await runAIDetection(content, {
        detectorType: 'lite',
        useLLMJudge: state.useLLMJudge,
      });

      const aiDetectionData = detectionResult.metadata?.aiDetection;

      const nativeResult: NativeAnalysisResult = {
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
        phraseHits: aiDetectionData?.tellWords?.map((tw: any) => ({
          phrase: tw.word,
          count: tw.count ?? 1,
          weight: tw.weight ?? 0.5,
          category: tw.category ?? 'unknown',
        })) ?? [],
        highlights: aiDetectionData?.highlights ?? [],
        sentenceAnalysis: aiDetectionData?.sentenceAnalysis,
        suspectSentences: aiDetectionData?.suspectSentences,
        heuristicScore: aiDetectionData?.heuristicScore ?? (aiDetectionData?.confidence ? aiDetectionData.confidence / 100 : 0.5),
      };

      let gptzeroResult: GPTZeroResult | undefined;

      if (state.includeGPTZero && canUseGPTZero) {
        try {
          const gptzeroResponse = await runAIDetection(content, {
            detectorType: 'gptzero',
          });
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
        }
      }

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

      // Record analysis to workspace buffer system
      workspaceTools.recordAnalysis({
        aiScore: Math.round(nativeResult.ai_likelihood * 100),
        aiVerdict: nativeResult.label === 'likely_human' ? 'human' :
                   nativeResult.label === 'likely_ai' ? 'ai' : 'mixed',
        confidence: nativeResult.confidence,
        burstiness: nativeResult.metrics.burstiness,
        tellWords: nativeResult.phraseHits.map(h => ({
          word: h.phrase,
          count: h.count,
          category: h.category,
        })),
        highlights: nativeResult.highlights.map(h => ({
          start: h.start,
          end: h.end,
          type: 'tellword' as const,
          reason: h.reason,
        })),
        gptzeroScore: gptzeroResult ? gptzeroResult.confidence : undefined,
      });

      if (nativeResult.suspectSentences && nativeResult.suspectSentences.length > 0) {
        setHighlightMode('suspects');
      }

    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColorClass = (score: number): string => {
    if (score < 0.35) return 'ai-analysis-pane__score-value--success';
    if (score < 0.65) return 'ai-analysis-pane__score-value--warning';
    return 'ai-analysis-pane__score-value--error';
  };

  const getBurstinessLabel = (burstiness: number): string => {
    if (burstiness >= 70) return 'Human-like';
    if (burstiness >= 40) return 'Mixed';
    return 'AI-like';
  };

  const getPatternLabel = (pattern: string): string => {
    const labels: Record<string, string> = {
      'list_item': 'List',
      'chatbot_opener': 'Bot Opener',
      'chatbot_closer': 'Bot Closer',
      'conclusion_marker': 'Conclusion',
      'uniform_length': 'Uniform',
      'enthusiastic_affirmation': 'Enthusiastic'
    };
    return labels[pattern] || pattern;
  };

  return (
    <div className="ai-analysis-pane">
      {/* Options */}
      <div className="ai-analysis-pane__section">
        <label className="ai-analysis-pane__label flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={state.useLLMJudge}
            onChange={(e) => setState({ useLLMJudge: e.target.checked })}
            className="ai-analysis-pane__checkbox"
          />
          <span>LLM Meta-Judge</span>
        </label>

        <div className={`ai-analysis-pane__checkbox-group ${!canUseGPTZero ? 'ai-analysis-pane__checkbox-group--disabled' : ''}`}>
          <label className={`ai-analysis-pane__checkbox-label flex items-center gap-2 cursor-pointer ${!canUseGPTZero ? 'ai-analysis-pane__checkbox-label--disabled' : ''}`}>
            <input
              type="checkbox"
              checked={state.includeGPTZero && canUseGPTZero}
              onChange={(e) => setState({ includeGPTZero: e.target.checked })}
              disabled={!canUseGPTZero}
              className="ai-analysis-pane__checkbox"
            />
            <span>GPTZero</span>
            {!canUseGPTZero && <span className="ai-analysis-pane__pro-badge">Pro</span>}
          </label>
        </div>
      </div>

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={isAnalyzing || !content.trim()}
        className="ai-analysis-pane__btn-primary"
      >
        {isAnalyzing ? 'Analyzing...' : 'Analyze Text'}
      </button>

      {/* Error */}
      {error && (
        <div className="ai-analysis-pane__error">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="ai-analysis-pane__results">
          {/* AI Likelihood Score */}
          <div className="ai-analysis-pane__score-card">
            <div className="ai-analysis-pane__score-header">
              <span className="ai-analysis-pane__score-label">AI Likelihood</span>
              <span className={`ai-analysis-pane__score-value ${getScoreColorClass(result.native.ai_likelihood)}`}>
                {Math.round(result.native.ai_likelihood * 100)}%
              </span>
            </div>

            <div className="ai-analysis-pane__progress-bar">
              <div
                className={`ai-analysis-pane__progress-fill ${getScoreColorClass(result.native.ai_likelihood).replace('score-value', 'progress')}`}
                style={{ width: `${result.native.ai_likelihood * 100}%` }}
              />
            </div>

            {/* Metrics Grid */}
            <div className="ai-analysis-pane__metrics-grid">
              <div className="ai-analysis-pane__metric-card">
                <div className="ai-analysis-pane__metric-label">Burstiness</div>
                <div className={`ai-analysis-pane__metric-value ${result.native.metrics.burstiness >= 40 ? 'ai-analysis-pane__score-value--success' : 'ai-analysis-pane__score-value--error'}`}>
                  {Math.round(result.native.metrics.burstiness)}
                </div>
                <div className="ai-analysis-pane__metric-sublabel">{getBurstinessLabel(result.native.metrics.burstiness)}</div>
              </div>
              <div className="ai-analysis-pane__metric-card">
                <div className="ai-analysis-pane__metric-label">Diversity</div>
                <div className={`ai-analysis-pane__metric-value ${result.native.metrics.typeTokenRatio >= 0.4 ? 'ai-analysis-pane__score-value--success' : 'ai-analysis-pane__score-value--error'}`}>
                  {(result.native.metrics.typeTokenRatio * 100).toFixed(0)}%
                </div>
              </div>
              <div className="ai-analysis-pane__metric-card">
                <div className="ai-analysis-pane__metric-label">Avg Sentence</div>
                <div className="ai-analysis-pane__metric-value ai-analysis-pane__score-value--primary">
                  {result.native.metrics.avgSentenceLength.toFixed(0)} words
                </div>
              </div>
              <div className="ai-analysis-pane__metric-card">
                <div className="ai-analysis-pane__metric-label">Suspect Sentences</div>
                <div className={`ai-analysis-pane__metric-value ${(result.native.suspectSentences?.length ?? 0) > 0 ? 'ai-analysis-pane__score-value--error' : 'ai-analysis-pane__score-value--success'}`}>
                  {result.native.suspectSentences?.length ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* Highlight Mode Toggle */}
          <div className="ai-analysis-pane__highlight-section">
            <div className="ai-analysis-pane__highlight-label">
              Highlight in text:
            </div>
            <div className="ai-analysis-pane__highlight-buttons">
              <button
                onClick={() => setHighlightMode('off')}
                className={`ai-analysis-pane__highlight-btn ai-analysis-pane__highlight-btn--off ${highlightMode === 'off' ? 'active' : ''}`}
              >
                Off
              </button>
              <button
                onClick={() => setHighlightMode('suspects')}
                className={`ai-analysis-pane__highlight-btn ai-analysis-pane__highlight-btn--suspects ${highlightMode === 'suspects' ? 'active' : ''}`}
                title="Highlight suspect sentences (red)"
              >
                Suspects ({result.native.suspectSentences?.length ?? 0})
              </button>
              <button
                onClick={() => setHighlightMode('tellwords')}
                className={`ai-analysis-pane__highlight-btn ai-analysis-pane__highlight-btn--tellwords ${highlightMode === 'tellwords' ? 'active' : ''}`}
                title="Highlight tell-words (orange)"
              >
                Tell-words ({result.native.phraseHits?.length ?? 0})
              </button>
              {result.gptzero && (
                <button
                  onClick={() => setHighlightMode('gptzero')}
                  className={`ai-analysis-pane__highlight-btn ai-analysis-pane__highlight-btn--gptzero ${highlightMode === 'gptzero' ? 'active' : ''}`}
                  title="Highlight GPTZero flagged sentences (purple)"
                >
                  GPTZero ({result.gptzero.details.sentences.filter(s => s.highlight_sentence_for_ai).length})
                </button>
              )}
              {(result.native.suspectSentences?.length || result.native.phraseHits?.length || result.gptzero) && (
                <button
                  onClick={() => setHighlightMode('all')}
                  className={`ai-analysis-pane__highlight-btn ai-analysis-pane__highlight-btn--all ${highlightMode === 'all' ? 'active' : ''}`}
                  title="Show all highlight types"
                >
                  All
                </button>
              )}
            </div>
          </div>

          {/* Suspect Sentences Summary */}
          {result.native.suspectSentences && result.native.suspectSentences.length > 0 && (
            <div className="ai-analysis-pane__suspect-summary">
              <div className="ai-analysis-pane__suspect-title">
                {result.native.suspectSentences.length} Suspect Sentences
              </div>
              <div className="ai-analysis-pane__suspect-hint">
                Click "Suspects" button above to highlight in text
              </div>
              <div className="ai-analysis-pane__pattern-tags">
                {Array.from(new Set(result.native.suspectSentences.flatMap(s => s.patterns))).slice(0, 6).map((pattern, i) => (
                  <span key={i} className="ai-analysis-pane__pattern-tag">
                    {getPatternLabel(pattern)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tell Phrases */}
          {result.native.phraseHits.length > 0 && (
            <div className="ai-analysis-pane__phrase-section">
              <div className="ai-analysis-pane__phrase-title">
                Tell-Phrases ({result.native.phraseHits.length})
              </div>
              <div className="ai-analysis-pane__phrase-tags">
                {result.native.phraseHits.slice(0, 12).map((hit, i) => (
                  <span
                    key={i}
                    className={`ai-analysis-pane__phrase-tag ${hit.category === 'Chatbot Phrases' ? 'ai-analysis-pane__phrase-tag--chatbot' : 'ai-analysis-pane__phrase-tag--other'}`}
                  >
                    {hit.phrase}
                    {hit.count > 1 && <sup className="ai-analysis-pane__phrase-count">×{hit.count}</sup>}
                  </span>
                ))}
                {result.native.phraseHits.length > 12 && (
                  <span className="ai-analysis-pane__phrase-tag ai-analysis-pane__phrase-tag--more">
                    +{result.native.phraseHits.length - 12}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* GPTZero Results */}
          {result.gptzero && (
            <div className="ai-analysis-pane__gptzero-section">
              <div className="ai-analysis-pane__gptzero-header">
                <span className="ai-analysis-pane__gptzero-label">
                  GPTZERO <span className="ai-analysis-pane__gptzero-badge">PRO</span>
                </span>
                <span className={`ai-analysis-pane__gptzero-score ${getScoreColorClass(result.gptzero.confidence / 100)}`}>
                  {result.gptzero.confidence.toFixed(0)}%
                </span>
              </div>

              <div className="ai-analysis-pane__progress-bar">
                <div
                  className={`ai-analysis-pane__progress-fill ${getScoreColorClass(result.gptzero.confidence / 100).replace('score-value', 'progress')}`}
                  style={{ width: `${result.gptzero.confidence}%` }}
                />
              </div>

              {result.gptzero.details.sentences.filter(s => s.highlight_sentence_for_ai).length > 0 && (
                <div className="ai-analysis-pane__gptzero-hint">
                  {result.gptzero.details.sentences.filter(s => s.highlight_sentence_for_ai).length} sentences flagged as AI.
                  Click "GPTZero" button above to highlight in text.
                </div>
              )}

              {result.gptzero.result_message && (
                <div className="ai-analysis-pane__gptzero-message">
                  {result.gptzero.result_message.slice(0, 150)}{result.gptzero.result_message.length > 150 ? '...' : ''}
                </div>
              )}
            </div>
          )}

          {/* Agreement Score */}
          {result.agreement !== undefined && (
            <div className="ai-analysis-pane__agreement">
              <span className="ai-analysis-pane__agreement-label">Detector Agreement</span>
              <span
                className={`ai-analysis-pane__agreement-value ${result.agreement >= 80 ? 'ai-analysis-pane__score-value--success' : result.agreement >= 60 ? 'ai-analysis-pane__score-value--warning' : 'ai-analysis-pane__score-value--error'}`}
              >
                {result.agreement}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* No content */}
      {!content.trim() && !result && (
        <div className="ai-analysis-pane__empty">
          Select text to analyze
        </div>
      )}
    </div>
  );
}
