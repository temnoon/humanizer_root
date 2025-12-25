/**
 * Archive Connector - Import content from various sources
 *
 * Supports:
 * - ChatGPT exports (conversations.json)
 * - Facebook exports (messages/inbox)
 * - Manual text input
 * - Book/notebook imports
 */

import type { ArchiveSource, ContentItem } from './types';
import { ContentGraph } from './graph';

// ═══════════════════════════════════════════════════════════════════
// ARCHIVE TYPES
// ═══════════════════════════════════════════════════════════════════

export interface Archive {
  id: string;
  type: 'chatgpt' | 'facebook' | 'notebook' | 'book' | 'manual';
  name: string;
  path?: string;  // File path or URL
  loadedAt: number;
}

export interface ArchiveConversation {
  id: string;
  title: string;
  createTime?: number;
  updateTime?: number;
  messageCount: number;
}

export interface ArchiveMessage {
  id: string;
  conversationId: string;
  author: 'user' | 'assistant' | 'system';
  content: string;
  createTime?: number;
}

// ═══════════════════════════════════════════════════════════════════
// CHATGPT ARCHIVE PARSER
// ═══════════════════════════════════════════════════════════════════

interface ChatGPTExport {
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, ChatGPTNode>;
}

interface ChatGPTNode {
  id: string;
  message?: {
    author: { role: string };
    content: { parts?: string[] };
    create_time?: number;
  };
  parent?: string;
  children?: string[];
}

export function parseChatGPTExport(data: ChatGPTExport[]): {
  conversations: ArchiveConversation[];
  messages: Map<string, ArchiveMessage[]>;
} {
  const conversations: ArchiveConversation[] = [];
  const messages = new Map<string, ArchiveMessage[]>();

  for (const conv of data) {
    const convId = `chatgpt-${conv.create_time}`;
    const convMessages: ArchiveMessage[] = [];

    // Walk the message tree
    for (const node of Object.values(conv.mapping)) {
      if (node.message?.content?.parts?.length) {
        const text = node.message.content.parts.join('\n');
        if (text.trim()) {
          convMessages.push({
            id: node.id,
            conversationId: convId,
            author: node.message.author.role as 'user' | 'assistant' | 'system',
            content: text,
            createTime: node.message.create_time,
          });
        }
      }
    }

    // Sort by time
    convMessages.sort((a, b) => (a.createTime ?? 0) - (b.createTime ?? 0));

    conversations.push({
      id: convId,
      title: conv.title || 'Untitled',
      createTime: conv.create_time,
      updateTime: conv.update_time,
      messageCount: convMessages.length,
    });

    messages.set(convId, convMessages);
  }

  return { conversations, messages };
}

// ═══════════════════════════════════════════════════════════════════
// ARCHIVE CONNECTOR CLASS
// ═══════════════════════════════════════════════════════════════════

export class ArchiveConnector {
  private archives: Map<string, Archive> = new Map();
  private conversations: Map<string, ArchiveConversation[]> = new Map();
  private messages: Map<string, ArchiveMessage[]> = new Map();

  constructor(private graph: ContentGraph) {}

