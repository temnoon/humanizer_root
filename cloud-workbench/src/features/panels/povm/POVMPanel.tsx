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
      <div className="panel-header">
        <h2 className="text-lg font-bold text-base-content">◆ POVM Evaluator</h2>
        <p className="text-xs text-base-content opacity-70 mt-1">
          Single-axis quantum measurement
        </p>
      </div>

      {/* Config Form */}
      <div className="border-b border-base-300 p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-base-content mb-1">
            Measurement Axis
          </label>
          <select
            value={axis}
            onChange={(e) => setAxis(e.target.value)}
            className="select select-bordered w-full text-sm"
          >
            {availableAxes.map((ax) => (
              <option key={ax.id} value={ax.id}>
                {ax.name}
              </option>
            ))}
          </select>
          {selectedAxisInfo && (
            <div className="mt-1 text-xs text-base-content opacity-70">
              {selectedAxisInfo.description}
            </div>
          )}
        </div>

        {/* Canvas Text Preview */}
        <div className="card bg-base-200 rounded-lg p-3">
          <div className="text-xs text-base-content opacity-70 mb-1">Reading from Canvas</div>
          <div className="text-sm text-base-content">
            {getActiveText()
              ? `${getActiveText().substring(0, 100)}${getActiveText().length > 100 ? '...' : ''}`
              : 'No text in Canvas'}
          </div>
        </div>

        <button
          onClick={handleEvaluate}
          disabled={!getActiveText() || isEvaluating}
          className="btn btn-primary w-full"
        >
          {isEvaluating ? '⏳ Evaluating...' : '◆ Evaluate'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert alert-error border-none">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {result && (
          <>
            {/* Axis Name */}
            <div className="text-center">
              <h3 className="text-sm font-bold text-base-content">
                {result.axis} Measurement
              </h3>
            </div>

            {/* Four-Corner Tetralemma */}
            <div className="grid grid-cols-2 gap-3">
              {/* T (Top-Left) */}
              <div className="card bg-error/10 border border-error/30 p-4">
                <div className="text-xs font-medium text-error mb-1">
                  {result.labels.T}
                </div>
                <div className="text-2xl font-bold text-base-content">
                  {(result.weights.T * 100).toFixed(0)}%
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-base-300">
                  <div
                    className="h-full bg-error"
                    style={{ width: `${result.weights.T * 100}%` }}
                  />
                </div>
              </div>

              {/* F (Top-Right) */}
              <div className="card bg-success/10 border border-success/30 p-4">
                <div className="text-xs font-medium text-success mb-1">
                  {result.labels.F}
                </div>
                <div className="text-2xl font-bold text-base-content">
                  {(result.weights.F * 100).toFixed(0)}%
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-base-300">
                  <div
                    className="h-full bg-success"
                    style={{ width: `${result.weights.F * 100}%` }}
                  />
                </div>
              </div>

              {/* B (Bottom-Left) */}
              <div className="card bg-info/10 border border-info/30 p-4">
                <div className="text-xs font-medium text-info mb-1">
                  {result.labels.B}
                </div>
                <div className="text-2xl font-bold text-base-content">
                  {(result.weights.B * 100).toFixed(0)}%
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-base-300">
                  <div
                    className="h-full bg-info"
                    style={{ width: `${result.weights.B * 100}%` }}
                  />
                </div>
              </div>

              {/* N (Bottom-Right) */}
              <div className="card bg-secondary/10 border border-secondary/30 p-4">
                <div className="text-xs font-medium text-secondary mb-1">
                  {result.labels.N}
                </div>
                <div className="text-2xl font-bold text-base-content">
                  {(result.weights.N * 100).toFixed(0)}%
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-base-300">
                  <div
                    className="h-full bg-secondary"
                    style={{ width: `${result.weights.N * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Coherence (Alpha) */}
            <div className="card bg-base-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-base-content opacity-70">
                  Coherence (α)
                </span>
                <span className="text-lg font-bold text-primary">
                  {(result.alpha * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded bg-base-300">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${result.alpha * 100}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-base-content opacity-50">
                Measures quantum coherence (superposition strength)
              </div>
            </div>

            {/* Interpretation (if provided by API) */}
            {result.interpretation && (
              <div className="card bg-base-200 rounded-lg p-4">
                <h4 className="text-sm font-bold text-base-content mb-2">
                  Interpretation
                </h4>
                <p className="text-sm text-base-content opacity-80 leading-relaxed">
                  {result.interpretation}
                </p>
              </div>
            )}

            {/* Raw Data (Collapsible) */}
            <details className="card bg-base-200 rounded-lg border border-base-300">
              <summary className="cursor-pointer px-3 py-2 font-medium text-sm text-base-content hover:bg-base-100">
                View Raw Data
              </summary>
              <div className="p-3 space-y-2">
                <div className="font-mono text-xs text-base-content opacity-70">
                  <div className="text-base-content">Weights Vector:</div>
                  <div className="mt-1 text-base-content">
                    T: {result.weights.T.toFixed(4)} | F: {result.weights.F.toFixed(4)} |{' '}
                    B: {result.weights.B.toFixed(4)} | N: {result.weights.N.toFixed(4)}
                  </div>
                  <div className="mt-2 text-base-content">Alpha (Coherence):</div>
                  <div className="mt-1 text-base-content">{result.alpha.toFixed(6)}</div>
                  <div className="mt-2 text-base-content">Normalization Check:</div>
                  <div className="mt-1 text-base-content">
                    Sum = {(result.weights.T + result.weights.F + result.weights.B + result.weights.N).toFixed(6)}
                    {Math.abs((result.weights.T + result.weights.F + result.weights.B + result.weights.N) - 1.0) < 0.01 ? ' ✓' : ' ⚠️'}
                  </div>
                </div>
              </div>
            </details>
          </>
        )}

        {!result && !isEvaluating && !error && (
          <div className="text-center text-sm text-base-content opacity-70 py-8">
            Select an axis and click Evaluate to begin
          </div>
        )}
      </div>
    </div>
  );
}
