import { useState } from 'react';
import { useCanvas } from '../../../core/context/CanvasContext';
import { api } from '../../../core/adapters/api';
import { PhilosophyTooltip } from '../../../components/ui/PhilosophyTooltip';

/**
 * Computer Humanizer Response
 */
interface HumanizationResult {
  transformation_id: string;
  humanizedText: string;
  baseline: {
    detection: {
      confidence: number;
      verdict: 'human' | 'ai' | 'uncertain';
      signals: {
        burstiness: number;
        tellWordScore: number;
        readabilityPattern: number;
        lexicalDiversity: number;
      };
      detectedTellWords: Array<{ word: string; category: string; count: number }>;
    };
  };
  final: {
    detection: {
      confidence: number;
      verdict: 'human' | 'ai' | 'uncertain';
      signals: {
        burstiness: number;
        tellWordScore: number;
        readabilityPattern: number;
        lexicalDiversity: number;
      };
      detectedTellWords: Array<{ word: string; category: string; count: number }>;
    };
  };
  improvement: {
    aiConfidenceDrop: number;
    burstinessIncrease: number;
    tellWordsRemoved: number;
    lexicalDiversityChange: number;
  };
  processing: {
    totalDurationMs: number;
  };
}

/**
 * ComputerHumanizerPanel - AI Text Humanization
 *
 * Features:
 * - Reduce AI detection scores
 * - Improve text naturalness (burstiness, tell-words, diversity)
 * - Intensity control (light/moderate/aggressive)
 * - Optional voice profile upload
 * - Before/after metrics dashboard
 */
