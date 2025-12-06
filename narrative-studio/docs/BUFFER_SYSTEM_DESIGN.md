# Buffer System Design: Unified Content Flow

**Date**: December 3, 2025
**Status**: Design Phase
**Author**: Claude

---

## Overview

The buffer system serves as the "lingua franca" between all content sources (Archive Panel) and all tools (Tools Panel). Any content type can be sent to a buffer, and any tool can read from and write to buffers.

---

## Current State Analysis

### Existing Buffer System (`SessionBuffer`)

```typescript
// Current: sessionStorage.ts
interface SessionBuffer {
  bufferId: string;
  type: 'original' | 'transformation' | 'analysis' | 'edited';
  displayName: string;
  sourceBufferId?: string;
  sourceRef?: string;           // "archive:main:messageId"
  text?: string;                // Original text
  resultText?: string;          // Transformed text
  analysisResult?: any;         // Analysis results
  metadata?: Record<string, any>;
}
```

### Current Content Flow

```
Archive Panel → Narrative (text only) → Tools Panel
                     ↓
               MainWorkspace
```

### Limitations

1. **Text-only**: Only `string` content supported
2. **No structured metadata**: Facebook posts lose their comments, images
3. **No collections**: Can't send multiple items as a group
4. **Tight coupling**: Tools receive `content: string` prop directly

---

## Proposed Architecture

### Content Type Hierarchy

```
BufferContent (base)
├── TextContent          - Plain text or markdown
├── MessageContent       - Single conversation message
├── ConversationContent  - Full conversation with all messages
├── FacebookPostContent  - Post with comments and media
├── FacebookCommentContent - Single comment
├── MediaContent         - Image, audio reference
└── CollectionContent    - Array of any content types
```

---

## Comprehensive Metadata Schema

All buffer content includes rich metadata preserved from sources.

### Core Metadata Types

