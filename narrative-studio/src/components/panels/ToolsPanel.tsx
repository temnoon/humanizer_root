import { useState, useEffect } from 'react';
import type { TransformConfig, TransformationType, TransformParameters } from '../../types';
import { Icons } from '../layout/Icons';
import { api } from '../../utils/api';

interface ToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRunTransform: (config: TransformConfig) => void;
  isTransforming: boolean;
  selectedType: TransformationType;
  setSelectedType: (type: TransformationType) => void;
  parameters: TransformParameters;
  setParameters: (params: TransformParameters) => void;
}

const TRANSFORM_TYPES: { value: TransformationType; label: string; description: string }[] = [
  {
    value: 'computer-humanizer',
    label: 'Computer Humanizer',
    description: 'Remove AI tell-words and improve text naturalness',
  },
  {
    value: 'ai-detection',
    label: 'AI Detection',
    description: 'Analyze text for AI-generated patterns',
  },
  {
    value: 'persona',
    label: 'Persona Transformation',
    description: 'Change narrative voice/perspective only',
  },
  {
    value: 'style',
    label: 'Style Transformation',
    description: 'Change writing patterns only',
  },
  {
    value: 'round-trip',
    label: 'Round-Trip Translation',
    description: 'Translate through intermediate language to analyze semantic drift',
  },
];

export function ToolsPanel({
  isOpen,
  onClose,
  onRunTransform,
  isTransforming,
  selectedType,
  setSelectedType,
  parameters,
  setParameters,
}: ToolsPanelProps) {
  const [transformSource, setTransformSource] = useState<'original' | 'active'>(() => {
    const saved = localStorage.getItem('narrative-studio-transform-source');
    return (saved === 'original' || saved === 'active') ? saved : 'active';
  });

  // Dynamic attribute lists from API
  const [personas, setPersonas] = useState<Array<{ id: number; name: string; description: string }>>([]);
  const [styles, setStyles] = useState<Array<{ id: number; name: string; style_prompt: string }>>([]);
  const [loadingAttributes, setLoadingAttributes] = useState(true);

  // Persist transform source setting
  useEffect(() => {
    localStorage.setItem('narrative-studio-transform-source', transformSource);
    console.log('[ToolsPanel] Transform source:', transformSource);
  }, [transformSource]);

  // Fetch attributes on mount
  useEffect(() => {
    const fetchAttributes = async () => {
      try {
        const [personasData, stylesData] = await Promise.all([
          api.getPersonas(),
          api.getStyles(),
        ]);

        setPersonas(personasData);
        setStyles(stylesData);

        // Set first item as default if we don't have a selection yet
        if (!parameters.persona && personasData.length > 0) {
          setParameters((prev) => ({
            ...prev,
            persona: personasData[0].name,
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
        className="fixed top-16 right-0 bottom-0 w-80 md:w-full md:h-full z-50 md:relative md:top-0 overflow-y-auto panel"
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
              title="Collapse Tools Panel"
              className="p-2 rounded-md hover:opacity-70"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-tertiary)',
                fontSize: '16px',
              }}
            >
              ›
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
          {/* Transform Source */}
          <div>
            <label className="text-small font-medium mb-3 block" style={{ color: 'var(--text-secondary)' }}>
              Transform From
            </label>
            <select
              value={transformSource}
              onChange={(e) => setTransformSource(e.target.value as 'original' | 'active')}
              className="ui-text w-full"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="original">📄 Original - Always use source text</option>
              <option value="active">🔄 Active Buffer - Chain transformations</option>
            </select>
            <p className="text-small mt-2" style={{ color: 'var(--text-tertiary)' }}>
              Choose whether to transform from the original text or chain from current buffer
            </p>
          </div>

          {/* Transformation Type */}
          <div>
            <label className="text-small font-medium mb-3 block" style={{ color: 'var(--text-secondary)' }}>
              Transformation Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as TransformationType)}
              className="ui-text w-full"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              {TRANSFORM_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label} - {type.description}
                </option>
              ))}
            </select>
            <p className="text-small mt-2" style={{ color: 'var(--text-tertiary)' }}>
              {TRANSFORM_TYPES.find(t => t.value === selectedType)?.description || 'Select a transformation type'}
            </p>
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
                        {persona.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - {persona.description}
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

          {/* Round-Trip Translation Parameters */}
          {selectedType === 'round-trip' && (
            <div className="space-y-5">
              <div>
                <label className="text-small font-medium mb-3 block" style={{ color: 'var(--text-secondary)' }}>
                  Intermediate Language
                </label>
                <select
                  value={parameters.intermediateLanguage || 'spanish'}
                  onChange={(e) => setParameters({ ...parameters, intermediateLanguage: e.target.value })}
                  className="ui-text w-full"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="spanish">Spanish</option>
                  <option value="french">French</option>
                  <option value="german">German</option>
                  <option value="italian">Italian</option>
                  <option value="portuguese">Portuguese</option>
                  <option value="russian">Russian</option>
                  <option value="chinese">Chinese</option>
                  <option value="japanese">Japanese</option>
                  <option value="korean">Korean</option>
                  <option value="arabic">Arabic</option>
                  <option value="hebrew">Hebrew</option>
                  <option value="hindi">Hindi</option>
                  <option value="dutch">Dutch</option>
                  <option value="swedish">Swedish</option>
                  <option value="norwegian">Norwegian</option>
                  <option value="danish">Danish</option>
                  <option value="polish">Polish</option>
                  <option value="czech">Czech</option>
                </select>
                <p className="text-small mt-2" style={{ color: 'var(--text-tertiary)' }}>
                  Text will be translated to this language and back to English to analyze semantic drift
                </p>
              </div>

              <div
                className="card"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  padding: 'var(--space-md)',
                  borderLeft: '3px solid var(--accent-primary)',
                }}
              >
                <div className="text-small" style={{ color: 'var(--text-primary)' }}>
                  <div className="font-medium mb-2">Analysis Output</div>
                  <ul className="space-y-1" style={{ color: 'var(--text-tertiary)' }}>
                    <li>• Forward & backward translations</li>
                    <li>• Semantic drift score (0-100%)</li>
                    <li>• Preserved/lost/gained elements</li>
                    <li>• Max 5,000 characters</li>
                  </ul>
                </div>
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
                      Our heuristic algorithm analyzing burstiness, tell-words, and lexical patterns
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
                      Professional GPTZero API - ALWAYS calls external API, reports real results or errors
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
            onClick={() => onRunTransform({ type: selectedType, parameters })}
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
