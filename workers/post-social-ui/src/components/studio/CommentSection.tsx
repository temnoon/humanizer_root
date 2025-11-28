/**
 * CommentSection - Comments UI for narratives
 *
 * Features:
 * - View approved comments with curator responses
 * - Post new comments (with optional text selection)
 * - Curator auto-response generation
 * - Owner-only: view pending comments, approve/reject
 */

import { Component, createSignal, createResource, Show, For, createEffect } from 'solid-js';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import type { NarrativeComment, Narrative } from '@/types/models';

interface CommentSectionProps {
  narrative: Narrative;
  isOwner: boolean;
  onCommentAdded?: () => void;
}

export const CommentSection: Component<CommentSectionProps> = (props) => {
  // Comment form state
  const [newComment, setNewComment] = createSignal('');
  const [selectedText, setSelectedText] = createSignal('');
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [submitError, setSubmitError] = createSignal<string | null>(null);

  // View state
  const [showPending, setShowPending] = createSignal(false);
  const [expandedComment, setExpandedComment] = createSignal<string | null>(null);

  // Curator response state
  const [generatingResponseFor, setGeneratingResponseFor] = createSignal<string | null>(null);
  const [curatorResponses, setCuratorResponses] = createSignal<Record<string, string>>({});

  // Fetch approved comments
  const [approvedComments, { refetch: refetchApproved }] = createResource(
    () => props.narrative.id,
    async (narrativeId) => {
      try {
        return await nodesService.listComments(narrativeId, 'approved', authStore.token() || undefined);
      } catch (err) {
        console.error('Failed to load comments:', err);
        return [];
      }
    }
  );

  // Fetch pending comments (owner only)
  const [pendingComments, { refetch: refetchPending }] = createResource(
    () => props.isOwner ? props.narrative.id : null,
    async (narrativeId) => {
      if (!narrativeId) return [];
      try {
        return await nodesService.listComments(narrativeId, 'pending', authStore.token() || undefined);
      } catch (err) {
        console.error('Failed to load pending comments:', err);
        return [];
      }
    }
  );

  // Handle text selection for context quotes
  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      setSelectedText(selection.toString().trim());
    }
  };

  // Clear selected text
  const clearSelectedText = () => setSelectedText('');

  // Submit comment
  const handleSubmitComment = async () => {
    const content = newComment().trim();
    if (!content) return;

    const token = authStore.token();
    if (!token) {
      setSubmitError('Please log in to comment');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await nodesService.postComment(
        props.narrative.id,
        {
          content,
          contextQuote: selectedText() || undefined,
        },
        token
      );

      // Clear form
      setNewComment('');
      setSelectedText('');

      // Refresh comments
      refetchApproved();
      if (props.isOwner) refetchPending();

      props.onCommentAdded?.();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Approve comment (owner only)
  const handleApproveComment = async (commentId: string) => {
    const token = authStore.token();
    if (!token) return;

    try {
      await nodesService.evaluateComment(
        commentId,
        { status: 'approved', quality: 0.8, relevance: 0.8 },
        token
      );
      refetchApproved();
      refetchPending();
    } catch (err) {
      console.error('Failed to approve comment:', err);
    }
  };

  // Reject comment (owner only)
  const handleRejectComment = async (commentId: string) => {
    const token = authStore.token();
    if (!token) return;

    try {
      await nodesService.evaluateComment(
        commentId,
        { status: 'rejected', quality: 0.2, relevance: 0.2 },
        token
      );
      refetchPending();
    } catch (err) {
      console.error('Failed to reject comment:', err);
    }
  };

  // Generate curator response
  const handleGenerateCuratorResponse = async (comment: NarrativeComment) => {
    const token = authStore.token();
    if (!token) return;

    setGeneratingResponseFor(comment.id);

    try {
      // Get existing comments for context
      const existingComments = (approvedComments() || [])
        .filter(c => c.id !== comment.id)
        .map(c => c.content)
        .join('\n\n');

      const result = await nodesService.generateCuratorResponse(
        comment.content,
        props.narrative.content || '',
        existingComments || undefined,
        token
      );

      // Store response
      setCuratorResponses(prev => ({
        ...prev,
        [comment.id]: result.response
      }));
    } catch (err) {
      console.error('Failed to generate response:', err);
    } finally {
      setGeneratingResponseFor(null);
    }
  };

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div class="comment-section" onMouseUp={handleTextSelect}>
      <h3 class="comment-section-title">Comments</h3>

      {/* Selected Text Quote */}
      <Show when={selectedText()}>
        <div class="selected-quote">
          <div class="quote-label">Quoting:</div>
          <blockquote>"{selectedText().substring(0, 200)}{selectedText().length > 200 ? '...' : ''}"</blockquote>
          <button class="clear-quote-btn" onClick={clearSelectedText}>Clear</button>
        </div>
      </Show>

      {/* Comment Form */}
      <Show when={authStore.isAuthenticated()}>
        <div class="comment-form">
          <textarea
            class="comment-input"
            placeholder={selectedText() ? "Add your thoughts on this passage..." : "Share your thoughts or insights..."}
            value={newComment()}
            onInput={(e) => setNewComment(e.currentTarget.value)}
            maxLength={5000}
            rows={4}
          />
          <div class="comment-form-footer">
            <span class="char-count">{newComment().length}/5000</span>
            <button
              class="submit-comment-btn"
              onClick={handleSubmitComment}
              disabled={isSubmitting() || !newComment().trim()}
            >
              {isSubmitting() ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
          <Show when={submitError()}>
            <div class="comment-error">{submitError()}</div>
          </Show>
        </div>
      </Show>

      <Show when={!authStore.isAuthenticated()}>
        <div class="comment-login-prompt">
          Log in to join the discussion.
        </div>
      </Show>

      {/* Pending Comments (Owner Only) */}
      <Show when={props.isOwner && (pendingComments()?.length || 0) > 0}>
        <div class="pending-comments-section">
          <button
            class="pending-toggle"
            onClick={() => setShowPending(!showPending())}
          >
            {showPending() ? 'Hide' : 'Show'} Pending Comments ({pendingComments()?.length})
          </button>

          <Show when={showPending()}>
            <div class="pending-comments-list">
              <For each={pendingComments()}>
                {(comment) => (
                  <div class="comment-card pending">
                    <div class="comment-header">
                      <span class="comment-status pending">Pending Review</span>
                      <span class="comment-date">{formatDate(comment.createdAt)}</span>
                    </div>

                    <Show when={comment.context?.selectedText}>
                      <blockquote class="comment-quote">
                        "{comment.context?.selectedText}"
                      </blockquote>
                    </Show>

                    <div class="comment-content">{comment.content}</div>

                    <div class="comment-actions">
                      <button
                        class="approve-btn"
                        onClick={() => handleApproveComment(comment.id)}
                      >
                        Approve
                      </button>
                      <button
                        class="reject-btn"
                        onClick={() => handleRejectComment(comment.id)}
                      >
                        Reject
                      </button>
                      <button
                        class="generate-response-btn"
                        onClick={() => handleGenerateCuratorResponse(comment)}
                        disabled={generatingResponseFor() === comment.id}
                      >
                        {generatingResponseFor() === comment.id ? 'Generating...' : 'Generate Response'}
                      </button>
                    </div>

                    {/* Generated Curator Response */}
                    <Show when={curatorResponses()[comment.id]}>
                      <div class="curator-response-preview">
                        <div class="curator-label">Curator Response:</div>
                        <div class="curator-response-text">{curatorResponses()[comment.id]}</div>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      {/* Approved Comments */}
      <div class="approved-comments-section">
        <Show
          when={!approvedComments.loading}
          fallback={<div class="comments-loading">Loading comments...</div>}
        >
          <Show
            when={(approvedComments()?.length || 0) > 0}
            fallback={
              <div class="no-comments">
                No comments yet. Be the first to share your thoughts!
              </div>
            }
          >
            <div class="comments-list">
              <For each={approvedComments()}>
                {(comment) => (
                  <div
                    class={`comment-card ${expandedComment() === comment.id ? 'expanded' : ''}`}
                    onClick={() => setExpandedComment(
                      expandedComment() === comment.id ? null : comment.id
                    )}
                  >
                    <div class="comment-header">
                      <span class="comment-author">Anonymous Reader</span>
                      <span class="comment-date">{formatDate(comment.createdAt)}</span>
                    </div>

                    <Show when={comment.context?.selectedText}>
                      <blockquote class="comment-quote">
                        "{comment.context?.selectedText}"
                      </blockquote>
                    </Show>

                    <div class="comment-content">
                      {expandedComment() === comment.id
                        ? comment.content
                        : comment.content.substring(0, 300) + (comment.content.length > 300 ? '...' : '')
                      }
                    </div>

                    <Show when={comment.content.length > 300 && expandedComment() !== comment.id}>
                      <button class="expand-btn">Read more</button>
                    </Show>

                    {/* Curator Response (if available) */}
                    <Show when={comment.curatorResponse?.response}>
                      <div class="curator-response">
                        <div class="curator-label">Curator Response:</div>
                        <div class="curator-response-text">{comment.curatorResponse?.response}</div>
                      </div>
                    </Show>

                    {/* Owner Actions */}
                    <Show when={props.isOwner && expandedComment() === comment.id}>
                      <div class="comment-owner-actions">
                        <button
                          class="generate-response-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateCuratorResponse(comment);
                          }}
                          disabled={generatingResponseFor() === comment.id}
                        >
                          {generatingResponseFor() === comment.id ? 'Generating...' : 'Generate Response'}
                        </button>
                      </div>

                      <Show when={curatorResponses()[comment.id]}>
                        <div class="curator-response-preview">
                          <div class="curator-label">Generated Response:</div>
                          <div class="curator-response-text">{curatorResponses()[comment.id]}</div>
                        </div>
                      </Show>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
};
