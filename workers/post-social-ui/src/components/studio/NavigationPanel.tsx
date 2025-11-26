/**
 * Navigation Panel - Primary Left Panel for Studio-First Interface
 * 
 * The FIND panel - everything is findable from here:
 * - My Archive (personal content)
 * - Subscribed Nodes (VAX Notes style with unread counts)
 * - Browse All Nodes
 * - Semantic Search
 * - Recent Items
 * 
 * Clicking items sets the center panel mode and content.
 */

import { Component, createSignal, createResource, Show, For } from 'solid-js';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import { GutenbergBrowser } from './GutenbergBrowser';
import type { Node, Narrative, NodeSubscription } from '@/types/models';
import type { GutenbergBook } from '@/services/gutenberg';

// Navigation sections
type NavSection = 'subscribed' | 'browse' | 'search' | 'recent' | 'archive';

// What the center panel should show
export type CenterMode = 
  | { type: 'welcome' }
  | { type: 'node-list' }
  | { type: 'node-detail'; nodeId: string; nodeSlug: string }
  | { type: 'narrative'; nodeSlug: string; narrativeSlug: string; version?: number }
  | { type: 'editor'; nodeId?: string }
  | { type: 'compare'; nodeSlug: string; narrativeSlug: string; fromVersion: number; toVersion: number }
  | { type: 'search-results'; query: string }
  | { type: 'admin' };

interface BookSource {
  bookTitle: string;
  author: string;
  chapter?: string;
}

interface NavigationPanelProps {
  currentMode: CenterMode;
  onModeChange: (mode: CenterMode) => void;
  onCreateNew: () => void;
  onImportFromGutenberg?: (content: string, title: string, source: BookSource) => void;
}

// Helper to format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// Archive sub-tabs
type ArchiveSubTab = 'my-archive' | 'gutenberg';

