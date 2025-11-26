/**
 * Narrative Page
 * 
 * View a single narrative with its content, version history,
 * and comments. Shows version selector and comparison options.
 */

import { Component, createSignal, createResource, Show, For, createEffect } from 'solid-js';
import { A, useParams, useNavigate, useSearchParams } from '@solidjs/router';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import { Button } from '@/components/ui/Button';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import type { Narrative, NarrativeComment } from '@/types/models';

// Helper to format time
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

// Comment Item
const CommentItem: Component<{
  comment: NarrativeComment;
  isOwner: boolean;
  onEvaluate?: (id: string, status: 'approved' | 'rejected') => void;
}> = (props) => {
  return (
    <div class={`comment-item status-${props.comment.status}`}>
      <div class="comment-header">
        <span class="comment-author">{props.comment.authorEmail || 'Anonymous'}</span>
        <span class="comment-time">{formatTime(props.comment.createdAt)}</span>
        <span class={`comment-status ${props.comment.status}`}>
          {props.comment.status}
        </span>
      </div>
      
      <Show when={props.comment.context?.selectedText}>
        <div class="comment-context">
          <blockquote>"{props.comment.context?.selectedText}"</blockquote>
        </div>
      </Show>
      
      <div class="comment-content">
        <MarkdownRenderer content={props.comment.content} />
      </div>
      
      <Show when={props.comment.curatorEvaluation}>
        <div class="curator-evaluation">
          <span class="eval-label">Curator:</span>
          <span class="eval-quality">
            Quality: {(props.comment.curatorEvaluation!.quality! * 100).toFixed(0)}%
          </span>
          <span class="eval-relevance">
            Relevance: {(props.comment.curatorEvaluation!.relevance! * 100).toFixed(0)}%
          </span>
          <Show when={props.comment.curatorEvaluation!.perspective}>
            <span class="eval-perspective">
              {props.comment.curatorEvaluation!.perspective}
            </span>
          </Show>
        </div>
      </Show>
      
      <Show when={props.isOwner && props.comment.status === 'pending'}>
        <div class="comment-actions">
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => props.onEvaluate?.(props.comment.id, 'approved')}
          >
            Approve
          </Button>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => props.onEvaluate?.(props.comment.id, 'rejected')}
          >
            Reject
          </Button>
        </div>
      </Show>
    </div>
  );
};

