// ============================================================
// FACEBOOK EXPORT PARSER
// ============================================================
// Parses Facebook data export (messages/inbox format)
// Supports JSON format downloads from Facebook's "Download Your Information" feature

import * as path from 'path';
import * as fs from 'fs';
import type { Conversation, Message, MessageAuthor, MessageContent, MessageAttachment } from './types';
import { readJSON, findFiles } from './utils';

/**
 * Facebook message structure (from data export)
 */
interface FacebookMessage {
  sender_name: string;
  timestamp_ms: number;
  content?: string;
  type?: string;
  photos?: Array<{ uri: string; creation_timestamp?: number }>;
  videos?: Array<{ uri: string; creation_timestamp?: number; thumbnail?: { uri: string } }>;
  audio_files?: Array<{ uri: string; creation_timestamp?: number }>;
  files?: Array<{ uri: string; creation_timestamp?: number }>;
  share?: { link?: string; share_text?: string };
  reactions?: Array<{ reaction: string; actor: string }>;
  call_duration?: number;
  is_unsent?: boolean;
}

/**
 * Facebook conversation/thread structure
 */
interface FacebookThread {
  participants: Array<{ name: string }>;
  messages: FacebookMessage[];
  title?: string;
  is_still_participant?: boolean;
  thread_type?: string;
  thread_path?: string;
}

export class FacebookParser {
  /**
   * Parse all conversations from an extracted Facebook export directory
   */
  async parseConversations(extractedDir: string): Promise<Conversation[]> {
    const conversations: Conversation[] = [];
    const messageFiles = this.findMessageFiles(extractedDir);

    console.log(`Found ${messageFiles.length} Facebook message JSON files`);

    for (const filePath of messageFiles) {
      try {
        const threadData = this.readFacebookJSON<FacebookThread>(filePath);
        if (!threadData || !threadData.messages || threadData.messages.length === 0) {
          console.log(`Skipping empty conversation: ${filePath}`);
          continue;
        }

        const conversation = this.convertToConversation(threadData, filePath, extractedDir);
        conversations.push(conversation);
      } catch (err) {
        console.error(`Failed to parse ${filePath}:`, err);
      }
    }

    console.log(`Successfully parsed ${conversations.length} Facebook conversations`);
    return conversations;
  }

  /**
   * Find all message_*.json files in the Facebook export
   * Facebook organizes messages in: messages/inbox/<thread-name>/message_*.json
   */
  private findMessageFiles(extractedDir: string): string[] {
    // Look for message files in inbox and archived_threads
    const inboxPattern = /messages\/(inbox|archived_threads)\/[^\/]+\/message_\d+\.json$/i;
    const allFiles = findFiles(extractedDir, inboxPattern);

    console.log(`[FacebookParser] Found ${allFiles.length} message files`);
    return allFiles;
  }

