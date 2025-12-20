/**
 * V3AnalysisPane - Local-first AI Detection with Chekhov Ratio
 *
 * Novel AI detection combining:
 * - Sentence-level perplexity analysis (heuristic)
 * - Narrative-level Chekhov ratio (specificity fulfillment)
 * - Completeness classifier for dynamic weighting
 *
 * Core insight: "Human specificity is purposeful (foreshadowing/payoff).
 * AI specificity is decorative (abandoned details = 'slop')."
 *
 * The Chekhov Ratio measures fulfilled vs orphaned named entities.
 * Completeness detection adjusts weighting for excerpts vs complete works.
 */

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  analyzeText,
  getSummary,
  type V3Analysis,
} from '../../services/detection/v3/index';
import {
  getCharLimit,
  type UserTier,
} from '../../config/transformation-limits';

// Helper to get user tier from role
function getUserTier(role: string | undefined): UserTier {
  const tierMap: Record<string, UserTier> = {
    admin: 'admin',
    premium: 'premium',
    pro: 'pro',
    member: 'member',
    free: 'free',
  };
  return tierMap[role || 'free'] || 'free';
}

interface V3AnalysisPaneProps {
  content: string;
  onHighlightText?: (highlights: Array<{ start: number; end: number; reason: string }>) => void;
}

