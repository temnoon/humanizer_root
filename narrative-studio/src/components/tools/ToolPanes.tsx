/**
 * ToolPanes - Individual tool pane components
 *
 * Each pane maintains its own state through ToolTabContext.
 * These are used by the new tabbed ToolsPanel.
 *
 * IMPORTANT: Uses transformationService which respects provider preference (local/cloudflare/Ollama)
 */

import { useState, useEffect } from 'react';
import { useToolState, useToolTabs } from '../../contexts/ToolTabContext';
import { useProvider } from '../../contexts/ProviderContext';
import { useUnifiedBuffer } from '../../contexts/UnifiedBufferContext';
import { runTransform, getProviderInfo } from '../../services/transformationService';
import { api } from '../../utils/api';
import { AddToBookSection } from '../panels/AddToBookSection';
import { FeedbackWidget } from './FeedbackWidget';
import { getCustomProfiles, type CustomProfile } from './ProfileFactoryPane';
import { STORAGE_PATHS } from '../../config/storage-paths';

// Compact button styles for narrow panels
const runButtonStyle = {
  width: '100%',
  backgroundImage: 'var(--accent-primary-gradient)',
  backgroundColor: 'transparent',
  color: 'var(--text-inverse)',
  padding: '10px 12px',
  fontSize: '0.875rem',
  minHeight: '40px',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
};

const selectStyle = {
  width: '100%',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-primary)',
  padding: '6px 8px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.8125rem',
};

