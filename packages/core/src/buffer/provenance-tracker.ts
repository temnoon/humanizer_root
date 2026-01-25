/**
 * Provenance Tracker
 *
 * Manages provenance chains for content buffers.
 * Tracks all transformations through the content pipeline.
 *
 * @module @humanizer/core/buffer/provenance-tracker
 */

import type {
  ProvenanceChain,
  ProvenanceBranch,
  BufferOperation,
  BufferOperationType,
  OperationPerformer,
  OperationHashes,
  QualityImpact,
} from './types.js';
import { generateUUID, computeDeltaHash } from './hash-utils.js';

// ═══════════════════════════════════════════════════════════════════════════
// PROVENANCE CHAIN CREATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new provenance chain for a buffer.
 */
export function createProvenanceChain(
  rootBufferId: string,
  branchName: string = 'main'
): ProvenanceChain {
  return {
    id: generateUUID(),
    rootBufferId,
    currentBufferId: rootBufferId,
    operations: [],
    branch: {
      name: branchName,
      isMain: branchName === 'main',
    },
    childChainIds: [],
    transformationCount: 0,
  };
}

/**
 * Create a branch from an existing provenance chain.
 */
export function createBranch(
  parentChain: ProvenanceChain,
  branchName: string,
  description?: string
): ProvenanceChain {
  const newChain: ProvenanceChain = {
    id: generateUUID(),
    rootBufferId: parentChain.currentBufferId, // Branch from current position
    currentBufferId: parentChain.currentBufferId,
    operations: [], // Start fresh - parent operations stay in parent
    branch: {
      name: branchName,
      description,
      isMain: false,
    },
    parentChainId: parentChain.id,
    childChainIds: [],
    transformationCount: 0,
  };

  // Note: Caller should add newChain.id to parentChain.childChainIds

  return newChain;
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATION CREATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a buffer operation record.
 */
export function createOperation(
  type: BufferOperationType,
  performer: OperationPerformer,
  beforeHash: string,
  afterHash: string,
  description: string,
  parameters: Record<string, unknown> = {},
  options?: {
    qualityImpact?: QualityImpact;
    durationMs?: number;
    costCents?: number;
  }
): BufferOperation {
  return {
    id: generateUUID(),
    type,
    timestamp: Date.now(),
    performer,
    parameters,
    hashes: {
      beforeHash,
      afterHash,
      deltaHash: computeDeltaHash(beforeHash, afterHash),
    },
    qualityImpact: options?.qualityImpact,
    description,
    durationMs: options?.durationMs,
    costCents: options?.costCents,
  };
}

/**
 * Add an operation to a provenance chain.
 * Returns a NEW chain (immutable).
 */
export function addOperation(
  chain: ProvenanceChain,
  operation: BufferOperation,
  newBufferId: string
): ProvenanceChain {
  return {
    ...chain,
    currentBufferId: newBufferId,
    operations: [...chain.operations, operation],
    transformationCount: chain.transformationCount + 1,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a load operation (from archive or book).
 */
export function createLoadOperation(
  sourceType: 'archive' | 'book',
  sourceNodeId: string,
  contentHash: string,
  performer: OperationPerformer
): BufferOperation {
  const type = sourceType === 'archive' ? 'load_archive' : 'load_book';
  return createOperation(
    type,
    performer,
    '', // No before hash for load
    contentHash,
    `Loaded from ${sourceType}: ${sourceNodeId}`,
    { sourceNodeId }
  );
}

/**
 * Create a rewrite operation.
 */
export function createRewriteOperation(
  beforeHash: string,
  afterHash: string,
  personaId: string,
  styleId: string | undefined,
  changesApplied: string[],
  performer: OperationPerformer,
  options?: {
    durationMs?: number;
    costCents?: number;
    confidenceScore?: number;
  }
): BufferOperation {
  return createOperation(
    'rewrite_persona',
    performer,
    beforeHash,
    afterHash,
    `Rewritten for persona: ${personaId}${styleId ? ` with style: ${styleId}` : ''}`,
    {
      personaId,
      styleId,
      changesApplied,
      confidenceScore: options?.confidenceScore,
    },
    {
      durationMs: options?.durationMs,
      costCents: options?.costCents,
    }
  );
}

/**
 * Create a merge operation.
 */
export function createMergeOperation(
  sourceBufferIds: string[],
  resultHash: string,
  performer: OperationPerformer
): BufferOperation {
  return createOperation(
    'merge',
    performer,
    '', // Multiple sources, no single before hash
    resultHash,
    `Merged ${sourceBufferIds.length} buffers`,
    { sourceBufferIds }
  );
}

/**
 * Create a split operation.
 */
export function createSplitOperation(
  sourceHash: string,
  resultHashes: string[],
  strategy: string,
  performer: OperationPerformer
): BufferOperation {
  return createOperation(
    'split',
    performer,
    sourceHash,
    resultHashes.join(','), // Multiple results
    `Split into ${resultHashes.length} buffers using ${strategy}`,
    { resultHashes, strategy }
  );
}

/**
 * Create an analyze quality operation.
 */
export function createAnalyzeOperation(
  contentHash: string,
  qualityImpact: QualityImpact,
  performer: OperationPerformer,
  durationMs?: number
): BufferOperation {
  return createOperation(
    'analyze_quality',
    performer,
    contentHash,
    contentHash, // Quality analysis doesn't change content
    'Quality analysis performed',
    {},
    { qualityImpact, durationMs }
  );
}

/**
 * Create an AI detection operation.
 */
export function createDetectAIOperation(
  contentHash: string,
  aiProbability: number,
  tellsFound: number,
  performer: OperationPerformer,
  durationMs?: number
): BufferOperation {
  return createOperation(
    'detect_ai',
    performer,
    contentHash,
    contentHash, // Detection doesn't change content
    `AI detection: ${(aiProbability * 100).toFixed(1)}% probability, ${tellsFound} tells found`,
    { aiProbability, tellsFound },
    { durationMs }
  );
}

/**
 * Create a commit to book operation.
 */
export function createCommitOperation(
  contentHash: string,
  bookId: string,
  chapterId: string,
  performer: OperationPerformer
): BufferOperation {
  return createOperation(
    'commit_book',
    performer,
    contentHash,
    contentHash, // Commit doesn't change content
    `Committed to book: ${bookId}, chapter: ${chapterId}`,
    { bookId, chapterId }
  );
}

/**
 * Create an export to archive operation.
 */
export function createExportOperation(
  contentHash: string,
  archiveNodeId: string,
  performer: OperationPerformer
): BufferOperation {
  return createOperation(
    'export_archive',
    performer,
    contentHash,
    contentHash, // Export doesn't change content
    `Exported to archive: ${archiveNodeId}`,
    { archiveNodeId }
  );
}

/**
 * Create an embed operation.
 */
export function createEmbedOperation(
  contentHash: string,
  embeddingDimension: number,
  performer: OperationPerformer,
  durationMs?: number
): BufferOperation {
  return createOperation(
    'embed',
    performer,
    contentHash,
    contentHash, // Embedding doesn't change content
    `Generated ${embeddingDimension}D embedding`,
    { embeddingDimension },
    { durationMs }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVENANCE TRACKER CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ProvenanceTracker - Manages provenance chains and operations
 *
 * Provides methods for creating, updating, and querying provenance.
 */
export class ProvenanceTracker {
  private chains: Map<string, ProvenanceChain> = new Map();
  private bufferToChain: Map<string, string> = new Map(); // bufferId -> chainId

  /**
   * Create a new provenance chain for a root buffer.
   */
  createChain(rootBufferId: string, branchName: string = 'main'): ProvenanceChain {
    const chain = createProvenanceChain(rootBufferId, branchName);
    this.chains.set(chain.id, chain);
    this.bufferToChain.set(rootBufferId, chain.id);
    return chain;
  }

  /**
   * Get a provenance chain by ID.
   */
  getChain(chainId: string): ProvenanceChain | undefined {
    return this.chains.get(chainId);
  }

  /**
   * Get the chain for a buffer.
   */
  getChainForBuffer(bufferId: string): ProvenanceChain | undefined {
    const chainId = this.bufferToChain.get(bufferId);
    return chainId ? this.chains.get(chainId) : undefined;
  }

  /**
   * Record an operation on a chain.
   * Returns the updated chain and registers the new buffer.
   */
  recordOperation(
    chainId: string,
    operation: BufferOperation,
    newBufferId: string
  ): ProvenanceChain {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Provenance chain not found: ${chainId}`);
    }

    const updatedChain = addOperation(chain, operation, newBufferId);
    this.chains.set(chainId, updatedChain);
    this.bufferToChain.set(newBufferId, chainId);

    return updatedChain;
  }

  /**
   * Create a branch from an existing chain.
   */
  createBranch(
    parentChainId: string,
    branchName: string,
    description?: string
  ): ProvenanceChain {
    const parentChain = this.chains.get(parentChainId);
    if (!parentChain) {
      throw new Error(`Parent chain not found: ${parentChainId}`);
    }

    const newChain = createBranch(parentChain, branchName, description);
    this.chains.set(newChain.id, newChain);

    // Update parent's child chains
    const updatedParent: ProvenanceChain = {
      ...parentChain,
      childChainIds: [...parentChain.childChainIds, newChain.id],
    };
    this.chains.set(parentChainId, updatedParent);

    return newChain;
  }

  /**
   * Trace back to the root buffer of a chain.
   */
  traceToRoot(chainId: string): string {
    let currentChain = this.chains.get(chainId);
    if (!currentChain) {
      throw new Error(`Chain not found: ${chainId}`);
    }

    // Follow parent chain links to find the root
    while (currentChain.parentChainId) {
      const parentChain = this.chains.get(currentChain.parentChainId);
      if (!parentChain) {
        break;
      }
      currentChain = parentChain;
    }

    return currentChain.rootBufferId;
  }

  /**
   * Get all operations in a chain's history (including parent chains).
   */
  getFullHistory(chainId: string): BufferOperation[] {
    const history: BufferOperation[] = [];
    let currentChain = this.chains.get(chainId);

    // Collect operations from current chain and all ancestors
    while (currentChain) {
      // Prepend parent operations (they happened first)
      history.unshift(...currentChain.operations);

      if (currentChain.parentChainId) {
        currentChain = this.chains.get(currentChain.parentChainId);
      } else {
        break;
      }
    }

    return history;
  }

  /**
   * Find all buffers derived from a root buffer.
   */
  findDerived(rootBufferId: string): string[] {
    const derived: string[] = [];

    for (const chain of this.chains.values()) {
      if (chain.rootBufferId === rootBufferId || this.isDescendant(chain.id, rootBufferId)) {
        // Add all buffers in this chain
        derived.push(chain.currentBufferId);
        for (const op of chain.operations) {
          if (op.hashes.afterHash) {
            derived.push(chain.currentBufferId);
          }
        }
      }
    }

    return [...new Set(derived)]; // Deduplicate
  }

  /**
   * Check if a chain is a descendant of a root buffer.
   */
  private isDescendant(chainId: string, rootBufferId: string): boolean {
    let currentChain = this.chains.get(chainId);

    while (currentChain) {
      if (currentChain.rootBufferId === rootBufferId) {
        return true;
      }
      if (!currentChain.parentChainId) {
        break;
      }
      currentChain = this.chains.get(currentChain.parentChainId);
    }

    return false;
  }

  /**
   * Clear all tracked chains.
   */
  clear(): void {
    this.chains.clear();
    this.bufferToChain.clear();
  }

  /**
   * Export all chains for persistence.
   */
  export(): ProvenanceChain[] {
    return Array.from(this.chains.values());
  }

  /**
   * Import chains from persistence.
   */
  import(chains: ProvenanceChain[]): void {
    for (const chain of chains) {
      this.chains.set(chain.id, chain);
      this.bufferToChain.set(chain.currentBufferId, chain.id);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let _tracker: ProvenanceTracker | null = null;

/**
 * Get the singleton provenance tracker.
 */
export function getProvenanceTracker(): ProvenanceTracker {
  if (!_tracker) {
    _tracker = new ProvenanceTracker();
  }
  return _tracker;
}

/**
 * Reset the singleton provenance tracker.
 */
export function resetProvenanceTracker(): void {
  if (_tracker) {
    _tracker.clear();
  }
  _tracker = null;
}
