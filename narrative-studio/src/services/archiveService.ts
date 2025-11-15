import type { ConversationMetadata, Conversation, Message } from '../types';

const ARCHIVE_API = 'http://localhost:3002';

// ============================================================
// AUTO-TAGGING LOGIC
// ============================================================

/**
 * Generate time-based tags from folder name or timestamp
 */
function generateTimeTags(folder: string, timestamp?: number): string[] {
  const tags: string[] = [];

  // Extract date from folder name (format: YYYY-MM-DD-*)
  const dateMatch = folder.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const date = new Date(`${year}-${month}-${day}`);

    // Year tag
    tags.push(year);

    // Month tag
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[parseInt(month) - 1];
    tags.push(`${monthName} ${year}`);

    // Recency tag
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) {
      tags.push('This Week');
    } else if (diffDays <= 30) {
      tags.push('This Month');
    } else if (diffDays <= 90) {
      tags.push('Recent');
    } else {
      tags.push('Archive');
    }
  }

  return tags;
}

/**
 * Generate length-based tags from message count
 */
function generateLengthTags(messageCount: number): string[] {
  if (messageCount < 10) return ['Brief'];
  if (messageCount < 50) return ['Medium'];
  if (messageCount < 100) return ['Extended'];
  return ['Deep Dive'];
}

/**
 * Generate content-based tags from messages
 */
function generateContentTags(messages: Message[]): string[] {
  const tags: string[] = [];

  const allContent = messages.map(m => m.content).join('\n').toLowerCase();

  // Check for code
  if (allContent.includes('```') || allContent.includes('function ') ||
      allContent.includes('const ') || allContent.includes('def ')) {
    tags.push('Has Code');
  }

  // Check for images
  if (allContent.includes('[image:')) {
    tags.push('Has Images');
  }

  // Category detection (simple keyword-based)
  const technicalKeywords = ['api', 'database', 'server', 'code', 'function', 'algorithm'];
  const creativeKeywords = ['story', 'poem', 'creative', 'narrative', 'character'];
  const analyticalKeywords = ['analysis', 'research', 'study', 'data', 'statistics'];

  const hasTechnical = technicalKeywords.some(kw => allContent.includes(kw));
  const hasCreative = creativeKeywords.some(kw => allContent.includes(kw));
  const hasAnalytical = analyticalKeywords.some(kw => allContent.includes(kw));

  if (hasTechnical) tags.push('Technical');
  if (hasCreative) tags.push('Creative');
  if (hasAnalytical) tags.push('Analytical');

  return tags;
}

/**
 * Generate message-level tags
 */
function generateMessageTags(message: Message): string[] {
  const tags: string[] = [];

  // Length tag
  const wordCount = message.content.split(/\s+/).length;
  if (wordCount < 50) {
    tags.push('Short');
  } else if (wordCount < 200) {
    tags.push('Medium');
  } else {
    tags.push('Long');
  }

  // Content tags
  if (message.content.includes('```')) {
    tags.push('Has Code');
  }

  if (message.content.includes('[Image:')) {
    tags.push('Has Image');
  }

  if (message.content.trim().endsWith('?')) {
    tags.push('Question');
  }

  return tags;
}

// ============================================================
// ARCHIVE SERVICE
// ============================================================

export const archiveService = {
  /**
   * Fetch all conversations from the archive
   */
  async fetchConversations(): Promise<ConversationMetadata[]> {
    try {
      const response = await fetch(`${ARCHIVE_API}/api/conversations`);
      if (!response.ok) {
        throw new Error(`Archive server returned ${response.status}`);
      }

      const data = await response.json();
      const conversations = data.conversations || [];

      // Add auto-generated tags to each conversation
      return conversations.map((conv: ConversationMetadata) => ({
        ...conv,
        tags: [
          ...generateTimeTags(conv.folder, conv.created_at),
          ...generateLengthTags(conv.message_count),
        ],
      }));
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      throw new Error(
        'Could not connect to archive server. Make sure it\'s running:\n' +
        '  cd narrative-studio\n' +
        '  node archive-server.js'
      );
    }
  },

  /**
   * Fetch a specific conversation with all messages
   */
  async fetchConversation(folder: string): Promise<Conversation> {
    try {
      const response = await fetch(
        `${ARCHIVE_API}/api/conversations/${encodeURIComponent(folder)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to load conversation: ${response.status}`);
      }

      const data: Conversation = await response.json();

      // Add auto-generated tags to messages
      const messagesWithTags = data.messages.map(msg => ({
        ...msg,
        tags: generateMessageTags(msg),
      }));

      // Add auto-generated conversation-level tags
      const conversationTags = [
        ...generateTimeTags(data.folder, data.created_at),
        ...generateLengthTags(data.messages.length),
        ...generateContentTags(data.messages),
      ];

      return {
        ...data,
        messages: messagesWithTags,
        tags: conversationTags,
      };
    } catch (error) {
      console.error(`Failed to load conversation ${folder}:`, error);
      throw error;
    }
  },

  /**
   * Convert a conversation to a Narrative for display in canvas
   */
  conversationToNarrative(conversation: Conversation, messageIndex?: number) {
    let content: string;
    let title: string;

    if (messageIndex !== undefined && messageIndex !== null) {
      // Single message
      const message = conversation.messages[messageIndex];
      content = message.content;
      title = `${conversation.title} - Message #${messageIndex + 1}`;
    } else {
      // Full conversation
      content = conversation.messages
        .map((msg, idx) => {
          const header = `## ${msg.role.toUpperCase()} (Message #${idx + 1})`;
          return `${header}\n\n${msg.content}`;
        })
        .join('\n\n---\n\n');
      title = conversation.title;
    }

    return {
      id: `archive-${conversation.id}${messageIndex !== undefined ? `-${messageIndex}` : ''}`,
      title,
      content,
      metadata: {
        source: 'Archive',
        wordCount: content.split(/\s+/).length,
        tags: conversation.tags,
        date: conversation.created_at
          ? new Date(conversation.created_at * 1000).toISOString()
          : undefined,
      },
      createdAt: conversation.created_at
        ? new Date(conversation.created_at * 1000)
        : new Date(),
      updatedAt: conversation.updated_at
        ? new Date(conversation.updated_at * 1000)
        : new Date(),
    };
  },
};
