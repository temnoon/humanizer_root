/**
 * Instagram Export Parser
 *
 * Parses Instagram GDPR data export (JSON format)
 * Supports: posts, comments, messages/inbox
 *
 * Structure:
 * - Posts: One conversation per post (natural content unit)
 * - Comments: Grouped by media owner (your comments on same person's posts)
 * - DMs: Grouped by conversation thread
 */

import * as path from 'path';
import * as fs from 'fs';
import type {
  Conversation,
  ConversationMapping,
  Message,
  MessageAuthor,
  MessageContent,
  MessageAttachment,
} from './types.js';
import { findFiles } from './utils.js';

/**
 * Instagram post structure
 */
interface InstagramPost {
  media?: Array<{
    uri: string;
    creation_timestamp: number;
    title?: string;
    media_metadata?: {
      camera_metadata?: { has_camera_metadata: boolean };
    };
  }>;
  title?: string;
  creation_timestamp: number;
}

/**
 * Instagram comment structure
 */
interface InstagramComment {
  media_list_data?: Array<{ uri: string }>;
  string_map_data: {
    Comment: { value: string };
    'Media Owner'?: { value: string };
    Time: { timestamp: number };
  };
}

/**
 * Instagram message structure (same as Facebook)
 */
interface InstagramMessage {
  sender_name: string;
  timestamp_ms: number;
  content?: string;
  type?: string;
  photos?: Array<{ uri: string; creation_timestamp?: number }>;
  videos?: Array<{ uri: string; creation_timestamp?: number }>;
  audio_files?: Array<{ uri: string; creation_timestamp?: number }>;
  share?: { link?: string; share_text?: string };
  reactions?: Array<{ reaction: string; actor: string }>;
  is_unsent?: boolean;
  is_geoblocked_for_viewer?: boolean;
}

/**
 * Instagram thread structure
 */
interface InstagramThread {
  participants: Array<{ name: string }>;
  messages: InstagramMessage[];
  title?: string;
  is_still_participant?: boolean;
  thread_path?: string;
  magic_words?: unknown[];
}

export class InstagramParser {
  private username: string = '';

  /**
   * Parse all content from an extracted Instagram export directory
   */
  async parseConversations(extractedDir: string): Promise<Conversation[]> {
    const conversations: Conversation[] = [];

    // Detect base activity directory
    const activityDir = this.findActivityDir(extractedDir);
    if (!activityDir) {
      console.log('Could not find your_instagram_activity directory');
      return conversations;
    }

    // Get username from personal_information if available
    await this.loadUsername(extractedDir);

    // Parse posts - one conversation per post
    const postConversations = await this.parsePosts(activityDir, extractedDir);
    conversations.push(...postConversations);
    if (postConversations.length > 0) {
      console.log(`Parsed ${postConversations.length} Instagram posts`);
    }

    // Parse comments
    const commentsConv = await this.parseComments(activityDir);
    if (commentsConv) {
      conversations.push(commentsConv);
    }

    // Parse messages
    const messageConversations = await this.parseMessages(activityDir, extractedDir);
    conversations.push(...messageConversations);

    console.log(`Successfully parsed ${conversations.length} Instagram conversations total`);
    return conversations;
  }

  /**
   * Find the your_instagram_activity directory
   */
  private findActivityDir(extractedDir: string): string | null {
    const direct = path.join(extractedDir, 'your_instagram_activity');
    if (fs.existsSync(direct)) return direct;

    // Check if we're already in it
    if (fs.existsSync(path.join(extractedDir, 'messages'))) {
      return extractedDir;
    }

    return null;
  }

