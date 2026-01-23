/**
 * Tests for BQL Storage Bridge
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StorageBridge,
  createStorageBridge,
  createMockStorageBridge,
  type ContentStoreInterface,
  type StoredNodeSubset,
  type SearchResultSubset,
} from './storage-bridge.js';

// Mock content store
function createMockStore(): ContentStoreInterface {
  const nodes: StoredNodeSubset[] = [
    {
      id: 'node-1',
      contentHash: 'hash-1',
      uri: 'content://chatgpt/message/1',
      text: 'My childhood memories of summer vacation',
      format: 'text',
      wordCount: 6,
      sourceType: 'chatgpt',
      sourceAdapter: 'chatgpt',
      hierarchyLevel: 0,
      title: 'Summer Memories',
      author: 'user',
      createdAt: Date.now(),
      importedAt: Date.now(),
    },
    {
      id: 'node-2',
      contentHash: 'hash-2',
      uri: 'content://chatgpt/message/2',
      text: 'Technical documentation about APIs',
      format: 'text',
      wordCount: 4,
      sourceType: 'chatgpt',
      sourceAdapter: 'chatgpt',
      hierarchyLevel: 0,
      title: 'API Docs',
      author: 'assistant',
      createdAt: Date.now(),
      importedAt: Date.now(),
    },
    {
      id: 'node-3',
      contentHash: 'hash-3',
      uri: 'content://claude/message/1',
      text: 'A philosophical discussion about consciousness',
      format: 'text',
      wordCount: 5,
      sourceType: 'claude',
      sourceAdapter: 'claude',
      hierarchyLevel: 0,
      createdAt: Date.now(),
      importedAt: Date.now(),
    },
  ];

  return {
    searchByKeyword: vi.fn(async (query: string, options?: { limit?: number }) => {
      const limit = options?.limit ?? 50;
      const queryLower = query.toLowerCase();
      return nodes
        .filter(n => n.text.toLowerCase().includes(queryLower))
        .slice(0, limit)
        .map((node, i) => ({
          node,
          score: 0.9 - i * 0.1,
          bm25Score: 0.9 - i * 0.1,
        }));
    }),
    searchByEmbedding: vi.fn(async (embedding: number[], options?: { limit?: number }) => {
      const limit = options?.limit ?? 50;
      // Mock: return all nodes with fake similarity scores
      return nodes.slice(0, limit).map((node, i) => ({
        node,
        score: 0.95 - i * 0.1,
        distance: 0.05 + i * 0.1,
      }));
    }),
    getNode: vi.fn(async (id: string) => nodes.find(n => n.id === id)),
    queryNodes: vi.fn(async (options: { sourceType?: string | string[]; limit?: number }) => {
      let filtered = nodes;
      if (options.sourceType) {
        const types = Array.isArray(options.sourceType)
          ? options.sourceType
          : [options.sourceType];
        filtered = nodes.filter(n => types.includes(n.sourceType));
      }
      const limited = filtered.slice(0, options.limit ?? 50);
      return {
        nodes: limited,
        total: filtered.length,
        hasMore: limited.length < filtered.length,
      };
    }),
  };
}

describe('StorageBridge', () => {
  let store: ContentStoreInterface;
  let bridge: StorageBridge;

  beforeEach(() => {
    store = createMockStore();
    bridge = new StorageBridge({ store });
  });

  describe('search', () => {
    it('should search by keyword by default', async () => {
      const results = await bridge.search('memories');

      expect(store.searchByKeyword).toHaveBeenCalledWith('memories', { limit: 50 });
      expect(results.length).toBeGreaterThan(0);
      expect((results[0] as { text: string }).text).toContain('memories');
    });

    it('should use semantic search when configured', async () => {
      const embedFn = vi.fn(async () => [0.1, 0.2, 0.3]);
      const semanticBridge = new StorageBridge({
        store,
        embedFn,
        searchMode: 'semantic',
      });

      await semanticBridge.search('vacation');

      expect(embedFn).toHaveBeenCalledWith('vacation');
      expect(store.searchByEmbedding).toHaveBeenCalled();
    });

    it('should support semantic: prefix override', async () => {
      const embedFn = vi.fn(async () => [0.1, 0.2, 0.3]);
      const bridgeWithEmbed = new StorageBridge({ store, embedFn });

      await bridgeWithEmbed.search('semantic:vacation');

      expect(embedFn).toHaveBeenCalledWith('vacation');
      expect(store.searchByEmbedding).toHaveBeenCalled();
    });

    it('should support keyword: prefix override', async () => {
      const semanticBridge = new StorageBridge({
        store,
        searchMode: 'semantic',
      });

      await semanticBridge.search('keyword:API');

      expect(store.searchByKeyword).toHaveBeenCalledWith('API', expect.anything());
    });

    it('should fall back to keyword search when no embedding function', async () => {
      const semanticBridge = new StorageBridge({
        store,
        searchMode: 'semantic',
      });

      await semanticBridge.search('memories');

      expect(store.searchByKeyword).toHaveBeenCalled();
    });

    it('should support hybrid search', async () => {
      const embedFn = vi.fn(async () => [0.1, 0.2, 0.3]);
      const hybridBridge = new StorageBridge({
        store,
        embedFn,
        searchMode: 'hybrid',
      });

      const results = await hybridBridge.search('memories', 10);

      expect(store.searchByKeyword).toHaveBeenCalled();
      expect(store.searchByEmbedding).toHaveBeenCalled();
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should respect limit parameter', async () => {
      const results = await bridge.search('a', 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('load', () => {
    it('should load from in-memory buffer', async () => {
      await bridge.save('test', [{ id: 1 }, { id: 2 }]);
      const results = await bridge.load('test');

      expect(results).toHaveLength(2);
    });

    it('should support @ prefix for buffer names', async () => {
      await bridge.save('@mybuffer', [{ value: 'test' }]);
      const results = await bridge.load('@mybuffer');

      expect(results).toHaveLength(1);
    });

    it('should query by source type with source: prefix', async () => {
      const results = await bridge.load('source:chatgpt');

      expect(store.queryNodes).toHaveBeenCalledWith(
        expect.objectContaining({ sourceType: 'chatgpt' })
      );
      expect(results.length).toBeGreaterThan(0);
    });

    it('should query all nodes with "all"', async () => {
      const results = await bridge.load('all');

      expect(store.queryNodes).toHaveBeenCalled();
      expect(results.length).toBeGreaterThan(0);
    });

    it('should query all nodes with "*"', async () => {
      const results = await bridge.load('*');

      expect(store.queryNodes).toHaveBeenCalled();
    });

    it('should return empty array for unknown buffer', async () => {
      const results = await bridge.load('nonexistent');

      expect(results).toHaveLength(0);
    });
  });

  describe('save', () => {
    it('should save data to buffer', async () => {
      const data = [{ text: 'hello' }, { text: 'world' }];
      await bridge.save('output', data);

      const loaded = await bridge.load('output');
      expect(loaded).toEqual(data);
    });

    it('should strip @ prefix when saving', async () => {
      await bridge.save('@stripped', [{ x: 1 }]);

      expect(bridge.listBuffers()).toContain('stripped');
    });
  });

  describe('buffer management', () => {
    it('should list buffers', async () => {
      await bridge.save('a', [1]);
      await bridge.save('b', [2]);

      const buffers = bridge.listBuffers();
      expect(buffers).toContain('a');
      expect(buffers).toContain('b');
    });

    it('should clear specific buffer', async () => {
      await bridge.save('temp', [1, 2, 3]);
      bridge.clearBuffer('temp');

      const loaded = await bridge.load('temp');
      expect(loaded).toHaveLength(0);
    });

    it('should clear all buffers', async () => {
      await bridge.save('a', [1]);
      await bridge.save('b', [2]);
      bridge.clearAllBuffers();

      expect(bridge.listBuffers()).toHaveLength(0);
    });
  });
});

describe('createStorageBridge', () => {
  it('should create bridge with default options', () => {
    const store = createMockStore();
    const bridge = createStorageBridge({ store });

    expect(bridge).toBeInstanceOf(StorageBridge);
  });

  it('should create bridge with custom options', () => {
    const store = createMockStore();
    const embedFn = async () => [0.1, 0.2];
    const bridge = createStorageBridge({
      store,
      embedFn,
      defaultLimit: 100,
      semanticThreshold: 0.7,
      searchMode: 'hybrid',
    });

    expect(bridge).toBeInstanceOf(StorageBridge);
  });
});

describe('createMockStorageBridge', () => {
  it('should create a working mock bridge', async () => {
    const mockBridge = createMockStorageBridge();

    await mockBridge.save('test', [{ text: 'hello world' }]);
    const loaded = await mockBridge.load('test');

    expect(loaded).toHaveLength(1);
  });

  it('should support search in mock bridge', async () => {
    const mockBridge = createMockStorageBridge(
      new Map([['data', [{ text: 'foo bar' }, { text: 'baz qux' }]]])
    );

    const results = await mockBridge.search('bar');

    expect(results.length).toBeGreaterThan(0);
    expect((results[0] as { text: string }).text).toContain('bar');
  });

  it('should return empty for no matches', async () => {
    const mockBridge = createMockStorageBridge(
      new Map([['data', [{ text: 'foo' }]]])
    );

    const results = await mockBridge.search('xyz');

    expect(results).toHaveLength(0);
  });
});
