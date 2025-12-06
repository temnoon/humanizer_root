/**
 * Passage Extractor
 *
 * Extracts passages from various sources (archives, files, web).
 * Bridges existing parsers (OpenAI, Facebook, Claude) to the Passage System.
 *
 * @see /docs/PASSAGE_SYSTEM_SPEC_v1.1.md
 */

import type {
  Passage,
  PassageSource,
  PassagePosition,
  PassageContentType,
  ArchivePlatform,
} from '../types/passage';
import { createPassage, generatePassageId } from '../types/passage';
import type { Message, Conversation, GalleryImage } from '../types';
import type {
  BufferContent,
  FacebookPostContent,
  FacebookCommentContent,
  ConversationContent,
  MessageContent,
} from '../types/buffer-content';

// ============================================================
// EXTRACTION OPTIONS
// ============================================================

export interface ExtractionOptions {
  /** How to extract from conversations */
  conversationMode?: 'full' | 'per-message' | 'user-only' | 'assistant-only';
  /** Minimum word count for passages */
  minWordCount?: number;
  /** Maximum word count before auto-splitting */
  maxWordCount?: number;
  /** Include metadata in passage */
  preserveMetadata?: boolean;
  /** Archive name for source tracking */
  archiveName?: string;
  /** Index scope */
  indexScope?: 'local' | 'global';
}

const defaultOptions: ExtractionOptions = {
  conversationMode: 'full',
  minWordCount: 10,
  maxWordCount: 50000, // 50K is Pro limit
  preserveMetadata: true,
  archiveName: 'main',
  indexScope: 'local',
};

// ============================================================
// CONVERSATION EXTRACTION
// ============================================================

/**
 * Extract passages from a conversation
 */
export function extractFromConversation(
  conversation: Conversation,
  options: ExtractionOptions = {}
): Passage[] {
  const opts = { ...defaultOptions, ...options };
  const passages: Passage[] = [];

  const source: PassageSource = {
    type: 'archive',
    name: conversation.title,
    extractedAt: new Date(),
    platform: detectPlatform(conversation),
    conversationId: conversation.id,
    conversationTitle: conversation.title,
    folder: conversation.folder,
    archiveName: opts.archiveName,
  };

  switch (opts.conversationMode) {
    case 'full':
      // Extract entire conversation as one passage
      passages.push(extractFullConversation(conversation, source, opts));
      break;

    case 'per-message':
      // Extract each message as separate passage
      conversation.messages.forEach((message, index) => {
        const passage = extractFromMessage(message, conversation, index, opts);
        if (passage.metadata.wordCount >= (opts.minWordCount || 0)) {
          passages.push(passage);
        }
      });
      break;

    case 'user-only':
      // Extract only user messages
      conversation.messages
        .filter(m => m.role === 'user')
        .forEach((message, _filteredIndex) => {
          const originalIndex = conversation.messages.indexOf(message);
          const passage = extractFromMessage(message, conversation, originalIndex, opts);
          if (passage.metadata.wordCount >= (opts.minWordCount || 0)) {
            passages.push(passage);
          }
        });
      break;

    case 'assistant-only':
      // Extract only assistant messages
      conversation.messages
        .filter(m => m.role === 'assistant')
        .forEach((message, _filteredIndex) => {
          const originalIndex = conversation.messages.indexOf(message);
          const passage = extractFromMessage(message, conversation, originalIndex, opts);
          if (passage.metadata.wordCount >= (opts.minWordCount || 0)) {
            passages.push(passage);
          }
        });
      break;
  }

  return passages;
}

/**
 * Extract full conversation as single passage
 */
function extractFullConversation(
  conversation: Conversation,
  source: PassageSource,
  opts: ExtractionOptions
): Passage {
  // Format conversation as markdown
  const lines: string[] = [];

  lines.push(`# ${conversation.title}\n`);

  conversation.messages.forEach(message => {
    const roleLabel = message.role === 'user' ? '**User**' : '**Assistant**';
    lines.push(`## ${roleLabel}\n`);
    lines.push(message.content);
    lines.push(''); // Empty line between messages
  });

  const content = lines.join('\n');

  const position: PassagePosition = {
    messageIndex: 0,
  };

  return createPassage(content, source, {
    contentType: 'markdown',
    title: conversation.title,
    position,
    date: conversation.created_at ? new Date(conversation.created_at) : undefined,
    tags: conversation.tags,
  });
}