  /**
   * Read and decode Facebook JSON file
   * Facebook uses non-standard Unicode escaping (\u00XX\u00YY for UTF-8)
   */
  private readFacebookJSON<T>(filePath: string): T | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const decoded = this.decodeFacebookUnicode(content);
      return JSON.parse(decoded);
    } catch (err) {
      console.error(`Failed to read Facebook JSON: ${filePath}`, err);
      return null;
    }
  }

  /**
   * Decode Facebook's non-standard Unicode encoding
   * Facebook escapes UTF-8 bytes as Unicode code points (e.g., \u00e9 for é)
   * We need to convert these back to proper characters
   */
  private decodeFacebookUnicode(text: string): string {
    // This regex matches Facebook's Unicode escape sequences
    return text.replace(/\\u00([0-9a-f]{2})/gi, (match, hex) => {
      const code = parseInt(hex, 16);
      // If it's a valid Latin-1 character, convert it
      if (code >= 128) {
        // Try to decode as UTF-8 byte sequence
        return String.fromCharCode(code);
      }
      return match;
    });
  }

  /**
   * Convert Facebook thread to our standard Conversation format
   */
  private convertToConversation(
    thread: FacebookThread,
    filePath: string,
    extractedDir: string
  ): Conversation {
    // Generate conversation ID from thread path
    const conversationId = this.generateConversationId(filePath);

    // Get conversation title
    const title = thread.title || this.generateTitle(thread);

    // Get timestamps
    const timestamps = thread.messages.map(m => m.timestamp_ms);
    const createTime = Math.min(...timestamps) / 1000; // Convert to seconds
    const updateTime = Math.max(...timestamps) / 1000;

    // Convert messages to our format
    const mapping = this.buildMapping(thread.messages, conversationId);

    // Extract media files
    const mediaFiles = this.extractMediaFiles(thread.messages, filePath);

    const conversation: Conversation = {
      conversation_id: conversationId,
      title: title,
      create_time: createTime,
      update_time: updateTime,
      mapping: mapping,
      moderation_results: [],
      current_node: undefined, // Facebook doesn't have branching
      plugin_ids: null,
      conversation_template_id: null,

      // Extended metadata
      _source: 'openai', // Use 'openai' format for compatibility
      _import_date: new Date().toISOString(),
      _original_id: conversationId,
      _media_files: mediaFiles,

      // Facebook-specific metadata (preserve in conversation object)
      _facebook_metadata: {
        participants: thread.participants,
        is_still_participant: thread.is_still_participant,
        thread_type: thread.thread_type,
        message_count: thread.messages.length,
      },
    };

    return conversation;
  }

  /**
   * Generate a unique conversation ID from the file path
   */
  private generateConversationId(filePath: string): string {
    // Extract thread name from path: .../inbox/<thread-name>/message_1.json
    const match = filePath.match(/\/inbox\/([^\/]+)\/message_\d+\.json$/i) ||
                  filePath.match(/\/archived_threads\/([^\/]+)\/message_\d+\.json$/i);

    if (match && match[1]) {
      return `facebook_${match[1]}`;
    }

    // Fallback: use basename
    return `facebook_${path.basename(path.dirname(filePath))}`;
  }

  /**
   * Generate a title from thread participants
   */
  private generateTitle(thread: FacebookThread): string {
    if (thread.title) {
      return thread.title;
    }

    if (thread.participants && thread.participants.length > 0) {
      const names = thread.participants.map(p => p.name).filter(Boolean);
      if (names.length > 0) {
        return names.join(', ');
      }
    }

    return 'Facebook Conversation';
  }

  /**
   * Build conversation mapping from Facebook messages
   * Facebook messages are linear (no branching), so we create a simple chain
   */
  private buildMapping(messages: FacebookMessage[], conversationId: string): any {
    const mapping: any = {};

    // Sort messages by timestamp (oldest first)
    const sortedMessages = [...messages].sort((a, b) => a.timestamp_ms - b.timestamp_ms);

    // Create root node
    const rootId = `${conversationId}_root`;
    mapping[rootId] = {
      id: rootId,
      message: undefined,
      parent: undefined,
      children: sortedMessages.length > 0 ? [`${conversationId}_msg_0`] : [],
    };

    // Convert each message to a node
    sortedMessages.forEach((fbMsg, index) => {
      const nodeId = `${conversationId}_msg_${index}`;
      const prevNodeId = index === 0 ? rootId : `${conversationId}_msg_${index - 1}`;
      const nextNodeId = index < sortedMessages.length - 1
        ? `${conversationId}_msg_${index + 1}`
        : undefined;

      const message = this.convertMessage(fbMsg, nodeId);

      mapping[nodeId] = {
        id: nodeId,
        message: message,
        parent: prevNodeId,
        children: nextNodeId ? [nextNodeId] : [],
      };
    });

    return mapping;
  }

  /**
   * Convert Facebook message to our Message format
   */
  private convertMessage(fbMsg: FacebookMessage, messageId: string): Message {
    // Determine role (Facebook doesn't distinguish, so we alternate or use sender name)
    // For simplicity, we'll mark all as 'user' and include sender name in author
    const author: MessageAuthor = {
      role: 'user',
      name: fbMsg.sender_name,
      metadata: {},
    };

    // Build content
    const parts: string[] = [];

    if (fbMsg.content) {
      parts.push(fbMsg.content);
    }

    // Add media descriptions
    if (fbMsg.photos && fbMsg.photos.length > 0) {
      parts.push(`[${fbMsg.photos.length} photo(s)]`);
    }
    if (fbMsg.videos && fbMsg.videos.length > 0) {
      parts.push(`[${fbMsg.videos.length} video(s)]`);
    }
    if (fbMsg.audio_files && fbMsg.audio_files.length > 0) {
      parts.push(`[${fbMsg.audio_files.length} audio file(s)]`);
    }
    if (fbMsg.files && fbMsg.files.length > 0) {
      parts.push(`[${fbMsg.files.length} file(s)]`);
    }
    if (fbMsg.share) {
      parts.push(`[Shared: ${fbMsg.share.link || fbMsg.share.share_text || 'link'}]`);
    }
    if (fbMsg.call_duration !== undefined) {
      const duration = Math.floor(fbMsg.call_duration / 60);
      parts.push(`[Call duration: ${duration} minutes]`);
    }

    const content: MessageContent = {
      content_type: 'text',
      parts: parts.length > 0 ? parts : [''],
    };

    // Build attachments array
    const attachments: MessageAttachment[] = [];

    if (fbMsg.photos) {
      fbMsg.photos.forEach((photo, idx) => {
        attachments.push({
          id: `photo_${idx}`,
          name: path.basename(photo.uri),
          mimeType: 'image/jpeg',
        });
      });
    }

    if (fbMsg.videos) {
      fbMsg.videos.forEach((video, idx) => {
        attachments.push({
          id: `video_${idx}`,
          name: path.basename(video.uri),
          mimeType: 'video/mp4',
        });
      });
    }

    if (fbMsg.audio_files) {
      fbMsg.audio_files.forEach((audio, idx) => {
        attachments.push({
          id: `audio_${idx}`,
          name: path.basename(audio.uri),
          mimeType: 'audio/mp4',
        });
      });
    }

    const message: Message = {
      id: messageId,
      author: author,
      create_time: Math.floor(fbMsg.timestamp_ms / 1000), // Convert to seconds
      update_time: undefined,
      content: content,
      status: fbMsg.is_unsent ? 'unsent' : 'finished_successfully',
      metadata: {
        attachments: attachments.length > 0 ? attachments : undefined,
        reactions: fbMsg.reactions,
        message_type: fbMsg.type || 'Generic',
      },
      recipient: 'all',
      weight: 1.0,
      end_turn: true,
    };

    return message;
  }

  /**
   * Extract media file references from messages
   */
  private extractMediaFiles(messages: FacebookMessage[], filePath: string): string[] {
    const mediaFiles = new Set<string>();
    const baseDir = path.dirname(filePath);

    messages.forEach(msg => {
      // Photos
      if (msg.photos) {
        msg.photos.forEach(photo => {
          if (photo.uri) {
            // Convert relative URI to absolute path
            const mediaPath = path.join(baseDir, photo.uri);
            mediaFiles.add(mediaPath);
          }
        });
      }

      // Videos
      if (msg.videos) {
        msg.videos.forEach(video => {
          if (video.uri) {
            const mediaPath = path.join(baseDir, video.uri);
            mediaFiles.add(mediaPath);
          }
          if (video.thumbnail?.uri) {
            const thumbPath = path.join(baseDir, video.thumbnail.uri);
            mediaFiles.add(thumbPath);
          }
        });
      }

      // Audio files
      if (msg.audio_files) {
        msg.audio_files.forEach(audio => {
          if (audio.uri) {
            const mediaPath = path.join(baseDir, audio.uri);
            mediaFiles.add(mediaPath);
          }
        });
      }

      // Generic files
      if (msg.files) {
        msg.files.forEach(file => {
          if (file.uri) {
            const mediaPath = path.join(baseDir, file.uri);
            mediaFiles.add(mediaPath);
          }
        });
      }
    });

    return Array.from(mediaFiles);
  }

  /**
   * Detect if a directory contains Facebook export format
   */
  static async detectFormat(extractedDir: string): Promise<boolean> {
    // Look for Facebook's characteristic directory structure
    const inboxPattern = /messages\/(inbox|archived_threads)\/[^\/]+\/message_\d+\.json$/i;
    const messageFiles = findFiles(extractedDir, inboxPattern);

    if (messageFiles.length === 0) {
      return false;
    }

    // Check first file for Facebook-specific structure
    try {
      const content = fs.readFileSync(messageFiles[0], 'utf-8');
      const data = JSON.parse(content);

      // Facebook threads have 'participants' and 'messages' arrays
      const hasParticipants = Array.isArray(data.participants);
      const hasMessages = Array.isArray(data.messages);
      const hasTimestampMs = data.messages?.[0]?.timestamp_ms !== undefined;

      return hasParticipants && hasMessages && hasTimestampMs;
    } catch {
      return false;
    }
  }
}
