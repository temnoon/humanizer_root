/**
 * Curator Rules Editor - Admin UI for configuring node curator
 * 
 * Allows node owners to configure:
 * - Publishing rules (approval, word counts, topics)
 * - Comment moderation settings
 * - Curator persona (name, voice, expertise, system prompt)
 */

import { Component, createSignal, createResource, Show, For, onMount } from 'solid-js';
import { authStore } from '@/stores/auth';
import { curatorAgentService, type CuratorRules } from '@/services/curator';

interface CuratorRulesEditorProps {
  nodeId: string;
  nodeName?: string;
  onClose?: () => void;
  onSaved?: (rules: CuratorRules) => void;
}

export const CuratorRulesEditor: Component<CuratorRulesEditorProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<'publishing' | 'comments' | 'persona'>('publishing');
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [saveSuccess, setSaveSuccess] = createSignal(false);
  
  // Form state
  const [rules, setRules] = createSignal<CuratorRules>(getDefaultRules());
  
  // Tag input state
  const [newAcceptedTopic, setNewAcceptedTopic] = createSignal('');
  const [newRejectedTopic, setNewRejectedTopic] = createSignal('');
  const [newExpertise, setNewExpertise] = createSignal('');
  
  // Load existing rules
  const [existingRules] = createResource(
    () => ({ nodeId: props.nodeId, token: authStore.token() }),
    async ({ nodeId, token }) => {
      if (!token) return null;
      try {
        const response = await curatorAgentService.getCuratorRules(nodeId, token);
        return response.rules;
      } catch (err) {
        console.error('Failed to load rules:', err);
        return null;
      }
    }
  );
  
  // Update rules when loaded
  onMount(() => {
    const loaded = existingRules();
    if (loaded) {
      setRules(loaded);
    }
  });
  
  // Merge loaded rules when they arrive
  createResource(
    () => existingRules(),
    (loaded) => {
      if (loaded) {
        setRules(mergeRules(rules(), loaded));
      }
    }
  );
  
  // Update a nested field
  const updateField = <K extends keyof CuratorRules>(
    section: K,
    field: keyof CuratorRules[K],
    value: any
  ) => {
    setRules(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
    setSaveSuccess(false);
  };
  
  // Add to array field
  const addToArray = (section: keyof CuratorRules, field: string, value: string) => {
    if (!value.trim()) return;
    setRules(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: [...((prev[section] as any)[field] || []), value.trim()]
      }
    }));
  };
  
  // Remove from array field
  const removeFromArray = (section: keyof CuratorRules, field: string, index: number) => {
    setRules(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: ((prev[section] as any)[field] || []).filter((_: any, i: number) => i !== index)
      }
    }));
  };
  
  // Save rules
  const handleSave = async () => {
    const token = authStore.token();
    if (!token) {
      setSaveError('Not authenticated');
      return;
    }
    
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    
    try {
      const response = await curatorAgentService.updateCuratorRules(props.nodeId, rules(), token);
      setSaveSuccess(true);
      props.onSaved?.(response.rules);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save rules');
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div class="curator-rules-editor">
      <div class="rules-header">
        <h2>Curator Configuration</h2>
        <p class="rules-subtitle">
          Configure how the AI curator manages {props.nodeName || 'this node'}
        </p>
      </div>
      
      {/* Tab Navigation */}
      <div class="rules-tabs">
        <button
          class={`rules-tab ${activeTab() === 'publishing' ? 'active' : ''}`}
          onClick={() => setActiveTab('publishing')}
        >
          📤 Publishing Rules
        </button>
        <button
          class={`rules-tab ${activeTab() === 'comments' ? 'active' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          💬 Comments
        </button>
        <button
          class={`rules-tab ${activeTab() === 'persona' ? 'active' : ''}`}
          onClick={() => setActiveTab('persona')}
        >
          🤖 Curator Persona
        </button>
      </div>
      
      <div class="rules-content">
        {/* Publishing Rules Tab */}
        <Show when={activeTab() === 'publishing'}>
          <div class="rules-section">
            <h3>Publication Settings</h3>
            
            <div class="rule-row">
              <label class="rule-toggle">
                <input
                  type="checkbox"
                  checked={rules().publishing.requireApproval}
                  onChange={(e) => updateField('publishing', 'requireApproval', e.currentTarget.checked)}
                />
                <span class="toggle-label">Require curator approval for all submissions</span>
              </label>
              <p class="rule-help">When enabled, the AI curator evaluates content before publishing</p>
            </div>
            
            <div class="rule-row">
              <label class="rule-toggle">
                <input
                  type="checkbox"
                  checked={rules().publishing.autoApproveCreator}
                  onChange={(e) => updateField('publishing', 'autoApproveCreator', e.currentTarget.checked)}
                />
                <span class="toggle-label">Auto-approve node creator's submissions</span>
              </label>
              <p class="rule-help">Skip curator review for your own narratives</p>
            </div>
            
            <div class="rule-row">
              <label class="rule-label">Word Count Range</label>
              <div class="range-inputs">
                <input
                  type="number"
                  class="rule-input small"
                  min="0"
                  max="10000"
                  value={rules().publishing.minWordCount}
                  onChange={(e) => updateField('publishing', 'minWordCount', parseInt(e.currentTarget.value) || 0)}
                />
                <span class="range-separator">to</span>
                <input
                  type="number"
                  class="rule-input small"
                  min="100"
                  max="100000"
                  value={rules().publishing.maxWordCount}
                  onChange={(e) => updateField('publishing', 'maxWordCount', parseInt(e.currentTarget.value) || 20000)}
                />
                <span class="range-unit">words</span>
              </div>
            </div>
            
            <div class="rule-row">
              <label class="rule-label">Quality Threshold</label>
              <div class="slider-container">
                <input
                  type="range"
                  class="rule-slider"
                  min="0"
                  max="100"
                  value={Math.round(rules().publishing.qualityThreshold * 100)}
                  onChange={(e) => updateField('publishing', 'qualityThreshold', parseInt(e.currentTarget.value) / 100)}
                />
                <span class="slider-value">{Math.round(rules().publishing.qualityThreshold * 100)}%</span>
              </div>
              <p class="rule-help">Minimum quality score required for approval (0-100%)</p>
            </div>
            
            <div class="rule-row">
              <label class="rule-label">Accepted Topics</label>
              <div class="tag-input-group">
                <div class="tags-list">
                  <For each={rules().publishing.acceptedTopics}>
                    {(topic, index) => (
                      <span class="tag-chip accepted">
                        {topic}
                        <button 
                          class="tag-remove"
                          onClick={() => removeFromArray('publishing', 'acceptedTopics', index())}
                        >×</button>
                      </span>
                    )}
                  </For>
                </div>
                <div class="tag-input-row">
                  <input
                    type="text"
                    class="rule-input"
                    placeholder="Add accepted topic..."
                    value={newAcceptedTopic()}
                    onInput={(e) => setNewAcceptedTopic(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addToArray('publishing', 'acceptedTopics', newAcceptedTopic());
                        setNewAcceptedTopic('');
                      }
                    }}
                  />
                  <button 
                    class="add-tag-btn"
                    onClick={() => {
                      addToArray('publishing', 'acceptedTopics', newAcceptedTopic());
                      setNewAcceptedTopic('');
                    }}
                  >Add</button>
                </div>
              </div>
              <p class="rule-help">Leave empty to accept all topics. Topics here get priority.</p>
            </div>
            
            <div class="rule-row">
              <label class="rule-label">Rejected Topics</label>
              <div class="tag-input-group">
                <div class="tags-list">
                  <For each={rules().publishing.rejectedTopics}>
                    {(topic, index) => (
                      <span class="tag-chip rejected">
                        {topic}
                        <button 
                          class="tag-remove"
                          onClick={() => removeFromArray('publishing', 'rejectedTopics', index())}
                        >×</button>
                      </span>
                    )}
                  </For>
                </div>
                <div class="tag-input-row">
                  <input
                    type="text"
                    class="rule-input"
                    placeholder="Add rejected topic..."
                    value={newRejectedTopic()}
                    onInput={(e) => setNewRejectedTopic(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addToArray('publishing', 'rejectedTopics', newRejectedTopic());
                        setNewRejectedTopic('');
                      }
                    }}
                  />
                  <button 
                    class="add-tag-btn"
                    onClick={() => {
                      addToArray('publishing', 'rejectedTopics', newRejectedTopic());
                      setNewRejectedTopic('');
                    }}
                  >Add</button>
                </div>
              </div>
              <p class="rule-help">Content matching these topics will be rejected</p>
            </div>
          </div>
        </Show>
        
        {/* Comments Tab */}
        <Show when={activeTab() === 'comments'}>
          <div class="rules-section">
            <h3>Comment Moderation</h3>
            
            <div class="rule-row">
              <label class="rule-toggle">
                <input
                  type="checkbox"
                  checked={rules().comments.autoRespond}
                  onChange={(e) => updateField('comments', 'autoRespond', e.currentTarget.checked)}
                />
                <span class="toggle-label">Auto-respond to comments</span>
              </label>
              <p class="rule-help">Curator automatically engages with commenters</p>
            </div>
            
            <div class="rule-row">
              <label class="rule-label">Moderation Style</label>
              <select
                class="rule-select"
                value={rules().comments.moderationLevel}
                onChange={(e) => updateField('comments', 'moderationLevel', e.currentTarget.value)}
              >
                <option value="strict">Strict - High bar for quality and relevance</option>
                <option value="conversational">Conversational - Balanced, welcoming</option>
                <option value="permissive">Permissive - Open to diverse perspectives</option>
              </select>
            </div>
            
            <div class="rule-row">
              <label class="rule-label">Synthesis Threshold</label>
              <div class="range-inputs">
                <input
                  type="number"
                  class="rule-input small"
                  min="1"
                  max="50"
                  value={rules().comments.synthesisThreshold}
                  onChange={(e) => updateField('comments', 'synthesisThreshold', parseInt(e.currentTarget.value) || 3)}
                />
                <span class="range-unit">approved comments before synthesis suggestion</span>
              </div>
              <p class="rule-help">How many approved comments trigger a synthesis task</p>
            </div>
            
            <div class="rule-row">
              <label class="rule-label">Minimum Quality for Synthesis</label>
              <div class="slider-container">
                <input
                  type="range"
                  class="rule-slider"
                  min="0"
                  max="100"
                  value={Math.round(rules().comments.synthesisQualityMin * 100)}
                  onChange={(e) => updateField('comments', 'synthesisQualityMin', parseInt(e.currentTarget.value) / 100)}
                />
                <span class="slider-value">{Math.round(rules().comments.synthesisQualityMin * 100)}%</span>
              </div>
              <p class="rule-help">Comments below this quality won't be included in synthesis</p>
            </div>
          </div>
        </Show>
        
        {/* Persona Tab */}
        <Show when={activeTab() === 'persona'}>
          <div class="rules-section">
            <h3>Curator Personality</h3>
            <p class="section-intro">
              Define how the AI curator presents itself and interacts with contributors.
            </p>
            
            <div class="rule-row">
              <label class="rule-label">Curator Name</label>
              <input
                type="text"
                class="rule-input"
                placeholder="e.g., The Phenomenologist"
                value={rules().persona.name}
                onInput={(e) => updateField('persona', 'name', e.currentTarget.value)}
              />
              <p class="rule-help">How the curator identifies itself in responses</p>
            </div>
            
            <div class="rule-row">
              <label class="rule-label">Voice/Tone</label>
              <input
                type="text"
                class="rule-input"
                placeholder="e.g., scholarly but accessible"
                value={rules().persona.voice}
                onInput={(e) => updateField('persona', 'voice', e.currentTarget.value)}
              />
              <p class="rule-help">Describe the curator's communication style</p>
            </div>
            
            <div class="rule-row">
              <label class="rule-label">Areas of Expertise</label>
              <div class="tag-input-group">
                <div class="tags-list">
                  <For each={rules().persona.expertise}>
                    {(exp, index) => (
                      <span class="tag-chip expertise">
                        {exp}
                        <button 
                          class="tag-remove"
                          onClick={() => removeFromArray('persona', 'expertise', index())}
                        >×</button>
                      </span>
                    )}
                  </For>
                </div>
                <div class="tag-input-row">
                  <input
                    type="text"
                    class="rule-input"
                    placeholder="Add expertise area..."
                    value={newExpertise()}
                    onInput={(e) => setNewExpertise(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addToArray('persona', 'expertise', newExpertise());
                        setNewExpertise('');
                      }
                    }}
                  />
                  <button 
                    class="add-tag-btn"
                    onClick={() => {
                      addToArray('persona', 'expertise', newExpertise());
                      setNewExpertise('');
                    }}
                  >Add</button>
                </div>
              </div>
              <p class="rule-help">Topics the curator is knowledgeable about</p>
            </div>
            
            <div class="rule-row">
              <label class="rule-label">System Prompt (Advanced)</label>
              <textarea
                class="rule-textarea"
                rows={6}
                placeholder="Custom instructions for the AI curator. Leave blank for default behavior based on settings above."
                value={rules().persona.systemPrompt}
                onInput={(e) => updateField('persona', 'systemPrompt', e.currentTarget.value)}
              />
              <p class="rule-help">
                Advanced: Direct instructions to the AI. Overrides voice/expertise if set.
              </p>
            </div>
          </div>
        </Show>
      </div>
      
      {/* Status Messages */}
      <Show when={saveError()}>
        <div class="rules-message error">
          ❌ {saveError()}
        </div>
      </Show>
      
      <Show when={saveSuccess()}>
        <div class="rules-message success">
          ✅ Curator rules saved successfully
        </div>
      </Show>
      
      {/* Footer Actions */}
      <div class="rules-footer">
        <Show when={props.onClose}>
          <button class="rules-btn secondary" onClick={props.onClose}>
            Cancel
          </button>
        </Show>
        <button 
          class="rules-btn primary"
          onClick={handleSave}
          disabled={isSaving()}
        >
          {isSaving() ? 'Saving...' : 'Save Rules'}
        </button>
      </div>
    </div>
  );
};

// Helper functions

function getDefaultRules(): CuratorRules {
  return {
    publishing: {
      requireApproval: true,
      autoApproveCreator: true,
      minWordCount: 100,
      maxWordCount: 20000,
      requiredElements: [],
      acceptedTopics: [],
      rejectedTopics: [],
      qualityThreshold: 0.6,
    },
    comments: {
      autoRespond: true,
      moderationLevel: 'conversational',
      synthesisThreshold: 3,
      synthesisQualityMin: 0.5,
    },
    persona: {
      name: 'Curator',
      voice: 'thoughtful and constructive',
      expertise: [],
      systemPrompt: '',
    }
  };
}

function mergeRules(current: CuratorRules, loaded: Partial<CuratorRules>): CuratorRules {
  return {
    publishing: { ...current.publishing, ...loaded.publishing },
    comments: { ...current.comments, ...loaded.comments },
    persona: { ...current.persona, ...loaded.persona },
  };
}
