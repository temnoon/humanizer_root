import { useState } from 'react';
import { useCanvas } from '../../../core/context/CanvasContext';
import { api } from '../../../core/adapters/api';

/**
 * RhoInspector - Density Matrix (ρ) State Inspector
 *
 * Analyzes the quantum state of text using density matrix formalism.
 * Computes and visualizes key quantum information metrics.
 *
 * Features:
 * - Purity measurement (Tr(ρ²))
 * - Von Neumann entropy
 * - Eigenvalue spectrum
 * - Canvas text integration
 */

interface RhoState {
  purity: number;
  entropy: number;
  eigenvalues: number[];
  trace: number;
  dimension: number;
  is_pure?: boolean;
  coherence?: number;
}

export function RhoInspector() {
  const { getActiveText } = useCanvas();
  const [result, setResult] = useState<RhoState | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInspect = async () => {
    const text = getActiveText();

    if (!text || text.trim().length === 0) {
      setError('No text to inspect. Please load text to Canvas first.');
      return;
    }

    setIsInspecting(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.rhoInspect({ text });

      // Transform response to match our interface
      // API only returns { projections: number[] }
      const eigenvalues = response.projections || [];
      const purity = eigenvalues.length > 0 ? eigenvalues.reduce((sum, val) => sum + val * val, 0) : 0;
      const entropy = eigenvalues.length > 0 ? -eigenvalues.reduce((sum, val) => val > 0 ? sum + val * Math.log2(val) : sum, 0) : 0;

      setResult({
        purity,
        entropy,
        eigenvalues,
        trace: eigenvalues.reduce((a, b) => a + b, 0),
        dimension: eigenvalues.length,
        is_pure: purity > 0.99,
        coherence: undefined,
      });
    } catch (err: any) {
      setError(err.message || 'Density matrix inspection failed');
      console.error('ρ inspection error:', err);
    } finally {
      setIsInspecting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-700 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-100">↗︎ ρ Inspector</h2>
        <p className="text-xs text-slate-400 mt-1">
          Density matrix state analysis
        </p>
      </div>

      {/* Config Form */}
      <div className="border-b border-slate-700 p-4 space-y-3">
        {/* Canvas Text Preview */}
        <div className="rounded bg-slate-800 p-3">
          <div className="text-xs text-slate-400 mb-1">Reading from Canvas</div>
          <div className="text-sm text-slate-300">
            {getActiveText()
              ? `${getActiveText().substring(0, 100)}${getActiveText().length > 100 ? '...' : ''}`
              : 'No text in Canvas'}
          </div>
        </div>

        <button
          onClick={handleInspect}
          disabled={!getActiveText() || isInspecting}
          className="w-full rounded bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {isInspecting ? '⏳ Inspecting...' : '↗︎ Inspect State'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="border-b border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {result && (
          <>
            {/* State Classification */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-4 py-2">
                {result.is_pure !== undefined && (
                  <span className={`text-sm font-bold ${result.is_pure ? 'text-green-400' : 'text-yellow-400'}`}>
                    {result.is_pure ? '✓ Pure State' : '◐ Mixed State'}
                  </span>
                )}
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Purity */}
              <div className="rounded bg-gradient-to-br from-indigo-900/30 to-indigo-800/20 p-4 border border-indigo-700/50">
                <div className="text-xs font-medium text-indigo-200 mb-1">
                  Purity Tr(ρ²)
                </div>
                <div className="text-2xl font-bold text-indigo-100">
                  {result.purity.toFixed(3)}
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-indigo-950">
                  <div
                    className="h-full bg-indigo-500"
                    style={{ width: `${result.purity * 100}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-indigo-300/70">
                  Range: [1/d, 1] where d={result.dimension}
                </div>
              </div>

              {/* Entropy */}
              <div className="rounded bg-gradient-to-br from-purple-900/30 to-purple-800/20 p-4 border border-purple-700/50">
                <div className="text-xs font-medium text-purple-200 mb-1">
                  Von Neumann Entropy
                </div>
                <div className="text-2xl font-bold text-purple-100">
                  {result.entropy.toFixed(3)}
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-purple-950">
                  <div
                    className="h-full bg-purple-500"
                    style={{ width: `${Math.min(result.entropy / Math.log2(result.dimension), 1) * 100}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-purple-300/70">
                  Range: [0, log₂({result.dimension})] ≈ {Math.log2(result.dimension).toFixed(2)}
                </div>
              </div>

              {/* Trace */}
              <div className="rounded bg-gradient-to-br from-cyan-900/30 to-cyan-800/20 p-4 border border-cyan-700/50">
                <div className="text-xs font-medium text-cyan-200 mb-1">
                  Trace Tr(ρ)
                </div>
                <div className="text-2xl font-bold text-cyan-100">
                  {result.trace.toFixed(6)}
                </div>
                <div className="mt-2 text-xs text-cyan-300/70">
                  {Math.abs(result.trace - 1.0) < 0.001 ? '✓ Normalized' : '⚠️ Not normalized'}
                </div>
              </div>

              {/* Dimension */}
              <div className="rounded bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 p-4 border border-emerald-700/50">
                <div className="text-xs font-medium text-emerald-200 mb-1">
                  Hilbert Space Dimension
                </div>
                <div className="text-2xl font-bold text-emerald-100">
                  {result.dimension}
                </div>
                <div className="mt-2 text-xs text-emerald-300/70">
                  State lives in ℂ^{result.dimension}
                </div>
              </div>
            </div>

            {/* Coherence (if available) */}
            {result.coherence !== undefined && (
              <div className="rounded bg-slate-800 p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-300">
                    Coherence
                  </span>
                  <span className="text-lg font-bold text-blue-400">
                    {(result.coherence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded bg-slate-700">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${result.coherence * 100}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Off-diagonal matrix element strength
                </div>
              </div>
            )}

            {/* Eigenvalue Spectrum */}
            {result.eigenvalues && result.eigenvalues.length > 0 && (
              <div className="rounded bg-slate-800 p-4">
                <h3 className="text-sm font-bold text-slate-300 mb-3">
                  Eigenvalue Spectrum
                </h3>

                {/* Top 10 Eigenvalues */}
                <div className="space-y-2 mb-3">
                  {result.eigenvalues.slice(0, 10).map((val, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-8">λ{i + 1}</span>
                      <div className="flex-1 h-6 overflow-hidden rounded bg-slate-700">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-purple-600"
                          style={{ width: `${val * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-300 w-16 text-right">
                        {val.toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Summary Stats */}
                <div className="text-xs text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Total eigenvalues:</span>
                    <span className="font-mono">{result.eigenvalues.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Largest λ:</span>
                    <span className="font-mono">{Math.max(...result.eigenvalues).toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Smallest λ:</span>
                    <span className="font-mono">{Math.min(...result.eigenvalues).toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sum (should = 1):</span>
                    <span className="font-mono">
                      {result.eigenvalues.reduce((a, b) => a + b, 0).toFixed(6)}
                      {Math.abs(result.eigenvalues.reduce((a, b) => a + b, 0) - 1.0) < 0.01 ? ' ✓' : ' ⚠️'}
                    </span>
                  </div>
                </div>

                {/* Show all eigenvalues (collapsible) */}
                {result.eigenvalues.length > 10 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-indigo-400 hover:text-indigo-300">
                      Show all {result.eigenvalues.length} eigenvalues
                    </summary>
                    <div className="mt-2 max-h-40 overflow-y-auto">
                      <div className="grid grid-cols-4 gap-2 font-mono text-xs text-slate-400">
                        {result.eigenvalues.map((val, i) => (
                          <div key={i}>
                            λ{i + 1}: {val.toFixed(4)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Interpretation Guide */}
            <div className="rounded bg-slate-800 p-4">
              <h4 className="text-sm font-bold text-slate-300 mb-2">
                Interpretation Guide
              </h4>
              <div className="text-xs text-slate-400 space-y-2">
                <p>
                  <strong className="text-slate-300">Purity = 1:</strong> Pure quantum state (single definite meaning)
                </p>
                <p>
                  <strong className="text-slate-300">Purity &lt; 1:</strong> Mixed state (multiple competing interpretations)
                </p>
                <p>
                  <strong className="text-slate-300">Entropy = 0:</strong> No ambiguity
                </p>
                <p>
                  <strong className="text-slate-300">Entropy &gt; 0:</strong> Interpretive ambiguity increases with entropy
                </p>
                <p>
                  <strong className="text-slate-300">Eigenvalues:</strong> Weights of different semantic "basis states"
                </p>
              </div>
            </div>
          </>
        )}

        {!result && !isInspecting && !error && (
          <div className="text-center text-sm text-slate-400 py-8">
            Click Inspect State to analyze Canvas text
          </div>
        )}
      </div>
    </div>
  );
}
