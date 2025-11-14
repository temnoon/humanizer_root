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
        bgColor: 'rgba(52, 211, 153, 0.2)',
        textColor: 'var(--accent-green)',
        borderColor: 'var(--accent-green)',
        label: '✓ Clearly Human',
        icon: '👤'
      },
      likely_human: {
        bgColor: 'rgba(6, 182, 212, 0.2)',
        textColor: 'var(--accent-cyan)',
        borderColor: 'var(--accent-cyan)',
        label: 'Likely Human',
        icon: '🙂'
      },
      uncertain: {
        bgColor: 'rgba(251, 191, 36, 0.2)',
        textColor: 'var(--accent-yellow)',
        borderColor: 'var(--accent-yellow)',
        label: '⚠ Uncertain',
        icon: '❓'
      },
      likely_ai: {
        bgColor: 'rgba(251, 146, 60, 0.2)',
        textColor: '#fb923c',
        borderColor: '#fb923c',
        label: 'Likely AI',
        icon: '🤖'
      },
      clearly_ai: {
        bgColor: 'rgba(220, 38, 38, 0.2)',
        textColor: 'var(--accent-red)',
        borderColor: 'var(--accent-red)',
        label: '⚠ Clearly AI',
        icon: '🚨'
      },
    };

    const badge = badges[grade as keyof typeof badges] || badges.uncertain;

    return (
      <div
        className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium border"
        style={{
          background: badge.bgColor,
          color: badge.textColor,
          borderColor: badge.borderColor,
        }}
      >
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

      // Use inline styles with CSS variables for theme compatibility
      const markStyle = 'background: rgba(251, 191, 36, 0.3); color: var(--accent-yellow); border-bottom: 2px solid var(--accent-yellow);';

      highlightedText = highlightedText.replace(regex, (match) => {
        return `<mark style="${markStyle}" title="Category: ${category}">${match}</mark>`;
      });
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
      <div className="panel-header">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>🔍 AI Detection</h2>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
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
      <div className="border-b p-4 space-y-3" style={{ borderColor: 'var(--border-color)' }}>
        {/* Canvas Text Preview */}
        <div className="card rounded p-3">
          <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Reading from Canvas</div>
          <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
            {getActiveText()
              ? `${getActiveText().substring(0, 100)}${getActiveText().length > 100 ? '...' : ''}`
              : 'No text in Canvas'}
          </div>
        </div>

        <button
          onClick={handleDetect}
          disabled={!getActiveText() || isDetecting}
          className="btn-primary w-full rounded px-4 py-2 font-medium disabled:opacity-50"
        >
          {isDetecting ? '⏳ Detecting...' : '🔍 Detect AI Content'}
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
            {/* Verdict Badge */}
            <div className="text-center">
              {getGradeBadge(result.verdict)}
            </div>

            {/* Confidence Score */}
            <div className="card rounded p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  AI Confidence
                </span>
                <span className="text-lg font-bold" style={{ color: 'var(--accent-purple)' }}>
                  {/* Backend returns percentage (0-100), not decimal (0-1) */}
                  {result.confidence.toFixed(0)}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded" style={{ background: 'var(--bg-tertiary)' }}>
                <div
                  className="h-full bg-gradient-to-r from-green-500 via-amber-500 to-red-500 transition-all"
                  style={{ width: `${result.confidence}%` }}
                />
              </div>
              <div className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {result.verdict === 'ai'
                  ? 'High likelihood of AI generation detected'
                  : result.verdict === 'human'
                  ? 'Text appears to be human-written'
                  : 'Detection uncertain - mixed signals'}
              </div>
            </div>

            {/* Tell-Words */}
            {result.detectedTellWords && result.detectedTellWords.length > 0 && (
              <div className="card rounded p-4">
                <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                  Tell-Words Detected ({result.detectedTellWords.length})
                </h3>

                {/* Highlighted Text */}
                <div
                  className="rounded p-3 text-sm leading-relaxed"
                  style={{
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                  }}
                  dangerouslySetInnerHTML={{
                    __html: highlightTellWords(getActiveText() || '', result.detectedTellWords),
                  }}
                />

                {/* Tell-Word List */}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs" style={{ color: 'var(--accent-purple)' }}>
                    View tell-words list
                  </summary>
                  <div className="mt-2 space-y-1">
                    {result.detectedTellWords.map((tw, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs rounded px-2 py-1"
                        style={{ background: 'var(--bg-tertiary)' }}
                      >
                        <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{tw.word}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {tw.category}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              background: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                            }}
                          >
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
              <div className="card rounded p-4">
                <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Analysis
                </h4>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                  {result.explanation}
                </p>
              </div>
            )}

            {/* Raw Data (Collapsible) */}
            <details className="card rounded" style={{ border: '1px solid var(--border-color)' }}>
              <summary className="cursor-pointer px-3 py-2 font-medium text-sm hover-bg-accent" style={{ color: 'var(--text-primary)' }}>
                View Raw Data
              </summary>
              <div className="p-3">
                <pre className="text-xs overflow-x-auto" style={{ color: 'var(--text-secondary)' }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </details>
          </>
        )}

        {!result && !isDetecting && !error && (
          <div className="text-center text-sm py-8" style={{ color: 'var(--text-secondary)' }}>
            Load text to Canvas and click Detect to begin
          </div>
        )}
      </div>
    </div>
  );
}
