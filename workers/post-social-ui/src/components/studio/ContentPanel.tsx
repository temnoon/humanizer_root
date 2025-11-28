/**
 * Content Panel - Center Panel for Studio-First Interface
 * 
 * The FOCUS panel - displays content based on current mode:
 * - Welcome: Initial landing state
 * - Node List: Browse all nodes grid
 * - Node Detail: Single node with its narratives
 * - Narrative: Read a narrative with versions
 * - Editor: Create/edit a narrative
 * - Compare: Version diff view
 * - Search Results: Semantic search results
 */

import { Component, Show, createResource, createSignal, For, createEffect } from 'solid-js';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import { AdminPanel } from './AdminPanel';
import { SynthesisDashboard } from './SynthesisDashboard';
import { CommentSection } from './CommentSection';
import type { CenterMode } from './NavigationPanel';
import type { Node, Narrative, NarrativeVersion, VersionComparison } from '@/types/models';

interface ContentPanelProps {
  mode: CenterMode;
  onModeChange: (mode: CenterMode) => void;
  onNarrativeSelect?: (narrative: Narrative) => void;
}

export const ContentPanel: Component<ContentPanelProps> = (props) => {
  return (
    <div class="content-panel">
      {/* Welcome Mode */}
      <Show when={props.mode.type === 'welcome'}>
        <WelcomeView onBrowse={() => props.onModeChange({ type: 'node-list' })} />
      </Show>
      
      {/* Node List Mode */}
      <Show when={props.mode.type === 'node-list'}>
        <NodeListView 
          onNodeSelect={(node) => props.onModeChange({ 
            type: 'node-detail', 
            nodeId: node.id, 
            nodeSlug: node.slug 
          })}
        />
      </Show>
      
      {/* Node Detail Mode */}
      <Show when={props.mode.type === 'node-detail'}>
        {(() => {
          const mode = props.mode as { type: 'node-detail'; nodeId: string; nodeSlug: string };
          return (
            <NodeDetailView 
              nodeSlug={mode.nodeSlug}
              onNarrativeSelect={(narrative) => props.onModeChange({
                type: 'narrative',
                nodeSlug: mode.nodeSlug,
                narrativeSlug: narrative.slug
              })}
              onBack={() => props.onModeChange({ type: 'node-list' })}
            />
          );
        })()}
      </Show>
      
      {/* Narrative Mode */}
      <Show when={props.mode.type === 'narrative'}>
        {(() => {
          const mode = props.mode as { type: 'narrative'; nodeSlug: string; narrativeSlug: string; version?: number };
          return (
            <NarrativeView
              nodeSlug={mode.nodeSlug}
              narrativeSlug={mode.narrativeSlug}
              version={mode.version}
              onVersionChange={(v) => props.onModeChange({
                ...mode,
                version: v
              })}
              onCompare={(from, to) => props.onModeChange({
                type: 'compare',
                nodeSlug: mode.nodeSlug,
                narrativeSlug: mode.narrativeSlug,
                fromVersion: from,
                toVersion: to
              })}
              onBack={() => props.onModeChange({
                type: 'node-detail',
                nodeId: '',
                nodeSlug: mode.nodeSlug
              })}
              onSelect={props.onNarrativeSelect}
            />
          );
        })()}
      </Show>
      
      {/* Compare Mode */}
      <Show when={props.mode.type === 'compare'}>
        {(() => {
          const mode = props.mode as { type: 'compare'; nodeSlug: string; narrativeSlug: string; fromVersion: number; toVersion: number };
          return (
            <CompareView
              nodeSlug={mode.nodeSlug}
              narrativeSlug={mode.narrativeSlug}
              fromVersion={mode.fromVersion}
              toVersion={mode.toVersion}
              onBack={() => props.onModeChange({
                type: 'narrative',
                nodeSlug: mode.nodeSlug,
                narrativeSlug: mode.narrativeSlug
              })}
            />
          );
        })()}
      </Show>
      
      {/* Editor Mode */}
      <Show when={props.mode.type === 'editor'}>
        <EditorPlaceholder />
      </Show>
      
      {/* Search Results */}
      <Show when={props.mode.type === 'search-results'}>
        {(() => {
          const mode = props.mode as { type: 'search-results'; query: string };
          return <SearchResultsView query={mode.query} />;
        })()}
      </Show>
      
      {/* Admin Mode */}
      <Show when={props.mode.type === 'admin'}>
        <AdminView onModeChange={props.onModeChange} />
      </Show>

      {/* Synthesis Mode - Phase 5 */}
      <Show when={props.mode.type === 'synthesis'}>
        <SynthesisView onModeChange={props.onModeChange} />
      </Show>
    </div>
  );
};