export const NarrativePage: Component = () => {
  const params = useParams<{ nodeSlug: string; narrativeSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [showComments, setShowComments] = createSignal(false);
  const [newComment, setNewComment] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  
  // Get requested version from URL
  const requestedVersion = () => {
    const v = searchParams.version;
    return v ? parseInt(v) : null;
  };
  
  // Fetch narrative
  const [narrative, { refetch: refetchNarrative }] = createResource(
    () => ({ nodeSlug: params.nodeSlug, narrativeSlug: params.narrativeSlug, version: requestedVersion() }),
    async ({ nodeSlug, narrativeSlug, version }) => {
      try {
        return await nodesService.getNarrativeBySlug(
          nodeSlug, 
          narrativeSlug, 
          version || undefined,
          authStore.token() || undefined
        );
      } catch (err) {
        console.error('Failed to load narrative:', err);
        return null;
      }
    }
  );
  
  // Fetch comments
  const [comments, { refetch: refetchComments }] = createResource(
    () => narrative()?.id,
    async (narrativeId) => {
      if (!narrativeId) return [];
      try {
        return await nodesService.listComments(
          narrativeId,
          undefined,
          authStore.token() || undefined
        );
      } catch (err) {
        console.error('Failed to load comments:', err);
        return [];
      }
    }
  );
  
  // Check if owner
  const isOwner = () => narrative()?.isOwner || false;
  
  // Submit comment
  const handleSubmitComment = async () => {
    const narrativeData = narrative();
    const token = authStore.token();
    const content = newComment().trim();
    
    if (!narrativeData || !token || !content) return;
    
    setSubmitting(true);
    try {
      await nodesService.postComment(narrativeData.id, { content }, token);
      setNewComment('');
      refetchComments();
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmitting(false);
    }
  };
  
  // Evaluate comment
  const handleEvaluate = async (commentId: string, status: 'approved' | 'rejected') => {
    const token = authStore.token();
    if (!token) return;
    
    try {
      await nodesService.evaluateComment(commentId, { status }, token);
      refetchComments();
    } catch (err) {
      console.error('Failed to evaluate comment:', err);
    }
  };
  
  // Navigate to version
  const goToVersion = (version: number) => {
    navigate(`/node/${params.nodeSlug}/${params.narrativeSlug}?version=${version}`);
  };
  
  return (
    <div class="narrative-page">
      {/* Header */}
      <header class="narrative-header">
        <div class="header-nav">
          <A href={`/node/${params.nodeSlug}`} class="back-link">
            ← Back to {narrative()?.nodeName || 'Node'}
          </A>
        </div>
      </header>
      
      {/* Main Content */}
      <Show
        when={!narrative.loading}
        fallback={<div class="loading">Loading narrative...</div>}
      >
        <Show
          when={narrative()}
          fallback={
            <div class="not-found">
              <h2>Narrative not found</h2>
              <p>This narrative doesn't exist or you don't have access.</p>
            </div>
          }
        >
          <main class="narrative-content">
            {/* Title & Meta */}
            <div class="narrative-title-section">
              <h1 class="narrative-title">{narrative()!.title}</h1>
              
              <div class="narrative-meta">
                <span class="meta-item">
                  <A href={`/node/${params.nodeSlug}`}>{narrative()!.nodeName}</A>
                </span>
                
                <span class="meta-item version-info">
                  Version {requestedVersion() || narrative()!.currentVersion}
                  <Show when={requestedVersion() && requestedVersion() !== narrative()!.currentVersion}>
                    <span class="viewing-old"> (viewing old version)</span>
                  </Show>
                </span>
                
                <Show when={narrative()!.metadata?.readingTime}>
                  <span class="meta-item">{narrative()!.metadata.readingTime} min read</span>
                </Show>
              </div>
              
              {/* Tags */}
              <Show when={narrative()!.metadata?.tags?.length}>
                <div class="narrative-tags">
                  <For each={narrative()!.metadata.tags}>
                    {(tag) => <span class="tag">{tag}</span>}
                  </For>
                </div>
              </Show>
            </div>
            
            {/* Version Selector */}
            <Show when={narrative()!.versions && narrative()!.versions!.length > 1}>
              <div class="version-selector">
                <span class="version-label">Versions:</span>
                <div class="version-buttons">
                  <For each={narrative()!.versions}>
                    {(v) => (
                      <button
                        class={`version-btn ${(requestedVersion() || narrative()!.currentVersion) === v.version ? 'active' : ''}`}
                        onClick={() => goToVersion(v.version)}
                      >
                        v{v.version}
                      </button>
                    )}
                  </For>
                </div>
                
                <Show when={narrative()!.currentVersion > 1}>
                  <A 
                    href={`/node/${params.nodeSlug}/${params.narrativeSlug}/compare?from=1&to=${narrative()!.currentVersion}`}
                    class="compare-link"
                  >
                    Compare versions
                  </A>
                </Show>
              </div>
            </Show>
            
            {/* Content */}
            <article class="narrative-body">
              <MarkdownRenderer content={narrative()!.content} />
            </article>
            
            {/* Synthesis Status */}
            <Show when={narrative()!.synthesis?.pendingComments > 0}>
              <div class="synthesis-status">
                <span class="synthesis-icon">⚗️</span>
                <span class="synthesis-text">
                  {narrative()!.synthesis.pendingComments} comments awaiting synthesis
                </span>
              </div>
            </Show>
            
            {/* Comments Section */}
            <div class="comments-section">
              <button 
                class="comments-toggle"
                onClick={() => setShowComments(!showComments())}
              >
                {showComments() ? '▼' : '▶'} Comments ({comments()?.length || 0})
              </button>
              
              <Show when={showComments()}>
                <div class="comments-container">
                  {/* Comment Form */}
                  <Show when={authStore.isAuthenticated()}>
                    <div class="comment-form">
                      <textarea
                        placeholder="Share your thoughts on this narrative..."
                        value={newComment()}
                        onInput={(e) => setNewComment(e.currentTarget.value)}
                        rows={3}
                      />
                      <div class="form-actions">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSubmitComment}
                          disabled={submitting() || !newComment().trim()}
                        >
                          {submitting() ? 'Posting...' : 'Post Comment'}
                        </Button>
                      </div>
                    </div>
                  </Show>
                  
                  {/* Comments List */}
                  <Show
                    when={comments()?.length}
                    fallback={
                      <p class="no-comments">No comments yet. Be the first to share your perspective!</p>
                    }
                  >
                    <div class="comments-list">
                      <For each={comments()}>
                        {(comment) => (
                          <CommentItem 
                            comment={comment}
                            isOwner={isOwner()}
                            onEvaluate={handleEvaluate}
                          />
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          </main>
        </Show>
      </Show>
    </div>
  );
};
