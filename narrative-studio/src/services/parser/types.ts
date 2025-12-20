// ============================================================
// ARCHIVE PARSER TYPES
// ============================================================
// TypeScript interfaces for conversation parsing
// Based on OpenAI export format with extensions

export type ExportFormat = 'openai' | 'claude' | 'facebook' | 'chrome-plugin' | 'unknown';

export type ContentType = 'text' | 'code' | 'execution_output' | 'image' | 'multimodal_text';

export type AuthorRole = 'user' | 'assistant' | 'system' | 'tool';

export interface MessageAuthor {
  role: AuthorRole;
  name?: string;
  metadata?: Record<string, any>;
}

export interface MessageContent {
  content_type: ContentType;
  parts: string[];
  language?: string; // For code blocks
  text?: string; // For multimodal content
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
  citations?: any[];
  command?: string;
  status?: string;
  [key: string]: any;
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
  create_time: number;
  update_time: number;
  mapping: ConversationMapping;
  moderation_results: any[];
  current_node?: string;
  plugin_ids?: string | null;
  conversation_template_id?: string | null;
  id?: string;

  // Extended metadata (added by parser)
  _media_files?: string[];
  _source?: ExportFormat;
  _import_date?: string;
  _original_id?: string; // For tracking merges
  _facebook_metadata?: {
    participants?: Array<{ name: string }>;
    is_still_participant?: boolean;
    thread_type?: string;
    message_count?: number;
  };
}

export interface MediaFile {
  path: string;
  basename: string;
  size: number;
  ext: string;
  hash?: string; // Content hash if available
}

export interface FileIndices {
  basename_size_to_path: Map<string, string>; // "(filename,size)" -> path
  file_id_to_path: Map<string, string>; // "file-ABC123" -> path
  file_hash_to_path: Map<string, string>; // "file_abc123" -> path
  conversation_to_paths: Map<string, string[]>; // "conv-uuid" -> [paths]
  size_to_paths: Map<number, string[]>; // size -> [paths]
  path_to_metadata: Map<string, MediaFile>; // path -> metadata
}

export interface MediaReferences {
  asset_pointers: Set<string>; // sediment://, file-service:// URLs
  attachments: MessageAttachment[];
  dalle_generations: Array<{
    gen_id?: string;
    width?: number;
    height?: number;
    prompt?: string;
  }>;
  text_filenames: Set<string>; // Filenames mentioned in text
}

export interface ParsedArchive {
  conversations: Conversation[];
  mediaFiles: MediaFile[];
  format: ExportFormat;
  extractedPath: string; // Path to extracted archive directory (for media files)
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
  progress: number; // 0-100
  startTime: number;
  endTime?: number;
  error?: string;

  // Parsed data
  archive?: ParsedArchive;

  // Preview data
  preview?: ImportPreview;
}

export interface ImportPreview {
  newConversations: number;
  existingConversationsToUpdate: number;
  newMessages: number;
  newMediaFiles: number;
  conflicts: ImportConflict[];
  estimatedSize: number; // bytes
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
  duration: number; // ms
}

// Claude-specific types
export interface ClaudeExport {
  uuid: string;
  name: string;
  created_at: string; // ISO 8601
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
  attachments?: any[];
}

// Utility types
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
