/**
 * Density Matrix Statistics Display Component
 *
 * Shows key properties of the density matrix (ρ):
 * - Purity: Tr(ρ²) ∈ [1/32, 1] (measures how "definite" the state is)
 * - Entropy: -Tr(ρ log ρ) ∈ [0, ln(32)] (measures uncertainty)
 * - Top eigenvalues: Dominant components of the state
 */

interface DensityMatrixStatsProps {
  purity: number;
  entropy: number;
  topEigenvalues: number[];
  label?: string;
}

export function DensityMatrixStats({
  purity,
  entropy,
  topEigenvalues,
  label
}: DensityMatrixStatsProps) {
  // Constants for 32×32 matrix
  const MIN_PURITY = 1 / 32; // Maximally mixed
  const MAX_PURITY = 1.0;    // Pure state
  const MAX_ENTROPY = Math.log(32); // ln(32) ≈ 3.466

  // Normalize for display
  const purityPercent = ((purity - MIN_PURITY) / (MAX_PURITY - MIN_PURITY)) * 100;
  const entropyPercent = (entropy / MAX_ENTROPY) * 100;

  // Interpret state
  let stateDescription = '';
  if (purity > 0.5) {
    stateDescription = 'Highly coherent - specific interpretation forming';
  } else if (purity > 0.2) {
    stateDescription = 'Moderate coherence - meaning crystallizing';
  } else if (purity > 0.1) {
    stateDescription = 'Low coherence - still exploring possibilities';
  } else {
    stateDescription = 'Minimal coherence - maximum uncertainty';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {label && (
        <div style={{
          color: 'var(--accent-purple)',
          fontWeight: 600,
          fontSize: 'var(--text-sm)'
        }}>
          {label}
        </div>
      )}

      {/* Purity */}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--spacing-xs)' }}>
          <span style={{
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)'
          }}>
            Purity (Tr(ρ²))
          </span>
          <span style={{
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)'
          }}>
            {purity.toFixed(4)}
          </span>
        </div>
        <div style={{
          width: '100%',
          background: 'var(--bg-secondary)',
          borderRadius: '999px',
          height: '8px',
          overflow: 'hidden'
        }}>
          <div
            style={{
              background: 'linear-gradient(to right, var(--accent-blue), var(--accent-cyan))',
              height: '100%',
              borderRadius: '999px',
              transition: 'width 0.5s',
              width: `${Math.min(purityPercent, 100)}%`
            }}
          />
        </div>
        <div style={{
          color: 'var(--text-tertiary)',
          fontSize: 'var(--text-xs)',
          marginTop: 'var(--spacing-xs)'
        }}>
          {purityPercent.toFixed(1)}% of maximum (1 = pure, {MIN_PURITY.toFixed(4)} = mixed)
        </div>
      </div>

      {/* Entropy */}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--spacing-xs)' }}>
          <span style={{
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)'
          }}>
            Entropy (-Tr(ρ log ρ))
          </span>
          <span style={{
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)'
          }}>
            {entropy.toFixed(4)}
          </span>
        </div>
        <div style={{
          width: '100%',
          background: 'var(--bg-secondary)',
          borderRadius: '999px',
          height: '8px',
          overflow: 'hidden'
        }}>
          <div
            style={{
              background: 'linear-gradient(to right, var(--accent-orange), var(--accent-red))',
              height: '100%',
              borderRadius: '999px',
              transition: 'width 0.5s',
              width: `${100 - Math.min(entropyPercent, 100)}%`
            }}
          />
        </div>
        <div style={{
          color: 'var(--text-tertiary)',
          fontSize: 'var(--text-xs)',
          marginTop: 'var(--spacing-xs)'
        }}>
          {(100 - entropyPercent).toFixed(1)}% below maximum (0 = certain, {MAX_ENTROPY.toFixed(3)} = uncertain)
        </div>
      </div>

      {/* Top Eigenvalues */}
      <div>
        <div style={{
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)',
          marginBottom: 'var(--spacing-xs)'
        }}>
          Top 5 Eigenvalues
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 'var(--spacing-xs)'
        }}>
          {topEigenvalues.slice(0, 5).map((eigenvalue, i) => (
            <div key={i} style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--spacing-xs)',
              textAlign: 'center'
            }}>
              <div style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)'
              }}>
                {eigenvalue.toFixed(3)}
              </div>
              <div style={{
                color: 'var(--text-tertiary)',
                fontSize: '10px'
              }}>
                λ{i + 1}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* State Interpretation */}
      <div style={{
        background: 'var(--accent-purple-alpha-10)',
        borderRadius: 'var(--radius-sm)',
        padding: 'var(--spacing-sm)',
        border: '1px solid var(--accent-purple)'
      }}>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-xs)',
          fontStyle: 'italic',
          margin: 0
        }}>
          {stateDescription}
        </p>
      </div>
    </div>
  );
}