  /**
   * Load username from personal_information
   */
  private async loadUsername(extractedDir: string): Promise<void> {
    const personalInfoDir = path.join(extractedDir, 'personal_information');
    if (!fs.existsSync(personalInfoDir)) return;

    const files = fs.readdirSync(personalInfoDir);
    for (const file of files) {
      if (file.includes('personal_information') && file.endsWith('.json')) {
        try {
          const data = this.readInstagramJSON<{
            profile_user?: Array<{
              string_map_data?: {
                Username?: { value?: string };
              };
            }>;
          }>(path.join(personalInfoDir, file));
          if (data?.profile_user?.[0]?.string_map_data?.Username?.value) {
            this.username = data.profile_user[0].string_map_data.Username.value;
            return;
          }
        } catch {
          // Continue to next file
        }
      }
    }
  }

  /**
   * Parse posts - one conversation per post
   */
  private async parsePosts(
    activityDir: string,
    extractedDir: string
  ): Promise<Conversation[]> {
    const mediaDir = path.join(activityDir, 'media');
    if (!fs.existsSync(mediaDir)) return [];

    // Find posts JSON files
    const postsFiles = findFiles(mediaDir, /posts_\d+\.json$/i);
    if (postsFiles.length === 0) return [];

    const allPosts: InstagramPost[] = [];

    for (const file of postsFiles) {
      const posts = this.readInstagramJSON<InstagramPost[]>(file);
      if (posts) {
        allPosts.push(...posts);
      }
    }

    if (allPosts.length === 0) return [];

    // Sort by timestamp
    const sorted = allPosts.sort((a, b) => a.creation_timestamp - b.creation_timestamp);

    const conversations: Conversation[] = [];

    for (let index = 0; index < sorted.length; index++) {
      const post = sorted[index];
      const timestamp = post.creation_timestamp;
      const conversationId = `instagram_post_${timestamp}_${index}`;

      // Build mapping with single message (the post)
      const mapping: ConversationMapping = {};
      const rootId = `${conversationId}_root`;
      const postNodeId = `${conversationId}_content`;

      mapping[rootId] = {
        id: rootId,
        message: undefined,
        parent: undefined,
        children: [postNodeId],
      };

      // Build content
      const parts: string[] = [];
      if (post.title) {
        parts.push(this.fixInstagramEncoding(post.title));
      }
      if (post.media && post.media.length > 0) {
        parts.push(`[${post.media.length} media file(s)]`);
      }

      // Build attachments
      const attachments: MessageAttachment[] = [];
      if (post.media) {
        post.media.forEach((m, idx) => {
          const ext = path.extname(m.uri).toLowerCase();
          const isVideo = ['.mp4', '.mov', '.avi'].includes(ext);
          attachments.push({
            id: `media_${idx}`,
            name: path.basename(m.uri),
            mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
          });
        });
      }

      const message: Message = {
        id: postNodeId,
        author: {
          role: 'user',
          name: this.username || 'self',
        },
        create_time: timestamp,
        content: {
          content_type: 'text',
          parts: parts.length > 0 ? parts : ['[No caption]'],
        },
        status: 'finished_successfully',
        metadata: {
          attachments: attachments.length > 0 ? attachments : undefined,
          post_index: index,
        },
      };

      mapping[postNodeId] = {
        id: postNodeId,
        message,
        parent: rootId,
        children: [],
      };

      // Generate title from caption or date
      let title = post.title ? this.fixInstagramEncoding(post.title).slice(0, 60) : '';
      if (!title) {
        title = `Post from ${new Date(timestamp * 1000).toLocaleDateString()}`;
      } else if (title.length < (post.title?.length || 0)) {
        title += '...';
      }

      // Extract media files for this post
      const mediaFiles: string[] = [];
      if (post.media) {
        for (const m of post.media) {
          const mediaPath = path.join(extractedDir, m.uri);
          if (fs.existsSync(mediaPath)) {
            mediaFiles.push(mediaPath);
          }
        }
      }

      conversations.push({
        conversation_id: conversationId,
        title,
        create_time: timestamp,
        update_time: timestamp,
        mapping,
        moderation_results: [],
        _source: 'instagram',
        _import_date: new Date().toISOString(),
        _original_id: conversationId,
        _media_files: mediaFiles.length > 0 ? mediaFiles : undefined,
        _instagram_metadata: {
          username: this.username,
          post_count: 1,
          media_count: post.media?.length || 0,
        },
      });
    }

    return conversations;
  }