/**
 * Extract single message as passage
 */
export function extractFromMessage(
  message: Message,
  conversation: Conversation,
  messageIndex: number,
  options: ExtractionOptions = {}
): Passage {
  const opts = { ...defaultOptions, ...options };

  const source: PassageSource = {
    type: 'archive',
    name: `${conversation.title} - Message ${messageIndex + 1}`,
    extractedAt: new Date(),
    platform: detectPlatform(conversation),
    conversationId: conversation.id,
    conversationTitle: conversation.title,
    folder: conversation.folder,
    archiveName: opts.archiveName,
  };

  const position: PassagePosition = {
    messageId: message.id,
    messageIndex,
  };

  const rolePrefix = message.role === 'user' ? '[User]' : '[Assistant]';
  const title = `${rolePrefix} ${conversation.title.substring(0, 50)}`;

  return createPassage(message.content, source, {
    contentType: 'markdown',
    title,
    position,
    date: message.created_at ? new Date(message.created_at) : undefined,
    tags: message.tags,
    author: message.role,
  });
}

// ============================================================
// FACEBOOK EXTRACTION
// ============================================================

export interface FacebookPost {
  text: string;
  timestamp?: number;
  author?: string;
  postType?: 'status' | 'photo' | 'link' | 'video' | 'note' | 'check-in';
  comments?: Array<{
    text: string;
    timestamp?: number;
    author?: string;
  }>;
  location?: {
    name?: string;
    city?: string;
    country?: string;
  };
}

/**
 * Extract passage from Facebook post
 */
export function extractFromFacebookPost(
  post: FacebookPost,
  options: ExtractionOptions = {}
): Passage {
  const opts = { ...defaultOptions, ...options };

  const source: PassageSource = {
    type: 'archive',
    name: post.text.substring(0, 50) + (post.text.length > 50 ? '...' : ''),
    extractedAt: new Date(),
    platform: 'facebook',
    archiveName: opts.archiveName,
  };

  // Build content with optional comments
  let content = post.text;

  if (post.location?.name) {
    content += `\n\n📍 ${post.location.name}`;
    if (post.location.city) {
      content += `, ${post.location.city}`;
    }
  }

  if (post.comments && post.comments.length > 0) {
    content += '\n\n---\n**Comments:**\n';
    post.comments.forEach(comment => {
      const author = comment.author || 'Unknown';
      content += `\n> **${author}**: ${comment.text}`;
    });
  }

  return createPassage(content, source, {
    contentType: 'text',
    title: post.text.substring(0, 50),
    date: post.timestamp ? new Date(post.timestamp) : undefined,
    author: post.author,
  });
}

// ============================================================
// FILE EXTRACTION
// ============================================================

export type SupportedFileFormat = 'txt' | 'md' | 'html' | 'pdf' | 'rtf' | 'epub' | 'docx';

/**
 * Extract passage from file content
 */
export function extractFromFile(
  content: string,
  filename: string,
  format: SupportedFileFormat,
  options: ExtractionOptions = {}
): Passage {
  const opts = { ...defaultOptions, ...options };

  const source: PassageSource = {
    type: 'file',
    name: filename,
    path: filename,
    extractedAt: new Date(),
    fileFormat: format,
    archiveName: opts.archiveName,
  };

  const contentType: PassageContentType =
    format === 'md' ? 'markdown' :
    format === 'html' ? 'html' : 'text';

  const title = filename.replace(/\.[^.]+$/, ''); // Remove extension

  return createPassage(content, source, {
    contentType,
    title,
  });
}

/**
 * Detect file format from filename
 */
export function detectFileFormat(filename: string): SupportedFileFormat | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'txt': return 'txt';
    case 'md':
    case 'markdown': return 'md';
    case 'html':
    case 'htm': return 'html';
    case 'pdf': return 'pdf';
    case 'rtf': return 'rtf';
    case 'epub': return 'epub';
    case 'docx': return 'docx';
    default: return null;
  }
}

// ============================================================
// WEB EXTRACTION
// ============================================================

