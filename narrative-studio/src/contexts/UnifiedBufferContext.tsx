/**
 * Unified Buffer Context
 *
 * Single source of truth for content flowing through the application.
 * Any content source (Archive Panel) can send content to the buffer,
 * and any tool (Tools Panel) can read from and write to the buffer.
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type {
  BufferContent,
  BufferContentType,
  TextContent,
  MessageContent,
  ConversationContent,
  ConversationMessage,
  FacebookPostContent,
  FacebookComment,
  FacebookCommentContent,
  MediaContent,
  CollectionContent,
  BufferMetadata,
  MediaRef,
  TimestampMeta,
  AuthorMeta,
  SourceMeta,
} from '../types/buffer-content';
import type { Message, Conversation, GalleryImage } from '../types';
import { extractText, extractMarkdown, type ExtractionOptions } from '../utils/buffer-text-extraction';

// Block markers for format preservation through LLM transforms
import {
  insertBlockMarkers,
  stripBlockMarkers,
  getBlockMarkerInstructions,
  hasBlockMarkers,
  validateMarkedText,
} from '../services/block-markers';

// Semantic search
import { embeddingService, type SearchResult } from '../services/embeddingService';

// ============================================================
// CONTEXT VALUE INTERFACE
// ============================================================

export interface UnifiedBufferContextValue {
  // ============================================================
  // WORKING BUFFER (primary content being worked on)
  // ============================================================

  /** Current working buffer content */
  workingBuffer: BufferContent | null;

  /** Set working buffer from any content source */
  setWorkingBuffer: (content: BufferContent) => void;

  /** Clear working buffer */
  clearWorkingBuffer: () => void;

  // ============================================================
  // BUFFER LIST (all buffers in session)
  // ============================================================

  /** All buffers in the current session */
  buffers: BufferContent[];

  /** Currently active buffer ID */
  activeBufferId: string | null;

  /** Set active buffer by ID */
  setActiveBuffer: (id: string) => void;

  /** Add a buffer to the list */
  addBuffer: (content: BufferContent) => void;

  /** Remove a buffer from the list */
  removeBuffer: (id: string) => void;

  // ============================================================
  // CONTENT CREATION (from various sources)
  // ============================================================

  /** Create buffer from plain text */
  createFromText: (text: string, format?: 'plain' | 'markdown') => BufferContent;

  /** Create buffer from a single conversation message */
  createFromMessage: (message: Message, conversation: Conversation, messageIndex: number) => BufferContent;

  /** Create buffer from a full conversation */
  createFromConversation: (conversation: Conversation) => BufferContent;

  /** Create buffer from a Facebook post */
  createFromFacebookPost: (post: FacebookPostData) => BufferContent;

  /** Create buffer from a Facebook comment */
  createFromFacebookComment: (comment: FacebookCommentData, parentPost?: { id: string; text?: string; author?: string }) => BufferContent;

  /** Create buffer from a media item (gallery image) */
  createFromMedia: (media: GalleryImage) => BufferContent;

  /** Create buffer from multiple selected items */
  createFromSelection: (items: BufferContent[], mode: 'manual' | 'search' | 'cluster', query?: string) => BufferContent;

  // ============================================================
  // TEXT EXTRACTION (for tools that need string input)
  // ============================================================

  /** Get plain text from working buffer */
  getTextContent: (options?: ExtractionOptions) => string;

  /** Get markdown representation from working buffer */
  getMarkdownContent: (options?: ExtractionOptions) => string;

  // ============================================================
  // TOOL OUTPUT HANDLING
  // ============================================================

  /** Record transformation result */
  recordTransformation: (
    tool: string,
    settings: Record<string, unknown>,
    resultText: string,
    metadata?: Record<string, unknown>
  ) => BufferContent;

  /** Record analysis result */
  recordAnalysis: (
    tool: string,
    result: Record<string, unknown>
  ) => BufferContent;

  // ============================================================
  // HISTORY & CHAINING
  // ============================================================

  /** History of buffers (for undo) */
  history: BufferContent[];

  /** Can undo */
  canUndo: boolean;

  /** Undo to previous buffer */
  undo: () => void;

  /** Chain mode: next tool uses last output */
  isChainMode: boolean;

  /** Enable chain mode */
  enableChainMode: () => void;

  /** Disable chain mode */
  disableChainMode: () => void;

  // ============================================================
  // BLOCK MARKERS (format preservation)
  // ============================================================

  /** Get working buffer content with block markers inserted */
  getMarkedContent: () => string;

  /** Strip block markers from text and restore markdown */
  stripMarkers: (markedText: string) => string;

  /** Get LLM instructions for respecting block markers */
  getMarkerInstructions: () => string;

  /** Check if text contains block markers */
  hasMarkers: (text: string) => boolean;

  /** Validate block marker structure */
  validateMarkers: (text: string) => { valid: boolean; errors: string[] };

  // ============================================================
  // SEMANTIC SEARCH
  // ============================================================

  /** Find similar content in the archive */
  findSimilar: (limit?: number) => Promise<SearchResult[]>;

  /** Search archive by query text */
  searchArchive: (query: string, limit?: number) => Promise<SearchResult[]>;
}

