/**
 * Archive Parser Types
 *
 * TypeScript interfaces for conversation parsing.
 * Based on OpenAI export format with extensions for Claude, Facebook, etc.
 *
 * Ported from narrative-studio with 7-strategy media matching.
 */

export type ExportFormat =
  | 'openai'
  | 'claude'
  | 'facebook'
  | 'chrome-plugin'
  | 'reddit'
  | 'twitter'
  | 'instagram'
  | 'substack'
  | 'unknown';

export type ContentType = 'text' | 'code' | 'execution_output' | 'image' | 'multimodal_text';

export type AuthorRole = 'user' | 'assistant' | 'system' | 'tool';

export interface MessageAuthor {
  role: AuthorRole;
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface MessageContent {
  content_type: ContentType;
  parts: (string | Record<string, unknown>)[];
  language?: string;
  text?: string;
}

export interface MessageAttachment {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  width?: number;
  height?: number;
}

export interface MessageMetadata {
  timestamp_?: string;
  message_type?: string;
  model_slug?: string;
  attachments?: MessageAttachment[];
  citations?: unknown[];
  command?: string;
  status?: string;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  author: MessageAuthor;
  create_time?: number;
  update_time?: number;
  content?: MessageContent;
  status?: string;
  metadata?: MessageMetadata;
  recipient?: string;
  weight?: number;
  end_turn?: boolean;
}

export interface ConversationNode {
  id: string;
  message?: Message;
  parent?: string;
  children: string[];
}

export interface ConversationMapping {
  [nodeId: string]: ConversationNode;
}

export interface Conversation {
  conversation_id: string;
  title: string;
  create_time?: number;
  update_time?: number;
  mapping: ConversationMapping;
  moderation_results: unknown[];
  current_node?: string;
  plugin_ids?: string | null;
  conversation_template_id?: string | null;
  id?: string;

