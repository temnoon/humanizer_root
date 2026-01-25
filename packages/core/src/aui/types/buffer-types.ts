/**
 * Unified AUI Types - Buffer Types
 *
 * Versioned buffer types with git-like branching capabilities.
 *
 * @module @humanizer/core/aui/types/buffer-types
 */

// ═══════════════════════════════════════════════════════════════════════════
// VERSIONED BUFFER TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A single version of content in a buffer.
 * Represents a committed state of the buffer at a point in time.
 */
export interface BufferVersion {
  /** Unique version ID (short hash, e.g., 'a1b2c3d') */
  id: string;

  /** The committed content */
  content: unknown[];

  /** Commit message describing the changes */
  message: string;

  /** Timestamp when this version was created (epoch ms) */
  timestamp: number;

  /** Parent version ID (null for initial commit) */
  parentId: string | null;

  /** Named tags for easy reference (e.g., 'v1.0', 'stable') */
  tags: string[];

  /** Additional metadata attached to this version */
  metadata: Record<string, unknown>;
}

/**
 * A branch in the buffer version history.
 * Branches allow parallel experimentation with buffer content.
 */
export interface BufferBranch {
  /** Branch name (e.g., 'main', 'experiment-1') */
  name: string;

  /** Version ID at the tip of this branch */
  headVersionId: string;

  /** When this branch was created (epoch ms) */
  createdAt: number;

  /** Optional description of what this branch is for */
  description?: string;

  /** Branch from which this was created */
  parentBranch?: string;
}

/**
 * A versioned buffer with full git-like capabilities.
 * Stores content with history, branches, and merge support.
 */
export interface VersionedBuffer {
  /** Unique buffer identifier */
  id: string;

  /** User-facing buffer name */
  name: string;

  /** All branches in this buffer */
  branches: Map<string, BufferBranch>;

  /** All versions (commits) in this buffer */
  versions: Map<string, BufferVersion>;

  /** Currently active branch name */
  currentBranch: string;

  /** Uncommitted working content */
  workingContent: unknown[];

  /** Whether working content differs from HEAD */
  isDirty: boolean;

  /** When this buffer was created (epoch ms) */
  createdAt: number;

  /** When this buffer was last modified (epoch ms) */
  updatedAt: number;

  /** Optional schema for content validation */
  schema?: ContentSchema;
}

/**
 * Schema definition for buffer content validation.
 */
export interface ContentSchema {
  /** Schema name/type */
  type: string;

  /** Required fields in content items */
  requiredFields?: string[];

  /** Field type definitions */
  fieldTypes?: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>;
}

/**
 * Diff between two buffer versions.
 * Describes what changed between versions.
 */
export interface BufferDiff {
  /** Source version ID */
  fromVersion: string;

  /** Target version ID */
  toVersion: string;

  /** Items added in target */
  added: unknown[];

  /** Items removed from source */
  removed: unknown[];

  /** Items that changed */
  modified: DiffModification[];

  /** Human-readable summary */
  summary: string;

  /** Statistics about the diff */
  stats: DiffStats;
}

/**
 * A single modification in a diff.
 */
export interface DiffModification {
  /** Index of the modified item */
  index: number;

  /** Old value */
  old: unknown;

  /** New value */
  new: unknown;

  /** Which fields changed (for objects) */
  changedFields?: string[];
}

/**
 * Statistics about a diff.
 */
export interface DiffStats {
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  unchangedCount: number;
}

/**
 * Result of a merge operation.
 */
export interface MergeResult {
  /** Whether the merge succeeded */
  success: boolean;

  /** Conflicts that need resolution (if any) */
  conflicts: MergeConflict[];

  /** Merged content (if successful) */
  mergedContent?: unknown[];

  /** ID of the merge commit (if successful) */
  newVersionId?: string;

  /** Merge strategy used */
  strategy: MergeStrategy;

  /** Details about the merge */
  details: string;
}

/**
 * A conflict that occurred during merge.
 */
export interface MergeConflict {
  /** Index of the conflicting item */
  index: number;

  /** Value from current branch ('ours') */
  ours: unknown;

  /** Value from source branch ('theirs') */
  theirs: unknown;

  /** Common ancestor value (if available) */
  base?: unknown;

  /** Resolved value (set when conflict is resolved) */
  resolved?: unknown;

  /** How this conflict was resolved */
  resolution?: ConflictResolution;
}

/**
 * How a merge conflict was resolved.
 */
export type ConflictResolution = 'ours' | 'theirs' | 'both' | 'custom';

/**
 * Merge strategy to use.
 */
export type MergeStrategy = 'auto' | 'ours' | 'theirs' | 'union';

/**
 * Serialized buffer for persistence.
 */
export interface SerializedBuffer {
  id: string;
  name: string;
  branches: Array<[string, BufferBranch]>;
  versions: Array<[string, BufferVersion]>;
  currentBranch: string;
  workingContent: unknown[];
  isDirty: boolean;
  createdAt: number;
  updatedAt: number;
  schema?: ContentSchema;
}
