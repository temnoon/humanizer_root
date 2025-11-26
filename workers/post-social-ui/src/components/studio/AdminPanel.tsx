/**
 * Admin Panel - Node Management and Curator Configuration
 * 
 * Admin users can:
 * - Create new nodes with custom curator personas
 * - Configure curator instructions based on node themes
 * - View and manage all owned nodes
 * - Set detailed publishing rules and comment moderation
 */

import { Component, createSignal, createResource, Show, For } from 'solid-js';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import { CuratorRulesEditor } from './CuratorRulesEditor';
import type { Node } from '@/types/models';

interface AdminPanelProps {
  onNodeCreated?: (node: Node) => void;
  onNodeSelected?: (node: Node) => void;
}

export const AdminPanel: Component<AdminPanelProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<'nodes' | 'create'>('nodes');
  const [selectedNode, setSelectedNode] = createSignal<Node | null>(null);
  const [showCuratorConfig, setShowCuratorConfig] = createSignal(false);
  
  // Fetch user's nodes
  const [userNodes, { refetch }] = createResource(
    () => authStore.token(),
    async (token) => {
      if (!token) return [];
      try {
        const nodes = await nodesService.listNodes(token, { mine: true });
        return nodes;
      } catch (err) {
        console.error('Failed to load nodes:', err);
        return [];
      }
    }
  );
  
  const handleNodeCreated = (node: Node) => {
    refetch();
    setActiveTab('nodes');
    props.onNodeCreated?.(node);
  };
  
  const handleConfigureCurator = (node: Node) => {
    setSelectedNode(node);
    setShowCuratorConfig(true);
  };
  
  const handleCloseCuratorConfig = () => {
    setShowCuratorConfig(false);
    setSelectedNode(null);
  };
  
  return (
    <div class="admin-panel">
      <div class="admin-header">
        <h2>Node Administration</h2>
        <p class="admin-subtitle">Create and manage your AI-curated nodes</p>
      </div>
      
      {/* Tab Navigation */}
      <div class="admin-tabs">
        <button
          class={`admin-tab ${activeTab() === 'nodes' ? 'active' : ''}`}
          onClick={() => setActiveTab('nodes')}
        >
          📚 My Nodes
        </button>
        <button
          class={`admin-tab ${activeTab() === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          ➕ Create Node
        </button>
      </div>
      
      <div class="admin-content">
        {/* My Nodes Tab */}
        <Show when={activeTab() === 'nodes'}>
          <div class="nodes-list-section">
            <Show 
              when={!userNodes.loading}
              fallback={<div class="loading-state">Loading your nodes...</div>}
            >
              <Show
                when={userNodes()?.length}
                fallback={
                  <div class="empty-state">
                    <p>You haven't created any nodes yet.</p>
                    <button 
                      class="create-first-btn"
                      onClick={() => setActiveTab('create')}
                    >
                      Create Your First Node
                    </button>
                  </div>
                }
              >
                <div class="nodes-grid">
                  <For each={userNodes()}>
                    {(node) => (
                      <div class="admin-node-card">
                        <div class="node-card-header">
                          <h3 class="node-name">{node.name}</h3>
                          <span class={`node-status ${node.status}`}>
                            {node.status}
                          </span>
                        </div>
                        
                        <p class="node-description">
                          {node.description || 'No description'}
                        </p>
                        
                        <div class="node-stats">
                          <span class="stat">
                            📝 {node.narrativeCount || 0} narratives
                          </span>
                          <span class="stat">
                            👥 {node.subscriberCount || 0} subscribers
                          </span>
                        </div>
                        
                        <Show when={node.curatorConfig}>
                          <div class="curator-preview">
                            <span class="curator-label">Curator:</span>
                            <span class="curator-personality">
                              {node.curatorConfig.personality || 'Default'}
                            </span>
                          </div>
                        </Show>
                        
                        <div class="node-actions">
                          <button 
                            class="node-action-btn"
                            onClick={() => props.onNodeSelected?.(node)}
                          >
                            View
                          </button>
                          <button 
                            class="node-action-btn primary"
                            onClick={() => handleConfigureCurator(node)}
                          >
                            ⚙️ Configure Curator
                          </button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </div>
        </Show>
        
        {/* Create Node Tab */}
        <Show when={activeTab() === 'create'}>
          <NodeCreationForm onCreated={handleNodeCreated} />
        </Show>
      </div>
      
      {/* Curator Configuration Modal */}
      <Show when={showCuratorConfig() && selectedNode()}>
        <div class="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) handleCloseCuratorConfig();
        }}>
          <div class="modal-container curator-modal">
            <CuratorRulesEditor
              nodeId={selectedNode()!.id}
              nodeName={selectedNode()!.name}
              onClose={handleCloseCuratorConfig}
              onSaved={() => {
                refetch();
                handleCloseCuratorConfig();
              }}
            />
          </div>
        </div>
      </Show>
    </div>
  );
};

/**
 * Node Creation Form with Curator Configuration
 */
interface NodeCreationFormProps {
  onCreated?: (node: Node) => void;
}

const NodeCreationForm: Component<NodeCreationFormProps> = (props) => {
  // Basic Info
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  
  // Curator Persona
  const [curatorName, setCuratorName] = createSignal('');
  const [personality, setPersonality] = createSignal('neutral');
  const [voice, setVoice] = createSignal('');
  const [expertise, setExpertise] = createSignal<string[]>([]);
  const [expertiseInput, setExpertiseInput] = createSignal('');
  
  // Curator Instructions
  const [systemPrompt, setSystemPrompt] = createSignal('');
  const [useTemplatePrompt, setUseTemplatePrompt] = createSignal(true);
  
  // Publishing Rules
  const [requireApproval, setRequireApproval] = createSignal(true);
  const [qualityThreshold, setQualityThreshold] = createSignal(0.6);
  const [acceptedTopics, setAcceptedTopics] = createSignal<string[]>([]);
  const [topicInput, setTopicInput] = createSignal('');
  
  // State
  const [isCreating, setIsCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [step, setStep] = createSignal(1);
  
  // Personality presets with descriptions
  const personalityPresets = [
    { value: 'neutral', label: 'Neutral', desc: 'Balanced and objective' },
    { value: 'husserlian', label: 'Husserlian', desc: 'Phenomenological, consciousness-focused' },
    { value: 'buddhist', label: 'Buddhist', desc: 'Mindful, emphasizes impermanence' },
    { value: 'pragmatist', label: 'Pragmatist', desc: 'Practical, outcome-oriented' },
    { value: 'socratic', label: 'Socratic', desc: 'Question-based, dialectical' },
    { value: 'analytical', label: 'Analytical', desc: 'Logical, precise' },
    { value: 'creative', label: 'Creative', desc: 'Imaginative, exploratory' },
    { value: 'custom', label: 'Custom', desc: 'Define your own approach' },
  ];
  
  // Generate template system prompt based on settings
  const generateTemplatePrompt = () => {
    const persona = curatorName() || 'The Curator';
    const voiceStyle = voice() || 'thoughtful and constructive';
    const expertiseAreas = expertise().length > 0 
      ? expertise().join(', ') 
      : 'general knowledge';
    const personalityStyle = personalityPresets.find(p => p.value === personality())?.label || 'Neutral';
    
    return `You are ${persona}, an AI curator for the "${name()}" node.

PERSONALITY: ${personalityStyle}
VOICE: ${voiceStyle}
EXPERTISE: ${expertiseAreas}

YOUR ROLE:
- Evaluate submissions for quality, relevance, and fit with this node's focus
- Engage thoughtfully with commenters, acknowledging insights and asking clarifying questions
- Synthesize community contributions into narrative improvements
- Maintain the intellectual standards and thematic coherence of the archive

CONTEXT AWARENESS:
- You have access to all narratives in this node's archive
- Reference relevant existing narratives when evaluating new submissions
- Identify connections and contradictions with the archive
- Help contributors position their work within the existing body of knowledge

EVALUATION CRITERIA:
- Quality threshold: ${Math.round(qualityThreshold() * 100)}%
- Focus areas: ${acceptedTopics().join(', ') || 'Open to all relevant topics'}

When evaluating submissions:
1. Assess clarity of argument and writing quality
2. Check relevance to the node's focus areas
3. Consider how it complements or extends existing narratives
4. Provide constructive feedback with specific suggestions

When responding to comments:
1. Acknowledge the commenter's perspective
2. Identify synthesizable insights
3. Ask clarifying questions if needed
4. Note how the comment might improve the narrative`;
  };
  
  // Add expertise area
  const addExpertise = () => {
    const exp = expertiseInput().trim();
    if (exp && !expertise().includes(exp)) {
      setExpertise([...expertise(), exp]);
      setExpertiseInput('');
    }
  };
  
  // Add accepted topic
  const addTopic = () => {
    const topic = topicInput().trim().toLowerCase();
    if (topic && !acceptedTopics().includes(topic)) {
      setAcceptedTopics([...acceptedTopics(), topic]);
      setTopicInput('');
    }
  };
  
  // Create node
  const handleCreate = async () => {
    const token = authStore.token();
    if (!token) {
      setError('Not authenticated');
      return;
    }
    
    if (!name().trim()) {
      setError('Node name is required');
      return;
    }
    
    setIsCreating(true);
    setError(null);
    
    try {
      // Build curator config
      const curatorConfig = {
        personality: personality(),
        systemPrompt: useTemplatePrompt() ? generateTemplatePrompt() : systemPrompt(),
        model: 'llama-3.1-8b',
        filterCriteria: {
          minQuality: qualityThreshold(),
          acceptedTopics: acceptedTopics(),
          rejectedTopics: [],
        },
      };
      
      // Build curator rules (for the new agent system)
      const curatorRules = {
        publishing: {
          requireApproval: requireApproval(),
          autoApproveCreator: true,
          minWordCount: 100,
          maxWordCount: 20000,
          acceptedTopics: acceptedTopics(),
          rejectedTopics: [],
          qualityThreshold: qualityThreshold(),
        },
        comments: {
          autoRespond: true,
          moderationLevel: 'conversational',
          synthesisThreshold: 3,
          synthesisQualityMin: 0.5,
        },
        persona: {
          name: curatorName() || 'Curator',
          voice: voice() || 'thoughtful and constructive',
          expertise: expertise(),
          systemPrompt: useTemplatePrompt() ? generateTemplatePrompt() : systemPrompt(),
        },
      };
      
      const node = await nodesService.createNode(
        {
          name: name().trim(),
          description: description().trim() || undefined,
          curator: curatorConfig,
        },
        token
      );
      
      // Also save curator_rules via the curator-agent endpoint
      try {
        const { curatorAgentService } = await import('@/services/curator');
        await curatorAgentService.updateCuratorRules(node.id, curatorRules, token);
      } catch (rulesErr) {
        console.warn('Failed to save curator rules (will use defaults):', rulesErr);
      }
      
      props.onCreated?.(node);
      
    } catch (err) {
      console.error('Failed to create node:', err);
      setError(err instanceof Error ? err.message : 'Failed to create node');
    } finally {
      setIsCreating(false);
    }
  };
  
  return (
    <div class="node-creation-form">
      {/* Progress Steps */}
      <div class="form-steps">
        <button 
          class={`form-step ${step() >= 1 ? 'active' : ''}`}
          onClick={() => setStep(1)}
        >
          1. Basic Info
        </button>
        <button 
          class={`form-step ${step() >= 2 ? 'active' : ''}`}
          onClick={() => step() >= 1 && setStep(2)}
        >
          2. Curator Persona
        </button>
        <button 
          class={`form-step ${step() >= 3 ? 'active' : ''}`}
          onClick={() => step() >= 2 && setStep(3)}
        >
          3. Instructions
        </button>
      </div>
      
      {/* Step 1: Basic Info */}
      <Show when={step() === 1}>
        <div class="form-section">
          <h3>Node Identity</h3>
          <p class="section-desc">
            Define what this node is about. The name and description help users 
            understand the focus area.
          </p>
          
          <div class="form-field">
            <label>Node Name *</label>
            <input
              type="text"
              class="form-input"
              placeholder="e.g., Phenomenology, Quantum Narratives, Buddhist Philosophy"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              maxLength={100}
            />
            <span class="char-count">{name().length}/100</span>
          </div>
          
          <div class="form-field">
            <label>Description</label>
            <textarea
              class="form-textarea"
              placeholder="Describe what kind of content this node curates..."
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              rows={4}
            />
          </div>
          
          <div class="form-field">
            <label>Focus Topics</label>
            <div class="tag-input-group">
              <div class="tags-list">
                <For each={acceptedTopics()}>
                  {(topic, i) => (
                    <span class="tag-chip accepted">
                      {topic}
                      <button 
                        class="tag-remove"
                        onClick={() => setAcceptedTopics(acceptedTopics().filter((_, idx) => idx !== i()))}
                      >×</button>
                    </span>
                  )}
                </For>
              </div>
              <div class="tag-input-row">
                <input
                  type="text"
                  class="form-input"
                  placeholder="Add topic..."
                  value={topicInput()}
                  onInput={(e) => setTopicInput(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTopic();
                    }
                  }}
                />
                <button class="add-tag-btn" onClick={addTopic}>Add</button>
              </div>
            </div>
            <p class="field-help">Topics this node focuses on (helps with curation)</p>
          </div>
          
          <div class="form-actions">
            <button 
              class="form-btn primary"
              onClick={() => setStep(2)}
              disabled={!name().trim()}
            >
              Next: Curator Persona →
            </button>
          </div>
        </div>
      </Show>
      
      {/* Step 2: Curator Persona */}
      <Show when={step() === 2}>
        <div class="form-section">
          <h3>Curator Persona</h3>
          <p class="section-desc">
            Define the AI curator's personality and expertise. This shapes how it 
            evaluates submissions and responds to comments.
          </p>
          
          <div class="form-field">
            <label>Curator Name</label>
            <input
              type="text"
              class="form-input"
              placeholder="e.g., The Phenomenologist, Buddha Bot, Dr. Logic"
              value={curatorName()}
              onInput={(e) => setCuratorName(e.currentTarget.value)}
            />
            <p class="field-help">How the curator identifies itself</p>
          </div>
          
          <div class="form-field">
            <label>Personality Style</label>
            <div class="personality-grid">
              <For each={personalityPresets}>
                {(preset) => (
                  <button
                    class={`personality-option ${personality() === preset.value ? 'selected' : ''}`}
                    onClick={() => setPersonality(preset.value)}
                  >
                    <span class="personality-label">{preset.label}</span>
                    <span class="personality-desc">{preset.desc}</span>
                  </button>
                )}
              </For>
            </div>
          </div>
          
          <div class="form-field">
            <label>Voice / Tone</label>
            <input
              type="text"
              class="form-input"
              placeholder="e.g., scholarly but accessible, warm and encouraging"
              value={voice()}
              onInput={(e) => setVoice(e.currentTarget.value)}
            />
          </div>
          
          <div class="form-field">
            <label>Areas of Expertise</label>
            <div class="tag-input-group">
              <div class="tags-list">
                <For each={expertise()}>
                  {(exp, i) => (
                    <span class="tag-chip expertise">
                      {exp}
                      <button 
                        class="tag-remove"
                        onClick={() => setExpertise(expertise().filter((_, idx) => idx !== i()))}
                      >×</button>
                    </span>
                  )}
                </For>
              </div>
              <div class="tag-input-row">
                <input
                  type="text"
                  class="form-input"
                  placeholder="Add expertise..."
                  value={expertiseInput()}
                  onInput={(e) => setExpertiseInput(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addExpertise();
                    }
                  }}
                />
                <button class="add-tag-btn" onClick={addExpertise}>Add</button>
              </div>
            </div>
          </div>
          
          <div class="form-actions">
            <button class="form-btn secondary" onClick={() => setStep(1)}>
              ← Back
            </button>
            <button class="form-btn primary" onClick={() => setStep(3)}>
              Next: Instructions →
            </button>
          </div>
        </div>
      </Show>
      
      {/* Step 3: Curator Instructions */}
      <Show when={step() === 3}>
        <div class="form-section">
          <h3>Curator Instructions</h3>
          <p class="section-desc">
            Configure how the curator evaluates content and interacts with contributors.
          </p>
          
          <div class="form-field">
            <label class="toggle-label">
              <input
                type="checkbox"
                checked={requireApproval()}
                onChange={(e) => setRequireApproval(e.currentTarget.checked)}
              />
              <span>Require curator approval for submissions</span>
            </label>
            <p class="field-help">When enabled, narratives must pass curator review before publishing</p>
          </div>
          
          <div class="form-field">
            <label>Quality Threshold</label>
            <div class="slider-container">
              <input
                type="range"
                class="form-slider"
                min="0"
                max="100"
                value={Math.round(qualityThreshold() * 100)}
                onInput={(e) => setQualityThreshold(parseInt(e.currentTarget.value) / 100)}
              />
              <span class="slider-value">{Math.round(qualityThreshold() * 100)}%</span>
            </div>
            <p class="field-help">Minimum quality score for approval</p>
          </div>
          
          <div class="form-field">
            <label class="toggle-label">
              <input
                type="checkbox"
                checked={useTemplatePrompt()}
                onChange={(e) => setUseTemplatePrompt(e.currentTarget.checked)}
              />
              <span>Use auto-generated instructions</span>
            </label>
          </div>
          
          <Show when={useTemplatePrompt()}>
            <div class="form-field">
              <label>Generated Instructions Preview</label>
              <pre class="prompt-preview">{generateTemplatePrompt()}</pre>
            </div>
          </Show>
          
          <Show when={!useTemplatePrompt()}>
            <div class="form-field">
              <label>Custom System Prompt</label>
              <textarea
                class="form-textarea code"
                placeholder="Enter custom instructions for the curator AI..."
                value={systemPrompt()}
                onInput={(e) => setSystemPrompt(e.currentTarget.value)}
                rows={12}
              />
              <p class="field-help">
                Advanced: Direct instructions to the AI. Include guidance on 
                evaluation criteria, response style, and synthesis approach.
              </p>
            </div>
          </Show>
          
          {/* Error Display */}
          <Show when={error()}>
            <div class="form-error">❌ {error()}</div>
          </Show>
          
          <div class="form-actions">
            <button class="form-btn secondary" onClick={() => setStep(2)}>
              ← Back
            </button>
            <button 
              class="form-btn primary"
              onClick={handleCreate}
              disabled={isCreating() || !name().trim()}
            >
              {isCreating() ? 'Creating...' : 'Create Node'}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default AdminPanel;
