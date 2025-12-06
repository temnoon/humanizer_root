/**
 * Buffer Content Types
 *
 * Type definitions for all content types that can be stored in the
 * unified buffer system. Each content type preserves its structure
 * and metadata for rich display and tool processing.
 */

import type {
  BufferMetadata,
  MediaRef,
  AuthorMeta,
  TimestampMeta,
} from './buffer-metadata';

// ============================================================
// CONTENT TYPE DISCRIMINATOR
// ============================================================

export type BufferContentType =
  | 'text'
  | 'message'
  | 'conversation'
  | 'facebook-post'
  | 'facebook-comment'
  | 'media'
  | 'collection';

// ============================================================
// BASE INTERFACE
// ============================================================

export interface BufferContentBase {
  /** Unique buffer ID */
  id: string;
  /** Content type discriminator */
  contentType: BufferContentType;
  /** Display name for UI */
  displayName: string;
  /** Full metadata object */
  metadata: BufferMetadata;
  /** Buffer creation timestamp (ISO string) */
  bufferCreatedAt: string;
}

// ============================================================
// TEXT CONTENT
// ============================================================

export interface TextContent extends BufferContentBase {
  contentType: 'text';
  /** The text content */
  text: string;
  /** Text format */
  format: 'plain' | 'markdown';
}

// ============================================================
// MESSAGE CONTENT (single conversation message)
// ============================================================

export interface MessageContent extends BufferContentBase {
  contentType: 'message';
  /** Message text */
  text: string;
  /** Message role */
  role: 'user' | 'assistant' | 'system';
  /** Parent conversation reference */
  conversation?: {
    id: string;
    title: string;
    folder: string;
  };
}

// ============================================================
// CONVERSATION CONTENT (full conversation)
// ============================================================

export interface ConversationMessage {
  /** Message ID */
  id: string;
  /** Message text */
  text: string;
  /** Role */
  role: 'user' | 'assistant' | 'system';
  /** Message-level metadata */
  metadata?: {
    timestamps?: TimestampMeta;
    author?: AuthorMeta;
    media?: MediaRef[];
  };
}

export interface ConversationStats {
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  totalWordCount: number;
  startDate?: number;
  endDate?: number;
  durationMinutes?: number;
}

export interface ConversationContent extends BufferContentBase {
  contentType: 'conversation';
  /** Conversation title */
  title: string;
  /** Folder path */
  folder: string;
  /** All messages with their metadata */
  messages: ConversationMessage[];
  /** Summary statistics */
  stats: ConversationStats;
}

// ============================================================
// FACEBOOK POST CONTENT
// ============================================================

export interface FacebookComment {
  /** Comment text */
  text: string;
  /** Comment metadata */
  metadata?: {
    timestamps?: TimestampMeta;
    author?: AuthorMeta;
    media?: MediaRef[];
  };
}

export interface FacebookPostContent extends BufferContentBase {
  contentType: 'facebook-post';
  /** Post text */
  text: string;
  /** Post type */
  postType?: 'status' | 'photo' | 'link' | 'video' | 'note' | 'check-in';
  /** Comments on the post */
  comments?: FacebookComment[];
  /** Comment count */
  commentCount?: number;
  /** Reactions/likes if available */
  reactions?: {
    total?: number;
    types?: Record<string, number>;
  };
  /** Shared link preview */
  sharedLink?: {
    url: string;
    title?: string;
    description?: string;
  };
}

// ============================================================
// FACEBOOK COMMENT CONTENT (standalone)
// ============================================================

export interface FacebookCommentContent extends BufferContentBase {
  contentType: 'facebook-comment';
  /** Comment text */
  text: string;
  /** Parent post reference */
  parentPost?: {
    id: string;
    text?: string;
    author?: string;
  };
}

// ============================================================
// MEDIA CONTENT
// ============================================================

export interface MediaContent extends BufferContentBase {
  contentType: 'media';
  /** Primary media reference */
  media: MediaRef;
  /** Context about where this media appeared */
  context?: {
    conversationId?: string;
    conversationTitle?: string;
    messageIndex?: number;
    postId?: string;
  };
}

// ============================================================
// COLLECTION CONTENT
// ============================================================

export interface CollectionStats {
  itemCount: number;
  contentTypes: Partial<Record<BufferContentType, number>>;
  dateRange?: { start: number; end: number };
}

export interface CollectionContent extends BufferContentBase {
  contentType: 'collection';
  /** Collection items (any buffer content type) */
  items: BufferContent[];
  /** How the collection was created */
  collectionType: 'manual' | 'search' | 'cluster' | 'filter' | 'date-range';
  /** Search/filter query if applicable */
  query?: string;
  /** Collection statistics */
  stats?: CollectionStats;
}

// ============================================================
// UNION TYPE
// ============================================================

export type BufferContent =
  | TextContent
  | MessageContent
  | ConversationContent
  | FacebookPostContent
  | FacebookCommentContent
  | MediaContent
  | CollectionContent;

// ============================================================
// TYPE GUARDS
// ============================================================

export function isTextContent(content: BufferContent): content is TextContent {
  return content.contentType === 'text';
}

export function isMessageContent(content: BufferContent): content is MessageContent {
  return content.contentType === 'message';
}

export function isConversationContent(content: BufferContent): content is ConversationContent {
  return content.contentType === 'conversation';
}

export function isFacebookPostContent(content: BufferContent): content is FacebookPostContent {
  return content.contentType === 'facebook-post';
}

export function isFacebookCommentContent(content: BufferContent): content is FacebookCommentContent {
  return content.contentType === 'facebook-comment';
}

export function isMediaContent(content: BufferContent): content is MediaContent {
  return content.contentType === 'media';
}

export function isCollectionContent(content: BufferContent): content is CollectionContent {
  return content.contentType === 'collection';
}

// ============================================================
// RE-EXPORT METADATA TYPES
// ============================================================

export type {
  BufferMetadata,
  MediaRef,
  AuthorMeta,
  TimestampMeta,
  LinkRef,
  ContentStatsMeta,
  SourceMeta,
  TransformationRecord,
  TransformationHistoryMeta,
  SemanticMeta,
  TagsMeta,
  LocationMeta,
} from './buffer-metadata';
