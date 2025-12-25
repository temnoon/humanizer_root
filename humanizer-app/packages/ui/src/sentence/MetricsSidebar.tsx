/**
 * MetricsSidebar Component
 *
 * Slide-out panel showing detailed metrics for a selected sentence.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { SentenceMetrics, SemanticPosition } from './types';
import { MetricsBadge, ProbabilityBar } from './MetricsBadge';

interface MetricsSidebarProps {
  /** Whether the sidebar is open */
  isOpen: boolean;

  /** Called to close the sidebar */
  onClose: () => void;

  /** The selected sentence metrics */
  metrics: SentenceMetrics | null;

  /** Show vector position (5D analysis) */
  showPosition?: boolean;

  /** Show craft metrics */
  showCraft?: boolean;

  /** Additional className */
  className?: string;
}

/**
 * Metric row component for displaying label/value pairs
 */
function MetricRow({
  label,
  value,
  format = 'text',
}: {
  label: string;
  value: string | number;
  format?: 'text' | 'number' | 'percent';
}) {
  let displayValue = value;
  if (format === 'number' && typeof value === 'number') {
    displayValue = value.toFixed(2);
  } else if (format === 'percent' && typeof value === 'number') {
    displayValue = `${(value * 100).toFixed(1)}%`;
  }

  return (
    <div className="metric-row">
      <span className="metric-row__label">{label}</span>
      <span className="metric-row__value">{displayValue}</span>
    </div>
  );
}

/**
 * Dimension bar for position visualization
 */
function DimensionRow({
  label,
  value,
  min = -1,
  max = 1,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
}) {
  // Normalize to 0-100%
  const normalized = ((value - min) / (max - min)) * 100;
  const displayValue = value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);

  return (
    <div className="dimension-row">
      <span className="dimension-row__label">{label}</span>
      <div className="dimension-row__bar">
        <div
          className="dimension-row__fill"
          style={{ width: `${normalized}%` }}
        />
      </div>
      <span className="dimension-row__value">{displayValue}</span>
    </div>
  );
}

export function MetricsSidebar({
  isOpen,
  onClose,
  metrics,
  showPosition = true,
  showCraft = true,
  className = '',
}: MetricsSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside
  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!metrics) return null;

  const sidebarClasses = [
    'metrics-sidebar',
    isOpen && 'metrics-sidebar--open',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="metrics-sidebar__backdrop"
          onClick={handleBackdropClick}
          aria-hidden="true"
          style={{ background: 'transparent' }} // Transparent backdrop for sidebar
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={sidebarClasses}
        role="complementary"
        aria-label="Sentence metrics"
        aria-hidden={!isOpen}
      >
        <header className="metrics-sidebar__header">
          <h2 className="metrics-sidebar__title">Sentence Analysis</h2>
          <button
            className="metrics-sidebar__close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </header>

        <div className="metrics-sidebar__content">
          {/* Sentence preview */}
          <blockquote className="metrics-sidebar__sentence-preview">
            "{metrics.text}"
          </blockquote>

          {/* SIC Score */}
          <section>
            <h3 className="metric-section__title">SIC Analysis</h3>
            <div className="metric-section__content">
              <div className="metric-row">
                <span className="metric-row__label">Score</span>
                <MetricsBadge
                  type="sic"
                  value={metrics.sicScore}
                  level={metrics.sicLevel}
                />
              </div>
              <MetricRow label="Level" value={metrics.sicLevel} />
            </div>
          </section>

          {/* Tetralemma */}
          <section>
            <h3 className="metric-section__title">Tetralemma</h3>
            <div className="metric-section__content">
              <div className="metric-row">
                <span className="metric-row__label">Stance</span>
                <MetricsBadge type="stance" value={metrics.dominantStance} />
              </div>
              <MetricRow label="Entropy" value={metrics.entropy} format="number" />

              <div style={{ marginTop: 'var(--space-small)' }}>
                <ProbabilityBar probs={metrics.tetralemma} />
              </div>

              <div style={{ marginTop: 'var(--space-small)' }}>
                <MetricRow
                  label="Affirmation"
                  value={metrics.tetralemma.affirmation}
                  format="percent"
                />
                <MetricRow
                  label="Negation"
                  value={metrics.tetralemma.negation}
                  format="percent"
                />
                <MetricRow
                  label="Both"
                  value={metrics.tetralemma.both}
                  format="percent"
                />
                <MetricRow
                  label="Neither"
                  value={metrics.tetralemma.neither}
                  format="percent"
                />
              </div>
            </div>
          </section>

          {/* 5D Position (if available) */}
          {showPosition && metrics.position && (
            <section>
              <h3 className="metric-section__title">Semantic Position</h3>
              <div className="dimension-list">
                <DimensionRow label="Epistemic" value={metrics.position.epistemic} />
                <DimensionRow label="Commitment" value={metrics.position.commitment} />
                <DimensionRow label="Temporal" value={metrics.position.temporal} />
                <DimensionRow label="Embodiment" value={metrics.position.embodiment} />
                <DimensionRow label="Stakes" value={metrics.position.stakes} />
              </div>
            </section>
          )}

          {/* Craft Metrics (if available) */}
          {showCraft && metrics.craft && (
            <section>
              <h3 className="metric-section__title">Craft Metrics</h3>
              <div className="dimension-list">
                <DimensionRow
                  label="Compression"
                  value={metrics.craft.compression}
                  min={0}
                  max={1}
                />
                <DimensionRow
                  label="Surprise"
                  value={metrics.craft.surprise}
                  min={0}
                  max={1}
                />
                <DimensionRow
                  label="Specificity"
                  value={metrics.craft.specificity}
                  min={0}
                  max={1}
                />
                <DimensionRow
                  label="Tension"
                  value={metrics.craft.tension}
                  min={0}
                  max={1}
                />
                <DimensionRow
                  label="Velocity"
                  value={metrics.craft.velocity}
                  min={0}
                  max={1}
                />
              </div>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}

export default MetricsSidebar;
