import { useState } from 'react';
import type { TransformConfig, TransformationType, TransformParameters } from '../../types';
import { Icons } from '../layout/Icons';

interface ToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRunTransform: (config: TransformConfig) => void;
  isTransforming: boolean;
}

const TRANSFORM_TYPES: { value: TransformationType; label: string; description: string }[] = [
  {
    value: 'computer-humanizer',
    label: 'Computer Humanizer',
    description: 'Remove AI tell-words and improve text naturalness',
  },
  {
    value: 'allegorical',
    label: 'Allegorical Transformation',
    description: 'Transform narrative through phenomenological perspective shift',
  },
  {
    value: 'ai-detection',
    label: 'AI Detection',
    description: 'Analyze text for AI-generated patterns',
  },
];

export function ToolsPanel({ isOpen, onClose, onRunTransform, isTransforming }: ToolsPanelProps) {
  const [selectedType, setSelectedType] = useState<TransformationType>('computer-humanizer');
  const [parameters, setParameters] = useState<TransformParameters>({
    // Computer Humanizer defaults
    intensity: 'moderate',
    useLLM: true,

    // Allegorical defaults
    persona: 'holmes_analytical',
    namespace: 'enlightenment_science',
    style: 'austen_precision',

    // AI Detection defaults
    threshold: 0.5,
  });

  const handleRun = () => {
    onRunTransform({
      type: selectedType,
      parameters,
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel - now with panel styles */}
      <aside
        className="fixed top-16 right-0 bottom-0 w-80 md:w-96 z-50 md:relative md:top-0 overflow-hidden panel"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderLeft: '1px solid var(--border-color)',
          borderRadius: 0,
        }}
      >
        {/* Header - generous padding, sticky */}
        <div
          className="panel-header"
          style={{
            padding: 'var(--space-lg)',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="heading-md" style={{ color: 'var(--text-primary)' }}>
              Tools
            </h2>
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-md hover:opacity-70"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-tertiary)',
              }}
            >
              <Icons.Close />
            </button>
          </div>
        </div>

        {/* Scrollable content area - generous padding */}
        <div
          className="overflow-y-auto"
          style={{
            height: 'calc(100% - 80px)',
            padding: 'var(--space-lg)',
          }}
        >
          <div className="space-y-6">
          {/* Transformation Type */}
          <div>
            <label className="text-small font-medium mb-3 block" style={{ color: 'var(--text-secondary)' }}>
              Transformation Type
            </label>
            <div className="space-y-3">
              {TRANSFORM_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  className="card w-full text-left"
                  style={{
                    ...(selectedType === type.value
                      ? {
                          backgroundImage: 'var(--accent-primary-gradient)',
                          backgroundColor: 'transparent',
                        }
                      : {
                          backgroundColor: 'var(--bg-elevated)',
                        }),
                    color:
                      selectedType === type.value
                        ? 'var(--text-inverse)'
                        : 'var(--text-primary)',
                    padding: 'var(--space-md)',
                  }}
                >
                  <div className="font-medium mb-2" style={{ fontSize: '1rem' }}>
                    {type.label}
                  </div>
                  <div className="text-small opacity-90">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Computer Humanizer Parameters */}
          {selectedType === 'computer-humanizer' && (
            <div className="space-y-5">
              <div>
                <label className="text-small font-medium mb-3 block" style={{ color: 'var(--text-secondary)' }}>
                  Intensity
                </label>
                <select
                  value={parameters.intensity || 'moderate'}
                  onChange={(e) =>
                    setParameters({ ...parameters, intensity: e.target.value as 'light' | 'moderate' | 'aggressive' })
                  }
                  className="ui-text w-full"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="light">Light (30%)</option>
                  <option value="moderate">Moderate (60%)</option>
                  <option value="aggressive">Aggressive (90%)</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-3 text-body cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={parameters.useLLM ?? true}
                    onChange={(e) => setParameters({ ...parameters, useLLM: e.target.checked })}
                    className="rounded w-5 h-5"
                    style={{
                      accentColor: 'var(--accent-primary)',
                    }}
                  />
                  Use LLM Polish Pass
                </label>
              </div>
            </div>
          )}

          {/* Allegorical Parameters */}
          {selectedType === 'allegorical' && (
            <div className="space-y-5">
              <div>
                <label className="text-small font-medium mb-3 block" style={{ color: 'var(--text-secondary)' }}>
                  Persona
                </label>
                <select
                  value={parameters.persona || 'holmes_analytical'}
                  onChange={(e) => setParameters({ ...parameters, persona: e.target.value })}
                  className="ui-text w-full"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="holmes_analytical">Holmes (Analytical)</option>
                  <option value="austen_observant">Austen (Observant)</option>
                  <option value="darwin_empirical">Darwin (Empirical)</option>
                </select>
              </div>

              <div>
                <label className="text-small font-medium mb-3 block" style={{ color: 'var(--text-secondary)' }}>
                  Namespace
                </label>
                <select
                  value={parameters.namespace || 'enlightenment_science'}
                  onChange={(e) => setParameters({ ...parameters, namespace: e.target.value })}
                  className="ui-text w-full"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="enlightenment_science">Enlightenment Science</option>
                  <option value="victorian_society">Victorian Society</option>
                  <option value="ancient_philosophy">Ancient Philosophy</option>
                </select>
              </div>

              <div>
                <label className="text-small font-medium mb-3 block" style={{ color: 'var(--text-secondary)' }}>
                  Style
                </label>
                <select
                  value={parameters.style || 'austen_precision'}
                  onChange={(e) => setParameters({ ...parameters, style: e.target.value })}
                  className="ui-text w-full"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="austen_precision">Austen Precision</option>
                  <option value="holmes_deduction">Holmes Deduction</option>
                  <option value="darwin_observation">Darwin Observation</option>
                </select>
              </div>
            </div>
          )}

          {/* AI Detection Parameters */}
          {selectedType === 'ai-detection' && (
            <div className="space-y-5">
              <div>
                <label className="text-small font-medium mb-3 block" style={{ color: 'var(--text-secondary)' }}>
                  Detection Threshold
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={parameters.threshold || 0.5}
                  onChange={(e) => setParameters({ ...parameters, threshold: parseFloat(e.target.value) })}
                  className="w-full h-2"
                  style={{
                    accentColor: 'var(--accent-primary)',
                  }}
                />
                <div className="text-small text-center mt-2" style={{ color: 'var(--text-tertiary)' }}>
                  {((parameters.threshold || 0.5) * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          )}

          {/* Run Button */}
          <button
            onClick={handleRun}
            disabled={isTransforming}
            className="w-full font-medium rounded-md flex items-center justify-center gap-2 transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundImage: 'var(--accent-primary-gradient)',
              backgroundColor: 'transparent',
              color: 'var(--text-inverse)',
              padding: 'var(--space-md) var(--space-lg)',
              fontSize: '1rem',
              minHeight: '48px',
            }}
          >
            <Icons.Play />
            {isTransforming ? 'Running...' : 'Run Transformation'}
          </button>
          </div>
        </div>
      </aside>
    </>
  );
}
