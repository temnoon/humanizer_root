/**
 * Admin Prompts Page
 *
 * Prompt template management with list, view, and edit capabilities.
 *
 * @module @humanizer/studio/components/admin/AdminPrompts
 */

import { useState, useEffect, useCallback } from 'react';
import { useApi, type AdminPrompt } from '../../contexts/ApiContext';

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AdminPrompts() {
  const api = useApi();

  // State
  const [prompts, setPrompts] = useState<AdminPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Selected prompt for editing
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<AdminPrompt | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [editTemplate, setEditTemplate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.admin.listPrompts();
      setPrompts(result.prompts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  }, [api.admin]);

  const fetchPromptDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const prompt = await api.admin.getPrompt(id);
      setSelectedPrompt(prompt);
      setEditTemplate(prompt.template);
      setEditDescription(prompt.description ?? '');
    } catch (err) {
      console.error('Failed to load prompt detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  }, [api.admin]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  useEffect(() => {
    if (selectedPromptId) {
      fetchPromptDetail(selectedPromptId);
      setEditMode(false);
      setSaveSuccess(false);
      setSaveError(null);
    } else {
      setSelectedPrompt(null);
    }
  }, [selectedPromptId, fetchPromptDetail]);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedPromptId || !selectedPrompt) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await api.admin.updatePrompt(selectedPromptId, {
        template: editTemplate,
        description: editDescription,
        name: selectedPrompt.name,
        usedBy: selectedPrompt.usedBy,
        tags: selectedPrompt.tags,
      });
      setSaveSuccess(true);
      setEditMode(false);
      fetchPromptDetail(selectedPromptId);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (selectedPrompt) {
      setEditTemplate(selectedPrompt.template);
      setEditDescription(selectedPrompt.description ?? '');
    }
    setEditMode(false);
    setSaveError(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  // Filter prompts by search
  const filteredPrompts = prompts.filter((p) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(searchLower) ||
      p.id.toLowerCase().includes(searchLower) ||
      (p.description?.toLowerCase().includes(searchLower) ?? false) ||
      p.usedBy?.some(u => u.toLowerCase().includes(searchLower))
    );
  });

  // Extract variables from template
  const extractVariables = (template: string): string[] => {
    const regex = /\{\{([^}]+)\}\}/g;
    const vars: string[] = [];
    let match;
    while ((match = regex.exec(template)) !== null) {
      const varName = match[1].trim();
      if (!vars.includes(varName)) {
        vars.push(varName);
      }
    }
    return vars;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="admin-prompts">
      {/* Header */}
      <div className="admin-prompts__header">
        <h1 className="admin-prompts__title">Prompt Management</h1>
        <div className="admin-prompts__stats">
          <span className="admin-prompts__stat">{prompts.length} prompts</span>
        </div>
      </div>

      <div className="admin-prompts__layout">
        {/* Prompt List Panel */}
        <div className="admin-prompts__list-panel">
          {/* Search */}
          <div className="admin-prompts__filters">
            <input
              type="text"
              className="admin-form__input"
              placeholder="Search prompts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Prompt List */}
          {loading ? (
            <div className="admin-loading">
              <span className="admin-loading__spinner" />
            </div>
          ) : error ? (
            <div className="admin-alert admin-alert--error">
              <span className="admin-alert__icon">⚠️</span>
              <div className="admin-alert__content">
                <p className="admin-alert__message">{error}</p>
              </div>
            </div>
          ) : filteredPrompts.length === 0 ? (
            <div className="admin-empty">
              <span className="admin-empty__icon">📝</span>
              <h3 className="admin-empty__title">No Prompts Found</h3>
              <p className="admin-empty__description">
                {search ? 'Try a different search term.' : 'No prompts configured.'}
              </p>
            </div>
          ) : (
            <div className="admin-prompts__list">
              {filteredPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  className={`admin-prompts__item ${selectedPromptId === prompt.id ? 'admin-prompts__item--selected' : ''}`}
                  onClick={() => setSelectedPromptId(prompt.id)}
                >
                  <div className="admin-prompts__item-info">
                    <div className="admin-prompts__item-name">{prompt.name}</div>
                    <div className="admin-prompts__item-id">{prompt.id}</div>
                    {prompt.usedBy && prompt.usedBy.length > 0 && (
                      <div className="admin-prompts__item-tags">
                        {prompt.usedBy.slice(0, 3).map((agent) => (
                          <span key={agent} className="admin-badge admin-badge--neutral">
                            {agent}
                          </span>
                        ))}
                        {prompt.usedBy.length > 3 && (
                          <span className="admin-badge admin-badge--neutral">
                            +{prompt.usedBy.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="admin-prompts__item-version">
                    v{prompt.version ?? 1}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Prompt Detail Panel */}
        <div className="admin-prompts__detail-panel">
          {selectedPromptId ? (
            loadingDetail ? (
              <div className="admin-loading">
                <span className="admin-loading__spinner" />
              </div>
            ) : selectedPrompt ? (
              <div className="admin-prompt-detail">
                <div className="admin-prompt-detail__header">
                  <div>
                    <h2 className="admin-prompt-detail__title">{selectedPrompt.name}</h2>
                    <div className="admin-prompt-detail__id">{selectedPrompt.id}</div>
                  </div>
                  <div className="admin-prompt-detail__actions">
                    {editMode ? (
                      <>
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={handleCancelEdit}
                          disabled={saving}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn btn--primary btn--sm"
                          onClick={handleSave}
                          disabled={saving}
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn--secondary btn--sm"
                        onClick={() => setEditMode(true)}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                <div className="admin-prompt-detail__content">
                  {saveSuccess && (
                    <div className="admin-alert admin-alert--success">
                      <span className="admin-alert__icon">✓</span>
                      <div className="admin-alert__content">
                        <p className="admin-alert__message">Prompt saved successfully</p>
                      </div>
                    </div>
                  )}

                  {saveError && (
                    <div className="admin-alert admin-alert--error">
                      <span className="admin-alert__icon">⚠️</span>
                      <div className="admin-alert__content">
                        <p className="admin-alert__message">{saveError}</p>
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="admin-prompt-detail__section">
                    <h3 className="admin-prompt-detail__section-title">Metadata</h3>
                    <div className="admin-prompt-detail__grid">
                      <div className="admin-prompt-detail__field">
                        <span className="admin-prompt-detail__label">Version</span>
                        <span className="admin-prompt-detail__value">{selectedPrompt.version ?? 1}</span>
                      </div>
                      <div className="admin-prompt-detail__field">
                        <span className="admin-prompt-detail__label">Used By</span>
                        <span className="admin-prompt-detail__value">
                          {selectedPrompt.usedBy?.join(', ') || 'None'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="admin-prompt-detail__section">
                    <h3 className="admin-prompt-detail__section-title">Description</h3>
                    {editMode ? (
                      <textarea
                        className="admin-form__input admin-form__input--textarea"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Prompt description..."
                        rows={2}
                      />
                    ) : (
                      <p className="admin-prompt-detail__description">
                        {selectedPrompt.description || 'No description'}
                      </p>
                    )}
                  </div>

                  {/* Variables */}
                  <div className="admin-prompt-detail__section">
                    <h3 className="admin-prompt-detail__section-title">Variables</h3>
                    <div className="admin-prompt-detail__variables">
                      {extractVariables(editMode ? editTemplate : selectedPrompt.template).map((v) => (
                        <span key={v} className="admin-badge admin-badge--info">
                          {`{{${v}}}`}
                        </span>
                      ))}
                      {extractVariables(editMode ? editTemplate : selectedPrompt.template).length === 0 && (
                        <span className="admin-prompt-detail__no-vars">No variables</span>
                      )}
                    </div>
                  </div>

                  {/* Template */}
                  <div className="admin-prompt-detail__section admin-prompt-detail__section--full">
                    <h3 className="admin-prompt-detail__section-title">Template</h3>
                    {editMode ? (
                      <textarea
                        className="admin-form__input admin-prompt-detail__template-input"
                        value={editTemplate}
                        onChange={(e) => setEditTemplate(e.target.value)}
                        placeholder="Prompt template..."
                        rows={15}
                        spellCheck={false}
                      />
                    ) : (
                      <pre className="admin-prompt-detail__template">
                        {selectedPrompt.template}
                      </pre>
                    )}
                  </div>

                  {/* Tags */}
                  {selectedPrompt.tags && selectedPrompt.tags.length > 0 && (
                    <div className="admin-prompt-detail__section">
                      <h3 className="admin-prompt-detail__section-title">Tags</h3>
                      <div className="admin-prompt-detail__tags">
                        {selectedPrompt.tags.map((tag) => (
                          <span key={tag} className="admin-badge admin-badge--neutral">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="admin-empty">
                <span className="admin-empty__icon">❓</span>
                <h3 className="admin-empty__title">Prompt Not Found</h3>
              </div>
            )
          ) : (
            <div className="admin-empty">
              <span className="admin-empty__icon">👈</span>
              <h3 className="admin-empty__title">Select a Prompt</h3>
              <p className="admin-empty__description">
                Choose a prompt from the list to view or edit.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
