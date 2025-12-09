// ============================================================
// WORKSPACE BUFFER SYSTEM TYPES
// ============================================================
// Replaces the legacy "session" system with a persistent
// workspace model that tracks transformation chains as buffer trees.
// ============================================================

/**
 * A Workspace represents a complete transformation project.
 * It contains a tree of buffers, starting from an original source.
 */
export interface Workspace {
  id: string;                      // UUID
  name: string;                    // User-editable, e.g., "Heart Sutra Humanization"
  createdAt: number;               // Unix timestamp
  updatedAt: number;               // Auto-updated on any change

  // Where the original content came from
  source: WorkspaceSource;

  // Buffer tree
  rootBufferId: string;            // The original content buffer
  buffers: Record<string, Buffer>; // All buffers keyed by ID
  activeBufferId: string;          // Currently selected for operations
  compareBufferId?: string;        // Optional: buffer shown in left pane for comparison

  // User organization
  starredBufferIds: string[];      // Favorites for quick access
  archived: boolean;               // Hide from main list without deleting
}

/**
 * Describes where the original content came from.
 * Used for navigation back to source and for display context.
 */
export interface WorkspaceSource {
  type: 'archive-message' | 'book-passage' | 'facebook-post' | 'facebook-comment' | 'paste' | 'import' | 'blank';

  // Archive message source
  archiveName?: string;
  conversationId?: string;
  conversationTitle?: string;
  messageIndex?: number;

  // Book passage source
  bookId?: string;
  bookTitle?: string;
  chapterId?: string;
  passageId?: string;

  // Facebook source
  facebookPostId?: string;
  facebookAuthor?: string;
  facebookTimestamp?: number;
  facebookTitle?: string;       // Post preview text

  // Import source
  fileName?: string;
  importedAt?: number;
}

/**
 * A Buffer represents a single version of content.
 * Buffers form a tree structure where children are derived
 * from their parent through transformations.
 */
export interface Buffer {
  id: string;                      // UUID
  parentId: string | null;         // null for root buffer
  childIds: string[];              // Buffers derived from this one

  // Content
  content: string;                 // The actual text
  contentHash?: string;            // For deduplication/change detection

  // Creation metadata
  createdAt: number;

  // How this buffer was created (null for root/original)
  transform?: BufferTransform;

  // Cached analysis (populated by AI Analysis tool)
  analysis?: BufferAnalysis;

  // User annotations
  displayName?: string;            // Auto-generated or user-edited
  starred: boolean;
  note?: string;                   // User's notes, e.g., "This version worked best"
  color?: string;                  // Optional color tag for visual organization
}

/**
 * Describes how a buffer was created from its parent.
 * Stores the transformation type and parameters used.
 */
export interface BufferTransform {
  type: 'humanizer' | 'persona' | 'style' | 'round-trip' | 'ai-analysis' | 'manual-edit';

  // Tool-specific parameters
  parameters: BufferTransformParameters;

  timestamp: number;

  // Metrics from transformation
  metrics?: {
    processingTimeMs?: number;
    modelUsed?: string;
    provider?: string;
  };
}

/**
 * Parameters for different transformation types.
 */
export interface BufferTransformParameters {
  // Humanizer
  intensity?: 'light' | 'moderate' | 'aggressive';
  useLLM?: boolean;

  // Persona
  personaId?: string;
  personaName?: string;

  // Style
  styleId?: string;
  styleName?: string;

  // Round-trip
  intermediateLanguage?: string;

  // Manual edit
  editDescription?: string;

  // Allow additional parameters
  [key: string]: unknown;
}

/**
 * Cached AI analysis results for a buffer.
 * Populated when the AI Analysis tool is run on a buffer.
 */
export interface BufferAnalysis {
  // AI Detection results
  aiScore?: number;                // 0-100
  aiVerdict?: 'human' | 'mixed' | 'ai';
  confidence?: 'low' | 'medium' | 'high';

  // Tell-words found
  tellWords?: Array<{
    word: string;
    count: number;
    category: string;
  }>;

  // Highlight ranges (for rendering)
  highlights?: Array<{
    start: number;
    end: number;
    type: 'tellword' | 'suspect' | 'gptzero';
    reason: string;
  }>;

  // GPTZero results (if available)
  gptzeroScore?: number;
  gptzeroSentences?: number;

  // Burstiness and other metrics
  burstiness?: number;

  // When analysis was performed
  analyzedAt: number;
}

/**
 * Extended buffer type for tree operations.
 * Includes computed properties for rendering the buffer tree UI.
 */
export interface BufferNode extends Buffer {
  children: BufferNode[];
  depth: number;
  isActive: boolean;
  isCompare: boolean;
}

// ============================================================
// WORKSPACE LIST TYPES (for Archive Panel)
// ============================================================

/**
 * Lightweight workspace summary for listing in Archive Panel.
 * Contains just enough info for display without loading full content.
 */
export interface WorkspaceSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  source: WorkspaceSource;
  bufferCount: number;
  starredCount: number;
  archived: boolean;

  // Preview
  previewText?: string;            // First 100 chars of root buffer
  bestAiScore?: number;            // Lowest AI score among analyzed buffers
}

// ============================================================
// WORKSPACE CONTEXT TYPES
// ============================================================

/**
 * State shape for the WorkspaceContext.
 */
export interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Actions available in the WorkspaceContext.
 */
export interface WorkspaceActions {
  // Workspace CRUD
  createWorkspace: (source: WorkspaceSource, initialContent: string, name?: string) => Workspace;
  loadWorkspace: (id: string) => void;
  saveWorkspace: () => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  renameWorkspace: (id: string, name: string) => void;
  archiveWorkspace: (id: string) => void;
  unarchiveWorkspace: (id: string) => void;

  // Buffer operations
  createBuffer: (parentId: string, transform: BufferTransform, content: string) => Buffer;
  setActiveBuffer: (bufferId: string) => void;
  setCompareBuffer: (bufferId: string | undefined) => void;
  updateBufferAnalysis: (bufferId: string, analysis: BufferAnalysis) => void;
  updateBufferContent: (bufferId: string, content: string) => void;
  toggleBufferStar: (bufferId: string) => void;
  setBufferNote: (bufferId: string, note: string) => void;
  setBufferDisplayName: (bufferId: string, displayName: string) => void;
  deleteBuffer: (bufferId: string) => void;

  // Tree utilities
  getBufferTree: () => BufferNode | null;
  getActiveBuffer: () => Buffer | null;
  getCompareBuffer: () => Buffer | null;
  getActiveWorkspace: () => Workspace | null;

  // List utilities
  listWorkspaces: () => WorkspaceSummary[];
}

/**
 * Combined context value type.
 */
export interface WorkspaceContextValue extends WorkspaceState, WorkspaceActions {}

// ============================================================
// UTILITY TYPES
// ============================================================

/**
 * Options for creating a new workspace.
 */
export interface CreateWorkspaceOptions {
  source: WorkspaceSource;
  initialContent: string;
  name?: string;
}

/**
 * Options for creating a new buffer.
 */
export interface CreateBufferOptions {
  parentId: string;
  transform: BufferTransform;
  content: string;
  displayName?: string;
}
