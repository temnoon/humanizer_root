/**
 * Adapter Registry
 *
 * Central registry for content source adapters. Handles registration,
 * lookup, and detection of the best adapter for a given source.
 *
 * Uses the singleton provider pattern consistent with other platinum
 * infrastructure components.
 */

import { getConfigManager } from '../config/index.js';
import type { ConfigManager } from '../config/types.js';
import type {
  ContentAdapter,
  AdapterRegistry,
  AdapterSource,
  DetectionResult,
  ADAPTER_CONFIG,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════
// IN-MEMORY REGISTRY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

/**
 * In-memory adapter registry
 */
export class InMemoryAdapterRegistry implements AdapterRegistry {
  private adapters: Map<string, ContentAdapter> = new Map();
  private configManager: ConfigManager;

  constructor() {
    this.configManager = getConfigManager();
  }

  /**
   * Register an adapter
   */
  register(adapter: ContentAdapter): void {
    if (this.adapters.has(adapter.id)) {
      console.warn(`[AdapterRegistry] Overwriting existing adapter: ${adapter.id}`);
    }
    this.adapters.set(adapter.id, adapter);
    console.info(`[AdapterRegistry] Registered adapter: ${adapter.id} (${adapter.name})`);
  }

  /**
   * Get an adapter by ID
   */
  get(id: string): ContentAdapter | undefined {
    return this.adapters.get(id);
  }

  /**
   * Get all registered adapters
   */
  getAll(): ContentAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Detect which adapter(s) can handle a source
   *
   * Returns adapters sorted by confidence (highest first)
   */
  async detectAdapters(source: AdapterSource): Promise<Array<{
    adapter: ContentAdapter;
    detection: DetectionResult;
  }>> {
    const minConfidence = await this.configManager.getOrDefault<number>(
      'thresholds',
      'adapters.minConfidence',
      0.3
    );

    const detectionTimeout = await this.configManager.getOrDefault<number>(
      'limits',
      'adapters.detectionTimeoutMs',
      5000
    );

    const results: Array<{
      adapter: ContentAdapter;
      detection: DetectionResult;
    }> = [];

    // Run detection in parallel with timeout
    const detectionPromises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        const detection = await Promise.race([
          adapter.detect(source),
          new Promise<DetectionResult>((_, reject) =>
            setTimeout(() => reject(new Error('Detection timeout')), detectionTimeout)
          ),
        ]);

        if (detection.canHandle && detection.confidence >= minConfidence) {
          return { adapter, detection };
        }
        return null;
      } catch (error) {
        console.warn(`[AdapterRegistry] Detection failed for ${adapter.id}:`, error);
        return null;
      }
    });

    const detectionResults = await Promise.all(detectionPromises);

    for (const result of detectionResults) {
      if (result) {
        results.push(result);
      }
    }

    // Sort by confidence (highest first)
    results.sort((a, b) => b.detection.confidence - a.detection.confidence);

    return results;
  }

  /**
   * Get the best adapter for a source
   */
  async getBestAdapter(source: AdapterSource): Promise<ContentAdapter | undefined> {
    const detected = await this.detectAdapters(source);
    return detected.length > 0 ? detected[0].adapter : undefined;
  }

  /**
   * Get adapters by content type
   */
  getByContentType(contentType: string): ContentAdapter[] {
    return Array.from(this.adapters.values()).filter(
      adapter => adapter.contentTypes.includes(contentType)
    );
  }

  /**
   * Get adapters by supported extension
   */
  getByExtension(extension: string): ContentAdapter[] {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    return Array.from(this.adapters.values()).filter(
      adapter => adapter.supportedExtensions.includes(ext)
    );
  }

  /**
   * Check if an adapter is registered
   */
  has(id: string): boolean {
    return this.adapters.has(id);
  }

  /**
   * Unregister an adapter
   */
  unregister(id: string): boolean {
    return this.adapters.delete(id);
  }

  /**
   * Clear all adapters
   */
  clear(): void {
    this.adapters.clear();
  }

  /**
   * Get adapter count
   */
  get count(): number {
    return this.adapters.size;
  }

  /**
   * Get summary of registered adapters
   */
  getSummary(): Array<{
    id: string;
    name: string;
    version: string;
    contentTypes: string[];
    extensions: string[];
  }> {
    return Array.from(this.adapters.values()).map(adapter => ({
      id: adapter.id,
      name: adapter.name,
      version: adapter.version,
      contentTypes: adapter.contentTypes,
      extensions: adapter.supportedExtensions,
    }));
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON PROVIDER
// ═══════════════════════════════════════════════════════════════════

let _registry: AdapterRegistry | null = null;

/**
 * Get the adapter registry
 */
export function getAdapterRegistry(): AdapterRegistry {
  if (!_registry) {
    _registry = new InMemoryAdapterRegistry();
  }
  return _registry;
}

/**
 * Set a custom adapter registry
 */
export function setAdapterRegistry(registry: AdapterRegistry): void {
  _registry = registry;
}

/**
 * Reset the adapter registry (for testing)
 */
export function resetAdapterRegistry(): void {
  _registry = null;
}

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Register an adapter with the default registry
 */
export function registerAdapter(adapter: ContentAdapter): void {
  getAdapterRegistry().register(adapter);
}

/**
 * Get an adapter by ID from the default registry
 */
export function getAdapter(id: string): ContentAdapter | undefined {
  return getAdapterRegistry().get(id);
}

/**
 * Detect the best adapter for a source
 */
export async function detectAdapter(source: AdapterSource): Promise<ContentAdapter | undefined> {
  return getAdapterRegistry().getBestAdapter(source);
}
