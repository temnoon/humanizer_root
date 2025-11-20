import { useState, useEffect } from 'react';
import type { TransformConfig, TransformationType, TransformParameters } from '../../types';
import { Icons } from '../layout/Icons';
import { api } from '../../utils/api';

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
    value: 'persona',
    label: 'Persona Transformation',
    description: 'Change narrative voice/perspective only',
  },
  {
    value: 'namespace',
    label: 'Namespace Transformation',
    description: 'Change universe/setting only',
  },
  {
    value: 'style',
    label: 'Style Transformation',
    description: 'Change writing patterns only',
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
    useLLM: false,

    // Allegorical defaults (will be updated from API)
    persona: '',
    namespace: '',
    style: '',

    // AI Detection defaults
    threshold: 0.2,
  });

  // Dynamic attribute lists from API
  const [personas, setPersonas] = useState<Array<{ id: number; name: string; description: string }>>([]);
  const [namespaces, setNamespaces] = useState<Array<{ id: number; name: string; description: string }>>([]);
  const [styles, setStyles] = useState<Array<{ id: number; name: string; style_prompt: string }>>([]);
  const [loadingAttributes, setLoadingAttributes] = useState(true);

  // Fetch attributes on mount
  useEffect(() => {
    const fetchAttributes = async () => {
      try {
        const [personasData, namespacesData, stylesData] = await Promise.all([
          api.getPersonas(),
          api.getNamespaces(),
          api.getStyles(),
        ]);

        setPersonas(personasData);
        setNamespaces(namespacesData);
        setStyles(stylesData);

        // Set first item as default if we don't have a selection yet
        if (!parameters.persona && personasData.length > 0) {
          setParameters((prev) => ({
            ...prev,
            persona: personasData[0].name,
            namespace: namespacesData[0]?.name || '',
            style: stylesData[0]?.name || '',
          }));
        }
      } catch (error) {
        console.error('Failed to fetch attributes:', error);
      } finally {
        setLoadingAttributes(false);
      }
    };

    fetchAttributes();
  }, []);

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
                    checked={parameters.useLLM ?? false}
                    onChange={(e) => setParameters({ ...parameters, useLLM: e.target.checked })}
                    className="rounded w-5 h-5"
                    style={{
                      accentColor: 'var(--accent-primary)',
                    }}
                  />
                  Use LLM Polish Pass (optional)
                </label>
                <p className="text-small mt-2" style={{ color: 'var(--text-tertiary)', marginLeft: '32px' }}>
                  Our core pipeline (tell-word removal + burstiness) achieves 0% AI detection on real content.
                  LLM polish may help simple narratives but can hurt technical content.
                  We'll highlight phrases for you to manually polish - your personal touch works best.
                </p>
              </div>
            </div>
          )}

          {/* Persona Parameters */}
          {selectedType === 'persona' && (
            <div className="space-y-5">
              <div>
                <label className="text-small font-medium mb-3 block" style={{ color: 'var(--text-secondary)' }}>
                  Select Persona
                </label>
                {loadingAttributes ? (
                  <div className="text-small" style={{ color: 'var(--text-tertiary)', padding: 'var(--space-md)' }}>
                    Loading personas...
                  </div>
                ) : (
                  <select
                    value={parameters.persona || ''}
                    onChange={(e) => setParameters({ ...parameters, persona: e.target.value })}
                    className="ui-text w-full"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {personas.map((persona) => (
                      <option key={persona.id} value={persona.name}>
                        {persona.description}
                      </option>
                    ))}
                  </select>
                )}
                {!loadingAttributes && personas.length > 0 && (
                  <p className="text-small mt-2" style={{ color: 'var(--text-tertiary)' }}>
                    {personas.length} personas available from Project Gutenberg classics
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Namespace Parameters */}
          {selectedType === 'namespace' && (
            <div className="space-y-5">
              <div>
                <label className="text-small font-medium mb-3 block" style={{ color: 'var(--text-secondary)' }}>
                  Select Namespace
                </label>
                {loadingAttributes ? (
                  <div className="text-small" style={{ color: 'var(--text-tertiary)', padding: 'var(--space-md)' }}>
                    Loading namespaces...
                  </div>
                ) : (
                  <select
                    value={parameters.namespace || ''}
                    onChange={(e) => setParameters({ ...parameters, namespace: e.target.value })}
                    className="ui-text w-full"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {namespaces.map((namespace) => (
                      <option key={namespace.id} value={namespace.name}>
                        {namespace.description}
                      </option>
                    ))}
                  </select>
                )}
                {!loadingAttributes && namespaces.length > 0 && (
                  <p className="text-small mt-2" style={{ color: 'var(--text-tertiary)' }}>
                    {namespaces.length} universes from classic literature
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Style Parameters */}
          {selectedType === 'style' && (
            <div className="space-y-5">
              <div>
                <label className="text-small font-medium mb-3 block" style={{ color: 'var(--text-secondary)' }}>
                  Select Style
                </label>
                {loadingAttributes ? (
                  <div className="text-small" style={{ color: 'var(--text-tertiary)', padding: 'var(--space-md)' }}>
                    Loading styles...
                  </div>
                ) : (
                  <select
                    value={parameters.style || ''}
                    onChange={(e) => setParameters({ ...parameters, style: e.target.value })}
                    className="ui-text w-full"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {styles.map((style) => (
                      <option key={style.id} value={style.name}>
                        {style.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                )}
                {!loadingAttributes && styles.length > 0 && (
                  <p className="text-small mt-2" style={{ color: 'var(--text-tertiary)' }}>
                    {styles.length} writing styles from master authors
                  </p>
                )}
              </div>
            </div>
          )}

          {/* AI Detection Parameters */}
          {selectedType === 'ai-detection' && (
            <div className="space-y-5">
              {/* Detector Type Selection */}
              <div>
                <label className="text-small font-medium mb-3 block" style={{ color: 'var(--text-secondary)' }}>
                  Detector Type
                </label>
                <div className="space-y-3">
                  <button
                    onClick={() => setParameters({ ...parameters, detectorType: 'lite' })}
                    className="card w-full text-left"
                    style={{
                      ...(parameters.detectorType !== 'gptzero'
                        ? {
                            backgroundImage: 'var(--accent-primary-gradient)',
                            backgroundColor: 'transparent',
                          }
                        : {
                            backgroundColor: 'var(--bg-elevated)',
                          }),
                      color:
                        parameters.detectorType !== 'gptzero'
                          ? 'var(--text-inverse)'
                          : 'var(--text-primary)',
                      padding: 'var(--space-md)',
                    }}
                  >
                    <div className="font-medium mb-2" style={{ fontSize: '1rem' }}>
                      Lite Detector (Free)
                    </div>
                    <div className="text-small opacity-90">
                      Heuristic analysis with optional LLM refinement
                    </div>
                  </button>

                  <button
                    onClick={() => setParameters({ ...parameters, detectorType: 'gptzero' })}
                    className="card w-full text-left"
                    style={{
                      ...(parameters.detectorType === 'gptzero'
                        ? {
                            backgroundImage: 'var(--accent-primary-gradient)',
                            backgroundColor: 'transparent',
                          }
                        : {
                            backgroundColor: 'var(--bg-elevated)',
                          }),
                      color:
                        parameters.detectorType === 'gptzero'
                          ? 'var(--text-inverse)'
                          : 'var(--text-primary)',
                      padding: 'var(--space-md)',
                    }}
                  >
                    <div className="font-medium mb-2" style={{ fontSize: '1rem' }}>
                      GPTZero (Pro/Premium)
                    </div>
                    <div className="text-small opacity-90">
                      Professional AI detection with sentence-level analysis
                    </div>
                  </button>
                </div>
              </div>

              {/* Lite Detector Options */}
              {parameters.detectorType !== 'gptzero' && (
                <div>
                  <label className="flex items-center gap-3 text-body cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={parameters.useLLMJudge ?? false}
                      onChange={(e) => setParameters({ ...parameters, useLLMJudge: e.target.checked })}
                      className="rounded w-5 h-5"
                      style={{
                        accentColor: 'var(--accent-primary)',
                      }}
                    />
                    Use LLM Meta-Judge (optional)
                  </label>
                  <p className="text-small mt-2" style={{ color: 'var(--text-tertiary)', marginLeft: '32px' }}>
                    Adds AI refinement to heuristic analysis. Increases processing time by ~1-2 seconds.
                  </p>
                </div>
              )}

              {/* GPTZero Info */}
              {parameters.detectorType === 'gptzero' && (
                <div
                  className="card"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    padding: 'var(--space-md)',
                    borderLeft: '3px solid var(--accent-primary)',
                  }}
                >
                  <div className="text-small" style={{ color: 'var(--text-primary)' }}>
                    <div className="font-medium mb-2">Professional Detection</div>
                    <ul className="space-y-1" style={{ color: 'var(--text-tertiary)' }}>
                      <li>• Sentence-level AI probability</li>
                      <li>• Advanced burstiness analysis</li>
                      <li>• Word quota tracking</li>
                    </ul>
                  </div>
                </div>
              )}
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
