import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cloudAPI, type ModelInfo } from '../../lib/cloud-api-client';
import type { NPEPersona, NPENamespace, NPEStyle } from '../../../../workers/shared/types';
import CopyButtons from '../CopyButtons';
import InputCopyButton from '../InputCopyButton';
import SpeechToText from '../SpeechToText';
import TextToSpeech from '../TextToSpeech';
import { useWakeLock } from '../../hooks/useWakeLock';
import { useTransformationState } from '../../contexts/TransformationStateContext';

export default function AllegoricalForm() {
  // Get state from context (persists across navigation)
  const { state, updateAllegorical, reset } = useTransformationState();
  const { text, persona, namespace, style, model, lengthPreference, result } = state.allegorical;

  const [personas, setPersonas] = useState<NPEPersona[]>([]);
  const [namespaces, setNamespaces] = useState<NPENamespace[]>([]);
  const [styles, setStyles] = useState<NPEStyle[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wake Lock: Keep screen awake during transformation (5 min max for battery safety)
  useWakeLock(isLoading, { maxDuration: 5 * 60 * 1000, debug: false });

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const [personasData, namespacesData, stylesData, modelsData] = await Promise.all([
          cloudAPI.getPersonas(),
          cloudAPI.getNamespaces(),
          cloudAPI.getStyles(),
          cloudAPI.getAvailableModels()
        ]);

        setPersonas(personasData);
        setNamespaces(namespacesData);
        setStyles(stylesData);
        setModels(modelsData);

        // Set defaults only if not already set in context
        if (personasData.length > 0 && !persona) {
          updateAllegorical({ persona: personasData[0].name });
        }
        if (namespacesData.length > 0 && !namespace) {
          updateAllegorical({ namespace: namespacesData[0].name });
        }
        if (stylesData.length > 0 && !style) {
          updateAllegorical({ style: stylesData[0].name });
        }
        if (modelsData.length > 0 && !model) {
          updateAllegorical({ model: modelsData[0].id });
        }
      } catch (err) {
        setError('Failed to load configuration');
      }
    };

    loadConfig();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    updateAllegorical({ result: null }); // Clear previous result
    setIsLoading(true);

    try {
      const response = await cloudAPI.createAllegoricalProjection(
        text,
        persona,
        namespace,
        style,
        model,
        lengthPreference
      );
      updateAllegorical({ result: response }); // Save result to context
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create projection');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (text.trim() || result) {
      if (confirm('Clear all content and results for Allegorical Projection?')) {
        reset('allegorical');
        setError(null);
      }
    }
  };

  const selectedPersona = personas.find(p => p.name === persona);
  const selectedNamespace = namespaces.find(n => n.name === namespace);
  const selectedModel = models.find(m => m.id === model);

  return (
    <div>
      <div style={{
        marginBottom: 'var(--spacing-xl)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 'var(--spacing-md)'
      }}>
        <div>
          <h2>🎭 Allegorical Projection</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Transform your narrative through a 5-stage pipeline: deconstruct, map to a fictional universe,
            reconstruct, apply style and persona, then reflect on the transformation.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="btn btn-secondary"
          style={{
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            minHeight: '44px',
            fontSize: 'var(--text-base)',
            whiteSpace: 'nowrap'
          }}
          title="Clear all content and results"
        >
          🔄 Reset
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: 'var(--spacing-2xl)' }}>
        {/* Text Input with Voice */}
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-sm)',
            flexWrap: 'wrap',
            gap: 'var(--spacing-sm)'
          }}>
            <label style={{
              fontWeight: 500
            }}>
              Narrative Text
            </label>
            <InputCopyButton text={text} label="Copy Input" />
          </div>

          <textarea
            value={text}
            onChange={(e) => updateAllegorical({ text: e.target.value })}
            placeholder="Enter your narrative here or use voice input..."
            required
            style={{
              width: '100%',
              minHeight: '200px',
              padding: 'var(--spacing-md)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              resize: 'vertical',
              marginBottom: 'var(--spacing-sm)'
            }}
          />

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            flexWrap: 'wrap'
          }}>
            <div style={{
              fontSize: '0.875rem',
              color: 'var(--text-tertiary)'
            }}>
              {text.length} / 10,000 characters
            </div>

            <SpeechToText
              onTranscript={(transcript) => {
                // Append voice input to existing text
                const newText = text ? `${text} ${transcript}` : transcript;
                updateAllegorical({ text: newText });
              }}
              buttonLabel="🎤 Voice"
            />
          </div>
        </div>

        {/* Configuration Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 'var(--spacing-lg)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          {/* Persona */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-sm)',
              fontWeight: 500
            }}>
              Persona (Narrator Voice)
            </label>
            <select
              value={persona}
              onChange={(e) => updateAllegorical({ persona: e.target.value })}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)'
              }}
            >
              {personas.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
            {selectedPersona && (
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginTop: 'var(--spacing-xs)'
              }}>
                {selectedPersona.description}
              </div>
            )}
          </div>

          {/* Namespace */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-sm)',
              fontWeight: 500
            }}>
              Namespace (Fictional Universe)
            </label>
            <select
              value={namespace}
              onChange={(e) => updateAllegorical({ namespace: e.target.value })}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)'
              }}
            >
              {namespaces.map(n => (
                <option key={n.id} value={n.name}>{n.name}</option>
              ))}
            </select>
            {selectedNamespace && (
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginTop: 'var(--spacing-xs)'
              }}>
                {selectedNamespace.description}
              </div>
            )}
          </div>

          {/* Style */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-sm)',
              fontWeight: 500
            }}>
              Style (Writing Style)
            </label>
            <select
              value={style}
              onChange={(e) => updateAllegorical({ style: e.target.value })}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)'
              }}
            >
              {styles.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Model Selection */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-sm)',
              fontWeight: 500
            }}>
              Model
            </label>
            <select
              value={model}
              onChange={(e) => updateAllegorical({ model: e.target.value })}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)'
              }}
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.requires_api_key && '(API key required)'}
                </option>
              ))}
            </select>
            {selectedModel && (
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginTop: 'var(--spacing-xs)'
              }}>
                {selectedModel.description}
              </div>
            )}
          </div>

          {/* Length Preference */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-sm)',
              fontWeight: 500
            }}>
              Output Length
            </label>
            <select
              value={lengthPreference}
              onChange={(e) => updateAllegorical({ lengthPreference: e.target.value as any })}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)'
              }}
            >
              <option value="shorter">Shorter (50% of input)</option>
              <option value="same">Same length (100%)</option>
              <option value="longer">Longer (200%)</option>
              <option value="much_longer">Much longer (300%)</option>
            </select>
            <div style={{
              fontSize: '0.875rem',
              color: 'var(--text-tertiary)',
              marginTop: 'var(--spacing-xs)'
            }}>
              {lengthPreference === 'shorter' && '50% of input length - concise version'}
              {lengthPreference === 'same' && '100% of input length - similar size'}
              {lengthPreference === 'longer' && '200% of input length - expanded version'}
              {lengthPreference === 'much_longer' && '300% of input length - detailed version'}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !text.trim()}
          className="btn btn-primary"
          style={{
            padding: 'var(--spacing-md) var(--spacing-xl)',
            fontSize: '1.125rem',
              opacity: (isLoading || !text.trim()) ? 0.5 : 1,
            cursor: (isLoading || !text.trim()) ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? (
            <>
              <div className="loading"></div>
              <span>Transforming...</span>
            </>
          ) : (
            'Create Projection'
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="error" style={{ marginBottom: 'var(--spacing-lg)' }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ marginTop: 'var(--spacing-2xl)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Transformation Complete</h3>

          {/* Final Projection */}
          <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-md)',
              gap: 'var(--spacing-md)',
              flexWrap: 'wrap'
            }}>
              <h4 style={{ color: 'var(--accent-cyan)', margin: 0 }}>
                Final Projection
              </h4>
              <TextToSpeech text={result.final_projection} buttonLabel="🔊 Listen" />
            </div>
            <div style={{ position: 'relative', maxHeight: '600px', overflowY: 'auto' }}>
              <CopyButtons markdownContent={result.final_projection} />
              <div style={{ lineHeight: 1.8, padding: 'var(--spacing-sm)' }} className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result.final_projection}
                </ReactMarkdown>
              </div>
            </div>
          </div>

          {/* Transformation Stages */}
          <details open style={{ marginBottom: 'var(--spacing-lg)' }}>
            <summary style={{
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '1.125rem',
              marginBottom: 'var(--spacing-md)',
              color: 'var(--accent-purple)'
            }}>
              Transformation Stages
            </summary>

            <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
              {/* Stage 1: Deconstruct */}
              <div className="card">
                <h5 style={{ color: 'var(--accent-yellow)', marginBottom: 'var(--spacing-sm)' }}>Stage 1: Deconstruct</h5>
                <div style={{ position: 'relative', maxHeight: '400px', overflowY: 'auto' }}>
                  <CopyButtons markdownContent={result.stages.deconstruct} />
                  <div style={{ fontSize: '0.875rem', padding: 'var(--spacing-sm)' }} className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.stages.deconstruct}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>

              {/* Stage 2: Map */}
              <div className="card">
                <h5 style={{ color: 'var(--accent-yellow)', marginBottom: 'var(--spacing-sm)' }}>Stage 2: Map to {namespace}</h5>
                <div style={{ position: 'relative', maxHeight: '400px', overflowY: 'auto' }}>
                  <CopyButtons markdownContent={result.stages.map} />
                  <div style={{ fontSize: '0.875rem', padding: 'var(--spacing-sm)' }} className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.stages.map}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>

              {/* Stage 3: Reconstruct */}
              <div className="card">
                <h5 style={{ color: 'var(--accent-yellow)', marginBottom: 'var(--spacing-sm)' }}>Stage 3: Reconstruct</h5>
                <div style={{ position: 'relative', maxHeight: '400px', overflowY: 'auto' }}>
                  <CopyButtons markdownContent={result.stages.reconstruct} />
                  <div style={{ fontSize: '0.875rem', padding: 'var(--spacing-sm)' }} className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.stages.reconstruct}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>

              {/* Stage 4: Stylize */}
              <div className="card">
                <h5 style={{ color: 'var(--accent-yellow)', marginBottom: 'var(--spacing-sm)' }}>Stage 4: Stylize ({persona} / {style})</h5>
                <div style={{ position: 'relative', maxHeight: '400px', overflowY: 'auto' }}>
                  <CopyButtons markdownContent={result.stages.stylize} />
                  <div style={{ fontSize: '0.875rem', padding: 'var(--spacing-sm)' }} className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.stages.stylize}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          </details>

          {/* Reflection */}
          <div className="card">
            <h4 style={{ color: 'var(--accent-purple)', marginBottom: 'var(--spacing-sm)' }}>
              Reflection on Transformation
            </h4>
            <div style={{ position: 'relative', maxHeight: '500px', overflowY: 'auto' }}>
              <CopyButtons markdownContent={result.reflection} />
              <div style={{ lineHeight: 1.8, fontStyle: 'italic', padding: 'var(--spacing-sm)' }} className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result.reflection}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
