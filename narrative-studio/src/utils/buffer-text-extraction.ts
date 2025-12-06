/**
 * Buffer Text Extraction Utilities
 *
 * Functions for extracting text and markdown from buffer content,
 * with options to include metadata (timestamps, authors, media, etc.)
 */

import type {
  BufferContent,
  TimestampMeta,
  AuthorMeta,
  MediaRef,
  LinkRef,
} from '../types/buffer-content';

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

/** Format timestamp as short date only */
export function formatDate(ts?: TimestampMeta): string {
  if (!ts?.createdAt) return '';
  const date = new Date(ts.createdAt);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
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
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  if (years === 1) return '1 year ago';
  if (years > 1) return `${years} years ago`;
  return formatDate(ts);
}

/** Format author for display */
export function formatAuthor(author?: AuthorMeta): string {
  if (!author) return 'Unknown';
  if (author.role === 'assistant' && author.aiModel) {
    return author.aiModel;
  }
  return author.name || author.role || 'Unknown';
}

/** Get role emoji */
export function getRoleEmoji(role?: string): string {
  switch (role) {
    case 'user': return '👤';
    case 'assistant': return '🤖';
    case 'system': return '⚙️';
    default: return '💬';
  }
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
  /** Include links */
  includeLinks?: boolean;
  /** Format for output */
  format?: 'plain' | 'markdown';
}

const defaultOptions: ExtractionOptions = {
  includeTimestamps: false,
  includeAuthors: true,
  includeMetadataHeader: false,
  includeMedia: true,
  includeLinks: true,
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
      let output = '';

      if (options.includeMetadataHeader) {
        output += `Conversation: ${content.title}\n`;
        output += `Messages: ${content.stats.messageCount}\n`;
        if (content.stats.startDate) {
          output += `Started: ${formatTimestamp({ createdAt: content.stats.startDate })}\n`;
        }
        if (content.stats.endDate) {
          output += `Last message: ${formatTimestamp({ createdAt: content.stats.endDate })}\n`;
        }
        output += '\n---\n\n';
      }

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
        text += author;
        if (options.includeTimestamps && content.metadata?.timestamps) {
          text += ` · ${formatTimestamp(content.metadata.timestamps)}`;
        }
        text += '\n\n';
      }

      text += content.text;

      // Location
      if (content.metadata?.location?.name) {
        text += `\n\n📍 ${content.metadata.location.name}`;
        if (content.metadata.location.city) {
          text += `, ${content.metadata.location.city}`;
        }
      }

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
      return content.media.caption || `[${content.media.type}: ${content.media.filename || content.media.localUrl || 'media'}]`;

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
      const roleEmoji = getRoleEmoji(content.role);
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
          .map(m => formatMediaMarkdown(m))
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
        if (content.stats.totalWordCount) {
          md += `> **${content.stats.totalWordCount.toLocaleString()}** words\n`;
        }
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
          const emoji = getRoleEmoji(m.role);
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
              .map(media => formatMediaMarkdown(media))
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
          .map(m => formatMediaMarkdown(m))
          .join('\n');
      }

      // Location
      if (content.metadata?.location?.name) {
        md += `\n\n📍 *${content.metadata.location.name}*`;
        if (content.metadata.location.city) {
          md += `, ${content.metadata.location.city}`;
        }
      }

      // Shared link
      if (content.sharedLink) {
        md += '\n\n';
        md += `> 🔗 [${content.sharedLink.title || content.sharedLink.url}](${content.sharedLink.url})`;
        if (content.sharedLink.description) {
          md += `\n> ${content.sharedLink.description}`;
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
      return formatMediaMarkdown(content.media);
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
// MEDIA FORMATTING HELPERS
// ============================================================

function formatMediaMarkdown(m: MediaRef): string {
  const url = m.localUrl || m.cloudUrl || '';

  if (m.type === 'image') {
    let md = `![${m.caption || m.filename || ''}](${url})`;
    if (m.caption) {
      md += `\n*${m.caption}*`;
    }
    if (m.generationPrompt) {
      md += `\n> DALL-E prompt: "${m.generationPrompt}"`;
    }
    return md;
  }

  if (m.type === 'audio') {
    let md = `🎵 [${m.filename || 'Audio'}](${url})`;
    if (m.durationSeconds) {
      const mins = Math.floor(m.durationSeconds / 60);
      const secs = m.durationSeconds % 60;
      md += ` (${mins}:${secs.toString().padStart(2, '0')})`;
    }
    return md;
  }

  if (m.type === 'video') {
    let md = `🎬 [${m.filename || 'Video'}](${url})`;
    if (m.durationSeconds) {
      const mins = Math.floor(m.durationSeconds / 60);
      const secs = m.durationSeconds % 60;
      md += ` (${mins}:${secs.toString().padStart(2, '0')})`;
    }
    return md;
  }

  return `📎 [${m.filename || m.type}](${url})`;
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

/** Get total word count from buffer content */
export function getTotalWordCount(content: BufferContent): number {
  switch (content.contentType) {
    case 'text':
    case 'message':
    case 'facebook-comment':
      return content.metadata?.stats?.wordCount || content.text.split(/\s+/).filter(Boolean).length;
    case 'conversation':
      return content.stats.totalWordCount;
    case 'facebook-post': {
      let count = content.text.split(/\s+/).filter(Boolean).length;
      content.comments?.forEach(c => {
        count += c.text.split(/\s+/).filter(Boolean).length;
      });
      return count;
    }
    case 'media':
      return content.media.caption?.split(/\s+/).filter(Boolean).length || 0;
    case 'collection':
      return content.items.reduce((sum, item) => sum + getTotalWordCount(item), 0);
    default:
      return 0;
  }
}

/** Get content type label for display */
export function getContentTypeLabel(contentType: BufferContent['contentType']): string {
  switch (contentType) {
    case 'text': return 'Text';
    case 'message': return 'Message';
    case 'conversation': return 'Conversation';
    case 'facebook-post': return 'Facebook Post';
    case 'facebook-comment': return 'Facebook Comment';
    case 'media': return 'Media';
    case 'collection': return 'Collection';
    default: return 'Unknown';
  }
}

/** Get content type icon */
export function getContentTypeIcon(contentType: BufferContent['contentType']): string {
  switch (contentType) {
    case 'text': return '📝';
    case 'message': return '💬';
    case 'conversation': return '🗨️';
    case 'facebook-post': return '📘';
    case 'facebook-comment': return '💭';
    case 'media': return '🖼️';
    case 'collection': return '📚';
    default: return '📄';
  }
}
