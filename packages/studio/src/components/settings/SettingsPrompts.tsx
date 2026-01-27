/**
 * Settings Custom Prompts Page (PRO+ Feature)
 *
 * Create and manage custom prompt templates.
 *
 * @module @humanizer/studio/components/settings/SettingsPrompts
 */

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../contexts/ApiContext';
import { useAuth } from '../../contexts/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface CustomPrompt {
  id: string;
  name: string;
  description?: string;
  template: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function SettingsPrompts() {
  const api = useApi();
  const { user } = useAuth();

  // State
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(10);

  // Editor state
  const [editingPrompt, setEditingPrompt] = useState<CustomPrompt | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState('');

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.settings.listCustomPrompts();
      setPrompts(result.prompts);
      setLimit(result.limit);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api.settings]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  const startCreate = () => {
    setIsCreating(true);
    setEditingPrompt(null);
    setName('');
    setDescription('');
    setTemplate('');
  };

  const startEdit = (prompt: CustomPrompt) => {
    setIsCreating(false);
    setEditingPrompt(prompt);
    setName(prompt.name);
    setDescription(prompt.description ?? '');
    setTemplate(prompt.template);
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setEditingPrompt(null);
    setName('');
    setDescription('');
    setTemplate('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (isCreating) {
        await api.settings.createCustomPrompt({ name, description, template });
      } else if (editingPrompt) {
        await api.settings.updateCustomPrompt(editingPrompt.id, {
          name,
          description,
          template,
        });
      }
      cancelEdit();
      fetchPrompts();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (promptId: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) {
      return;
    }
    try {
      await api.settings.deleteCustomPrompt(promptId);
      fetchPrompts();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Extract variables from template (e.g., {{variable}})
  const extractVariables = (tmpl: string): string[] => {
    const matches = tmpl.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.replace(/[{}]/g, '').trim()))];
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

  const canCreate = prompts.length < limit;

  return (
    <div className="settings-section">
      <div className="settings-section__header">
        <div>
          <h2 className="settings-section__title">Custom Prompts</h2>
          <p className="settings-section__description">
            Create reusable prompt templates for transformations
          </p>
        </div>
        {!isCreating && !editingPrompt && (
          <button
            className="btn btn--primary"
            onClick={startCreate}
            disabled={!canCreate}
          >
            Create Prompt
          </button>
        )}
      </div>

      <div className="settings-section__content">
        {error && (
          <div className="settings-alert settings-alert--error">{error}</div>
        )}

        {/* Limit indicator */}
        <div className="settings-quota">
          <span>
            {prompts.length} / {limit} prompts used
          </span>
          {user?.role === 'pro' && (
            <span className="settings-quota__hint">
              Upgrade to Premium for 50 prompts
            </span>
          )}
        </div>

        {/* Editor */}
        {(isCreating || editingPrompt) && (
          <div className="settings-card settings-card--highlighted">
            <h3 className="settings-card__title">
              {isCreating ? 'Create New Prompt' : `Edit: ${editingPrompt?.name}`}
            </h3>
            <form onSubmit={handleSave} className="settings-card__content">
              <div className="settings-form__field">
                <label htmlFor="promptName">Name</label>
                <input
                  id="promptName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Formal Email Rewrite"
                  required
                />
              </div>

              <div className="settings-form__field">
                <label htmlFor="promptDescription">Description (optional)</label>
                <input
                  id="promptDescription"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this prompt do?"
                />
              </div>

              <div className="settings-form__field">
                <label htmlFor="promptTemplate">Template</label>
                <textarea
                  id="promptTemplate"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder="Enter your prompt template. Use {{variable}} for dynamic values."
                  rows={8}
                  required
                />
                <p className="settings-form__hint">
                  Use {'{{variable}}'} syntax for dynamic values. For example:{' '}
                  {'{{text}}'}, {'{{style}}'}, {'{{tone}}'}
                </p>
              </div>

              {template && extractVariables(template).length > 0 && (
                <div className="settings-form__field">
                  <label>Detected Variables</label>
                  <div className="settings-tags">
                    {extractVariables(template).map((v) => (
                      <span key={v} className="settings-tag">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="settings-form__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving || !name || !template}
                >
                  {saving ? 'Saving...' : isCreating ? 'Create Prompt' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Prompts List */}
        {!isCreating && !editingPrompt && (
          <div className="settings-card">
            <h3 className="settings-card__title">Your Prompts</h3>
            <div className="settings-card__content">
              {prompts.length === 0 ? (
                <p className="settings-empty-text">
                  No custom prompts yet. Create one to get started.
                </p>
              ) : (
                <div className="prompts-list">
                  {prompts.map((prompt) => (
                    <div key={prompt.id} className="prompt-item">
                      <div className="prompt-item__header">
                        <div>
                          <h4 className="prompt-item__name">{prompt.name}</h4>
                          {prompt.description && (
                            <p className="prompt-item__description">
                              {prompt.description}
                            </p>
                          )}
                        </div>
                        <div className="prompt-item__actions">
                          <button
                            className="btn btn--ghost btn--sm"
                            onClick={() => startEdit(prompt)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn--danger btn--sm"
                            onClick={() => handleDelete(prompt.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="prompt-item__template">
                        <code>{prompt.template.slice(0, 200)}...</code>
                      </div>
                      {prompt.variables.length > 0 && (
                        <div className="prompt-item__variables">
                          {prompt.variables.map((v) => (
                            <span key={v} className="settings-tag settings-tag--small">
                              {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
