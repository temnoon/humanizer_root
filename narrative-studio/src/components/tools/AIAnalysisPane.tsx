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

import { useState, useEffect, useCallback } from 'react';
import { useToolState } from '../../contexts/ToolTabContext';
import { useAuth } from '../../contexts/AuthContext';
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

interface AIAnalysisPaneProps {
  content: string;
  onHighlightText?: (highlights: Array<{ start: number; end: number; reason: string }>) => void;
  onSuspectSentences?: (sentences: string[]) => void;
}

export function AIAnalysisPane({ content, onHighlightText, onSuspectSentences }: AIAnalysisPaneProps) {
  const [state, setState] = useToolState('ai-analysis');
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CombinedResult | null>(null);
  const [showSentences, setShowSentences] = useState(false);
  const [showSuspectSentences, setShowSuspectSentences] = useState(false);
  const [highlightMode, setHighlightMode] = useState<'off' | 'tellwords' | 'suspects' | 'gptzero'>('off');

  const canUseGPTZero = user?.role === 'admin' || user?.role === 'pro';

  // Update highlights when mode changes
  useEffect(() => {
    if (!result || !onHighlightText) return;

    if (highlightMode === 'tellwords' && result.native.highlights) {
      onHighlightText(result.native.highlights);
    } else if (highlightMode === 'suspects' && result.native.suspectSentences) {
      // Convert suspect sentences to highlight ranges
      const highlights = result.native.suspectSentences.map(s => {
        const start = content.indexOf(s.sentence);
        return {
          start,
          end: start + s.sentence.length,
          reason: `AI Score: ${s.aiScore}% - ${s.patterns.join(', ')}`
        };
      }).filter(h => h.start >= 0);
      onHighlightText(highlights);
    } else if (highlightMode === 'gptzero' && result.gptzero?.details.sentences) {
      const flaggedSentences = result.gptzero.details.sentences
        .filter(s => s.highlight_sentence_for_ai)
        .map(s => s.sentence);
      if (onSuspectSentences) {
        onSuspectSentences(flaggedSentences);
      }
    } else {
      onHighlightText([]);
    }
  }, [highlightMode, result, content, onHighlightText, onSuspectSentences]);

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

      // Auto-enable suspect highlighting if we found suspect sentences
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

  const getScoreColor = (score: number): string => {
    if (score < 0.35) return 'var(--success)';
    if (score < 0.65) return 'var(--warning)';
    return 'var(--error)';
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
    <div className="ai-analysis-pane" style={{ padding: '12px' }}>
      {/* Options */}
      <div style={{ marginBottom: '12px' }}>
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
            {!canUseGPTZero && <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>Pro</span>}
          </label>
        </div>
      </div>

      {/* Analyze Button */}
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
        {isAnalyzing ? 'Analyzing...' : 'Analyze Text'}
      </button>

      {/* Error */}
      {error && (
        <div style={{ marginTop: '8px', padding: '6px 8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--error)', fontSize: '0.6875rem' }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ marginTop: '12px' }}>
          {/* AI Likelihood Score */}
          <div
            style={{
              padding: '10px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>AI Likelihood</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: getScoreColor(result.native.ai_likelihood) }}>
                {Math.round(result.native.ai_likelihood * 100)}%
              </span>
            </div>

            <div style={{ height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
              <div style={{ width: `${result.native.ai_likelihood * 100}%`, height: '100%', backgroundColor: getScoreColor(result.native.ai_likelihood) }} />
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              <div style={{ padding: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.5625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Burstiness</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: result.native.metrics.burstiness >= 40 ? 'var(--success)' : 'var(--error)' }}>
                  {Math.round(result.native.metrics.burstiness)}
                </div>
                <div style={{ fontSize: '0.5rem', color: 'var(--text-tertiary)' }}>{getBurstinessLabel(result.native.metrics.burstiness)}</div>
              </div>
              <div style={{ padding: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.5625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Diversity</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: result.native.metrics.typeTokenRatio >= 0.4 ? 'var(--success)' : 'var(--error)' }}>
                  {(result.native.metrics.typeTokenRatio * 100).toFixed(0)}%
                </div>
              </div>
              <div style={{ padding: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.5625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Avg Sentence</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{result.native.metrics.avgSentenceLength.toFixed(0)} words</div>
              </div>
              <div style={{ padding: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.5625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Suspect Sentences</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: (result.native.suspectSentences?.length ?? 0) > 0 ? 'var(--error)' : 'var(--success)' }}>
                  {result.native.suspectSentences?.length ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* Highlight Mode Toggle */}
          <div style={{ marginBottom: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setHighlightMode(highlightMode === 'off' ? 'suspects' : 'off')}
              style={{
                padding: '4px 8px',
                fontSize: '0.625rem',
                backgroundColor: highlightMode !== 'off' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: highlightMode !== 'off' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              Highlight: {highlightMode === 'off' ? 'Off' : highlightMode}
            </button>
            {highlightMode !== 'off' && (
              <>
                <button
                  onClick={() => setHighlightMode('suspects')}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.625rem',
                    backgroundColor: highlightMode === 'suspects' ? 'var(--error)' : 'var(--bg-tertiary)',
                    color: highlightMode === 'suspects' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  Suspects
                </button>
                <button
                  onClick={() => setHighlightMode('tellwords')}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.625rem',
                    backgroundColor: highlightMode === 'tellwords' ? 'var(--warning)' : 'var(--bg-tertiary)',
                    color: highlightMode === 'tellwords' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  Tell-words
                </button>
                {result.gptzero && (
                  <button
                    onClick={() => setHighlightMode('gptzero')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.625rem',
                      backgroundColor: highlightMode === 'gptzero' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                      color: highlightMode === 'gptzero' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                  >
                    GPTZero
                  </button>
                )}
              </>
            )}
          </div>

          {/* Suspect Sentences */}
          {result.native.suspectSentences && result.native.suspectSentences.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <button
                onClick={() => setShowSuspectSentences(!showSuspectSentences)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--error)' }}>
                  {showSuspectSentences ? '▼' : '▶'} {result.native.suspectSentences.length} Suspect Sentences
                </span>
              </button>

              {showSuspectSentences && (
                <div style={{ marginTop: '4px', maxHeight: '150px', overflowY: 'auto', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', padding: '4px' }}>
                  {result.native.suspectSentences.map((sentence, i) => (
                    <div key={i} style={{
                      padding: '6px',
                      marginBottom: '4px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '3px',
                      borderLeft: `3px solid ${sentence.aiScore >= 50 ? 'var(--error)' : 'var(--warning)'}`,
                    }}>
                      <div style={{ fontSize: '0.625rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {sentence.sentence.slice(0, 100)}{sentence.sentence.length > 100 ? '...' : ''}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '0.5625rem',
                          fontWeight: 700,
                          color: sentence.aiScore >= 50 ? 'var(--error)' : 'var(--warning)',
                        }}>
                          {sentence.aiScore}%
                        </span>
                        {sentence.patterns.map((pattern, j) => (
                          <span key={j} style={{
                            fontSize: '0.5rem',
                            padding: '1px 4px',
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            borderRadius: '2px',
                            color: 'var(--error)',
                          }}>
                            {getPatternLabel(pattern)}
                          </span>
                        ))}
                        {sentence.tellPhrases.slice(0, 2).map((tp, j) => (
                          <span key={`tp-${j}`} style={{
                            fontSize: '0.5rem',
                            padding: '1px 4px',
                            backgroundColor: 'rgba(245, 158, 11, 0.2)',
                            borderRadius: '2px',
                            color: 'var(--warning)',
                          }}>
                            {tp.phrase}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tell Phrases */}
          {result.native.phraseHits.length > 0 && (
            <div style={{ padding: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: '8px' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                Tell-Phrases ({result.native.phraseHits.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                {result.native.phraseHits.slice(0, 12).map((hit, i) => (
                  <span key={i} style={{
                    padding: '2px 6px',
                    backgroundColor: hit.category === 'Chatbot Phrases' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    borderRadius: '3px',
                    fontSize: '0.5625rem',
                    color: hit.category === 'Chatbot Phrases' ? 'var(--error)' : 'var(--warning)',
                  }}>
                    {hit.phrase}
                    {hit.count > 1 && <sup style={{ marginLeft: '2px' }}>×{hit.count}</sup>}
                  </span>
                ))}
                {result.native.phraseHits.length > 12 && (
                  <span style={{ padding: '2px 6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', fontSize: '0.5625rem', color: 'var(--text-tertiary)' }}>
                    +{result.native.phraseHits.length - 12}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* GPTZero Results */}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  GPTZERO <span style={{ fontSize: '0.5rem', padding: '1px 4px', backgroundColor: 'var(--accent-primary)', color: 'var(--text-inverse)', borderRadius: '2px' }}>PRO</span>
                </span>
                <span style={{ fontSize: '1.125rem', fontWeight: 700, color: getScoreColor(result.gptzero.confidence / 100) }}>
                  {result.gptzero.confidence.toFixed(0)}%
                </span>
              </div>

              <div style={{ height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{ width: `${result.gptzero.confidence}%`, height: '100%', backgroundColor: getScoreColor(result.gptzero.confidence / 100) }} />
              </div>

              {result.gptzero.details.sentences.length > 0 && (
                <button
                  onClick={() => setShowSentences(!showSentences)}
                  style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '3px', padding: '3px 8px', fontSize: '0.625rem', color: 'var(--text-secondary)', cursor: 'pointer', width: '100%' }}
                >
                  {showSentences ? '▼' : '▶'} {result.gptzero.details.sentences.filter(s => s.highlight_sentence_for_ai).length} AI-flagged sentences
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

          {/* Agreement Score */}
          {result.agreement !== undefined && (
            <div style={{ padding: '8px 10px', backgroundColor: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Detector Agreement</span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: result.agreement >= 80 ? 'var(--success)' : result.agreement >= 60 ? 'var(--warning)' : 'var(--error)' }}>
                {result.agreement}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* No content */}
      {!content.trim() && !result && (
        <div style={{ marginTop: '12px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
          Select text to analyze
        </div>
      )}
    </div>
  );
}
