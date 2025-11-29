/**
 * Context Panel - Right Panel for Studio-First Interface
 * 
 * Phase 4 Update: Comment Thread UI
 * - Displays curator responses under each comment
 * - Triggers auto-respond when comment posted (if node has autoRespond enabled)
 * - Shows conversation thread with expandable curator feedback
 * 
 * The TRANSFORM panel - contextual tools based on center content:
 * - Reading Mode: Related content, AI analysis, comments with curator threads
 * - Editing Mode: AI suggestions, synthesis controls
 * - Compare Mode: Semantic shift analysis
 * - Search Mode: Filters, clustering options
 */

import { Component, Show, createSignal, For, createResource, createEffect } from 'solid-js';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import { curatorAgentService } from '@/services/curator';
import type { CenterMode } from './NavigationPanel';
import type { Narrative, NarrativeComment, Node } from '@/types/models';

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
      
      {/* Admin Context */}
      <Show when={props.mode.type === 'admin'}>
        <AdminContext />
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
          <li>AI Curator evaluates and responds</li>
          <li>Author synthesizes feedback into new version</li>
          <li>Version history preserved for transparency</li>
        </ol>
      </div>
    </div>
  );
};

// Narrative Context - Comments with Curator Thread UI
const NarrativeContext: Component<{
  nodeSlug: string;
  narrativeSlug: string;
  narrative?: Narrative | null;
}> = (props) => {
  const [activeTab, setActiveTab] = createSignal<'comments' | 'analysis' | 'related'>('comments');
  const [showCommentForm, setShowCommentForm] = createSignal(false);
  const [commentText, setCommentText] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [autoRespondPending, setAutoRespondPending] = createSignal<string | null>(null);
  
  // Track which comments have expanded curator responses
  const [expandedComments, setExpandedComments] = createSignal<Set<string>>(new Set());
  
  // Track conversation turns for each comment
  const [conversationTurns, setConversationTurns] = createSignal<Record<string, any[]>>({});
  const [replyingTo, setReplyingTo] = createSignal<string | null>(null);
  const [replyText, setReplyText] = createSignal('');
  const [sendingReply, setSendingReply] = createSignal(false);

  // Fetch comments with conversation threads
  const [comments, { refetch: refetchComments }] = createResource(
    () => props.narrative?.id,
    async (narrativeId) => {
      if (!narrativeId) return [];
      try {
        const token = authStore.token();
        const commentsList = await nodesService.listComments(narrativeId, undefined, token || undefined);

        // Fetch full conversation threads for each comment
        const commentsWithConversations = await Promise.all(
          commentsList.map(async (comment) => {
            try {
              const conversation = await curatorAgentService.getCommentConversation(comment.id);

              // Store turns in state
              if (conversation.conversationId && conversation.turns?.length > 0) {
                setConversationTurns(prev => ({
                  ...prev,
                  [comment.id]: conversation.turns
                }));
              }

              return {
                ...comment,
                conversationId: conversation.conversationId,
                curatorEvaluation: conversation.evaluation || comment.curatorEvaluation,
              };
            } catch (err) {
              return comment;
            }
          })
        );

        return commentsWithConversations;
      } catch (err) {
        console.error('Failed to load comments:', err);
        return [];
      }
    }
  );
  
  // Toggle comment expansion
  const toggleExpanded = (commentId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };
  
  // Submit comment with auto-respond trigger
  const handleSubmitComment = async () => {
    const narrativeId = props.narrative?.id;
    const token = authStore.token();
    if (!narrativeId || !token || !commentText().trim()) return;

    setSubmitting(true);
    try {
      const newComment = await nodesService.postComment(narrativeId, {
        content: commentText(),
        contextQuote: '' // Could implement text selection
      }, token);

      setCommentText('');
      setShowCommentForm(false);

      // Trigger auto-respond if enabled
      // We'll check by attempting to respond - the backend will check node rules
      setAutoRespondPending(newComment.id);

      // Refetch comments first to show the new one
      await refetchComments();

      // Try to trigger curator auto-respond
      try {
        await curatorAgentService.respondToComment(newComment.id, token);
        // Refetch again to get the response
        await refetchComments();
      } catch (err) {
        // Auto-respond might be disabled or fail - that's okay
        console.log('Auto-respond not triggered:', err);
      } finally {
        setAutoRespondPending(null);
      }

    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle reply to curator
  const handleSendReply = async (commentId: string) => {
    const token = authStore.token();
    if (!token || !replyText().trim()) return;

    setSendingReply(true);
    try {
      const result = await curatorAgentService.replyToComment(commentId, replyText(), token);

      // Add both turns to local state
      setConversationTurns(prev => ({
        ...prev,
        [commentId]: [...(prev[commentId] || []), result.userTurn, result.curatorTurn]
      }));

      // Clear reply form
      setReplyText('');
      setReplyingTo(null);
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setSendingReply(false);
    }
  };
  
  // Count pending comments
  const pendingCount = () => {
    const c = comments();
    if (!c) return 0;
    return c.filter(c => c.status === 'pending').length;
  };
  
  // Count comments with curator responses
  const responseCount = () => {
    const c = comments();
    if (!c) return 0;
    return c.filter(c => c.curatorResponse).length;
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
          {/* Stats */}
          <Show when={comments()?.length}>
            <div class="comments-stats">
              <span>{comments()?.length} comments</span>
              <Show when={responseCount() > 0}>
                <span class="curator-stat">• {responseCount()} curator responses</span>
              </Show>
            </div>
          </Show>
          
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
                  placeholder="Share your thoughts or feedback. The AI Curator may respond..."
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
          
          {/* Auto-respond pending indicator */}
          <Show when={autoRespondPending()}>
            <div class="auto-respond-pending">
              <span class="spinner-small"></span>
              <span>AI Curator is reviewing your comment...</span>
            </div>
          </Show>
          
          {/* Comments List */}
          <div class="comments-list">
            <Show
              when={!comments.loading}
              fallback={<div class="loading-small">Loading comments...</div>}
            >
              <Show
                when={comments()?.length}
                fallback={<p class="empty-small">No comments yet. Be the first to contribute!</p>}
              >
                <For each={comments()}>
                  {(comment) => (
                    <CommentThreadCard
                      comment={comment}
                      expanded={expandedComments().has(comment.id)}
                      onToggleExpand={() => toggleExpanded(comment.id)}
                      conversationTurns={conversationTurns()[comment.id] || []}
                      isReplying={replyingTo() === comment.id}
                      replyText={replyText()}
                      sendingReply={sendingReply()}
                      onStartReply={() => setReplyingTo(comment.id)}
                      onCancelReply={() => {
                        setReplyingTo(null);
                        setReplyText('');
                      }}
                      onReplyTextChange={setReplyText}
                      onSendReply={() => handleSendReply(comment.id)}
                    />
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

// Comment Thread Card - Shows comment with full conversation thread
const CommentThreadCard: Component<{
  comment: NarrativeComment;
  expanded: boolean;
  onToggleExpand: () => void;
  conversationTurns: any[];
  isReplying: boolean;
  replyText: string;
  sendingReply: boolean;
  onStartReply: () => void;
  onCancelReply: () => void;
  onReplyTextChange: (text: string) => void;
  onSendReply: () => void;
}> = (props) => {
  const statusColor = () => {
    switch (props.comment.status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'synthesized': return 'synthesized';
      default: return 'pending';
    }
  };
  
  const responseTypeIcon = () => {
    if (!props.comment.curatorResponse) return '';
    switch (props.comment.curatorResponse.type) {
      case 'acknowledgment': return '✓';
      case 'clarification': return '?';
      case 'pushback': return '⚡';
      case 'synthesis_note': return '📝';
      case 'rejection': return '✗';
      default: return '💬';
    }
  };
  
  const responseTypeLabel = () => {
    if (!props.comment.curatorResponse) return '';
    switch (props.comment.curatorResponse.type) {
      case 'acknowledgment': return 'Acknowledged';
      case 'clarification': return 'Clarification Requested';
      case 'pushback': return 'Pushback';
      case 'synthesis_note': return 'Synthesis Potential';
      case 'rejection': return 'Not Suitable';
      default: return 'Response';
    }
  };
  
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };
  
  return (
    <div class={`comment-thread-card status-${statusColor()}`}>
      {/* Comment Header */}
      <div class="comment-header">
        <span class="comment-author">Anonymous</span>
        <span class="comment-time">{formatTime(props.comment.createdAt)}</span>
        <span class={`comment-status ${statusColor()}`}>
          {props.comment.status}
        </span>
      </div>
      
      {/* Quoted Context */}
      <Show when={props.comment.contextQuote || props.comment.context?.selectedText}>
        <blockquote class="comment-context">
          "{props.comment.contextQuote || props.comment.context?.selectedText}"
        </blockquote>
      </Show>
      
      {/* Comment Content */}
      <p class="comment-content">{props.comment.content}</p>
      
      {/* Curator Evaluation Scores (compact) */}
      <Show when={props.comment.curatorEvaluation}>
        <div class="curator-eval-compact">
          <span class="eval-score" title="Quality">
            Q: {Math.round((props.comment.curatorEvaluation?.quality || 0) * 100)}%
          </span>
          <span class="eval-score" title="Relevance">
            R: {Math.round((props.comment.curatorEvaluation?.relevance || 0) * 100)}%
          </span>
          <Show when={props.comment.curatorEvaluation?.synthesizable !== undefined}>
            <span class={`eval-synth ${props.comment.curatorEvaluation?.synthesizable ? 'yes' : 'no'}`}>
              {props.comment.curatorEvaluation?.synthesizable ? '✓ Synthesizable' : '✗ Not synthesizable'}
            </span>
          </Show>
        </div>
      </Show>
      
      {/* Conversation Thread Section */}
      <Show when={props.conversationTurns.length > 0}>
        <div class="curator-response-section">
          {/* Thread Header - Clickable to expand */}
          <button
            class="curator-response-header"
            onClick={props.onToggleExpand}
          >
            <span class="response-icon">💬</span>
            <span class="response-type">Conversation ({props.conversationTurns.length} messages)</span>
            <span class="expand-icon">{props.expanded ? '▼' : '▶'}</span>
          </button>

          {/* Expanded Conversation Thread */}
          <Show when={props.expanded}>
            <div class="conversation-thread">
              <For each={props.conversationTurns}>
                {(turn) => (
                  <div class={`conversation-turn ${turn.role}`}>
                    <div class="turn-header">
                      <span class="turn-avatar">{turn.role === 'user' ? '👤' : '🤖'}</span>
                      <span class="turn-role">{turn.role === 'user' ? 'You' : 'Curator'}</span>
                      <span class="turn-time">{formatTime(turn.createdAt)}</span>
                    </div>
                    <div class="turn-content">
                      <p>{turn.content}</p>
                    </div>
                  </div>
                )}
              </For>

              {/* Reply UI */}
              <Show when={authStore.isAuthenticated()}>
                <div class="reply-section">
                  <Show
                    when={props.isReplying}
                    fallback={
                      <button class="reply-btn" onClick={props.onStartReply}>
                        💬 Reply to Curator
                      </button>
                    }
                  >
                    <div class="reply-form">
                      <textarea
                        class="reply-input"
                        placeholder="Continue the conversation..."
                        value={props.replyText}
                        onInput={(e) => props.onReplyTextChange(e.currentTarget.value)}
                        rows={3}
                      />
                      <div class="reply-actions">
                        <button
                          class="btn-secondary"
                          onClick={props.onCancelReply}
                        >
                          Cancel
                        </button>
                        <button
                          class="btn-primary"
                          onClick={props.onSendReply}
                          disabled={props.sendingReply || !props.replyText.trim()}
                        >
                          {props.sendingReply ? 'Sending...' : 'Send Reply'}
                        </button>
                      </div>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>

            {/* Perspective note if available */}
            <Show when={props.comment.curatorEvaluation?.perspective}>
              <div class="curator-perspective">
                <strong>Perspective added:</strong> {props.comment.curatorEvaluation?.perspective}
              </div>
            </Show>
          </Show>
        </div>
      </Show>

      {/* No response yet indicator */}
      <Show when={props.conversationTurns.length === 0 && props.comment.status === 'pending'}>
        <div class="awaiting-response">
          <span class="waiting-icon">⏳</span>
          <span>Awaiting curator review</span>
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

// Admin Context
const AdminContext: Component = () => {
  return (
    <div class="context-section">
      <h3>Node Administration</h3>
      <p class="context-description">
        Manage your nodes, configure curators, and review content.
      </p>
      
      <div class="context-info">
        <h4>Curator Features</h4>
        <ul class="admin-features">
          <li><strong>Auto-Respond:</strong> Curator automatically responds to new comments</li>
          <li><strong>Quality Gate:</strong> Set thresholds for publishing approval</li>
          <li><strong>Synthesis:</strong> Compile approved comments into narrative updates</li>
          <li><strong>Persona:</strong> Customize curator voice and expertise</li>
        </ul>
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
