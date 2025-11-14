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
    if (verdict === 'human') return 'text-green-400';
    if (verdict === 'ai') return 'text-red-400';
    return 'text-amber-400';
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
      <div className="border-b border-slate-700 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-100">🖥️ Computer Humanizer</h2>
        <p className="text-xs text-slate-400 mt-1">
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
      <div className="border-b border-slate-700 p-4 space-y-3 max-h-96 overflow-y-auto">
        {/* Intensity Slider */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Intensity: <span className="text-indigo-400 capitalize">{intensity}</span>
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
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>Light</span>
              <span>Moderate</span>
              <span>Aggressive</span>
            </div>
            <div className="text-xs text-slate-400 italic">
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
            className="rounded bg-slate-700 border-slate-600 text-indigo-600"
          />
          <label htmlFor="llm-polish" className="text-xs text-slate-300">
            Enable LLM polish pass (recommended)
          </label>
        </div>

        {/* Voice Profile Upload */}
        <div className="rounded border border-slate-600 bg-slate-800 p-3">
          <label className="block text-xs font-medium text-slate-300 mb-2">
            📝 Voice Profile (Optional)
          </label>
          <p className="text-xs text-slate-400 mb-2">
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
            className="block w-full rounded bg-slate-700 px-3 py-2 text-xs text-slate-300 text-center cursor-pointer hover:bg-slate-600"
          >
            Choose Files (max 10)
          </label>
          {voiceFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              {voiceFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded bg-slate-900 px-2 py-1 text-xs"
                >
                  <span className="text-slate-300 truncate">{file.name}</span>
                  <button
                    onClick={() => removeVoiceFile(index)}
                    className="text-red-400 hover:text-red-300 ml-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
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
          {isTransforming ? '⏳ Humanizing...' : '🖥️ Humanize Text'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="border-b border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
        {/* DEBUG: Always show this section to verify rendering */}
        <div className="text-xs text-slate-500 border border-slate-700 p-2 rounded">
          Results Section: {result ? '✅ DATA LOADED' : '⏳ Waiting...'}
        </div>

        {result && (
          <>
            {/* Metrics Dashboard */}
            <div className="rounded border border-slate-600 bg-slate-800 p-4">
              <h3 className="text-sm font-bold text-slate-300 mb-3">
                📊 Humanization Metrics
              </h3>

              {/* AI Confidence */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-slate-400">AI Confidence</span>
                  <div className="flex gap-4">
                    <span className="text-xs">
                      Before: <span className="text-red-400 font-bold">{result.baseline.detection.confidence}%</span>
                    </span>
                    <span className="text-xs">
                      After: <span className="text-green-400 font-bold">{result.final.detection.confidence}%</span>
                    </span>
                    <span className="text-xs text-indigo-400 font-bold">
                      {result.improvement.aiConfidenceDrop > 0 ? '-' : '+'}{Math.abs(result.improvement.aiConfidenceDrop).toFixed(0)} pts
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-slate-700 rounded overflow-hidden flex">
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
                  <span className="text-xs font-medium text-slate-400">Burstiness (sentence variation)</span>
                  <div className="flex gap-4">
                    <span className="text-xs">
                      Before: <span className="text-red-400 font-bold">{result.baseline.detection.signals.burstiness}/100</span>
                    </span>
                    <span className="text-xs">
                      After: <span className="text-green-400 font-bold">{result.final.detection.signals.burstiness}/100</span>
                    </span>
                    <span className="text-xs text-indigo-400 font-bold">
                      +{result.improvement.burstinessIncrease.toFixed(0)} pts
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-slate-700 rounded overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-red-500 via-amber-500 to-green-500"
                    style={{ width: `${result.final.detection.signals.burstiness}%` }}
                  />
                </div>
              </div>

              {/* Tell-Words */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-slate-400">Tell-Words Removed</span>
                  <div className="flex gap-4">
                    <span className="text-xs">
                      Before: <span className="text-red-400 font-bold">{result.baseline.detection.detectedTellWords.length}</span>
                    </span>
                    <span className="text-xs">
                      After: <span className="text-green-400 font-bold">{result.final.detection.detectedTellWords.length}</span>
                    </span>
                    <span className="text-xs text-indigo-400 font-bold">
                      -{result.improvement.tellWordsRemoved}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verdict Comparison */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-700">
                <div className="text-center">
                  <div className="text-xs text-slate-400 mb-1">Before</div>
                  <div className={`text-lg font-bold ${getVerdictColor(result.baseline.detection.verdict)}`}>
                    {getVerdictIcon(result.baseline.detection.verdict)} {result.baseline.detection.verdict.toUpperCase()}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-400 mb-1">After</div>
                  <div className={`text-lg font-bold ${getVerdictColor(result.final.detection.verdict)}`}>
                    {getVerdictIcon(result.final.detection.verdict)} {result.final.detection.verdict.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Processing Time */}
              <div className="mt-3 text-xs text-slate-500 text-center">
                Processed in {(result.processing.totalDurationMs / 1000).toFixed(2)}s
              </div>
            </div>

            {/* Humanized Text */}
            <div className="rounded bg-slate-800 p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-slate-300">
                  Humanized Text
                </h3>
                <button
                  onClick={handleLoadToCanvas}
                  className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  Load to Canvas
                </button>
              </div>
              <div className="rounded bg-slate-900 p-3 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                {result.humanizedText}
              </div>
            </div>

            {/* Comparison View */}
            <details className="rounded border border-slate-700 bg-slate-800">
              <summary className="cursor-pointer px-3 py-2 font-medium text-sm text-slate-100 hover:bg-slate-700">
                Compare Original vs Humanized
              </summary>
              <div className="p-3 space-y-3">
                {/* Original */}
                <div>
                  <div className="text-xs font-medium text-slate-400 mb-1">Original</div>
                  <div className="rounded bg-slate-900 p-2 text-sm text-slate-300 leading-relaxed max-h-48 overflow-y-auto">
                    {getActiveText()}
                  </div>
                </div>

                {/* Humanized */}
                <div>
                  <div className="text-xs font-medium text-slate-400 mb-1">Humanized</div>
                  <div className="rounded bg-slate-900 p-2 text-sm text-slate-300 leading-relaxed max-h-48 overflow-y-auto">
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
              className={`w-full rounded px-4 py-2 text-sm font-medium transition-colors ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {copied ? '✅ Copied to Clipboard!' : '📄 Copy Humanized Text'}
            </button>
          </>
        )}

        {!result && !isTransforming && !error && (
          <div className="text-center text-sm text-slate-400 py-8">
            Select intensity and click Humanize to begin
          </div>
        )}
      </div>
    </div>
  );
}
