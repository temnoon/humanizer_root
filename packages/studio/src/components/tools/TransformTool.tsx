/**
 * TransformTool - AI Transformation Interface
 *
 * Provides AI-powered content transformation:
 * - Multiple transformation types (summarize, expand, rewrite, etc.)
 * - Custom prompt support
 * - Preview before applying
 * - Transformation history
 *
 * @module @humanizer/studio/components/tools/TransformTool
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useBufferSync, type ContentItem } from '../../contexts/BufferSyncContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TransformToolProps {
  /** Currently selected content IDs for transformation */
  selectedContentIds?: string[];
  /** Called when transformation is applied */
  onTransformApplied?: (contentId: string, transformedContent: string) => void;
  /** Optional class name */
  className?: string;
}

interface TransformOption {
  id: string;
  label: string;
  icon: string;
  description: string;
  prompt?: string;
}

type TransformStatus = 'idle' | 'previewing' | 'applying' | 'error';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const TRANSFORM_OPTIONS: TransformOption[] = [
  {
    id: 'summarize',
    label: 'Summarize',
    icon: '📝',
    description: 'Create a concise summary of the content',
  },
  {
    id: 'expand',
    label: 'Expand',
    icon: '📖',
    description: 'Add detail and elaboration to the content',
  },
  {
    id: 'rewrite',
    label: 'Rewrite',
    icon: '✏️',
    description: 'Rewrite in a different style or tone',
  },
  {
    id: 'simplify',
    label: 'Simplify',
    icon: '🎯',
    description: 'Make the content easier to understand',
  },
  {
    id: 'formalize',
    label: 'Formalize',
    icon: '👔',
    description: 'Convert to formal, professional language',
  },
  {
    id: 'humanize',
    label: 'Humanize',
    icon: '💫',
    description: 'Make AI-written content sound more natural',
  },
  {
    id: 'extract',
    label: 'Extract Key Points',
    icon: '🔑',
    description: 'Pull out the main ideas and takeaways',
  },
  {
    id: 'custom',
    label: 'Custom Prompt',
    icon: '🎨',
    description: 'Write your own transformation instructions',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function TransformTool({
  selectedContentIds = [],
  onTransformApplied,
  className = '',
}: TransformToolProps): React.ReactElement {
  // Buffer context for reading/writing content
  const { workingContent, setContent, commit } = useBufferSync();

  // State
  const [selectedTransform, setSelectedTransform] = useState<TransformOption | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<TransformStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Check if content is available in buffer
  const hasContent = workingContent.length > 0;
  const contentText = useMemo(
    () => workingContent.map((item) => item.text).join('\n\n'),
    [workingContent]
  );

  // Can run transformation?
  const canTransform = useMemo(() => {
    if (!hasContent) return false;
    if (!selectedTransform) return false;
    if (selectedTransform.id === 'custom' && !customPrompt.trim()) return false;
    return true;
  }, [hasContent, selectedTransform, customPrompt]);

  // Handle transform selection
  const handleSelectTransform = useCallback((option: TransformOption) => {
    setSelectedTransform(option);
    setPreview(null);
    setError(null);
  }, []);

  // Generate preview
  const handlePreview = useCallback(async () => {
    if (!canTransform || !selectedTransform) return;

    setStatus('previewing');
    setError(null);

    try {
      // TODO: Wire to transformation service
      // For now, simulate with placeholder
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Placeholder preview
      const transformType = selectedTransform.id === 'custom' ? customPrompt : selectedTransform.label;
      setPreview(`[Preview: ${transformType} transformation would appear here]`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setStatus('idle');
    }
  }, [canTransform, selectedTransform, customPrompt]);

  // Apply transformation - writes to buffer
  const handleApply = useCallback(async () => {
    if (!canTransform || !selectedTransform || !preview) return;

    setStatus('applying');
    setError(null);

    try {
      // Create transformed content item
      const transformedItem: ContentItem = {
        id: crypto.randomUUID(),
        type: 'transformed',
        text: preview,
        metadata: {
          transformHistory: [{
            type: selectedTransform.id,
            timestamp: Date.now(),
          }],
          wordCount: preview.split(/\s+/).filter(Boolean).length,
        },
      };

      // Write to buffer
      await setContent([transformedItem]);

      // Commit the transformation
      await commit(`Transform: ${selectedTransform.label}`);

      // Notify parent (for backward compatibility)
      for (const contentId of selectedContentIds) {
        onTransformApplied?.(contentId, preview);
      }

      // Reset state
      setPreview(null);
      setSelectedTransform(null);
      setCustomPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apply failed');
    } finally {
      setStatus('idle');
    }
  }, [canTransform, selectedTransform, preview, selectedContentIds, onTransformApplied, setContent, commit]);

  // Cancel preview
  const handleCancel = useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  return (
    <div className={`transform-tool ${className}`}>
      {/* Selection Status - shows buffer content */}
      <div className="transform-tool__selection">
        {hasContent ? (
          <span className="transform-tool__selection-count">
            {workingContent.length} item{workingContent.length !== 1 ? 's' : ''} in workspace
            ({contentText.split(/\s+/).filter(Boolean).length} words)
          </span>
        ) : (
          <span className="transform-tool__selection-empty">
            Select content to transform
          </span>
        )}
      </div>

      {/* Transform Options */}
      <div className="transform-tool__options">
        <div className="transform-tool__options-header">Transformation Type</div>
        <div className="transform-tool__options-grid" role="listbox" aria-label="Transformation options">
          {TRANSFORM_OPTIONS.map((option) => (
            <button
              key={option.id}
              className={`transform-option ${selectedTransform?.id === option.id ? 'transform-option--selected' : ''}`}
              onClick={() => handleSelectTransform(option)}
              disabled={!hasContent}
              role="option"
              aria-selected={selectedTransform?.id === option.id}
            >
              <span className="transform-option__icon" aria-hidden="true">
                {option.icon}
              </span>
              <span className="transform-option__label">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Transform Info */}
      {selectedTransform && (
        <div className="transform-tool__info">
          <p className="transform-tool__description">{selectedTransform.description}</p>
        </div>
      )}

      {/* Custom Prompt Input */}
      {selectedTransform?.id === 'custom' && (
        <div className="transform-tool__custom">
          <label htmlFor="custom-prompt" className="transform-tool__custom-label">
            Custom Instructions
          </label>
          <textarea
            id="custom-prompt"
            className="transform-tool__custom-input"
            placeholder="Describe how you want the content transformed..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={3}
          />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="transform-tool__error" role="alert">
          <span aria-hidden="true">⚠️</span>
          {error}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="transform-tool__preview">
          <div className="transform-tool__preview-header">
            <span>Preview</span>
            <button
              className="transform-tool__preview-close"
              onClick={handleCancel}
              aria-label="Close preview"
            >
              ×
            </button>
          </div>
          <div className="transform-tool__preview-content">{preview}</div>
        </div>
      )}

      {/* Actions */}
      <div className="transform-tool__actions">
        {preview ? (
          <>
            <button
              className="transform-tool__btn transform-tool__btn--secondary"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              className="transform-tool__btn transform-tool__btn--primary"
              onClick={handleApply}
              disabled={status === 'applying'}
            >
              {status === 'applying' ? 'Applying...' : 'Apply'}
            </button>
          </>
        ) : (
          <button
            className="transform-tool__btn transform-tool__btn--primary"
            onClick={handlePreview}
            disabled={!canTransform || status === 'previewing'}
          >
            {status === 'previewing' ? 'Generating...' : 'Preview'}
          </button>
        )}
      </div>

      {/* Placeholder when no content in workspace */}
      {!hasContent && (
        <div className="transform-tool__placeholder">
          <span aria-hidden="true">✨</span>
          <p>No content in workspace</p>
          <p className="transform-tool__placeholder-hint">
            Use the archive browser or search to add content to the workspace
          </p>
        </div>
      )}
    </div>
  );
}

export default TransformTool;
