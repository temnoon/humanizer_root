/**
 * ResultPreview - Shows tool execution results with actions
 */

import { Component, Show, For, createSignal } from 'solid-js';
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

export const ResultPreview: Component<ResultPreviewProps> = (props) => {
  const [copied, setCopied] = createSignal(false);
  const viewMode = () => props.viewMode ?? 'result-only';

  const handleCopy = async () => {
    const text = props.result.transformedText ?? props.result.generatedContent ?? '';
    if (text) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      props.onCopy?.();
    }
  };

  const getDuration = () => {
    if (props.result.durationMs) {
      return props.result.durationMs >= 1000
        ? `${(props.result.durationMs / 1000).toFixed(1)}s`
        : `${props.result.durationMs}ms`;
    }
    return null;
  };

  return (
    <div class="st-result-preview" classList={{ 'st-result-preview--error': !props.result.success }}>
      {/* Header */}
      <div class="st-result-preview__header">
        <div class="st-result-preview__status">
          <Show when={props.result.success} fallback={
            <span class="st-result-preview__status-icon st-result-preview__status-icon--error">✗</span>
          }>
            <span class="st-result-preview__status-icon st-result-preview__status-icon--success">✓</span>
          </Show>
          <span class="st-result-preview__status-text">
            {props.result.success ? 'Complete' : 'Failed'}
          </span>
          <Show when={getDuration()}>
            <span class="st-result-preview__duration">{getDuration()}</span>
          </Show>
        </div>

        {/* View mode toggle (for transformations) */}
        <Show when={props.result.transformedText && props.onViewModeChange}>
          <div class="st-result-preview__view-modes">
            <button
              class="st-result-preview__view-mode"
              classList={{ 'st-result-preview__view-mode--active': viewMode() === 'result-only' }}
              onClick={() => props.onViewModeChange?.('result-only')}
            >
              Result
            </button>
            <button
              class="st-result-preview__view-mode"
              classList={{ 'st-result-preview__view-mode--active': viewMode() === 'side-by-side' }}
              onClick={() => props.onViewModeChange?.('side-by-side')}
            >
              Compare
            </button>
          </div>
        </Show>
      </div>

      {/* Error display */}
      <Show when={!props.result.success && props.result.error}>
        <div class="st-result-preview__error">
          <strong>{props.result.error?.code}:</strong> {props.result.error?.message}
        </div>
      </Show>

      {/* Transformation result */}
      <Show when={props.result.success && props.result.transformedText}>
        <div class="st-result-preview__content" classList={{
          'st-result-preview__content--side-by-side': viewMode() === 'side-by-side',
        }}>
          <Show when={viewMode() === 'side-by-side'}>
            <div class="st-result-preview__panel">
              <div class="st-result-preview__panel-header">Original</div>
              <div class="st-result-preview__text">{props.originalContent}</div>
            </div>
          </Show>
          <div class="st-result-preview__panel">
            <Show when={viewMode() === 'side-by-side'}>
              <div class="st-result-preview__panel-header">Result</div>
            </Show>
            <div class="st-result-preview__text">{props.result.transformedText}</div>
          </div>
        </div>
      </Show>

      {/* Analysis result */}
      <Show when={props.result.success && props.result.analysis}>
        <div class="st-result-preview__analysis">
          {/* Verdict */}
          <Show when={props.result.analysis?.verdict}>
            <div class="st-result-preview__verdict">
              <span class="st-result-preview__verdict-label">Verdict:</span>
              <span class="st-result-preview__verdict-value">{props.result.analysis?.verdict}</span>
            </div>
          </Show>

          {/* Confidence */}
          <Show when={props.result.analysis?.confidence !== undefined}>
            <div class="st-result-preview__confidence">
              <span class="st-result-preview__confidence-label">Confidence:</span>
              <div class="st-result-preview__confidence-bar">
                <div
                  class="st-result-preview__confidence-fill"
                  style={{ width: `${(props.result.analysis?.confidence ?? 0) * 100}%` }}
                />
              </div>
              <span class="st-result-preview__confidence-value">
                {Math.round((props.result.analysis?.confidence ?? 0) * 100)}%
              </span>
            </div>
          </Show>

          {/* Scores */}
          <Show when={props.result.analysis?.scores}>
            <div class="st-result-preview__scores">
              <For each={Object.entries(props.result.analysis?.scores ?? {})}>
                {([key, value]) => (
                  <div class="st-result-preview__score">
                    <span class="st-result-preview__score-label">{key}:</span>
                    <span class="st-result-preview__score-value">
                      {typeof value === 'number' ? value.toFixed(2) : value}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      {/* Extracted asset */}
      <Show when={props.result.success && props.result.extractedAsset}>
        <div class="st-result-preview__asset">
          <div class="st-result-preview__asset-icon">
            {props.result.extractedAsset?.type === 'persona' ? '👤' : '✍️'}
          </div>
          <div class="st-result-preview__asset-info">
            <div class="st-result-preview__asset-type">{props.result.extractedAsset?.type}</div>
            <div class="st-result-preview__asset-name">{props.result.extractedAsset?.name}</div>
          </div>
          <Show when={!props.result.extractedAsset?.saved}>
            <button class="st-result-preview__asset-save" onClick={props.onSaveAsset}>
              Save
            </button>
          </Show>
        </div>
      </Show>

      {/* Generated content */}
      <Show when={props.result.success && props.result.generatedContent}>
        <div class="st-result-preview__content">
          <div class="st-result-preview__text">{props.result.generatedContent}</div>
        </div>
      </Show>

      {/* Metadata */}
      <Show when={props.result.tokensUsed || props.result.model}>
        <div class="st-result-preview__meta">
          <Show when={props.result.tokensUsed}>
            <span class="st-result-preview__meta-item">
              {props.result.tokensUsed} tokens
            </span>
          </Show>
          <Show when={props.result.model}>
            <span class="st-result-preview__meta-item">
              {props.result.model}
            </span>
          </Show>
          <Show when={props.result.cached}>
            <span class="st-result-preview__meta-item st-result-preview__meta-item--cached">
              cached
            </span>
          </Show>
        </div>
      </Show>

      {/* AI Disclaimer */}
      <Show when={props.result.success && (props.result.transformedText || props.result.generatedContent)}>
        <div class="st-result-preview__disclaimer">
          AI-generated content may contain errors. Review before use.
        </div>
      </Show>

      {/* Action bar */}
      <Show when={props.result.success}>
        <div class="st-result-preview__actions">
          <Show when={props.result.transformedText || props.result.generatedContent}>
            <button class="st-result-preview__action st-result-preview__action--primary" onClick={props.onApply}>
              Apply
            </button>
            <button class="st-result-preview__action" onClick={handleCopy}>
              {copied() ? 'Copied!' : 'Copy'}
            </button>
          </Show>
          <button class="st-result-preview__action st-result-preview__action--secondary" onClick={props.onDiscard}>
            Discard
          </button>
        </div>
      </Show>
    </div>
  );
};
