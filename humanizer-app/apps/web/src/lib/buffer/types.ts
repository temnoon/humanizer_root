/**
 * Buffer System Types
 *
 * Core types for the immutable content graph, buffers, and pipelines.
 * Content is never mutated - operations create new nodes in the graph.
 * Buffers are named pointers that can move through the graph.
 */

// ═══════════════════════════════════════════════════════════════════
// CONTENT ITEM - The atomic unit of content
// ═══════════════════════════════════════════════════════════════════

export interface ContentItem {
  id: string;
  text: string;
  index?: number;                    // Position in parent (for ordered items)
  metadata?: ContentItemMetadata;
}

export interface ContentItemMetadata {
  sicScore?: number;
  vectorPosition?: number[];         // 5D semantic position
  sentiment?: number;
  wordCount?: number;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════
// CONTENT NODE - Immutable node in the content graph
// ═══════════════════════════════════════════════════════════════════

export interface ContentNode {
  id: string;

  // Content: single item or array of items
  content: ContentItem | ContentItem[];

  // Graph structure
  parentId: string | null;           // null = root node (imported)
  operation: Operation | null;       // null = root node

  // Metadata
  metadata: ContentNodeMetadata;
}

export interface ContentNodeMetadata {
  title?: string;
  source?: ArchiveSource;
  createdAt: number;
  tags?: string[];

  // Computed stats (for display)
  itemCount?: number;
  avgSicScore?: number;
}

// ═══════════════════════════════════════════════════════════════════
// OPERATION - Describes how a node was derived from its parent
// ═══════════════════════════════════════════════════════════════════

export interface Operation {
  type: OperationType;
  operator: string;
  params?: Record<string, unknown>;
  timestamp: number;
}

export type OperationType =
  | 'import'      // From archive → root node
  | 'split'       // One → many (sentence, paragraph, chunk)
  | 'filter'      // Many → fewer (by predicate)
  | 'transform'   // Content transformation (humanize, summarize)
  | 'merge'       // Many → one (join, concatenate)
  | 'order'       // Many → many reordered (semantic, chronological)
  | 'annotate'    // Add metadata without changing content
  | 'select'      // Pick specific items from array
  | 'fork';       // Explicit branch point (no content change)

// ═══════════════════════════════════════════════════════════════════
// ARCHIVE SOURCE - Provenance tracking
// ═══════════════════════════════════════════════════════════════════

export interface ArchiveSource {
  type: 'chatgpt' | 'facebook' | 'notebook' | 'book' | 'manual';
  archiveId?: string;
  conversationId?: string;
  conversationFolder?: string;       // Folder name for API calls
  messageId?: string;
  messageIndex?: number;             // Position in conversation (0-based)
  totalMessages?: number;            // Total messages in conversation
  path: string[];                    // Breadcrumb trail for display
}

// ═══════════════════════════════════════════════════════════════════
// BUFFER - Named pointer into the graph with history
// ═══════════════════════════════════════════════════════════════════

export interface Buffer {
  id: string;
  name: string;
  nodeId: string;                    // Current node this buffer points to

  // State
  pinned: boolean;                   // Prevent node garbage collection
  cursor?: number;                   // For arrays: focused item index

  // Buffer-local history (for undo/redo within this buffer)
  history: string[];                 // nodeIds this buffer has visited
  historyIndex: number;              // Current position (-1 = no history)

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

// ═══════════════════════════════════════════════════════════════════
// PIPELINE - Saved sequence of operations
// ═══════════════════════════════════════════════════════════════════

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  steps: PipelineStep[];
  createdAt: number;
}

export interface PipelineStep {
  type: OperationType;
  operator: string;
  params?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════
// OPERATOR REGISTRY - For extensible operations
// ═══════════════════════════════════════════════════════════════════

export interface OperatorDefinition {
  id: string;
  name: string;
  type: OperationType;
  description: string;

  // What this operator accepts and produces
  inputType: 'single' | 'array' | 'any';
  outputType: 'single' | 'array' | 'same';

  // Parameter schema (for UI generation)
  params?: OperatorParam[];

  // The actual operation
  execute: (
    input: ContentItem | ContentItem[],
    params?: Record<string, unknown>
  ) => Promise<ContentItem | ContentItem[]>;
}

export interface OperatorParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  label: string;
  default?: unknown;
  options?: { value: string; label: string }[];  // For select type
  min?: number;                                   // For number type
  max?: number;
}

// ═══════════════════════════════════════════════════════════════════
// GRAPH STATE - Serializable state for persistence
// ═══════════════════════════════════════════════════════════════════

export interface GraphState {
  nodes: Record<string, ContentNode>;
  buffers: Record<string, Buffer>;
  pipelines: Record<string, Pipeline>;
  activeBufferId: string | null;
}

// ═══════════════════════════════════════════════════════════════════
// EVENTS - For reactive updates
// ═══════════════════════════════════════════════════════════════════

export type BufferEvent =
  | { type: 'node-created'; nodeId: string }
  | { type: 'buffer-created'; bufferId: string }
  | { type: 'buffer-updated'; bufferId: string }
  | { type: 'buffer-deleted'; bufferId: string }
  | { type: 'active-buffer-changed'; bufferId: string | null }
  | { type: 'operation-applied'; bufferId: string; nodeId: string };