  // Extended metadata (added by parser)
  _media_files?: string[];
  _source?: string; // e.g., 'openai', 'claude', 'plugin-chatgpt', 'plugin-claude', 'plugin-gemini'
  _import_date?: string;
  _original_id?: string;
  _facebook_metadata?: {
    participants?: Array<{ name: string }>;
    is_still_participant?: boolean;
    thread_type?: string;
    message_count?: number;
  };
  _reddit_metadata?: {
    subreddit?: string;
    permalink?: string;
    gildings?: number;
    post_count?: number;
    comment_count?: number;
  };
  _twitter_metadata?: {
    username?: string;
    tweet_count?: number;
    reply_count?: number;
    retweet_count?: number;
    dm_count?: number;
  };
  _instagram_metadata?: {
    username?: string;
    post_count?: number;
    comment_count?: number;
    message_count?: number;
    media_count?: number;
  };
  _substack_metadata?: {
    publication_name?: string;
    post_count?: number;
    email_sent_at?: string;
    audience?: string;
  };
}

export interface MediaFile {
  path: string;
  basename: string;
  size: number;
  ext: string;
  hash?: string;
}

export interface FileIndices {
  basename_size_to_path: Map<string, string>;
  file_id_to_path: Map<string, string>;
  file_hash_to_path: Map<string, string>;
  conversation_to_paths: Map<string, string[]>;
  size_to_paths: Map<number, string[]>;
  path_to_metadata: Map<string, MediaFile>;
}

export interface MediaReferences {
  asset_pointers: Set<string>;
  attachments: MessageAttachment[];
  dalle_generations: Array<{
    gen_id?: string;
    width?: number;
    height?: number;
    prompt?: string;
  }>;
  text_filenames: Set<string>;
}

export interface ParsedArchive {
  conversations: Conversation[];
  mediaFiles: MediaFile[];
  format: ExportFormat;
  extractedPath: string;
  stats: {
    totalConversations: number;
    totalMessages: number;
    totalMediaFiles: number;
    parseErrors: number;
  };
}

export interface ImportJob {
  id: string;
  status: 'uploading' | 'parsing' | 'previewing' | 'applying' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startTime: number;
  endTime?: number;
  error?: string;
  archive?: ParsedArchive;
  preview?: ImportPreview;
}

export interface ImportPreview {
  newConversations: number;
  existingConversationsToUpdate: number;
  newMessages: number;
  newMediaFiles: number;
  conflicts: ImportConflict[];
  estimatedSize: number;
}

export interface ImportConflict {
  conversationId: string;
  conversationTitle: string;
  type: 'duplicate_conversation' | 'duplicate_message' | 'timestamp_mismatch';
  existingCount: number;
  newCount: number;
  resolution?: 'skip' | 'merge' | 'replace';
}

export interface MergeResult {
  conversationId: string;
  messagesAdded: number;
  messagesSkipped: number;
  mediaFilesAdded: number;
  mediaFilesSkipped: number;
}

export interface ImportResult {
  success: boolean;
  conversationsCreated: number;
  conversationsUpdated: number;
  totalMessagesAdded: number;
  totalMediaFilesAdded: number;
  mergeResults: MergeResult[];
  errors: string[];
  duration: number;
}

// Claude-specific types
export interface ClaudeExport {
  uuid: string;
  name: string;
  created_at: string;
  updated_at: string;
  chat_messages: ClaudeChatMessage[];
}

export interface ClaudeChatMessage {
  uuid: string;
  text: string;
  sender: 'human' | 'assistant';
  created_at?: string;
  updated_at?: string;
  files?: Array<{ file_name: string; extracted_content?: string }>;
  attachments?: unknown[];
}

// Media matching strategy types
export type MatchStrategy =
  | 'file_hash'
  | 'file_id_size'
  | 'filename_size'
  | 'conversation_dir'
  | 'size_metadata'
  | 'size_only'
  | 'filename_only';

export interface MatchStats {
  totalFiles: number;
  matchedFiles: number;
  unmatchedFiles: number;
  byStrategy: Record<MatchStrategy, number>;
}

// ═══════════════════════════════════════════════════════════════════
// Relationship Graph Types (Facebook, Instagram)
// ═══════════════════════════════════════════════════════════════════

export interface ParsedFriend {
  id: string;
  name: string;
  friendshipDate: number;  // Unix timestamp
  status: 'friend' | 'removed' | 'sent_request' | 'rejected_request';
  removedDate?: number;
}

export interface ParsedAdvertiser {
  id: string;
  name: string;
  targetingType: string;
  interactionCount: number;
  firstSeen?: number;
  lastSeen?: number;
  isDataBroker: boolean;
}

export interface ParsedPage {
  id: string;
  name: string;
  facebookId?: string;
  url?: string;
  isLiked: boolean;
  likedAt?: number;
  isFollowing: boolean;
  followedAt?: number;
  unfollowedAt?: number;
}

export interface ParsedReaction {
  id: string;
  reactionType: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';
  reactorName: string;
  createdAt: number;
  targetType: 'link' | 'post' | 'photo' | 'video' | 'comment' | 'unknown';
  targetAuthor?: string;
  title?: string;
}

export interface ParsedGroup {
  id: string;
  name: string;
  joinedAt: number | null;
  postCount: number;
  commentCount: number;
  lastActivity: number;
}

export interface ParsedGroupPost {
  id: string;
  groupName: string;
  text: string;
  timestamp: number;
  externalUrls: string[];
  hasAttachments: boolean;
  title: string;
}

export interface ParsedGroupComment {
  id: string;
  groupName: string;
  text: string;
  timestamp: number;
  author: string;
  originalPostAuthor: string;
  title: string;
}

export interface RelationshipData {
  friends: {
    friends: ParsedFriend[];
    removed: ParsedFriend[];
    sentRequests: ParsedFriend[];
    rejectedRequests: ParsedFriend[];
    stats: {
      totalFriends: number;
      totalRemoved: number;
      totalSentRequests: number;
      totalRejectedRequests: number;
      earliestFriendship: number;
      latestFriendship: number;
    };
  };
  advertisers: {
    advertisers: ParsedAdvertiser[];
    stats: {
      total: number;
      dataBrokers: number;
      byTargetingType: Record<string, number>;
    };
  };
  pages: {
    pages: ParsedPage[];
    stats: {
      totalLiked: number;
      totalFollowed: number;
      totalUnfollowed: number;
      earliestLike?: number;
      latestLike?: number;
    };
  };
  reactions: {
    reactions: ParsedReaction[];
    stats: {
      total: number;
      byType: Record<string, number>;
      byTargetType: Record<string, number>;
      dateRange: { earliest: number; latest: number };
    };
  };
  groups: {
    groups: ParsedGroup[];
    posts: ParsedGroupPost[];
    comments: ParsedGroupComment[];
    stats: {
      totalGroups: number;
      totalPosts: number;
      totalComments: number;
      dateRange: { earliest: number; latest: number };
    };
  };
}

// Extended ParsedArchive to include relationship data
export interface ParsedArchiveWithRelationships extends ParsedArchive {
  relationships?: RelationshipData;
}
