/**
 * Search Page - Search posts by query and tags
 */

import { Component, createSignal, createResource, Show, For } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { postsService } from '@/services/posts';
import { authStore } from '@/stores/auth';
import { PostCard } from '@/components/post/PostCard';
import { Button } from '@/components/ui/Button';

export const SearchPage: Component = () => {
  const navigate = useNavigate();
  const [query, setQuery] = createSignal('');
  const [debouncedQuery, setDebouncedQuery] = createSignal('');
  const [selectedTag, setSelectedTag] = createSignal<string | null>(null);

  // Debounce search query
  let debounceTimer: number;
  const handleQueryChange = (value: string) => {
    setQuery(value);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      setDebouncedQuery(value);
    }, 300) as unknown as number;
  };

  // Load popular tags
  const [tags] = createResource(
    () => authStore.token(),
    async (token) => {
      if (!token) return [];
      try {
        return await postsService.getTags(token);
      } catch (err) {
        console.error('Failed to load tags:', err);
        return [];
      }
    }
  );

  // Search results
  const [results] = createResource(
    () => ({ query: debouncedQuery(), tag: selectedTag(), token: authStore.token() }),
    async ({ query, tag, token }) => {
      if (!token) return { posts: [], total: 0 };
      if (!query && !tag) return { posts: [], total: 0 };
      
      try {
        const params: any = {};
        if (query) params.query = query;
        if (tag) params.tags = [tag];
        
        return await postsService.search(params, token);
      } catch (err) {
        console.error('Search failed:', err);
        return { posts: [], total: 0 };
      }
    }
  );

  const handleTagClick = (tag: string) => {
    if (selectedTag() === tag) {
      setSelectedTag(null);
    } else {
      setSelectedTag(tag);
    }
  };

  if (!authStore.isAuthenticated()) {
    navigate('/login');
    return null;
  }

  return (
    <div class="container" style={{ 'max-width': '900px', padding: 'var(--space-xl)' }}>
      {/* Header */}
      <div class="flex justify-between items-center" style={{ 'margin-bottom': 'var(--space-xl)' }}>
        <h1 style={{ 'font-size': 'var(--text-2xl)' }}>
          post<span style={{ color: 'var(--color-primary)' }}>-social</span>
        </h1>
        <div class="flex gap-md">
          <A href="/dashboard">
            <Button variant="secondary">Dashboard</Button>
          </A>
          <A href="/feed">
            <Button variant="secondary">Feed</Button>
          </A>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ 'margin-bottom': 'var(--space-xl)' }}>
        <h2 style={{ 'margin-bottom': 'var(--space-md)' }}>Search Posts</h2>
        <input
          type="text"
          placeholder="Search by content or tags..."
          value={query()}
          onInput={(e) => handleQueryChange(e.currentTarget.value)}
          class="input"
          style={{
            width: '100%',
            padding: 'var(--space-md)',
            'font-size': 'var(--text-base)',
            border: '1px solid var(--color-border)',
            'border-radius': 'var(--radius-md)',
            background: 'var(--color-bg-card)',
            color: 'var(--color-text)',
          }}
        />
      </div>

      {/* Popular Tags */}
      <Show when={!tags.loading && tags()?.length}>
        <div style={{ 'margin-bottom': 'var(--space-2xl)' }}>
          <h3 style={{ 'margin-bottom': 'var(--space-md)', 'font-size': 'var(--text-base)' }}>
            Popular Tags
          </h3>
          <div class="flex" style={{ gap: 'var(--space-sm)', 'flex-wrap': 'wrap' }}>
            <For each={tags()}>
              {(tag) => (
                <button
                  onClick={() => handleTagClick(tag.tag)}
                  class="tag"
                  style={{
                    padding: 'var(--space-xs) var(--space-md)',
                    'border-radius': 'var(--radius-full)',
                    border: '1px solid var(--color-border)',
                    background: selectedTag() === tag.tag 
                      ? 'var(--color-primary)' 
                      : 'var(--color-bg-card)',
                    color: selectedTag() === tag.tag 
                      ? 'white' 
                      : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    'font-size': 'var(--text-sm)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  #{tag.tag} ({tag.count})
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Active Filters */}
      <Show when={query() || selectedTag()}>
        <div style={{ 'margin-bottom': 'var(--space-lg)' }}>
          <div class="flex items-center gap-md">
            <span class="text-secondary text-sm">Active filters:</span>
            <Show when={query()}>
              <span 
                class="tag"
                style={{
                  padding: 'var(--space-xs) var(--space-sm)',
                  background: 'var(--color-bg-elevated)',
                  'border-radius': 'var(--radius-md)',
                  'font-size': 'var(--text-sm)',
                }}
              >
                Query: "{query()}"
              </span>
            </Show>
            <Show when={selectedTag()}>
              <span 
                class="tag"
                style={{
                  padding: 'var(--space-xs) var(--space-sm)',
                  background: 'var(--color-primary)',
                  color: 'white',
                  'border-radius': 'var(--radius-md)',
                  'font-size': 'var(--text-sm)',
                }}
              >
                Tag: #{selectedTag()}
              </span>
            </Show>
            <button
              onClick={() => {
                setQuery('');
                setDebouncedQuery('');
                setSelectedTag(null);
              }}
              class="text-sm"
              style={{ color: 'var(--color-error)', cursor: 'pointer' }}
            >
              Clear all
            </button>
          </div>
        </div>
      </Show>

      {/* Results */}
      <div>
        <Show
          when={!results.loading}
          fallback={
            <div class="text-center text-secondary" style={{ padding: 'var(--space-3xl)' }}>
              Searching...
            </div>
          }
        >
          <Show
            when={results()?.posts?.length}
            fallback={
              <div 
                style={{
                  'text-align': 'center',
                  padding: 'var(--space-3xl)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <Show
                  when={query() || selectedTag()}
                  fallback={<p>Enter a search query or select a tag to begin</p>}
                >
                  <p>No posts found matching your search</p>
                </Show>
              </div>
            }
          >
            <div style={{ 'margin-bottom': 'var(--space-lg)' }}>
              <p class="text-secondary text-sm">
                Found {results()?.total || 0} result{results()?.total !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
              <For each={results()?.posts}>
                {(post) => <PostCard post={post} />}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
};
