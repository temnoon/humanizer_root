import { useState, useEffect } from 'react';
import { useCanvas } from '../../../core/context/CanvasContext';
import { api, type PersonalizerResponse } from '../../../core/adapters/api';

/**
 * PersonalizerPanel - Voice-Based Text Personalization
 *
 * Features:
 * - Transform text to match a specific writing voice
 * - Voice profile selection (from global personas)
 * - Similarity scoring
 * - Load personalized text to Canvas
 * - PRO+ tier feature (requires authentication)
 */
export function PersonalizerPanel() {
  const { getActiveText, setText } = useCanvas();
  const [result, setResult] = useState<PersonalizerResponse | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceProfile, setVoiceProfile] = useState('neutral');

  // Load personas from API
  const [personas, setPersonas] = useState<Array<{ id: string; name: string; description: string }>>([]);

  useEffect(() => {
    loadPersonas();
  }, []);

  const loadPersonas = async () => {
    try {
      const data = await api.getPersonas();
      setPersonas(data);
      if (data.length > 0 && !voiceProfile) {
        setVoiceProfile(data[0].id);
      }
    } catch (err: any) {
      console.error('Error loading personas:', err);
    }
  };

  const handleTransform = async () => {
    const text = getActiveText();

    if (!text || text.trim().length === 0) {
      setError('No text to personalize. Please load text to Canvas first.');
      return;
    }

    setIsTransforming(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.personalizer({
        text,
        voice_profile: voiceProfile,
      });

      setResult(response);
    } catch (err: any) {
      setError(err.message || 'Personalization failed');
      console.error('Personalizer error:', err);
    } finally {
      setIsTransforming(false);
    }
  };

  const handleLoadToCanvas = () => {
    if (result) {
      setText(result.personalized_text);
    }
  };

  const getSimilarityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-blue-400';
    if (score >= 0.4) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-700 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-100">🎭 Personalizer</h2>
        <p className="text-xs text-slate-400 mt-1">
          Transform text to match a specific voice or style
        </p>
      </div>

      {/* Config Form */}
      <div className="border-b border-slate-700 p-4 space-y-3">
        {/* Voice Profile Selection */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Voice Profile
          </label>
          <select
            value={voiceProfile}
            onChange={(e) => setVoiceProfile(e.target.value)}
            className="w-full rounded bg-slate-700 px-3 py-2 text-sm text-slate-100"
            disabled={personas.length === 0}
          >
            {personas.length === 0 && (
              <option value="">Loading personas...</option>
            )}
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.name}
              </option>
            ))}
          </select>
          {personas.find((p) => p.id === voiceProfile) && (
            <div className="mt-1 text-xs text-slate-400">
              {personas.find((p) => p.id === voiceProfile)?.description}
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
          onClick={handleTransform}
          disabled={!getActiveText() || isTransforming}
          className="w-full rounded bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {isTransforming ? '⏳ Personalizing...' : '🎭 Personalize Text'}
        </button>

        {/* Future Feature Teaser */}
        <div className="rounded bg-purple-900/20 border border-purple-700/50 p-3">
          <div className="flex items-start gap-2">
            <span className="text-lg">🔮</span>
            <div className="flex-1">
              <div className="text-xs font-medium text-purple-200 mb-1">
                Coming Soon: Custom Voice Profiles
              </div>
              <div className="text-xs text-purple-300/70">
                Upload writing samples to create personalized voice profiles
              </div>
            </div>
          </div>
        </div>
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
            {/* Voice Profile Badge */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-purple-900/40 border border-purple-700 px-4 py-2">
                <span className="text-lg">🎭</span>
                <span className="text-sm font-bold text-purple-200 capitalize">
                  {result.voice_profile.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Similarity Score */}
            <div className="rounded bg-slate-800 p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-300">
                  Voice Similarity
                </span>
                <span className={`text-lg font-bold ${getSimilarityColor(result.similarity_score)}`}>
                  {(result.similarity_score * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded bg-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-green-500 transition-all"
                  style={{ width: `${result.similarity_score * 100}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-slate-400">
                How closely the output matches the target voice profile
              </div>
            </div>

            {/* Personalized Text */}
            <div className="rounded bg-slate-800 p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-slate-300">
                  Personalized Text
                </h3>
                <button
                  onClick={handleLoadToCanvas}
                  className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  Load to Canvas
                </button>
              </div>
              <div className="rounded bg-slate-900 p-3 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                {result.personalized_text}
              </div>
            </div>

            {/* Analysis (if available) */}
            {result.analysis && (
              <div className="rounded bg-slate-800 p-4">
                <h4 className="text-sm font-bold text-slate-300 mb-2">
                  Transformation Analysis
                </h4>
                <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
                  {result.analysis}
                </p>
              </div>
            )}

            {/* Comparison View */}
            <details className="rounded border border-slate-700 bg-slate-800">
              <summary className="cursor-pointer px-3 py-2 font-medium text-sm text-slate-100 hover:bg-slate-700">
                Compare Original vs Personalized
              </summary>
              <div className="p-3 space-y-3">
                {/* Original */}
                <div>
                  <div className="text-xs font-medium text-slate-400 mb-1">Original</div>
                  <div className="rounded bg-slate-900 p-2 text-sm text-slate-300 leading-relaxed max-h-48 overflow-y-auto">
                    {getActiveText()}
                  </div>
                </div>

                {/* Personalized */}
                <div>
                  <div className="text-xs font-medium text-slate-400 mb-1">Personalized</div>
                  <div className="rounded bg-slate-900 p-2 text-sm text-slate-300 leading-relaxed max-h-48 overflow-y-auto">
                    {result.personalized_text}
                  </div>
                </div>
              </div>
            </details>

            {/* Copy Button */}
            <button
              onClick={() => navigator.clipboard.writeText(result.personalized_text)}
              className="w-full rounded bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600"
            >
              📄 Copy Personalized Text
            </button>
          </>
        )}

        {!result && !isTransforming && !error && (
          <div className="text-center text-sm text-slate-400 py-8">
            Select a voice profile and click Personalize to begin
          </div>
        )}
      </div>
    </div>
  );
}
