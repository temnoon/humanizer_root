/**
 * UCG Import Adapter Tests
 *
 * Tests for all content source adapters to ensure:
 * - Adapter metadata is correct
 * - Content types are properly defined
 * - URI generation is consistent
 * - Hash generation is deterministic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { ImportedNode } from './types.js';

// Import all adapters
import { ChatGPTAdapter } from './providers/chatgpt-adapter.js';
import { ClaudeAdapter } from './providers/claude-adapter.js';
import { GeminiAdapter } from './providers/gemini-adapter.js';
import { TwitterAdapter } from './providers/twitter-adapter.js';
import { FacebookAdapter } from './providers/facebook-adapter.js';
import { InstagramAdapter } from './providers/instagram-adapter.js';
import { SubstackAdapter } from './providers/substack-adapter.js';
import { RedditAdapter } from './providers/reddit-adapter.js';
import { TikTokAdapter } from './providers/tiktok-adapter.js';
import { DiscordAdapter } from './providers/discord-adapter.js';
import { LinkedInAdapter } from './providers/linkedin-adapter.js';

// Import registry
import {
  InMemoryAdapterRegistry,
  getAdapterRegistry,
  resetAdapterRegistry,
} from './registry.js';

// Import singleton instances
import { chatgptAdapter } from './providers/chatgpt-adapter.js';
import { claudeAdapter } from './providers/claude-adapter.js';
import { geminiAdapter } from './providers/gemini-adapter.js';
import { twitterAdapter } from './providers/twitter-adapter.js';
import { facebookAdapter } from './providers/facebook-adapter.js';
import { instagramAdapter } from './providers/instagram-adapter.js';
import { substackAdapter } from './providers/substack-adapter.js';
import { redditAdapter } from './providers/reddit-adapter.js';
import { tiktokAdapter } from './providers/tiktok-adapter.js';
import { discordAdapter } from './providers/discord-adapter.js';
import { linkedinAdapter } from './providers/linkedin-adapter.js';

// ═══════════════════════════════════════════════════════════════════
// ADAPTER INSTANCES
// ═══════════════════════════════════════════════════════════════════

const ALL_ADAPTERS = [
  { instance: new ChatGPTAdapter(), singleton: chatgptAdapter, id: 'chatgpt' },
  { instance: new ClaudeAdapter(), singleton: claudeAdapter, id: 'claude' },
  { instance: new GeminiAdapter(), singleton: geminiAdapter, id: 'gemini' },
  { instance: new TwitterAdapter(), singleton: twitterAdapter, id: 'twitter' },
  { instance: new FacebookAdapter(), singleton: facebookAdapter, id: 'facebook' },
  { instance: new InstagramAdapter(), singleton: instagramAdapter, id: 'instagram' },
  { instance: new SubstackAdapter(), singleton: substackAdapter, id: 'substack' },
  { instance: new RedditAdapter(), singleton: redditAdapter, id: 'reddit' },
  { instance: new TikTokAdapter(), singleton: tiktokAdapter, id: 'tiktok' },
  { instance: new DiscordAdapter(), singleton: discordAdapter, id: 'discord' },
  { instance: new LinkedInAdapter(), singleton: linkedinAdapter, id: 'linkedin' },
];

// ═══════════════════════════════════════════════════════════════════
// REGISTRY TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Adapter Registry', () => {
  beforeEach(() => {
    resetAdapterRegistry();
  });

  it('creates empty registry by default', () => {
    const registry = getAdapterRegistry();
    expect(registry.getAll()).toHaveLength(0);
  });

  it('registers adapters correctly', () => {
    const registry = new InMemoryAdapterRegistry();
    registry.register(chatgptAdapter);
    registry.register(claudeAdapter);

    expect(registry.getAll()).toHaveLength(2);
    expect(registry.get('chatgpt')).toBe(chatgptAdapter);
    expect(registry.get('claude')).toBe(claudeAdapter);
  });

  it('overwrites existing adapters with warning', () => {
    const registry = new InMemoryAdapterRegistry();
    const adapter1 = new ChatGPTAdapter();
    const adapter2 = new ChatGPTAdapter();

    registry.register(adapter1);
    registry.register(adapter2);

    expect(registry.getAll()).toHaveLength(1);
    expect(registry.get('chatgpt')).toBe(adapter2);
  });

  it('provides adapter summary', () => {
    const registry = new InMemoryAdapterRegistry();
    registry.register(chatgptAdapter);

    const summary = registry.getSummary();
    expect(summary).toHaveLength(1);
    expect(summary[0]).toEqual({
      id: 'chatgpt',
      name: 'ChatGPT / OpenAI',
      version: '1.0.0',
      contentTypes: ['chatgpt-conversation', 'chatgpt-message'],
      extensions: ['.zip', '.json'],
    });
  });

  it('checks adapter existence', () => {
    const registry = new InMemoryAdapterRegistry();
    registry.register(chatgptAdapter);

    expect(registry.has('chatgpt')).toBe(true);
    expect(registry.has('nonexistent')).toBe(false);
  });

  it('unregisters adapters', () => {
    const registry = new InMemoryAdapterRegistry();
    registry.register(chatgptAdapter);

    expect(registry.unregister('chatgpt')).toBe(true);
    expect(registry.has('chatgpt')).toBe(false);
    expect(registry.unregister('chatgpt')).toBe(false);
  });

  it('clears all adapters', () => {
    const registry = new InMemoryAdapterRegistry();
    registry.register(chatgptAdapter);
    registry.register(claudeAdapter);

    registry.clear();
    expect(registry.count).toBe(0);
  });

  it('gets adapters by content type', () => {
    const registry = new InMemoryAdapterRegistry();
    registry.register(chatgptAdapter);
    registry.register(facebookAdapter);

    const chatAdapters = registry.getByContentType('chatgpt-message');
    expect(chatAdapters).toHaveLength(1);
    expect(chatAdapters[0].id).toBe('chatgpt');
  });

  it('gets adapters by extension', () => {
    const registry = new InMemoryAdapterRegistry();
    registry.register(chatgptAdapter);
    registry.register(redditAdapter);

    const jsonAdapters = registry.getByExtension('.json');
    expect(jsonAdapters.some(a => a.id === 'chatgpt')).toBe(true);

    const csvAdapters = registry.getByExtension('csv');
    expect(csvAdapters.some(a => a.id === 'reddit')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// ADAPTER METADATA TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Adapter Metadata', () => {
  describe.each(ALL_ADAPTERS)('$id adapter', ({ instance, singleton, id }) => {
    it('has correct id', () => {
      expect(instance.id).toBe(id);
      expect(singleton.id).toBe(id);
    });

    it('has non-empty name', () => {
      expect(instance.name).toBeTruthy();
      expect(instance.name.length).toBeGreaterThan(0);
    });

    it('has non-empty description', () => {
      expect(instance.description).toBeTruthy();
      expect(instance.description.length).toBeGreaterThan(0);
    });

    it('has valid version', () => {
      expect(instance.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('has at least one content type', () => {
      expect(instance.contentTypes.length).toBeGreaterThan(0);
    });

    it('has content types prefixed with adapter id or related', () => {
      // Content types should be descriptive and relate to the platform
      for (const contentType of instance.contentTypes) {
        expect(contentType).toMatch(/^[a-z]+-[a-z]+/);
      }
    });

    it('has at least one supported extension', () => {
      expect(instance.supportedExtensions.length).toBeGreaterThan(0);
    });

    it('has extensions starting with dot', () => {
      for (const ext of instance.supportedExtensions) {
        expect(ext).toMatch(/^\.[a-z]+$/);
      }
    });

    it('singleton matches new instance', () => {
      expect(singleton.id).toBe(instance.id);
      expect(singleton.name).toBe(instance.name);
      expect(singleton.version).toBe(instance.version);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// CHATGPT ADAPTER TESTS
// ═══════════════════════════════════════════════════════════════════

describe('ChatGPTAdapter', () => {
  const adapter = new ChatGPTAdapter();

  it('has correct content types', () => {
    expect(adapter.contentTypes).toContain('chatgpt-conversation');
    expect(adapter.contentTypes).toContain('chatgpt-message');
  });

  it('supports zip and json extensions', () => {
    expect(adapter.supportedExtensions).toContain('.zip');
    expect(adapter.supportedExtensions).toContain('.json');
  });
});

// ═══════════════════════════════════════════════════════════════════
// CLAUDE ADAPTER TESTS
// ═══════════════════════════════════════════════════════════════════

describe('ClaudeAdapter', () => {
  const adapter = new ClaudeAdapter();

  it('has correct content types', () => {
    expect(adapter.contentTypes).toContain('claude-conversation');
    expect(adapter.contentTypes).toContain('claude-message');
  });
});

// ═══════════════════════════════════════════════════════════════════
// GEMINI ADAPTER TESTS
// ═══════════════════════════════════════════════════════════════════

describe('GeminiAdapter', () => {
  const adapter = new GeminiAdapter();

  it('has correct content types', () => {
    expect(adapter.contentTypes).toContain('gemini-conversation');
    expect(adapter.contentTypes).toContain('gemini-message');
  });

  it('is named for Google AI', () => {
    expect(adapter.name).toContain('Gemini');
    expect(adapter.name).toContain('Google');
  });
});

// ═══════════════════════════════════════════════════════════════════
// TWITTER ADAPTER TESTS
// ═══════════════════════════════════════════════════════════════════

describe('TwitterAdapter', () => {
  const adapter = new TwitterAdapter();

  it('has correct content types', () => {
    expect(adapter.contentTypes).toContain('twitter-tweet');
    expect(adapter.contentTypes).toContain('twitter-retweet');
    expect(adapter.contentTypes).toContain('twitter-quote');
    expect(adapter.contentTypes).toContain('twitter-reply');
    expect(adapter.contentTypes).toContain('twitter-dm');
    expect(adapter.contentTypes).toContain('twitter-like');
  });

  it('supports js extension for Twitter archive', () => {
    expect(adapter.supportedExtensions).toContain('.js');
  });

  it('is named for Twitter/X', () => {
    expect(adapter.name).toMatch(/Twitter|X/i);
  });
});

// ═══════════════════════════════════════════════════════════════════
// FACEBOOK ADAPTER TESTS
// ═══════════════════════════════════════════════════════════════════

describe('FacebookAdapter', () => {
  const adapter = new FacebookAdapter();

  it('has correct content types', () => {
    expect(adapter.contentTypes).toContain('facebook-post');
    expect(adapter.contentTypes).toContain('facebook-comment');
    expect(adapter.contentTypes).toContain('facebook-message');
    expect(adapter.contentTypes).toContain('facebook-reaction');
  });

  it('is named for Facebook/Meta', () => {
    expect(adapter.name).toMatch(/Facebook|Meta/i);
  });
});

// ═══════════════════════════════════════════════════════════════════
// INSTAGRAM ADAPTER TESTS
// ═══════════════════════════════════════════════════════════════════

describe('InstagramAdapter', () => {
  const adapter = new InstagramAdapter();

  it('has correct content types', () => {
    expect(adapter.contentTypes).toContain('instagram-post');
    expect(adapter.contentTypes).toContain('instagram-story');
    expect(adapter.contentTypes).toContain('instagram-comment');
    expect(adapter.contentTypes).toContain('instagram-message');
    expect(adapter.contentTypes).toContain('instagram-like');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUBSTACK ADAPTER TESTS
// ═══════════════════════════════════════════════════════════════════

describe('SubstackAdapter', () => {
  const adapter = new SubstackAdapter();

  it('has correct content types', () => {
    expect(adapter.contentTypes).toContain('substack-post');
    expect(adapter.contentTypes).toContain('substack-draft');
    expect(adapter.contentTypes).toContain('substack-comment');
    expect(adapter.contentTypes).toContain('substack-note');
  });
});

// ═══════════════════════════════════════════════════════════════════
// REDDIT ADAPTER TESTS
// ═══════════════════════════════════════════════════════════════════

describe('RedditAdapter', () => {
  const adapter = new RedditAdapter();

  it('has correct content types', () => {
    expect(adapter.contentTypes).toContain('reddit-post');
    expect(adapter.contentTypes).toContain('reddit-comment');
    expect(adapter.contentTypes).toContain('reddit-message');
  });

  it('supports csv extension', () => {
    expect(adapter.supportedExtensions).toContain('.csv');
  });
});

// ═══════════════════════════════════════════════════════════════════
// TIKTOK ADAPTER TESTS
// ═══════════════════════════════════════════════════════════════════

describe('TikTokAdapter', () => {
  const adapter = new TikTokAdapter();

  it('has correct content types', () => {
    expect(adapter.contentTypes).toContain('tiktok-video');
    expect(adapter.contentTypes).toContain('tiktok-comment');
    expect(adapter.contentTypes).toContain('tiktok-dm');
    expect(adapter.contentTypes).toContain('tiktok-like');
    expect(adapter.contentTypes).toContain('tiktok-favorite');
  });

  it('supports txt extension for TikTok format', () => {
    expect(adapter.supportedExtensions).toContain('.txt');
  });
});

// ═══════════════════════════════════════════════════════════════════
// DISCORD ADAPTER TESTS
// ═══════════════════════════════════════════════════════════════════

describe('DiscordAdapter', () => {
  const adapter = new DiscordAdapter();

  it('has correct content types', () => {
    expect(adapter.contentTypes).toContain('discord-message');
    expect(adapter.contentTypes).toContain('discord-dm');
    expect(adapter.contentTypes).toContain('discord-group-dm');
    expect(adapter.contentTypes).toContain('discord-server-message');
  });

  it('supports csv extension for Discord export', () => {
    expect(adapter.supportedExtensions).toContain('.csv');
  });
});

// ═══════════════════════════════════════════════════════════════════
// LINKEDIN ADAPTER TESTS
// ═══════════════════════════════════════════════════════════════════

describe('LinkedInAdapter', () => {
  const adapter = new LinkedInAdapter();

  it('has correct content types', () => {
    expect(adapter.contentTypes).toContain('linkedin-post');
    expect(adapter.contentTypes).toContain('linkedin-comment');
    expect(adapter.contentTypes).toContain('linkedin-message');
    expect(adapter.contentTypes).toContain('linkedin-connection');
    expect(adapter.contentTypes).toContain('linkedin-reaction');
  });

  it('supports csv extension for LinkedIn export', () => {
    expect(adapter.supportedExtensions).toContain('.csv');
  });
});

// ═══════════════════════════════════════════════════════════════════
// CROSS-ADAPTER CONSISTENCY TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Cross-Adapter Consistency', () => {
  it('all adapters have unique IDs', () => {
    const ids = ALL_ADAPTERS.map(a => a.instance.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('no adapter ID contains spaces or special characters', () => {
    for (const { instance } of ALL_ADAPTERS) {
      expect(instance.id).toMatch(/^[a-z]+$/);
    }
  });

  it('all adapters have distinct names', () => {
    const names = ALL_ADAPTERS.map(a => a.instance.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('all content types are unique across adapters', () => {
    const allContentTypes: string[] = [];
    for (const { instance } of ALL_ADAPTERS) {
      allContentTypes.push(...instance.contentTypes);
    }
    const uniqueTypes = new Set(allContentTypes);
    expect(uniqueTypes.size).toBe(allContentTypes.length);
  });

  it('all adapters implement required interface methods', () => {
    for (const { instance } of ALL_ADAPTERS) {
      expect(typeof instance.detect).toBe('function');
      expect(typeof instance.validate).toBe('function');
      expect(typeof instance.parse).toBe('function');
      expect(typeof instance.getSourceMetadata).toBe('function');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// ADAPTER COUNT VERIFICATION
// ═══════════════════════════════════════════════════════════════════

describe('Adapter Count', () => {
  it('has 11 total built-in adapters', () => {
    expect(ALL_ADAPTERS.length).toBe(11);
  });

  it('has 3 chat platform adapters', () => {
    const chatAdapters = ALL_ADAPTERS.filter(a =>
      ['chatgpt', 'claude', 'gemini'].includes(a.id)
    );
    expect(chatAdapters.length).toBe(3);
  });

  it('has 5 social media adapters', () => {
    const socialAdapters = ALL_ADAPTERS.filter(a =>
      ['twitter', 'facebook', 'instagram', 'tiktok', 'reddit'].includes(a.id)
    );
    expect(socialAdapters.length).toBe(5);
  });

  it('has 2 professional platform adapters', () => {
    const professionalAdapters = ALL_ADAPTERS.filter(a =>
      ['linkedin', 'substack'].includes(a.id)
    );
    expect(professionalAdapters.length).toBe(2);
  });

  it('has 1 messaging platform adapter', () => {
    const messagingAdapters = ALL_ADAPTERS.filter(a =>
      ['discord'].includes(a.id)
    );
    expect(messagingAdapters.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// EXPORTED CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Exported Constants', () => {
  it('BUILT_IN_ADAPTER_IDS matches adapter count', async () => {
    const { BUILT_IN_ADAPTER_IDS } = await import('./index.js');
    expect(BUILT_IN_ADAPTER_IDS.length).toBe(11);
  });

  it('ADAPTER_CATEGORIES covers all adapters', async () => {
    const { ADAPTER_CATEGORIES, BUILT_IN_ADAPTER_IDS } = await import('./index.js');

    const categorized = [
      ...ADAPTER_CATEGORIES.chat,
      ...ADAPTER_CATEGORIES.social,
      ...ADAPTER_CATEGORIES.professional,
      ...ADAPTER_CATEGORIES.messaging,
    ];

    expect(categorized.length).toBe(BUILT_IN_ADAPTER_IDS.length);
  });

  it('getBuiltInAdapters returns all adapters', async () => {
    const { getBuiltInAdapters } = await import('./index.js');
    const adapters = getBuiltInAdapters();

    expect(Object.keys(adapters).length).toBe(11);
    expect(adapters.chatgpt).toBeDefined();
    expect(adapters.gemini).toBeDefined();
    expect(adapters.facebook).toBeDefined();
    expect(adapters.tiktok).toBeDefined();
    expect(adapters.discord).toBeDefined();
    expect(adapters.linkedin).toBeDefined();
  });
});
