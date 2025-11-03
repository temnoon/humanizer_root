import { useState, useEffect } from 'react';
import { cloudAPI } from '../../lib/cloud-api-client';
import type { NPEPersona, NPENamespace, NPEStyle, AllegoricalProjectionResponse } from '../../../../workers/shared/types';

export default function AllegoricalForm() {
  const [text, setText] = useState('');
  const [persona, setPersona] = useState('');
  const [namespace, setNamespace] = useState('');
  const [style, setStyle] = useState('');

  const [personas, setPersonas] = useState<NPEPersona[]>([]);
  const [namespaces, setNamespaces] = useState<NPENamespace[]>([]);
  const [styles, setStyles] = useState<NPEStyle[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AllegoricalProjectionResponse | null>(null);

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const [personasData, namespacesData, stylesData] = await Promise.all([
          cloudAPI.getPersonas(),
          cloudAPI.getNamespaces(),
          cloudAPI.getStyles()
        ]);

        setPersonas(personasData);
        setNamespaces(namespacesData);
        setStyles(stylesData);

        // Set defaults
        if (personasData.length > 0) setPersona(personasData[0].name);
        if (namespacesData.length > 0) setNamespace(namespacesData[0].name);
        if (stylesData.length > 0) setStyle(stylesData[0].name);
      } catch (err) {
        setError('Failed to load configuration');
      }
    };

    loadConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const response = await cloudAPI.createAllegoricalProjection(text, persona, namespace, style);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create projection');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPersona = personas.find(p => p.name === persona);
  const selectedNamespace = namespaces.find(n => n.name === namespace);

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h2>🎭 Allegorical Projection</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Transform your narrative through a 5-stage pipeline: deconstruct, map to a fictional universe,
          reconstruct, apply style and persona, then reflect on the transformation.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: 'var(--spacing-2xl)' }}>
        {/* Text Input */}
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <label style={{
            display: 'block',
            marginBottom: 'var(--spacing-sm)',
            fontWeight: 500
          }}>
            Narrative Text
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your narrative here..."
            required
            style={{
              width: '100%',
              minHeight: '200px',
              padding: 'var(--spacing-md)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              resize: 'vertical'
            }}
          />
          <div style={{
            fontSize: '0.875rem',
            color: 'var(--text-tertiary)',
            marginTop: 'var(--spacing-xs)'
          }}>
            {text.length} / 10,000 characters
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
              onChange={(e) => setPersona(e.target.value)}
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
              onChange={(e) => setNamespace(e.target.value)}
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
              onChange={(e) => setStyle(e.target.value)}
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
            <h4 style={{ color: 'var(--accent-cyan)', marginBottom: 'var(--spacing-md)' }}>
              Final Projection
            </h4>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {result.final_projection}
            </p>
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
                <h5 style={{ color: 'var(--accent-yellow)' }}>Stage 1: Deconstruct</h5>
                <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                  {result.stages.deconstruct}
                </p>
              </div>

              {/* Stage 2: Map */}
              <div className="card">
                <h5 style={{ color: 'var(--accent-yellow)' }}>Stage 2: Map to {namespace}</h5>
                <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                  {result.stages.map}
                </p>
              </div>

              {/* Stage 3: Reconstruct */}
              <div className="card">
                <h5 style={{ color: 'var(--accent-yellow)' }}>Stage 3: Reconstruct</h5>
                <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                  {result.stages.reconstruct}
                </p>
              </div>

              {/* Stage 4: Stylize */}
              <div className="card">
                <h5 style={{ color: 'var(--accent-yellow)' }}>Stage 4: Stylize ({persona} / {style})</h5>
                <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                  {result.stages.stylize}
                </p>
              </div>
            </div>
          </details>

          {/* Reflection */}
          <div className="card">
            <h4 style={{ color: 'var(--accent-purple)', marginBottom: 'var(--spacing-md)' }}>
              Reflection on Transformation
            </h4>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontStyle: 'italic' }}>
              {result.reflection}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