```typescript
// src/types/buffer-metadata.ts

// ============================================================
// TIMESTAMP METADATA
// ============================================================

export interface TimestampMeta {
  /** Unix timestamp (milliseconds) when content was created */
  createdAt?: number;
  /** Unix timestamp when content was last modified */
  updatedAt?: number;
  /** ISO 8601 date string for display */
  createdAtISO?: string;
  updatedAtISO?: string;
  /** Relative time description (computed) */
  relativeTime?: string;
  /** Timezone of original content if known */
  timezone?: string;
}

// ============================================================
// AUTHORSHIP METADATA
// ============================================================

export interface AuthorMeta {
  /** Display name of author */
  name?: string;
  /** Author identifier (user ID, email, etc.) */
  id?: string;
  /** Role in conversation */
  role?: 'user' | 'assistant' | 'system';
  /** AI model if assistant (e.g., "gpt-4", "claude-3") */
  aiModel?: string;
  /** Model version/snapshot */
  aiModelVersion?: string;
  /** Platform-specific author URL */
  profileUrl?: string;
}

// ============================================================
// MEDIA REFERENCE METADATA
// ============================================================

export interface MediaRef {
  /** Unique ID for this media item */
  id: string;
  /** Media type */
  type: 'image' | 'audio' | 'video' | 'file' | 'link';
  /** Local file path (for local archives) */
  localPath?: string;
  /** Local server URL (e.g., http://localhost:3002/media/...) */
  localUrl?: string;
  /** Cloud/CDN URL if uploaded */
  cloudUrl?: string;
  /** Original source URL (e.g., file-service://...) */
  originalRef?: string;
  /** MIME type */
  mimeType?: string;
  /** File size in bytes */
  sizeBytes?: number;
  /** Image/video dimensions */
  width?: number;
  height?: number;
  /** Duration for audio/video (seconds) */
  durationSeconds?: number;
  /** Alt text or caption */
  caption?: string;
  /** Filename */
  filename?: string;
  /** For DALL-E generations */
  generationPrompt?: string;
  /** Thumbnail URL if available */
  thumbnailUrl?: string;
}

// ============================================================
// LINK METADATA
// ============================================================

export interface LinkRef {
  /** The URL */
  url: string;
  /** Display text used in content */
  text?: string;
  /** Link title from page or preview */
  title?: string;
  /** Meta description */
  description?: string;
  /** Favicon or preview image */
  previewImageUrl?: string;
  /** Domain extracted */
  domain?: string;
  /** Link type detected */
  type?: 'webpage' | 'image' | 'video' | 'document' | 'social' | 'code';
  /** Position in text (character offset) */
  position?: { start: number; end: number };
}

// ============================================================
// CONTENT ANALYSIS METADATA
// ============================================================

export interface ContentStatsMeta {
  /** Word count */
  wordCount?: number;
  /** Character count */
  charCount?: number;
  /** Sentence count */
  sentenceCount?: number;
  /** Paragraph count */
  paragraphCount?: number;
  /** Estimated reading time (minutes) */
  readingTimeMinutes?: number;
  /** Has code blocks */
  hasCode?: boolean;
  /** Programming languages detected */
  codeLanguages?: string[];
  /** Has images embedded */
  hasImages?: boolean;
  /** Image count */
  imageCount?: number;
  /** Has links */
  hasLinks?: boolean;
  /** Link count */
  linkCount?: number;
  /** Primary language of content */
  language?: string;
  /** Content format */
  format?: 'plain' | 'markdown' | 'html';
}

// ============================================================
// SOURCE TRACKING METADATA
// ============================================================

export interface SourceMeta {
  /** Source platform */
  platform?: 'openai' | 'anthropic' | 'facebook' | 'twitter' | 'manual' | 'import';
  /** Archive name in local storage */
  archiveName?: string;
  /** Original conversation/thread folder */
  folder?: string;
  /** Original file path if imported */
  importedFrom?: string;
  /** Import date */
  importedAt?: number;
  /** Conversation ID in source system */
  conversationId?: string;
  /** Message ID in source system */
  messageId?: string;
  /** Position in conversation (0-indexed) */
  messageIndex?: number;
  /** Total messages in conversation */
  totalMessages?: number;
  /** Export/backup version */
  exportVersion?: string;
}

// ============================================================
// TRANSFORMATION HISTORY METADATA
// ============================================================

export interface TransformationRecord {
  /** Tool that was applied */
  tool: string;
  /** Tool settings used */
  settings: Record<string, unknown>;
  /** Timestamp of transformation */
  appliedAt: number;
  /** Hash of input content */
  inputHash?: string;
  /** Hash of output content */
  outputHash?: string;
  /** Any analysis results from the tool */
  analysisResult?: Record<string, unknown>;
}

export interface TransformationHistoryMeta {
  /** Original content hash (before any transforms) */
  originalHash?: string;
  /** Chain of transformations applied */
  transformations?: TransformationRecord[];
  /** Current version number (increments with each transform) */
  version?: number;
}

// ============================================================
// SEMANTIC/EMBEDDING METADATA
// ============================================================

export interface SemanticMeta {
  /** Embedding vector (for semantic search) */
  embedding?: number[];
  /** Embedding model used */
  embeddingModel?: string;
  /** Cluster ID if clustered */
  clusterId?: string;
  /** Cluster label */
  clusterLabel?: string;
  /** Similarity score (if from search) */
  similarityScore?: number;
  /** Topics/themes detected */
  topics?: string[];
  /** Named entities extracted */
  entities?: Array<{
    text: string;
    type: 'person' | 'place' | 'organization' | 'date' | 'other';
    position?: { start: number; end: number };
  }>;
}

// ============================================================
// TAGGING METADATA
// ============================================================

export interface TagsMeta {
  /** Auto-generated tags */
  autoTags?: string[];
  /** User-added tags */
  userTags?: string[];
  /** Year tag (e.g., "2024") */
  year?: string;
  /** Month tag (e.g., "2024-03") */
  month?: string;
  /** Recency category */
  recency?: 'today' | 'this-week' | 'this-month' | 'this-year' | 'archive';
  /** Length category */
  lengthCategory?: 'brief' | 'medium' | 'extended' | 'deep-dive';
  /** Content category */
  category?: 'technical' | 'creative' | 'personal' | 'professional' | 'other';
}

// ============================================================
// LOCATION METADATA (for Facebook check-ins, etc.)
// ============================================================

export interface LocationMeta {
  /** Place name */
  name?: string;
  /** Address */
  address?: string;
  /** City */
  city?: string;
  /** Country */
  country?: string;
  /** Coordinates */
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// ============================================================
// COMBINED METADATA INTERFACE
// ============================================================

export interface BufferMetadata {
  /** Timestamp information */
  timestamps?: TimestampMeta;
  /** Author information */
  author?: AuthorMeta;
  /** Media attachments */
  media?: MediaRef[];
  /** Links found in content */
  links?: LinkRef[];
  /** Content statistics */
  stats?: ContentStatsMeta;
  /** Source tracking */
  source?: SourceMeta;
  /** Transformation history */
  history?: TransformationHistoryMeta;
  /** Semantic/embedding data */
  semantic?: SemanticMeta;
  /** Tags */
  tags?: TagsMeta;
  /** Location (if available) */
  location?: LocationMeta;
  /** Additional platform-specific data */
  platformData?: Record<string, unknown>;
  /** Custom user-defined metadata */
  custom?: Record<string, unknown>;
}
```