const labelStyle = {
  display: 'block',
  marginBottom: '4px',
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

// ====================
// Humanizer Pane
// ====================
interface HumanizerPaneProps {
  content: string;
  onApplyTransform?: (text: string) => void;
}

export function HumanizerPane({ content, onApplyTransform }: HumanizerPaneProps) {
  const [state, setState] = useToolState('humanizer');
  const { isTransforming, setIsTransforming } = useToolTabs();
  const { provider, isLocalAvailable, isCloudAvailable, useOllamaForLocal } = useProvider();
  const { recordTransformation, isChainMode } = useUnifiedBuffer();
  const [error, setError] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [transformationId, setTransformationId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleRun = async () => {
    if (!content.trim()) {
      setError('No content to transform');
      return;
    }

    // Check backend availability before starting
    const providerInfo = getProviderInfo();
    if (providerInfo.provider === 'local' && !isLocalAvailable && !useOllamaForLocal) {
      setError(`Local backend (${STORAGE_PATHS.npeApiUrl}) is not available. Start it with: npx wrangler dev --local`);
      return;
    }
    if (providerInfo.provider === 'cloudflare' && !isCloudAvailable) {
      setError('Cloud backend is not available. Check your internet connection.');
      return;
    }

    setIsTransforming(true);
    setError(null);
    setProviderUsed(providerInfo.label);
    setShowFeedback(false);  // Reset feedback on new transform

    try {
      console.log(`[HumanizerPane] Using ${providerInfo.provider} backend: ${providerInfo.label}`);

      // Use transformationService which respects provider preference
      const result = await runTransform({
        type: 'computer-humanizer',
        parameters: {
          intensity: state.intensity,
          useLLM: state.useLLM,
        },
      }, content);

      setState({ lastResult: result });

      // Generate transformation ID for feedback tracking
      const newTransformId = result.metadata?.transformation_id || crypto.randomUUID();
      setTransformationId(newTransformId);
      setShowFeedback(true);

      // Record to buffer for chaining and history
      recordTransformation(
        'humanizer',
        { intensity: state.intensity, useLLM: state.useLLM },
        result.transformed,
        result.metadata
      );

      if (onApplyTransform && result.transformed) {
        onApplyTransform(result.transformed);
      }
    } catch (err) {
      console.error('Humanizer failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Transformation failed';
      setError(`${errorMsg} (using ${providerInfo.label})`);
    } finally {
      setIsTransforming(false);
    }
  };

  return (
    <div style={{ padding: '12px' }}>
      {/* Intensity */}
      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>Intensity</label>
        <select
          value={state.intensity}
          onChange={(e) => setState({ intensity: e.target.value as any })}
          style={selectStyle}
        >
          <option value="light">Light (30%)</option>
          <option value="moderate">Moderate (60%)</option>
          <option value="aggressive">Aggressive (90%)</option>
        </select>
      </div>

      {/* LLM Polish - compact inline */}
      <div style={{ marginBottom: '12px' }}>
        <label
          className="flex items-center gap-2 cursor-pointer"
          style={{ color: 'var(--text-primary)', fontSize: '0.8125rem' }}
        >
          <input
            type="checkbox"
            checked={state.useLLM}
            onChange={(e) => setState({ useLLM: e.target.checked })}
            style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
          />
          <span>LLM Polish Pass</span>
        </label>
      </div>

      {/* Run Button */}
      <button
        onClick={handleRun}
        disabled={isTransforming || !content.trim()}
        style={{
          ...runButtonStyle,
          opacity: isTransforming || !content.trim() ? 0.5 : 1,
          cursor: isTransforming || !content.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {isTransforming ? '⏳ Processing...' : '🤖 Humanize'}
      </button>

      {error && (
        <div
          style={{
            marginTop: '8px',
            padding: '6px 8px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--error)',
            fontSize: '0.6875rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Provider indicator */}
      {providerUsed && !error && state.lastResult && (
        <div
          style={{
            marginTop: '8px',
            padding: '6px 8px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.625rem',
            color: 'var(--text-tertiary)',
          }}
        >
          ✓ Processed via {providerUsed}
        </div>
      )}

      {/* Feedback Widget */}
      {showFeedback && transformationId && !error && (
        <div style={{ marginTop: '8px' }}>
          <FeedbackWidget
            transformationId={transformationId}
            modelUsed={providerUsed || undefined}
            transformationType="humanizer"
            personaOrStyle={state.intensity}
            onDismiss={() => setShowFeedback(false)}
            compact
          />
        </div>
      )}
    </div>
  );
}

// ====================
// Persona Pane
// ====================
interface PersonaPaneProps {
  content: string;
  onApplyTransform?: (text: string) => void;
}

export function PersonaPane({ content, onApplyTransform }: PersonaPaneProps) {
  const [state, setState] = useToolState('persona');
  const { isTransforming, setIsTransforming } = useToolTabs();
  const { provider, isLocalAvailable, isCloudAvailable, useOllamaForLocal } = useProvider();
  const { recordTransformation, isChainMode } = useUnifiedBuffer();
  const [personas, setPersonas] = useState<Array<{ id: number | string; name: string; description: string; isCustom?: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [transformationId, setTransformationId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Fetch personas on mount (API + custom)
  useEffect(() => {
    const fetchPersonas = async () => {
      try {
        // Fetch API personas
        const data = await api.getPersonas();

        // Get custom personas from localStorage
        const customProfiles = getCustomProfiles().filter(p => p.type === 'persona');
        const customPersonas = customProfiles.map(p => ({
          id: `custom_${p.id}`,
          name: p.id,
          description: `Custom: ${p.name}`,
          isCustom: true,
        }));

        // Merge: custom first, then API
        const merged = [...customPersonas, ...data];
        setPersonas(merged);

        if (merged.length > 0 && !state.selectedPersona) {
          setState({ selectedPersona: merged[0].name });
        }
      } catch (err) {
        console.error('Failed to fetch personas:', err);
        // Still show custom profiles even if API fails
        const customProfiles = getCustomProfiles().filter(p => p.type === 'persona');
        const customPersonas = customProfiles.map(p => ({
          id: `custom_${p.id}`,
          name: p.id,
          description: `Custom: ${p.name}`,
          isCustom: true,
        }));
        if (customPersonas.length > 0) {
          setPersonas(customPersonas);
          if (!state.selectedPersona) {
            setState({ selectedPersona: customPersonas[0].name });
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchPersonas();
  }, []);

  const handleRun = async () => {
    if (!content.trim() || !state.selectedPersona) {
      setError('No content or persona selected');
      return;
    }

    // Check backend availability before starting
    const providerInfo = getProviderInfo();
    if (providerInfo.provider === 'local' && !isLocalAvailable && !useOllamaForLocal) {
      setError(`Local backend (${STORAGE_PATHS.npeApiUrl}) is not available. Start it with: npx wrangler dev --local`);
      return;
    }
    if (providerInfo.provider === 'cloudflare' && !isCloudAvailable) {
      setError('Cloud backend is not available. Check your internet connection.');
      return;
    }

    setIsTransforming(true);
    setError(null);
    setProviderUsed(providerInfo.label);
    setShowFeedback(false);  // Reset feedback on new transform

    try {
      console.log(`[PersonaPane] Using ${providerInfo.provider} backend: ${providerInfo.label}`);

      // Use transformationService which respects provider preference
      const result = await runTransform({
        type: 'persona',
        parameters: {
          persona: state.selectedPersona,
        },
      }, content);

      setState({ lastResult: result });

      // Generate transformation ID for feedback tracking
      const newTransformId = result.metadata?.transformation_id || crypto.randomUUID();
      setTransformationId(newTransformId);
      setShowFeedback(true);

      // Record to buffer for chaining and history
      recordTransformation(
        'persona',
        { persona: state.selectedPersona },
        result.transformed,
        result.metadata
      );

      if (onApplyTransform && result.transformed) {
        onApplyTransform(result.transformed);
      }
    } catch (err) {
      console.error('Persona transformation failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Transformation failed';
      setError(`${errorMsg} (using ${providerInfo.label})`);
    } finally {
      setIsTransforming(false);
    }
  };

  return (
    <div style={{ padding: '12px' }}>
      {/* Persona Selection */}
      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>Persona</label>
        {loading ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>Loading...</div>
        ) : (
          <select
            value={state.selectedPersona}
            onChange={(e) => setState({ selectedPersona: e.target.value })}
            style={selectStyle}
          >
            {personas.some(p => p.isCustom) && (
              <optgroup label="Custom Profiles">
                {personas.filter(p => p.isCustom).map((p) => (
                  <option key={p.id} value={p.name}>
                    ★ {p.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </optgroup>
            )}
            {personas.some(p => !p.isCustom) && (
              <optgroup label="Built-in Personas">
                {personas.filter(p => !p.isCustom).map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        )}
      </div>

      {/* Run Button */}
      <button
        onClick={handleRun}
        disabled={isTransforming || !content.trim() || loading}
        style={{
          ...runButtonStyle,
          opacity: isTransforming || !content.trim() || loading ? 0.5 : 1,
          cursor: isTransforming || !content.trim() || loading ? 'not-allowed' : 'pointer',
        }}
      >
        {isTransforming ? '⏳ Transforming...' : '👤 Apply Persona'}
      </button>

      {error && (
        <div style={{ marginTop: '8px', padding: '6px 8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--error)', fontSize: '0.6875rem' }}>
          {error}
        </div>
      )}

      {/* Provider indicator */}
      {providerUsed && !error && state.lastResult && (
        <div
          style={{
            marginTop: '8px',
            padding: '6px 8px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.625rem',
            color: 'var(--text-tertiary)',
          }}
        >
          ✓ Processed via {providerUsed}
        </div>
      )}

      {/* Feedback Widget */}
      {showFeedback && transformationId && !error && (
        <div style={{ marginTop: '8px' }}>
          <FeedbackWidget
            transformationId={transformationId}
            modelUsed={providerUsed || undefined}
            transformationType="persona"
            personaOrStyle={state.selectedPersona}
            onDismiss={() => setShowFeedback(false)}
            compact
          />
        </div>
      )}
    </div>
  );
}

// ====================
// Style Pane
// ====================
interface StylePaneProps {
  content: string;
  onApplyTransform?: (text: string) => void;
}

export function StylePane({ content, onApplyTransform }: StylePaneProps) {
  const [state, setState] = useToolState('style');
  const { isTransforming, setIsTransforming } = useToolTabs();
  const { provider, isLocalAvailable, isCloudAvailable, useOllamaForLocal } = useProvider();
  const { recordTransformation, isChainMode } = useUnifiedBuffer();
  const [styles, setStyles] = useState<Array<{ id: number | string; name: string; style_prompt: string; isCustom?: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [transformationId, setTransformationId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Fetch styles on mount (API + custom)
  useEffect(() => {
    const fetchStyles = async () => {
      try {
        // Fetch API styles
        const data = await api.getStyles();

        // Get custom styles from localStorage
        const customProfiles = getCustomProfiles().filter(p => p.type === 'style');
        const customStyles = customProfiles.map(p => ({
          id: `custom_${p.id}`,
          name: p.id,
          style_prompt: p.prompt,
          isCustom: true,
        }));

        // Merge: custom first, then API
        const merged = [...customStyles, ...data];
        setStyles(merged);

        if (merged.length > 0 && !state.selectedStyle) {
          setState({ selectedStyle: merged[0].name });
        }
      } catch (err) {
        console.error('Failed to fetch styles:', err);
        // Still show custom profiles even if API fails
        const customProfiles = getCustomProfiles().filter(p => p.type === 'style');
        const customStyles = customProfiles.map(p => ({
          id: `custom_${p.id}`,
          name: p.id,
          style_prompt: p.prompt,
          isCustom: true,
        }));
        if (customStyles.length > 0) {
          setStyles(customStyles);
          if (!state.selectedStyle) {
            setState({ selectedStyle: customStyles[0].name });
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStyles();
  }, []);

  const handleRun = async () => {
    if (!content.trim() || !state.selectedStyle) {
      setError('No content or style selected');
      return;
    }

    // Check backend availability before starting
    const providerInfo = getProviderInfo();
    if (providerInfo.provider === 'local' && !isLocalAvailable && !useOllamaForLocal) {
      setError(`Local backend (${STORAGE_PATHS.npeApiUrl}) is not available. Start it with: npx wrangler dev --local`);
      return;
    }
    if (providerInfo.provider === 'cloudflare' && !isCloudAvailable) {
      setError('Cloud backend is not available. Check your internet connection.');
      return;
    }

    setIsTransforming(true);
    setError(null);
    setProviderUsed(providerInfo.label);
    setShowFeedback(false);  // Reset feedback on new transform

    try {
      console.log(`[StylePane] Using ${providerInfo.provider} backend: ${providerInfo.label}`);

      // Use transformationService which respects provider preference
      const result = await runTransform({
        type: 'style',
        parameters: {
          style: state.selectedStyle,
        },
      }, content);

      setState({ lastResult: result });

      // Generate transformation ID for feedback tracking
      const newTransformId = result.metadata?.transformation_id || crypto.randomUUID();
      setTransformationId(newTransformId);
      setShowFeedback(true);

      // Record to buffer for chaining and history
      recordTransformation(
        'style',
        { style: state.selectedStyle },
        result.transformed,
        result.metadata
      );

      if (onApplyTransform && result.transformed) {
        onApplyTransform(result.transformed);
      }
    } catch (err) {
      console.error('Style transformation failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Transformation failed';
      setError(`${errorMsg} (using ${providerInfo.label})`);
    } finally {
      setIsTransforming(false);
    }
  };

  return (
    <div style={{ padding: '12px' }}>
      {/* Style Selection */}
      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>Style</label>
        {loading ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>Loading...</div>
        ) : (
          <select
            value={state.selectedStyle}
            onChange={(e) => setState({ selectedStyle: e.target.value })}
            style={selectStyle}
          >
            {styles.some(s => s.isCustom) && (
              <optgroup label="Custom Profiles">
                {styles.filter(s => s.isCustom).map((s) => (
                  <option key={s.id} value={s.name}>
                    ★ {s.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </optgroup>
            )}
            {styles.some(s => !s.isCustom) && (
              <optgroup label="Built-in Styles">
                {styles.filter(s => !s.isCustom).map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        )}
      </div>

      {/* Run Button */}
      <button
        onClick={handleRun}
        disabled={isTransforming || !content.trim() || loading}
        style={{
          ...runButtonStyle,
          opacity: isTransforming || !content.trim() || loading ? 0.5 : 1,
          cursor: isTransforming || !content.trim() || loading ? 'not-allowed' : 'pointer',
        }}
      >
        {isTransforming ? '⏳ Transforming...' : '✍️ Apply Style'}
      </button>

      {error && (
        <div style={{ marginTop: '8px', padding: '6px 8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--error)', fontSize: '0.6875rem' }}>
          {error}
        </div>
      )}

      {/* Provider indicator */}
      {providerUsed && !error && state.lastResult && (
        <div
          style={{
            marginTop: '8px',
            padding: '6px 8px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.625rem',
            color: 'var(--text-tertiary)',
          }}
        >
          ✓ Processed via {providerUsed}
        </div>
      )}

      {/* Feedback Widget */}
      {showFeedback && transformationId && !error && (
        <div style={{ marginTop: '8px' }}>
          <FeedbackWidget
            transformationId={transformationId}
            modelUsed={providerUsed || undefined}
            transformationType="style"
            personaOrStyle={state.selectedStyle}
            onDismiss={() => setShowFeedback(false)}
            compact
          />
        </div>
      )}
    </div>
  );
}

// ====================
// Round-Trip Pane
// ====================
interface RoundTripPaneProps {
  content: string;
  onApplyTransform?: (text: string) => void;
}

const LANGUAGES = [
  { value: 'spanish', label: 'Spanish' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'italian', label: 'Italian' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'russian', label: 'Russian' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'korean', label: 'Korean' },
  { value: 'arabic', label: 'Arabic' },
  { value: 'hebrew', label: 'Hebrew' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'dutch', label: 'Dutch' },
  { value: 'swedish', label: 'Swedish' },
  { value: 'norwegian', label: 'Norwegian' },
  { value: 'danish', label: 'Danish' },
  { value: 'polish', label: 'Polish' },
  { value: 'czech', label: 'Czech' },
];

export function RoundTripPane({ content, onApplyTransform }: RoundTripPaneProps) {
  const [state, setState] = useToolState('round-trip');
  const { isTransforming, setIsTransforming } = useToolTabs();
  const { provider, isLocalAvailable, isCloudAvailable, useOllamaForLocal } = useProvider();
  const { recordTransformation, isChainMode } = useUnifiedBuffer();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [transformationId, setTransformationId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleRun = async () => {
    if (!content.trim()) {
      setError('No content to translate');
      return;
    }

    if (content.length > 5000) {
      setError('Text too long (max 5,000 characters)');
      return;
    }

    // Check backend availability before starting
    const providerInfo = getProviderInfo();
    if (providerInfo.provider === 'local' && !isLocalAvailable && !useOllamaForLocal) {
      setError(`Local backend (${STORAGE_PATHS.npeApiUrl}) is not available. Start it with: npx wrangler dev --local`);
      return;
    }
    if (providerInfo.provider === 'cloudflare' && !isCloudAvailable) {
      setError('Cloud backend is not available. Check your internet connection.');
      return;
    }

    setIsTransforming(true);
    setError(null);
    setProviderUsed(providerInfo.label);
    setShowFeedback(false);  // Reset feedback on new transform

    try {
      console.log(`[RoundTripPane] Using ${providerInfo.provider} backend: ${providerInfo.label}`);

      // Use transformationService which respects provider preference
      const response = await runTransform({
        type: 'round-trip',
        parameters: {
          intermediateLanguage: state.intermediateLanguage,
        },
      }, content);

      setResult(response.metadata);
      setState({ lastResult: response });

      // Generate transformation ID for feedback tracking
      const newTransformId = response.metadata?.transformation_id || crypto.randomUUID();
      setTransformationId(newTransformId);
      setShowFeedback(true);

      // Record to buffer for chaining and history
      recordTransformation(
        'round-trip',
        { intermediateLanguage: state.intermediateLanguage },
        response.transformed,
        response.metadata
      );

      if (onApplyTransform && response.transformed) {
        onApplyTransform(response.transformed);
      }
    } catch (err) {
      console.error('Round-trip translation failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Translation failed';
      setError(`${errorMsg} (using ${providerInfo.label})`);
    } finally {
      setIsTransforming(false);
    }
  };

  return (
    <div style={{ padding: '12px' }}>
      {/* Language Selection */}
      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>Language</label>
        <select
          value={state.intermediateLanguage}
          onChange={(e) => setState({ intermediateLanguage: e.target.value })}
          style={selectStyle}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* Run Button */}
      <button
        onClick={handleRun}
        disabled={isTransforming || !content.trim()}
        style={{
          ...runButtonStyle,
          opacity: isTransforming || !content.trim() ? 0.5 : 1,
          cursor: isTransforming || !content.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {isTransforming ? '⏳ Translating...' : '🔄 Round-Trip'}
      </button>

      {error && (
        <div style={{ marginTop: '8px', padding: '6px 8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--error)', fontSize: '0.6875rem' }}>
          {error}
        </div>
      )}

      {/* Results - compact */}
      {result && result.semantic_drift !== undefined && (
        <div
          style={{
            marginTop: '12px',
            padding: '8px 10px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Drift</span>
          <span
            style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: result.semantic_drift < 20
                ? 'var(--success)'
                : result.semantic_drift < 50
                ? 'var(--warning)'
                : 'var(--error)',
            }}
          >
            {result.semantic_drift}%
          </span>
        </div>
      )}

      {/* Provider indicator */}
      {providerUsed && !error && state.lastResult && (
        <div
          style={{
            marginTop: '8px',
            padding: '6px 8px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.625rem',
            color: 'var(--text-tertiary)',
          }}
        >
          ✓ Processed via {providerUsed}
        </div>
      )}

      {/* Feedback Widget */}
      {showFeedback && transformationId && !error && (
        <div style={{ marginTop: '8px' }}>
          <FeedbackWidget
            transformationId={transformationId}
            modelUsed={providerUsed || undefined}
            transformationType="round-trip"
            personaOrStyle={state.intermediateLanguage}
            onDismiss={() => setShowFeedback(false)}
            compact
          />
        </div>
      )}
    </div>
  );
}

// ====================
// Add to Book Pane
// ====================
interface AddToBookPaneProps {
  content: string;
}

export function AddToBookPane({ content }: AddToBookPaneProps) {
  return (
    <div style={{ padding: '12px' }}>
      <AddToBookSection content={content} sourceType="archive" />
    </div>
  );
}