  /**
   * Parse comments into a single conversation
   */
  private async parseComments(activityDir: string): Promise<Conversation | null> {
    const commentsDir = path.join(activityDir, 'comments');
    if (!fs.existsSync(commentsDir)) return null;

    // Find comment JSON files
    const commentFiles = findFiles(commentsDir, /post_comments_\d+\.json$/i);
    if (commentFiles.length === 0) return null;

    const allComments: InstagramComment[] = [];

    for (const file of commentFiles) {
      const comments = this.readInstagramJSON<InstagramComment[]>(file);
      if (comments) {
        allComments.push(...comments);
      }
    }

    if (allComments.length === 0) return null;

    // Sort by timestamp
    const sorted = allComments.sort(
      (a, b) => a.string_map_data.Time.timestamp - b.string_map_data.Time.timestamp
    );

    const conversationId = `instagram_comments_${this.username || 'user'}`;
    const mapping = this.buildCommentMapping(sorted, conversationId);

    const timestamps = sorted.map((c) => c.string_map_data.Time.timestamp);

    console.log(`Parsed ${sorted.length} Instagram comments`);

    return {
      conversation_id: conversationId,
      title: `Instagram Comments - ${this.username || 'My Comments'}`,
      create_time: Math.min(...timestamps),
      update_time: Math.max(...timestamps),
      mapping,
      moderation_results: [],
      _source: 'instagram',
      _import_date: new Date().toISOString(),
      _original_id: conversationId,
      _instagram_metadata: {
        username: this.username,
        comment_count: sorted.length,
      },
    };
  }

