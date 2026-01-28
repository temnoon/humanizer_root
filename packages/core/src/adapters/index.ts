/**
 * UCG Import Adapters
 *
 * Content source adapters that import data from various platforms
 * into the Universal Content Graph (UCG) pyramid structure.
 *
 * Supported Platforms:
 * - ChatGPT/OpenAI (conversation exports)
 * - Claude/Anthropic (conversation exports)
 * - Gemini/Google (conversation exports)
 * - Twitter/X (GDPR data export)
 * - Facebook/Meta (GDPR data export)
 * - Instagram (GDPR data export)
 * - Substack (newsletter export)
 * - Reddit (GDPR data export)
 * - TikTok (GDPR data export)
 * - Discord (data export)
 * - LinkedIn (data export)
 * - Google Takeout (Chat, Keep, YouTube, Activity)
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════
export * from './types.js';

// ═══════════════════════════════════════════════════════════════════
// PARSERS - Archive Parsing Infrastructure
// ═══════════════════════════════════════════════════════════════════
// Full parser module for narrative-studio compatible archive import
export * as parsers from './parsers/index.js';

// ═══════════════════════════════════════════════════════════════════
// STORAGE (backward-compatible exports, prefer ../storage/index.js)
// ═══════════════════════════════════════════════════════════════════
export {
  ContentStoreAdapter,
  ImportService,
  getUCGStorage,
  setUCGStorage,
  resetUCGStorage,
  type UCGStorage,
  type StoredContentNode,
  type StoredContentLink,
  type ImportJob,
  type NodeQueryOptions,
  type NodeQueryResult,
} from './storage.js';

// ═══════════════════════════════════════════════════════════════════
// BASE ADAPTER
// ═══════════════════════════════════════════════════════════════════
export { BaseAdapter } from './base-adapter.js';

// ═══════════════════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════════════════
export {
  InMemoryAdapterRegistry,
  getAdapterRegistry,
  setAdapterRegistry,
  resetAdapterRegistry,
  registerAdapter,
  getAdapter,
  detectAdapter,
} from './registry.js';

// ═══════════════════════════════════════════════════════════════════
// ADAPTERS - Chat Platforms
// ═══════════════════════════════════════════════════════════════════
export { ChatGPTAdapter, chatgptAdapter } from './providers/chatgpt-adapter.js';
export { ClaudeAdapter, claudeAdapter } from './providers/claude-adapter.js';
export { GeminiAdapter, geminiAdapter } from './providers/gemini-adapter.js';

// ═══════════════════════════════════════════════════════════════════
// ADAPTERS - Social Platforms
// ═══════════════════════════════════════════════════════════════════
export { TwitterAdapter, twitterAdapter } from './providers/twitter-adapter.js';
export { FacebookAdapter, facebookAdapter } from './providers/facebook-adapter.js';
export { InstagramAdapter, instagramAdapter } from './providers/instagram-adapter.js';
export { SubstackAdapter, substackAdapter } from './providers/substack-adapter.js';
export { RedditAdapter, redditAdapter } from './providers/reddit-adapter.js';
export { TikTokAdapter, tiktokAdapter } from './providers/tiktok-adapter.js';
export { DiscordAdapter, discordAdapter } from './providers/discord-adapter.js';
export { LinkedInAdapter, linkedinAdapter } from './providers/linkedin-adapter.js';

// ═══════════════════════════════════════════════════════════════════
// ADAPTERS - Google Services
// ═══════════════════════════════════════════════════════════════════
export { GoogleTakeoutAdapter, googleTakeoutAdapter } from './providers/google-takeout-adapter.js';

// ═══════════════════════════════════════════════════════════════════
// ADAPTERS - Documents & Files
// ═══════════════════════════════════════════════════════════════════
export { MarkdownAdapter, markdownAdapter } from './providers/markdown-adapter.js';

// ═══════════════════════════════════════════════════════════════════
// DEFAULT REGISTRATION
// ═══════════════════════════════════════════════════════════════════

import { getAdapterRegistry } from './registry.js';

// Chat platforms
import { chatgptAdapter } from './providers/chatgpt-adapter.js';
import { claudeAdapter } from './providers/claude-adapter.js';
import { geminiAdapter } from './providers/gemini-adapter.js';

// Social platforms
import { twitterAdapter } from './providers/twitter-adapter.js';
import { facebookAdapter } from './providers/facebook-adapter.js';
import { instagramAdapter } from './providers/instagram-adapter.js';
import { substackAdapter } from './providers/substack-adapter.js';
import { redditAdapter } from './providers/reddit-adapter.js';
import { tiktokAdapter } from './providers/tiktok-adapter.js';
import { discordAdapter } from './providers/discord-adapter.js';
import { linkedinAdapter } from './providers/linkedin-adapter.js';

// Google Services
import { googleTakeoutAdapter } from './providers/google-takeout-adapter.js';

// Documents & Files
import { markdownAdapter } from './providers/markdown-adapter.js';

/**
 * Register all built-in adapters with the default registry
 *
 * Call this function during application initialization to make
 * all adapters available for detection and parsing.
 */
export function registerBuiltInAdapters(): void {
  const registry = getAdapterRegistry();

  // Chat platforms
  registry.register(chatgptAdapter);
  registry.register(claudeAdapter);
  registry.register(geminiAdapter);

  // Social platforms
  registry.register(twitterAdapter);
  registry.register(facebookAdapter);
  registry.register(instagramAdapter);
  registry.register(substackAdapter);
  registry.register(redditAdapter);
  registry.register(tiktokAdapter);
  registry.register(discordAdapter);
  registry.register(linkedinAdapter);

  // Google Services
  registry.register(googleTakeoutAdapter);

  // Documents & Files
  registry.register(markdownAdapter);

  console.info(`[Adapters] Registered ${registry.getAll().length} built-in adapters`);
}

/**
 * Get a map of all built-in adapters
 */
export function getBuiltInAdapters() {
  return {
    // Chat platforms
    chatgpt: chatgptAdapter,
    claude: claudeAdapter,
    gemini: geminiAdapter,
    // Social platforms
    twitter: twitterAdapter,
    facebook: facebookAdapter,
    instagram: instagramAdapter,
    substack: substackAdapter,
    reddit: redditAdapter,
    tiktok: tiktokAdapter,
    discord: discordAdapter,
    linkedin: linkedinAdapter,
    // Google Services
    'google-takeout': googleTakeoutAdapter,
    // Documents & Files
    markdown: markdownAdapter,
  } as const;
}

/**
 * List of adapter IDs that are built-in
 */
export const BUILT_IN_ADAPTER_IDS = [
  // Chat platforms
  'chatgpt',
  'claude',
  'gemini',
  // Social platforms
  'twitter',
  'facebook',
  'instagram',
  'substack',
  'reddit',
  'tiktok',
  'discord',
  'linkedin',
  // Google Services
  'google-takeout',
  // Documents & Files
  'markdown',
] as const;

export type BuiltInAdapterId = typeof BUILT_IN_ADAPTER_IDS[number];

/**
 * Adapter categories for UI organization
 */
export const ADAPTER_CATEGORIES = {
  chat: ['chatgpt', 'claude', 'gemini'] as const,
  social: ['twitter', 'facebook', 'instagram', 'tiktok', 'reddit'] as const,
  professional: ['linkedin', 'substack'] as const,
  messaging: ['discord'] as const,
  google: ['google-takeout'] as const,
  documents: ['markdown'] as const,
} as const;

export type AdapterCategory = keyof typeof ADAPTER_CATEGORIES;
