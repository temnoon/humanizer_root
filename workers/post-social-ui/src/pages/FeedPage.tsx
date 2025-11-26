/**
 * Feed Page - Public feed of all posts
 */

import { Component, createResource, Show, For, createSignal } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { postsService } from '@/services/posts';
import { authStore } from '@/stores/auth';
import { PostCard } from '@/components/post/PostCard';
import { Button } from '@/components/ui/Button';

export const FeedPage: Component = () => {
  const navigate = useNavigate();
  const [page, setPage] = createSignal(1);
  const [sortBy, setSortBy] = createSignal<'recent' | 'popular'>('recent');

  const [feed, { refetch }] = createResource(
    () => ({ 
      page: page(), 
      sortBy: sortBy(),
      token: authStore.token() 
    }),
    async ({ page, sortBy, token }) => {
      try {
        return await postsService.getFeed({
          page,
          limit: 20,
          sort_by: sortBy,
        }, token || undefined);
      } catch (err) {
        console.error('Failed to load feed:', err);
        return { posts: [], total: 0, page: 1, total_pages: 1 };
      }
    }
  );

  const handleSortChange = (newSort: 'recent' | 'popular') => {
    setSortBy(newSort);
    setPage(1);
  };

  const handleNextPage = () => {
    if (page() < (feed()?.total_pages || 1)) {
      setPage(page() + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevPage = () => {
    if (page() > 1) {
      setPage(page() - 1);
      window.scrollTo(0, 0);
    }
  };

  return (
    <div class="container" style={{ 'max-width': '900px', padding: 'var(--space-xl)' }}>
      {/* Header */}
      <div class="flex justify-between items-center" style={{ 'margin-bottom': 'var(--space-xl)' }}>
        <div>
          <h1 style={{ 'font-size': 'var(--text-2xl)', 'margin-bottom': 'var(--space-xs)' }}>
            post<span style={{ color: 'var(--color-primary)' }}>-social</span>
          </h1>
          <p class="text-secondary text-sm">Public feed of all posts</p>
        </div>
        <div class="flex gap-md">
          <Show
            when={authStore.isAuthenticated()}
            fallback={
              <A href="/login">
                <Button variant="primary">Sign In</Button>
              </A>
            }
          >
            <A href="/dashboard">
              <Button variant="secondary">Dashboard</Button>
            </A>
            <A href="/search">
              <Button variant="secondary">Search</Button>
            </A>
          </Show>
        </div>
      </div>

      {/* Sort Controls */}
      <div class="flex justify-between items-center" style={{ 'margin-bottom': 'var(--space-lg)' }}>
        <div class="flex gap-sm">
          <button
            onClick={() => handleSortChange('recent')}
            class="btn"
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              'border-radius': 'var(--radius-md)',
              border: sortBy() === 'recent' 
                ? '2px solid var(--color-primary)' 
                : '1px solid var(--color-border)',
              background: sortBy() === 'recent' 
                ? 'var(--color-primary-light)' 
                : 'var(--color-bg-card)',
              color: sortBy() === 'recent' 
                ? 'var(--color-primary)' 
                : 'var(--color-text-secondary)',
              cursor: 'pointer',
              'font-size': 'var(--text-sm)',
            }}
          >
            Recent
          </button>
          <button
            onClick={() => handleSortChange('popular')}
            class="btn"
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              'border-radius': 'var(--radius-md)',
              border: sortBy() === 'popular' 
                ? '2px solid var(--color-primary)' 
                : '1px solid var(--color-border)',
              background: sortBy() === 'popular' 
                ? 'var(--color-primary-light)' 
                : 'var(--color-bg-card)',
              color: sortBy() === 'popular' 
                ? 'var(--color-primary)' 
                : 'var(--color-text-secondary)',
              cursor: 'pointer',
              'font-size': 'var(--text-sm)',
            }}
          >
            Popular
          </button>
        </div>
        <Show when={feed()?.total}>
          <p class="text-secondary text-sm">
            {feed()?.total || 0} total posts
          </p>
        </Show>
      </div>

      {/* Feed */}
      <Show
        when={!feed.loading}
        fallback={
          <div class="text-center text-secondary" style={{ padding: 'var(--space-3xl)' }}>
            Loading feed...
          </div>
        }
      >
        <Show
          when={feed()?.posts?.length}
          fallback={
            <div 
              style={{
                'text-align': 'center',
                padding: 'var(--space-3xl)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <p>No posts yet. Be the first to share!</p>
              <Show when={!authStore.isAuthenticated()}>
                <A href="/login">
                  <Button variant="primary" style={{ 'margin-top': 'var(--space-lg)' }}>
                    Sign in to post
                  </Button>
                </A>
              </Show>
            </div>
          }
        >
          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
            <For each={feed()?.posts}>
              {(post) => <PostCard post={post} />}
            </For>
          </div>

          {/* Pagination */}
          <Show when={(feed()?.total_pages || 0) > 1}>
            <div 
              class="flex justify-between items-center" 
              style={{ 
                'margin-top': 'var(--space-2xl)',
                padding: 'var(--space-lg)',
                'border-top': '1px solid var(--color-border)',
              }}
            >
              <Button
                variant="secondary"
                onClick={handlePrevPage}
                disabled={page() === 1}
              >
                ← Previous
              </Button>
              
              <span class="text-secondary text-sm">
                Page {page()} of {feed()?.total_pages || 1}
              </span>
              
              <Button
                variant="secondary"
                onClick={handleNextPage}
                disabled={page() >= (feed()?.total_pages || 1)}
              >
                Next →
              </Button>
            </div>
          </Show>
        </Show>
      </Show>

      {/* Footer Info */}
      <div 
        style={{ 
          'margin-top': 'var(--space-3xl)',
          padding: 'var(--space-xl)',
          'border-top': '1px solid var(--color-border)',
          'text-align': 'center',
        }}
      >
        <p class="text-secondary text-sm" style={{ 'margin-bottom': 'var(--space-sm)' }}>
          <em>"Synthesis over engagement. Understanding over virality."</em>
        </p>
        <p class="text-secondary text-sm">
          Part of the <a 
            href="https://humanizer.com" 
            style={{ color: 'var(--color-primary)' }}
          >Humanizer</a> ecosystem
        </p>
      </div>
    </div>
  );
};
