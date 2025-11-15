import { useState } from 'react';
import { useCanvas } from '../../../core/context/CanvasContext';
import { api, type AIDetectionResponse } from '../../../core/adapters/api';
import DOMPurify from 'dompurify';
import { PhilosophyTooltip } from '../../../components/ui/PhilosophyTooltip';

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
      clearly_human: {
        className: 'badge-success',
        label: '✓ Clearly Human',
        icon: '👤'
      },
      likely_human: {
        className: 'badge-info',
        label: 'Likely Human',
        icon: '🙂'
      },
      uncertain: {
        className: 'badge-warning',
        label: '⚠ Uncertain',
        icon: '❓'
      },
      likely_ai: {
        className: 'badge-warning',
        label: 'Likely AI',
        icon: '🤖'
      },
      clearly_ai: {
        className: 'badge-error',
        label: '⚠ Clearly AI',
        icon: '🚨'
      },
    };

    const badge = badges[grade as keyof typeof badges] || badges.uncertain;

    return (
      <div className={`badge ${badge.className} badge-lg gap-2`}>
        <span className="text-lg">{badge.icon}</span>
        <span>{badge.label}</span>
      </div>
    );
  };

  const highlightTellWords = (text: string, tellWords: AIDetectionResponse['detectedTellWords']) => {
    if (!tellWords || tellWords.length === 0) {
      return text;
    }

    // For each detected tell-word, find and highlight all occurrences
    let highlightedText = text;

    for (const { word, category } of tellWords) {
      // Create case-insensitive regex for the word
      const regex = new RegExp(`\\b${word}\\b`, 'gi');

      // Use inline styles compatible with DaisyUI
      const markStyle = 'background: rgba(251, 191, 36, 0.3); color: inherit; border-bottom: 2px solid rgb(251, 191, 36); padding: 0 2px;';

      highlightedText = highlightedText.replace(regex, (match) => {
        return `<mark style="${markStyle}" title="Category: ${category}">${match}</mark>`;
      });
    }

    // Sanitize to prevent XSS
    return DOMPurify.sanitize(highlightedText, {
      ALLOWED_TAGS: ['mark'],
      ALLOWED_ATTR: ['style', 'title'],
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="panel-header">
        <h2 className="text-lg font-bold text-base-content">🔍 AI Detection</h2>
        <p className="text-xs mt-1 text-base-content opacity-70">
          Detect AI-generated content and identify tell-words
        </p>
      </div>

      {/* Philosophy Context */}
      <PhilosophyTooltip
        title="Detecting Synthetic vs. Lived Experience Markers"
        description="AI detection reveals the difference between synthetic pattern matching and lived phenomenological experience. Human writing emerges from embodied consciousness — messy, contextual, full of personal history. AI writing emerges from statistical optimization — smooth, generic, pattern-conforming. Tell-words aren't just frequent phrases — they're markers of disembodied cognition, language without experiential grounding. This tool identifies the phenomenological gap between consciousness and computation."
        learnMoreUrl="https://humanizer.com/docs/tools/ai-detection"
      />

      {/* Config Form */}
      <div className="border-b border-base-300 p-4 space-y-3">
        {/* Canvas Text Preview */}
        <div className="card bg-base-200 rounded-lg p-3">
          <div className="text-xs mb-1 text-base-content opacity-70">Reading from Canvas</div>
          <div className="text-sm text-base-content">
            {getActiveText()
              ? `${getActiveText().substring(0, 100)}${getActiveText().length > 100 ? '...' : ''}`
              : 'No text in Canvas'}
          </div>
        </div>

        <button
          onClick={handleDetect}
          disabled={!getActiveText() || isDetecting}
          className="btn btn-primary w-full"
        >
          {isDetecting ? '⏳ Detecting...' : '🔍 Detect AI Content'}
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
            {/* Verdict Badge */}
            <div className="text-center">
              {getGradeBadge(result.verdict)}
            </div>

            {/* Confidence Score */}
            <div className="card bg-base-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-base-content opacity-70">
                  AI Confidence
                </span>
                <span className="text-lg font-bold text-primary">
                  {/* Backend returns percentage (0-100), not decimal (0-1) */}
                  {result.confidence.toFixed(0)}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded bg-base-300">
                <div
                  className="h-full bg-gradient-to-r from-green-500 via-amber-500 to-red-500 transition-all"
                  style={{ width: `${result.confidence}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-base-content opacity-50">
                {result.verdict === 'ai'
                  ? 'High likelihood of AI generation detected'
                  : result.verdict === 'human'
                  ? 'Text appears to be human-written'
                  : 'Detection uncertain - mixed signals'}
              </div>
            </div>

            {/* Tell-Words */}
            {result.detectedTellWords && result.detectedTellWords.length > 0 && (
              <div className="card bg-base-200 rounded-lg p-4">
                <h3 className="text-sm font-bold mb-3 text-base-content">
                  Tell-Words Detected ({result.detectedTellWords.length})
                </h3>

                {/* Highlighted Text */}
                <div
                  className="bg-base-300 rounded-lg p-3 text-sm leading-relaxed text-base-content"
                  dangerouslySetInnerHTML={{
                    __html: highlightTellWords(getActiveText() || '', result.detectedTellWords),
                  }}
                />

                {/* Tell-Word List */}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-primary">
                    View tell-words list
                  </summary>
                  <div className="mt-2 space-y-1">
                    {result.detectedTellWords.map((tw, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs bg-base-300 rounded-lg px-2 py-1"
                      >
                        <span className="font-mono text-base-content">{tw.word}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-base-content opacity-70">
                            {tw.category}
                          </span>
                          <span className="badge badge-sm">
                            {tw.count}x
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* Explanation */}
            {result.explanation && (
              <div className="card bg-base-200 rounded-lg p-4">
                <h4 className="text-sm font-bold mb-2 text-base-content">
                  Analysis
                </h4>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-base-content opacity-80">
                  {result.explanation}
                </p>
              </div>
            )}

            {/* Raw Data (Collapsible) */}
            <details className="card bg-base-200 rounded-lg border border-base-300">
              <summary className="cursor-pointer px-3 py-2 font-medium text-sm text-base-content hover:bg-base-100">
                View Raw Data
              </summary>
              <div className="p-3">
                <pre className="text-xs overflow-x-auto text-base-content opacity-70">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </details>
          </>
        )}

        {!result && !isDetecting && !error && (
          <div className="text-center text-sm py-8 text-base-content opacity-70">
            Load text to Canvas and click Detect to begin
          </div>
        )}
      </div>
    </div>
  );
}