---

## Buffer Content Types (with Metadata)

```typescript
// src/types/buffer-content.ts

import type { BufferMetadata, MediaRef, AuthorMeta, TimestampMeta } from './buffer-metadata';

// ============================================================
// BASE TYPES
// ============================================================

export type BufferContentType =
  | 'text'
  | 'message'
  | 'conversation'
  | 'facebook-post'
  | 'facebook-comment'
  | 'media'
  | 'collection';

export interface BufferContentBase {
  /** Unique buffer ID */
  id: string;
  /** Content type discriminator */
  contentType: BufferContentType;
  /** Display name for UI */
  displayName: string;
  /** Full metadata object */
  metadata: BufferMetadata;
  /** Buffer creation timestamp */
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

export interface ConversationContent extends BufferContentBase {
  contentType: 'conversation';
  /** Conversation title */
  title: string;
  /** Folder path */
  folder: string;
  /** All messages with their metadata */
  messages: ConversationMessage[];
  /** Summary statistics */
  stats: {
    messageCount: number;
    userMessageCount: number;
    assistantMessageCount: number;
    totalWordCount: number;
    startDate?: number;
    endDate?: number;
    durationMinutes?: number;
  };
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

export interface CollectionContent extends BufferContentBase {
  contentType: 'collection';
  /** Collection items (any buffer content type) */
  items: BufferContent[];
  /** How the collection was created */
  collectionType: 'manual' | 'search' | 'cluster' | 'filter' | 'date-range';
  /** Search/filter query if applicable */
  query?: string;
  /** Collection statistics */
  stats?: {
    itemCount: number;
    contentTypes: Record<BufferContentType, number>;
    dateRange?: { start: number; end: number };
  };
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
```

---

## Unified Buffer Context

### API Design

```typescript
// src/contexts/UnifiedBufferContext.tsx

export interface UnifiedBufferContextValue {
  // ============================================================
  // WORKING BUFFER (primary content being worked on)
  // ============================================================

  workingBuffer: BufferContent | null;

  // Set working buffer from any content source
  setWorkingBuffer: (content: BufferContent) => void;
  clearWorkingBuffer: () => void;

  // ============================================================
  // BUFFER LIST (all buffers in session)
  // ============================================================

  buffers: BufferContent[];
  activeBufferId: string | null;

  setActiveBuffer: (id: string) => void;
  removeBuffer: (id: string) => void;

  // ============================================================
  // CONTENT CREATION (from various sources)
  // ============================================================

  // From text
  createFromText: (text: string, format?: 'plain' | 'markdown') => BufferContent;

  // From conversation archive
  createFromMessage: (message: Message, conversation: Conversation) => BufferContent;
  createFromConversation: (conversation: Conversation) => BufferContent;

  // From Facebook archive
  createFromFacebookPost: (post: FacebookPost) => BufferContent;
  createFromFacebookComment: (comment: FacebookComment, postId?: string) => BufferContent;

  // From gallery/media
  createFromMedia: (media: GalleryImage) => BufferContent;

  // From search/cluster results
  createFromSelection: (items: any[], mode: 'search' | 'cluster' | 'manual') => BufferContent;

  // ============================================================
  // TEXT EXTRACTION (for tools that need string input)
  // ============================================================

  // Get plain text from working buffer (flattens any structure)
  getTextContent: () => string;

  // Get markdown representation
  getMarkdownContent: () => string;

  // ============================================================
  // TOOL OUTPUT HANDLING
  // ============================================================

  // Record transformation result
  recordTransformation: (
    tool: string,
    settings: Record<string, any>,
    resultText: string,
    metadata?: Record<string, any>
  ) => BufferContent;

  // Record analysis result
  recordAnalysis: (
    tool: string,
    result: any
  ) => BufferContent;

  // ============================================================
  // HISTORY & CHAINING
  // ============================================================

  history: BufferContent[];
  canUndo: boolean;
  undo: () => void;

  // Chain mode: next tool uses last output
  isChainMode: boolean;
  enableChainMode: () => void;
  disableChainMode: () => void;
}
```

