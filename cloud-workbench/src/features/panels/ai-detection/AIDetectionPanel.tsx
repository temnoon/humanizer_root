import { useState } from 'react';
import { useCanvas } from '../../../core/context/CanvasContext';
import { api, type AIDetectionResponse } from '../../../core/adapters/api';
import DOMPurify from 'dompurify';

/**
 * AIDetectionPanel - AI-Generated Content Detection
 *
 * Features:
 * - Detect AI-generated text with confidence scoring
 * - Highlight tell-words (AI markers) with severity levels
 * - Grade content (clearly_human → clearly_ai)
 * - Analysis explanation
 * - Safe HTML rendering with DOMPurify
 */
export function AIDetectionPanel() {
  const { getActiveText } = useCanvas();
  const [result, setResult] = useState<AIDetectionResponse | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDetect = async () => {
    const text = getActiveText();

    if (!text || text.trim().length === 0) {
      setError('No text to analyze. Please load text to Canvas first.');
      return;
    }

    setIsDetecting(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.aiDetect({ text });
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'AI detection failed');
      console.error('AI detection error:', err);
    } finally {
      setIsDetecting(false);
    }
  };

  const getGradeBadge = (grade: string) => {
    const badges = {
      clearly_human: { color: 'bg-green-900/40 text-green-200 border-green-700', label: '✓ Clearly Human', icon: '👤' },
      likely_human: { color: 'bg-blue-900/40 text-blue-200 border-blue-700', label: 'Likely Human', icon: '🙂' },
      uncertain: { color: 'bg-amber-900/40 text-amber-200 border-amber-700', label: '⚠ Uncertain', icon: '❓' },
      likely_ai: { color: 'bg-orange-900/40 text-orange-200 border-orange-700', label: 'Likely AI', icon: '🤖' },
      clearly_ai: { color: 'bg-red-900/40 text-red-200 border-red-700', label: '⚠ Clearly AI', icon: '🚨' },
    };

    const badge = badges[grade as keyof typeof badges] || badges.uncertain;

    return (
      <div className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium border ${badge.color}`}>
        <span className="text-lg">{badge.icon}</span>
        <span>{badge.label}</span>
      </div>
    );
  };

  const highlightTellWords = (text: string, tellWords: AIDetectionResponse['tell_words']) => {
    if (!tellWords || tellWords.length === 0) {
      return text;
    }

    // Sort by position (descending) to avoid position shifts during replacement
    const sorted = [...tellWords].sort((a, b) => b.position - a.position);

    let highlightedText = text;

    for (const { word, position, severity } of sorted) {
      const colorClass = {
        low: 'bg-yellow-500/30 text-yellow-100 border-b-2 border-yellow-500',
        medium: 'bg-orange-500/30 text-orange-100 border-b-2 border-orange-500',
        high: 'bg-red-500/30 text-red-100 border-b-2 border-red-500',
      }[severity];

      const before = highlightedText.substring(0, position);
      const after = highlightedText.substring(position + word.length);

      highlightedText = `${before}<mark class="${colorClass}" title="Severity: ${severity}">${word}</mark>${after}`;
    }

    // Sanitize to prevent XSS
    return DOMPurify.sanitize(highlightedText, {
      ALLOWED_TAGS: ['mark'],
      ALLOWED_ATTR: ['class', 'title'],
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-700 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-100">🔍 AI Detection</h2>
        <p className="text-xs text-slate-400 mt-1">
          Detect AI-generated content and identify tell-words
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
          onClick={handleDetect}
          disabled={!getActiveText() || isDetecting}
          className="w-full rounded bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {isDetecting ? '⏳ Detecting...' : '🔍 Detect AI Content'}
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
            {/* Grade Badge */}
            <div className="text-center">
              {getGradeBadge(result.grade)}
            </div>

            {/* Confidence Score */}
            <div className="rounded bg-slate-800 p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-300">
                  AI Confidence
                </span>
                <span className="text-lg font-bold text-indigo-400">
                  {(result.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded bg-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-green-500 via-amber-500 to-red-500 transition-all"
                  style={{ width: `${result.confidence * 100}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-slate-400">
                {result.is_ai_generated
                  ? 'High likelihood of AI generation detected'
                  : 'Text appears to be human-written'}
              </div>
            </div>

            {/* Tell-Words */}
            {result.tell_words && result.tell_words.length > 0 && (
              <div className="rounded bg-slate-800 p-4">
                <h3 className="text-sm font-bold text-slate-300 mb-3">
                  Tell-Words Detected ({result.tell_words.length})
                </h3>

                {/* Legend */}
                <div className="flex flex-wrap gap-2 mb-3 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded bg-yellow-500/30 border-b-2 border-yellow-500"></div>
                    <span className="text-slate-400">Low</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded bg-orange-500/30 border-b-2 border-orange-500"></div>
                    <span className="text-slate-400">Medium</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded bg-red-500/30 border-b-2 border-red-500"></div>
                    <span className="text-slate-400">High</span>
                  </div>
                </div>

                {/* Highlighted Text */}
                <div
                  className="rounded bg-slate-900 p-3 text-sm text-slate-300 leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: highlightTellWords(getActiveText() || '', result.tell_words),
                  }}
                />

                {/* Tell-Word List */}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-indigo-400 hover:text-indigo-300">
                    View tell-words list
                  </summary>
                  <div className="mt-2 space-y-1">
                    {result.tell_words.map((tw, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs bg-slate-900 rounded px-2 py-1"
                      >
                        <span className="font-mono text-slate-300">{tw.word}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            tw.severity === 'high'
                              ? 'bg-red-900/40 text-red-200'
                              : tw.severity === 'medium'
                              ? 'bg-orange-900/40 text-orange-200'
                              : 'bg-yellow-900/40 text-yellow-200'
                          }`}
                        >
                          {tw.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* Analysis */}
            {result.analysis && (
              <div className="rounded bg-slate-800 p-4">
                <h4 className="text-sm font-bold text-slate-300 mb-2">
                  Analysis
                </h4>
                <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
                  {result.analysis}
                </p>
              </div>
            )}

            {/* Raw Data (Collapsible) */}
            <details className="rounded border border-slate-700 bg-slate-800">
              <summary className="cursor-pointer px-3 py-2 font-medium text-sm text-slate-100 hover:bg-slate-700">
                View Raw Data
              </summary>
              <div className="p-3">
                <pre className="text-xs text-slate-400 overflow-x-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </details>
          </>
        )}

        {!result && !isDetecting && !error && (
          <div className="text-center text-sm text-slate-400 py-8">
            Load text to Canvas and click Detect to begin
          </div>
        )}
      </div>
    </div>
  );
}
