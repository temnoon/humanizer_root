import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cloudAPI } from '../../lib/cloud-api-client';
import type { PersonalPersona, PersonalStyle, PersonalizerTransformResponse } from '../../../../workers/shared/types';
import CopyButtons from '../CopyButtons';

export default function PersonalizerForm() {
  const [text, setText] = useState('');
  const [personaId, setPersonaId] = useState<number | undefined>();
  const [styleId, setStyleId] = useState<number | undefined>();

  const [personas, setPersonas] = useState<PersonalPersona[]>([]);
  const [styles, setStyles] = useState<PersonalStyle[]>([]);
  const [hasNoPersonas, setHasNoPersonas] = useState(false);
  const [totalSamples, setTotalSamples] = useState(0);
  const [totalWords, setTotalWords] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PersonalizerTransformResponse | null>(null);

  // Load personas and styles on mount
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const [personasData, stylesData, samplesData] = await Promise.all([
          cloudAPI.getPersonalPersonas(),
          cloudAPI.getPersonalStyles(),
          cloudAPI.getWritingSamples()
        ]);

        setPersonas(personasData);
        setStyles(stylesData);

        // Calculate total samples and words
        setTotalSamples(samplesData.length);
        const words = samplesData.reduce((sum, s) => sum + s.word_count, 0);
        setTotalWords(words);

        // Set defaults if available
        if (personasData.length > 0) {
          setPersonaId(personasData[0].id);
          setHasNoPersonas(false);
        } else {
          setHasNoPersonas(true);
        }

        if (stylesData.length > 0) {
          setStyleId(stylesData[0].id);
        }
      } catch (err) {
        setError('Failed to load voices. You may need to upload writing samples first.');
      }
    };

    loadVoices();
  }, []);

  const handleDiscoverVoices = async () => {
    setIsDiscovering(true);
    setError(null);

    try {
      const response = await cloudAPI.discoverPersonalVoices();

      // Reload personas and styles
      const [personasData, stylesData] = await Promise.all([
        cloudAPI.getPersonalPersonas(),
        cloudAPI.getPersonalStyles()
      ]);

      setPersonas(personasData);
      setStyles(stylesData);

      // Set defaults
      if (personasData.length > 0) {
        setPersonaId(personasData[0].id);
        setHasNoPersonas(false);
      }
      if (stylesData.length > 0) {
        setStyleId(stylesData[0].id);
      }

      alert(`🎉 Discovery complete!\n\n${response.personas_discovered} voices discovered\n${response.styles_discovered} styles discovered\n${response.total_words_analyzed} words analyzed`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover voices');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const response = await cloudAPI.transformWithPersonalizer(
        text,
        personaId,
        styleId
      );
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transform text');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPersona = personas.find(p => p.id === personaId);
  const selectedStyle = styles.find(s => s.id === styleId);

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h2>🎨 Personalizer</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Transform content through YOUR authentic voice. Upload writing samples, discover your distinct personas
          and styles, then use them to express new content naturally.
        </p>
      </div>

      {/* Voice Stats & Discovery */}
      <div className="card" style={{ marginBottom: 'var(--spacing-lg)', background: 'var(--bg-tertiary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
              Your Voice Library
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{personas.length}</span>{' '}
                <span style={{ color: 'var(--text-tertiary)' }}>voices</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: 'var(--accent-purple)' }}>{styles.length}</span>{' '}
                <span style={{ color: 'var(--text-tertiary)' }}>styles</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: 'var(--accent-yellow)' }}>{totalSamples}</span>{' '}
                <span style={{ color: 'var(--text-tertiary)' }}>samples</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{totalWords.toLocaleString()}</span>{' '}
                <span style={{ color: 'var(--text-tertiary)' }}>words</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleDiscoverVoices}
            disabled={isDiscovering || totalWords < 5000}
            className="btn btn-secondary"
            style={{
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              opacity: (isDiscovering || totalWords < 5000) ? 0.5 : 1
            }}
            title={totalWords < 5000 ? 'Need at least 5,000 words to discover voices' : 'Analyze your writing to discover distinct voices'}
          >
            {isDiscovering ? (
              <>
                <div className="loading"></div>
                <span>Discovering...</span>
              </>
            ) : (
              '🔍 Discover My Voices'
            )}
          </button>
        </div>

        {totalWords < 5000 && (
          <div style={{ marginTop: 'var(--spacing-md)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Need {(5000 - totalWords).toLocaleString()} more words to discover voices. Visit "Manage Voices" to upload samples.
          </div>
        )}
      </div>

      {/* No Personas Warning */}
      {hasNoPersonas && (
        <div className="card" style={{ marginBottom: 'var(--spacing-lg)', background: 'var(--accent-yellow)', color: '#000' }}>
          <h4 style={{ marginTop: 0 }}>👋 Getting Started</h4>
          <p style={{ margin: 0 }}>
            You don't have any discovered voices yet. Upload at least 5,000 words of your writing,
            then click "Discover My Voices" to analyze your distinct personas and styles.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginBottom: 'var(--spacing-2xl)' }}>
        {/* Text Input */}
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <label style={{
            display: 'block',
            marginBottom: 'var(--spacing-sm)',
            fontWeight: 500
          }}>
            Content to Transform
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter the content you want to express through your authentic voice..."
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
            {text.length} / 5,000 characters
          </div>
        </div>

        {/* Voice Selection Grid */}
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
              Voice (Optional)
            </label>
            <select
              value={personaId || ''}
              onChange={(e) => setPersonaId(e.target.value ? parseInt(e.target.value) : undefined)}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)'
              }}
            >
              <option value="">None selected</option>
              {personas.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.auto_discovered && '(discovered)'}
                </option>
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

          {/* Style */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-sm)',
              fontWeight: 500
            }}>
              Style (Optional)
            </label>
            <select
              value={styleId || ''}
              onChange={(e) => setStyleId(e.target.value ? parseInt(e.target.value) : undefined)}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)'
              }}
            >
              <option value="">None selected</option>
              {styles.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.auto_discovered && '(discovered)'}
                </option>
              ))}
            </select>
            {selectedStyle && (
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginTop: 'var(--spacing-xs)'
              }}>
                Formality: {((selectedStyle.formality_score || 0) * 100).toFixed(0)}% •
                Complexity: {((selectedStyle.complexity_score || 0) * 100).toFixed(0)}%
                {selectedStyle.tone_markers && selectedStyle.tone_markers.length > 0 && (
                  <> • {selectedStyle.tone_markers.join(', ')}</>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !text.trim() || (!personaId && !styleId)}
          className="btn btn-primary"
          style={{
            padding: 'var(--spacing-md) var(--spacing-xl)',
            fontSize: '1.125rem',
            opacity: (isLoading || !text.trim() || (!personaId && !styleId)) ? 0.5 : 1,
            cursor: (isLoading || !text.trim() || (!personaId && !styleId)) ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? (
            <>
              <div className="loading"></div>
              <span>Transforming...</span>
            </>
          ) : (
            'Transform Text'
          )}
        </button>

        {!personaId && !styleId && (
          <div style={{
            fontSize: '0.875rem',
            color: 'var(--accent-yellow)',
            marginTop: 'var(--spacing-sm)'
          }}>
            Select at least one voice or style to transform
          </div>
        )}
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

          {/* Transformation Stats */}
          <div className="card" style={{ marginBottom: 'var(--spacing-lg)', background: 'var(--bg-tertiary)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Similarity</div>
                <div style={{ fontWeight: 600, color: 'var(--accent-cyan)', fontSize: 'var(--text-lg)' }}>
                  {(result.semantic_similarity * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Tokens Used</div>
                <div style={{ fontWeight: 600, color: 'var(--accent-purple)', fontSize: 'var(--text-lg)' }}>
                  {result.tokens_used}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Model</div>
                <div style={{ fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                  {result.model_used.replace('@cf/meta/', '')}
                </div>
              </div>
            </div>
          </div>

          {/* Output Text */}
          <div className="card">
            <h4 style={{ color: 'var(--accent-cyan)', marginBottom: 'var(--spacing-sm)' }}>
              Transformed Output
            </h4>
            <div style={{ position: 'relative', maxHeight: '600px', overflowY: 'auto' }}>
              <CopyButtons markdownContent={result.output_text} />
              <div style={{ lineHeight: 1.8, padding: 'var(--spacing-sm)' }} className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result.output_text}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