---

## Text Extraction Logic

Different content types need different text extraction strategies. The extraction functions can optionally include metadata (timestamps, authors, etc.) in the output.

```typescript
// src/utils/buffer-text-extraction.ts

import type { BufferContent, TimestampMeta, AuthorMeta } from '../types/buffer-content';

// ============================================================
// FORMATTING HELPERS
// ============================================================

/** Format timestamp for display */
export function formatTimestamp(ts?: TimestampMeta): string {
  if (!ts?.createdAt) return '';
  const date = new Date(ts.createdAt);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Format relative time (e.g., "2 days ago") */
export function formatRelativeTime(ts?: TimestampMeta): string {
  if (!ts?.createdAt) return '';
  const now = Date.now();
  const diff = now - ts.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatTimestamp(ts);
}

/** Format author for display */
export function formatAuthor(author?: AuthorMeta): string {
  if (!author) return 'Unknown';
  if (author.role === 'assistant' && author.aiModel) {
    return `${author.aiModel}`;
  }
  return author.name || author.role || 'Unknown';
}

// ============================================================
// EXTRACTION OPTIONS
// ============================================================

export interface ExtractionOptions {
  /** Include timestamps in output */
  includeTimestamps?: boolean;
  /** Include author info */
  includeAuthors?: boolean;
  /** Include metadata header */
  includeMetadataHeader?: boolean;
  /** Include media references */
  includeMedia?: boolean;
  /** Format for output */
  format?: 'plain' | 'markdown';
}

const defaultOptions: ExtractionOptions = {
  includeTimestamps: false,
  includeAuthors: true,
  includeMetadataHeader: false,
  includeMedia: true,
  format: 'plain',
};

// ============================================================
// PLAIN TEXT EXTRACTION
// ============================================================

export function extractText(content: BufferContent, opts: ExtractionOptions = {}): string {
  const options = { ...defaultOptions, ...opts };

  switch (content.contentType) {
    case 'text':
      return content.text;

    case 'message': {
      let text = content.text;
      if (options.includeAuthors) {
        const author = formatAuthor(content.metadata?.author);
        text = `[${author}]: ${text}`;
      }
      if (options.includeTimestamps && content.metadata?.timestamps) {
        text = `${formatTimestamp(content.metadata.timestamps)}\n${text}`;
      }
      return text;
    }

    case 'conversation': {
      let output = options.includeMetadataHeader
        ? `Conversation: ${content.title}\n` +
          `Messages: ${content.stats.messageCount}\n` +
          (content.stats.startDate ? `Started: ${formatTimestamp({ createdAt: content.stats.startDate })}\n` : '') +
          `\n---\n\n`
        : '';

      output += content.messages
        .map(m => {
          let msgText = m.text;
          const author = formatAuthor(m.metadata?.author);
          if (options.includeAuthors) {
            msgText = `[${m.role}${author !== m.role ? ` (${author})` : ''}]: ${msgText}`;
          }
          if (options.includeTimestamps && m.metadata?.timestamps) {
            msgText = `${formatTimestamp(m.metadata.timestamps)}\n${msgText}`;
          }
          return msgText;
        })
        .join('\n\n');

      return output;
    }

    case 'facebook-post': {
      let text = '';

      // Header with author and timestamp
      if (options.includeMetadataHeader || options.includeAuthors) {
        const author = formatAuthor(content.metadata?.author);
        text += `${author}`;
        if (options.includeTimestamps && content.metadata?.timestamps) {
          text += ` · ${formatTimestamp(content.metadata.timestamps)}`;
        }
        text += '\n\n';
      }

      text += content.text;

      // Comments
      if (content.comments?.length) {
        text += '\n\n---\nComments:\n';
        text += content.comments
          .map(c => {
            const cAuthor = formatAuthor(c.metadata?.author);
            let cText = `- ${cAuthor}: ${c.text}`;
            if (options.includeTimestamps && c.metadata?.timestamps) {
              cText += ` (${formatRelativeTime(c.metadata.timestamps)})`;
            }
            return cText;
          })
          .join('\n');
      }

      return text;
    }

    case 'facebook-comment': {
      let text = content.text;
      if (options.includeAuthors) {
        const author = formatAuthor(content.metadata?.author);
        text = `${author}: ${text}`;
      }
      if (options.includeTimestamps && content.metadata?.timestamps) {
        text += ` (${formatTimestamp(content.metadata.timestamps)})`;
      }
      return text;
    }

    case 'media':
      return content.media.caption || `[${content.media.type}: ${content.media.filename || content.media.localUrl}]`;

    case 'collection':
      return content.items
        .map((item, i) => `--- Item ${i + 1} ---\n${extractText(item, options)}`)
        .join('\n\n');

    default:
      return '';
  }
}

// ============================================================
// MARKDOWN EXTRACTION (with full formatting)
// ============================================================

export function extractMarkdown(content: BufferContent, opts: ExtractionOptions = {}): string {
  const options = { ...defaultOptions, ...opts, format: 'markdown' as const };

  switch (content.contentType) {
    case 'text':
      return content.format === 'markdown' ? content.text : content.text;

    case 'message': {
      const roleEmoji = content.role === 'user' ? '👤' : '🤖';
      const author = formatAuthor(content.metadata?.author);
      let md = `${roleEmoji} **${author}**`;

      if (options.includeTimestamps && content.metadata?.timestamps) {
        md += `  \n*${formatTimestamp(content.metadata.timestamps)}*`;
      }
      md += `\n\n${content.text}`;

      // Include media references
      if (options.includeMedia && content.metadata?.media?.length) {
        md += '\n\n';
        md += content.metadata.media
          .map(m => m.type === 'image' ? `![${m.caption || ''}](${m.localUrl || m.cloudUrl})` : `[${m.filename}](${m.localUrl})`)
          .join('\n');
      }

      return md;
    }

    case 'conversation': {
      let md = `# ${content.title}\n\n`;

      // Metadata header
      if (options.includeMetadataHeader) {
        md += `> **${content.stats.messageCount}** messages`;
        md += ` · **${content.stats.userMessageCount}** from user`;
        md += ` · **${content.stats.assistantMessageCount}** from assistant\n`;
        if (content.stats.startDate) {
          md += `> Started: ${formatTimestamp({ createdAt: content.stats.startDate })}`;
          if (content.stats.endDate) {
            md += ` → ${formatTimestamp({ createdAt: content.stats.endDate })}`;
          }
          md += '\n';
        }
        md += '\n---\n\n';
      }

      md += content.messages
        .map(m => {
          const emoji = m.role === 'user' ? '👤' : '🤖';
          const author = formatAuthor(m.metadata?.author);
          let msgMd = `## ${emoji} ${author}`;

          if (options.includeTimestamps && m.metadata?.timestamps) {
            msgMd += `\n*${formatTimestamp(m.metadata.timestamps)}*`;
          }
          msgMd += `\n\n${m.text}`;

          // Message-level media
          if (options.includeMedia && m.metadata?.media?.length) {
            msgMd += '\n\n';
            msgMd += m.metadata.media
              .map(media => media.type === 'image'
                ? `![${media.caption || ''}](${media.localUrl || media.cloudUrl})`
                : `📎 [${media.filename}](${media.localUrl})`)
              .join('\n');
          }

          return msgMd;
        })
        .join('\n\n---\n\n');

      return md;
    }

    case 'facebook-post': {
      const author = formatAuthor(content.metadata?.author);
      let md = `**${author}**`;

      if (options.includeTimestamps && content.metadata?.timestamps) {
        md += ` · *${formatTimestamp(content.metadata.timestamps)}*`;
      }
      md += '\n\n';
      md += content.text;

      // Media
      if (options.includeMedia && content.metadata?.media?.length) {
        md += '\n\n';
        md += content.metadata.media
          .map(m => m.type === 'image' ? `![](${m.localUrl || m.cloudUrl})` : `📎 [${m.filename}](${m.localUrl})`)
          .join('\n');
      }

      // Location
      if (content.metadata?.location?.name) {
        md += `\n\n📍 *${content.metadata.location.name}*`;
        if (content.metadata.location.city) {
          md += `, ${content.metadata.location.city}`;
        }
      }

      // Comments
      if (content.comments?.length) {
        md += '\n\n---\n\n**Comments:**\n\n';
        md += content.comments
          .map(c => {
            const cAuthor = formatAuthor(c.metadata?.author);
            let comment = `> **${cAuthor}**`;
            if (options.includeTimestamps && c.metadata?.timestamps) {
              comment += ` · *${formatRelativeTime(c.metadata.timestamps)}*`;
            }
            comment += `\n> ${c.text}`;
            return comment;
          })
          .join('\n\n');
      }

      return md;
    }

    case 'facebook-comment': {
      const author = formatAuthor(content.metadata?.author);
      let md = `**${author}**`;
      if (options.includeTimestamps && content.metadata?.timestamps) {
        md += ` · *${formatTimestamp(content.metadata.timestamps)}*`;
      }
      md += `\n\n${content.text}`;
      return md;
    }

    case 'media': {
      const m = content.media;
      if (m.type === 'image') {
        let md = `![${m.caption || m.filename || ''}](${m.localUrl || m.cloudUrl})`;
        if (m.caption) {
          md += `\n\n*${m.caption}*`;
        }
        if (m.generationPrompt) {
          md += `\n\n> DALL-E prompt: "${m.generationPrompt}"`;
        }
        return md;
      }
      return `📎 [${m.filename || m.type}](${m.localUrl || m.cloudUrl})`;
    }

    case 'collection': {
      let md = content.displayName ? `# ${content.displayName}\n\n` : '';

      if (options.includeMetadataHeader && content.stats) {
        md += `> **${content.stats.itemCount}** items`;
        if (content.query) {
          md += ` · Query: "${content.query}"`;
        }
        md += '\n\n';
      }

      md += content.items
        .map((item, i) => `## Item ${i + 1}\n\n${extractMarkdown(item, options)}`)
        .join('\n\n---\n\n');

      return md;
    }

    default:
      return '';
  }
}

