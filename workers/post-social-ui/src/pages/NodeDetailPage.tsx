/**
 * Node Detail Page
 * 
 * View a single Node and its narratives.
 * Subscribe/unsubscribe, see narrative list.
 */

import { Component, createSignal, createResource, Show, For, createEffect } from 'solid-js';
import { A, useParams, useNavigate } from '@solidjs/router';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import { Button } from '@/components/ui/Button';
import type { Node, Narrative } from '@/types/models';

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

// Narrative Card
const NarrativeCard: Component<{
  narrative: Narrative;
  nodeSlug: string;
}> = (props) => {
  return (
    <A 
      href={`/node/${props.nodeSlug}/${props.narrative.slug}`}
      class="narrative-card"
    >
      <div class="narrative-card-header">
        <h3 class="narrative-card-title">{props.narrative.title}</h3>
        <span class="version-indicator">v{props.narrative.currentVersion}</span>
      </div>
      
      <div class="narrative-card-meta">
        <Show when={props.narrative.metadata?.tags?.length}>
          <div class="tags">
            <For each={props.narrative.metadata.tags?.slice(0, 3)}>
              {(tag) => <span class="tag">{tag}</span>}
            </For>
          </div>
        </Show>
        
        <div class="meta-stats">
          <Show when={props.narrative.metadata?.readingTime}>
            <span>{props.narrative.metadata.readingTime} min read</span>
          </Show>
          <span>Updated {formatRelativeTime(props.narrative.updatedAt)}</span>
        </div>
      </div>
      
      <Show when={props.narrative.synthesis?.pendingComments > 0}>
        <div class="synthesis-indicator">
          {props.narrative.synthesis.pendingComments} comments awaiting synthesis
        </div>
      </Show>
    </A>
  );
};

export const NodeDetailPage: Component = () => {
  const params = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  const [subscribed, setSubscribed] = createSignal(false);
  const [subscribing, setSubscribing] = createSignal(false);
  
  // Fetch node
  const [node, { refetch }] = createResource(
    () => params.slug,
    async (slug) => {
      try {
        return await nodesService.getNode(slug, authStore.token() || undefined);
      } catch (err) {
        console.error('Failed to load node:', err);
        return null;
      }
    }
  );
  
  // Check subscription status
  createEffect(async () => {
    const nodeData = node();
    const token = authStore.token();
    if (!nodeData || !token) return;
    
    try {
      const result = await nodesService.checkSubscription(nodeData.id, token);
      setSubscribed(result.subscribed);
    } catch (err) {
      console.error('Failed to check subscription:', err);
    }
  });
  
  // Toggle subscription
  const toggleSubscription = async () => {
    const nodeData = node();
    const token = authStore.token();
    if (!nodeData || !token) {
      navigate('/login');
      return;
    }
    
    setSubscribing(true);
    try {
      if (subscribed()) {
        await nodesService.unsubscribe(nodeData.id, token);
        setSubscribed(false);
      } else {
        await nodesService.subscribe(nodeData.id, {}, token);
        setSubscribed(true);
      }
    } catch (err) {
      console.error('Failed to toggle subscription:', err);
    } finally {
      setSubscribing(false);
    }
  };
  
  // Check if current user owns this node
  const isOwner = () => {
    const nodeData = node();
    const user = authStore.user();
    return nodeData && user && nodeData.creatorUserId === user.id;
  };
  
  return (
    <div class="node-detail">
      {/* Header */}
      <header class="node-detail-header">
        <div class="header-nav">
          <A href="/nodes" class="back-link">← Browse Nodes</A>
          <Show when={authStore.isAuthenticated()}>
            <A href="/notes" class="back-link">My Subscriptions</A>
          </Show>
        </div>
      </header>
      
      {/* Main Content */}
      <Show
        when={!node.loading}
        fallback={<div class="loading">Loading node...</div>}
      >
        <Show
          when={node()}
          fallback={
            <div class="not-found">
              <h2>Node not found</h2>
              <p>The node you're looking for doesn't exist or has been archived.</p>
              <A href="/nodes">
                <Button variant="primary">Browse Nodes</Button>
              </A>
            </div>
          }
        >
          <main class="node-detail-content">
            {/* Node Info */}
            <div class="node-info">
              <div class="node-info-header">
                <h1 class="node-name">{node()!.name}</h1>
                <div class="node-actions">
                  <Show when={authStore.isAuthenticated()}>
                    <Button
                      variant={subscribed() ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={toggleSubscription}
                      disabled={subscribing()}
                    >
                      {subscribing() 
                        ? '...' 
                        : subscribed() 
                          ? 'Unsubscribe' 
                          : 'Subscribe'
                      }
                    </Button>
                  </Show>
                </div>
              </div>
              
              <Show when={node()!.description}>
                <p class="node-description">{node()!.description}</p>
              </Show>
              
              <div class="node-stats">
                <span class="stat">
                  <strong>{node()!.archiveMetadata?.narrativeCount || 0}</strong> narratives
                </span>
                <Show when={node()!.archiveMetadata?.lastPublished}>
                  <span class="stat">
                    Last published: {new Date(node()!.archiveMetadata.lastPublished!).toLocaleDateString()}
                  </span>
                </Show>
              </div>
            </div>
            
            {/* Curator Info */}
            <Show when={node()!.curatorConfig?.personality}>
              <div class="curator-info">
                <h3>AI Curator</h3>
                <p class="curator-personality">
                  Personality: <em>{node()!.curatorConfig.personality}</em>
                </p>
              </div>
            </Show>
            
            {/* Narratives List */}
            <div class="narratives-section">
              <div class="section-header">
                <h2>Narratives</h2>
                <Show when={isOwner()}>
                  <Button variant="primary" size="sm">
                    + New Narrative
                  </Button>
                </Show>
              </div>
              
              <Show
                when={node()!.narratives?.length}
                fallback={
                  <div class="empty-narratives">
                    <p>No narratives published yet.</p>
                    <Show when={isOwner()}>
                      <p class="hint">Create your first narrative to get started.</p>
                    </Show>
                  </div>
                }
              >
                <div class="narratives-list">
                  <For each={node()!.narratives}>
                    {(narrative) => (
                      <NarrativeCard 
                        narrative={narrative} 
                        nodeSlug={params.slug}
                      />
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </main>
        </Show>
      </Show>
    </div>
  );
};
