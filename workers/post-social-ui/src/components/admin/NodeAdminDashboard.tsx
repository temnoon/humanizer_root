/**
 * Node Admin Dashboard
 *
 * Admin interface for managing nodes:
 * - View node health across all nodes
 * - Inspect pyramid stats
 * - Rebuild nodes from source
 * - Quick fixes (apex, embeddings)
 * - Test curator prompts
 */

import { createSignal, createResource, For, Show, onMount } from 'solid-js';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../ui/Toast';
import {
  nodeAdminService,
  type NodeHealth,
  type PyramidStats,
  type RebuildConfig,
  type RebuildStatus,
} from '../../services/node-admin';
import './NodeAdminDashboard.css';

export default function NodeAdminDashboard() {
  const authStore = useAuthStore();

  // State
  const [selectedNodeId, setSelectedNodeId] = createSignal<string | null>(null);
  const [rebuildConfig, setRebuildConfig] = createSignal<Partial<RebuildConfig>>({
    sourceType: 'gutenberg',
    rebuildOptions: {
      deleteExisting: true,
      rebuildChunks: true,
      rebuildSummaries: true,
      rebuildApex: true,
      rebuildEmbeddings: true,
    },
  });
  const [activeTab, setActiveTab] = createSignal<'health' | 'pyramid' | 'rebuild' | 'prompt'>('health');
  const [rebuildStatusMap, setRebuildStatusMap] = createSignal<Record<string, RebuildStatus>>({});

  // Resources
  const [allNodesHealth, { refetch: refetchHealth }] = createResource(
    () => authStore.isAuthenticated(),
    async (isAuth) => {
      if (!isAuth) return null;
      const token = authStore.token();
      if (!token) return null;

      try {
        return await nodeAdminService.getAllNodesHealth(token);
      } catch (error) {
        console.error('Failed to get nodes health:', error);
        return null;
      }
    }
  );

  const [selectedNodeStats, { refetch: refetchStats }] = createResource(
    selectedNodeId,
    async (nodeId) => {
      if (!nodeId) return null;
      const token = authStore.token();
      if (!token) return null;

      try {
        return await nodeAdminService.getNodePyramidStats(nodeId, token);
      } catch (error) {
        console.error('Failed to get pyramid stats:', error);
        return null;
      }
    }
  );

  const [curatorPrompt, { refetch: refetchPrompt }] = createResource(
    selectedNodeId,
    async (nodeId) => {
      if (!nodeId || activeTab() !== 'prompt') return null;
      const token = authStore.token();
      if (!token) return null;

      try {
        return await nodeAdminService.getCuratorPrompt(nodeId, token);
      } catch (error) {
        console.error('Failed to get curator prompt:', error);
        return null;
      }
    }
  );

  // Poll rebuild status when rebuilding
  onMount(() => {
    const pollInterval = setInterval(async () => {
      const token = authStore.token();
      if (!token) return;

      // Check rebuild status for nodes that are rebuilding
      for (const [nodeId, status] of Object.entries(rebuildStatusMap())) {
        if (status.status === 'running') {
          try {
            const newStatus = await nodeAdminService.getRebuildStatus(nodeId, token);
            setRebuildStatusMap(prev => ({
              ...prev,
              [nodeId]: newStatus,
            }));

            // Refresh health when complete
            if (newStatus.status === 'completed' || newStatus.status === 'failed') {
              refetchHealth();
              refetchStats();
            }
          } catch (error) {
            console.error(`Failed to poll rebuild status for ${nodeId}:`, error);
          }
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  });

  // Handlers
  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setActiveTab('health');
  };

  const handleRebuild = async (nodeId: string) => {
    const token = authStore.token();
    if (!token) return;

    try {
      const config = rebuildConfig() as RebuildConfig;
      await nodeAdminService.rebuildNode(nodeId, config, token);

      // Mark as rebuilding
      setRebuildStatusMap(prev => ({
        ...prev,
        [nodeId]: {
          nodeId,
          status: 'running',
          startedAt: Date.now(),
        },
      }));

      toast.success('Rebuild started! Check status in a few moments.');
    } catch (error) {
      console.error('Failed to start rebuild:', error);
      toast.error(`Rebuild failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleQuickFixApex = async (nodeId: string) => {
    const token = authStore.token();
    if (!token) return;

    try {
      await nodeAdminService.rebuildApex(nodeId, token);
      toast.success('Apex rebuild started!');
      refetchHealth();
    } catch (error) {
      console.error('Failed to rebuild apex:', error);
      toast.error(`Apex rebuild failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleQuickFixEmbeddings = async (nodeId: string) => {
    const token = authStore.token();
    if (!token) return;

    try {
      await nodeAdminService.rebuildEmbeddings(nodeId, token);
      toast.success('Embedding rebuild started!');
      refetchHealth();
    } catch (error) {
      console.error('Failed to rebuild embeddings:', error);
      toast.error(`Embedding rebuild failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div class="node-admin-dashboard">
      <header class="admin-header">
        <h1>⚙️ Node Administration</h1>
        <button class="btn-refresh" onClick={() => refetchHealth()}>
          🔄 Refresh
        </button>
      </header>

      <div class="admin-layout">
        {/* Left Panel: Node List */}
        <div class="node-list-panel">
          <h2>Nodes ({allNodesHealth()?.total || 0})</h2>

          <div class="health-summary">
            <div class="health-stat healthy">
              ✅ Healthy: {allNodesHealth()?.healthy || 0}
            </div>
            <div class="health-stat unhealthy">
              ⚠️ Issues: {allNodesHealth()?.unhealthy || 0}
            </div>
          </div>

          <div class="node-list">
            <Show when={allNodesHealth()}>
              <For each={allNodesHealth()!.nodes}>
                {(node) => (
                  <div
                    class={`node-card ${selectedNodeId() === node.nodeId ? 'selected' : ''} ${node.issues.length > 0 ? 'has-issues' : ''}`}
                    onClick={() => handleSelectNode(node.nodeId)}
                  >
                    <div class="node-card-header">
                      <span class="node-name">{node.nodeName}</span>
                      {node.issues.length > 0 && (
                        <span class="issue-badge">{node.issues.length}</span>
                      )}
                    </div>

                    <div class="node-card-stats">
                      <span class={node.hasChunks ? 'stat-ok' : 'stat-missing'}>
                        {node.hasChunks ? '✓' : '✗'} Chunks ({node.chunkCount})
                      </span>
                      <span class={node.hasSummaries ? 'stat-ok' : 'stat-missing'}>
                        {node.hasSummaries ? '✓' : '✗'} Summaries
                      </span>
                      <span class={node.hasApex ? 'stat-ok' : 'stat-missing'}>
                        {node.hasApex ? '✓' : '✗'} Apex
                      </span>
                      <span class={node.hasEmbeddings ? 'stat-ok' : 'stat-missing'}>
                        {node.hasEmbeddings ? '✓' : '✗'} Embeddings
                      </span>
                    </div>

                    {rebuildStatusMap()[node.nodeId]?.status === 'running' && (
                      <div class="rebuild-progress">
                        🔄 Rebuilding... ({rebuildStatusMap()[node.nodeId].progress?.phase || 'preparing'})
                      </div>
                    )}
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>

        {/* Right Panel: Details */}
        <div class="node-details-panel">
          <Show
            when={selectedNodeId()}
            fallback={
              <div class="empty-state">
                <p>Select a node to view details</p>
              </div>
            }
          >
            <div class="tabs">
              <button
                class={`tab ${activeTab() === 'health' ? 'active' : ''}`}
                onClick={() => setActiveTab('health')}
              >
                📊 Health
              </button>
              <button
                class={`tab ${activeTab() === 'pyramid' ? 'active' : ''}`}
                onClick={() => setActiveTab('pyramid')}
              >
                🏗️ Pyramid
              </button>
              <button
                class={`tab ${activeTab() === 'rebuild' ? 'active' : ''}`}
                onClick={() => setActiveTab('rebuild')}
              >
                🔧 Rebuild
              </button>
              <button
                class={`tab ${activeTab() === 'prompt' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('prompt');
                  refetchPrompt();
                }}
              >
                💬 Curator Prompt
              </button>
            </div>

            <div class="tab-content">
              {/* Health Tab */}
              <Show when={activeTab() === 'health'}>
                <HealthTab
                  nodeId={selectedNodeId()!}
                  onQuickFixApex={handleQuickFixApex}
                  onQuickFixEmbeddings={handleQuickFixEmbeddings}
                />
              </Show>

              {/* Pyramid Tab */}
              <Show when={activeTab() === 'pyramid'}>
                <PyramidTab stats={selectedNodeStats()} />
              </Show>

              {/* Rebuild Tab */}
              <Show when={activeTab() === 'rebuild'}>
                <RebuildTab
                  nodeId={selectedNodeId()!}
                  config={rebuildConfig()}
                  onConfigChange={setRebuildConfig}
                  onRebuild={handleRebuild}
                  status={rebuildStatusMap()[selectedNodeId()!]}
                />
              </Show>

              {/* Prompt Tab */}
              <Show when={activeTab() === 'prompt'}>
                <PromptTab prompt={curatorPrompt()} />
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Tab Components
// ==========================================

function HealthTab(props: {
  nodeId: string;
  onQuickFixApex: (nodeId: string) => void;
  onQuickFixEmbeddings: (nodeId: string) => void;
}) {
  const authStore = useAuthStore();

  const [nodeHealth] = createResource(
    () => props.nodeId,
    async (nodeId) => {
      const token = authStore.token();
      if (!token) return null;

      try {
        return await nodeAdminService.getNodeHealth(nodeId, token);
      } catch (error) {
        console.error('Failed to get node health:', error);
        return null;
      }
    }
  );

  return (
    <div class="health-tab">
      <Show when={nodeHealth()}>
        <div class="health-section">
          <h3>{nodeHealth()!.nodeName}</h3>

          <div class="health-grid">
            <div class="health-item">
              <span class="label">Chunks:</span>
              <span class={nodeHealth()!.hasChunks ? 'value-ok' : 'value-missing'}>
                {nodeHealth()!.hasChunks ? `✓ ${nodeHealth()!.chunkCount}` : '✗ Missing'}
              </span>
            </div>

            <div class="health-item">
              <span class="label">Summaries:</span>
              <span class={nodeHealth()!.hasSummaries ? 'value-ok' : 'value-missing'}>
                {nodeHealth()!.hasSummaries ? '✓ Yes' : '✗ No'}
              </span>
            </div>

            <div class="health-item">
              <span class="label">Apex:</span>
              <span class={nodeHealth()!.hasApex ? 'value-ok' : 'value-missing'}>
                {nodeHealth()!.hasApex ? '✓ Yes' : '✗ No'}
              </span>
              {!nodeHealth()!.hasApex && (
                <button
                  class="btn-quick-fix"
                  onClick={() => props.onQuickFixApex(props.nodeId)}
                >
                  🔧 Rebuild Apex
                </button>
              )}
            </div>

            <div class="health-item">
              <span class="label">Embeddings:</span>
              <span class={nodeHealth()!.hasEmbeddings ? 'value-ok' : 'value-missing'}>
                {nodeHealth()!.hasEmbeddings ? '✓ Yes' : '✗ No'}
              </span>
              {!nodeHealth()!.hasEmbeddings && (
                <button
                  class="btn-quick-fix"
                  onClick={() => props.onQuickFixEmbeddings(props.nodeId)}
                >
                  🔧 Generate Embeddings
                </button>
              )}
            </div>

            <div class="health-item">
              <span class="label">Pyramid Depth:</span>
              <span class="value-info">{nodeHealth()!.pyramidDepth} levels</span>
            </div>
          </div>

          <Show when={nodeHealth()!.issues.length > 0}>
            <div class="issues-section">
              <h4>⚠️ Issues ({nodeHealth()!.issues.length})</h4>
              <ul class="issues-list">
                <For each={nodeHealth()!.issues}>
                  {(issue) => <li>{issue}</li>}
                </For>
              </ul>
            </div>
          </Show>

          <Show when={nodeHealth()!.recommendations.length > 0}>
            <div class="recommendations-section">
              <h4>💡 Recommendations</h4>
              <ul class="recommendations-list">
                <For each={nodeHealth()!.recommendations}>
                  {(rec) => <li>{rec}</li>}
                </For>
              </ul>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

function PyramidTab(props: { stats: PyramidStats | null | undefined }) {
  return (
    <div class="pyramid-tab">
      <Show when={props.stats}>
        <div class="pyramid-section">
          <h3>Pyramid Statistics</h3>

          <div class="stats-grid">
            <div class="stat-card">
              <span class="stat-label">Total Chunks (L0)</span>
              <span class="stat-value">{props.stats!.stats.chunkCount}</span>
            </div>

            <div class="stat-card">
              <span class="stat-label">Total Summaries</span>
              <span class="stat-value">{props.stats!.stats.summaryCount}</span>
            </div>

            <div class="stat-card">
              <span class="stat-label">Has Apex</span>
              <span class="stat-value">{props.stats!.stats.hasApex ? '✓ Yes' : '✗ No'}</span>
            </div>
          </div>

          <div class="level-counts">
            <h4>Chunks per Level</h4>
            <For each={Object.entries(props.stats!.stats.levelCounts)}>
              {([level, count]) => (
                <div class="level-row">
                  <span class="level-label">Level {level}:</span>
                  <span class="level-count">{count} items</span>
                </div>
              )}
            </For>
          </div>

          <Show when={props.stats!.apex}>
            <div class="apex-section">
              <h4>Apex Summary</h4>

              <div class="apex-info">
                <Show when={props.stats!.apex!.sourceTitle}>
                  <p><strong>Source:</strong> "{props.stats!.apex!.sourceTitle}" {props.stats!.apex!.sourceAuthor ? `by ${props.stats!.apex!.sourceAuthor}` : ''}</p>
                </Show>

                <p><strong>Lifecycle:</strong> {props.stats!.apex!.lifecycleState}</p>

                <div class="apex-field">
                  <strong>The Question:</strong>
                  <p>{props.stats!.apex!.theQuestion}</p>
                </div>

                <div class="apex-field">
                  <strong>Core Themes:</strong>
                  <ul>
                    <For each={props.stats!.apex!.coreThemes}>
                      {(theme) => <li>{theme}</li>}
                    </For>
                  </ul>
                </div>

                <div class="apex-field">
                  <strong>Narrative Arc (excerpt):</strong>
                  <p class="narrative-excerpt">{props.stats!.apex!.narrativeArc}</p>
                </div>

                <Show when={props.stats!.apex!.resonanceHooks.length > 0}>
                  <div class="apex-field">
                    <strong>Resonance Hooks:</strong>
                    <ul>
                      <For each={props.stats!.apex!.resonanceHooks}>
                        {(hook) => <li>{hook}</li>}
                      </For>
                    </ul>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

function RebuildTab(props: {
  nodeId: string;
  config: Partial<RebuildConfig>;
  onConfigChange: (config: Partial<RebuildConfig>) => void;
  onRebuild: (nodeId: string) => void;
  status?: RebuildStatus;
}) {
  return (
    <div class="rebuild-tab">
      <h3>Rebuild Node Pipeline</h3>

      <div class="rebuild-config">
        <div class="config-section">
          <h4>Source Type</h4>
          <select
            value={props.config.sourceType || 'gutenberg'}
            onChange={(e) => props.onConfigChange({
              ...props.config,
              sourceType: e.target.value as any,
            })}
          >
            <option value="gutenberg">Gutenberg Book</option>
            <option value="raw_text">Raw Text</option>
            <option value="existing_chunks">Existing Chunks</option>
          </select>

          <Show when={props.config.sourceType === 'gutenberg'}>
            <input
              type="text"
              placeholder="Gutenberg ID (e.g., 2701 for Moby Dick)"
              value={props.config.sourceId || ''}
              onInput={(e) => props.onConfigChange({
                ...props.config,
                sourceId: e.target.value,
              })}
            />
          </Show>
        </div>

        <div class="config-section">
          <h4>Rebuild Options</h4>

          <label>
            <input
              type="checkbox"
              checked={props.config.rebuildOptions?.deleteExisting ?? true}
              onChange={(e) => props.onConfigChange({
                ...props.config,
                rebuildOptions: {
                  ...props.config.rebuildOptions!,
                  deleteExisting: e.target.checked,
                },
              })}
            />
            Delete existing pyramid first
          </label>

          <label>
            <input
              type="checkbox"
              checked={props.config.rebuildOptions?.rebuildChunks ?? true}
              onChange={(e) => props.onConfigChange({
                ...props.config,
                rebuildOptions: {
                  ...props.config.rebuildOptions!,
                  rebuildChunks: e.target.checked,
                },
              })}
            />
            Rebuild chunks (L0)
          </label>

          <label>
            <input
              type="checkbox"
              checked={props.config.rebuildOptions?.rebuildSummaries ?? true}
              onChange={(e) => props.onConfigChange({
                ...props.config,
                rebuildOptions: {
                  ...props.config.rebuildOptions!,
                  rebuildSummaries: e.target.checked,
                },
              })}
            />
            Rebuild summary pyramid (L1+)
          </label>

          <label>
            <input
              type="checkbox"
              checked={props.config.rebuildOptions?.rebuildApex ?? true}
              onChange={(e) => props.onConfigChange({
                ...props.config,
                rebuildOptions: {
                  ...props.config.rebuildOptions!,
                  rebuildApex: e.target.checked,
                },
              })}
            />
            Rebuild apex summary
          </label>

          <label>
            <input
              type="checkbox"
              checked={props.config.rebuildOptions?.rebuildEmbeddings ?? true}
              onChange={(e) => props.onConfigChange({
                ...props.config,
                rebuildOptions: {
                  ...props.config.rebuildOptions!,
                  rebuildEmbeddings: e.target.checked,
                },
              })}
            />
            Generate embeddings
          </label>
        </div>

        <button
          class="btn-rebuild"
          onClick={() => props.onRebuild(props.nodeId)}
          disabled={props.status?.status === 'running'}
        >
          {props.status?.status === 'running' ? '🔄 Rebuilding...' : '🔧 Start Rebuild'}
        </button>
      </div>

      <Show when={props.status && props.status.status !== 'idle'}>
        <div class="rebuild-status">
          <h4>Rebuild Status</h4>

          <div class="status-info">
            <p><strong>Status:</strong> {props.status!.status}</p>
            <Show when={props.status!.phase}>
              <p><strong>Phase:</strong> {props.status!.phase}</p>
            </Show>
            <Show when={props.status!.progress}>
              <p>
                <strong>Progress:</strong> {props.status!.progress!.itemsProcessed} / {props.status!.progress!.itemsTotal}
              </p>
            </Show>
          </div>

          <Show when={props.status!.result}>
            <div class="rebuild-result">
              <h5>{props.status!.result!.success ? '✅ Success' : '❌ Failed'}</h5>

              <Show when={props.status!.result!.error}>
                <p class="error-message">{props.status!.result!.error}</p>
              </Show>

              <Show when={props.status!.result!.success}>
                <div class="result-stats">
                  <p>Chunks created: {props.status!.result!.stats.chunksCreated}</p>
                  <p>Summaries created: {props.status!.result!.stats.summariesCreated}</p>
                  <p>Apex created: {props.status!.result!.stats.apexCreated ? 'Yes' : 'No'}</p>
                  <p>Embeddings created: {props.status!.result!.stats.embeddingsCreated}</p>
                  <p>Processing time: {(props.status!.result!.stats.processingTimeMs / 1000).toFixed(1)}s</p>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

function PromptTab(props: { prompt: any }) {
  return (
    <div class="prompt-tab">
      <Show when={props.prompt}>
        <div class="prompt-section">
          <h3>Curator System Prompt</h3>

          <div class="prompt-stats">
            <span>Characters: {props.prompt.characterCount}</span>
            <span>Words: {props.prompt.wordCount}</span>
          </div>

          <pre class="prompt-content">{props.prompt.prompt}</pre>
        </div>
      </Show>
    </div>
  );
}
