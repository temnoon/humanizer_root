/** @jsxImportSource react */
/**
 * ResultPreview - Shows tool execution results with actions (React version)
 */

import { useState } from 'react';
import type { ToolResult } from '../../types';

export type ViewMode = 'side-by-side' | 'unified' | 'result-only';

export interface ResultPreviewProps {
  result: ToolResult;
  originalContent: string;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  onApply?: () => void;
  onCopy?: () => void;
  onChain?: (nextToolId: string) => void;
  onDiscard?: () => void;
  onSaveAsset?: () => void;
  chainableTools?: string[];
}

export function ResultPreview({
  result,
  originalContent,
  viewMode = 'result-only',
  onViewModeChange,
  onApply,
  onCopy,
  onDiscard,
  onSaveAsset,
}: ResultPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = result.transformedText ?? result.generatedContent ?? '';
    if (text) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    }
  };

  const getDuration = () => {
    if (result.durationMs) {
      return result.durationMs >= 1000
        ? `${(result.durationMs / 1000).toFixed(1)}s`
        : `${result.durationMs}ms`;
    }
    return null;
  };

  const className = result.success
    ? 'st-result-preview'
    : 'st-result-preview st-result-preview--error';

  return (
    <div className={className}>
      {/* Header */}
      <div className="st-result-preview__header">
        <div className="st-result-preview__status">
          {result.success ? (
            <span className="st-result-preview__status-icon st-result-preview__status-icon--success">✓</span>
          ) : (
            <span className="st-result-preview__status-icon st-result-preview__status-icon--error">✗</span>
          )}
          <span className="st-result-preview__status-text">
            {result.success ? 'Complete' : 'Failed'}
          </span>
          {getDuration() && (
            <span className="st-result-preview__duration">{getDuration()}</span>
          )}
        </div>

        {/* View mode toggle (for transformations) */}
        {result.transformedText && onViewModeChange && (
          <div className="st-result-preview__view-modes">
            <button
              className={`st-result-preview__view-mode ${viewMode === 'result-only' ? 'st-result-preview__view-mode--active' : ''}`}
              onClick={() => onViewModeChange('result-only')}
            >
              Result
            </button>
            <button
              className={`st-result-preview__view-mode ${viewMode === 'side-by-side' ? 'st-result-preview__view-mode--active' : ''}`}
              onClick={() => onViewModeChange('side-by-side')}
            >
              Compare
            </button>
          </div>
        )}
      </div>

      {/* Error display */}
      {!result.success && result.error && (
        <div className="st-result-preview__error">
          <strong>{result.error.code}:</strong> {result.error.message}
        </div>
      )}

      {/* Transformation result */}
      {result.success && result.transformedText && (
        <div className={`st-result-preview__content ${viewMode === 'side-by-side' ? 'st-result-preview__content--side-by-side' : ''}`}>
          {viewMode === 'side-by-side' && (
            <div className="st-result-preview__panel">
              <div className="st-result-preview__panel-header">Original</div>
              <div className="st-result-preview__text">{originalContent}</div>
            </div>
          )}
          <div className="st-result-preview__panel">
            {viewMode === 'side-by-side' && (
              <div className="st-result-preview__panel-header">Result</div>
            )}
            <div className="st-result-preview__text">{result.transformedText}</div>
          </div>
        </div>
      )}

      {/* Analysis result */}
      {result.success && result.analysis && (
        <div className="st-result-preview__analysis">
          {/* Verdict */}
          {result.analysis.verdict && (
            <div className="st-result-preview__verdict">
              <span className="st-result-preview__verdict-label">Verdict:</span>
              <span className="st-result-preview__verdict-value">{result.analysis.verdict}</span>
            </div>
          )}

          {/* Confidence */}
          {result.analysis.confidence !== undefined && (
            <div className="st-result-preview__confidence">
              <span className="st-result-preview__confidence-label">Confidence:</span>
              <div className="st-result-preview__confidence-bar">
                <div
                  className="st-result-preview__confidence-fill"
                  style={{ width: `${(result.analysis.confidence ?? 0) * 100}%` }}
                />
              </div>
              <span className="st-result-preview__confidence-value">
                {Math.round((result.analysis.confidence ?? 0) * 100)}%
              </span>
            </div>
          )}

          {/* Scores */}
          {result.analysis.scores && (
            <div className="st-result-preview__scores">
              {Object.entries(result.analysis.scores).map(([key, value]) => (
                <div key={key} className="st-result-preview__score">
                  <span className="st-result-preview__score-label">{key}:</span>
                  <span className="st-result-preview__score-value">
                    {typeof value === 'number' ? value.toFixed(2) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Extracted asset */}
      {result.success && result.extractedAsset && (
        <div className="st-result-preview__asset">
          <div className="st-result-preview__asset-icon">
            {result.extractedAsset.type === 'persona' ? '👤' : '✍️'}
          </div>
          <div className="st-result-preview__asset-info">
            <div className="st-result-preview__asset-type">{result.extractedAsset.type}</div>
            <div className="st-result-preview__asset-name">{result.extractedAsset.name}</div>
          </div>
          {!result.extractedAsset.saved && (
            <button className="st-result-preview__asset-save" onClick={onSaveAsset}>
              Save
            </button>
          )}
        </div>
      )}

      {/* Generated content */}
      {result.success && result.generatedContent && (
        <div className="st-result-preview__content">
          <div className="st-result-preview__text">{result.generatedContent}</div>
        </div>
      )}

      {/* Metadata */}
      {(result.tokensUsed || result.model) && (
        <div className="st-result-preview__meta">
          {result.tokensUsed && (
            <span className="st-result-preview__meta-item">
              {result.tokensUsed} tokens
            </span>
          )}
          {result.model && (
            <span className="st-result-preview__meta-item">
              {result.model}
            </span>
          )}
          {result.cached && (
            <span className="st-result-preview__meta-item st-result-preview__meta-item--cached">
              cached
            </span>
          )}
        </div>
      )}

      {/* AI Disclaimer */}
      {result.success && (result.transformedText || result.generatedContent) && (
        <div className="st-result-preview__disclaimer">
          AI-generated content may contain errors. Review before use.
        </div>
      )}

      {/* Action bar */}
      {result.success && (
        <div className="st-result-preview__actions">
          {(result.transformedText || result.generatedContent) && (
            <>
              <button className="st-result-preview__action st-result-preview__action--primary" onClick={onApply}>
                Apply
              </button>
              <button className="st-result-preview__action" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </>
          )}
          <button className="st-result-preview__action st-result-preview__action--secondary" onClick={onDiscard}>
            Discard
          </button>
        </div>
      )}
    </div>
  );
}
