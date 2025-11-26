/**
 * Post Detail Page - View single post with full content
 */

import { Component, createResource, Show } from 'solid-js';
import { useParams, useNavigate, A } from '@solidjs/router';
import { postsService } from '@/services/posts';
import { authStore } from '@/stores/auth';
import { PostDetail } from '@/components/post/PostDetail';
import { Button } from '@/components/ui/Button';

export const PostDetailPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  
  const [post, { refetch }] = createResource(
    () => params.id,
    async (id) => {
      const token = authStore.token();
      if (!token) {
        throw new Error('Authentication required');
      }
      return postsService.getById(id, token);
    }
  );

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div class="container" style={{ 'max-width': '900px', padding: 'var(--space-xl)' }}>
      {/* Header */}
      <div class="flex justify-between items-center" style={{ 'margin-bottom': 'var(--space-xl)' }}>
        <div class="flex items-center gap-md">
          <Button variant="ghost" onClick={handleBack}>
            ← Back
          </Button>
          <h1 style={{ 'font-size': 'var(--text-2xl)' }}>
            post<span style={{ color: 'var(--color-primary)' }}>-social</span>
          </h1>
        </div>
        <div class="flex gap-md">
          <A href="/dashboard">
            <Button variant="secondary">Dashboard</Button>
          </A>
          <A href="/feed">
            <Button variant="secondary">Feed</Button>
          </A>
        </div>
      </div>

      {/* Content */}
      <Show
        when={!post.loading && !post.error}
        fallback={
          <div style={{ 'text-align': 'center', padding: 'var(--space-3xl)' }}>
            <Show when={post.loading}>
              <p class="text-secondary">Loading post...</p>
            </Show>
            <Show when={post.error}>
              <div>
                <p class="text-error" style={{ 'margin-bottom': 'var(--space-md)' }}>
                  Failed to load post
                </p>
                <Button onClick={() => refetch()}>Retry</Button>
              </div>
            </Show>
          </div>
        }
      >
        <PostDetail post={post()!} />

        {/* Synthesis Status */}
        <Show when={post()?.synthesis_status !== 'none'}>
          <div 
            class="card"
            style={{ 
              'margin-top': 'var(--space-xl)',
              padding: 'var(--space-lg)',
              'border-left': '4px solid var(--color-accent)',
            }}
          >
            <h3 style={{ 'margin-bottom': 'var(--space-sm)' }}>
              Synthesis Status
            </h3>
            <p class="text-secondary">
              Status: <span style={{ color: 'var(--color-accent)' }}>
                {post()?.synthesis_status || 'none'}
              </span>
            </p>
            <Show when={post()?.synthesis_version}>
              <p class="text-secondary" style={{ 'margin-top': 'var(--space-xs)' }}>
                Version: {post()?.synthesis_version}
              </p>
            </Show>
          </div>
        </Show>

        {/* Similar Posts */}
        <Show when={post()?.tags?.length}>
          <div style={{ 'margin-top': 'var(--space-2xl)' }}>
            <h3 style={{ 'margin-bottom': 'var(--space-md)' }}>
              Related Posts
            </h3>
            <p class="text-secondary text-sm">
              Posts with similar tags will appear here (feature coming soon)
            </p>
          </div>
        </Show>

        {/* Comments Section (placeholder) */}
        <div style={{ 'margin-top': 'var(--space-2xl)' }}>
          <h3 style={{ 'margin-bottom': 'var(--space-md)' }}>
            Comments
          </h3>
          <p class="text-secondary text-sm">
            Comment system coming soon
          </p>
        </div>
      </Show>
    </div>
  );
};
