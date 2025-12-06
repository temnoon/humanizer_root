/**
 * ParameterInput - Renders appropriate input for parameter type
 */

import { Component, Show, For, createSignal, onMount } from 'solid-js';
import type { ParameterDefinition, ParameterOption } from '../../types';
import { fetchOptions, type OptionType } from '../../services/npe-api-client';

export interface ParameterInputProps {
  parameter: ParameterDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  error?: string;
}

export const ParameterInput: Component<ParameterInputProps> = (props) => {
  const [dynamicOptions, setDynamicOptions] = createSignal<ParameterOption[]>([]);
  const [loadingOptions, setLoadingOptions] = createSignal(false);

  // Load dynamic options if optionsFrom is specified
  onMount(async () => {
    if (props.parameter.optionsFrom) {
      setLoadingOptions(true);
      try {
        const opts = await fetchOptions(props.parameter.optionsFrom as OptionType);
        setDynamicOptions(opts);
      } catch (err) {
        console.error('Failed to load options:', err);
      } finally {
        setLoadingOptions(false);
      }
    }
  });

  const options = () => props.parameter.options ?? dynamicOptions();

  const handleChange = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

    if (props.parameter.type === 'boolean') {
      props.onChange((target as HTMLInputElement).checked);
    } else if (props.parameter.type === 'number' || props.parameter.type === 'slider') {
      props.onChange(parseFloat(target.value));
    } else if (props.parameter.type === 'multi-select') {
      const select = target as HTMLSelectElement;
      const selected = Array.from(select.selectedOptions).map(o => o.value);
      props.onChange(selected);
    } else {
      props.onChange(target.value);
    }
  };

  return (
    <div class="st-parameter" classList={{ 'st-parameter--error': !!props.error }}>
      <label class="st-parameter__label">
        {props.parameter.label}
        <Show when={props.parameter.required}>
          <span class="st-parameter__required">*</span>
        </Show>
      </label>

      <Show when={props.parameter.description}>
        <p class="st-parameter__description">{props.parameter.description}</p>
      </Show>

      {/* Text input */}
      <Show when={props.parameter.type === 'text'}>
        <input
          type="text"
          class="st-parameter__input"
          value={(props.value as string) ?? ''}
          placeholder={props.parameter.placeholder}
          disabled={props.disabled}
          onInput={handleChange}
        />
      </Show>

      {/* Textarea */}
      <Show when={props.parameter.type === 'textarea'}>
        <textarea
          class="st-parameter__textarea"
          value={(props.value as string) ?? ''}
          placeholder={props.parameter.placeholder}
          disabled={props.disabled}
          onInput={handleChange}
          rows={4}
        />
      </Show>

      {/* Number input */}
      <Show when={props.parameter.type === 'number'}>
        <input
          type="number"
          class="st-parameter__input"
          value={(props.value as number) ?? props.parameter.default ?? 0}
          min={props.parameter.min}
          max={props.parameter.max}
          step={props.parameter.step ?? 1}
          disabled={props.disabled}
          onInput={handleChange}
        />
      </Show>

      {/* Slider */}
      <Show when={props.parameter.type === 'slider'}>
        <div class="st-parameter__slider-container">
          <input
            type="range"
            class="st-parameter__slider"
            value={(props.value as number) ?? props.parameter.default ?? 0}
            min={props.parameter.min ?? 0}
            max={props.parameter.max ?? 100}
            step={props.parameter.step ?? 1}
            disabled={props.disabled}
            onInput={handleChange}
          />
          <span class="st-parameter__slider-value">
            {String(props.value ?? props.parameter.default ?? 0)}
          </span>
        </div>
      </Show>

      {/* Boolean toggle */}
      <Show when={props.parameter.type === 'boolean'}>
        <label class="st-parameter__toggle">
          <input
            type="checkbox"
            checked={(props.value as boolean) ?? (props.parameter.default as boolean) ?? false}
            disabled={props.disabled}
            onChange={handleChange}
          />
          <span class="st-parameter__toggle-track">
            <span class="st-parameter__toggle-thumb" />
          </span>
        </label>
      </Show>

      {/* Select dropdown */}
      <Show when={props.parameter.type === 'select' || props.parameter.type === 'language'}>
        <select
          class="st-parameter__select"
          value={(props.value as string) ?? (props.parameter.default as string) ?? ''}
          disabled={props.disabled || loadingOptions()}
          onChange={handleChange}
        >
          <Show when={!props.parameter.required}>
            <option value="">Select...</option>
          </Show>
          <For each={options()}>
            {(opt) => (
              <option value={opt.value} title={opt.description}>
                {opt.label}
              </option>
            )}
          </For>
        </select>
      </Show>

      {/* Multi-select */}
      <Show when={props.parameter.type === 'multi-select'}>
        <select
          class="st-parameter__select st-parameter__select--multi"
          multiple
          disabled={props.disabled || loadingOptions()}
          onChange={handleChange}
        >
          <For each={options()}>
            {(opt) => (
              <option
                value={opt.value}
                selected={(props.value as string[] ?? []).includes(opt.value)}
                title={opt.description}
              >
                {opt.label}
              </option>
            )}
          </For>
        </select>
      </Show>

      {/* Persona picker */}
      <Show when={props.parameter.type === 'persona'}>
        <select
          class="st-parameter__select"
          value={(props.value as string) ?? ''}
          disabled={props.disabled || loadingOptions()}
          onChange={handleChange}
        >
          <option value="">Select persona...</option>
          <For each={dynamicOptions()}>
            {(opt) => (
              <option value={opt.value} title={opt.description}>
                {opt.label}
              </option>
            )}
          </For>
        </select>
        <Show when={loadingOptions()}>
          <span class="st-parameter__loading">Loading personas...</span>
        </Show>
      </Show>

      {/* Style picker */}
      <Show when={props.parameter.type === 'style'}>
        <select
          class="st-parameter__select"
          value={(props.value as string) ?? ''}
          disabled={props.disabled || loadingOptions()}
          onChange={handleChange}
        >
          <option value="">Select style...</option>
          <For each={dynamicOptions()}>
            {(opt) => (
              <option value={opt.value} title={opt.description}>
                {opt.label}
              </option>
            )}
          </For>
        </select>
        <Show when={loadingOptions()}>
          <span class="st-parameter__loading">Loading styles...</span>
        </Show>
      </Show>

      {/* Error message */}
      <Show when={props.error}>
        <p class="st-parameter__error">{props.error}</p>
      </Show>
    </div>
  );
};