  /**
   * Parse messages from inbox
   */
  private async parseMessages(
    activityDir: string,
    extractedDir: string
  ): Promise<Conversation[]> {
    const conversations: Conversation[] = [];

    // Check both inbox and message_requests
    const messageDirs = ['messages/inbox', 'messages/message_requests'];

    for (const relDir of messageDirs) {
      const messagesDir = path.join(activityDir, relDir);
      if (!fs.existsSync(messagesDir)) continue;

      const threadDirs = fs.readdirSync(messagesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      for (const threadDir of threadDirs) {
        const threadPath = path.join(messagesDir, threadDir);
        const messageFiles = findFiles(threadPath, /message_\d+\.json$/i);

        for (const messageFile of messageFiles) {
          const thread = this.readInstagramJSON<InstagramThread>(messageFile);
          if (!thread || !thread.messages || thread.messages.length === 0) continue;

          const conversation = this.convertThreadToConversation(
            thread,
            messageFile,
            extractedDir
          );
          conversations.push(conversation);
        }
      }
    }

    console.log(`Parsed ${conversations.length} Instagram message conversations`);
    return conversations;
  }

  /**
   * Convert Instagram thread to Conversation
   */
  private convertThreadToConversation(
    thread: InstagramThread,
    filePath: string,
    extractedDir: string
  ): Conversation {
    const conversationId = this.generateConversationId(filePath);
    const title = thread.title || this.generateTitle(thread);

    const timestamps = thread.messages.map((m) => m.timestamp_ms);
    const createTime = Math.min(...timestamps) / 1000;
    const updateTime = Math.max(...timestamps) / 1000;

    const mapping = this.buildMessageMapping(thread.messages, conversationId);
    const mediaFiles = this.extractMessageMediaFiles(thread.messages, filePath, extractedDir);

    return {
      conversation_id: conversationId,
      title,
      create_time: createTime,
      update_time: updateTime,
      mapping,
      moderation_results: [],
      _source: 'instagram',
      _import_date: new Date().toISOString(),
      _original_id: conversationId,
      _media_files: mediaFiles,
      _instagram_metadata: {
        username: this.username,
        message_count: thread.messages.length,
      },
      _facebook_metadata: {
        participants: thread.participants,
        is_still_participant: thread.is_still_participant,
        message_count: thread.messages.length,
      },
    };
  }

  /**
   * Build mapping from comments
   */
  private buildCommentMapping(
    comments: InstagramComment[],
    conversationId: string
  ): ConversationMapping {
    const mapping: ConversationMapping = {};

    const rootId = `${conversationId}_root`;
    mapping[rootId] = {
      id: rootId,
      message: undefined,
      parent: undefined,
      children: comments.length > 0 ? [`${conversationId}_comment_0`] : [],
    };

    comments.forEach((comment, index) => {
      const nodeId = `${conversationId}_comment_${index}`;
      const prevNodeId = index === 0 ? rootId : `${conversationId}_comment_${index - 1}`;
      const nextNodeId =
        index < comments.length - 1 ? `${conversationId}_comment_${index + 1}` : undefined;

      const author: MessageAuthor = {
        role: 'user',
        name: this.username || 'self',
      };

      const commentText = comment.string_map_data.Comment?.value || '';
      const mediaOwner = comment.string_map_data['Media Owner']?.value;

      const content: MessageContent = {
        content_type: 'text',
        parts: [commentText],
      };

      const message: Message = {
        id: nodeId,
        author,
        create_time: comment.string_map_data.Time.timestamp,
        content,
        status: 'finished_successfully',
        metadata: {
          media_owner: mediaOwner,
        },
      };

      mapping[nodeId] = {
        id: nodeId,
        message,
        parent: prevNodeId,
        children: nextNodeId ? [nextNodeId] : [],
      };
    });

    return mapping;
  }

  /**
   * Build mapping from messages
   */
  private buildMessageMapping(
    messages: InstagramMessage[],
    conversationId: string
  ): ConversationMapping {
    const mapping: ConversationMapping = {};

    // Sort messages oldest first
    const sorted = [...messages].sort((a, b) => a.timestamp_ms - b.timestamp_ms);

    const rootId = `${conversationId}_root`;
    mapping[rootId] = {
      id: rootId,
      message: undefined,
      parent: undefined,
      children: sorted.length > 0 ? [`${conversationId}_msg_0`] : [],
    };

    sorted.forEach((msg, index) => {
      const nodeId = `${conversationId}_msg_${index}`;
      const prevNodeId = index === 0 ? rootId : `${conversationId}_msg_${index - 1}`;
      const nextNodeId =
        index < sorted.length - 1 ? `${conversationId}_msg_${index + 1}` : undefined;

      const author: MessageAuthor = {
        role: 'user',
        name: this.fixInstagramEncoding(msg.sender_name),
      };

      // Build content
      const parts: string[] = [];
      if (msg.content) {
        parts.push(this.fixInstagramEncoding(msg.content));
      }
      if (msg.photos && msg.photos.length > 0) {
        parts.push(`[${msg.photos.length} photo(s)]`);
      }
      if (msg.videos && msg.videos.length > 0) {
        parts.push(`[${msg.videos.length} video(s)]`);
      }
      if (msg.audio_files && msg.audio_files.length > 0) {
        parts.push(`[${msg.audio_files.length} audio file(s)]`);
      }
      if (msg.share) {
        parts.push(`[Shared: ${msg.share.link || msg.share.share_text || 'content'}]`);
      }

      const content: MessageContent = {
        content_type: 'text',
        parts: parts.length > 0 ? parts : [''],
      };

      const message: Message = {
        id: nodeId,
        author,
        create_time: Math.floor(msg.timestamp_ms / 1000),
        content,
        status: msg.is_unsent ? 'unsent' : 'finished_successfully',
        metadata: {
          reactions: msg.reactions,
          message_type: msg.type,
        },
      };

      mapping[nodeId] = {
        id: nodeId,
        message,
        parent: prevNodeId,
        children: nextNodeId ? [nextNodeId] : [],
      };
    });

    return mapping;
  }

  /**
   * Generate conversation ID from file path
   */
  private generateConversationId(filePath: string): string {
    const match = filePath.match(/\/(inbox|message_requests)\/([^\/]+)\//i);
    if (match && match[2]) {
      return `instagram_${match[2]}`;
    }
    return `instagram_${path.basename(path.dirname(filePath))}`;
  }

  /**
   * Generate title from thread participants
   */
  private generateTitle(thread: InstagramThread): string {
    if (thread.title) return thread.title;

    if (thread.participants && thread.participants.length > 0) {
      const names = thread.participants
        .map((p) => this.fixInstagramEncoding(p.name))
        .filter(Boolean);
      if (names.length > 0) {
        return names.join(', ');
      }
    }

    return 'Instagram Conversation';
  }

  /**
   * Extract media files from messages
   */
  private extractMessageMediaFiles(
    messages: InstagramMessage[],
    filePath: string,
    extractedDir: string
  ): string[] {
    const mediaFiles: string[] = [];
    const baseDir = path.dirname(filePath);

    for (const msg of messages) {
      const mediaArrays = [msg.photos, msg.videos, msg.audio_files];
      for (const arr of mediaArrays) {
        if (arr) {
          for (const item of arr) {
            // Try relative to message file first
            let mediaPath = path.join(baseDir, item.uri);
            if (!fs.existsSync(mediaPath)) {
              // Try relative to extract dir
              mediaPath = path.join(extractedDir, item.uri);
            }
            if (fs.existsSync(mediaPath)) {
              mediaFiles.push(mediaPath);
            }
          }
        }
      }
    }

    return mediaFiles;
  }

  /**
   * Read Instagram JSON file with encoding fix
   */
  private readInstagramJSON<T>(filePath: string): T | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fixed = this.fixInstagramEncoding(content);
      return JSON.parse(fixed);
    } catch (err) {
      console.error(`Failed to read Instagram JSON: ${filePath}`, err);
      return null;
    }
  }

