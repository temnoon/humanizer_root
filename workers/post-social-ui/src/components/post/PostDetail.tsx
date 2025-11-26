/**
 * Post Detail Component
 */

import { Component, createEffect } from 'solid-js';
import type { Post } from '@/types/models';
import { renderMarkdown } from '@/utils/markdown';

interface PostDetailProps {
  post: Post;
}

export const PostDetail: Component<PostDetailProps> = (props) => {
  let contentRef: HTMLDivElement | undefined;

  createEffect(() => {
    if (contentRef) {
      contentRef.innerHTML = renderMarkdown(props.post.content);
    }
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const tags = () => {
    if (!props.post.tags) return [];
    return Array.isArray(props.post.tags) 
      ? props.post.tags 
      : JSON.parse(props.post.tags as any);
  };

  return (
    <div class="card">
      {props.post.summary && (
        <div style={{
          'font-style': 'italic',
          color: 'var(--color-text-secondary)',
          'margin-bottom': 'var(--space-lg)',
          padding: 'var(--space-md)',
          background: 'var(--color-bg-secondary)',
          'border-left': '3px solid var(--color-accent)',
          'border-radius': 'var(--radius-sm)',
        }}>
          "{props.post.summary}"
        </div>
      )}

      <div
        ref={contentRef}
        class="markdown"
        style={{
          'margin': 'var(--space-lg) 0',
          'line-height': 'var(--line-height-relaxed)',
        }}
      />

      {tags().length > 0 && (
        <div class="flex gap-sm" style={{ 'flex-wrap': 'wrap', 'margin': 'var(--space-lg) 0' }}>
          {tags().map((tag: string) => (
            <span class="tag">{tag}</span>
          ))}
        </div>
      )}

      <div class="text-secondary text-sm" style={{ 'margin-top': 'var(--space-lg)', 'padding-top': 'var(--space-lg)', 'border-top': '1px solid var(--color-border)' }}>
        <div>Posted: {formatDate(props.post.created_at)}</div>
        <div>Visibility: {props.post.visibility}</div>
        <div>Status: {props.post.status}</div>
        {props.post.version > 1 && <div>Version: {props.post.version}</div>}
      </div>
    </div>
  );
};
