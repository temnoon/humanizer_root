import { useState, useEffect } from 'react';
import { useCanvas } from '../../../core/context/CanvasContext';
import { useAuth } from '../../../core/context/AuthContext';
import { api, type RoundTripResponse } from '../../../core/adapters/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

    if (!text || text.trim().length === 0) {
      setError('No text to transform. Please load text to Canvas first.');
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
        text,
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
      <div className="border-b border-slate-700 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-100">🌍 Round-Trip Translation</h2>
        <p className="text-xs text-slate-400 mt-1">
          Analyze semantic drift through translation cycles
        </p>
      </div>

      {/* Config Form */}
      <div className="border-b border-slate-700 p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Intermediate Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded bg-slate-700 px-3 py-2 text-sm text-slate-100"
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
          className="w-full rounded bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {isTransforming ? '⏳ Translating...' : '🌍 Round-Trip'}
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
            {/* Original Text */}
            <div>
              <h3 className="font-bold text-sm text-slate-100 mb-2">Original Text</h3>
              <div className="rounded bg-slate-800 p-3 text-sm text-slate-300">
                {result.original_text}
              </div>
            </div>

            {/* Final Text (After Round-Trip) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm text-slate-100">Final Text (After Round-Trip)</h3>
                <button
                  onClick={loadToCanvas}
                  className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  Load to Canvas →
                </button>
              </div>
              <div className="rounded bg-slate-800 p-3 text-sm text-slate-300">
                {result.final_text}
              </div>
            </div>

            {/* Drift Analysis */}
            <div>
              <h3 className="font-bold text-sm text-slate-100 mb-2">Semantic Drift Analysis</h3>
              <div className="prose prose-invert prose-sm max-w-none rounded bg-slate-800 p-3 text-slate-200">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result.drift_analysis}
                </ReactMarkdown>
              </div>
            </div>

            {/* Intermediate Translations */}
            <details className="rounded border border-slate-700 bg-slate-800">
              <summary className="cursor-pointer px-3 py-2 font-medium text-sm text-slate-100 hover:bg-slate-700">
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
