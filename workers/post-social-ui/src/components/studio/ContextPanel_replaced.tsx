/**
 * Context Panel - Right Panel for Studio-First Interface
 * 
 * The TRANSFORM panel - contextual tools based on center content:
 * - Reading Mode: Related content, AI analysis, comments
 * - Editing Mode: AI suggestions, synthesis controls
 * - Compare Mode: Semantic shift analysis
 * - Search Mode: Filters, clustering options
 */

import { Component, Show, createSignal, For, createResource } from 'solid-js';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import type { CenterMode } from './NavigationPanel';
import type { Narrative, NarrativeComment } from '@/types/models';

interface ContextPanelProps {
  mode: CenterMode;
  selectedNarrative?: Narrative | null;
  onAction?: (action: string, data?: any) => void;
}

export const ContextPanel: Component<ContextPanelProps> = (props) => {
  return (
    <div class="context-panel">
      {/* Welcome Context */}
      <Show when={props.mode.type === 'welcome'}>
        <WelcomeContext />
      </Show>
      
      {/* Node List Context - Subscribe options */}
      <Show when={props.mode.type === 'node-list' || props.mode.type === 'node-detail'}>
        <BrowseContext mode={props.mode} />
      </Show>
      
      {/* Narrative Context - Comments, Analysis, Related */}
      <Show when={props.mode.type === 'narrative'}>
        {(() => {
          const mode = props.mode as { type: 'narrative'; nodeSlug: string; narrativeSlug: string };
          return (
            <NarrativeContext
              nodeSlug={mode.nodeSlug}
              narrativeSlug={mode.narrativeSlug}
              narrative={props.selectedNarrative}
            />
          );
        })()}
      </Show>
      
      {/* Compare Context - Semantic analysis */}
      <Show when={props.mode.type === 'compare'}>
        <CompareContext />
      </Show>
      
      {/* Editor Context - AI Curator */}
      <Show when={props.mode.type === 'editor'}>
        <EditorContext />
      </Show>
      
      {/* Search Context - Filters */}
      <Show when={props.mode.type === 'search-results'}>
        <SearchContext />
      </Show>
    </div>
  );
};

