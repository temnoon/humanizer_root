import { useState, useEffect } from 'react';
import { useCanvas } from '../../../core/context/CanvasContext';
import { useAuth } from '../../../core/context/AuthContext';
import { api, type RoundTripResponse } from '../../../core/adapters/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PhilosophyTooltip } from '../../../components/ui/PhilosophyTooltip';
import { validateTransformation } from '../../../utils/validation';

/**
 * RoundTripPanel - Translation drift analysis
 *
 * Process: Original → Language1 → Language2 → ... → Back to Original
 * Analyzes: Semantic drift, meaning preservation
 *
 * Features:
 * - 18 language support
 * - Intermediate translation display
 * - Drift analysis
 * - Load result back to Canvas
 */

export function RoundTripPanel() {
  const { getActiveText, setText } = useCanvas();
  const { requiresAuth, isAuthenticated } = useAuth();

  // Form state
  const [language, setLanguage] = useState('es');

  // Config options
  const [languages, setLanguages] = useState<Array<{ code: string; name: string }>>([]);

  // Transformation state
  const [result, setResult] = useState<RoundTripResponse | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load languages
  useEffect(() => {
    loadLanguages();
  }, []);

  const loadLanguages = async () => {
    try {
      const data = await api.getLanguages();
      setLanguages(data);
    } catch (err: any) {
      console.error('Error loading languages:', err);
    }
  };

  const handleTransform = async () => {
    const text = getActiveText();
    console.log('[RoundTrip] handleTransform called');
    console.log('[RoundTrip] Got text from getActiveText(), length:', text?.length, 'chars');
    console.log('[RoundTrip] First 100 chars:', text?.substring(0, 100));

    // Pre-validation: Check for content
    const validationError = validateTransformation(text, { minLength: 10, maxLength: 5000 });
    if (validationError) {
      console.log('[RoundTrip] Validation failed:', validationError);
      setError(validationError);
      return;
    }

    // Check authentication for remote API
    if (requiresAuth() && !isAuthenticated) {
      setError('Please login to use remote transformations.');
      return;
    }

    setIsTransforming(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.roundTrip({
        text: text!,
        language,
      });

      setResult(response);
      console.log('Round-trip transformation complete');
    } catch (err: any) {
      setError(err.message || 'Transformation failed');
      console.error('Transformation error:', err);
    } finally {
      setIsTransforming(false);
    }
  };

  const loadToCanvas = () => {
    if (result) {
      setText(result.final_text);
      console.log('Loaded round-trip result to Canvas');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="panel-header">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>🌍 Round-Trip Translation</h2>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Analyze semantic drift through translation cycles
        </p>
      </div>

      {/* Philosophy Context */}
      <PhilosophyTooltip
        title="Translation as Semantic Drift Analysis (Husserl's Horizons)"
        description="Round-trip translation reveals the 'horizon of untranslatability' — what Husserl called the pre-predicative layer that resists perfect transmutation between languages. Preserved elements show invariant structures of meaning. Lost elements reveal culture-bound intentionality. Gained elements are gifts from the intermediate language's unique phenomenological horizon. This isn't about translation quality — it's about exposing the deep structure of meaning embedded in linguistic and cultural contexts."
        learnMoreUrl="https://humanizer.com/docs/tools/round-trip"
      />

      {/* Config Form */}
      <div className="border-b p-4 space-y-3" style={{ borderColor: 'var(--border-color)' }}>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            Intermediate Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="input w-full rounded px-3 py-2 text-sm"
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleTransform}
          disabled={isTransforming}
          className="btn-primary w-full rounded px-4 py-2 font-medium disabled:opacity-50"
        >
          {isTransforming ? '⏳ Translating...' : '🌍 Round-Trip'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div
          className="border-b px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--accent-red)',
            background: 'rgba(220, 38, 38, 0.2)',
            color: 'var(--accent-red)',
          }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {result && (
          <>
            {/* Original Text */}
            <div>
              <h3 className="font-bold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>Original Text</h3>
              <div className="card rounded p-3 text-sm">
                {result.original_text}
              </div>
            </div>

            {/* Final Text (After Round-Trip) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Final Text (After Round-Trip)</h3>
                <button
                  onClick={loadToCanvas}
                  className="btn-primary rounded px-3 py-1 text-xs font-medium"
                >
                  Load to Canvas →
                </button>
              </div>
              <div className="card rounded p-3 text-sm">
                {result.final_text}
              </div>
            </div>

            {/* Drift Analysis */}
            <div>
              <h3 className="font-bold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>Semantic Drift Analysis</h3>
              <div className="prose prose-invert prose-sm max-w-none card rounded p-3" style={{ color: 'var(--text-primary)' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result.drift_analysis}
                </ReactMarkdown>
              </div>
            </div>

            {/* Intermediate Translations */}
            <details className="card rounded">
              <summary className="cursor-pointer px-3 py-2 font-medium text-sm hover-bg-accent" style={{ color: 'var(--text-primary)' }}>
                View Intermediate Translations ({result.intermediate_translations.length})
              </summary>
              <div className="space-y-2 p-3">
                {result.intermediate_translations.map((trans, idx) => (
                  <div key={idx} className="rounded bg-slate-900 p-2">
                    <div className="text-xs font-bold text-slate-400 mb-1">
                      {idx + 1}. {trans.language}
                    </div>
                    <div className="text-sm text-slate-300">{trans.text}</div>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}

        {!result && !isTransforming && !error && (
          <div className="text-center text-sm text-slate-400 py-8">
            Select a language and click Round-Trip to begin
          </div>
        )}
      </div>
    </div>
  );
}