// Welcome View - Initial state
const WelcomeView: Component<{ onBrowse: () => void }> = (props) => {
  return (
    <div class="content-welcome">
      <h1>Welcome to <span class="accent">post-social</span></h1>
      <p>A space for evolving narratives and thoughtful discourse.</p>
      <div class="welcome-actions">
        <button class="btn-primary" onClick={props.onBrowse}>
          Browse Nodes
        </button>
        <p class="welcome-hint">
          Or select a subscribed node from the left panel.
        </p>
      </div>
    </div>
  );
};

// Node List View - Grid of all nodes
const NodeListView: Component<{ onNodeSelect: (node: Node) => void }> = (props) => {
  const [nodes] = createResource(async () => {
    try {
      return await nodesService.listNodes();
    } catch (err) {
      console.error('Failed to load nodes:', err);
      return [];
    }
  });
  
  return (
    <div class="content-node-list">
      <h2>Browse Nodes</h2>
      <Show
        when={!nodes.loading}
        fallback={<div class="content-loading">Loading nodes...</div>}
      >
        <div class="nodes-grid">
          <For each={nodes()}>
            {(node) => (
              <div class="node-card" onClick={() => props.onNodeSelect(node)}>
                <h3 class="node-card-title">{node.name}</h3>
                <p class="node-card-description">{node.description}</p>
                <div class="node-card-meta">
                  <span>{node.narrativeCount || 0} narratives</span>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

// Node Detail View - Single node with narratives
const NodeDetailView: Component<{
  nodeSlug: string;
  onNarrativeSelect: (narrative: Narrative) => void;
  onBack: () => void;
}> = (props) => {
  const [node] = createResource(
    () => props.nodeSlug,
    async (slug) => {
      try {
        return await nodesService.getNode(slug, authStore.token() || undefined);
      } catch (err) {
        console.error('Failed to load node:', err);
        return null;
      }
    }
  );
  
  return (
    <div class="content-node-detail">
      <button class="back-link" onClick={props.onBack}>← Back to Nodes</button>
      
      <Show when={!node.loading && node()}>
        <div class="node-header">
          <h2>{node()!.name}</h2>
          <p class="node-description">{node()!.description}</p>
        </div>
        
        <div class="narratives-section">
          <h3>Narratives</h3>
          <Show
            when={node()!.narratives?.length}
            fallback={<p class="empty-state">No narratives published yet.</p>}
          >
            <div class="narratives-list">
              <For each={node()!.narratives}>
                {(narrative) => (
                  <div 
                    class="narrative-card"
                    onClick={() => props.onNarrativeSelect(narrative)}
                  >
                    <div class="narrative-card-header">
                      <h4>{narrative.title}</h4>
                      <span class="version-indicator">v{narrative.currentVersion}</span>
                    </div>
                    <Show when={narrative.metadata?.tags?.length}>
                      <div class="narrative-tags">
                        <For each={narrative.metadata.tags?.slice(0, 3)}>
                          {(tag) => <span class="tag">{tag}</span>}
                        </For>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

// Narrative View - Read a narrative with comments
const NarrativeView: Component<{
  nodeSlug: string;
  narrativeSlug: string;
  version?: number;
  onVersionChange: (version: number) => void;
  onCompare: (from: number, to: number) => void;
  onBack: () => void;
  onSelect?: (narrative: Narrative) => void;
}> = (props) => {
  // Fetch the node to check ownership
  const [node] = createResource(
    () => props.nodeSlug,
    async (slug) => {
      try {
        return await nodesService.getNode(slug, authStore.token() || undefined);
      } catch (err) {
        console.error('Failed to load node:', err);
        return null;
      }
    }
  );

  const [narrative] = createResource(
    () => ({ nodeSlug: props.nodeSlug, narrativeSlug: props.narrativeSlug }),
    async ({ nodeSlug, narrativeSlug }) => {
      try {
        return await nodesService.getNarrativeBySlug(nodeSlug, narrativeSlug);
      } catch (err) {
        console.error('Failed to load narrative:', err);
        return null;
      }
    }
  );

  const [versions] = createResource(
    () => narrative()?.id,
    async (narrativeId) => {
      if (!narrativeId) return [];
      try {
        return await nodesService.listVersions(narrativeId);
      } catch (err) {
        console.error('Failed to load versions:', err);
        return [];
      }
    }
  );

  // Get current version content
  const currentVersion = () => props.version || narrative()?.currentVersion || 1;

  const [versionContent] = createResource(
    () => ({ narrativeId: narrative()?.id, version: currentVersion() }),
    async ({ narrativeId, version }) => {
      if (!narrativeId) return null;
      try {
        return await nodesService.getVersion(narrativeId, version);
      } catch (err) {
        console.error('Failed to load version:', err);
        return null;
      }
    }
  );

  // Check if current user is the node owner
  const isOwner = () => {
    const currentUserId = authStore.user()?.id;
    const nodeData = node();
    return !!(currentUserId && nodeData?.creatorUserId === currentUserId);
  };

  // Notify parent when narrative loads (for context panel)
  createEffect(() => {
    const n = narrative();
    if (n && props.onSelect) {
      props.onSelect(n);
    }
  });

  return (
    <div class="content-narrative">
      <button class="back-link" onClick={props.onBack}>← Back to Node</button>

      <Show when={!narrative.loading && narrative()}>
        <article class="narrative-article">
          <header class="narrative-header">
            <h1>{narrative()!.title}</h1>
            <div class="narrative-meta">
              <span class="node-link">{props.nodeSlug}</span>
              <span class="version-info">Version {currentVersion()}</span>
            </div>

            <Show when={narrative()!.metadata?.tags?.length}>
              <div class="narrative-tags">
                <For each={narrative()!.metadata.tags}>
                  {(tag) => <span class="tag">{tag}</span>}
                </For>
              </div>
            </Show>
          </header>

          {/* Version Selector */}
          <Show when={versions()?.length && versions()!.length > 1}>
            <div class="version-selector">
              <span class="label">Versions:</span>
              <For each={versions()}>
                {(v) => (
                  <button
                    class={`version-btn ${v.version === currentVersion() ? 'active' : ''}`}
                    onClick={() => props.onVersionChange(v.version)}
                  >
                    v{v.version}
                  </button>
                )}
              </For>
              <button
                class="compare-link"
                onClick={() => props.onCompare(1, narrative()!.currentVersion)}
              >
                Compare versions
              </button>
            </div>
          </Show>

          {/* Content */}
          <div class="narrative-body">
            <Show
              when={!versionContent.loading && versionContent()}
              fallback={<div class="content-loading">Loading content...</div>}
            >
              <MarkdownRenderer content={versionContent()!.content} />
            </Show>
          </div>

          {/* Comments Section */}
          <Show when={narrative()}>
            <CommentSection
              narrative={{
                ...narrative()!,
                content: versionContent()?.content || narrative()!.content || ''
              }}
              isOwner={isOwner()}
            />
          </Show>
        </article>
      </Show>
    </div>
  );
};

// Compare View - Version diff
const CompareView: Component<{
  nodeSlug: string;
  narrativeSlug: string;
  fromVersion: number;
  toVersion: number;
  onBack: () => void;
}> = (props) => {
  const [diffFormat, setDiffFormat] = createSignal<'structured' | 'unified' | 'side-by-side'>('structured');
  
  const [narrative] = createResource(
    () => ({ nodeSlug: props.nodeSlug, narrativeSlug: props.narrativeSlug }),
    async ({ nodeSlug, narrativeSlug }) => {
      try {
        return await nodesService.getNarrativeBySlug(nodeSlug, narrativeSlug);
      } catch (err) {
        return null;
      }
    }
  );
  
  const [comparison] = createResource(
    () => ({ narrativeId: narrative()?.id, from: props.fromVersion, to: props.toVersion, format: diffFormat() }),
    async ({ narrativeId, from, to, format }) => {
      if (!narrativeId) return null;
      try {
        return await nodesService.compareVersions(narrativeId, from, to, format);
      } catch (err) {
        console.error('Failed to compare versions:', err);
        return null;
      }
    }
  );
  
  return (
    <div class="content-compare">
      <button class="back-link" onClick={props.onBack}>← Back to Narrative</button>
      
      <h2>Version Comparison</h2>
      
      <Show when={comparison()}>
        <div class="compare-header">
          <div class="version-badges">
            <span class="version-badge from">v{props.fromVersion}</span>
            <span class="arrow">→</span>
            <span class="version-badge to">v{props.toVersion}</span>
          </div>
          
          <div class="compare-stats">
            <div class="stat">
              <span class="stat-label">Semantic Shift</span>
              <span class="stat-value">{Math.round((comparison()!.diff.semanticShift || 0) * 100)}%</span>
            </div>
            <div class="stat">
              <span class="stat-label">Added</span>
              <span class="stat-value added">+{comparison()!.diff.addedLines}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Removed</span>
              <span class="stat-value removed">-{comparison()!.diff.removedLines}</span>
            </div>
          </div>
        </div>
        
        {/* Format Toggle */}
        <div class="format-toggle">
          <button 
            class={diffFormat() === 'structured' ? 'active' : ''}
            onClick={() => setDiffFormat('structured')}
          >
            Structured
          </button>
          <button 
            class={diffFormat() === 'unified' ? 'active' : ''}
            onClick={() => setDiffFormat('unified')}
          >
            Unified
          </button>
          <button 
            class={diffFormat() === 'side-by-side' ? 'active' : ''}
            onClick={() => setDiffFormat('side-by-side')}
          >
            Side by Side
          </button>
        </div>
        
        {/* Diff View */}
        <div class="diff-container">
          <Show when={diffFormat() === 'structured' && comparison()!.diff.lines}>
            <div class="structured-diff">
              <For each={comparison()!.diff.lines}>
                {(line) => (
                  <div class={`diff-line ${line.type}`}>
                    <span class="line-prefix">
                      {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                    </span>
                    <span class="line-content">{line.content}</span>
                  </div>
                )}
              </For>
            </div>
          </Show>
          
          <Show when={diffFormat() === 'unified' && comparison()!.diff.unified}>
            <pre class="unified-diff">{comparison()!.diff.unified}</pre>
          </Show>
          
          <Show when={diffFormat() === 'side-by-side' && comparison()!.diff.sideBySide}>
            <div class="side-by-side-diff">
              <div class="side-header">
                <span>Previous (v{props.fromVersion})</span>
                <span>Current (v{props.toVersion})</span>
              </div>
              <For each={comparison()!.diff.sideBySide}>
                {(row) => (
                  <div class="side-row">
                    <div class={`side-cell ${row.left?.type || 'empty'}`}>
                      {row.left?.content || ''}
                    </div>
                    <div class={`side-cell ${row.right?.type || 'empty'}`}>
                      {row.right?.content || ''}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

// Editor Placeholder - Will integrate EditorPanel
const EditorPlaceholder: Component = () => {
  return (
    <div class="content-editor-placeholder">
      <p>Editor mode - Use the full editor in the right panel configuration.</p>
    </div>
  );
};

// Search Results View
const SearchResultsView: Component<{ query: string }> = (props) => {
  // TODO: Implement semantic search
  return (
    <div class="content-search">
      <h2>Search Results</h2>
      <p class="search-query">Results for: "{props.query}"</p>
      <div class="search-placeholder">
        <p>Semantic search coming soon.</p>
        <p class="hint">Will search across all narratives using vector embeddings.</p>
      </div>
    </div>
  );
};

// Admin View - Node Management
const AdminView: Component<{ onModeChange: (mode: CenterMode) => void }> = (props) => {
  return (
    <div class="content-admin">
      <AdminPanel
        onNodeCreated={(node) => {
          // Navigate to the new node
          props.onModeChange({
            type: 'node-detail',
            nodeId: node.id,
            nodeSlug: node.slug
          });
        }}
        onNodeSelected={(node) => {
          props.onModeChange({
            type: 'node-detail',
            nodeId: node.id,
            nodeSlug: node.slug
          });
        }}
      />
    </div>
  );
};

// Synthesis View - Phase 5: Review and apply AI syntheses
const SynthesisView: Component<{ onModeChange: (mode: CenterMode) => void }> = (props) => {
  return (
    <div class="content-synthesis">
      <SynthesisDashboard
        onSynthesisApplied={(narrativeId, newVersion) => {
          console.log(`Synthesis applied: ${narrativeId} v${newVersion}`);
          // Could navigate to the narrative here
        }}
        onNavigateToNarrative={(nodeSlug, narrativeSlug) => {
          props.onModeChange({
            type: 'narrative',
            nodeSlug,
            narrativeSlug
          });
        }}
      />
    </div>
  );
};