// Welcome Context
const WelcomeContext: Component = () => {
  return (
    <div class="context-section">
      <h3>Getting Started</h3>
      <div class="context-tips">
        <div class="tip">
          <span class="tip-icon">🔔</span>
          <div class="tip-content">
            <strong>Subscribe to Nodes</strong>
            <p>Follow topics that interest you to see updates.</p>
          </div>
        </div>
        <div class="tip">
          <span class="tip-icon">📖</span>
          <div class="tip-content">
            <strong>Read Narratives</strong>
            <p>Evolving documents that incorporate community feedback.</p>
          </div>
        </div>
        <div class="tip">
          <span class="tip-icon">💬</span>
          <div class="tip-content">
            <strong>Contribute Comments</strong>
            <p>Your insights may be synthesized into future versions.</p>
          </div>
        </div>
        <div class="tip">
          <span class="tip-icon">✏️</span>
          <div class="tip-content">
            <strong>Create Your Own</strong>
            <p>Publish narratives to share your perspective.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Browse Context - For node list and detail views
const BrowseContext: Component<{ mode: CenterMode }> = (props) => {
  const [isSubscribing, setIsSubscribing] = createSignal(false);
  
  const handleSubscribe = async (nodeId: string) => {
    const token = authStore.token();
    if (!token) return;
    
    setIsSubscribing(true);
    try {
      await nodesService.subscribe(nodeId, token);
    } catch (err) {
      console.error('Failed to subscribe:', err);
    } finally {
      setIsSubscribing(false);
    }
  };
  
  return (
    <div class="context-section">
      <h3>About Nodes</h3>
      <p class="context-description">
        Nodes are topical spaces where related narratives live. 
        Subscribe to stay updated when new narratives are published 
        or existing ones evolve.
      </p>
      
      <Show when={props.mode.type === 'node-detail'}>
        <div class="context-actions">
          <button 
            class="context-btn primary"
            onClick={() => {
              const mode = props.mode as { type: 'node-detail'; nodeId: string };
              handleSubscribe(mode.nodeId);
            }}
            disabled={isSubscribing()}
          >
            {isSubscribing() ? 'Subscribing...' : '🔔 Subscribe to Node'}
          </button>
        </div>
      </Show>
      
      <div class="context-info">
        <h4>How Narratives Evolve</h4>
        <ol class="evolution-steps">
          <li>Author publishes initial version</li>
          <li>Readers leave comments with feedback</li>
          <li>AI Curator evaluates comment quality</li>
          <li>Author synthesizes feedback into new version</li>
          <li>Version history preserved for transparency</li>
        </ol>
      </div>
    </div>
  );
};

// Narrative Context - Comments and analysis
const NarrativeContext: Component<{
  nodeSlug: string;
  narrativeSlug: string;
  narrative?: Narrative | null;
}> = (props) => {
  const [activeTab, setActiveTab] = createSignal<'comments' | 'analysis' | 'related'>('comments');
  const [showCommentForm, setShowCommentForm] = createSignal(false);
  const [commentText, setCommentText] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  
  // Fetch comments
  const [comments, { refetch: refetchComments }] = createResource(
    () => props.narrative?.id,
    async (narrativeId) => {
      if (!narrativeId) return [];
      try {
        return await nodesService.listComments(narrativeId);
      } catch (err) {
        console.error('Failed to load comments:', err);
        return [];
      }
    }
  );
  
  // Submit comment
  const handleSubmitComment = async () => {
    const narrativeId = props.narrative?.id;
    const token = authStore.token();
    if (!narrativeId || !token || !commentText().trim()) return;
    
    setSubmitting(true);
    try {
      await nodesService.postComment(narrativeId, {
        content: commentText(),
        contextQuote: '' // Could implement text selection
      }, token);
      setCommentText('');
      setShowCommentForm(false);
      refetchComments();
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmitting(false);
    }
  };
  
  // Count pending comments
  const pendingCount = () => {
    const c = comments();
    if (!c) return 0;
    return c.filter(c => c.status === 'pending').length;
  };
  
  return (
    <div class="context-section">
      {/* Tabs */}
      <div class="context-tabs">
        <button
          class={`context-tab ${activeTab() === 'comments' ? 'active' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          Comments
          <Show when={pendingCount() > 0}>
            <span class="tab-badge">{pendingCount()}</span>
          </Show>
        </button>
        <button
          class={`context-tab ${activeTab() === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          Analysis
        </button>
        <button
          class={`context-tab ${activeTab() === 'related' ? 'active' : ''}`}
          onClick={() => setActiveTab('related')}
        >
          Related
        </button>
      </div>
      
      {/* Comments Tab */}
      <Show when={activeTab() === 'comments'}>
        <div class="context-content">
          {/* Add Comment */}
          <Show when={authStore.isAuthenticated()}>
            <Show
              when={showCommentForm()}
              fallback={
                <button 
                  class="add-comment-btn"
                  onClick={() => setShowCommentForm(true)}
                >
                  + Add Comment
                </button>
              }
            >
              <div class="comment-form">
                <textarea
                  placeholder="Share your thoughts or feedback..."
                  value={commentText()}
                  onInput={(e) => setCommentText(e.currentTarget.value)}
                  rows={4}
                />
                <div class="comment-form-actions">
                  <button 
                    class="btn-secondary"
                    onClick={() => setShowCommentForm(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    class="btn-primary"
                    onClick={handleSubmitComment}
                    disabled={submitting() || !commentText().trim()}
                  >
                    {submitting() ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </div>
            </Show>
          </Show>
          
          {/* Comments List */}
          <div class="comments-list">
            <Show
              when={!comments.loading}
              fallback={<div class="loading-small">Loading comments...</div>}
            >
              <Show
                when={comments()?.length}
                fallback={<p class="empty-small">No comments yet. Be the first!</p>}
              >
                <For each={comments()}>
                  {(comment) => (
                    <CommentCard comment={comment} />
                  )}
                </For>
              </Show>
            </Show>
          </div>
        </div>
      </Show>
      
      {/* Analysis Tab */}
      <Show when={activeTab() === 'analysis'}>
        <div class="context-content">
          <div class="analysis-placeholder">
            <h4>Content Analysis</h4>
            <p class="hint">AI-powered analysis coming soon.</p>
            <ul class="analysis-features">
              <li>Clarity score</li>
              <li>Depth assessment</li>
              <li>Key concepts extraction</li>
              <li>Suggested improvements</li>
            </ul>
          </div>
        </div>
      </Show>
      
      {/* Related Tab */}
      <Show when={activeTab() === 'related'}>
        <div class="context-content">
          <div class="related-placeholder">
            <h4>Related Content</h4>
            <p class="hint">Semantic similarity coming soon.</p>
            <ul class="related-features">
              <li>Similar narratives</li>
              <li>Related concepts</li>
              <li>Cross-node connections</li>
            </ul>
          </div>
        </div>
      </Show>
    </div>
  );
};

// Comment Card
const CommentCard: Component<{ comment: NarrativeComment }> = (props) => {
  const statusColor = () => {
    switch (props.comment.status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      default: return 'pending';
    }
  };
  
  return (
    <div class={`comment-card status-${statusColor()}`}>
      <div class="comment-header">
        <span class="comment-author">Anonymous</span>
        <span class={`comment-status ${statusColor()}`}>
          {props.comment.status}
        </span>
      </div>
      <Show when={props.comment.contextQuote}>
        <blockquote class="comment-context">
          "{props.comment.contextQuote}"
        </blockquote>
      </Show>
      <p class="comment-content">{props.comment.content}</p>
      <Show when={props.comment.curatorEvaluation}>
        <div class="curator-eval">
          <span>Quality: {Math.round((props.comment.curatorEvaluation?.quality || 0) * 100)}%</span>
          <span>Relevance: {Math.round((props.comment.curatorEvaluation?.relevance || 0) * 100)}%</span>
        </div>
      </Show>
    </div>
  );
};

// Compare Context
const CompareContext: Component = () => {
  return (
    <div class="context-section">
      <h3>Version Analysis</h3>
      <p class="context-description">
        Compare how the narrative evolved between versions.
      </p>
      
      <div class="context-info">
        <h4>Understanding Changes</h4>
        <dl class="metrics-explained">
          <dt>Semantic Shift</dt>
          <dd>How much the meaning changed (word-level analysis)</dd>
          <dt>Added Lines</dt>
          <dd>New content introduced</dd>
          <dt>Removed Lines</dt>
          <dd>Content that was removed or replaced</dd>
          <dt>Similarity</dt>
          <dd>Overall structural similarity between versions</dd>
        </dl>
      </div>
    </div>
  );
};

// Editor Context - AI Curator suggestions
const EditorContext: Component = () => {
  return (
    <div class="context-section">
      <h3>AI Curator</h3>
      <p class="context-description">
        Get suggestions to improve your narrative.
      </p>
      {/* Will integrate CuratorPanel functionality */}
      <div class="context-placeholder">
        <p>AI suggestions will appear here as you write.</p>
      </div>
    </div>
  );
};

// Search Context
const SearchContext: Component = () => {
  return (
    <div class="context-section">
      <h3>Search Filters</h3>
      <div class="search-filters">
        <div class="filter-group">
          <label>Content Type</label>
          <select>
            <option value="all">All</option>
            <option value="narratives">Narratives</option>
            <option value="comments">Comments</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Node</label>
          <select>
            <option value="all">All Nodes</option>
            <option value="subscribed">Subscribed Only</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Date Range</label>
          <select>
            <option value="all">All Time</option>
            <option value="week">Past Week</option>
            <option value="month">Past Month</option>
            <option value="year">Past Year</option>
          </select>
        </div>
      </div>
    </div>
  );
};
