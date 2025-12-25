/**
 * Book Module Types
 *
 * Structures for building books from archives
 */

import type { SICAnalysis, Sentence } from '@humanizer/core';
import type { Conversation, Message } from '@humanizer/archive';

// ═══════════════════════════════════════════════════════════════════
// PASSAGE - The unit of book material
// ═══════════════════════════════════════════════════════════════════

/**
 * A passage is a coherent excerpt from a conversation,
 * harvested for potential inclusion in a book.
 */
export interface Passage {
  /** Unique identifier */
  id: string;

  /** The text content */
  text: string;

  /** Source conversation */
  sourceConversation: {
    id: string;
    title: string;
  };

  /** Source message */
  sourceMessage: {
    id: string;
    timestamp: Date;
    author: string;
  };

  /** Character offset in original message */
  offset: number;

  /** Word count */
  wordCount: number;

  /** SIC analysis */
  sic?: SICAnalysis;

  /** Embedding vector for semantic clustering */
  embedding?: number[];

  /** Concepts/themes extracted */
  concepts?: string[];

  /** Relevance score to the book's theme (0-1) */
  relevance?: number;

  /** Manual annotations */
  annotations?: string[];
}

// ═══════════════════════════════════════════════════════════════════
// CLUSTER - Thematic groupings
// ═══════════════════════════════════════════════════════════════════

/**
 * A cluster is a thematic grouping of passages
 */
export interface Cluster {
  /** Cluster identifier */
  id: string;

  /** Generated or assigned label */
  label: string;

  /** Description of the theme */
  description?: string;

  /** Passages in this cluster */
  passages: Passage[];

  /** Centroid embedding (average of passage embeddings) */
  centroid?: number[];

  /** Key concepts that define this cluster */
  keyConcepts: string[];

  /** Suggested order within the cluster */
  suggestedOrder?: string[];
}

// ═══════════════════════════════════════════════════════════════════
// CHAPTER - Book structure unit
// ═══════════════════════════════════════════════════════════════════

/**
 * A chapter in the book
 */
export interface Chapter {
  /** Chapter number (1-indexed) */
  number: number;

  /** Chapter title */
  title: string;

  /** Chapter epigraph (optional quote) */
  epigraph?: {
    text: string;
    source?: string;
  };

  /** Introduction text */
  introduction?: string;

  /** Sections within the chapter */
  sections: Section[];

  /** Passages assigned to this chapter */
  passages: Passage[];

  /** Notes/marginalia for this chapter */
  marginalia?: Marginalia[];
}

export interface Section {
  /** Section title */
  title: string;

  /** Section content - ordered passage IDs */
  passageIds: string[];

  /** Transition text to next section */
  transition?: string;
}

export interface Marginalia {
  /** The marginal note */
  text: string;

  /** Which passage it refers to */
  passageId: string;

  /** Type of note */
  type: 'commentary' | 'reference' | 'question' | 'connection';
}

// ═══════════════════════════════════════════════════════════════════
// BOOK PROJECT - The full book in progress
// ═══════════════════════════════════════════════════════════════════

/**
 * A book project - the full state of a book being built
 */
export interface BookProject {
  /** Project identifier */
  id: string;

  /** Working title */
  title: string;

  /** Subtitle */
  subtitle?: string;

  /** Author */
  author: string;

  /** The central query/theme that defines this book */
  theme: string;

  /** Search queries used to harvest material */
  queries: string[];

  /** Source archive path */
  archivePath: string;

  /** All harvested passages */
  passages: Passage[];

  /** Clusters discovered */
  clusters: Cluster[];

  /** Chapter structure */
  chapters: Chapter[];

  /** Book metadata */
  metadata: BookMetadata;

  /** Build status */
  status: BookStatus;

  /** Creation timestamp */
  createdAt: Date;

  /** Last modified */
  updatedAt: Date;
}

export interface BookMetadata {
  /** Target word count */
  targetWordCount?: number;

  /** Current word count */
  currentWordCount: number;

  /** Passage count */
  passageCount: number;

  /** Date range of source material */
  dateRange?: {
    earliest: Date;
    latest: Date;
  };

  /** Average SIC score of included passages */
  averageSIC?: number;
}

export type BookStatus =
  | 'harvesting'    // Gathering passages
  | 'analyzing'     // Running SIC + embeddings
  | 'clustering'    // Grouping by theme
  | 'ordering'      // Determining sequence
  | 'composing'     // Building chapters
  | 'transforming'  // Applying style/voice
  | 'complete'      // Ready for export
  | 'exported';     // Final output generated

// ═══════════════════════════════════════════════════════════════════
// CONCEPT GRAPH - For ordering
// ═══════════════════════════════════════════════════════════════════

/**
 * A node in the concept dependency graph
 */
export interface ConceptNode {
  /** Concept name */
  concept: string;

  /** Passages that mention this concept */
  passageIds: string[];

  /** Concepts that should come before this one */
  dependencies: string[];

  /** Concepts that depend on this one */
  dependents: string[];

  /** Depth in the dependency tree (0 = foundational) */
  depth?: number;
}

/**
 * The full concept graph for ordering
 */
export interface ConceptGraph {
  /** All concept nodes */
  nodes: Map<string, ConceptNode>;

  /** Topologically sorted order */
  sortedOrder?: string[];
}

// ═══════════════════════════════════════════════════════════════════
// HARVEST OPTIONS
// ═══════════════════════════════════════════════════════════════════

export interface HarvestOptions {
  /** Search queries to find relevant passages */
  queries: string[];

  /** Minimum passage length (words) */
  minWords?: number;

  /** Maximum passage length (words) */
  maxWords?: number;

  /** Only include user messages (not AI) */
  userOnly?: boolean;

  /** Minimum SIC score to include */
  minSIC?: number;

  /** Date range filter */
  dateRange?: {
    start?: Date;
    end?: Date;
  };

  /** Maximum passages to harvest */
  limit?: number;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT OPTIONS
// ═══════════════════════════════════════════════════════════════════

export interface ExportOptions {
  /** Output format */
  format: 'markdown' | 'html' | 'json' | 'pdf';

  /** Include marginalia */
  includeMarginalia?: boolean;

  /** Include source citations */
  includeCitations?: boolean;

  /** Include SIC scores */
  includeSIC?: boolean;

  /** Output path */
  outputPath: string;
}
