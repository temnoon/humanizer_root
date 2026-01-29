/**
 * AnalyzeTool - Content Analysis Interface
 *
 * Provides read-only analysis of workspace content:
 * - Voice analysis (writing style fingerprint)
 * - AI detection
 * - Image analysis (OCR + description)
 * - Sentiment analysis
 * - Readability metrics
 * - Custom prompt analysis
 *
 * Unlike TransformTool, results are displayed in-place
 * and do not modify the workspace buffer.
 *
 * @module @humanizer/studio/components/tools/AnalyzeTool
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useBufferSync } from '../../contexts/BufferSyncContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface AnalyzeToolProps {
  className?: string;
}

interface AnalysisOption {
  id: string;
  label: string;
  icon: string;
  description: string;
}

type AnalysisStatus = 'idle' | 'running' | 'error';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const ANALYSIS_OPTIONS: AnalysisOption[] = [
  {
    id: 'voice',
    label: 'Voice',
    icon: '🎙️',
    description: 'Writing style fingerprint: sentence length, contractions, vocabulary richness',
  },
  {
    id: 'ai-detection',
    label: 'AI Detection',
    icon: '🤖',
    description: 'Detect AI-generated content patterns and confidence scores',
  },
  {
    id: 'image',
    label: 'Image',
    icon: '🖼️',
    description: 'OCR text extraction and image description',
  },
  {
    id: 'sentiment',
    label: 'Sentiment',
    icon: '💬',
    description: 'Emotional tone analysis: positive, negative, neutral breakdown',
  },
  {
    id: 'readability',
    label: 'Readability',
    icon: '📊',
    description: 'Grade level, complexity metrics, and reading time estimates',
  },
  {
    id: 'custom',
    label: 'Custom Prompt',
    icon: '🎨',
    description: 'Write your own analysis instructions',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AnalyzeTool({ className = '' }: AnalyzeToolProps): React.ReactElement {
  const { workingContent } = useBufferSync();

  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisOption | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [results, setResults] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const hasContent = workingContent.length > 0;
  const contentText = useMemo(
    () => workingContent.map((item) => item.text).join('\n\n'),
    [workingContent]
  );

  const canAnalyze = useMemo(() => {
    if (!hasContent) return false;
    if (!selectedAnalysis) return false;
    if (selectedAnalysis.id === 'custom' && !customPrompt.trim()) return false;
    return true;
  }, [hasContent, selectedAnalysis, customPrompt]);

  const handleSelectAnalysis = useCallback((option: AnalysisOption) => {
    setSelectedAnalysis(option);
    setResults(null);
    setError(null);
  }, []);

  const handleRunAnalysis = useCallback(async () => {
    if (!canAnalyze || !selectedAnalysis) return;

    setStatus('running');
    setError(null);
    setResults(null);

    try {
      // TODO: Wire to analysis backends (VoiceAnalyzer, AI Detection, ImageAnalysisService, etc.)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const analysisType = selectedAnalysis.id === 'custom' ? customPrompt : selectedAnalysis.label;
      setResults(`[${analysisType} analysis results would appear here]\n\nContent analyzed: ${contentText.split(/\s+/).filter(Boolean).length} words`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setStatus('idle');
    }
  }, [canAnalyze, selectedAnalysis, customPrompt, contentText]);

  const handleClearResults = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return (
    <div className={`analyze-tool ${className}`}>
      {/* Status bar */}
      <div className="analyze-tool__selection">
        {hasContent ? (
          <span className="analyze-tool__selection-count">
            {workingContent.length} item{workingContent.length !== 1 ? 's' : ''} in workspace
            ({contentText.split(/\s+/).filter(Boolean).length} words)
          </span>
        ) : (
          <span className="analyze-tool__selection-empty">
            No content to analyze
          </span>
        )}
      </div>

      {/* Analysis Options Grid */}
      <div className="analyze-tool__options">
        <div className="analyze-tool__options-header">Analysis Type</div>
        <div className="analyze-tool__options-grid" role="listbox" aria-label="Analysis options">
          {ANALYSIS_OPTIONS.map((option) => (
            <button
              key={option.id}
              className={`analyze-option ${selectedAnalysis?.id === option.id ? 'analyze-option--selected' : ''}`}
              onClick={() => handleSelectAnalysis(option)}
              disabled={!hasContent}
              role="option"
              aria-selected={selectedAnalysis?.id === option.id}
            >
              <span className="analyze-option__icon" aria-hidden="true">
                {option.icon}
              </span>
              <span className="analyze-option__label">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Analysis Description */}
      {selectedAnalysis && (
        <div className="analyze-tool__info">
          <p className="analyze-tool__description">{selectedAnalysis.description}</p>
        </div>
      )}

      {/* Custom Prompt Input */}
      {selectedAnalysis?.id === 'custom' && (
        <div className="analyze-tool__custom">
          <label htmlFor="analyze-custom-prompt" className="analyze-tool__custom-label">
            Custom Instructions
          </label>
          <textarea
            id="analyze-custom-prompt"
            className="analyze-tool__custom-input"
            placeholder="Describe what you want to analyze..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={3}
          />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="analyze-tool__error" role="alert">
          <span aria-hidden="true">&#x26A0;&#xFE0F;</span>
          {error}
        </div>
      )}

      {/* Results (read-only) */}
      {results && (
        <div className="analyze-tool__results">
          <div className="analyze-tool__results-header">
            <span>Results</span>
            <button
              className="analyze-tool__results-close"
              onClick={handleClearResults}
              aria-label="Clear results"
            >
              ×
            </button>
          </div>
          <div className="analyze-tool__results-content">{results}</div>
        </div>
      )}

      {/* Actions */}
      <div className="analyze-tool__actions">
        <button
          className="analyze-tool__btn analyze-tool__btn--primary"
          onClick={handleRunAnalysis}
          disabled={!canAnalyze || status === 'running'}
        >
          {status === 'running' ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>

      {/* Empty state */}
      {!hasContent && (
        <div className="analyze-tool__placeholder">
          <span aria-hidden="true">🔬</span>
          <p>No content in workspace</p>
          <p className="analyze-tool__placeholder-hint">
            Use the archive browser or search to add content to the workspace
          </p>
        </div>
      )}
    </div>
  );
}

export default AnalyzeTool;