  // ─────────────────────────────────────────────────────────────────
  // ARCHIVE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  getArchives(): Archive[] {
    return Array.from(this.archives.values());
  }

  getArchive(archiveId: string): Archive | null {
    return this.archives.get(archiveId) ?? null;
  }

  // ─────────────────────────────────────────────────────────────────
  // LOAD ARCHIVES
  // ─────────────────────────────────────────────────────────────────

  /**
   * Load a ChatGPT export from JSON data
   */
  loadChatGPTExport(data: ChatGPTExport[], name = 'ChatGPT Archive'): Archive {
    const archiveId = `archive-${Date.now()}`;
    const { conversations, messages } = parseChatGPTExport(data);

    const archive: Archive = {
      id: archiveId,
      type: 'chatgpt',
      name,
      loadedAt: Date.now(),
    };

    this.archives.set(archiveId, archive);
    this.conversations.set(archiveId, conversations);

    // Index messages by conversation
    for (const [convId, msgs] of messages) {
      this.messages.set(convId, msgs);
    }

    return archive;
  }

  /**
   * Load manual text as an archive
   */
  loadManualText(text: string, title = 'Manual Input'): Archive {
    const archiveId = `archive-${Date.now()}`;
    const convId = `manual-${Date.now()}`;

    const archive: Archive = {
      id: archiveId,
      type: 'manual',
      name: title,
      loadedAt: Date.now(),
    };

    const conversation: ArchiveConversation = {
      id: convId,
      title,
      createTime: Date.now(),
      messageCount: 1,
    };

    const message: ArchiveMessage = {
      id: `msg-${Date.now()}`,
      conversationId: convId,
      author: 'user',
      content: text,
      createTime: Date.now(),
    };

    this.archives.set(archiveId, archive);
    this.conversations.set(archiveId, [conversation]);
    this.messages.set(convId, [message]);

    return archive;
  }

  // ─────────────────────────────────────────────────────────────────
  // BROWSE ARCHIVES
  // ─────────────────────────────────────────────────────────────────

  getConversations(archiveId: string): ArchiveConversation[] {
    return this.conversations.get(archiveId) ?? [];
  }

  getMessages(conversationId: string): ArchiveMessage[] {
    return this.messages.get(conversationId) ?? [];
  }

  getMessage(messageId: string): ArchiveMessage | null {
    for (const messages of this.messages.values()) {
      const msg = messages.find(m => m.id === messageId);
      if (msg) return msg;
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // IMPORT TO GRAPH
  // ─────────────────────────────────────────────────────────────────

  /**
   * Import a message into the content graph
   */
  importMessage(messageId: string): string | null {
    const message = this.getMessage(messageId);
    if (!message) return null;

    // Find archive and conversation for provenance
    let archiveId: string | undefined;
    let convTitle: string | undefined;

    for (const [aId, convs] of this.conversations) {
      const conv = convs.find(c => c.id === message.conversationId);
      if (conv) {
        archiveId = aId;
        convTitle = conv.title;
        break;
      }
    }

    const archive = archiveId ? this.archives.get(archiveId) : undefined;

    const source: ArchiveSource = {
      type: archive?.type ?? 'manual',
      archiveId,
      conversationId: message.conversationId,
      messageId: message.id,
      path: [
        archive?.name ?? 'Archive',
        convTitle ?? 'Conversation',
        `Message ${message.id.slice(-6)}`,
      ],
    };

    const node = this.graph.importFromArchive(
      message.content,
      source,
      convTitle
    );

    return node.id;
  }

  /**
   * Import an entire conversation (all messages joined)
   */
  importConversation(conversationId: string): string | null {
    const messages = this.messages.get(conversationId);
    if (!messages || messages.length === 0) return null;

    // Find archive for provenance
    let archiveId: string | undefined;
    let conversation: ArchiveConversation | undefined;

    for (const [aId, convs] of this.conversations) {
      const conv = convs.find(c => c.id === conversationId);
      if (conv) {
        archiveId = aId;
        conversation = conv;
        break;
      }
    }

    const archive = archiveId ? this.archives.get(archiveId) : undefined;

    // Join all messages
    const text = messages
      .map(m => `[${m.author}]\n${m.content}`)
      .join('\n\n---\n\n');

    const source: ArchiveSource = {
      type: archive?.type ?? 'manual',
      archiveId,
      conversationId,
      path: [
        archive?.name ?? 'Archive',
        conversation?.title ?? 'Conversation',
      ],
    };

    const node = this.graph.importFromArchive(
      text,
      source,
      conversation?.title
    );

    return node.id;
  }

  /**
   * Import all messages as separate items (returns array node)
   */
  importConversationAsItems(conversationId: string): string | null {
    const messages = this.messages.get(conversationId);
    if (!messages || messages.length === 0) return null;

    // Find archive for provenance
    let archiveId: string | undefined;
    let conversation: ArchiveConversation | undefined;

    for (const [aId, convs] of this.conversations) {
      const conv = convs.find(c => c.id === conversationId);
      if (conv) {
        archiveId = aId;
        conversation = conv;
        break;
      }
    }

    const archive = archiveId ? this.archives.get(archiveId) : undefined;

    const items: ContentItem[] = messages.map((m, index) => ({
      id: m.id,
      text: m.content,
      index,
      metadata: {
        author: m.author,
        createTime: m.createTime,
        wordCount: m.content.split(/\s+/).length,
      },
    }));

    const source: ArchiveSource = {
      type: archive?.type ?? 'manual',
      archiveId,
      conversationId,
      path: [
        archive?.name ?? 'Archive',
        conversation?.title ?? 'Conversation',
      ],
    };

    const node = this.graph.createNode(items, null, {
      type: 'import',
      operator: 'conversation-items',
      params: { conversationId },
      timestamp: Date.now(),
    }, {
      title: conversation?.title,
      source,
    });

    return node.id;
  }

  // ─────────────────────────────────────────────────────────────────
  // SERIALIZATION
  // ─────────────────────────────────────────────────────────────────

  toJSON(): {
    archives: Record<string, Archive>;
    conversations: Record<string, ArchiveConversation[]>;
    messages: Record<string, ArchiveMessage[]>;
  } {
    const archives: Record<string, Archive> = {};
    const conversations: Record<string, ArchiveConversation[]> = {};
    const messages: Record<string, ArchiveMessage[]> = {};

    for (const [id, archive] of this.archives) {
      archives[id] = archive;
    }
    for (const [id, convs] of this.conversations) {
      conversations[id] = convs;
    }
    for (const [id, msgs] of this.messages) {
      messages[id] = msgs;
    }

    return { archives, conversations, messages };
  }

  static fromJSON(
    data: {
      archives: Record<string, Archive>;
      conversations: Record<string, ArchiveConversation[]>;
      messages: Record<string, ArchiveMessage[]>;
    },
    graph: ContentGraph
  ): ArchiveConnector {
    const connector = new ArchiveConnector(graph);

    for (const [id, archive] of Object.entries(data.archives)) {
      connector.archives.set(id, archive);
    }
    for (const [id, convs] of Object.entries(data.conversations)) {
      connector.conversations.set(id, convs);
    }
    for (const [id, msgs] of Object.entries(data.messages)) {
      connector.messages.set(id, msgs);
    }

    return connector;
  }
}
