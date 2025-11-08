import { useState, useEffect } from 'react';
import { cloudAPI } from '../../lib/cloud-api-client';
import type { RoundTripTranslationResponse } from '../../../../workers/shared/types';
import InputCopyButton from '../InputCopyButton';
import { useWakeLock } from '../../hooks/useWakeLock';

export default function RoundTripForm() {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RoundTripTranslationResponse | null>(null);

  // Wake Lock: Keep screen awake during transformation (5 min max for battery safety)
  useWakeLock(isLoading, { maxDuration: 5 * 60 * 1000, debug: false });

  // Load languages on mount
  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const languagesData = await cloudAPI.getLanguages();
        setLanguages(languagesData);
        if (languagesData.length > 0) setLanguage(languagesData[0]);
      } catch (err) {
        setError('Failed to load languages');
      }
    };

    loadLanguages();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const response = await cloudAPI.createRoundTripTranslation(text, language);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create round-trip translation');
    } finally {
      setIsLoading(false);
    }
  };

  const driftPercentage = result ? Math.round(result.semantic_drift * 100) : 0;

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h2>🔄 Round-Trip Translation Analysis</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Translate your text to an intermediate language and back to English, then analyze what changed.
          Discover what meaning is preserved, lost, or gained through the transformation.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: 'var(--spacing-2xl)' }}>
        {/* Text Input */}
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-sm)'
          }}>
            <label style={{
              fontWeight: 500
            }}>
              Text to Translate
            </label>
            <InputCopyButton text={text} label="Copy Input" />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your text here..."
            required
            style={{
              width: '100%',
              minHeight: '150px',
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

        {/* Language Selector */}
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <label style={{
            display: 'block',
            marginBottom: 'var(--spacing-sm)',
            fontWeight: 500
          }}>
            Intermediate Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)'
            }}
          >
            {languages.map(lang => (
              <option key={lang} value={lang}>
                {lang.charAt(0).toUpperCase() + lang.slice(1)}
              </option>
            ))}
          </select>
          <div style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginTop: 'var(--spacing-xs)'
          }}>
            Text will be translated: English → {language.charAt(0).toUpperCase() + language.slice(1)} → English
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
              <span>Analyzing...</span>
            </>
          ) : (
            'Analyze Round-Trip'
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
          <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Analysis Complete</h3>

          {/* Semantic Drift */}
          <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
            <h4 style={{ color: 'var(--accent-cyan)', marginBottom: 'var(--spacing-md)' }}>
              Semantic Drift
            </h4>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-lg)',
              marginBottom: 'var(--spacing-md)'
            }}>
              <div style={{
                flex: 1,
                height: '24px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${driftPercentage}%`,
                  background: driftPercentage < 20 ? 'var(--accent-green)' :
                             driftPercentage < 40 ? 'var(--accent-yellow)' :
                             'var(--accent-red)',
                  transition: 'width 0.5s ease'
                }}></div>
              </div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: driftPercentage < 20 ? 'var(--accent-green)' :
                       driftPercentage < 40 ? 'var(--accent-yellow)' :
                       'var(--accent-red)'
              }}>
                {driftPercentage}%
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {driftPercentage < 20 && 'Excellent preservation - meaning remained highly stable'}
              {driftPercentage >= 20 && driftPercentage < 40 && 'Moderate drift - some nuances changed'}
              {driftPercentage >= 40 && 'Significant drift - meaning shifted considerably'}
            </p>
          </div>

          {/* Translation Results */}
          <div style={{
            display: 'grid',
            gap: 'var(--spacing-lg)',
            marginBottom: 'var(--spacing-lg)'
          }}>
            {/* Forward Translation */}
            <div className="card">
              <h4 style={{ color: 'var(--accent-purple)' }}>
                Forward Translation (English → {language.charAt(0).toUpperCase() + language.slice(1)})
              </h4>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                {result.forward_translation}
              </p>
            </div>

            {/* Backward Translation */}
            <div className="card">
              <h4 style={{ color: 'var(--accent-purple)' }}>
                Backward Translation ({language.charAt(0).toUpperCase() + language.slice(1)} → English)
              </h4>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                {result.backward_translation}
              </p>
            </div>
          </div>

          {/* Element Changes */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-lg)'
          }}>
            {/* Preserved Elements */}
            <div className="card">
              <h5 style={{ color: 'var(--accent-green)', marginBottom: 'var(--spacing-sm)' }}>
                ✓ Preserved Elements
              </h5>
              {result.preserved_elements.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)' }}>
                  {result.preserved_elements.map((elem, i) => (
                    <li key={i} style={{ marginBottom: 'var(--spacing-xs)' }}>{elem}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>None identified</p>
              )}
            </div>

            {/* Lost Elements */}
            <div className="card">
              <h5 style={{ color: 'var(--accent-red)', marginBottom: 'var(--spacing-sm)' }}>
                ✗ Lost Elements
              </h5>
              {result.lost_elements.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)' }}>
                  {result.lost_elements.map((elem, i) => (
                    <li key={i} style={{ marginBottom: 'var(--spacing-xs)' }}>{elem}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>None identified</p>
              )}
            </div>

            {/* Gained Elements */}
            <div className="card">
              <h5 style={{ color: 'var(--accent-yellow)', marginBottom: 'var(--spacing-sm)' }}>
                + Gained Elements
              </h5>
              {result.gained_elements.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)' }}>
                  {result.gained_elements.map((elem, i) => (
                    <li key={i} style={{ marginBottom: 'var(--spacing-xs)' }}>{elem}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>None identified</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
