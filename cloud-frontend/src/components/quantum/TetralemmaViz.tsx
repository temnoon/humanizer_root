/**
 * Tetralemma (Four-Corner) Visualization Component
 *
 * Displays POVM measurement results across all four Catuskoti corners:
 * - Literal (A, not metaphorical)
 * - Metaphorical (¬A, not literal)
 * - Both (literal AND metaphorical)
 * - Neither (transcends the distinction)
 */

interface CornerData {
  probability: number;
  evidence: string;
}

interface TetralemmaMeasurement {
  literal: CornerData;
  metaphorical: CornerData;
  both: CornerData;
  neither: CornerData;
}

interface TetralemmaVizProps {
  measurement: TetralemmaMeasurement;
}

export function TetralemmaViz({ measurement }: TetralemmaVizProps) {
  const corners = [
    {
      key: 'literal',
      label: 'Literal',
      description: 'Direct, not metaphorical',
      data: measurement.literal,
      bgColor: 'var(--accent-blue)',
      borderColor: 'var(--accent-blue)'
    },
    {
      key: 'metaphorical',
      label: 'Metaphorical',
      description: 'Symbolic, not literal',
      data: measurement.metaphorical,
      bgColor: 'var(--accent-purple)',
      borderColor: 'var(--accent-purple)'
    },
    {
      key: 'both',
      label: 'Both',
      description: 'Simultaneously literal AND metaphorical',
      data: measurement.both,
      bgColor: 'var(--accent-green)',
      borderColor: 'var(--accent-green)'
    },
    {
      key: 'neither',
      label: 'Neither',
      description: 'Transcends the distinction',
      data: measurement.neither,
      bgColor: 'var(--accent-orange)',
      borderColor: 'var(--accent-orange)'
    }
  ];

  // Find dominant corner
  const dominant = corners.reduce((max, corner) =>
    corner.data.probability > max.data.probability ? corner : max
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--spacing-sm)' }}>
        <h4 style={{
          color: 'var(--text-primary)',
          fontWeight: 600,
          fontSize: 'var(--text-lg)'
        }}>
          Tetralemma Measurement
        </h4>
        <span style={{
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)'
        }}>
          Dominant: <span style={{ fontWeight: 600 }}>{dominant.label}</span>
        </span>
      </div>

      {/* Four Corners Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 'var(--spacing-md)'
      }}>
        {corners.map((corner) => (
          <Corner
            key={corner.key}
            label={corner.label}
            description={corner.description}
            probability={corner.data.probability}
            evidence={corner.data.evidence}
            bgColor={corner.bgColor}
            borderColor={corner.borderColor}
            isDominant={corner.key === dominant.key}
          />
        ))}
      </div>

      {/* Probability Sum Validation */}
      <div className="text-center" style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--text-tertiary)'
      }}>
        Σ probabilities = {(
          measurement.literal.probability +
          measurement.metaphorical.probability +
          measurement.both.probability +
          measurement.neither.probability
        ).toFixed(3)}
        {Math.abs((
          measurement.literal.probability +
          measurement.metaphorical.probability +
          measurement.both.probability +
          measurement.neither.probability
        ) - 1.0) > 0.01 && (
          <span style={{
            color: 'var(--accent-red)',
            marginLeft: 'var(--spacing-sm)'
          }}>
            ⚠️ Does not sum to 1.0
          </span>
        )}
      </div>
    </div>
  );
}

interface CornerProps {
  label: string;
  description: string;
  probability: number;
  evidence: string;
  bgColor: string;
  borderColor: string;
  isDominant: boolean;
}

function Corner({
  label,
  description,
  probability,
  evidence,
  bgColor,
  borderColor,
  isDominant
}: CornerProps) {
  const percentage = (probability * 100).toFixed(1);

  return (
    <div
      style={{
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-md)',
        border: `2px solid ${borderColor}`,
        boxShadow: isDominant ? '0 0 0 3px var(--accent-yellow)' : 'none',
        transition: 'all 0.3s'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--spacing-md)' }}>
        <div>
          <h5 style={{
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: 'var(--text-lg)'
          }}>
            {label}
          </h5>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-xs)'
          }}>
            {description}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            color: 'var(--text-primary)'
          }}>
            {percentage}%
          </div>
          {isDominant && (
            <div style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--accent-yellow)',
              fontWeight: 600
            }}>
              ★ Dominant
            </div>
          )}
        </div>
      </div>

      {/* Probability Bar */}
      <div style={{
        width: '100%',
        background: 'var(--bg-secondary)',
        borderRadius: '999px',
        height: '12px',
        marginBottom: 'var(--spacing-md)',
        overflow: 'hidden'
      }}>
        <div
          style={{
            background: bgColor,
            height: '100%',
            borderRadius: '999px',
            transition: 'width 0.5s ease-out',
            width: `${Math.min(probability * 100, 100)}%`
          }}
        />
      </div>

      {/* Evidence */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-sm)',
        padding: 'var(--spacing-md)'
      }}>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)',
          fontStyle: 'italic'
        }}>
          "{evidence}"
        </p>
      </div>
    </div>
  );
}