export interface WebSource {
  url: string;
  title: string;
  content: string;
  author?: string;
  publishedAt?: Date;
  platform?: 'substack' | 'medium' | 'wordpress' | 'generic';
}

/**
 * Extract passage from web content
 */
export function extractFromWeb(
  webSource: WebSource,
  options: ExtractionOptions = {}
): Passage {
  const opts = { ...defaultOptions, ...options };

  const source: PassageSource = {
    type: 'web',
    name: webSource.title,
    path: webSource.url,
    extractedAt: new Date(),
    url: webSource.url,
    webPlatform: webSource.platform || 'generic',
    archiveName: opts.archiveName,
  };

  return createPassage(webSource.content, source, {
    contentType: 'html', // Web content is usually HTML/markdown
    title: webSource.title,
    date: webSource.publishedAt,
    author: webSource.author,
  });
}

// ============================================================
// PASTE EXTRACTION
// ============================================================

/**
 * Extract passage from pasted text
 */
export function extractFromPaste(
  text: string,
  options: ExtractionOptions & { title?: string } = {}
): Passage {
  const opts = { ...defaultOptions, ...options };

  const source: PassageSource = {
    type: 'paste',
    name: opts.title || 'Pasted text',
    extractedAt: new Date(),
    archiveName: opts.archiveName,
  };

  // Try to detect if it's markdown
  const isMarkdown = detectMarkdown(text);

  return createPassage(text, source, {
    contentType: isMarkdown ? 'markdown' : 'text',
    title: opts.title,
  });
}

// ============================================================
// BUFFER CONTENT CONVERSION
// ============================================================

/**
 * Convert existing BufferContent to Passage
 * (For gradual migration from buffer system)
 */
export function convertBufferToPassage(
  buffer: BufferContent,
  options: ExtractionOptions = {}
): Passage {
  const opts = { ...defaultOptions, ...options };

  switch (buffer.contentType) {
    case 'text':
      return extractFromPaste(buffer.text, {
        ...opts,
        title: buffer.displayName,
      });

    case 'message': {
      const msgBuffer = buffer as MessageContent;
      const source: PassageSource = {
        type: 'archive',
        name: msgBuffer.displayName,
        extractedAt: new Date(),
        platform: (msgBuffer.metadata?.source?.platform as ArchivePlatform) || 'openai',
        conversationId: msgBuffer.conversation?.id,
        conversationTitle: msgBuffer.conversation?.title,
        folder: msgBuffer.conversation?.folder,
        archiveName: opts.archiveName,
      };
      return createPassage(msgBuffer.text, source, {
        contentType: 'markdown',
        title: msgBuffer.displayName,
        author: msgBuffer.role,
        date: msgBuffer.metadata?.timestamps?.createdAt
          ? new Date(msgBuffer.metadata.timestamps.createdAt)
          : undefined,
      });
    }

    case 'conversation': {
      const convBuffer = buffer as ConversationContent;
      return extractFullConversationFromBuffer(convBuffer, opts);
    }

    case 'facebook-post': {
      const fbBuffer = buffer as FacebookPostContent;
      return extractFromFacebookPost({
        text: fbBuffer.text,
        timestamp: fbBuffer.metadata?.timestamps?.createdAt,
        author: fbBuffer.metadata?.author?.name,
        postType: fbBuffer.postType,
        comments: fbBuffer.comments?.map(c => ({
          text: c.text,
          timestamp: c.metadata?.timestamps?.createdAt,
          author: c.metadata?.author?.name,
        })),
      }, opts);
    }

    case 'facebook-comment': {
      const fbComment = buffer as FacebookCommentContent;
      const source: PassageSource = {
        type: 'archive',
        name: fbComment.displayName,
        extractedAt: new Date(),
        platform: 'facebook',
        archiveName: opts.archiveName,
      };
      return createPassage(fbComment.text, source, {
        contentType: 'text',
        title: fbComment.displayName,
        author: fbComment.metadata?.author?.name,
        date: fbComment.metadata?.timestamps?.createdAt
          ? new Date(fbComment.metadata.timestamps.createdAt)
          : undefined,
      });
    }

    case 'collection': {
      // For collections, concatenate all items
      const items = buffer.items || [];
      const contents = items.map(item => {
        const passage = convertBufferToPassage(item, opts);
        return `## ${passage.metadata.title || 'Item'}\n\n${passage.content}`;
      });
      const source: PassageSource = {
        type: 'paste',
        name: buffer.displayName,
        extractedAt: new Date(),
        archiveName: opts.archiveName,
      };
      return createPassage(contents.join('\n\n---\n\n'), source, {
        contentType: 'markdown',
        title: buffer.displayName,
      });
    }

    case 'media': {
      // Media doesn't have text content, create minimal passage
      const source: PassageSource = {
        type: 'archive',
        name: buffer.displayName,
        extractedAt: new Date(),
        platform: 'openai',
        archiveName: opts.archiveName,
      };
      const caption = buffer.media?.caption || `[Media: ${buffer.displayName}]`;
      return createPassage(caption, source, {
        contentType: 'text',
        title: buffer.displayName,
      });
    }

    default:
      throw new Error(`Unknown buffer content type: ${(buffer as any).contentType}`);
  }
}

