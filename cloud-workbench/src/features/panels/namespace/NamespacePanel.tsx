import { useState, useEffect } from 'react';
import { useCanvas } from '../../../core/context/CanvasContext';
import { api } from '../../../core/adapters/api';
import { PhilosophyTooltip } from '../../../components/ui/PhilosophyTooltip';

/**
 * Namespace Transformation Response
 */
interface NamespaceTransformationResult {
  transformation_id: string;
  transformed_text: string;
  baseline?: {
    detection: {
      aiConfidence: number;
      burstinessScore: number;
      tellWordCount: number;
      verdict: 'human' | 'ai' | 'uncertain';
    };
  };
  final?: {
    detection: {
      aiConfidence: number;
      burstinessScore: number;
      tellWordCount: number;
      verdict: 'human' | 'ai' | 'uncertain';
    };
  };
  improvement?: {
    aiConfidenceDrop: number;
    burstinessIncrease: number;
  };
  processing: {
    totalDurationMs: number;
    validationDurationMs: number;
  };
}

/**
 * NamespacePanel - Transform universe/setting only
 *
 * Features:
 * - Change conceptual framework (mythology → quantum, etc.)
 * - Preserve narrative voice and writing style
 * - AI detection validation (before/after)
 * - 3-step process: Extract → Map → Reconstruct
 */
