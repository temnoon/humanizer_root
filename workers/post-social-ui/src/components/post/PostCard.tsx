/**
 * Post Card Component
 */

import { Component } from 'solid-js';
import { A } from '@solidjs/router';
import type { Post } from '@/types/models';
import { stripMarkdown, truncate } from '@/utils/markdown';

interface PostCardProps {
  post: Post;
}

export const PostCard: Component<PostCardProps> = (props) => {
  const preview = () => {
    const plain = stripMarkdown(props.post.content);
    return truncate(plain, 300);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
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
    <A href={`/post/${props.post.id}`} class="card" style={{ display: 'block', 'text-decoration': 'none' }}>
      {props.post.summary && (
        <div style={{
          'font-style': 'italic',
          color: 'var(--color-text-secondary)',
          'margin-bottom': 'var(--space-md)',
          'padding': 'var(--space-sm)',
          background: 'var(--color-bg-secondary)',
          'border-left': '3px solid var(--color-accent)',
          'border-radius': 'var(--radius-sm)',
        }}>
          "{props.post.summary}"
        </div>
      )}

      <div style={{ 'margin-bottom': 'var(--space-md)', 'line-height': 'var(--line-height-relaxed)' }}>
        {preview()}
      </div>

      {tags().length > 0 && (
        <div class="flex gap-sm" style={{ 'flex-wrap': 'wrap', 'margin-bottom': 'var(--space-md)' }}>
          {tags().map((tag: string) => (
            <span class="tag">{tag}</span>
          ))}
        </div>
      )}

      <div class="flex gap-md text-secondary text-sm">
        <span>{formatDate(props.post.created_at)}</span>
        <span>•</span>
        <span>{props.post.visibility}</span>
        {props.post.version > 1 && (
          <>
            <span>•</span>
            <span>v{props.post.version}</span>
          </>
        )}
      </div>
    </A>
  );
};
