/** @jsxImportSource react */
/**
 * ToolDrawer - Slide-out panel for configuring and executing a tool (React version)
 */

import { useState, useEffect } from 'react';
import type { ToolDefinition, ToolResult } from '../../types';
import { ParameterInput } from './ParameterInput';
import { ResultPreview, type ViewMode } from './ResultPreview';

export interface ToolDrawerProps {
  tool: ToolDefinition;
  content: string;
  open: boolean;
  onClose: () => void;

  // Parameter state
  parameters: Record<string, unknown>;
  onParameterChange: (name: string, value: unknown) => void;

  // Execution
  onExecute: () => void;
  isExecuting: boolean;

  // Result
  result: ToolResult | null;

  // Actions
  onApply: () => void;
  onCopy?: () => void;
  onChain?: (nextToolId: string) => void;
  onDiscard: () => void;
}

export function ToolDrawer({
  tool,
  content,
  open,
  onClose,
  parameters,
  onParameterChange,
  onExecute,
  isExecuting,
  result,
  onApply,
  onCopy,
  onChain,
  onDiscard,
}: ToolDrawerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('result-only');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Reset view mode when tool changes
  useEffect(() => {
    setViewMode('result-only');
    setValidationErrors({});
  }, [tool.id]);

  const validateAndExecute = () => {
    const errors: Record<string, string> = {};

    // Check required parameters
    for (const param of tool.parameters) {
      if (param.required) {
        const value = parameters[param.name];
        if (value === undefined || value === null || value === '') {
          errors[param.name] = `${param.label} is required`;
        }
      }
    }

    // Validate input text
    if (tool.inputType === 'text' && tool.validateInput) {
      const validation = tool.validateInput(content);
      if (!validation.valid) {
        errors['_input'] = validation.error ?? 'Invalid input';
      }
    }

    setValidationErrors(errors);

    if (Object.keys(errors).length === 0) {
      onExecute();
    }
  };

  const canExecute = () => {
    if (isExecuting) return false;
    if (tool.inputType === 'text' && !content.trim()) return false;
    return true;
  };

  return (
    <div className={`st-drawer ${open ? 'st-drawer--open' : ''}`}>
      <div className="st-drawer__backdrop" onClick={onClose} />

      <div className="st-drawer__panel">
        {/* Header */}
        <div className="st-drawer__header">
          <div className="st-drawer__header-content">
            <span className="st-drawer__icon">{tool.icon}</span>
            <div className="st-drawer__title-group">
              <h3 className="st-drawer__title">{tool.name}</h3>
              <p className="st-drawer__description">{tool.description}</p>
            </div>
          </div>
          <button className="st-drawer__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Input validation error */}
        {validationErrors['_input'] && (
          <div className="st-drawer__input-error">
            {validationErrors['_input']}
          </div>
        )}

        {/* Content preview (when input is text) */}
        {tool.inputType === 'text' && content && (
          <div className="st-drawer__input-preview">
            <div className="st-drawer__input-preview-label">Input text:</div>
            <div className="st-drawer__input-preview-text">
              {content.length > 200
                ? content.substring(0, 200) + '...'
                : content}
            </div>
            <div className="st-drawer__input-preview-length">
              {content.length} characters
            </div>
          </div>
        )}

        {/* Parameters */}
        {tool.parameters.length > 0 && (
          <div className="st-drawer__parameters">
            {tool.parameters.map((param) => (
              <ParameterInput
                key={param.name}
                parameter={param}
                value={parameters[param.name] ?? param.default}
                onChange={(value) => onParameterChange(param.name, value)}
                disabled={isExecuting}
                error={validationErrors[param.name]}
              />
            ))}
          </div>
        )}

        {/* Execute button */}
        {!result && (
          <div className="st-drawer__execute">
            <button
              className="st-drawer__execute-button"
              onClick={validateAndExecute}
              disabled={!canExecute()}
            >
              {isExecuting ? (
                <>
                  <span className="st-drawer__spinner" />
                  Processing...
                </>
              ) : (
                <>Run {tool.name}</>
              )}
            </button>
          </div>
        )}

        {/* Result preview */}
        {result && (
          <div className="st-drawer__result">
            <ResultPreview
              result={result}
              originalContent={content}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onApply={onApply}
              onCopy={onCopy}
              onChain={onChain}
              onDiscard={onDiscard}
            />
          </div>
        )}

        {/* Long description / help */}
        {tool.longDescription && (
          <details className="st-drawer__help">
            <summary>How it works</summary>
            <p>{tool.longDescription}</p>
          </details>
        )}
      </div>
    </div>
  );
}
