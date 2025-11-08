import { useState, useEffect } from 'react';
import { cloudAPI } from '../../lib/cloud-api-client';
import SampleUploadModal from './SampleUploadModal';
import type { PersonalPersona, PersonalStyle, WritingSample } from '../../../../workers/shared/types';

export default function VoiceManager() {
  const [personas, setPersonas] = useState<PersonalPersona[]>([]);
  const [styles, setStyles] = useState<PersonalStyle[]>([]);
  const [samples, setSamples] = useState<WritingSample[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [personasData, stylesData, samplesData] = await Promise.all([
        cloudAPI.getPersonalPersonas(),
        cloudAPI.getPersonalStyles(),
        cloudAPI.getWritingSamples()
      ]);

      setPersonas(personasData);
      setStyles(stylesData);
      setSamples(samplesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load voice data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteSample = async (sampleId: number) => {
    if (!confirm('Are you sure you want to delete this sample?')) return;

    try {
      await cloudAPI.deleteWritingSample(sampleId);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete sample');
    }
  };

  const handleDeletePersona = async (personaId: number) => {
    if (!confirm('Are you sure you want to delete this voice?')) return;

    try {
      await cloudAPI.deletePersonalPersona(personaId);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete voice');
    }
  };

  const handleDeleteStyle = async (styleId: number) => {
    if (!confirm('Are you sure you want to delete this style?')) return;

    try {
      await cloudAPI.deletePersonalStyle(styleId);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete style');
    }
  };

  const totalWords = samples.reduce((sum, s) => sum + s.word_count, 0);
  const discoveredPersonas = personas.filter(p => p.auto_discovered);
  const customPersonas = personas.filter(p => !p.auto_discovered);
  const discoveredStyles = styles.filter(s => s.auto_discovered);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '300px'
      }}>
        <div className="loading"></div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h2>🎭 Manage Voices</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Upload writing samples, discover your distinct voices, and manage your personal personas and styles.
        </p>
      </div>

      {error && (
        <div className="error" style={{ marginBottom: 'var(--spacing-lg)' }}>
          {error}
        </div>
      )}

      {/* Writing Samples Section */}
      <section style={{ marginBottom: 'var(--spacing-2xl)' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--spacing-lg)',
          flexWrap: 'wrap',
          gap: 'var(--spacing-md)'
        }}>
          <div>
            <h3 style={{ margin: 0, marginBottom: 'var(--spacing-xs)' }}>📝 Writing Samples</h3>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Total: <strong>{samples.length}</strong> samples • <strong>{totalWords.toLocaleString()}</strong> words
              {totalWords < 5000 && (
                <span style={{ color: 'var(--accent-yellow)', marginLeft: 'var(--spacing-sm)' }}>
                  (Need {(5000 - totalWords).toLocaleString()} more words to discover voices)
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="btn btn-primary"
          >
            📤 Upload Sample
          </button>
        </div>

        <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
          {samples.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)', background: 'var(--bg-tertiary)' }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                No writing samples yet. Upload your first sample to get started!
              </p>
            </div>
          ) : (
            samples.map(sample => (
              <div key={sample.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--spacing-xs)' }}>
                      {sample.source_type} • {sample.word_count} words • {new Date(sample.created_at).toLocaleDateString()}
                    </div>
                    <div style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                      maxHeight: '60px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {sample.content.substring(0, 200)}...
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteSample(sample.id)}
                    className="btn btn-secondary"
                    style={{ marginLeft: 'var(--spacing-md)', flexShrink: 0 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Discovered Voices Section */}
      <section style={{ marginBottom: 'var(--spacing-2xl)' }}>
        <h3>🎭 Discovered Voices ({discoveredPersonas.length})</h3>
        <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
          {discoveredPersonas.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)', background: 'var(--bg-tertiary)' }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                No discovered voices yet. Upload at least 5,000 words and run "Discover My Voices" from the Personalizer tab.
              </p>
            </div>
          ) : (
            discoveredPersonas.map(persona => (
              <div key={persona.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, marginBottom: 'var(--spacing-xs)', color: 'var(--accent-cyan)' }}>
                      {persona.name}
                    </h4>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                      {persona.description}
                    </p>
                    {persona.example_texts && persona.example_texts.length > 0 && (
                      <details style={{ marginTop: 'var(--spacing-sm)' }}>
                        <summary style={{ cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                          View {persona.example_texts.length} examples
                        </summary>
                        <div style={{ marginTop: 'var(--spacing-sm)', paddingLeft: 'var(--spacing-md)' }}>
                          {persona.example_texts.map((text, idx) => (
                            <div key={idx} style={{
                              fontSize: 'var(--text-sm)',
                              color: 'var(--text-secondary)',
                              fontStyle: 'italic',
                              marginBottom: 'var(--spacing-sm)',
                              borderLeft: '2px solid var(--border-color)',
                              paddingLeft: 'var(--spacing-sm)'
                            }}>
                              "{text.substring(0, 150)}..."
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeletePersona(persona.id)}
                    className="btn btn-secondary"
                    style={{ marginLeft: 'var(--spacing-md)', flexShrink: 0 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Discovered Styles Section */}
      <section style={{ marginBottom: 'var(--spacing-2xl)' }}>
        <h3>✨ Discovered Styles ({discoveredStyles.length})</h3>
        <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
          {discoveredStyles.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)', background: 'var(--bg-tertiary)' }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                No discovered styles yet. Upload at least 5,000 words and run "Discover My Voices" from the Personalizer tab.
              </p>
            </div>
          ) : (
            discoveredStyles.map(style => (
              <div key={style.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, marginBottom: 'var(--spacing-xs)', color: 'var(--accent-purple)' }}>
                      {style.name}
                    </h4>
                    {style.description && (
                      <p style={{ margin: 0, marginBottom: 'var(--spacing-xs)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                        {style.description}
                      </p>
                    )}
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                      {style.formality_score !== undefined && (
                        <span>Formality: {(style.formality_score * 100).toFixed(0)}%</span>
                      )}
                      {style.complexity_score !== undefined && (
                        <span style={{ marginLeft: 'var(--spacing-md)' }}>
                          Complexity: {(style.complexity_score * 100).toFixed(0)}%
                        </span>
                      )}
                      {style.avg_sentence_length !== undefined && (
                        <span style={{ marginLeft: 'var(--spacing-md)' }}>
                          Avg sentence: {style.avg_sentence_length.toFixed(1)} words
                        </span>
                      )}
                    </div>
                    {style.tone_markers && style.tone_markers.length > 0 && (
                      <div style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                        Tone: {style.tone_markers.join(', ')}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteStyle(style.id)}
                    className="btn btn-secondary"
                    style={{ marginLeft: 'var(--spacing-md)', flexShrink: 0 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Custom Voices Section (future feature) */}
      {customPersonas.length > 0 && (
        <section style={{ marginBottom: 'var(--spacing-2xl)' }}>
          <h3>🎨 Custom Voices ({customPersonas.length})</h3>
          <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
            {customPersonas.map(persona => (
              <div key={persona.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, marginBottom: 'var(--spacing-xs)' }}>
                      {persona.name}
                    </h4>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                      {persona.description || 'Custom voice'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeletePersona(persona.id)}
                    className="btn btn-secondary"
                    style={{ marginLeft: 'var(--spacing-md)', flexShrink: 0 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <SampleUploadModal
          onClose={() => setShowUploadModal(false)}
          onUploadSuccess={loadData}
        />
      )}
    </div>
  );
}
