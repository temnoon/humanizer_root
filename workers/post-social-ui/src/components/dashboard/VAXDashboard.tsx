/**
 * VAX Notes Style Dashboard
 * 
 * Inspired by the 1984 DEC VAX Notes system:
 * - Clean list of subscribed Nodes with unread counts
 * - Click to expand and see narratives with updates
 * - One-click navigation to read updates
 * 
 * "Phenomenology [5]" format shows unread count
 */

import { Component, createSignal, createResource, Show, For } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import { Button } from '@/components/ui/Button';
import type { NodeSubscription, Node, Narrative } from '@/types/models';

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

// Subscription card with expandable narratives
const SubscriptionCard: Component<{
  subscription: NodeSubscription;
  onMarkRead: (nodeId: string) => void;
}> = (props) => {
  const [expanded, setExpanded] = createSignal(false);
  const [node, setNode] = createSignal<Node | null>(null);
  const [loading, setLoading] = createSignal(false);
  
  const loadNode = async () => {
    if (node()) return; // Already loaded
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
  
  const handleExpand = () => {
    const newExpanded = !expanded();
    setExpanded(newExpanded);
    if (newExpanded) {
      loadNode();
    }
  };
  
  const handleMarkRead = (e: Event) => {
    e.stopPropagation();
    props.onMarkRead(props.subscription.nodeId);
  };
  
  return (
    <div class="subscription-card">
      <div 
        class="subscription-header"
        onClick={handleExpand}
        style={{ cursor: 'pointer' }}
      >
        <div class="subscription-info">
          <span class="expand-icon">{expanded() ? '▼' : '▶'}</span>
          <span class="node-name">{props.subscription.nodeName || 'Unknown Node'}</span>
          <Show when={props.subscription.unreadCount > 0}>
            <span class="unread-badge">[{props.subscription.unreadCount}]</span>
          </Show>
        </div>
        <div class="subscription-actions">
          <Show when={props.subscription.unreadCount > 0}>
            <button 
              class="mark-read-btn"
              onClick={handleMarkRead}
              title="Mark all as read"
            >
              ✓
            </button>
          </Show>
          <A href={`/node/${props.subscription.nodeSlug}`} class="view-node-btn">
            View
          </A>
        </div>
      </div>
      
      <Show when={expanded()}>
        <div class="narratives-list">
          <Show when={loading()}>
            <div class="loading-narratives">Loading narratives...</div>
          </Show>
          
          <Show when={!loading() && node()}>
            <Show 
              when={node()?.narratives?.length}
              fallback={
                <div class="no-narratives">No narratives published yet</div>
              }
            >
              <For each={node()?.narratives}>
                {(narrative) => (
                  <NarrativeItem 
                    narrative={narrative} 
                    nodeSlug={props.subscription.nodeSlug || ''} 
                  />
                )}
              </For>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  );
};

// Individual narrative item in the expanded list
const NarrativeItem: Component<{
  narrative: Narrative;
  nodeSlug: string;
}> = (props) => {
  const hasUpdate = () => props.narrative.currentVersion > 1;
  
  return (
    <A 
      href={`/node/${props.nodeSlug}/${props.narrative.slug}`}
      class="narrative-item"
    >
      <div class="narrative-indicator">
        {hasUpdate() ? '●' : '○'}
      </div>
      <div class="narrative-content">
        <div class="narrative-title">
          {props.narrative.title}
          <Show when={hasUpdate()}>
            <span class="version-badge">
              v{props.narrative.currentVersion - 1} → v{props.narrative.currentVersion}
            </span>
          </Show>
        </div>
        <div class="narrative-meta">
          <Show when={props.narrative.metadata?.tags?.length}>
            <span class="tags">
              {props.narrative.metadata.tags?.slice(0, 3).join(', ')}
            </span>
          </Show>
          <span class="time">{formatRelativeTime(props.narrative.updatedAt)}</span>
        </div>
      </div>
    </A>
  );
};

// Main Dashboard Component
export const VAXDashboard: Component = () => {
  const navigate = useNavigate();
  
  // Redirect if not authenticated
  if (!authStore.isAuthenticated()) {
    navigate('/login');
    return null;
  }
  
  // Fetch subscriptions
  const [subscriptions, { refetch }] = createResource(
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
  
  // Total unread count
  const totalUnread = () => {
    const subs = subscriptions();
    if (!subs) return 0;
    return subs.reduce((sum, sub) => sum + sub.unreadCount, 0);
  };
  
  // Mark node as read
  const handleMarkRead = async (nodeId: string) => {
    const token = authStore.token();
    if (!token) return;
    
    const success = await nodesService.markRead(nodeId, token);
    if (success) {
      refetch();
    }
  };
  
  // Logout
  const handleLogout = () => {
    authStore.logout();
    navigate('/login');
  };
  
  // Sort subscriptions: unread first, then by name
  const sortedSubscriptions = () => {
    const subs = subscriptions();
    if (!subs) return [];
    return [...subs].sort((a, b) => {
      // Unread first
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      // Then by name
      return (a.nodeName || '').localeCompare(b.nodeName || '');
    });
  };
  
  return (
    <div class="vax-dashboard">
      {/* Header */}
      <header class="dashboard-header">
        <div class="header-left">
          <h1 class="dashboard-title">
            post<span class="accent">-social</span>
          </h1>
          <span class="dashboard-subtitle">VAX Notes</span>
        </div>
        <div class="header-right">
          <span class="user-email">{authStore.user()?.email}</span>
          <A href="/studio">
            <Button variant="primary" size="sm">✏️ Create</Button>
          </A>
          <A href="/nodes">
            <Button variant="secondary" size="sm">Browse Nodes</Button>
          </A>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>
      
      {/* Stats bar */}
      <div class="stats-bar">
        <div class="stat">
          <span class="stat-value">{subscriptions()?.length || 0}</span>
          <span class="stat-label">Subscribed</span>
        </div>
        <div class="stat">
          <span class="stat-value">{totalUnread()}</span>
          <span class="stat-label">Unread</span>
        </div>
      </div>
      
      {/* Main content */}
      <main class="dashboard-content">
        <div class="subscriptions-header">
          <h2>Subscribed Nodes</h2>
          <span class="update-indicator">[Updates]</span>
        </div>
        
        <div class="subscriptions-divider">─────────────────────────────────────────────</div>
        
        <Show
          when={!subscriptions.loading}
          fallback={<div class="loading">Loading subscriptions...</div>}
        >
          <Show
            when={sortedSubscriptions().length}
            fallback={
              <div class="empty-state">
                <p>No subscriptions yet.</p>
                <p class="hint">
                  <A href="/nodes">Browse Nodes</A> to find interesting topics to follow.
                </p>
              </div>
            }
          >
            <div class="subscriptions-list">
              <For each={sortedSubscriptions()}>
                {(sub) => (
                  <SubscriptionCard 
                    subscription={sub} 
                    onMarkRead={handleMarkRead}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>
      </main>
      
      {/* Footer hint */}
      <footer class="dashboard-footer">
        <p>Click a Node to expand and see narratives. Click a narrative to read.</p>
      </footer>
    </div>
  );
};
