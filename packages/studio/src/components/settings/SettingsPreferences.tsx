/**
 * Settings Preferences Page
 *
 * User preferences for models, transformations, and UI.
 *
 * @module @humanizer/studio/components/settings/SettingsPreferences
 */

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../contexts/ApiContext';
import { useTheme } from '../../contexts/ThemeContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface Preferences {
  modelPreferences: {
    defaultModel?: string;
    temperature?: number;
    maxTokens?: number;
  };
  transformationDefaults: {
    persona?: string;
    style?: string;
  };
  uiPreferences: {
    theme?: 'light' | 'dark' | 'system';
    compactMode?: boolean;
    showTokenCount?: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function SettingsPreferences() {
  const api = useApi();
  const { theme, setTheme } = useTheme();

  // State
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Local form state
  const [defaultModel, setDefaultModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [persona, setPersona] = useState('');
  const [style, setStyle] = useState('');
  const [compactMode, setCompactMode] = useState(false);
  const [showTokenCount, setShowTokenCount] = useState(true);

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.settings.getPreferences();
      setPreferences(result.preferences);

      // Populate form state
      const prefs = result.preferences;
      setDefaultModel(prefs.modelPreferences?.defaultModel ?? '');
      setTemperature(prefs.modelPreferences?.temperature ?? 0.7);
      setMaxTokens(prefs.modelPreferences?.maxTokens ?? 2048);
      setPersona(prefs.transformationDefaults?.persona ?? '');
      setStyle(prefs.transformationDefaults?.style ?? '');
      setCompactMode(prefs.uiPreferences?.compactMode ?? false);
      setShowTokenCount(prefs.uiPreferences?.showTokenCount ?? true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api.settings]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // ─────────────────────────────────────────────────────────────────────────
  // SAVE HANDLER
  // ─────────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await api.settings.updatePreferences({
        modelPreferences: {
          defaultModel: defaultModel || undefined,
          temperature,
          maxTokens,
        },
        transformationDefaults: {
          persona: persona || undefined,
          style: style || undefined,
        },
        uiPreferences: {
          compactMode,
          showTokenCount,
        },
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="settings-section">
        <div className="settings-loading">
          <span className="settings-loading__spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="settings-section">
      <div className="settings-section__header">
        <h2 className="settings-section__title">Preferences</h2>
        <p className="settings-section__description">
          Customize your experience
        </p>
      </div>

      <div className="settings-section__content">
        {error && (
          <div className="settings-alert settings-alert--error">{error}</div>
        )}
        {success && (
          <div className="settings-alert settings-alert--success">
            Preferences saved successfully
          </div>
        )}

        {/* Model Preferences */}
        <div className="settings-card">
          <h3 className="settings-card__title">Model Settings</h3>
          <div className="settings-card__content">
            <div className="settings-form__field">
              <label htmlFor="defaultModel">Default Model</label>
              <select
                id="defaultModel"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
              >
                <option value="">Auto (system default)</option>
                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                <option value="claude-3-haiku">Claude 3 Haiku</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="llama3.2">Llama 3.2 (Local)</option>
              </select>
              <p className="settings-form__hint">
                Model used for transformations when not specified
              </p>
            </div>

            <div className="settings-form__field">
              <label htmlFor="temperature">
                Temperature: {temperature.toFixed(1)}
              </label>
              <input
                id="temperature"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
              />
              <p className="settings-form__hint">
                Lower = more focused, Higher = more creative
              </p>
            </div>

            <div className="settings-form__field">
              <label htmlFor="maxTokens">Max Output Tokens</label>
              <select
                id="maxTokens"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              >
                <option value="512">512 (Short)</option>
                <option value="1024">1024</option>
                <option value="2048">2048 (Default)</option>
                <option value="4096">4096 (Long)</option>
                <option value="8192">8192 (Very Long)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transformation Defaults */}
        <div className="settings-card">
          <h3 className="settings-card__title">Transformation Defaults</h3>
          <div className="settings-card__content">
            <div className="settings-form__field">
              <label htmlFor="persona">Default Persona</label>
              <input
                id="persona"
                type="text"
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                placeholder="e.g., Professional writer"
              />
              <p className="settings-form__hint">
                Writing style persona applied by default
              </p>
            </div>

            <div className="settings-form__field">
              <label htmlFor="style">Default Style</label>
              <select
                id="style"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              >
                <option value="">None</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
                <option value="academic">Academic</option>
                <option value="creative">Creative</option>
                <option value="technical">Technical</option>
              </select>
            </div>
          </div>
        </div>

        {/* UI Preferences */}
        <div className="settings-card">
          <h3 className="settings-card__title">Interface</h3>
          <div className="settings-card__content">
            <div className="settings-form__field">
              <label>Theme</label>
              <div className="settings-radio-group">
                {(['light', 'sepia', 'dark'] as const).map((t) => (
                  <label key={t} className="settings-radio">
                    <input
                      type="radio"
                      name="theme"
                      checked={theme === t}
                      onChange={() => setTheme(t)}
                    />
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            <div className="settings-form__field">
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={compactMode}
                  onChange={(e) => setCompactMode(e.target.checked)}
                />
                Compact Mode
              </label>
              <p className="settings-form__hint">
                Reduce spacing and padding throughout the interface
              </p>
            </div>

            <div className="settings-form__field">
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={showTokenCount}
                  onChange={(e) => setShowTokenCount(e.target.checked)}
                />
                Show Token Counts
              </label>
              <p className="settings-form__hint">
                Display token usage in transformations
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="settings-actions">
          <button
            className="btn btn--primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