export function NamespacePanel() {
  const { getActiveText, setText } = useCanvas();
  const [result, setResult] = useState<NamespaceTransformationResult | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Configuration
  const [namespace, setNamespace] = useState('mythology');
  const [preserveLength, setPreserveLength] = useState(true);
  const [enableValidation, setEnableValidation] = useState(true);

  // Namespace options (loaded from API)
  const [namespaces, setNamespaces] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    loadNamespaces();
  }, []);

  const loadNamespaces = async () => {
    try {
      const data = await api.getNamespaces();
      setNamespaces(data);
    } catch (err: any) {
      console.error('Error loading namespaces:', err);
    }
  };

  const handleTransform = async () => {
    const text = getActiveText();

    if (!text || text.trim().length === 0) {
      setError('No text to transform. Please load text to Canvas first.');
      return;
    }

    setIsTransforming(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.transformNamespace({
        text,
        namespace,
        preserveLength,
        enableValidation
      }) as NamespaceTransformationResult;

      setResult(response);
    } catch (err: any) {
      setError(err.message || 'Namespace transformation failed');
      console.error('Namespace transformation error:', err);
    } finally {
      setIsTransforming(false);
    }
  };

  const handleLoadToCanvas = () => {
    if (result) {
      setText(result.transformed_text);
    }
  };

  const getVerdictColor = (verdict: 'human' | 'ai' | 'uncertain') => {
    if (verdict === 'human') return 'badge-success';
    if (verdict === 'ai') return 'badge-error';
    return 'badge-warning';
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="panel-header">
        <h2 className="text-lg font-bold text-base-content">🌍 Namespace Transformation</h2>
        <p className="text-xs mt-1 text-base-content opacity-70">
          Change universe/setting only
        </p>
      </div>

      {/* Philosophy Context */}
      <PhilosophyTooltip
        title="Conceptual Frameworks as Horizons"
        description="Namespace transformation shifts the conceptual universe while preserving narrative structure and voice. A story about scientists becomes a story about mythological heroes—the roles, events, and tensions remain structurally equivalent, but the domain-specific terms and cultural context transform. This demonstrates that meaning can migrate across semantic spaces while maintaining narrative coherence."
        learnMoreUrl="https://humanizer.com/docs/tools/namespace"
      />

      {/* Config Form */}
      <div className="border-b border-base-300 p-4 space-y-3">
        {/* Namespace Selector */}
        <div>
          <label className="block text-xs font-medium mb-2 text-base-content">
            Select Namespace
          </label>
          <select
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="select select-bordered select-sm w-full"
          >
            {namespaces.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>

        {/* Preserve Length Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="preserve-length"
            checked={preserveLength}
            onChange={(e) => setPreserveLength(e.target.checked)}
            className="checkbox checkbox-primary checkbox-sm"
          />
          <label htmlFor="preserve-length" className="text-xs text-base-content">
            Preserve length (same word count)
          </label>
        </div>

        {/* Enable Validation Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enable-validation"
            checked={enableValidation}
            onChange={(e) => setEnableValidation(e.target.checked)}
            className="checkbox checkbox-primary checkbox-sm"
          />
          <label htmlFor="enable-validation" className="text-xs text-base-content">
            Enable AI detection validation (recommended)
          </label>
        </div>

        {/* Transform Button */}
        <button
          onClick={handleTransform}
          disabled={isTransforming}
          className="btn btn-primary btn-sm w-full"
        >
          {isTransforming ? 'Transforming...' : 'Transform Namespace'}
        </button>

        {/* Error Display */}
        {error && (
          <div className="alert alert-error shadow-lg">
            <div>
              <span className="text-xs">{error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Results Display */}
      {result && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Metrics Dashboard */}
          {result.baseline && result.final && result.improvement && (
            <div className="card bg-base-200 rounded-lg p-4">
              <h3 className="text-sm font-bold mb-3 text-base-content">AI Detection Metrics</h3>
              <div className="grid grid-cols-2 gap-3">
                {/* AI Confidence */}
                <div className="card bg-base-100 p-3">
                  <div className="text-xs font-medium text-base-content opacity-70">AI Confidence</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-sm text-base-content opacity-70">
                      {(result.baseline.detection.aiConfidence * 100).toFixed(1)}%
                    </span>
                    <span className="text-xs">→</span>
                    <span className="text-sm font-bold text-success">
                      {(result.final.detection.aiConfidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-success mt-1">
                    ↓ {result.improvement.aiConfidenceDrop.toFixed(1)} points
                  </div>
                </div>

                {/* Burstiness */}
                <div className="card bg-base-100 p-3">
                  <div className="text-xs font-medium text-base-content opacity-70">Burstiness</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-sm text-base-content opacity-70">
                      {result.baseline.detection.burstinessScore.toFixed(1)}
                    </span>
                    <span className="text-xs">→</span>
                    <span className="text-sm font-bold text-success">
                      {result.final.detection.burstinessScore.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-xs text-success mt-1">
                    ↑ {result.improvement.burstinessIncrease.toFixed(1)} points
                  </div>
                </div>

                {/* Tell Words */}
                <div className="card bg-base-100 p-3">
                  <div className="text-xs font-medium text-base-content opacity-70">Tell Words</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-sm text-base-content opacity-70">
                      {result.baseline.detection.tellWordCount}
                    </span>
                    <span className="text-xs">→</span>
                    <span className="text-sm font-bold text-success">
                      {result.final.detection.tellWordCount}
                    </span>
                  </div>
                </div>

                {/* Verdict */}
                <div className="card bg-base-100 p-3">
                  <div className="text-xs font-medium text-base-content opacity-70">Verdict</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`badge ${getVerdictColor(result.baseline.detection.verdict)} badge-sm`}>
                      {result.baseline.detection.verdict}
                    </span>
                    <span className="text-xs">→</span>
                    <span className={`badge ${getVerdictColor(result.final.detection.verdict)} badge-sm`}>
                      {result.final.detection.verdict}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transformed Text */}
          <div className="card bg-base-200 rounded-lg p-4">
            <h3 className="text-sm font-bold mb-2 text-base-content">Transformed Text</h3>
            <div className="bg-base-100 rounded-lg p-3 text-xs text-base-content whitespace-pre-wrap max-h-64 overflow-y-auto">
              {result.transformed_text}
            </div>
            <button
              onClick={handleLoadToCanvas}
              className="btn btn-ghost btn-sm mt-3"
            >
              Load to Canvas
            </button>
          </div>

          {/* Processing Time */}
          <div className="text-xs text-base-content opacity-70 text-center">
            Processing time: {(result.processing.totalDurationMs / 1000).toFixed(2)}s
            {result.processing.validationDurationMs > 0 && (
              <span> (validation: {(result.processing.validationDurationMs / 1000).toFixed(2)}s)</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
