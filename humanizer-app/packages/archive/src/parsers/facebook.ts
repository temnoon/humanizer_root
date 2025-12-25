/**
 * Facebook Archive Parser
 *
 * Parses Facebook/Meta data export format:
 * - messages/inbox/{contact}/message_*.json
 * - messages/archived_threads/
 * - your_activity_across_facebook/
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { tokenize } from '@humanizer/core';
import type {
  ParsedArchive,
  Conversation,
  Message,
  MessageAuthor,
  MediaFile,
  ArchiveStats,
} from '../types/index.js';

/**
 * Facebook message JSON structure
 */
interface FacebookMessageFile {
  participants: Array<{ name: string }>;
  messages: FacebookMessage[];
  title: string;
  is_still_participant: boolean;
  thread_path: string;
}

interface FacebookMessage {
  sender_name: string;
  timestamp_ms: number;
  content?: string;
  type: string;
  photos?: Array<{ uri: string }>;
  audio_files?: Array<{ uri: string }>;
  videos?: Array<{ uri: string }>;
  files?: Array<{ uri: string }>;
  reactions?: Array<{ reaction: string; actor: string }>;
}

/**
 * Parse a Facebook export directory
 */
export async function parseFacebook(archivePath: string): Promise<ParsedArchive> {
  const conversations: Conversation[] = [];
  const media: MediaFile[] = [];

  // Look for messages in standard locations
  const messagePaths = [
    join(archivePath, 'messages', 'inbox'),
    join(archivePath, 'messages', 'archived_threads'),
    join(archivePath, 'your_activity_across_facebook', 'messages', 'inbox'),
  ];

  for (const msgPath of messagePaths) {
    if (!existsSync(msgPath)) continue;

    for (const threadDir of readdirSync(msgPath)) {
      const threadPath = join(msgPath, threadDir);
      if (!statSync(threadPath).isDirectory()) continue;

      const conv = await parseThread(threadPath, threadDir);
      if (conv) {
        conversations.push(conv);

        // Collect media references
        for (const msg of conv.messages) {
          if (msg.attachments) {
            for (const att of msg.attachments) {
              media.push({
                originalPath: att.path,
                type: att.type as 'image' | 'audio' | 'video' | 'document',
                messageId: msg.id,
                size: 0, // Would need to stat the file
              });
            }
          }
        }
      }
    }
  }

  // Calculate stats
  let totalMessages = 0;
  let userMessages = 0;
  let totalWords = 0;
  let earliest: Date | undefined;
  let latest: Date | undefined;

  for (const conv of conversations) {
    totalMessages += conv.messages.length;
    for (const msg of conv.messages) {
      if (msg.author.role === 'user') userMessages++;
      totalWords += msg.content.split(/\s+/).filter(w => w.length > 0).length;
    }
    if (!earliest || conv.createdAt < earliest) earliest = conv.createdAt;
    if (!latest || conv.updatedAt > latest) latest = conv.updatedAt;
  }

  const stats: ArchiveStats = {
    conversationCount: conversations.length,
    messageCount: totalMessages,
    userMessageCount: userMessages,
    assistantMessageCount: 0, // Facebook has no assistants
    wordCount: totalWords,
    dateRange: { earliest, latest },
  };

  return {
    type: 'facebook',
    sourcePath: archivePath,
    conversations,
    stats,
    media,
  };
}

async function parseThread(
  threadPath: string,
  threadId: string
): Promise<Conversation | null> {
  const messages: Message[] = [];
  let title = threadId;
  let participants: string[] = [];

  // Find all message_*.json files
  const files = readdirSync(threadPath).filter(
    f => f.startsWith('message') && f.endsWith('.json')
  );

  for (const file of files) {
    try {
      const raw = readFileSync(join(threadPath, file), 'utf-8');
      const data: FacebookMessageFile = JSON.parse(raw);

      title = data.title || title;
      participants = data.participants.map(p => decodeFacebookString(p.name));

      for (const msg of data.messages) {
        if (!msg.content) continue;

        const content = decodeFacebookString(msg.content);
        if (!content.trim()) continue;

        const author: MessageAuthor = {
          role: 'human', // Facebook messages are human-to-human
          name: decodeFacebookString(msg.sender_name),
        };

        const message: Message = {
          id: `${threadId}-${msg.timestamp_ms}`,
          author,
          content,
          timestamp: new Date(msg.timestamp_ms),
          contentType: 'text',
          attachments: [],
        };

        // Collect attachments
        if (msg.photos) {
          for (const photo of msg.photos) {
            message.attachments!.push({
              type: 'image',
              filename: photo.uri.split('/').pop() || 'photo',
              path: join(threadPath, photo.uri),
            });
          }
        }

        if (msg.audio_files) {
          for (const audio of msg.audio_files) {
            message.attachments!.push({
              type: 'audio',
              filename: audio.uri.split('/').pop() || 'audio',
              path: join(threadPath, audio.uri),
            });
          }
        }

        messages.push(message);
      }
    } catch (error) {
      // Skip malformed files
      console.error(`Error parsing ${file}:`, error);
    }
  }

  if (messages.length === 0) {
    return null;
  }

  // Sort chronologically
  messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Tokenize into sentences
  for (const msg of messages) {
    msg.sentences = tokenize(msg.content, {
      source: {
        archiveType: 'facebook',
        timestamp: msg.timestamp,
        author: msg.author.name,
      },
    });
  }

  const earliest = messages[0].timestamp;
  const latest = messages[messages.length - 1].timestamp;

  return {
    id: threadId,
    title: decodeFacebookString(title),
    source: 'facebook',
    createdAt: earliest,
    updatedAt: latest,
    messages,
    metadata: { participants },
  };
}

/**
 * Facebook exports use escaped unicode for non-ASCII characters
 */
function decodeFacebookString(str: string): string {
  try {
    // Facebook uses \u00XX encoding for UTF-8 bytes
    return str.replace(/\\u00([0-9a-fA-F]{2})/g, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
  } catch {
    return str;
  }
}

/**
 * Check if a path looks like a Facebook export
 */
export function isFacebookArchive(path: string): boolean {
  return (
    existsSync(join(path, 'messages')) ||
    existsSync(join(path, 'your_activity_across_facebook'))
  );
}
