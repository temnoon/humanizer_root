/**
 * ContentGraph - Immutable DAG of content nodes
 *
 * Nodes are never mutated. Operations create new nodes.
 * The graph grows monotonically (until garbage collection).
 */

import type {
  ContentNode,
  ContentItem,
  Operation,
  ArchiveSource,
  ContentNodeMetadata,
} from './types';

// ═══════════════════════════════════════════════════════════════════
// ID GENERATION
// ═══════════════════════════════════════════════════════════════════

let nodeCounter = 0;

function generateNodeId(): string {
  return `node-${Date.now()}-${++nodeCounter}`;
}

// ═══════════════════════════════════════════════════════════════════
// CONTENT GRAPH CLASS
// ═══════════════════════════════════════════════════════════════════

export class ContentGraph {
  private nodes: Map<string, ContentNode> = new Map();
  private childrenIndex: Map<string, Set<string>> = new Map();

  // ─────────────────────────────────────────────────────────────────
  // NODE ACCESS
  // ─────────────────────────────────────────────────────────────────

  getNode(nodeId: string): ContentNode | null {
    return this.nodes.get(nodeId) ?? null;
  }

  getAllNodes(): ContentNode[] {
    return Array.from(this.nodes.values());
  }

  getRootNodes(): ContentNode[] {
    return Array.from(this.nodes.values()).filter(n => n.parentId === null);
  }

  getChildren(nodeId: string): ContentNode[] {
    const childIds = this.childrenIndex.get(nodeId);
    if (!childIds) return [];
    return Array.from(childIds)
      .map(id => this.nodes.get(id))
      .filter((n): n is ContentNode => n !== undefined);
  }

  getParent(nodeId: string): ContentNode | null {
    const node = this.nodes.get(nodeId);
    if (!node || !node.parentId) return null;
    return this.nodes.get(node.parentId) ?? null;
  }

  /**
   * Get all ancestors from node to root (inclusive of node)
   */
  getAncestors(nodeId: string): ContentNode[] {
    const ancestors: ContentNode[] = [];
    let current = this.nodes.get(nodeId);

    while (current) {
      ancestors.push(current);
      if (current.parentId) {
        current = this.nodes.get(current.parentId);
      } else {
        break;
      }
    }

    return ancestors;
  }

  /**
   * Get the path of operations from root to node
   */
  getOperationPath(nodeId: string): Operation[] {
    const ancestors = this.getAncestors(nodeId).reverse();
    return ancestors
      .map(n => n.operation)
      .filter((op): op is Operation => op !== null);
  }

  // ─────────────────────────────────────────────────────────────────
  // NODE CREATION (always new, never mutate)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a new node in the graph
   */
  createNode(
    content: ContentItem | ContentItem[],
    parentId: string | null,
    operation: Operation | null,
    metadata?: Partial<ContentNodeMetadata>
  ): ContentNode {
    const id = generateNodeId();

    // Compute stats
    const items = Array.isArray(content) ? content : [content];
    const sicScores = items
      .map(i => i.metadata?.sicScore)
      .filter((s): s is number => s !== undefined);

    const node: ContentNode = {
      id,
      content,
      parentId,
      operation,
      metadata: {
        createdAt: Date.now(),
        itemCount: items.length,
        avgSicScore: sicScores.length > 0
          ? sicScores.reduce((a, b) => a + b, 0) / sicScores.length
          : undefined,
        ...metadata,
      },
    };

    // Add to graph
    this.nodes.set(id, node);

    // Update children index
    if (parentId) {
      if (!this.childrenIndex.has(parentId)) {
        this.childrenIndex.set(parentId, new Set());
      }
      this.childrenIndex.get(parentId)!.add(id);
    }

    return node;
  }

  /**
   * Import content from an archive source (creates root node)
   */
  importFromArchive(
    text: string,
    source: ArchiveSource,
    title?: string
  ): ContentNode {
    const item: ContentItem = {
      id: `item-${Date.now()}`,
      text,
      metadata: {
        wordCount: text.split(/\s+/).length,
      },
    };

    const operation: Operation = {
      type: 'import',
      operator: source.type,
      params: { source },
      timestamp: Date.now(),
    };

    return this.createNode(item, null, operation, {
      title: title ?? source.path[source.path.length - 1] ?? 'Imported',
      source,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // GARBAGE COLLECTION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Remove nodes that are not reachable from pinned nodes
   */
  collectGarbage(pinnedNodeIds: Set<string>): number {
    // Find all nodes reachable from pinned nodes (including ancestors)
    const reachable = new Set<string>();

    const markReachable = (nodeId: string) => {
      if (reachable.has(nodeId)) return;
      reachable.add(nodeId);

      // Mark ancestors (so we can show history)
      const node = this.nodes.get(nodeId);
      if (node?.parentId) {
        markReachable(node.parentId);
      }

      // Mark children (optional: could skip for more aggressive GC)
      const children = this.childrenIndex.get(nodeId);
      if (children) {
        for (const childId of children) {
          markReachable(childId);
        }
      }
    };

    for (const nodeId of pinnedNodeIds) {
      markReachable(nodeId);
    }

    // Remove unreachable nodes
    let removed = 0;
    for (const nodeId of this.nodes.keys()) {
      if (!reachable.has(nodeId)) {
        this.nodes.delete(nodeId);
        removed++;
      }
    }

    // Clean up children index
    for (const [parentId, children] of this.childrenIndex) {
      for (const childId of children) {
        if (!this.nodes.has(childId)) {
          children.delete(childId);
        }
      }
      if (children.size === 0) {
        this.childrenIndex.delete(parentId);
      }
    }

    return removed;
  }

  // ─────────────────────────────────────────────────────────────────
  // SERIALIZATION
  // ─────────────────────────────────────────────────────────────────

  toJSON(): Record<string, ContentNode> {
    const obj: Record<string, ContentNode> = {};
    for (const [id, node] of this.nodes) {
      obj[id] = node;
    }
    return obj;
  }

  static fromJSON(data: Record<string, ContentNode>): ContentGraph {
    const graph = new ContentGraph();
    for (const [id, node] of Object.entries(data)) {
      graph.nodes.set(id, node);
      if (node.parentId) {
        if (!graph.childrenIndex.has(node.parentId)) {
          graph.childrenIndex.set(node.parentId, new Set());
        }
        graph.childrenIndex.get(node.parentId)!.add(id);
      }
    }
    return graph;
  }

  // ─────────────────────────────────────────────────────────────────
  // DEBUG
  // ─────────────────────────────────────────────────────────────────

  getStats(): { nodeCount: number; rootCount: number; maxDepth: number } {
    const roots = this.getRootNodes();
    let maxDepth = 0;

    const measureDepth = (nodeId: string, depth: number) => {
      maxDepth = Math.max(maxDepth, depth);
      const children = this.childrenIndex.get(nodeId);
      if (children) {
        for (const childId of children) {
          measureDepth(childId, depth + 1);
        }
      }
    };

    for (const root of roots) {
      measureDepth(root.id, 1);
    }

    return {
      nodeCount: this.nodes.size,
      rootCount: roots.length,
      maxDepth,
    };
  }
}
