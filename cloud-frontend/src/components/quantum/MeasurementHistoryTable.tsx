/**
 * MeasurementHistoryTable - Compact table of previous measurements
 *
 * Features:
 * - Collapsed rows showing sentence number and dominant corner
 * - Hover/touch to expand full measurement details
 * - Click to jump to that sentence in narrative
 */

import { useState } from 'react';
import { TetralemmaViz } from './TetralemmaViz';
import { DensityMatrixStats } from './DensityMatrixStats';

interface Measurement {
  sentence_index: number;
  sentence: string;
  measurement: {
    literal: { probability: number; evidence: string };
    metaphorical: { probability: number; evidence: string };
    both: { probability: number; evidence: string };
    neither: { probability: number; evidence: string };
  };
  rho_before: {
    purity: number;
    entropy: number;
    top_eigenvalues: number[];
  };
  rho_after: {
    purity: number;
    entropy: number;
    top_eigenvalues: number[];
  };
}

interface MeasurementHistoryTableProps {
  measurements: Measurement[];
  onSentenceSelect?: (index: number) => void;
}

export function MeasurementHistoryTable({ measurements, onSentenceSelect }: MeasurementHistoryTableProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const getDominantCorner = (measurement: Measurement['measurement']) => {
    const corners = [
      { name: 'Literal', prob: measurement.literal.probability, color: 'var(--accent-blue)' },
      { name: 'Metaphorical', prob: measurement.metaphorical.probability, color: 'var(--accent-purple)' },
      { name: 'Both', prob: measurement.both.probability, color: 'var(--accent-green)' },
      { name: 'Neither', prob: measurement.neither.probability, color: 'var(--accent-orange)' }
    ];
    return corners.reduce((max, corner) => corner.prob > max.prob ? corner : max);
  };

  if (measurements.length === 0) {
    return null;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--spacing-xs)'
    }}>
      <h4 style={{
        color: 'var(--text-secondary)',
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        marginBottom: 'var(--spacing-sm)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        Previous Sentences ({measurements.length})
      </h4>

      {measurements.map((measurement) => {
        const dominant = getDominantCorner(measurement.measurement);
        const isExpanded = expandedIndex === measurement.sentence_index;

        return (
          <div
            key={measurement.sentence_index}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              transition: 'all 0.2s'
            }}
          >
            {/* Collapsed Row */}
            <div
              onClick={() => {
                setExpandedIndex(isExpanded ? null : measurement.sentence_index);
                if (onSentenceSelect && !isExpanded) {
                  onSentenceSelect(measurement.sentence_index);
                }
              }}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                cursor: 'pointer',
                display: 'grid',
                gridTemplateColumns: '40px 1fr 100px 60px',
                alignItems: 'center',
                gap: 'var(--spacing-md)',
                background: isExpanded ? 'var(--bg-secondary)' : 'transparent',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isExpanded) {
                  e.currentTarget.style.background = 'var(--bg-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isExpanded) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {/* Sentence Number */}
              <div style={{
                color: 'var(--text-tertiary)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)'
              }}>
                #{measurement.sentence_index + 1}
              </div>

              {/* Sentence Preview */}
              <div style={{
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {measurement.sentence}
              </div>

              {/* Dominant Corner */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                fontSize: 'var(--text-xs)'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: dominant.color
                }} />
                <span style={{ color: 'var(--text-secondary)' }}>
                  {dominant.name}
                </span>
              </div>

              {/* Purity */}
              <div style={{
                color: 'var(--text-tertiary)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                textAlign: 'right'
              }}>
                {measurement.rho_after.purity.toFixed(3)}
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div style={{
                padding: 'var(--spacing-md)',
                borderTop: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)'
              }}>
                <p style={{
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-base)',
                  marginBottom: 'var(--spacing-lg)',
                  fontStyle: 'italic'
                }}>
                  "{measurement.sentence}"
                </p>

                <TetralemmaViz measurement={measurement.measurement} />

                <div style={{
                  marginTop: 'var(--spacing-lg)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: 'var(--spacing-md)'
                }}>
                  <div style={{
                    background: 'var(--accent-purple-alpha-10)',
                    border: '1px solid var(--accent-purple)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--spacing-md)'
                  }}>
                    <h5 style={{
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      marginBottom: 'var(--spacing-sm)',
                      fontSize: 'var(--text-sm)'
                    }}>
                      ρ After
                    </h5>
                    <DensityMatrixStats
                      purity={measurement.rho_after.purity}
                      entropy={measurement.rho_after.entropy}
                      topEigenvalues={measurement.rho_after.top_eigenvalues}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
