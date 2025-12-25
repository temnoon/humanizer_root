/**
 * Archive Types
 *
 * Structures for imported archives - the raw material of your density matrix
 */

import type { Sentence, ArchiveType } from '@humanizer/core';

/**
 * A conversation from any source (ChatGPT, Messenger, etc.)
 */
export interface Conversation {
  /** Unique identifier */
  id: string;

  /** Title if available */
  title?: string;

  /** Source archive type */
  source: ArchiveType;

  /** When the conversation started */
  createdAt: Date;

  /** Last activity */
  updatedAt: Date;

  /** Messages in chronological order */
  messages: Message[];

  /** Metadata from the source */
  metadata?: Record<string, unknown>;
}

/**
 * A single message within a conversation
 */
export interface Message {
  /** Unique identifier */
  id: string;

  /** Who sent this message */
  author: MessageAuthor;

  /** The message content */
  content: string;

  /** When it was sent */
  timestamp: Date;

  /** Content type */
  contentType: 'text' | 'code' | 'image' | 'audio' | 'file';

  /** Attachments if any */
  attachments?: Attachment[];

  /** Sentences extracted from this message */
  sentences?: Sentence[];

  /** Parent message ID for threading */
  parentId?: string;
}

export interface MessageAuthor {
  /** Author type */
  role: 'user' | 'assistant' | 'system' | 'human' | 'other';

  /** Display name if known */
  name?: string;

  /** Identifier from source */
  id?: string;
}

export interface Attachment {
  /** Attachment type */
  type: 'image' | 'audio' | 'file' | 'code';

  /** Original filename */
  filename: string;

  /** Path in archive */
  path: string;

  /** MIME type */
  mimeType?: string;

  /** Size in bytes */
  size?: number;
}

/**
 * Import job tracking
 */
export interface ImportJob {
  /** Job ID */
  id: string;

  /** Source path */
  sourcePath: string;

  /** Detected archive type */
  archiveType: ArchiveType;

  /** Current status */
  status: ImportStatus;

  /** Progress info */
  progress: ImportProgress;

  /** When started */
  startedAt: Date;

  /** When completed */
  completedAt?: Date;

  /** Any errors */
  errors: ImportError[];
}

export type ImportStatus =
  | 'pending'
  | 'scanning'
  | 'parsing'
  | 'indexing'
  | 'complete'
  | 'failed';

export interface ImportProgress {
  phase: string;
  current: number;
  total: number;
  message?: string;
}

export interface ImportError {
  file?: string;
  message: string;
  recoverable: boolean;
}

/**
 * Parsed archive ready for indexing
 */
export interface ParsedArchive {
  /** Source type */
  type: ArchiveType;

  /** Source path */
  sourcePath: string;

  /** All conversations found */
  conversations: Conversation[];

  /** Statistics */
  stats: ArchiveStats;

  /** Media files found */
  media: MediaFile[];
}

export interface ArchiveStats {
  conversationCount: number;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  wordCount: number;
  dateRange: {
    earliest?: Date;
    latest?: Date;
  };
}

export interface MediaFile {
  /** Original path in archive */
  originalPath: string;

  /** Type of media */
  type: 'image' | 'audio' | 'video' | 'document';

  /** Associated message ID if known */
  messageId?: string;

  /** File size */
  size: number;
}
