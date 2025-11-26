/**
 * Node Browser Page
 * 
 * Browse all public Nodes. Subscribe to follow updates.
 */

import { Component, createSignal, createResource, Show, For } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import type { Node } from '@/types/models';

// Node Card Component
const NodeCard: Component<{
  node: Node;
  onSubscribe?: (nodeId: string) => void;
}> = (props) => {
  const [subscribing, setSubscribing] = createSignal(false);
  
  const handleSubscribe = async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    setSubscribing(true);
    props.onSubscribe?.(props.node.id);
    setSubscribing(false);
  };
  
  return (
    <A href={`/node/${props.node.slug}`} class="node-browser-card">
      <div class="node-card-header">
        <h3 class="node-card-title">{props.node.name}</h3>
        <Show when={props.node.archiveMetadata?.narrativeCount}>
          <span class="narrative-count">
            {props.node.archiveMetadata.narrativeCount} narratives
          </span>
        </Show>
      </div>
      
      <Show when={props.node.description}>
        <p class="node-card-description">{props.node.description}</p>
      </Show>
      
      <div class="node-card-footer">
        <Show when={props.node.archiveMetadata?.lastPublished}>
          <span class="last-published">
            Last updated: {new Date(props.node.archiveMetadata.lastPublished!).toLocaleDateString()}
          </span>
        </Show>
        
        <Show when={authStore.isAuthenticated()}>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={handleSubscribe}
            disabled={subscribing()}
          >
            {subscribing() ? 'Subscribing...' : 'Subscribe'}
          </Button>
        </Show>
      </div>
    </A>
  );
};

export const NodeBrowserPage: Component = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = createSignal('');
  
  // Fetch nodes
  const [nodes, { refetch }] = createResource(
    async () => {
      try {
        return await nodesService.listNodes(authStore.token() || undefined);
      } catch (err) {
        console.error('Failed to load nodes:', err);
        return [];
      }
    }
  );
  
  // Filter nodes by search
  const filteredNodes = () => {
    const query = searchQuery().toLowerCase();
    const allNodes = nodes() || [];
    if (!query) return allNodes;
    return allNodes.filter(
      node => 
        node.name.toLowerCase().includes(query) ||
        node.description?.toLowerCase().includes(query)
    );
  };
  
  // Handle subscribe
  const handleSubscribe = async (nodeId: string) => {
    const token = authStore.token();
    if (!token) {
      navigate('/login');
      return;
    }
    
    try {
      await nodesService.subscribe(nodeId, {}, token);
      // Could show a toast here
    } catch (err) {
      console.error('Failed to subscribe:', err);
    }
  };
  
  // Logout
  const handleLogout = () => {
    authStore.logout();
    navigate('/login');
  };
  
  return (
    <div class="node-browser">
      {/* Header */}
      <header class="browser-header">
        <div class="header-left">
          <h1 class="browser-title">
            post<span class="accent">-social</span>
          </h1>
          <span class="browser-subtitle">Browse Nodes</span>
        </div>
        <div class="header-right">
          <ThemeToggle />
          <Show when={authStore.isAuthenticated()}>
            <span class="user-email">{authStore.user()?.email}</span>
            <A href="/notes">
              <Button variant="secondary" size="sm">My Subscriptions</Button>
            </A>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </Show>
          <Show when={!authStore.isAuthenticated()}>
            <A href="/login">
              <Button variant="primary" size="sm">Login</Button>
            </A>
          </Show>
        </div>
      </header>
      
      {/* Search */}
      <div class="browser-search">
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          class="search-input"
        />
      </div>
      
      {/* Nodes Grid */}
      <main class="browser-content">
        <Show
          when={!nodes.loading}
          fallback={<div class="loading">Loading nodes...</div>}
        >
          <Show
            when={filteredNodes().length}
            fallback={
              <div class="empty-state">
                <p>No nodes found.</p>
                <Show when={searchQuery()}>
                  <p class="hint">Try a different search term.</p>
                </Show>
              </div>
            }
          >
            <div class="nodes-grid">
              <For each={filteredNodes()}>
                {(node) => (
                  <NodeCard 
                    node={node} 
                    onSubscribe={handleSubscribe}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>
      </main>
    </div>
  );
};
