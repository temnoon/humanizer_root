/**
 * ToolDrawer - Slide-out panel for configuring and executing a tool
 */

import { Component, Show, For, createSignal, createEffect } from 'solid-js';
import type { ToolDefinition, ToolResult } from '../../types';
import { ParameterInput } from './ParameterInput';
import { ResultPreview, ViewMode } from './ResultPreview';

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

export const ToolDrawer: Component<ToolDrawerProps> = (props) => {
  const [viewMode, setViewMode] = createSignal<ViewMode>('result-only');
  const [validationErrors, setValidationErrors] = createSignal<Record<string, string>>({});

  // Reset view mode when tool changes
  createEffect(() => {
    props.tool.id;
    setViewMode('result-only');
    setValidationErrors({});
  });

  const validateAndExecute = () => {
    const errors: Record<string, string> = {};

    // Check required parameters
    for (const param of props.tool.parameters) {
      if (param.required) {
        const value = props.parameters[param.name];
        if (value === undefined || value === null || value === '') {
          errors[param.name] = `${param.label} is required`;
        }
      }
    }

    // Validate input text
    if (props.tool.inputType === 'text' && props.tool.validateInput) {
      const validation = props.tool.validateInput(props.content);
      if (!validation.valid) {
        errors['_input'] = validation.error ?? 'Invalid input';
      }
    }

    setValidationErrors(errors);

    if (Object.keys(errors).length === 0) {
      props.onExecute();
    }
  };

  const canExecute = () => {
    if (props.isExecuting) return false;
    if (props.tool.inputType === 'text' && !props.content.trim()) return false;
    return true;
  };

  return (
    <div class="st-drawer" classList={{ 'st-drawer--open': props.open }}>
      <div class="st-drawer__backdrop" onClick={props.onClose} />

      <div class="st-drawer__panel">
        {/* Header */}
        <div class="st-drawer__header">
          <div class="st-drawer__header-content">
            <span class="st-drawer__icon">{props.tool.icon}</span>
            <div class="st-drawer__title-group">
              <h3 class="st-drawer__title">{props.tool.name}</h3>
              <p class="st-drawer__description">{props.tool.description}</p>
            </div>
          </div>
          <button class="st-drawer__close" onClick={props.onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Input validation error */}
        <Show when={validationErrors()['_input']}>
          <div class="st-drawer__input-error">
            {validationErrors()['_input']}
          </div>
        </Show>

        {/* Content preview (when input is text) */}
        <Show when={props.tool.inputType === 'text' && props.content}>
          <div class="st-drawer__input-preview">
            <div class="st-drawer__input-preview-label">Input text:</div>
            <div class="st-drawer__input-preview-text">
              {props.content.length > 200
                ? props.content.substring(0, 200) + '...'
                : props.content}
            </div>
            <div class="st-drawer__input-preview-length">
              {props.content.length} characters
            </div>
          </div>
        </Show>

        {/* Parameters */}
        <Show when={props.tool.parameters.length > 0}>
          <div class="st-drawer__parameters">
            <For each={props.tool.parameters}>
              {(param) => (
                <ParameterInput
                  parameter={param}
                  value={props.parameters[param.name] ?? param.default}
                  onChange={(value) => props.onParameterChange(param.name, value)}
                  disabled={props.isExecuting}
                  error={validationErrors()[param.name]}
                />
              )}
            </For>
          </div>
        </Show>

        {/* Execute button */}
        <Show when={!props.result}>
          <div class="st-drawer__execute">
            <button
              class="st-drawer__execute-button"
              onClick={validateAndExecute}
              disabled={!canExecute()}
            >
              <Show when={props.isExecuting} fallback={<>Run {props.tool.name}</>}>
                <span class="st-drawer__spinner" />
                Processing...
              </Show>
            </button>
          </div>
        </Show>

        {/* Result preview */}
        <Show when={props.result}>
          <div class="st-drawer__result">
            <ResultPreview
              result={props.result!}
              originalContent={props.content}
              viewMode={viewMode()}
              onViewModeChange={setViewMode}
              onApply={props.onApply}
              onCopy={props.onCopy}
              onChain={props.onChain}
              onDiscard={props.onDiscard}
            />
          </div>
        </Show>

        {/* Long description / help */}
        <Show when={props.tool.longDescription}>
          <details class="st-drawer__help">
            <summary>How it works</summary>
            <p>{props.tool.longDescription}</p>
          </details>
        </Show>
      </div>
    </div>
  );
};
