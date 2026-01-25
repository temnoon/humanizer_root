/**
 * Unified AUI Types - Book Types
 *
 * Book creation and harvest types.
 *
 * @module @humanizer/core/aui/types/book-types
 */

// ═══════════════════════════════════════════════════════════════════════════
// BOOK CREATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for creating a book from a cluster.
 */
export interface BookFromClusterOptions {
  /** Book title (auto-generated if not provided) */
  title?: string;

  /** Maximum passages to include */
  maxPassages?: number;

  /** Whether to generate an introduction */
  generateIntro?: boolean;

  /** Narrative arc type */
  arcType?: 'chronological' | 'thematic' | 'dramatic' | 'exploratory';

  /** Target audience */
  audience?: string;

  /** Writing style */
  style?: 'conversational' | 'formal' | 'literary' | 'journalistic';

  /** Include source attribution */
  includeAttribution?: boolean;

  /** Progress callback */
  onProgress?: (progress: BookCreationProgress) => void;

  /** Embedding function for indexing book content (enables unified search) */
  embedFn?: (text: string) => Promise<number[]>;

  // ─────────────────────────────────────────────────────────────────
  // PERSONA CONFIGURATION
  // ─────────────────────────────────────────────────────────────────

  /** Explicit persona to use for voice consistency */
  personaId?: string;

  /** Specific style within persona (optional, uses persona's default if not specified) */
  styleId?: string;

  /** Whether to fall back to user's default persona if personaId not provided (default: true) */
  useDefaultPersona?: boolean;

  /** User ID for default persona lookup (required if useDefaultPersona is true) */
  userId?: string;
}

/**
 * Progress update during book creation.
 */
export interface BookCreationProgress {
  /** Current phase */
  phase: 'gathering' | 'organizing' | 'generating_arc' | 'writing_intro' | 'assembling' | 'persona_rewriting' | 'indexing' | 'complete';

  /** Current step */
  step: number;

  /** Total steps */
  totalSteps: number;

  /** Message */
  message: string;
}

/**
 * Options for harvest operation.
 */
export interface HarvestOptions {
  /** Theme or query for harvesting */
  query: string;

  /** Maximum passages to harvest */
  limit?: number;

  /** Minimum relevance score */
  minRelevance?: number;

  /** Source diversity target (max from single source) */
  maxFromSingleSource?: number;

  /** Date range filter */
  dateRange?: {
    start?: Date;
    end?: Date;
  };

  /** Exclude node IDs */
  excludeIds?: string[];
}

/**
 * Result from harvest operation.
 */
export interface HarvestResult {
  /** Harvested passages */
  passages: HarvestedPassage[];

  /** Query used */
  query: string;

  /** Total candidates found */
  candidatesFound: number;

  /** Duration (ms) */
  durationMs: number;
}

/**
 * A harvested passage.
 */
export interface HarvestedPassage {
  /** Node ID */
  id: string;

  /** Text content */
  text: string;

  /** Relevance score */
  relevance: number;

  /** Source type */
  sourceType: string;

  /** Author role */
  authorRole?: string;

  /** Conversation/thread title */
  title?: string;

  /** Source created date */
  sourceCreatedAt?: Date;

  /** Word count */
  wordCount: number;
}

/**
 * Options for generating narrative arc.
 */
export interface GenerateArcOptions {
  /** Passages to organize */
  passages: HarvestedPassage[];

  /** Arc type */
  arcType?: 'chronological' | 'thematic' | 'dramatic' | 'exploratory';

  /** Target word count for introduction */
  introWordCount?: number;

  /** Include chapter summaries */
  includeChapterSummaries?: boolean;
}

/**
 * Generated narrative arc.
 */
export interface NarrativeArc {
  /** Arc title */
  title: string;

  /** Arc type used */
  arcType: string;

  /** Introduction text */
  introduction: string;

  /** Organized chapters */
  chapters: ArcChapter[];

  /** Overall themes identified */
  themes: string[];

  /** Suggested transitions between chapters */
  transitions: string[];
}

/**
 * A chapter in the narrative arc.
 */
export interface ArcChapter {
  /** Chapter title */
  title: string;

  /** Chapter summary */
  summary: string;

  /** Passage IDs in this chapter */
  passageIds: string[];

  /** Chapter theme */
  theme: string;

  /** Position in arc */
  position: number;
}

/**
 * A book entity.
 */
export interface Book {
  /** Book ID */
  id: string;

  /** Book title */
  title: string;

  /** Book description */
  description: string;

  /** Narrative arc */
  arc: NarrativeArc;

  /** Chapters with full content */
  chapters: BookChapter[];

  /** Source cluster ID (if created from cluster) */
  sourceClusterId?: string;

  /** Creation date */
  createdAt: Date;

  /** Last updated date */
  updatedAt: Date;

  /** Status */
  status: 'draft' | 'published' | 'archived';

  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * A chapter in a book.
 */
export interface BookChapter {
  /** Chapter ID */
  id: string;

  /** Chapter title */
  title: string;

  /** Chapter content (assembled from passages) */
  content: string;

  /** Source passage IDs */
  passageIds: string[];

  /** Position in book */
  position: number;

  /** Word count */
  wordCount: number;
}
