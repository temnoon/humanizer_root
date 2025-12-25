/**
 * Pipeline Runner - Execute sequences of operations
 *
 * A pipeline is a saved sequence of operations that can be
 * applied to content in one step.
 */

import type {
  Pipeline,
  PipelineStep,
  ContentNode,
  ContentItem,
  Operation,
} from './types';
import { ContentGraph } from './graph';
import { BufferManager } from './buffers';
import { operatorRegistry } from './operators';

// ═══════════════════════════════════════════════════════════════════
// PIPELINE RUNNER
// ═══════════════════════════════════════════════════════════════════

export class PipelineRunner {
  constructor(
    private graph: ContentGraph,
    private buffers: BufferManager
  ) {}

  /**
   * Apply a single operation to a node, creating a new node
   */
  async applyOperation(
    nodeId: string,
    operatorId: string,
    params?: Record<string, unknown>
  ): Promise<ContentNode | null> {
    const node = this.graph.getNode(nodeId);
    if (!node) return null;

    const operator = operatorRegistry.get(operatorId);
    if (!operator) {
      console.error(`Unknown operator: ${operatorId}`);
      return null;
    }

    // Execute the operator
    const result = await operator.execute(node.content, params);

    // Create the operation record
    const operation: Operation = {
      type: operator.type,
      operator: operatorId,
      params,
      timestamp: Date.now(),
    };

    // Create new node with the result
    return this.graph.createNode(result, nodeId, operation, {
      title: node.metadata.title,
      source: node.metadata.source,
    });
  }

  /**
   * Apply an operation to the active buffer and navigate to result
   */
  async applyToActiveBuffer(
    operatorId: string,
    params?: Record<string, unknown>
  ): Promise<ContentNode | null> {
    const buffer = this.buffers.getActiveBuffer();
    if (!buffer) return null;

    const newNode = await this.applyOperation(buffer.nodeId, operatorId, params);
    if (newNode) {
      this.buffers.navigateTo(buffer.id, newNode.id);
    }

    return newNode;
  }

  /**
   * Apply a full pipeline to a node
   */
  async applyPipeline(
    nodeId: string,
    pipeline: Pipeline
  ): Promise<ContentNode | null> {
    let currentNodeId = nodeId;

    for (const step of pipeline.steps) {
      const newNode = await this.applyOperation(
        currentNodeId,
        `${step.type}:${step.operator}`.replace('::', ':'),
        step.params
      );

      if (!newNode) {
        console.error(`Pipeline failed at step: ${step.operator}`);
        return null;
      }

      currentNodeId = newNode.id;
    }

    return this.graph.getNode(currentNodeId);
  }

  /**
   * Apply pipeline to active buffer
   */
  async applyPipelineToActiveBuffer(pipeline: Pipeline): Promise<ContentNode | null> {
    const buffer = this.buffers.getActiveBuffer();
    if (!buffer) return null;

    const newNode = await this.applyPipeline(buffer.nodeId, pipeline);
    if (newNode) {
      this.buffers.navigateTo(buffer.id, newNode.id);
    }

    return newNode;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PIPELINE STORAGE
// ═══════════════════════════════════════════════════════════════════

export class PipelineStorage {
  private pipelines: Map<string, Pipeline> = new Map();

  constructor() {
    // Register built-in pipelines
    this.registerBuiltIns();
  }

  private registerBuiltIns(): void {
    this.save({
      id: 'sentence-split',
      name: 'Split to Sentences',
      description: 'Split text into individual sentences',
      steps: [
        { type: 'split', operator: 'sentence' },
      ],
      createdAt: Date.now(),
    });

    this.save({
      id: 'paragraph-split',
      name: 'Split to Paragraphs',
      description: 'Split text at paragraph breaks',
      steps: [
        { type: 'split', operator: 'paragraph' },
      ],
      createdAt: Date.now(),
    });

    this.save({
      id: 'book-prep',
      name: 'Prepare for Book',
      description: 'Split into sentences and filter by quality',
      steps: [
        { type: 'split', operator: 'sentence' },
        { type: 'filter', operator: 'sic', params: { threshold: 70, comparison: '>' } },
        { type: 'order', operator: 'sic', params: { direction: 'desc' } },
      ],
      createdAt: Date.now(),
    });

    this.save({
      id: 'extract-gems',
      name: 'Extract Gems',
      description: 'Find the best sentences',
      steps: [
        { type: 'split', operator: 'sentence' },
        { type: 'filter', operator: 'sic', params: { threshold: 80, comparison: '>' } },
        { type: 'select', operator: 'first', params: { count: 20 } },
      ],
      createdAt: Date.now(),
    });

    this.save({
      id: 'find-slop',
      name: 'Find Slop',
      description: 'Find AI-like sentences',
      steps: [
        { type: 'split', operator: 'sentence' },
        { type: 'filter', operator: 'sic', params: { threshold: 30, comparison: '<' } },
        { type: 'order', operator: 'sic', params: { direction: 'asc' } },
      ],
      createdAt: Date.now(),
    });
  }

  save(pipeline: Pipeline): void {
    this.pipelines.set(pipeline.id, pipeline);
  }

  get(pipelineId: string): Pipeline | null {
    return this.pipelines.get(pipelineId) ?? null;
  }

  getAll(): Pipeline[] {
    return Array.from(this.pipelines.values());
  }

  delete(pipelineId: string): boolean {
    return this.pipelines.delete(pipelineId);
  }

  // Build pipeline from steps
  createPipeline(
    name: string,
    steps: PipelineStep[],
    description?: string
  ): Pipeline {
    const id = `pipeline-${Date.now()}`;
    const pipeline: Pipeline = {
      id,
      name,
      description,
      steps,
      createdAt: Date.now(),
    };
    this.save(pipeline);
    return pipeline;
  }

  toJSON(): Record<string, Pipeline> {
    const obj: Record<string, Pipeline> = {};
    for (const [id, pipeline] of this.pipelines) {
      obj[id] = pipeline;
    }
    return obj;
  }

  static fromJSON(data: Record<string, Pipeline>): PipelineStorage {
    const storage = new PipelineStorage();
    // Clear built-ins to load from saved state
    storage.pipelines.clear();
    for (const [id, pipeline] of Object.entries(data)) {
      storage.pipelines.set(id, pipeline);
    }
    return storage;
  }
}