  /**
   * Fix Instagram's UTF-8/Latin-1 encoding issues
   * Instagram encodes UTF-8 as Latin-1 escaped sequences
   */
  private fixInstagramEncoding(text: string): string {
    // Instagram uses \uXXXX escapes that represent UTF-8 bytes as Latin-1
    // We need to convert these back to proper UTF-8
    try {
      return text.replace(/\\u00([0-9a-f]{2})/gi, (match, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
      });
    } catch {
      return text;
    }
  }

  /**
   * Detect if a directory contains Instagram export format
   */
  static async detectFormat(extractedDir: string): Promise<boolean> {
    // Check for your_instagram_activity directory
    const activityDir = path.join(extractedDir, 'your_instagram_activity');
    if (fs.existsSync(activityDir)) {
      // Verify it has Instagram-specific structure
      const hasMessages = fs.existsSync(path.join(activityDir, 'messages'));
      const hasMedia = fs.existsSync(path.join(activityDir, 'media'));
      return hasMessages || hasMedia;
    }

    // Check if already inside activity dir
    const hasMessages = fs.existsSync(path.join(extractedDir, 'messages'));
    const hasMedia = fs.existsSync(path.join(extractedDir, 'media'));

    if (hasMessages) {
      // Verify it's Instagram (not Facebook) by checking inbox structure
      const inboxDir = path.join(extractedDir, 'messages', 'inbox');
      if (fs.existsSync(inboxDir)) {
        // Instagram threads have message_1.json files
        const messageFiles = findFiles(inboxDir, /message_\d+\.json$/i);
        return messageFiles.length > 0;
      }
    }

    return false;
  }
}