/**
 * Extract from ConversationContent buffer
 */
function extractFullConversationFromBuffer(
  buffer: ConversationContent,
  opts: ExtractionOptions
): Passage {
  const lines: string[] = [];
  lines.push(`# ${buffer.title}\n`);

  buffer.messages.forEach(message => {
    const roleLabel = message.role === 'user' ? '**User**' : '**Assistant**';
    lines.push(`## ${roleLabel}\n`);
    lines.push(message.text);
    lines.push('');
  });

  const content = lines.join('\n');

  const source: PassageSource = {
    type: 'archive',
    name: buffer.title,
    extractedAt: new Date(),
    platform: (buffer.metadata?.source?.platform as ArchivePlatform) || 'openai',
    conversationId: buffer.metadata?.source?.conversationId,
    conversationTitle: buffer.title,
    folder: buffer.folder,
    archiveName: opts.archiveName,
  };

  return createPassage(content, source, {
    contentType: 'markdown',
    title: buffer.title,
    date: buffer.metadata?.timestamps?.createdAt
      ? new Date(buffer.metadata.timestamps.createdAt)
      : undefined,
    tags: buffer.metadata?.tags?.autoTags,
  });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Detect platform from conversation structure
 */
function detectPlatform(conversation: Conversation): ArchivePlatform {
  // Could analyze conversation structure, folder names, etc.
  // For now, default to openai since that's the primary use case
  if (conversation.folder?.toLowerCase().includes('claude')) {
    return 'anthropic';
  }
  return 'openai';
}

/**
 * Simple markdown detection
 */
function detectMarkdown(text: string): boolean {
  // Check for common markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s/m,           // Headers
    /\*\*[^*]+\*\*/,        // Bold
    /\*[^*]+\*/,            // Italic
    /\[.+\]\(.+\)/,         // Links
    /^[-*+]\s/m,            // Lists
    /^\d+\.\s/m,            // Numbered lists
    /```[\s\S]*```/,        // Code blocks
    /^>\s/m,                // Blockquotes
  ];

  return markdownPatterns.some(pattern => pattern.test(text));
}

/**
 * Split long content into multiple passages
 */
export function splitLongContent(
  content: string,
  maxWords: number,
  source: PassageSource
): Passage[] {
  const words = content.split(/\s+/);

  if (words.length <= maxWords) {
    return [createPassage(content, source, { contentType: 'text' })];
  }

  const passages: Passage[] = [];
  let partIndex = 1;

  for (let i = 0; i < words.length; i += maxWords) {
    const chunk = words.slice(i, i + maxWords).join(' ');
    const partSource = {
      ...source,
      name: `${source.name} (Part ${partIndex})`,
    };
    const passage = createPassage(chunk, partSource, {
      contentType: 'text',
      title: `${source.name} (Part ${partIndex})`,
    });
    passage.position = { characterOffset: i > 0 ? content.indexOf(chunk) : 0 };
    passages.push(passage);
    partIndex++;
  }

  return passages;
}

/**
 * Batch extract passages from multiple conversations
 */
export function batchExtractFromConversations(
  conversations: Conversation[],
  options: ExtractionOptions = {}
): Passage[] {
  return conversations.flatMap(conv => extractFromConversation(conv, options));
}
