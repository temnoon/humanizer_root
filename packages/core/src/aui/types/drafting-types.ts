/**
 * Unified AUI Types - Drafting Loop Types
 *
 * Types for the iterative drafting service that supports:
 * - Multi-source content gathering (AUI archive, ChromaDB, file paths)
 * - Version-tracked drafts with feedback
 * - Theme-aware HTML export
 * - Narrator persona for original content generation
 *
 * @module @humanizer/core/aui/types/drafting-types
 */

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A content source for drafting.
 * Sources can be from the AUI archive, file paths, URLs, or direct text.
 */
export type DraftSource =
  | AuiArchiveSource
  | AuiClusterSource
  | FilePathSource
  | UrlSource
  | DirectTextSource;

/**
 * Source from the AUI's PostgreSQL archive via AgenticSearch.
 */
export interface AuiArchiveSource {
  type: 'aui-archive';
  /** Semantic query to search */
  query: string;
  /** Minimum relevance score (0-1) */
  minRelevance?: number;
  /** Maximum passages to retrieve */
  limit?: number;
  /** Filter by source types */
  sourceTypes?: string[];
  /** Filter by author role */
  authorRole?: 'user' | 'assistant' | 'system';
  /** Date range filter */
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}

/**
 * Source from a saved AUI cluster.
 */
export interface AuiClusterSource {
  type: 'aui-cluster';
  /** Cluster ID */
  clusterId: string;
  /** Maximum passages from cluster */
  limit?: number;
}

/**
 * Source from a URL (fetched and parsed).
 */
export interface UrlSource {
  type: 'url';
  /** URL to fetch */
  url: string;
  /** CSS selector to extract (if HTML) */
  selector?: string;
  /** Parse as markdown */
  parseAsMarkdown?: boolean;
}

/**
 * Source from local file paths.
 */
export interface FilePathSource {
  type: 'file-path';
  /** File or directory path */
  path: string;
  /** Glob pattern for files (if path is directory) */
  pattern?: string;
  /** File encoding */
  encoding?: BufferEncoding;
  /** Parse as markdown and extract sections */
  parseMarkdown?: boolean;
}

/**
 * Direct text provided by user.
 */
