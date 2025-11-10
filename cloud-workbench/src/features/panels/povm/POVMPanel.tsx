import { useState } from 'react';
import { useCanvas } from '../../../core/context/CanvasContext';
import { api } from '../../../core/adapters/api';

/**
 * POVMPanel - Single-axis POVM measurement
 *
 * Evaluates text against a single interpretive axis using
 * Positive Operator-Valued Measure (POVM) framework.
 *
 * Features:
 * - Multiple POVM axes (Tetralemma, Agency, Affect, etc.)
 * - Canvas text integration
 * - Four-corner Tetralemma visualization
 * - Coherence (alpha) indicator
 */

interface POVMResult {
  axis: string;
  weights: {
    T: number;
    F: number;
    B: number;
    N: number;
  };
  alpha: number;
  labels: {
    T: string;
    F: string;
    B: string;
    N: string;
  };
  interpretation?: string;
}

export function POVMPanel() {
  const { getActiveText } = useCanvas();
  const [axis, setAxis] = useState('literalness');
  const [result, setResult] = useState<POVMResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableAxes = [
    {
      id: 'literalness',
      name: 'Literalness',
      description: 'Concrete vs Abstract meaning',
      labels: { T: 'Literal', F: 'Metaphorical', B: 'Both', N: 'Neither' },
    },
    {
      id: 'agency',
      name: 'Agency',
      description: 'Active vs Passive voice',
      labels: { T: 'Active', F: 'Passive', B: 'Both', N: 'Impersonal' },
    },
    {
      id: 'affect',
      name: 'Affect',
      description: 'Positive vs Negative emotion',
      labels: { T: 'Positive', F: 'Negative', B: 'Mixed', N: 'Neutral' },
    },
    {
      id: 'epistemic',
      name: 'Epistemic Stance',
      description: 'Certainty vs Uncertainty',
      labels: { T: 'Assertion', F: 'Question', B: 'Both', N: 'Neither' },
    },
    {
      id: 'temporality',
      name: 'Temporality',
      description: 'Past vs Future orientation',
      labels: { T: 'Past', F: 'Future', B: 'Both', N: 'Atemporal' },
    },
    {
      id: 'formality',
      name: 'Formality',
      description: 'Casual vs Academic register',
      labels: { T: 'Casual', F: 'Academic', B: 'Mixed', N: 'Technical' },
    },
  ];

  const selectedAxisInfo = availableAxes.find((a) => a.id === axis);

  const handleEvaluate = async () => {
    const text = getActiveText();

    if (!text || text.trim().length === 0) {
      setError('No text to evaluate. Please load text to Canvas first.');
      return;
    }

    setIsEvaluating(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.evalPOVM({ text, axis });

      // Transform response to match our interface
      setResult({
        axis: selectedAxisInfo?.name || axis,
        weights: {
          T: response.T,
          F: response.F,
          B: response.B,
          N: response.N,
        },
        alpha: response.alpha,
        labels: selectedAxisInfo?.labels || { T: 'T', F: 'F', B: 'B', N: 'N' },
        interpretation: undefined, // Backend doesn't return interpretation
      });
    } catch (err: any) {
      setError(err.message || 'POVM evaluation failed');
      console.error('POVM evaluation error:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-700 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-100">◆ POVM Evaluator</h2>
        <p className="text-xs text-slate-400 mt-1">
          Single-axis quantum measurement
        </p>
      </div>

      {/* Config Form */}
      <div className="border-b border-slate-700 p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Measurement Axis
          </label>
          <select
            value={axis}
            onChange={(e) => setAxis(e.target.value)}
            className="w-full rounded bg-slate-700 px-3 py-2 text-sm text-slate-100"
          >
            {availableAxes.map((ax) => (
              <option key={ax.id} value={ax.id}>
                {ax.name}
              </option>
            ))}
          </select>
          {selectedAxisInfo && (
            <div className="mt-1 text-xs text-slate-400">
              {selectedAxisInfo.description}
            </div>
          )}
        </div>

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
          onClick={handleEvaluate}
          disabled={!getActiveText() || isEvaluating}
          className="w-full rounded bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {isEvaluating ? '⏳ Evaluating...' : '◆ Evaluate'}
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
            {/* Axis Name */}
            <div className="text-center">
              <h3 className="text-sm font-bold text-slate-300">
                {result.axis} Measurement
              </h3>
            </div>

            {/* Four-Corner Tetralemma */}
            <div className="grid grid-cols-2 gap-3">
              {/* T (Top-Left) */}
              <div className="rounded bg-red-900/30 p-4 border border-red-800/50">
                <div className="text-xs font-medium text-red-200 mb-1">
                  {result.labels.T}
                </div>
                <div className="text-2xl font-bold text-red-100">
                  {(result.weights.T * 100).toFixed(0)}%
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-red-950">
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${result.weights.T * 100}%` }}
                  />
                </div>
              </div>

              {/* F (Top-Right) */}
              <div className="rounded bg-green-900/30 p-4 border border-green-800/50">
                <div className="text-xs font-medium text-green-200 mb-1">
                  {result.labels.F}
                </div>
                <div className="text-2xl font-bold text-green-100">
                  {(result.weights.F * 100).toFixed(0)}%
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-green-950">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${result.weights.F * 100}%` }}
                  />
                </div>
              </div>

              {/* B (Bottom-Left) */}
              <div className="rounded bg-blue-900/30 p-4 border border-blue-800/50">
                <div className="text-xs font-medium text-blue-200 mb-1">
                  {result.labels.B}
                </div>
                <div className="text-2xl font-bold text-blue-100">
                  {(result.weights.B * 100).toFixed(0)}%
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-blue-950">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${result.weights.B * 100}%` }}
                  />
                </div>
              </div>

              {/* N (Bottom-Right) */}
              <div className="rounded bg-purple-900/30 p-4 border border-purple-800/50">
                <div className="text-xs font-medium text-purple-200 mb-1">
                  {result.labels.N}
                </div>
                <div className="text-2xl font-bold text-purple-100">
                  {(result.weights.N * 100).toFixed(0)}%
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-purple-950">
                  <div
                    className="h-full bg-purple-500"
                    style={{ width: `${result.weights.N * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Coherence (Alpha) */}
            <div className="rounded bg-slate-800 p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-300">
                  Coherence (α)
                </span>
                <span className="text-lg font-bold text-indigo-400">
                  {(result.alpha * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded bg-slate-700">
                <div
                  className="h-full bg-indigo-500 transition-all"
                  style={{ width: `${result.alpha * 100}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Measures quantum coherence (superposition strength)
              </div>
            </div>

            {/* Interpretation (if provided by API) */}
            {result.interpretation && (
              <div className="rounded bg-slate-800 p-4">
                <h4 className="text-sm font-bold text-slate-300 mb-2">
                  Interpretation
                </h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {result.interpretation}
                </p>
              </div>
            )}

            {/* Raw Data (Collapsible) */}
            <details className="rounded border border-slate-700 bg-slate-800">
              <summary className="cursor-pointer px-3 py-2 font-medium text-sm text-slate-100 hover:bg-slate-700">
                View Raw Data
              </summary>
              <div className="p-3 space-y-2">
                <div className="font-mono text-xs">
                  <div className="text-slate-400">Weights Vector:</div>
                  <div className="mt-1 text-slate-300">
                    T: {result.weights.T.toFixed(4)} | F: {result.weights.F.toFixed(4)} |{' '}
                    B: {result.weights.B.toFixed(4)} | N: {result.weights.N.toFixed(4)}
                  </div>
                  <div className="mt-2 text-slate-400">Alpha (Coherence):</div>
                  <div className="mt-1 text-slate-300">{result.alpha.toFixed(6)}</div>
                  <div className="mt-2 text-slate-400">Normalization Check:</div>
                  <div className="mt-1 text-slate-300">
                    Sum = {(result.weights.T + result.weights.F + result.weights.B + result.weights.N).toFixed(6)}
                    {Math.abs((result.weights.T + result.weights.F + result.weights.B + result.weights.N) - 1.0) < 0.01 ? ' ✓' : ' ⚠️'}
                  </div>
                </div>
              </div>
            </details>
          </>
        )}

        {!result && !isEvaluating && !error && (
          <div className="text-center text-sm text-slate-400 py-8">
            Select an axis and click Evaluate to begin
          </div>
        )}
      </div>
    </div>
  );
}
