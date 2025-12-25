/**
 * Archive Types
 *
 * Types for interacting with the ChatGPT archive API
 */

// Archive conversation metadata (from /api/conversations)
export interface ArchiveConversation {
  id: string;
  title: string;
  folder: string;
  message_count: number;
  text_length: number;
  has_media: boolean;
  has_images: boolean;
  has_audio: boolean;
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
}

// Full conversation response (from /api/conversations/:folder)
export interface ArchiveConversationFull {
  id: string;
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, ArchiveNode>;
  current_node?: string;
}

// Message node in the conversation tree
export interface ArchiveNode {
  id: string;
  message: ArchiveMessage | null;
  parent: string | null;
  children: string[];
}

// Individual message
export interface ArchiveMessage {
  id: string;
  author: {
    role: 'user' | 'assistant' | 'system' | 'tool';
    name?: string;
    metadata?: Record<string, unknown>;
  };
  create_time: number;
  update_time: number | null;
  content: {
    content_type: string;
    parts: (string | MessagePart)[];
  };
  status: string;
  end_turn: boolean | null;
  weight: number;
  metadata: Record<string, unknown>;
  recipient: string;
}

// Message parts can be strings or media pointers
export interface MessagePart {
  content_type?: 'image_asset_pointer' | 'audio_asset_pointer';
  asset_pointer?: string;
  size_bytes?: number;
  width?: number;
  height?: number;
}

// Flattened message for UI consumption
export interface FlatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  created_at: number;
  has_media: boolean;
  media_urls: string[];
  index: number;
}

// Pagination response
export interface ConversationListResponse {
  conversations: ArchiveConversation[];
  total: number;
  limit: number | null;
  offset: number;
  sortBy: string;
}
