import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { cloudAPI } from '../../lib/cloud-api-client';
import InputCopyButton from '../InputCopyButton';
import SpeechToText from '../SpeechToText';
import { useWakeLock } from '../../hooks/useWakeLock';
import { useTransformationState } from '../../contexts/TransformationStateContext';

interface TellWord {
  word: string;
  category: string;
  count: number;
}

export default function AIDetectorPanel() {
  // Get state from context (persists across navigation)
  const { state, updateAIDetector } = useTransformationState();
  const { text, useAPI, result } = state.aiDetector;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [userTier, setUserTier] = useState('free');

  // Wake Lock: Keep screen awake during detection (5 min max for battery safety)
  useWakeLock(loading, { maxDuration: 5 * 60 * 1000, debug: false });

  // Load API status on mount
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const status = await cloudAPI.getAIDetectionStatus();
      setApiAvailable(status.apiDetection);
      setUserTier(status.userTier);
    } catch (err) {
      console.error('Failed to load AI detection status:', err);
    }
  };

  const handleDetect = async () => {
    if (!text.trim()) {
      setError('Please enter some text to analyze');
      return;
    }

    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length < 20) {
      setError('Text must be at least 20 words for accurate detection');
      return;
    }

    setLoading(true);
    setError(null);
    updateAIDetector({ result: null }); // Clear previous result

    try {
      console.log('[AI Detector] Starting detection, text length:', text.length, 'words:', words.length);
      console.log('[AI Detector] useAPI:', useAPI);
      const detectionResult = await cloudAPI.detectAI(text, useAPI);
      console.log('[AI Detector] Result:', detectionResult);
      updateAIDetector({ result: detectionResult }); // Save result to context
    } catch (err: any) {
      console.error('[AI Detector] Error:', err);
      setError(err.message || 'Failed to detect AI content');
    } finally {
      setLoading(false);
    }
  };

  const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  const isValidLength = wordCount >= 20;

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'human':
        return 'var(--success)';
      case 'ai':
        return 'var(--error)';
      case 'uncertain':
        return 'var(--warning)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const getConfidenceBar = (confidence: number) => {
    const color = confidence < 35 ? 'var(--success)' :
                  confidence > 65 ? 'var(--error)' :
                  'var(--warning)';
    return (
      <div style={{
        width: '100%',
        height: '8px',
        background: 'var(--bg-tertiary)',
        borderRadius: '4px',
        overflow: 'hidden',
        marginTop: '8px'
      }}>
        <div style={{
          width: `${confidence}%`,
          height: '100%',
          background: color,
          transition: 'width 0.3s ease'
        }} />
      </div>
    );
  };

  const highlightTellWords = (inputText: string, tellWords: TellWord[]) => {
    if (!tellWords || tellWords.length === 0) return inputText;

    // Escape HTML first to prevent XSS
    const escapeHtml = (text: string) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    let highlightedText = escapeHtml(inputText);
    const sortedTellWords = [...tellWords].sort((a, b) => b.word.length - a.word.length);

    sortedTellWords.forEach(tw => {
      // Escape the tell-word for safe regex matching
      const escapedWord = tw.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "\\'");
      const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
      highlightedText = highlightedText.replace(regex, (match) =>
        `<mark style="background: var(--accent-purple); color: var(--bg-primary); padding: 2px 4px; border-radius: 3px;">${match}</mark>`
      );
    });

    // Sanitize the final HTML with DOMPurify to ensure no malicious code
    return DOMPurify.sanitize(highlightedText, {
      ALLOWED_TAGS: ['mark'],
      ALLOWED_ATTR: ['style']
    });
  };

  return (
    <div style={{
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '20px'
    }}>
      <h1 style={{ marginBottom: '10px' }}>AI Tell Detector</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
        Identify AI-generated text using statistical analysis and pattern matching
      </p>

      {/* Input Area */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <label style={{
            fontWeight: 500,
            color: 'var(--text-primary)'
          }}>
            Text to Analyze
            <span style={{
              color: 'var(--text-secondary)',
              fontWeight: 'normal',
              marginLeft: '8px',
              fontSize: '0.9em'
            }}>
              ({wordCount} words, minimum 20)
            </span>
          </label>
          <InputCopyButton text={text} label="Copy Input" />
        </div>
        <textarea
          value={text}
          onChange={(e) => updateAIDetector({ text: e.target.value })}
          placeholder="Paste text here or use voice input..."
          style={{
            width: '100%',
            minHeight: '150px',
            padding: '12px',
            fontSize: '14px',
            lineHeight: '1.6',
            border: `1px solid ${isValidLength ? 'var(--border-color)' : 'var(--error)'}`,
            borderRadius: '8px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            resize: 'vertical',
            fontFamily: 'inherit',
            marginBottom: '8px'
          }}
        />

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          {!isValidLength && wordCount > 0 ? (
            <p style={{ color: 'var(--error)', fontSize: '0.9em', margin: 0 }}>
              Need {20 - wordCount} more words for accurate detection
            </p>
          ) : (
            <div />
          )}

          <SpeechToText
            onTranscript={(transcript) => {
              const newText = text ? `${text} ${transcript}` : transcript;
              updateAIDetector({ text: newText });
            }}
            buttonLabel="🎤 Voice"
          />
        </div>
      </div>

      {/* Options */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: apiAvailable ? 'pointer' : 'not-allowed',
          opacity: apiAvailable ? 1 : 0.5
        }}>
          <input
            type="checkbox"
            checked={useAPI}
            onChange={(e) => updateAIDetector({ useAPI: e.target.checked })}
            disabled={!apiAvailable}
            style={{ cursor: apiAvailable ? 'pointer' : 'not-allowed' }}
          />
          <span>
            Use advanced detection (GPTZero API)
            {!apiAvailable && ' - Not configured'}
            {apiAvailable && (userTier === 'free' || userTier === 'member') && ' - PRO+ required'}
          </span>
        </label>
        <p style={{
          fontSize: '0.85em',
          color: 'var(--text-secondary)',
          marginTop: '4px',
          marginLeft: '28px'
        }}>
          {apiAvailable
            ? 'Sends text to GPTZero servers for higher accuracy (~99% vs ~70% local)'
            : 'Local-only detection protects your privacy (no data sent to external services)'}
        </p>
      </div>

      {/* Detect Button */}
      <button
        onClick={handleDetect}
        disabled={loading || !isValidLength}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          fontWeight: 500,
          background: loading || !isValidLength ? 'var(--bg-tertiary)' : 'var(--accent-purple)',
          color: 'var(--text-primary)',
          border: 'none',
          borderRadius: '8px',
          cursor: loading || !isValidLength ? 'not-allowed' : 'pointer',
          opacity: loading || !isValidLength ? 0.5 : 1,
          marginBottom: '30px'
        }}
      >
        {loading ? '🔍 Analyzing...' : '🔍 Detect AI Content'}
      </button>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px',
          background: 'var(--error)',
          color: 'var(--bg-primary)',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          {/* Verdict */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{
              fontSize: '1.3em',
              marginBottom: '8px',
              color: getVerdictColor(result.verdict)
            }}>
              {result.verdict === 'human' && '✅ Likely Human-Written'}
              {result.verdict === 'ai' && '🤖 Likely AI-Generated'}
              {result.verdict === 'uncertain' && '❓ Uncertain'}
            </h2>
            <p style={{
              color: 'var(--text-secondary)',
              marginBottom: '4px'
            }}>
              {result.explanation}
            </p>
            <p style={{
              fontSize: '0.85em',
              color: 'var(--text-secondary)'
            }}>
              Confidence: {result.confidence}% • Method: {result.method} • {result.processingTimeMs}ms
            </p>
            {getConfidenceBar(result.confidence)}
            {result.message && (
              <p style={{
                marginTop: '12px',
                padding: '8px 12px',
                background: 'var(--bg-tertiary)',
                borderRadius: '6px',
                fontSize: '0.9em',
                color: 'var(--text-secondary)'
              }}>
                ℹ️ {result.message}
              </p>
            )}
          </div>

          {/* Signals Breakdown */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1em', marginBottom: '12px' }}>Detection Signals</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              <SignalCard
                name="Burstiness"
                value={result.signals.burstiness}
                description="Sentence length variation"
                isGood={result.signals.burstiness > 50}
              />
              <SignalCard
                name="Tell-Words"
                value={result.signals.tellWordScore}
                description="AI-characteristic phrases"
                isGood={result.signals.tellWordScore < 50}
              />
              <SignalCard
                name="Readability"
                value={result.signals.readabilityPattern}
                description="Typical AI range"
                isGood={result.signals.readabilityPattern < 50}
              />
              <SignalCard
                name="Lexical Diversity"
                value={result.signals.lexicalDiversity}
                description="Vocabulary richness"
                isGood={result.signals.lexicalDiversity > 50}
              />
            </div>
          </div>

          {/* Metrics */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1em', marginBottom: '12px' }}>Text Metrics</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '8px',
              fontSize: '0.9em'
            }}>
              <MetricDisplay label="Words" value={result.metrics.wordCount} />
              <MetricDisplay label="Sentences" value={result.metrics.sentenceCount} />
              <MetricDisplay label="Avg Sentence" value={`${result.metrics.avgSentenceLength} words`} />
              <MetricDisplay label="Flesch Score" value={result.metrics.fleschReadingEase} />
              <MetricDisplay label="Gunning Fog" value={result.metrics.gunningFog} />
            </div>
          </div>

          {/* Tell-Words */}
          {result.detectedTellWords.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1.1em', marginBottom: '12px' }}>
                Detected AI Tell-Words ({result.detectedTellWords.length})
              </h3>
              <div style={{
                background: 'var(--bg-tertiary)',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '12px'
              }}>
                {result.detectedTellWords.slice(0, 10).map((tw, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'inline-block',
                      margin: '4px',
                      padding: '4px 8px',
                      background: 'var(--accent-purple)',
                      color: 'var(--bg-primary)',
                      borderRadius: '4px',
                      fontSize: '0.85em'
                    }}
                  >
                    "{tw.word}" ({tw.count}×) • {tw.category}
                  </div>
                ))}
              </div>

              {/* Highlighted Text */}
              <details style={{ marginTop: '12px' }}>
                <summary style={{
                  cursor: 'pointer',
                  fontWeight: 500,
                  marginBottom: '8px',
                  color: 'var(--accent-purple)'
                }}>
                  View highlighted text
                </summary>
                <div
                  style={{
                    padding: '12px',
                    background: 'var(--bg-primary)',
                    borderRadius: '8px',
                    fontSize: '0.9em',
                    lineHeight: '1.6',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}
                  dangerouslySetInnerHTML={{
                    __html: highlightTellWords(text, result.detectedTellWords)
                  }}
                />
              </details>
            </div>
          )}
        </div>
      )}

      {/* Info Panel */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '20px',
        fontSize: '0.9em',
        color: 'var(--text-secondary)'
      }}>
        <h3 style={{ fontSize: '1.1em', marginBottom: '12px', color: 'var(--text-primary)' }}>
          How It Works
        </h3>
        <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <li><strong>Local Detection:</strong> Uses statistical analysis (burstiness, readability, lexical diversity, tell-words)</li>
          <li><strong>Accuracy:</strong> ~70% local, ~95% with GPTZero API (PRO+ only)</li>
          <li><strong>Privacy:</strong> Local detection processes text entirely in your browser</li>
          <li><strong>Best For:</strong> Text with at least 50-100 words for most accurate results</li>
        </ul>
      </div>
    </div>
  );
}

// Signal Card Component
function SignalCard({ name, value, description, isGood }: {
  name: string;
  value: number;
  description: string;
  isGood: boolean;
}) {
  const color = isGood ? 'var(--success)' : 'var(--warning)';

  return (
    <div style={{
      padding: '12px',
      background: 'var(--bg-tertiary)',
      borderRadius: '8px',
      borderLeft: `3px solid ${color}`
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px'
      }}>
        <span style={{ fontWeight: 500 }}>{name}</span>
        <span style={{ color, fontWeight: 600 }}>{value}</span>
      </div>
      <p style={{
        fontSize: '0.85em',
        color: 'var(--text-secondary)',
        margin: 0
      }}>
        {description}
      </p>
    </div>
  );
}

// Metric Display Component
function MetricDisplay({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      padding: '8px',
      background: 'var(--bg-tertiary)',
      borderRadius: '6px'
    }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>{label}</div>
      <div style={{ fontWeight: 600, marginTop: '2px' }}>{value}</div>
    </div>
  );
}
