/**
 * SICAnalysisPane - Subjective Intentional Constraint Analysis
 *
 * Novel AI detection through constraint analysis.
 * Measures the "cost of authorship" - the traces of human constraint in text.
 *
 * Core insight: "Human language is not defined by how it flows, but by how it binds."
 *
 * Features measured:
 * - commitment_irreversibility: Definitive stances with consequences
 * - epistemic_risk_uncertainty: Being wrong that mattered
 * - time_pressure_tradeoffs: Urgency, deadlines
 * - situatedness_body_social: Physical/social grounding
 * - scar_tissue_specificity: Persistent residue
 * - bounded_viewpoint: Non-omniscient narration
 * - anti_smoothing: Refusal of symmetry
 * - meta_contamination: Preambles, manager voice (negative)
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  sicAnalysis,
  type SicAnalysisResult,
  type SicFeatureScore,
} from '../../services/transformationService';
import {
  validateTextLength,
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

// Feature display names and descriptions
const FEATURE_INFO: Record<string, { name: string; description: string; isNegative?: boolean }> = {
  commitment_irreversibility: {
    name: 'Commitment',
    description: 'Definitive stances with consequences. "Humans trap themselves."',
  },
  epistemic_risk_uncertainty: {
    name: 'Epistemic Risk',
    description: 'Being wrong, surprises, ignorance that mattered.',
  },
  time_pressure_tradeoffs: {
    name: 'Time Pressure',
    description: 'Urgency, deadlines, asymmetric time awareness.',
  },
  situatedness_body_social: {
    name: 'Situatedness',
    description: 'Embodied risk, social cost, physical grounding.',
  },
  scar_tissue_specificity: {
    name: 'Scar Tissue',
    description: 'Persistent residue: "still flinch", "keeps me up".',
  },
  bounded_viewpoint: {
    name: 'Bounded View',
    description: 'Non-omniscient narration. Acknowledges not knowing.',
  },
  anti_smoothing: {
    name: 'Anti-Smoothing',
    description: 'Takes sides. Refuses "on one hand / on the other".',
  },
  meta_contamination: {
    name: 'Meta Contamination',
    description: 'Preambles, "in conclusion", manager voice.',
    isNegative: true,
  },
};

interface SICAnalysisPaneProps {
  content: string;
  onHighlightText?: (highlights: Array<{ start: number; end: number; reason: string }>) => void;
}

export function SICAnalysisPane({ content, onHighlightText }: SICAnalysisPaneProps) {
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SicAnalysisResult | null>(null);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  const userTier = getUserTier(user?.role);

  const handleAnalyze = async () => {
    if (!content.trim()) {
      setError('No content to analyze');
      return;
    }

    // Pre-validate text length
    const lengthValidation = validateTextLength(content, 'ai-detection', userTier);
    if (lengthValidation) {
      setError(lengthValidation.error);
      return;
    }

    if (content.trim().length < 50) {
      setError('Text must be at least 50 characters for SIC analysis');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const analysisResult = await sicAnalysis(content);
      setResult(analysisResult);
    } catch (err) {
      console.error('SIC analysis failed:', err);
      setError(err instanceof Error ? err.message : 'SIC analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Get score color class
  const getScoreColorClass = (score: number, isNegative?: boolean): string => {
    // For negative features, HIGH is bad
    if (isNegative) {
      if (score > 55) return 'sic-analysis-pane__score--error';
      if (score > 35) return 'sic-analysis-pane__score--warning';
      return 'sic-analysis-pane__score--success';
    }
    // For positive features, LOW is bad
    if (score < 35) return 'sic-analysis-pane__score--error';
    if (score < 55) return 'sic-analysis-pane__score--warning';
    return 'sic-analysis-pane__score--success';
  };

  // Get overall score color
  const getOverallColorClass = (sicScore: number): string => {
    if (sicScore < 35) return 'sic-analysis-pane__overall--error';
    if (sicScore < 55) return 'sic-analysis-pane__overall--warning';
    return 'sic-analysis-pane__overall--success';
  };

  // Get AI probability color
  const getAIProbColorClass = (aiProb: number): string => {
    if (aiProb > 0.65) return 'sic-analysis-pane__aiprob--error';
    if (aiProb > 0.35) return 'sic-analysis-pane__aiprob--warning';
    return 'sic-analysis-pane__aiprob--success';
  };

  // Render feature bar
  const renderFeatureBar = (key: string, feature: SicFeatureScore) => {
    const info = FEATURE_INFO[key];
    if (!info) return null;

    const isGap = result?.constraintGaps.includes(key);
    const isExpanded = expandedFeature === key;

    return (
      <div
        key={key}
        className={`sic-analysis-pane__feature ${isGap ? 'sic-analysis-pane__feature--gap' : ''}`}
      >
        <div
          className="sic-analysis-pane__feature-header"
          onClick={() => setExpandedFeature(isExpanded ? null : key)}
        >
          <div className="sic-analysis-pane__feature-name">
            <span className="sic-analysis-pane__feature-expand">
              {isExpanded ? '▼' : '▶'}
            </span>
            {info.name}
            {isGap && <span className="sic-analysis-pane__gap-badge">GAP</span>}
            {info.isNegative && <span className="sic-analysis-pane__negative-badge">-</span>}
          </div>
          <div className={`sic-analysis-pane__feature-score ${getScoreColorClass(feature.score, info.isNegative)}`}>
            {feature.score}
          </div>
        </div>

        <div className="sic-analysis-pane__feature-bar">
          <div
            className={`sic-analysis-pane__feature-fill ${getScoreColorClass(feature.score, info.isNegative)}`}
            style={{ width: `${feature.score}%` }}
          />
        </div>

        {isExpanded && (
          <div className="sic-analysis-pane__feature-details">
            <div className="sic-analysis-pane__feature-description">
              {info.description}
            </div>
            {feature.notes && (
              <div className="sic-analysis-pane__feature-notes">
                {feature.notes}
              </div>
            )}
            {feature.evidence && feature.evidence.length > 0 && (
              <div className="sic-analysis-pane__feature-evidence">
                <div className="sic-analysis-pane__evidence-title">Evidence:</div>
                {feature.evidence.slice(0, 3).map((e, i) => (
                  <div key={i} className="sic-analysis-pane__evidence-item">
                    <span className="sic-analysis-pane__evidence-quote">"{e.quote}"</span>
                    <span className="sic-analysis-pane__evidence-relevance">{e.relevance}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="sic-analysis-pane">
      {/* Header */}
      <div className="sic-analysis-pane__header">
        <div className="sic-analysis-pane__title">
          SIC Analysis
          <span className="sic-analysis-pane__subtitle">Subjective Intentional Constraint</span>
        </div>
      </div>

      {/* Character Count */}
      <div className="sic-analysis-pane__char-count">
        <div className="sic-analysis-pane__char-count-header">
          <span>{content.length.toLocaleString()} / {getCharLimit('ai-detection', userTier).toLocaleString()} chars</span>
          {content.length > getCharLimit('ai-detection', userTier) && (
            <span className="sic-analysis-pane__char-count-over">
              {(content.length - getCharLimit('ai-detection', userTier)).toLocaleString()} over limit
            </span>
          )}
        </div>
        <div className="sic-analysis-pane__char-count-bar">
          <div
            className={`sic-analysis-pane__char-count-fill ${
              content.length > getCharLimit('ai-detection', userTier)
                ? 'sic-analysis-pane__char-count-fill--error'
                : content.length > getCharLimit('ai-detection', userTier) * 0.8
                ? 'sic-analysis-pane__char-count-fill--warning'
                : 'sic-analysis-pane__char-count-fill--success'
            }`}
            style={{ width: `${Math.min((content.length / getCharLimit('ai-detection', userTier)) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={isAnalyzing || !content.trim() || content.trim().length < 50}
        className="sic-analysis-pane__btn-primary"
      >
        {isAnalyzing ? 'Analyzing...' : 'Run SIC Analysis'}
      </button>

      {/* Info Box */}
      <div className="sic-analysis-pane__info">
        <div className="sic-analysis-pane__info-text">
          SIC measures <strong>constraint traces</strong> in text—the "cost of authorship" that humans pay but LLMs avoid.
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="sic-analysis-pane__error">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="sic-analysis-pane__results">
          {/* Overall Scores */}
          <div className="sic-analysis-pane__scores-row">
            <div className={`sic-analysis-pane__score-card ${getOverallColorClass(result.sicScore)}`}>
              <div className="sic-analysis-pane__score-label">SIC Score</div>
              <div className="sic-analysis-pane__score-value">{result.sicScore}</div>
              <div className="sic-analysis-pane__score-hint">
                {result.sicScore < 35 ? 'Low constraint' : result.sicScore < 55 ? 'Mixed' : 'High constraint'}
              </div>
            </div>
            <div className={`sic-analysis-pane__score-card ${getAIProbColorClass(result.aiProbability)}`}>
              <div className="sic-analysis-pane__score-label">AI Probability</div>
              <div className="sic-analysis-pane__score-value">{Math.round(result.aiProbability * 100)}%</div>
              <div className="sic-analysis-pane__score-hint">
                {result.aiProbability > 0.65 ? 'Likely AI' : result.aiProbability > 0.35 ? 'Mixed' : 'Likely Human'}
              </div>
            </div>
          </div>

          {/* Genre */}
          <div className="sic-analysis-pane__genre">
            <span className="sic-analysis-pane__genre-label">Detected Genre:</span>
            <span className="sic-analysis-pane__genre-value">{result.genre}</span>
          </div>

          {/* Narrative Mode Caveat */}
          {result.narrativeModeCaveat?.isNarrativeMode && (
            <div className="sic-analysis-pane__caveat">
              <span className="sic-analysis-pane__caveat-icon">*</span>
              {result.narrativeModeCaveat.explanation}
            </div>
          )}

          {/* Constraint Gaps Summary */}
          {result.constraintGaps.length > 0 && (
            <div className="sic-analysis-pane__gaps">
              <div className="sic-analysis-pane__gaps-title">
                Constraint Gaps ({result.constraintGaps.length})
              </div>
              <div className="sic-analysis-pane__gaps-list">
                {result.constraintGaps.map(gap => (
                  <span key={gap} className="sic-analysis-pane__gap-tag">
                    {FEATURE_INFO[gap]?.name || gap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Features */}
          <div className="sic-analysis-pane__features">
            <div className="sic-analysis-pane__features-title">
              Constraint Features
            </div>
            <div className="sic-analysis-pane__features-list">
              {Object.entries(result.features).map(([key, feature]) =>
                renderFeatureBar(key, feature)
              )}
            </div>
          </div>

          {/* Notes */}
          {result.notes && (
            <div className="sic-analysis-pane__notes">
              <div className="sic-analysis-pane__notes-title">Analysis Notes</div>
              <div className="sic-analysis-pane__notes-content">{result.notes}</div>
            </div>
          )}

          {/* Processing Time */}
          <div className="sic-analysis-pane__timing">
            Processed in {(result.processingTimeMs / 1000).toFixed(1)}s
          </div>
        </div>
      )}

      {/* Empty State */}
      {!content.trim() && !result && (
        <div className="sic-analysis-pane__empty">
          Select text to analyze
        </div>
      )}
    </div>
  );
}
