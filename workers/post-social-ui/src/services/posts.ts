/**
 * Posts Service
 */

import { api } from './api';
import type { Post, SearchResult, Tag } from '@/types/models';

export const postsService = {
  // Create post
  async create(content: string, visibility: 'public' | 'private' = 'public', token: string) {
    return api.post<{ post: Post }>('/api/posts', { content, visibility }, token);
  },

  // Get user's posts
  async getUserPosts(token: string) {
    return api.get<{ posts: Post[] }>('/api/posts', token);
  },

  // Get public feed
  async getFeed() {
    return api.get<{ posts: Post[] }>('/api/posts/feed');
  },

  // Get single post
  async getById(id: string, token?: string) {
    return api.get<{ post: Post }>(`/api/posts/${id}`, token);
  },

  // Search posts
  async search(query: string, tags?: string[], token?: string) {
    return api.post<{ results: SearchResult[] }>(
      '/api/search',
      { query, tags, limit: 20 },
      token
    );
  },

  // Get all tags
  async getTags() {
    return api.get<{ tags: Tag[] }>('/api/posts/tags');
  },

  // Get similar posts
  async getSimilar(postId: string, token?: string) {
    return api.get<{ results: SearchResult[] }>(`/api/search/similar/${postId}`, token);
  },
};