export function ComputerHumanizerPanel() {
  const { getActiveText, setText } = useCanvas();
  const [result, setResult] = useState<HumanizationResult | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Configuration
  const [intensity, setIntensity] = useState<'light' | 'moderate' | 'aggressive'>('moderate');
  const [voiceFiles, setVoiceFiles] = useState<File[]>([]);
  const [enableLLMPolish, setEnableLLMPolish] = useState(true);

  const handleTransform = async () => {
    const text = getActiveText();

    if (!text || text.trim().length === 0) {
      setError('No text to humanize. Please load text to Canvas first.');
      return;
    }

    setIsTransforming(true);
    setError(null);
    setResult(null);

    try {
      // Read voice samples if provided
      const voiceSamples: string[] = [];
      for (const file of voiceFiles) {
        const content = await file.text();
        voiceSamples.push(content);
      }

      const response = await api.computerHumanizer({
        text,
        intensity,
        voiceSamples: voiceSamples.length > 0 ? voiceSamples : undefined,
        enableLLMPolish
      }) as HumanizationResult;

      console.log('[Computer Humanizer] Response received:', response);
      console.log('[Computer Humanizer] Has humanizedText?', !!response.humanizedText);
      console.log('[Computer Humanizer] Has baseline?', !!response.baseline);
      console.log('[Computer Humanizer] Has final?', !!response.final);

      setResult(response);
      console.log('[Computer Humanizer] Result state set, should render now');
    } catch (err: any) {
      setError(err.message || 'Humanization failed');
      console.error('Computer Humanizer error:', err);
    } finally {
      setIsTransforming(false);
    }
  };

  const handleLoadToCanvas = () => {
    if (result) {
      setText(result.humanizedText);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles = Array.from(files).filter(
      file => file.type === 'text/plain' || file.name.endsWith('.md')
    );

    setVoiceFiles(prev => [...prev, ...newFiles].slice(0, 10)); // Max 10 files
  };

  const removeVoiceFile = (index: number) => {
    setVoiceFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getVerdictColor = (verdict: 'human' | 'ai' | 'uncertain') => {
    if (verdict === 'human') return 'var(--accent-green)';
    if (verdict === 'ai') return 'var(--accent-red)';
    return 'var(--accent-yellow)';
  };

  const getVerdictIcon = (verdict: 'human' | 'ai' | 'uncertain') => {
    if (verdict === 'human') return '✅';
    if (verdict === 'ai') return '🤖';
    return '❓';
  };

  const getIntensityDescription = (level: 'light' | 'moderate' | 'aggressive') => {
    switch (level) {
      case 'light':
        return '30% tell-word removal, gentle changes';
      case 'moderate':
        return '60% tell-word removal, balanced approach';
      case 'aggressive':
        return '90% tell-word removal, maximum humanization';
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="panel-header">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>🖥️ Computer Humanizer</h2>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Reduce AI detection while preserving meaning
        </p>
      </div>

      {/* Philosophy Context */}
      <PhilosophyTooltip
        title="Statistical Phenomenology — Beyond Surface Detection"
        description="Computer Humanizer addresses the phenomenological gap between AI-generated and human-written text. It operates on three layers: (1) Statistical naturalness (burstiness, lexical patterns), (2) Idiomatic authenticity (removing AI tell-words), and (3) Experiential grounding (optional voice matching). The goal isn't deception—it's restoring the texture of lived experience that AI models often flatten into uniform, predictable patterns."
        learnMoreUrl="https://humanizer.com/docs/tools/computer-humanizer"
      />

      {/* Config Form */}
      <div className="border-b p-4 space-y-3 max-h-96 overflow-y-auto" style={{ borderColor: 'var(--border-color)' }}>
        {/* Intensity Slider */}
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            Intensity: <span style={{ color: 'var(--accent-purple)' }} className="capitalize">{intensity}</span>
          </label>
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="2"
              step="1"
              value={intensity === 'light' ? 0 : intensity === 'moderate' ? 1 : 2}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setIntensity(value === 0 ? 'light' : value === 1 ? 'moderate' : 'aggressive');
              }}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{ background: 'var(--bg-tertiary)', accentColor: 'var(--accent-purple)' }}
            />
            <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span>Light</span>
              <span>Moderate</span>
              <span>Aggressive</span>
            </div>
            <div className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>
              {getIntensityDescription(intensity)}
            </div>
          </div>
        </div>

        {/* LLM Polish Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="llm-polish"
            checked={enableLLMPolish}
            onChange={(e) => setEnableLLMPolish(e.target.checked)}
            className="rounded"
            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', accentColor: 'var(--accent-purple)' }}
          />
          <label htmlFor="llm-polish" className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Enable LLM polish pass (recommended)
          </label>
        </div>

        {/* Voice Profile Upload */}
        <div className="card rounded p-3">
          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            📝 Voice Profile (Optional)
          </label>
          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
            Upload your writing samples (.txt, .md) to match your personal style
          </p>
          <input
            type="file"
            accept=".txt,.md"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            id="voice-upload"
          />
          <label
            htmlFor="voice-upload"
            className="btn-secondary block w-full rounded px-3 py-2 text-xs text-center cursor-pointer"
          >
            Choose Files (max 10)
          </label>
          {voiceFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              {voiceFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded px-2 py-1 text-xs"
                  style={{ background: 'var(--bg-primary)' }}
                >
                  <span className="truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</span>
                  <button
                    onClick={() => removeVoiceFile(index)}
                    className="hover-accent ml-2"
                    style={{ color: 'var(--accent-red)' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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
          onClick={handleTransform}
          disabled={!getActiveText() || isTransforming}
          className="btn-primary w-full rounded px-4 py-2 font-medium disabled:opacity-50"
        >
          {isTransforming ? '⏳ Humanizing...' : '🖥️ Humanize Text'}
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
        {/* DEBUG: Always show this section to verify rendering */}
        <div className="text-xs border p-2 rounded" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-color)' }}>
          Results Section: {result ? '✅ DATA LOADED' : '⏳ Waiting...'}
        </div>

        {result && (
          <>
            {/* Metrics Dashboard */}
            <div className="card rounded p-4">
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                📊 Humanization Metrics
              </h3>

              {/* AI Confidence */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>AI Confidence</span>
                  <div className="flex gap-4">
                    <span className="text-xs">
                      Before: <span className="font-bold" style={{ color: 'var(--accent-red)' }}>{result.baseline.detection.confidence}%</span>
                    </span>
                    <span className="text-xs">
                      After: <span className="font-bold" style={{ color: 'var(--accent-green)' }}>{result.final.detection.confidence}%</span>
                    </span>
                    <span className="text-xs font-bold" style={{ color: 'var(--accent-purple)' }}>
                      {result.improvement.aiConfidenceDrop > 0 ? '-' : '+'}{Math.abs(result.improvement.aiConfidenceDrop).toFixed(0)} pts
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded overflow-hidden flex" style={{ background: 'var(--bg-tertiary)' }}>
                  <div
                    className="bg-gradient-to-r from-green-500 to-amber-500"
                    style={{ width: `${100 - result.final.detection.confidence}%` }}
                  />
                  <div
                    className="bg-gradient-to-r from-amber-500 to-red-500"
                    style={{ width: `${result.final.detection.confidence}%` }}
                  />
                </div>
              </div>

              {/* Burstiness */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Burstiness (sentence variation)</span>
                  <div className="flex gap-4">
                    <span className="text-xs">
                      Before: <span className="font-bold" style={{ color: 'var(--accent-red)' }}>{result.baseline.detection.signals.burstiness}/100</span>
                    </span>
                    <span className="text-xs">
                      After: <span className="font-bold" style={{ color: 'var(--accent-green)' }}>{result.final.detection.signals.burstiness}/100</span>
                    </span>
                    <span className="text-xs font-bold" style={{ color: 'var(--accent-purple)' }}>
                      +{result.improvement.burstinessIncrease.toFixed(0)} pts
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                  <div
                    className="bg-gradient-to-r from-red-500 via-amber-500 to-green-500"
                    style={{ width: `${result.final.detection.signals.burstiness}%` }}
                  />
                </div>
              </div>

              {/* Tell-Words */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Tell-Words Removed</span>
                  <div className="flex gap-4">
                    <span className="text-xs">
                      Before: <span className="font-bold" style={{ color: 'var(--accent-red)' }}>{result.baseline.detection.detectedTellWords.length}</span>
                    </span>
                    <span className="text-xs">
                      After: <span className="font-bold" style={{ color: 'var(--accent-green)' }}>{result.final.detection.detectedTellWords.length}</span>
                    </span>
                    <span className="text-xs font-bold" style={{ color: 'var(--accent-purple)' }}>
                      -{result.improvement.tellWordsRemoved}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verdict Comparison */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <div className="text-center">
                  <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Before</div>
                  <div className="text-lg font-bold" style={{ color: getVerdictColor(result.baseline.detection.verdict) }}>
                    {getVerdictIcon(result.baseline.detection.verdict)} {result.baseline.detection.verdict.toUpperCase()}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>After</div>
                  <div className="text-lg font-bold" style={{ color: getVerdictColor(result.final.detection.verdict) }}>
                    {getVerdictIcon(result.final.detection.verdict)} {result.final.detection.verdict.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Processing Time */}
              <div className="mt-3 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                Processed in {(result.processing.totalDurationMs / 1000).toFixed(2)}s
              </div>
            </div>

            {/* Humanized Text */}
            <div className="card rounded p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  Humanized Text
                </h3>
                <button
                  onClick={handleLoadToCanvas}
                  className="btn-primary rounded px-3 py-1 text-xs font-medium"
                >
                  Load to Canvas
                </button>
              </div>
              <div className="rounded p-3 text-sm leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                {result.humanizedText}
              </div>
            </div>

            {/* Comparison View */}
            <details className="card rounded">
              <summary className="cursor-pointer px-3 py-2 font-medium text-sm hover-bg-accent" style={{ color: 'var(--text-primary)' }}>
                Compare Original vs Humanized
              </summary>
              <div className="p-3 space-y-3">
                {/* Original */}
                <div>
                  <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Original</div>
                  <div className="rounded p-2 text-sm leading-relaxed max-h-48 overflow-y-auto" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                    {getActiveText()}
                  </div>
                </div>

                {/* Humanized */}
                <div>
                  <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Humanized</div>
                  <div className="rounded p-2 text-sm leading-relaxed max-h-48 overflow-y-auto" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                    {result.humanizedText}
                  </div>
                </div>
              </div>
            </details>

            {/* Copy Button */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(result.humanizedText);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="w-full rounded px-4 py-2 text-sm font-medium transition-colors"
              style={{
                background: copied ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                color: copied ? 'white' : 'var(--text-primary)',
              }}
            >
              {copied ? '✅ Copied to Clipboard!' : '📄 Copy Humanized Text'}
            </button>
          </>
        )}

        {!result && !isTransforming && !error && (
          <div className="text-center text-sm py-8" style={{ color: 'var(--text-secondary)' }}>
            Select intensity and click Humanize to begin
          </div>
        )}
      </div>
    </div>
  );
}