// ============================================================
// METADATA EXTRACTION HELPERS
// ============================================================

/** Extract all media references from buffer content */
export function extractAllMedia(content: BufferContent): MediaRef[] {
  const media: MediaRef[] = [];

  // Top-level media
  if (content.metadata?.media) {
    media.push(...content.metadata.media);
  }

  // Content-specific media
  switch (content.contentType) {
    case 'media':
      media.push(content.media);
      break;
    case 'conversation':
      content.messages.forEach(m => {
        if (m.metadata?.media) media.push(...m.metadata.media);
      });
      break;
    case 'facebook-post':
      content.comments?.forEach(c => {
        if (c.metadata?.media) media.push(...c.metadata.media);
      });
      break;
    case 'collection':
      content.items.forEach(item => {
        media.push(...extractAllMedia(item));
      });
      break;
  }

  return media;
}

/** Extract all links from buffer content */
export function extractAllLinks(content: BufferContent): LinkRef[] {
  const links: LinkRef[] = [];

  if (content.metadata?.links) {
    links.push(...content.metadata.links);
  }

  if (content.contentType === 'collection') {
    content.items.forEach(item => {
      links.push(...extractAllLinks(item));
    });
  }

  return links;
}

/** Get date range from buffer content */
export function getDateRange(content: BufferContent): { start?: number; end?: number } {
  switch (content.contentType) {
    case 'conversation':
      return { start: content.stats.startDate, end: content.stats.endDate };
    case 'collection':
      return content.stats?.dateRange || {};
    default:
      return {
        start: content.metadata?.timestamps?.createdAt,
        end: content.metadata?.timestamps?.updatedAt || content.metadata?.timestamps?.createdAt,
      };
  }
}
```

---

## Integration Points

### 1. Archive Panel → Buffer

Add "Send to Buffer" action to each content type:

```typescript
// In ArchivePanel.tsx or child components