export function V3AnalysisPane({ content }: V3AnalysisPaneProps) {
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<V3Analysis | null>(null);
  const [showOrphanedEntities, setShowOrphanedEntities] = useState(false);
  const [showFlaggedSentences, setShowFlaggedSentences] = useState(false);

  const userTier = getUserTier(user?.role);

  const handleAnalyze = async () => {
    if (!content.trim()) {
      setError('No content to analyze');
      return;
    }

    if (content.trim().length < 100) {
      setError('Text must be at least 100 characters for V3 analysis');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const analysisResult = await analyzeText(content);
      setResult(analysisResult);
    } catch (err) {
      console.error('V3 analysis failed:', err);
      setError(err instanceof Error ? err.message : 'V3 analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Get classification color class
  const getClassificationClass = (classification: string): string => {
    switch (classification) {
      case 'LIKELY_HUMAN': return 'v3-analysis-pane__classification--human';
      case 'LIKELY_AI': return 'v3-analysis-pane__classification--ai';
      default: return 'v3-analysis-pane__classification--uncertain';
    }
  };

  // Get score color class
  const getScoreClass = (score: number): string => {
    if (score >= 0.6) return 'v3-analysis-pane__score--success';
    if (score >= 0.4) return 'v3-analysis-pane__score--warning';
    return 'v3-analysis-pane__score--error';
  };

  // Get completeness color class
  const getCompletenessClass = (classification: string): string => {
    switch (classification) {
      case 'COMPLETE': return 'v3-analysis-pane__completeness--complete';
      case 'EXCERPT': return 'v3-analysis-pane__completeness--excerpt';
      default: return 'v3-analysis-pane__completeness--uncertain';
    }
  };

  // Get Chekhov grade color
  const getChekhovGradeClass = (grade: string): string => {
    switch (grade) {
      case 'HUMAN_LIKE': return 'v3-analysis-pane__chekhov--human';
      case 'AI_LIKE': return 'v3-analysis-pane__chekhov--ai';
      default: return 'v3-analysis-pane__chekhov--mixed';
    }
  };

  return (
    <div className="v3-analysis-pane">
      {/* Header */}
      <div className="v3-analysis-pane__header">
        <div className="v3-analysis-pane__title">
          V3 Local Detection
          <span className="v3-analysis-pane__subtitle">Chekhov Ratio + Completeness</span>
        </div>
      </div>

      {/* Character Count */}
      <div className="v3-analysis-pane__char-count">
        <div className="v3-analysis-pane__char-count-header">
          <span>{content.length.toLocaleString()} chars</span>
          <span className="v3-analysis-pane__char-count-words">
            ~{Math.round(content.split(/\s+/).filter(w => w).length)} words
          </span>
        </div>
      </div>

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={isAnalyzing || !content.trim() || content.trim().length < 100}
        className="v3-analysis-pane__btn-primary"
      >
        {isAnalyzing ? 'Analyzing...' : 'Run V3 Analysis'}
      </button>

      {/* Info Box */}
      <div className="v3-analysis-pane__info">
        <div className="v3-analysis-pane__info-text">
          <strong>Local-first detection.</strong> No API calls. Measures specificity fulfillment
          (Chekhov ratio) and adjusts for excerpt vs complete work.
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="v3-analysis-pane__error">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="v3-analysis-pane__results">
          {/* Classification Header */}
          <div className={`v3-analysis-pane__classification ${getClassificationClass(result.classification)}`}>
            <div className="v3-analysis-pane__classification-label">
              {result.classification.replace('_', ' ')}
            </div>
            <div className="v3-analysis-pane__classification-confidence">
              {Math.round(result.confidence * 100)}% confidence
            </div>
          </div>

          {/* Completeness Assessment */}
          <div className={`v3-analysis-pane__completeness ${getCompletenessClass(result.completeness.classification)}`}>
            <div className="v3-analysis-pane__completeness-row">
              <span className="v3-analysis-pane__completeness-label">Completeness:</span>
              <span className="v3-analysis-pane__completeness-value">
                {result.completeness.classification}
              </span>
              <span className="v3-analysis-pane__completeness-weight">
                Chekhov weight: {Math.round(result.completeness.chekhovWeight * 100)}%
              </span>
            </div>
          </div>

          {/* Score Cards */}
          <div className="v3-analysis-pane__scores">
            <div className={`v3-analysis-pane__score-card ${getScoreClass(result.scores.composite)}`}>
              <div className="v3-analysis-pane__score-label">Composite</div>
              <div className="v3-analysis-pane__score-value">
                {Math.round(result.scores.composite * 100)}%
              </div>
            </div>
            <div className={`v3-analysis-pane__score-card ${getScoreClass(result.scores.chekhovScore)}`}>
              <div className="v3-analysis-pane__score-label">Chekhov</div>
              <div className="v3-analysis-pane__score-value">
                {Math.round(result.scores.chekhovScore * 100)}%
              </div>
            </div>
            <div className={`v3-analysis-pane__score-card ${getScoreClass(result.scores.perplexityScore)}`}>
              <div className="v3-analysis-pane__score-label">Perplexity</div>
              <div className="v3-analysis-pane__score-value">
                {Math.round(result.scores.perplexityScore * 100)}%
              </div>
            </div>
            <div className={`v3-analysis-pane__score-card ${getScoreClass(result.scores.burstiessScore)}`}>
              <div className="v3-analysis-pane__score-label">Burstiness</div>
              <div className="v3-analysis-pane__score-value">
                {Math.round(result.scores.burstiessScore * 100)}%
              </div>
            </div>
          </div>

          {/* Chekhov Details */}
          <div className="v3-analysis-pane__chekhov-section">
            <div className="v3-analysis-pane__section-title">
              Chekhov Ratio Analysis
              <span className={`v3-analysis-pane__chekhov-grade ${getChekhovGradeClass(result.chekhov.chekhovGrade)}`}>
                {result.chekhov.chekhovGrade.replace('_', ' ')}
              </span>
            </div>
            <div className="v3-analysis-pane__chekhov-stats">
              <div className="v3-analysis-pane__stat">
                <span className="v3-analysis-pane__stat-label">Total Entities:</span>
                <span className="v3-analysis-pane__stat-value">{result.chekhov.totalEntities}</span>
              </div>
              <div className="v3-analysis-pane__stat">
                <span className="v3-analysis-pane__stat-label">Fulfilled:</span>
                <span className="v3-analysis-pane__stat-value v3-analysis-pane__stat-value--success">
                  {result.chekhov.fulfilledCount}
                </span>
              </div>
              <div className="v3-analysis-pane__stat">
                <span className="v3-analysis-pane__stat-label">Orphaned:</span>
                <span className="v3-analysis-pane__stat-value v3-analysis-pane__stat-value--error">
                  {result.chekhov.orphanedCount}
                </span>
              </div>
            </div>

            {/* Orphaned Entities Toggle */}
            {result.chekhov.orphanedCount > 0 && (
              <div className="v3-analysis-pane__orphaned-section">
                <button
                  className="v3-analysis-pane__toggle-btn"
                  onClick={() => setShowOrphanedEntities(!showOrphanedEntities)}
                >
                  {showOrphanedEntities ? '▼' : '▶'} Orphaned Entities ({result.chekhov.orphanedCount})
                </button>
                {showOrphanedEntities && (
                  <div className="v3-analysis-pane__orphaned-list">
                    {result.chekhov.orphanedEntities.slice(0, 10).map((entity, i) => (
                      <div key={i} className="v3-analysis-pane__orphaned-item">
                        <span className="v3-analysis-pane__orphaned-type">{entity.type}</span>
                        <span className="v3-analysis-pane__orphaned-text">"{entity.text}"</span>
                        <span className="v3-analysis-pane__orphaned-position">
                          @ {Math.round(entity.firstPosition * 100)}%
                        </span>
                      </div>
                    ))}
                    {result.chekhov.orphanedCount > 10 && (
                      <div className="v3-analysis-pane__orphaned-more">
                        +{result.chekhov.orphanedCount - 10} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Flagged Sentences */}
          {result.sentences.filter(s => s.flags.length > 0).length > 0 && (
            <div className="v3-analysis-pane__flagged-section">
              <button
                className="v3-analysis-pane__toggle-btn"
                onClick={() => setShowFlaggedSentences(!showFlaggedSentences)}
              >
                {showFlaggedSentences ? '▼' : '▶'} Flagged Sentences (
                {result.sentences.filter(s => s.flags.length > 0).length})
              </button>
              {showFlaggedSentences && (
                <div className="v3-analysis-pane__flagged-list">
                  {result.sentences
                    .filter(s => s.flags.length > 0)
                    .slice(0, 5)
                    .map((sentence, i) => (
                      <div key={i} className="v3-analysis-pane__flagged-item">
                        <div className="v3-analysis-pane__flagged-flags">
                          {sentence.flags.map((flag, j) => (
                            <span key={j} className="v3-analysis-pane__flag-tag">{flag}</span>
                          ))}
                        </div>
                        <div className="v3-analysis-pane__flagged-text">
                          "{sentence.text.slice(0, 100)}{sentence.text.length > 100 ? '...' : ''}"
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Transformations Preview */}
          {result.transformations.length > 0 && (
            <div className="v3-analysis-pane__transforms-section">
              <div className="v3-analysis-pane__section-title">
                Suggested Transformations ({result.transformations.length})
              </div>
              <div className="v3-analysis-pane__transforms-list">
                {result.transformations.slice(0, 3).map((t, i) => (
                  <div key={i} className={`v3-analysis-pane__transform v3-analysis-pane__transform--${t.priority}`}>
                    <div className="v3-analysis-pane__transform-header">
                      <span className="v3-analysis-pane__transform-type">{t.type}</span>
                      <span className="v3-analysis-pane__transform-priority">{t.priority}</span>
                    </div>
                    <div className="v3-analysis-pane__transform-suggestion">
                      {t.suggestion.slice(0, 150)}{t.suggestion.length > 150 ? '...' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Processing Time */}
          <div className="v3-analysis-pane__timing">
            Analyzed in {result.processingTimeMs}ms (local)
          </div>
        </div>
      )}

      {/* Empty State */}
      {!content.trim() && !result && (
        <div className="v3-analysis-pane__empty">
          Select text to analyze
        </div>
      )}
    </div>
  );
}
