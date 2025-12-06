/** @jsxImportSource react */
/**
 * ParameterInput - Renders appropriate input for parameter type (React version)
 */

import { useState, useEffect } from 'react';
import type { ParameterDefinition, ParameterOption } from '../../types';
import { fetchOptions, type OptionType } from '../../services/npe-api-client';

export interface ParameterInputProps {
  parameter: ParameterDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  error?: string;
}

export function ParameterInput({ parameter, value, onChange, disabled, error }: ParameterInputProps) {
  const [dynamicOptions, setDynamicOptions] = useState<ParameterOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Load dynamic options if optionsFrom is specified
  useEffect(() => {
    if (parameter.optionsFrom) {
      setLoadingOptions(true);
      fetchOptions(parameter.optionsFrom as OptionType)
        .then(opts => setDynamicOptions(opts))
        .catch(err => console.error('Failed to load options:', err))
        .finally(() => setLoadingOptions(false));
    }
  }, [parameter.optionsFrom]);

  const options = parameter.options ?? dynamicOptions;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target;

    if (parameter.type === 'boolean') {
      onChange((target as HTMLInputElement).checked);
    } else if (parameter.type === 'number' || parameter.type === 'slider') {
      onChange(parseFloat(target.value));
    } else if (parameter.type === 'multi-select') {
      const select = target as HTMLSelectElement;
      const selected = Array.from(select.selectedOptions).map(o => o.value);
      onChange(selected);
    } else {
      onChange(target.value);
    }
  };

  const className = error ? 'st-parameter st-parameter--error' : 'st-parameter';

  return (
    <div className={className}>
      <label className="st-parameter__label">
        {parameter.label}
        {parameter.required && <span className="st-parameter__required">*</span>}
      </label>

      {parameter.description && (
        <p className="st-parameter__description">{parameter.description}</p>
      )}

      {/* Text input */}
      {parameter.type === 'text' && (
        <input
          type="text"
          className="st-parameter__input"
          value={(value as string) ?? ''}
          placeholder={parameter.placeholder}
          disabled={disabled}
          onChange={handleChange}
        />
      )}

      {/* Textarea */}
      {parameter.type === 'textarea' && (
        <textarea
          className="st-parameter__textarea"
          value={(value as string) ?? ''}
          placeholder={parameter.placeholder}
          disabled={disabled}
          onChange={handleChange}
          rows={4}
        />
      )}

      {/* Number input */}
      {parameter.type === 'number' && (
        <input
          type="number"
          className="st-parameter__input"
          value={(value as number) ?? parameter.default ?? 0}
          min={parameter.min}
          max={parameter.max}
          step={parameter.step ?? 1}
          disabled={disabled}
          onChange={handleChange}
        />
      )}

      {/* Slider */}
      {parameter.type === 'slider' && (
        <div className="st-parameter__slider-container">
          <input
            type="range"
            className="st-parameter__slider"
            value={(value as number) ?? parameter.default ?? 0}
            min={parameter.min ?? 0}
            max={parameter.max ?? 100}
            step={parameter.step ?? 1}
            disabled={disabled}
            onChange={handleChange}
          />
          <span className="st-parameter__slider-value">
            {String(value ?? parameter.default ?? 0)}
          </span>
        </div>
      )}

      {/* Boolean toggle */}
      {parameter.type === 'boolean' && (
        <label className="st-parameter__toggle">
          <input
            type="checkbox"
            checked={(value as boolean) ?? (parameter.default as boolean) ?? false}
            disabled={disabled}
            onChange={handleChange}
          />
          <span className="st-parameter__toggle-track">
            <span className="st-parameter__toggle-thumb" />
          </span>
        </label>
      )}

      {/* Select dropdown */}
      {(parameter.type === 'select' || parameter.type === 'language') && (
        <select
          className="st-parameter__select"
          value={(value as string) ?? (parameter.default as string) ?? ''}
          disabled={disabled || loadingOptions}
          onChange={handleChange}
        >
          {!parameter.required && <option value="">Select...</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} title={opt.description}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {/* Multi-select */}
      {parameter.type === 'multi-select' && (
        <select
          className="st-parameter__select st-parameter__select--multi"
          multiple
          disabled={disabled || loadingOptions}
          onChange={handleChange}
          value={value as string[] ?? []}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} title={opt.description}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {/* Persona picker */}
      {parameter.type === 'persona' && (
        <>
          <select
            className="st-parameter__select"
            value={(value as string) ?? ''}
            disabled={disabled || loadingOptions}
            onChange={handleChange}
          >
            <option value="">Select persona...</option>
            {dynamicOptions.map((opt) => (
              <option key={opt.value} value={opt.value} title={opt.description}>
                {opt.label}
              </option>
            ))}
          </select>
          {loadingOptions && (
            <span className="st-parameter__loading">Loading personas...</span>
          )}
        </>
      )}

      {/* Style picker */}
      {parameter.type === 'style' && (
        <>
          <select
            className="st-parameter__select"
            value={(value as string) ?? ''}
            disabled={disabled || loadingOptions}
            onChange={handleChange}
          >
            <option value="">Select style...</option>
            {dynamicOptions.map((opt) => (
              <option key={opt.value} value={opt.value} title={opt.description}>
                {opt.label}
              </option>
            ))}
          </select>
          {loadingOptions && (
            <span className="st-parameter__loading">Loading styles...</span>
          )}
        </>
      )}

      {/* Error message */}
      {error && <p className="st-parameter__error">{error}</p>}
    </div>
  );
}