export interface DirectTextSource {
  type: 'direct-text';
  /** Text content */
  text: string;
  /** Optional label/title */
  label?: string;
  /** Source attribution */
  attribution?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// GATHERED MATERIAL TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A passage gathered from any source.
 */
export interface GatheredPassage {
  /** Unique ID */
  id: string;
  /** Text content */
  text: string;
  /** Source type */
  sourceType: DraftSource['type'];
  /** Source-specific metadata */
  sourceMetadata: Record<string, unknown>;
  /** Relevance score (if applicable) */
  relevance?: number;
  /** Date from source */
  sourceDate?: Date;
  /** Word count */
  wordCount: number;
  /** Excerpt for context display */
  excerpt: string;
}

/**
 * Result of gathering material from sources.
 */
export interface GatherResult {
  /** All gathered passages */
  passages: GatheredPassage[];
  /** Per-source statistics */
  sourceStats: Array<{
    sourceType: DraftSource['type'];
    count: number;
    durationMs: number;
    errors?: string[];
  }>;
  /** Total duration */
  totalDurationMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// DRAFT TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Status of a drafting session.
 */
export type DraftingStatus =
  | 'gathering'      // Collecting source material
  | 'drafting'       // Generating initial draft
  | 'awaiting-feedback' // Draft ready for user review
  | 'revising'       // Applying feedback
  | 'finalizing'     // Generating final outputs
  | 'complete'       // All outputs generated
  | 'error';         // Error state

/**
 * A single draft version.
 */
export interface DraftVersion {
  /** Version number (1-based) */
  version: number;
  /** Content of this draft */
  content: string;
  /** Word count */
  wordCount: number;
  /** When this version was created */
  createdAt: Date;
  /** Feedback that led to this version (null for v1) */
  feedbackApplied: UserFeedback | null;
  /** Changes summary from previous version */
  changesSummary?: string;
  /** LLM model used */
  model?: string;
  /** Generation duration */
  generationMs?: number;
}

/**
 * User feedback on a draft.
 */
export interface UserFeedback {
  /** Timestamp */
  providedAt: Date;
  /** Free-form feedback text */
  text: string;
  /** Specific sections to revise */
  sectionsToRevise?: string[];
  /** Tone/style adjustments */
  toneAdjustments?: string[];
  /** Content to add */
  addContent?: string[];
  /** Content to remove */
  removeContent?: string[];
  /** Structural changes */
  structuralChanges?: string[];
}

/**
 * A drafting session tracking the full lifecycle.
 */
export interface DraftingSession {
  /** Session ID */
  id: string;
  /** Session title */
  title: string;
  /** Current status */
  status: DraftingStatus;
  /** User ID (if associated) */
  userId?: string;
  /** Sources configured */
  sources: DraftSource[];
  /** Gathered material */
  gatheredMaterial?: GatherResult;
  /** All draft versions */
  versions: DraftVersion[];
  /** Current version number */
  currentVersion: number;
  /** Pending feedback (before applied) */
  pendingFeedback?: UserFeedback;
  /** Narrator persona ID (for original narration) */
  narratorPersonaId?: string;
  /** Narrator persona definition (inline, for ad-hoc) */
  narratorPersona?: NarratorPersona;
  /** Export configuration */
  exportConfig?: ExportConfig;
  /** Exported artifacts */
  exports: ExportedArtifact[];
  /** Session metadata */
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    totalGenerationMs: number;
    feedbackRounds: number;
  };
  /** Error message (if status is 'error') */
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// NARRATOR PERSONA TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A narrator persona for generating original content.
 * Unlike RewritePersona which transforms existing text,
 * NarratorPersona guides original content generation.
 */
export interface NarratorPersona {
  /** Persona name */
  name: string;
  /** Full system prompt for the narrator voice */
  systemPrompt: string;
  /** Voice characteristics (short descriptors) */
  voiceCharacteristics?: string[];
  /** Things to avoid */
  avoidPatterns?: string[];
  /** Structural guidance */
  structureGuidance?: {
    /** How to start (not with setup/summary) */
    opening?: string;
    /** How to use source material */
    sourceMaterialUsage?: string;
    /** How to end */
    closing?: string;
  };
  /** Temperature for generation */
  temperature?: number;
  /** Top-p for generation */
  topP?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Export format options.
 */
export type ExportFormat = 'markdown' | 'html' | 'json';

/**
 * HTML theme configuration.
 */
export interface HtmlTheme {
  /** Theme name */
  name: string;
  /** Support system color scheme detection */
  respectSystemMode: boolean;
  /** Light mode colors */
  lightColors: ThemeColors;
  /** Dark mode colors */
  darkColors: ThemeColors;
  /** Typography settings */
  typography: {
    fontFamily: string;
    headingFontFamily?: string;
    baseFontSize: string;
    lineHeight: number;
    maxWidth: string;
  };
  /** Custom CSS to inject */
  customCss?: string;
}

/**
 * Theme color palette.
 */
export interface ThemeColors {
  /** Primary background */
  bgPrimary: string;
  /** Secondary background (cards, sections) */
  bgSecondary: string;
  /** Tertiary background (hover states) */
  bgTertiary: string;
  /** Primary text */
  textPrimary: string;
  /** Secondary text */
  textSecondary: string;
  /** Tertiary/muted text */
  textTertiary: string;
  /** Accent color */
  accent: string;
  /** Accent hover */
  accentHover: string;
  /** Border color */
  border: string;
  /** Success color */
  success: string;
  /** Warning color */
  warning: string;
  /** Error color */
  error: string;
}

/**
 * Section styling for HTML export.
 */
export interface SectionStyle {
  /** CSS class name */
  className: string;
  /** Section title pattern to match */
  titlePattern?: RegExp;
  /** Content pattern to match */
  contentPattern?: RegExp;
  /** Border color (left accent) */
  borderColor?: string;
  /** Background color */
  backgroundColor?: string;
  /** Icon or badge to display */
  badge?: {
    text: string;
    color: string;
    bgColor: string;
  };
}

/**
 * Export configuration.
 */
export interface ExportConfig {
  /** Formats to generate */
  formats: ExportFormat[];
  /** HTML theme (if html format included) */
  htmlTheme?: HtmlTheme;
  /** Custom section styles */
  sectionStyles?: SectionStyle[];
  /** Generate table of contents */
  generateToc?: boolean;
  /** Include metadata footer */
  includeMetadata?: boolean;
  /** Output directory (for file export) */
  outputDir?: string;
  /** Filename prefix */
  filenamePrefix?: string;
}

/**
 * An exported artifact.
 */
export interface ExportedArtifact {
  /** Format */
  format: ExportFormat;
  /** Content */
  content: string;
  /** File path (if saved) */
  filePath?: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Export timestamp */
  exportedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE OPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for starting a drafting session.
 */
export interface StartDraftingOptions {
  /** Session title */
  title: string;
  /** User ID */
  userId?: string;
  /** Content sources */
  sources: DraftSource[];
  /** Narrator persona ID (from database) */
  narratorPersonaId?: string;
  /** Inline narrator persona definition */
  narratorPersona?: NarratorPersona;
  /** Export configuration */
  exportConfig?: ExportConfig;
  /** Target word count for draft */
  targetWordCount?: number;
  /** LLM model override */
  model?: string;
}

/**
 * Options for generating a draft.
 */
export interface GenerateDraftOptions {
  /** Optional guidance for this draft */
  guidance?: string;
  /** Target word count */
  targetWordCount?: number;
  /** Focus on specific passages */
  focusPassageIds?: string[];
  /** LLM model override */
  model?: string;
}

/**
 * Options for revising a draft.
 */
export interface ReviseDraftOptions {
  /** Feedback to apply */
  feedback: Omit<UserFeedback, 'providedAt'>;
  /** Target word count adjustment */
  targetWordCount?: number;
  /** LLM model override */
  model?: string;
}

/**
 * Progress callback for long-running operations.
 */
export interface DraftingProgress {
  /** Current phase */
  phase: DraftingStatus;
  /** Current step within phase */
  step: number;
  /** Total steps in phase */
  totalSteps: number;
  /** Progress message */
  message: string;
  /** Percentage complete (0-100) */
  percentComplete?: number;
}

export type DraftingProgressCallback = (progress: DraftingProgress) => void;
