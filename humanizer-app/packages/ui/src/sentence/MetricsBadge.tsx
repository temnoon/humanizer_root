/**
 * MetricsBadge Component
 *
 * Displays SIC score or tetralemma stance as a compact badge.
 * Uses semantic CSS classes from sentence.css
 */

import type { SentenceMetrics, TetralemmaStance } from './types';

interface MetricsBadgeProps {
  /** Type of metric to display */
  type: 'sic' | 'stance';

  /** Metric value */
  value: number | TetralemmaStance;

  /** SIC level (for sic type) */
  level?: 'low' | 'medium' | 'high';

  /** Size variant */
  size?: 'small' | 'medium';

  /** Show label */
  showLabel?: boolean;

  /** Additional className */
  className?: string;
}

const STANCE_LABELS: Record<TetralemmaStance, string> = {
  affirmation: 'A',
  negation: 'N',
  both: 'B',
  neither: '∅',
};

const STANCE_FULL_LABELS: Record<TetralemmaStance, string> = {
  affirmation: 'Affirmation',
  negation: 'Negation',
  both: 'Both',
  neither: 'Neither',
};

export function MetricsBadge({
  type,
  value,
  level,
  size = 'medium',
  showLabel = false,
  className = '',
}: MetricsBadgeProps) {
  if (type === 'sic') {
    const score = typeof value === 'number' ? value : 0;
    const sicLevel = level || (score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low');

    return (
      <span
        className={`metric-badge metric-badge--sic-${sicLevel} ${className}`}
        title={`SIC Score: ${score}`}
        aria-label={`SIC Score: ${score}, Level: ${sicLevel}`}
      >
        {Math.round(score)}
        {showLabel && <span className="metric-badge__label">SIC</span>}
      </span>
    );
  }

  if (type === 'stance') {
    const stance = value as TetralemmaStance;

    return (
      <span
        className={`metric-badge metric-badge--stance-${stance} ${className}`}
        title={STANCE_FULL_LABELS[stance]}
        aria-label={`Stance: ${STANCE_FULL_LABELS[stance]}`}
      >
        {STANCE_LABELS[stance]}
        {showLabel && <span className="metric-badge__label">{STANCE_FULL_LABELS[stance]}</span>}
      </span>
    );
  }

  return null;
}

/**
 * Probability bar for tetralemma visualization
 */
interface ProbabilityBarProps {
  probs: {
    affirmation: number;
    negation: number;
    both: number;
    neither: number;
  };
  className?: string;
}

export function ProbabilityBar({ probs, className = '' }: ProbabilityBarProps) {
  return (
    <div className={`probability-bar ${className}`} role="img" aria-label="Tetralemma probabilities">
      <div
        className="probability-bar__segment probability-bar__segment--affirmation"
        style={{ width: `${probs.affirmation * 100}%` }}
        title={`Affirmation: ${(probs.affirmation * 100).toFixed(1)}%`}
      />
      <div
        className="probability-bar__segment probability-bar__segment--negation"
        style={{ width: `${probs.negation * 100}%` }}
        title={`Negation: ${(probs.negation * 100).toFixed(1)}%`}
      />
      <div
        className="probability-bar__segment probability-bar__segment--both"
        style={{ width: `${probs.both * 100}%` }}
        title={`Both: ${(probs.both * 100).toFixed(1)}%`}
      />
      <div
        className="probability-bar__segment probability-bar__segment--neither"
        style={{ width: `${probs.neither * 100}%` }}
        title={`Neither: ${(probs.neither * 100).toFixed(1)}%`}
      />
    </div>
  );
}

export default MetricsBadge;
