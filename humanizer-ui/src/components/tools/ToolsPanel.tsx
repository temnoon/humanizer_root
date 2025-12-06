/**
 * Tools Panel - Right Side
 * All transformation and analysis tools organized by category
 * Shows privacy warnings when using cloud tools with local content
 */

import React, { useState, useEffect } from 'react';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePanelHistory } from '@/contexts/PanelHistoryContext';
import { PanelNavigation } from '@/components/PanelNavigation';
import { useServices } from '@/services/api';
import './ToolsPanel.css';

type ToolCategory = 'transformations' | 'analysis' | 'network' | 'bookmaking';

export function ToolsPanel() {
  const { features, provider } = useEnvironment();
  const { currentBuffer } = useWorkspace();
  const {
    canGoBackRight,
    canGoForwardRight,
    goBackRight,
    goForwardRight,
    pushRightState,
    currentRightState,
  } = usePanelHistory();
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('transformations');

  const categories = [
    { id: 'transformations' as ToolCategory, label: 'Transformations', icon: '🔄' },
    { id: 'analysis' as ToolCategory, label: 'Analysis', icon: '📊' },
    { id: 'network' as ToolCategory, label: 'Network', icon: '🌐' },
    { id: 'bookmaking' as ToolCategory, label: 'Books', icon: '📖' },
  ];

  const handleCategoryChange = (category: ToolCategory) => {
    setActiveCategory(category);

    // Push to panel history
    pushRightState({
      id: `category-${category}`,
      type: 'category',
      data: { category },
    });
  };

  // Push initial state on mount
  useEffect(() => {
    pushRightState({
      id: 'category-transformations',
      type: 'category',
      data: { category: 'transformations' },
    });
  }, []); // Only run once on mount

  // Restore state when navigating through panel history
  useEffect(() => {
    if (currentRightState?.type === 'category') {
      const category = currentRightState.data.category as ToolCategory;
      setActiveCategory(category);
    }
  }, [currentRightState]);

  return (
    <div className="tools-panel">
      {/* Panel Navigation - Always visible */}
      <PanelNavigation
        position="right"
        canGoBack={canGoBackRight}
        canGoForward={canGoForwardRight}
        onBack={goBackRight}
        onForward={goForwardRight}
        title="Tools"
      />

      <div className="panel-header">
        <h2>🛠️ Tools</h2>
        <p>Transform and analyze content</p>
      </div>

      <div className="panel-content">
        {/* Category Tabs - Always visible */}
        <div className="category-tabs">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => handleCategoryChange(cat.id)}
            >
              <span className="tab-icon">{cat.icon}</span>
              <span className="tab-label">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Privacy Warning */}
        {provider === 'cloudflare' && currentBuffer && (
          <div className="privacy-warning">
            <div className="warning-icon">⚠️</div>
            <div className="warning-content">
              <strong>Cloud Mode Active</strong>
              <p>Content will be sent to Cloudflare Workers for processing</p>
            </div>
          </div>
        )}

        {/* Tool List */}
        <div className="tools-list">
          {/* Transformations & Analysis need a buffer */}
          {(activeCategory === 'transformations' || activeCategory === 'analysis') && !currentBuffer ? (
            <div className="no-buffer-message">
              <div className="message-icon">📄</div>
              <p>Load content to use {activeCategory === 'transformations' ? 'transformation' : 'analysis'} tools</p>
            </div>
          ) : (
            <>
              {activeCategory === 'transformations' && <TransformationTools buffer={currentBuffer} />}
              {activeCategory === 'analysis' && <AnalysisTools />}
              {activeCategory === 'network' && <NetworkTools />}
              {activeCategory === 'bookmaking' && <BookmakingTools />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TransformationTools({ buffer }: { buffer: any }) {
  const { features } = useEnvironment();
  const { createTransformedBuffer } = useWorkspace();
  const { transformations } = useServices();
  const [activeTool, setActiveTool] = useState<string>('humanize');
  const [loading, setLoading] = useState(false);

  // Humanizer Tool
  const [humanizeMode, setHumanizeMode] = useState<'basic' | 'advanced' | 'natural'>('basic');

  // Round-Trip Tool
  const [targetLanguage, setTargetLanguage] = useState('Spanish');

  // Tool tabs (always visible)
  const tools = [
    { id: 'humanize', label: 'Humanize', icon: '🤖' },
    { id: 'detect', label: 'Detect AI', icon: '🔍' },
    { id: 'roundtrip', label: 'Round-Trip', icon: '🔄' },
    { id: 'persona', label: 'Persona', icon: '🎭', disabled: true },
  ];

  const handleHumanize = async () => {
    setLoading(true);
    try {
      const result = await transformations.humanize(buffer.content, { mode: humanizeMode });
      createTransformedBuffer(
        buffer.id,
        { type: 'humanize', parameters: { mode: humanizeMode } },
        result.transformed,
        `${buffer.title} (humanized)`
      );
    } catch (error) {
      console.error('Humanize failed:', error);
      alert('Humanization failed. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDetectAI = async () => {
    setLoading(true);
    try {
      const result = await transformations.detectAI(buffer.content);
      // For AI detection, we'll create a special buffer with metadata
      const detectionReport = `# AI Detection Results\n\n**AI Probability**: ${(result.aiProbability * 100).toFixed(1)}%\n\n## Highlights\n\n${result.highlights.map((h, i) => `${i + 1}. Score: ${(h.score * 100).toFixed(1)}% - ${h.reason}\n   > "${buffer.content.substring(h.start, h.end)}"`).join('\n\n')}`;
      createTransformedBuffer(
        buffer.id,
        { type: 'detect-ai', parameters: {} },
        detectionReport,
        `${buffer.title} (AI detection)`
      );
    } catch (error) {
      console.error('AI detection failed:', error);
      alert('AI detection failed. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoundTrip = async () => {
    setLoading(true);
    try {
      const result = await transformations.roundTrip(buffer.content, targetLanguage);
      const report = `# Round-Trip Translation\n\n**Language**: ${result.language}\n**Similarity**: ${(result.similarity * 100).toFixed(1)}%\n\n## Back-Translated\n\n${result.backTranslated}`;
      createTransformedBuffer(
        buffer.id,
        { type: 'round-trip', parameters: { language: targetLanguage } },
        report,
        `${buffer.title} (round-trip)`
      );
    } catch (error) {
      console.error('Round-trip failed:', error);
      alert('Round-trip translation failed. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="transformation-ui">
      {/* Tool Tabs - Always Visible */}
      <div className="transform-tabs">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`transform-tab ${activeTool === tool.id ? 'active' : ''} ${tool.disabled ? 'disabled' : ''}`}
            onClick={() => !tool.disabled && setActiveTool(tool.id)}
            disabled={tool.disabled}
            title={tool.label}
          >
            <span className="tab-icon">{tool.icon}</span>
            <span className="tab-label">{tool.label}</span>
          </button>
        ))}
      </div>

      {/* Tool Controls */}
      <div className="transform-controls">
        {/* Humanizer Controls */}
        {activeTool === 'humanize' && (
          <div className="control-group">
            <label className="control-label">Mode</label>
            <select
              className="control-select"
              value={humanizeMode}
              onChange={(e) => setHumanizeMode(e.target.value as any)}
            >
              <option value="basic">Basic</option>
              <option value="advanced">Advanced</option>
              <option value="natural">Natural</option>
            </select>
            <p className="control-hint">Transform AI text to sound more human</p>
            <button className="btn btn-primary" onClick={handleHumanize} disabled={loading}>
              {loading ? 'Processing...' : 'Humanize Text'}
            </button>
          </div>
        )}

        {/* AI Detection Controls */}
        {activeTool === 'detect' && (
          <div className="control-group">
            <p className="control-hint">Analyze text for AI-generated content</p>
            <button className="btn btn-primary" onClick={handleDetectAI} disabled={loading}>
              {loading ? 'Analyzing...' : 'Detect AI'}
            </button>
          </div>
        )}

        {/* Round-Trip Controls */}
        {activeTool === 'roundtrip' && (
          <div className="control-group">
            <label className="control-label">Target Language</label>
            <select
              className="control-select"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
            >
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Japanese">Japanese</option>
              <option value="Chinese">Chinese</option>
            </select>
            <p className="control-hint">Translate through an intermediate language and back</p>
            <button className="btn btn-primary" onClick={handleRoundTrip} disabled={loading}>
              {loading ? 'Translating...' : 'Round-Trip Translate'}
            </button>
          </div>
        )}

        {/* Persona (Coming Soon) */}
        {activeTool === 'persona' && (
          <div className="control-group">
            <div className="coming-soon-message">
              <span className="badge">Coming Soon</span>
              <p>Persona & Style transformations will be available soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisTools() {
  const { features } = useEnvironment();
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const tools = [
    {
      id: 'semantic-search',
      label: 'Semantic Search',
      description: 'Search through embeddings',
      icon: '🔎',
      available: true,
      location: 'cloud',
    },
    {
      id: 'clustering',
      label: 'Clustering',
      description: 'Discover patterns in conversations',
      icon: '🗂️',
      available: true,
      location: 'local',
    },
  ];

  if (activeTool) {
    return (
      <div className="tool-detail-view">
        <button className="btn btn-sm" onClick={() => setActiveTool(null)}>
          ← Back to Tools
        </button>
        <div className="tool-content">
          {activeTool === 'semantic-search' && <SemanticSearchTool />}
          {activeTool === 'clustering' && <ClusteringTool />}
        </div>
      </div>
    );
  }

  return (
    <>
      {tools.map((tool) => (
        <ToolItemClickable
          key={tool.id}
          {...tool}
          onClick={() => tool.available && setActiveTool(tool.id)}
        />
      ))}
    </>
  );
}

function NetworkTools() {
  const { features } = useEnvironment();
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const tools = [
    {
      id: 'node-browser',
      label: 'Node Browser',
      description: 'Browse post-social nodes and narratives',
      icon: '🌐',
      available: features.nodeNetwork,
      location: 'cloud',
    },
    {
      id: 'post-to-node',
      label: 'Post to Node',
      description: 'Create or update node content',
      icon: '📝',
      available: features.nodeNetwork,
      location: 'cloud',
    },
    {
      id: 'node-management',
      label: 'Manage Nodes',
      description: 'Create, edit, delete nodes',
      icon: '⚙️',
      available: features.nodeNetwork,
      location: 'cloud',
    },
    {
      id: 'narrative-manager',
      label: 'Narrative Manager',
      description: 'Order and organize narratives',
      icon: '📚',
      available: features.nodeNetwork,
      location: 'cloud',
    },
    {
      id: 'curator-chat',
      label: 'Curator Chat',
      description: 'Chat with AI curator about nodes',
      icon: '💬',
      available: features.nodeNetwork,
      location: 'cloud',
    },
    {
      id: 'node-admin',
      label: 'Admin Dashboard',
      description: 'Health checks, pyramids, rebuilds',
      icon: '🔧',
      available: features.nodeNetwork,
      location: 'cloud',
      badge: 'Admin',
    },
  ];

  // If a tool is active, show its detail view
  if (activeTool) {
    return (
      <div className="tool-detail-view">
        <button className="btn btn-sm" onClick={() => setActiveTool(null)}>
          ← Back to Tools
        </button>
        <div className="tool-content">
          {activeTool === 'node-browser' && <NodeBrowserTool />}
          {activeTool === 'post-to-node' && <PostToNodeTool />}
          {activeTool === 'node-management' && <NodeManagementTool />}
          {activeTool === 'narrative-manager' && <NarrativeManagerTool />}
          {activeTool === 'curator-chat' && <CuratorChatTool />}
          {activeTool === 'node-admin' && <NodeAdminTool />}
        </div>
      </div>
    );
  }

  return (
    <>
      {tools.map((tool) => (
        <ToolItemClickable
          key={tool.id}
          {...tool}
          onClick={() => tool.available && setActiveTool(tool.id)}
        />
      ))}
    </>
  );
}

function BookmakingTools() {
  const { features } = useEnvironment();
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const tools = [
    {
      id: 'gutenberg-import',
      label: 'Gutenberg Import',
      description: 'Import and process Project Gutenberg books',
      icon: '📖',
      available: true,
      location: 'cloud',
    },
    {
      id: 'book-builder',
      label: 'Book Builder',
      description: 'Collect assets and edit together',
      icon: '📚',
      available: features.bookBuilder,
      location: 'both',
      badge: 'WIP',
    },
  ];

  // If a tool is active, show its detail view
  if (activeTool) {
    return (
      <div className="tool-detail-view">
        <button className="btn btn-sm" onClick={() => setActiveTool(null)}>
          ← Back to Tools
        </button>
        <div className="tool-content">
          {activeTool === 'gutenberg-import' && <GutenbergImportTool />}
          {activeTool === 'book-builder' && <div>Book Builder coming soon!</div>}
        </div>
      </div>
    );
  }

  return (
    <>
      {tools.map((tool) => (
        <ToolItemClickable
          key={tool.id}
          {...tool}
          onClick={() => {
            if (tool.available) {
              if (tool.id === 'gutenberg-import') {
                setActiveTool(tool.id);
              } else {
                alert(`${tool.label} coming soon!`);
              }
            }
          }}
        />
      ))}
    </>
  );
}

function ToolItem({
  id,
  label,
  description,
  icon,
  available,
  location,
  badge,
}: {
  id: string;
  label: string;
  description: string;
  icon: string;
  available: boolean;
  location: string;
  badge?: string;
}) {
  const handleClick = () => {
    if (available) {
      alert(`${label} tool coming soon!`);
    }
  };

  return (
    <button
      className={`tool-item ${!available ? 'disabled' : ''}`}
      onClick={handleClick}
      disabled={!available}
    >
      <div className="tool-icon">{icon}</div>
      <div className="tool-info">
        <div className="tool-label">
          {label}
          {badge && <span className="tool-badge">{badge}</span>}
        </div>
        <div className="tool-description">{description}</div>
        <div className="tool-location">
          {location === 'local' && '🏠 Local'}
          {location === 'cloud' && '☁️ Cloud'}
          {location === 'both' && '🏠☁️ Local + Cloud'}
        </div>
      </div>
    </button>
  );
}

function ToolItemClickable({
  id,
  label,
  description,
  icon,
  available,
  location,
  badge,
  onClick,
}: {
  id: string;
  label: string;
  description: string;
  icon: string;
  available: boolean;
  location: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`tool-item ${!available ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={!available}
    >
      <div className="tool-icon">{icon}</div>
      <div className="tool-info">
        <div className="tool-label">
          {label}
          {badge && <span className="tool-badge">{badge}</span>}
        </div>
        <div className="tool-description">{description}</div>
        <div className="tool-location">
          {location === 'local' && '🏠 Local'}
          {location === 'cloud' && '☁️ Cloud'}
          {location === 'both' && '🏠☁️ Local + Cloud'}
        </div>
      </div>
    </button>
  );
}

// ==========================================
// Network Tool Components
// ==========================================

function NodeBrowserTool() {
  const { postSocial } = useServices();
  const [nodes, setNodes] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [narratives, setNarratives] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    setLoading(true);
    try {
      const result = await postSocial.listNarratives();
      setNodes(result);
    } catch (error) {
      console.error('Failed to load nodes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNarratives = async (nodeId: string) => {
    try {
      const result = await postSocial.getNodeNarratives(nodeId);
      setNarratives(result);
    } catch (error) {
      console.error('Failed to load narratives:', error);
    }
  };

  return (
    <div className="node-browser">
      <h3>Node Browser</h3>
      {loading ? (
        <p>Loading nodes...</p>
      ) : (
        <div className="node-list">
          {nodes.map((node) => (
            <button
              key={node.id}
              className="node-item"
              onClick={() => {
                setSelectedNode(node);
                loadNarratives(node.id);
              }}
            >
              <strong>{node.title}</strong>
              <p>{node.description}</p>
              <small>{node.nodeCount} nodes</small>
            </button>
          ))}
        </div>
      )}
      {selectedNode && (
        <div className="narratives-view">
          <h4>{selectedNode.title} Narratives</h4>
          {narratives.map((narrative) => (
            <div key={narrative.id} className="narrative-item">
              {narrative.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PostToNodeTool() {
  const { postSocial } = useServices();
  const { currentBuffer } = useWorkspace();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [body, setBody] = useState('');
  const [nodes, setNodes] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadNodes();
    if (currentBuffer) {
      setBody(currentBuffer.content);
      setTitle(currentBuffer.title);
    }
  }, [currentBuffer]);

  const loadNodes = async () => {
    try {
      const result = await postSocial.listNarratives();
      setNodes(result);
    } catch (error) {
      console.error('Failed to load nodes:', error);
    }
  };

  const handlePost = async () => {
    if (!title || !slug || !body) {
      alert('Please fill in all fields');
      return;
    }

    setPosting(true);
    try {
      await postSocial.createNode({
        slug,
        title,
        body,
        narrativeId: selectedNode || undefined,
      });
      alert('Posted successfully!');
      setTitle('');
      setSlug('');
      setBody('');
    } catch (error) {
      console.error('Failed to post:', error);
      alert('Failed to post. See console for details.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="post-to-node">
      <h3>Post to Node</h3>
      <div className="control-group">
        <label>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Node title"
        />
      </div>
      <div className="control-group">
        <label>Slug</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="url-friendly-slug"
        />
      </div>
      <div className="control-group">
        <label>Narrative (optional)</label>
        <select value={selectedNode} onChange={(e) => setSelectedNode(e.target.value)}>
          <option value="">None</option>
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.title}
            </option>
          ))}
        </select>
      </div>
      <div className="control-group">
        <label>Body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder="Node content..."
        />
      </div>
      <button className="btn btn-primary" onClick={handlePost} disabled={posting}>
        {posting ? 'Posting...' : 'Post to Network'}
      </button>
    </div>
  );
}

function NodeManagementTool() {
  const { postSocial } = useServices();
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    setLoading(true);
    try {
      const result = await postSocial.listNarratives();
      setNodes(result);
    } catch (error) {
      console.error('Failed to load nodes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (nodeId: string) => {
    if (!confirm('Delete this node? This cannot be undone.')) return;

    try {
      await postSocial.deleteNarrative(nodeId);
      alert('Deleted successfully');
      loadNodes();
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete. See console for details.');
    }
  };

  return (
    <div className="node-management">
      <h3>Manage Nodes</h3>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="node-list">
          {nodes.map((node) => (
            <div key={node.id} className="node-item">
              <div>
                <strong>{node.title}</strong>
                <p>{node.description}</p>
              </div>
              <div>
                <button className="btn btn-sm" onClick={() => alert('Edit coming soon')}>
                  Edit
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(node.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NarrativeManagerTool() {
  const { postSocial } = useServices();
  const [nodes, setNodes] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [narratives, setNarratives] = useState<any[]>([]);

  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    try {
      const result = await postSocial.listNarratives();
      setNodes(result);
    } catch (error) {
      console.error('Failed to load nodes:', error);
    }
  };

  const loadNarratives = async (nodeId: string) => {
    try {
      const result = await postSocial.getNodeNarratives(nodeId);
      setNarratives(result);
    } catch (error) {
      console.error('Failed to load narratives:', error);
    }
  };

  const handleReorder = async () => {
    if (!selectedNode) return;

    const ids = narratives.map((n) => n.id);
    try {
      await postSocial.reorderNarratives(selectedNode, ids);
      alert('Order saved!');
    } catch (error) {
      console.error('Failed to reorder:', error);
      alert('Failed to save order');
    }
  };

  return (
    <div className="narrative-manager">
      <h3>Narrative Manager</h3>
      <div className="control-group">
        <label>Select Node</label>
        <select
          value={selectedNode}
          onChange={(e) => {
            setSelectedNode(e.target.value);
            loadNarratives(e.target.value);
          }}
        >
          <option value="">Choose a node...</option>
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.title}
            </option>
          ))}
        </select>
      </div>
      {selectedNode && (
        <div className="narrative-list">
          <p>Drag to reorder (coming soon):</p>
          {narratives.map((narrative) => (
            <div key={narrative.id} className="narrative-item">
              {narrative.title}
            </div>
          ))}
          <button className="btn btn-primary" onClick={handleReorder}>
            Save Order
          </button>
        </div>
      )}
    </div>
  );
}

function CuratorChatTool() {
  const { postSocial } = useServices();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await postSocial.chat(input);
      setMessages((prev) => [...prev, response.message]);
    } catch (error) {
      console.error('Chat failed:', error);
      alert('Chat failed. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="curator-chat">
      <h3>Curator Chat</h3>
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message message-${msg.role}`}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask the curator..."
          disabled={loading}
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={loading}>
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

function NodeAdminTool() {
  const { postSocial } = useServices();
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const result = await postSocial.getNodesHealth();
      setHealth(result);
    } catch (error) {
      console.error('Failed to load health:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="node-admin">
      <h3>Admin Dashboard</h3>
      {loading ? (
        <p>Loading health status...</p>
      ) : health ? (
        <div className="health-dashboard">
          <div className="health-stat">
            <strong>Total Nodes:</strong> {health.total}
          </div>
          <div className="health-stat">
            <strong>Healthy:</strong> {health.healthy?.length || 0}
          </div>
          <div className="health-stat">
            <strong>Unhealthy:</strong> {health.unhealthy?.length || 0}
          </div>
          {health.unhealthy && health.unhealthy.length > 0 && (
            <div className="unhealthy-nodes">
              <h4>Issues:</h4>
              {health.unhealthy.map((node: any) => (
                <div key={node.nodeId} className="health-issue">
                  <strong>{node.nodeName}</strong>
                  <ul>
                    {node.issues.map((issue: string, i: number) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p>No health data available</p>
      )}
      <button className="btn btn-secondary" onClick={loadHealth}>
        Refresh
      </button>
    </div>
  );
}

function SemanticSearchTool() {
  const { postSocial } = useServices();
  const { createBuffer } = useWorkspace();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const searchResults = await postSocial.search(query, { limit: 10 });
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
      alert('Search failed. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: any) => {
    createBuffer(
      result.node.title,
      result.node.body,
      {
        type: 'search-result',
        metadata: {
          nodeId: result.node.id,
          similarity: result.similarity,
          query,
        },
      }
    );
  };

  return (
    <div className="semantic-search">
      <h3>Semantic Search</h3>
      <div className="search-input-group">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by meaning..."
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          className="btn btn-primary"
          onClick={handleSearch}
          disabled={loading || !query.trim()}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="search-results">
          <h4>Results ({results.length})</h4>
          {results.map((result, i) => (
            <div
              key={i}
              className="search-result-item"
              onClick={() => handleResultClick(result)}
            >
              <div className="result-title">{result.node.title}</div>
              <div className="result-similarity">
                Similarity: {(result.similarity * 100).toFixed(1)}%
              </div>
              <div className="result-excerpt">{result.excerpt}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClusteringTool() {
  const { archive } = useServices();
  const [status, setStatus] = useState<string>('');
  const [running, setRunning] = useState(false);

  const handleRunClustering = async () => {
    if (!archive) {
      alert('Clustering only available with local archives');
      return;
    }

    setRunning(true);
    setStatus('Starting clustering analysis...');

    try {
      // This would call a clustering endpoint
      // For now, just show a message
      setStatus('Clustering completed! (Placeholder - full implementation pending)');
    } catch (error) {
      console.error('Clustering failed:', error);
      setStatus('Clustering failed. See console for details.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="clustering-tool">
      <h3>Clustering Analysis</h3>
      <p>Discover patterns and themes in your conversations</p>

      {status && (
        <div className="clustering-status">
          <p>{status}</p>
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={handleRunClustering}
        disabled={running || !archive}
      >
        {running ? 'Analyzing...' : 'Run Clustering'}
      </button>

      {!archive && (
        <p className="tool-note">
          💡 Clustering requires a local archive. Switch to Electron mode or import an archive.
        </p>
      )}
    </div>
  );
}

function GutenbergImportTool() {
  const { postSocial } = useServices();
  const { createBuffer } = useWorkspace();
  const [bookId, setBookId] = useState('');
  const [bookUrl, setBookUrl] = useState('');
  const [title, setTitle] = useState('');
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [pyramid, setPyramid] = useState<any | null>(null);
  const [showCurator, setShowCurator] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // Extract book ID from URL or use direct ID input
  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingMessage]);

  const extractBookId = (input: string): string | null => {
    // If it's just a number, return it
    if (/^\d+$/.test(input)) {
      return input;
    }

    // Try to extract from URL: https://www.gutenberg.org/files/84/84-0.txt
    const match = input.match(/\/files\/(\d+)\//);
    if (match) {
      return match[1];
    }

    // Try to extract from ebooks URL: https://www.gutenberg.org/ebooks/84
    const ebookMatch = input.match(/\/ebooks\/(\d+)/);
    if (ebookMatch) {
      return ebookMatch[1];
    }

    return null;
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !nodeId || isStreaming) return;

    const userMessage = chatInput.trim();
    setChatInput('');

    // Add user message
    setChatMessages(prev => [
      ...prev,
      {
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      },
    ]);

    // Start streaming assistant response
    setIsStreaming(true);
    setStreamingMessage('');

    // Collect chunks in a variable to avoid state sync issues
    let accumulatedMessage = '';

    try {
      await postSocial.streamChat(userMessage, {
        nodeId: nodeId,
        onChunk: (chunk: string) => {
          accumulatedMessage += chunk;
          setStreamingMessage(accumulatedMessage);
        },
        onComplete: () => {
          // Move accumulated message to chat history
          setChatMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: accumulatedMessage,
              timestamp: Date.now(),
            },
          ]);
          setStreamingMessage('');
          setIsStreaming(false);
        },
        onError: (error: Error) => {
          console.error('Chat stream error:', error);
          setChatMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: `Error: ${error.message}`,
              timestamp: Date.now(),
            },
          ]);
          setStreamingMessage('');
          setIsStreaming(false);
        },
      });
    } catch (error: any) {
      console.error('Chat failed:', error);
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${error.message || 'Failed to send message'}`,
          timestamp: Date.now(),
        },
      ]);
      setStreamingMessage('');
      setIsStreaming(false);
    }
  };

  const handleProcess = async () => {
    const id = extractBookId(bookId || bookUrl);
    if (!id) {
      alert('Please enter a valid Gutenberg book ID or URL');
      return;
    }

    if (!title) {
      alert('Please enter a title for the book');
      return;
    }

    setProcessing(true);
    setStatus('Creating node...');

    try {
      // Step 1: Create node
      const node = await postSocial.createNode({
        slug: `gutenberg-${id}`,
        title: title || `Gutenberg Book ${id}`,
        body: `Imported from Project Gutenberg (Book ID: ${id})`,
        tags: ['gutenberg', 'book', `book-${id}`],
      });

      setNodeId(node.id);
      setStatus(`Node created: ${node.id}`);

      // Step 2: Reformat text (removes line breaks, creates chapters)
      setStatus('Processing text and creating chapters...');
      const reformatResult = await postSocial.reformatGutenbergText(node.id);
      setStatus(`Created ${reformatResult.chapterCount} chapters`);

      // Step 3: Build pyramid summary with embeddings
      setStatus('Building pyramid summary and embeddings...');
      const pyramidResult = await postSocial.buildPyramid(node.id);
      setStatus(`Pyramid built: ${pyramidResult.levels} levels, ${pyramidResult.chunks} chunks`);

      // Step 4: Get working texts (chapters)
      const workingTexts = await postSocial.getWorkingTexts(node.id);
      setChapters(workingTexts.chapters || []);

      // Step 5: Get pyramid summary
      const pyramidData = await postSocial.getPyramid(node.id);
      setPyramid(pyramidData);

      setStatus(`✅ Processing complete! ${workingTexts.chapters?.length || 0} chapters ready.`);

      // Create a buffer with the summary
      if (pyramidData.summary) {
        createBuffer(
          title,
          pyramidData.summary,
          {
            type: 'gutenberg-summary',
            id: node.id,
            metadata: {
              bookId: id,
              nodeId: node.id,
              chapterCount: workingTexts.chapters?.length || 0,
              pyramidLevels: pyramidData.levels?.length || 0,
            },
          }
        );
      }

    } catch (error: any) {
      console.error('Gutenberg processing failed:', error);
      setStatus(`❌ Error: ${error.message || 'Processing failed'}`);
      alert('Processing failed. See console for details.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="gutenberg-import-tool">
      <h3>📖 Gutenberg Import</h3>
      <p className="tool-description">
        Import and process books from Project Gutenberg with AI-powered chapter detection and pyramid summaries
      </p>

      {!nodeId ? (
        <>
          <div className="control-group">
            <label className="control-label">Book ID or URL</label>
            <input
              type="text"
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              placeholder="84 or https://www.gutenberg.org/ebooks/84"
              className="control-input"
            />
            <p className="control-hint">
              Enter a book ID (e.g., "84" for Frankenstein) or paste a Gutenberg URL
            </p>
          </div>

          <div className="control-group">
            <label className="control-label">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Book title"
              className="control-input"
            />
          </div>

          {status && (
            <div className="status-message">
              <p>{status}</p>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleProcess}
            disabled={processing || (!bookId && !bookUrl) || !title}
          >
            {processing ? 'Processing...' : 'Import & Process Book'}
          </button>

          <div className="tool-note">
            <p><strong>What happens:</strong></p>
            <ol>
              <li>Creates a post-social node for the book</li>
              <li>Processes text (removes line breaks, detects chapters)</li>
              <li>Builds pyramid summary with embeddings</li>
              <li>Opens AI Curator for Q&A about the book</li>
            </ol>
          </div>
        </>
      ) : (
        <>
          <div className="processing-complete">
            <h4>✅ Processing Complete</h4>
            <p><strong>Node ID:</strong> {nodeId}</p>
            <p><strong>Chapters:</strong> {chapters.length}</p>
            <p><strong>Pyramid Levels:</strong> {pyramid?.levels?.length || 0}</p>
          </div>

          {chapters.length > 0 && (
            <div className="chapters-list">
              <h4>Chapters</h4>
              <div className="chapters-scroll">
                {chapters.map((chapter, i) => (
                  <div
                    key={i}
                    className="chapter-item"
                    onClick={() => {
                      createBuffer(
                        chapter.title || `Chapter ${chapter.chapterNumber}`,
                        chapter.content,
                        {
                          type: 'chapter',
                          metadata: {
                            bookTitle: title,
                            chapterNumber: chapter.chapterNumber,
                            nodeId,
                          },
                        }
                      );
                    }}
                  >
                    <strong>Chapter {chapter.chapterNumber}</strong>
                    {chapter.title && <span>: {chapter.title}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pyramid && (
            <div className="pyramid-summary">
              <h4>Pyramid Summary</h4>
              <p className="summary-text">{pyramid.summary}</p>
            </div>
          )}

          <div className="tool-actions">
            <button
              className="btn btn-primary"
              onClick={() => setShowCurator(true)}
            >
              💬 Chat with AI Curator
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setNodeId(null);
                setChapters([]);
                setPyramid(null);
                setStatus('');
                setBookId('');
                setTitle('');
              }}
            >
              Import Another Book
            </button>
          </div>

          {showCurator && (
            <div className="curator-section">
              <div className="curator-header">
                <h4>💬 AI Curator</h4>
                <button
                  className="btn btn-sm"
                  onClick={() => setShowCurator(false)}
                >
                  ✕
                </button>
              </div>

              <div className="chat-messages-container">
                {chatMessages.length === 0 && !streamingMessage && (
                  <div className="chat-welcome">
                    <p>Ask me anything about <strong>{title}</strong></p>
                    <div className="chat-suggestions">
                      <button
                        className="suggestion-chip"
                        onClick={() => setChatInput('What are the main themes of this book?')}
                      >
                        Main themes
                      </button>
                      <button
                        className="suggestion-chip"
                        onClick={() => setChatInput('Summarize the key events')}
                      >
                        Key events
                      </button>
                      <button
                        className="suggestion-chip"
                        onClick={() => setChatInput('Who are the main characters?')}
                      >
                        Characters
                      </button>
                    </div>
                  </div>
                )}

                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-message chat-message-${msg.role}`}>
                    <div className="message-role">
                      {msg.role === 'user' ? '👤' : '🤖'}
                    </div>
                    <div className="message-content">
                      {msg.content}
                    </div>
                  </div>
                ))}

                {streamingMessage && (
                  <div className="chat-message chat-message-assistant streaming">
                    <div className="message-role">🤖</div>
                    <div className="message-content">
                      {streamingMessage}
                      <span className="streaming-cursor">▊</span>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              <div className="chat-input-container">
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Ask about the book..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={isStreaming}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isStreaming}
                >
                  {isStreaming ? '⋯' : '→'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
