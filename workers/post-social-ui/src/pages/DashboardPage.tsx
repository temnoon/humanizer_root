/**
 * Dashboard Page
 */

import { Component, createSignal, createResource, Show, For } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { authStore } from '@/stores/auth';
import { postsService } from '@/services/posts';
import { PostComposer } from '@/components/post/PostComposer';
import { PostCard } from '@/components/post/PostCard';
import { Button } from '@/components/ui/Button';

export const DashboardPage: Component = () => {
  const navigate = useNavigate();
  
  if (!authStore.isAuthenticated()) {
    navigate('/login');
    return null;
  }

  const [posts, { refetch }] = createResource(() => authStore.token(), async (token) => {
    if (!token) return [];
    try {
      const data = await postsService.getUserPosts(token);
      return data.posts;
    } catch (err) {
      console.error('Failed to load posts:', err);
      return [];
    }
  });

  const handleLogout = () => {
    authStore.logout();
    navigate('/login');
  };

  return (
    <div class="container" style={{ 'max-width': '800px', padding: 'var(--space-xl)' }}>
      <div class="flex justify-between items-center" style={{ 'margin-bottom': 'var(--space-xl)' }}>
        <div>
          <h1 style={{ 'font-size': 'var(--text-2xl)', 'margin-bottom': 'var(--space-xs)' }}>
            post<span style={{ color: 'var(--color-primary)' }}>-social</span>
          </h1>
          <p class="text-secondary text-sm">Welcome back, {authStore.user()?.email}</p>
        </div>
        <div class="flex gap-md">
          <A href="/search">
            <Button variant="secondary">Search</Button>
          </A>
          <A href="/feed">
            <Button variant="secondary">Feed</Button>
          </A>
          <Button variant="ghost" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      <PostComposer onSuccess={refetch} />

      <div style={{ 'margin-top': 'var(--space-xl)' }}>
        <h2 style={{ 'margin-bottom': 'var(--space-lg)' }}>Your Posts</h2>
        
        <Show
          when={!posts.loading}
          fallback={<div class="text-center text-secondary">Loading posts...</div>}
        >
          <Show
            when={posts()?.length}
            fallback={
              <div style={{
                'text-align': 'center',
                padding: 'var(--space-3xl)',
                color: 'var(--color-text-secondary)',
              }}>
                <p>No posts yet. Share your first thought above!</p>
              </div>
            }
          >
            <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
              <For each={posts()}>
                {(post) => <PostCard post={post} />}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
};