// ============================================================
// FACEBOOK DATA INTERFACES (for creation functions)
// ============================================================

export interface FacebookPostData {
  text: string;
  timestamp?: number;
  author?: string;
  postType?: 'status' | 'photo' | 'link' | 'video' | 'note' | 'check-in';
  mediaUrls?: string[];
  comments?: FacebookCommentData[];
  location?: {
    name?: string;
    city?: string;
    country?: string;
  };
  sharedLink?: {
    url: string;
    title?: string;
    description?: string;
  };
}

export interface FacebookCommentData {
  text: string;
  timestamp?: number;
  author?: string;
  mediaUrls?: string[];
}

// ============================================================
// ID GENERATION
// ============================================================

function generateBufferId(): string {
  return `buffer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================
// CONTEXT
// ============================================================

const UnifiedBufferContext = createContext<UnifiedBufferContextValue | undefined>(undefined);

// ============================================================
// PROVIDER
// ============================================================

interface UnifiedBufferProviderProps {
  children: ReactNode;
  archiveName?: string;
}

export function UnifiedBufferProvider({ children, archiveName = 'main' }: UnifiedBufferProviderProps) {
  const [workingBuffer, setWorkingBufferState] = useState<BufferContent | null>(null);
  const [buffers, setBuffers] = useState<BufferContent[]>([]);
  const [activeBufferId, setActiveBufferId] = useState<string | null>(null);
  const [history, setHistory] = useState<BufferContent[]>([]);
  const [isChainMode, setIsChainMode] = useState(false);

  // ============================================================
  // WORKING BUFFER OPERATIONS
  // ============================================================

  const setWorkingBuffer = useCallback((content: BufferContent) => {
    // Save current to history before replacing
    setHistory(prev => workingBuffer ? [...prev, workingBuffer] : prev);
    setWorkingBufferState(content);

    // Also add to buffers list if not already there
    setBuffers(prev => {
      if (prev.find(b => b.id === content.id)) return prev;
      return [...prev, content];
    });
    setActiveBufferId(content.id);
  }, [workingBuffer]);

  const clearWorkingBuffer = useCallback(() => {
    setWorkingBufferState(null);
  }, []);

  // ============================================================
  // BUFFER LIST OPERATIONS
  // ============================================================

  const setActiveBuffer = useCallback((id: string) => {
    const buffer = buffers.find(b => b.id === id);
    if (buffer) {
      setActiveBufferId(id);
      setWorkingBufferState(buffer);
    }
  }, [buffers]);

  const addBuffer = useCallback((content: BufferContent) => {
    setBuffers(prev => [...prev, content]);
  }, []);

  const removeBuffer = useCallback((id: string) => {
    setBuffers(prev => prev.filter(b => b.id !== id));
    if (activeBufferId === id) {
      setActiveBufferId(null);
      setWorkingBufferState(null);
    }
  }, [activeBufferId]);

  // ============================================================
  // CONTENT CREATION
  // ============================================================

  const createFromText = useCallback((text: string, format: 'plain' | 'markdown' = 'plain'): BufferContent => {
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    const content: TextContent = {
      id: generateBufferId(),
      contentType: 'text',
      displayName: `Text (${wordCount} words)`,
      text,
      format,
      bufferCreatedAt: new Date().toISOString(),
      metadata: {
        stats: {
          wordCount,
          charCount: text.length,
          format,
        },
        source: {
          platform: 'manual',
          archiveName,
        },
      },
    };

    return content;
  }, [archiveName]);

  const createFromMessage = useCallback((
    message: Message,
    conversation: Conversation,
    messageIndex: number
  ): BufferContent => {
    const wordCount = message.content.split(/\s+/).filter(Boolean).length;

    // Extract media from message content (if any)
    const mediaRefs: MediaRef[] = [];
    // TODO: Parse message.content for image markdown and create MediaRef entries

    const content: MessageContent = {
      id: generateBufferId(),
      contentType: 'message',
      displayName: `Message from "${conversation.title}"`,
      text: message.content,
      role: message.role,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        folder: conversation.folder,
      },
      bufferCreatedAt: new Date().toISOString(),
      metadata: {
        timestamps: {
          createdAt: message.created_at,
          createdAtISO: message.created_at ? new Date(message.created_at).toISOString() : undefined,
        },
        author: {
          role: message.role,
          // Could extract AI model from conversation metadata if available
        },
        media: mediaRefs.length > 0 ? mediaRefs : undefined,
        stats: {
          wordCount,
          charCount: message.content.length,
          format: 'markdown',
        },
        source: {
          platform: 'openai', // or detect from conversation
          archiveName,
          conversationId: conversation.id,
          messageId: message.id,
          messageIndex,
          totalMessages: conversation.messages.length,
          folder: conversation.folder,
        },
      },
    };

    return content;
  }, [archiveName]);

  const createFromConversation = useCallback((conversation: Conversation): BufferContent => {
    // Convert messages to ConversationMessage format
    const messages: ConversationMessage[] = conversation.messages.map((m, index) => ({
      id: m.id,
      text: m.content,
      role: m.role,
      metadata: {
        timestamps: m.created_at ? {
          createdAt: m.created_at,
          createdAtISO: new Date(m.created_at).toISOString(),
        } : undefined,
        author: {
          role: m.role,
        },
      },
    }));

    // Calculate stats
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    const totalWordCount = messages.reduce((sum, m) => sum + m.text.split(/\s+/).filter(Boolean).length, 0);

    // Get date range
    const timestamps = conversation.messages
      .map(m => m.created_at)
      .filter((t): t is number => t !== undefined)
      .sort((a, b) => a - b);

    const content: ConversationContent = {
      id: generateBufferId(),
      contentType: 'conversation',
      displayName: conversation.title,
      title: conversation.title,
      folder: conversation.folder,
      messages,
      stats: {
        messageCount: messages.length,
        userMessageCount: userMessages.length,
        assistantMessageCount: assistantMessages.length,
        totalWordCount,
        startDate: timestamps[0],
        endDate: timestamps[timestamps.length - 1],
        durationMinutes: timestamps.length >= 2
          ? Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / 60000)
          : undefined,
      },
      bufferCreatedAt: new Date().toISOString(),
      metadata: {
        timestamps: {
          createdAt: conversation.created_at,
          updatedAt: conversation.updated_at,
          createdAtISO: conversation.created_at ? new Date(conversation.created_at).toISOString() : undefined,
          updatedAtISO: conversation.updated_at ? new Date(conversation.updated_at).toISOString() : undefined,
        },
        stats: {
          wordCount: totalWordCount,
        },
        source: {
          platform: 'openai',
          archiveName,
          conversationId: conversation.id,
          folder: conversation.folder,
        },
        tags: {
          autoTags: conversation.tags,
        },
      },
    };

    return content;
  }, [archiveName]);

  const createFromFacebookPost = useCallback((post: FacebookPostData): BufferContent => {
    const wordCount = post.text.split(/\s+/).filter(Boolean).length;

    // Convert comments
    const comments: FacebookComment[] | undefined = post.comments?.map(c => ({
      text: c.text,
      metadata: {
        timestamps: c.timestamp ? {
          createdAt: c.timestamp,
          createdAtISO: new Date(c.timestamp).toISOString(),
        } : undefined,
        author: c.author ? { name: c.author } : undefined,
      },
    }));

    // Create media refs from URLs
    const mediaRefs: MediaRef[] = (post.mediaUrls || []).map((url, i) => ({
      id: `media-${i}`,
      type: 'image' as const,
      localUrl: url,
    }));

    const content: FacebookPostContent = {
      id: generateBufferId(),
      contentType: 'facebook-post',
      displayName: post.text.substring(0, 50) + (post.text.length > 50 ? '...' : ''),
      text: post.text,
      postType: post.postType,
      comments,
      commentCount: comments?.length,
      sharedLink: post.sharedLink,
      bufferCreatedAt: new Date().toISOString(),
      metadata: {
        timestamps: post.timestamp ? {
          createdAt: post.timestamp,
          createdAtISO: new Date(post.timestamp).toISOString(),
        } : undefined,
        author: post.author ? { name: post.author } : undefined,
        media: mediaRefs.length > 0 ? mediaRefs : undefined,
        location: post.location ? {
          name: post.location.name,
          city: post.location.city,
          country: post.location.country,
        } : undefined,
        stats: {
          wordCount,
          charCount: post.text.length,
        },
        source: {
          platform: 'facebook',
          archiveName,
        },
      },
    };

    return content;
  }, [archiveName]);

  const createFromFacebookComment = useCallback((
    comment: FacebookCommentData,
    parentPost?: { id: string; text?: string; author?: string }
  ): BufferContent => {
    const content: FacebookCommentContent = {
      id: generateBufferId(),
      contentType: 'facebook-comment',
      displayName: comment.text.substring(0, 50) + (comment.text.length > 50 ? '...' : ''),
      text: comment.text,
      parentPost,
      bufferCreatedAt: new Date().toISOString(),
      metadata: {
        timestamps: comment.timestamp ? {
          createdAt: comment.timestamp,
          createdAtISO: new Date(comment.timestamp).toISOString(),
        } : undefined,
        author: comment.author ? { name: comment.author } : undefined,
        stats: {
          wordCount: comment.text.split(/\s+/).filter(Boolean).length,
          charCount: comment.text.length,
        },
        source: {
          platform: 'facebook',
          archiveName,
        },
      },
    };

    return content;
  }, [archiveName]);

  const createFromMedia = useCallback((media: GalleryImage): BufferContent => {
    const mediaRef: MediaRef = {
      id: generateBufferId(),
      type: 'image',
      localUrl: media.url,
      filename: media.filename,
      width: media.width,
      height: media.height,
      sizeBytes: media.sizeBytes,
    };

    const content: MediaContent = {
      id: generateBufferId(),
      contentType: 'media',
      displayName: media.filename || 'Image',
      media: mediaRef,
      context: {
        conversationId: media.conversationFolder,
        conversationTitle: media.conversationTitle,
        messageIndex: media.messageIndex,
      },
      bufferCreatedAt: new Date().toISOString(),
      metadata: {
        timestamps: media.conversationCreatedAt ? {
          createdAt: media.conversationCreatedAt,
        } : undefined,
        media: [mediaRef],
        source: {
          platform: 'openai',
          archiveName,
          folder: media.conversationFolder,
        },
      },
    };

    return content;
  }, [archiveName]);

  const createFromSelection = useCallback((
    items: BufferContent[],
    mode: 'manual' | 'search' | 'cluster',
    query?: string
  ): BufferContent => {
    // Count content types
    const contentTypes: Partial<Record<BufferContentType, number>> = {};
    items.forEach(item => {
      contentTypes[item.contentType] = (contentTypes[item.contentType] || 0) + 1;
    });

    // Get date range
    const timestamps: number[] = [];
    items.forEach(item => {
      if (item.metadata?.timestamps?.createdAt) {
        timestamps.push(item.metadata.timestamps.createdAt);
      }
    });
    timestamps.sort((a, b) => a - b);

    const content: CollectionContent = {
      id: generateBufferId(),
      contentType: 'collection',
      displayName: query ? `Search: "${query}"` : `Collection (${items.length} items)`,
      items,
      collectionType: mode,
      query,
      stats: {
        itemCount: items.length,
        contentTypes,
        dateRange: timestamps.length >= 2 ? {
          start: timestamps[0],
          end: timestamps[timestamps.length - 1],
        } : undefined,
      },
      bufferCreatedAt: new Date().toISOString(),
      metadata: {
        source: {
          archiveName,
        },
      },
    };

    return content;
  }, [archiveName]);

  // ============================================================
  // TEXT EXTRACTION
  // ============================================================

  const getTextContent = useCallback((options?: ExtractionOptions): string => {
    if (!workingBuffer) return '';
    return extractText(workingBuffer, options);
  }, [workingBuffer]);

  const getMarkdownContent = useCallback((options?: ExtractionOptions): string => {
    if (!workingBuffer) return '';
    return extractMarkdown(workingBuffer, options);
  }, [workingBuffer]);

  // ============================================================
  // TOOL OUTPUT HANDLING
  // ============================================================

  const recordTransformation = useCallback((
    tool: string,
    settings: Record<string, unknown>,
    resultText: string,
    metadata?: Record<string, unknown>
  ): BufferContent => {
    const sourceBuffer = workingBuffer;
    const wordCount = resultText.split(/\s+/).filter(Boolean).length;

    const content: TextContent = {
      id: generateBufferId(),
      contentType: 'text',
      displayName: `${tool} result`,
      text: resultText,
      format: 'markdown',
      bufferCreatedAt: new Date().toISOString(),
      metadata: {
        stats: {
          wordCount,
          charCount: resultText.length,
          format: 'markdown',
        },
        history: {
          transformations: [{
            tool,
            settings,
            appliedAt: Date.now(),
            analysisResult: metadata,
          }],
          version: 1,
        },
        source: sourceBuffer?.metadata?.source,
      },
    };

    // If chain mode, set as new working buffer
    if (isChainMode) {
      setWorkingBuffer(content);
    } else {
      addBuffer(content);
    }

    return content;
  }, [workingBuffer, isChainMode, setWorkingBuffer, addBuffer]);

  const recordAnalysis = useCallback((
    tool: string,
    result: Record<string, unknown>
  ): BufferContent => {
    // Analysis results are stored as text with the result in metadata
    const content: TextContent = {
      id: generateBufferId(),
      contentType: 'text',
      displayName: `${tool} analysis`,
      text: workingBuffer ? getTextContent() : '',
      format: 'markdown',
      bufferCreatedAt: new Date().toISOString(),
      metadata: {
        history: {
          transformations: [{
            tool,
            settings: {},
            appliedAt: Date.now(),
            analysisResult: result,
          }],
        },
        source: workingBuffer?.metadata?.source,
        custom: {
          analysisResult: result,
        },
      },
    };

    addBuffer(content);
    return content;
  }, [workingBuffer, getTextContent, addBuffer]);

  // ============================================================
  // HISTORY & CHAINING
  // ============================================================

  const canUndo = history.length > 0;

  const undo = useCallback(() => {
    if (history.length === 0) return;

    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setWorkingBufferState(previous);
    setActiveBufferId(previous.id);
  }, [history]);

  const enableChainMode = useCallback(() => {
    setIsChainMode(true);
  }, []);

  const disableChainMode = useCallback(() => {
    setIsChainMode(false);
  }, []);

  // ============================================================
  // BLOCK MARKERS (format preservation)
  // ============================================================

  const getMarkedContent = useCallback((): string => {
    if (!workingBuffer) return '';
    const markdown = extractMarkdown(workingBuffer);
    return insertBlockMarkers(markdown);
  }, [workingBuffer]);

  const stripMarkers = useCallback((markedText: string): string => {
    return stripBlockMarkers(markedText);
  }, []);

  const getMarkerInstructions = useCallback((): string => {
    return getBlockMarkerInstructions();
  }, []);

  const hasMarkers = useCallback((text: string): boolean => {
    return hasBlockMarkers(text);
  }, []);

  const validateMarkers = useCallback((text: string): { valid: boolean; errors: string[] } => {
    return validateMarkedText(text);
  }, []);

  // ============================================================
  // SEMANTIC SEARCH
  // ============================================================

  const findSimilar = useCallback(async (limit = 10): Promise<SearchResult[]> => {
    if (!workingBuffer) return [];
    try {
      const text = extractText(workingBuffer);
      if (!text.trim()) return [];
      const response = await embeddingService.searchMessages(text, limit);
      return response.results || [];
    } catch (error) {
      console.error('findSimilar error:', error);
      return [];
    }
  }, [workingBuffer]);

  const searchArchive = useCallback(async (query: string, limit = 20): Promise<SearchResult[]> => {
    if (!query.trim()) return [];
    try {
      const response = await embeddingService.searchMessages(query, limit);
      return response.results || [];
    } catch (error) {
      console.error('searchArchive error:', error);
      return [];
    }
  }, []);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const value: UnifiedBufferContextValue = {
    // Working buffer
    workingBuffer,
    setWorkingBuffer,
    clearWorkingBuffer,

    // Buffer list
    buffers,
    activeBufferId,
    setActiveBuffer,
    addBuffer,
    removeBuffer,

    // Content creation
    createFromText,
    createFromMessage,
    createFromConversation,
    createFromFacebookPost,
    createFromFacebookComment,
    createFromMedia,
    createFromSelection,

    // Text extraction
    getTextContent,
    getMarkdownContent,

    // Tool output
    recordTransformation,
    recordAnalysis,

    // History & chaining
    history,
    canUndo,
    undo,
    isChainMode,
    enableChainMode,
    disableChainMode,

    // Block markers
    getMarkedContent,
    stripMarkers,
    getMarkerInstructions,
    hasMarkers,
    validateMarkers,

    // Semantic search
    findSimilar,
    searchArchive,
  };

  return (
    <UnifiedBufferContext.Provider value={value}>
      {children}
    </UnifiedBufferContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useUnifiedBuffer(): UnifiedBufferContextValue {
  const context = useContext(UnifiedBufferContext);
  if (context === undefined) {
    throw new Error('useUnifiedBuffer must be used within a UnifiedBufferProvider');
  }
  return context;
}