export const NavigationPanel: Component<NavigationPanelProps> = (props) => {
  const [activeSection, setActiveSection] = createSignal<NavSection>('subscribed');
  const [archiveSubTab, setArchiveSubTab] = createSignal<ArchiveSubTab>('gutenberg');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [expandedNodes, setExpandedNodes] = createSignal<Set<string>>(new Set());
  
  // Fetch subscriptions
  const [subscriptions, { refetch: refetchSubs }] = createResource(
    () => authStore.token(),
    async (token) => {
      if (!token) return [];
      try {
        return await nodesService.getSubscriptions(token);
      } catch (err) {
        console.error('Failed to load subscriptions:', err);
        return [];
      }
    }
  );
  
  // Fetch all nodes (for browse)
  const [allNodes] = createResource(
    () => activeSection() === 'browse',
    async (shouldFetch) => {
      if (!shouldFetch) return [];
      try {
        return await nodesService.listNodes();
      } catch (err) {
        console.error('Failed to load nodes:', err);
        return [];
      }
    }
  );
  
  // Total unread count
  const totalUnread = () => {
    const subs = subscriptions();
    if (!subs) return 0;
    return subs.reduce((sum, sub) => sum + sub.unreadCount, 0);
  };
  
  // Toggle node expansion (load narratives)
  const toggleNodeExpand = async (nodeId: string, nodeSlug: string) => {
    const expanded = new Set(expandedNodes());
    if (expanded.has(nodeId)) {
      expanded.delete(nodeId);
    } else {
      expanded.add(nodeId);
      // Set mode to show node detail
      props.onModeChange({ type: 'node-detail', nodeId, nodeSlug });
    }
    setExpandedNodes(expanded);
  };
  
  // Handle narrative click
  const handleNarrativeClick = (nodeSlug: string, narrativeSlug: string) => {
    props.onModeChange({ type: 'narrative', nodeSlug, narrativeSlug });
  };
  
  // Handle search
  const handleSearch = (e: Event) => {
    e.preventDefault();
    const query = searchQuery().trim();
    if (query) {
      props.onModeChange({ type: 'search-results', query });
    }
  };
  
  // Mark node as read
  const handleMarkRead = async (nodeId: string, e: Event) => {
    e.stopPropagation();
    const token = authStore.token();
    if (!token) return;
    await nodesService.markRead(nodeId, token);
    refetchSubs();
  };
  
  return (
    <div class="nav-panel">
      {/* Search Bar */}
      <div class="nav-search">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search narratives..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="nav-search-input"
          />
        </form>
      </div>
      
      {/* Create Button */}
      <button class="nav-create-btn" onClick={props.onCreateNew}>
        ✏️ New Narrative
      </button>
      
      {/* Section Tabs */}
      <div class="nav-tabs">
        <button
          class={`nav-tab ${activeSection() === 'subscribed' ? 'active' : ''}`}
          onClick={() => setActiveSection('subscribed')}
        >
          🔔 Subscribed
          <Show when={totalUnread() > 0}>
            <span class="unread-badge">{totalUnread()}</span>
          </Show>
        </button>
        <button
          class={`nav-tab ${activeSection() === 'browse' ? 'active' : ''}`}
          onClick={() => {
            setActiveSection('browse');
            props.onModeChange({ type: 'node-list' });
          }}
        >
          🌐 Browse
        </button>
        <button
          class={`nav-tab ${activeSection() === 'archive' ? 'active' : ''}`}
          onClick={() => setActiveSection('archive')}
        >
          📚 Archive
        </button>
      </div>
      
      {/* Section Content */}
      <div class="nav-content">
        {/* Subscribed Section */}
        <Show when={activeSection() === 'subscribed'}>
          <div class="nav-section">
            <Show
              when={!subscriptions.loading}
              fallback={<div class="nav-loading">Loading...</div>}
            >
              <Show
                when={subscriptions()?.length}
                fallback={
                  <div class="nav-empty">
                    <p>No subscriptions yet.</p>
                    <button 
                      class="nav-link-btn"
                      onClick={() => {
                        setActiveSection('browse');
                        props.onModeChange({ type: 'node-list' });
                      }}
                    >
                      Browse Nodes →
                    </button>
                  </div>
                }
              >
                <For each={subscriptions()}>
                  {(sub) => (
                    <SubscribedNodeItem
                      subscription={sub}
                      isExpanded={expandedNodes().has(sub.nodeId)}
                      onToggle={() => toggleNodeExpand(sub.nodeId, sub.nodeSlug || '')}
                      onNarrativeClick={handleNarrativeClick}
                      onMarkRead={(e) => handleMarkRead(sub.nodeId, e)}
                    />
                  )}
                </For>
              </Show>
            </Show>
          </div>
        </Show>
        
        {/* Browse Section */}
        <Show when={activeSection() === 'browse'}>
          <div class="nav-section">
            <Show
              when={!allNodes.loading}
              fallback={<div class="nav-loading">Loading nodes...</div>}
            >
              <For each={allNodes()}>
                {(node) => (
                  <BrowseNodeItem
                    node={node}
                    isExpanded={expandedNodes().has(node.id)}
                    onToggle={() => toggleNodeExpand(node.id, node.slug)}
                    onNarrativeClick={handleNarrativeClick}
                  />
                )}
              </For>
            </Show>
          </div>
        </Show>
        
        {/* Archive Section */}
        <Show when={activeSection() === 'archive'}>
          <div class="nav-section archive-section">
            {/* Archive Sub-tabs */}
            <div class="archive-subtabs">
              <button
                class={`archive-subtab ${archiveSubTab() === 'my-archive' ? 'active' : ''}`}
                onClick={() => setArchiveSubTab('my-archive')}
              >
                📁 My Archive
              </button>
              <button
                class={`archive-subtab ${archiveSubTab() === 'gutenberg' ? 'active' : ''}`}
                onClick={() => setArchiveSubTab('gutenberg')}
              >
                📚 Gutenberg
              </button>
            </div>

            {/* My Archive Content */}
            <Show when={archiveSubTab() === 'my-archive'}>
              <div class="archive-content">
                <div class="nav-empty">
                  <p>Personal archive coming soon.</p>
                  <p class="nav-hint">Import conversations, notes, and bookmarks.</p>
                </div>
              </div>
            </Show>

            {/* Gutenberg Browser */}
            <Show when={archiveSubTab() === 'gutenberg'}>
              <div class="archive-content gutenberg-container">
                <GutenbergBrowser
                  onSelectBook={(book: GutenbergBook) => {
                    console.log('Selected book:', book);
                  }}
                  onImport={(content, title, source) => {
                    props.onImportFromGutenberg?.(content, title, source);
                  }}
                />
              </div>
            </Show>
          </div>
        </Show>
      </div>
      
      {/* Admin Section */}
      <div class="nav-admin-section">
        <button 
          class={`nav-admin-btn ${props.currentMode.type === 'admin' ? 'active' : ''}`}
          onClick={() => props.onModeChange({ type: 'admin' })}
        >
          ⚙️ Manage Nodes
        </button>
      </div>
      
      {/* Footer */}
      <div class="nav-footer">
        <span class="user-email">{authStore.user()?.email}</span>
      </div>
    </div>
  );
};