const { setWorkingBuffer, createFromMessage, createFromConversation } = useUnifiedBuffer();

// For a message
const handleSendMessageToBuffer = (message: Message) => {
  const content = createFromMessage(message, selectedConversation);
  setWorkingBuffer(content);
};

// For a conversation
const handleSendConversationToBuffer = () => {
  const content = createFromConversation(selectedConversation);
  setWorkingBuffer(content);
};

// For a Facebook post
const handleSendPostToBuffer = (post: FacebookPost) => {
  const content = createFromFacebookPost(post);
  setWorkingBuffer(content);
};
```

### 2. Tools Panel ← Buffer

Tools read from unified buffer:

```typescript
// In TabbedToolsPanel.tsx

const { getTextContent, recordTransformation } = useUnifiedBuffer();

// Pass text to tools
const content = getTextContent();

// Handle tool output
const handleApplyTransform = (tool: string, settings: any, result: string) => {
  recordTransformation(tool, settings, result);
};
```

### 3. MainWorkspace ← Buffer

Display content from buffer:

```typescript
// In MainWorkspace.tsx

const { workingBuffer, getMarkdownContent } = useUnifiedBuffer();

// Render based on content type
const renderContent = () => {
  if (!workingBuffer) return <EmptyState />;

  return <MarkdownRenderer content={getMarkdownContent()} />;
};
```

---

## Migration Strategy

### Phase 1: Add Types (Non-Breaking)
1. Create `src/types/buffer-content.ts`
2. Create `src/utils/buffer-text-extraction.ts`
3. Add to existing type exports

### Phase 2: Create UnifiedBufferContext
1. Create context alongside existing SessionContext
2. Implement creation functions
3. Implement text extraction

### Phase 3: Wire Up Archive Panel
1. Add "Send to Buffer" buttons/actions
2. Each content type gets appropriate action
3. Working buffer updates trigger UI refresh

### Phase 4: Wire Up Tools Panel
1. Tools read from `getTextContent()`
2. Tools write via `recordTransformation()`
3. Remove direct `content: string` prop

### Phase 5: Wire Up MainWorkspace
1. Display from unified buffer
2. Support all content type renderings
3. Edit mode for text content

---

## UI Components

### BufferIndicator
Shows current buffer content type and source:

```
┌─────────────────────────────────────────┐
│ 📝 Message from "Project Discussion"    │
│ Message 5 of 12 • 342 words             │
│ [Chain] [Clear]                         │
└─────────────────────────────────────────┘
```

### SendToBuffer Button
Appears on selectable content:

```
┌──────────────────┐
│ → Send to Buffer │
└──────────────────┘
```

### BufferContentPreview
Compact preview in Tools Panel header:

```
┌─────────────────────────────────────────┐
│ Working: conversation (12 messages)      │
│ Source: ChatGPT / Project Planning       │
└─────────────────────────────────────────┘
```

---

## Backwards Compatibility

The existing `SessionBuffer` system continues to work:
- `createOriginalBuffer(text, archiveRef)` still works
- `SessionBuffer.text` maps to `TextContent.text`
- Existing sessions load normally

New unified buffer runs in parallel, eventually replacing the old system.

---

## File Structure

```
src/
├── types/
│   ├── index.ts              # Existing types
│   └── buffer-content.ts     # NEW: Buffer content types
├── utils/
│   └── buffer-text-extraction.ts  # NEW: Text extraction
├── contexts/
│   ├── SessionContext.tsx    # Existing (keep for now)
│   └── UnifiedBufferContext.tsx   # NEW: Unified buffer
├── hooks/
│   ├── useBufferManager.ts   # Existing
│   └── useUnifiedBuffer.ts   # NEW: Hook for context
└── components/
    └── buffer/
        ├── BufferIndicator.tsx     # NEW
        ├── SendToBufferButton.tsx  # NEW
        └── BufferContentPreview.tsx # NEW
```

---

## Next Steps

1. [ ] Create `src/types/buffer-content.ts`
2. [ ] Create `src/utils/buffer-text-extraction.ts`
3. [ ] Create `src/contexts/UnifiedBufferContext.tsx`
4. [ ] Add SendToBuffer action in ArchivePanel
5. [ ] Update TabbedToolsPanel to use unified buffer
6. [ ] Update MainWorkspace to display from buffer
7. [ ] Add BufferIndicator component
8. [ ] Test all content types end-to-end

---

**End of Design Document**