// Subscribed Node Item with expandable narratives
const SubscribedNodeItem: Component<{
  subscription: NodeSubscription;
  isExpanded: boolean;
  onToggle: () => void;
  onNarrativeClick: (nodeSlug: string, narrativeSlug: string) => void;
  onMarkRead: (e: Event) => void;
}> = (props) => {
  const [node, setNode] = createSignal<Node | null>(null);
  const [loading, setLoading] = createSignal(false);
  
  // Load node details when expanded
  const loadNode = async () => {
    if (node() || loading()) return;
    setLoading(true);
    try {
      const nodeData = await nodesService.getNode(
        props.subscription.nodeSlug || props.subscription.nodeId,
        authStore.token() || undefined
      );
      setNode(nodeData);
    } catch (err) {
      console.error('Failed to load node:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Load when expanded
  if (props.isExpanded && !node()) {
    loadNode();
  }
  
  return (
    <div class="nav-node-item">
      <div class="nav-node-header" onClick={props.onToggle}>
        <span class="expand-icon">{props.isExpanded ? '▼' : '▶'}</span>
        <span class="node-name">{props.subscription.nodeName || 'Unknown'}</span>
        <Show when={props.subscription.unreadCount > 0}>
          <span class="unread-count">[{props.subscription.unreadCount}]</span>
          <button class="mark-read-btn" onClick={props.onMarkRead} title="Mark read">✓</button>
        </Show>
      </div>
      
      <Show when={props.isExpanded}>
        <div class="nav-node-narratives">
          <Show when={loading()}>
            <div class="nav-loading-small">Loading...</div>
          </Show>
          <Show when={!loading() && node()}>
            <Show
              when={node()?.narratives?.length}
              fallback={<div class="nav-empty-small">No narratives yet</div>}
            >
              <For each={node()?.narratives}>
                {(narrative) => (
                  <div
                    class="nav-narrative-item"
                    onClick={() => props.onNarrativeClick(
                      props.subscription.nodeSlug || '',
                      narrative.slug
                    )}
                  >
                    <span class="narrative-indicator">
                      {narrative.currentVersion > 1 ? '●' : '○'}
                    </span>
                    <span class="narrative-title">{narrative.title}</span>
                    <Show when={narrative.currentVersion > 1}>
                      <span class="version-badge">v{narrative.currentVersion}</span>
                    </Show>
                  </div>
                )}
              </For>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  );
};

// Browse Node Item
const BrowseNodeItem: Component<{
  node: Node;
  isExpanded: boolean;
  onToggle: () => void;
  onNarrativeClick: (nodeSlug: string, narrativeSlug: string) => void;
}> = (props) => {
  return (
    <div class="nav-node-item">
      <div class="nav-node-header" onClick={props.onToggle}>
        <span class="expand-icon">{props.isExpanded ? '▼' : '▶'}</span>
        <span class="node-name">{props.node.name}</span>
        <span class="narrative-count">{props.node.narrativeCount || 0}</span>
      </div>
      
      <Show when={props.isExpanded}>
        <div class="nav-node-narratives">
          <div class="node-description">{props.node.description}</div>
          <Show
            when={props.node.narratives?.length}
            fallback={<div class="nav-empty-small">No narratives yet</div>}
          >
            <For each={props.node.narratives}>
              {(narrative) => (
                <div
                  class="nav-narrative-item"
                  onClick={() => props.onNarrativeClick(props.node.slug, narrative.slug)}
                >
                  <span class="narrative-indicator">○</span>
                  <span class="narrative-title">{narrative.title}</span>
                </div>
              )}
            </For>
          </Show>
        </div>
      </Show>
    </div>
  );
};
