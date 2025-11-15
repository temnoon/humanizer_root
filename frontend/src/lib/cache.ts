/**
 * Cache utility using localStorage
 *
 * Provides TTL-based caching for expensive API calls like conversation lists.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class LocalCache {
  private readonly prefix = 'humanizer_cache_';

  /**
   * Get cached data if fresh, otherwise return null.
   */
  get<T>(key: string): T | null {
    try {
      const cacheKey = this.prefix + key;
      const item = localStorage.getItem(cacheKey);

      if (!item) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(item);
      const now = Date.now();
      const age = now - entry.timestamp;

      // Check if cache is still fresh
      if (age > entry.ttl) {
        // Expired - remove it
        this.remove(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  /**
   * Set cached data with TTL.
   */
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    try {
      const cacheKey = this.prefix + key;
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };

      localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (error) {
      console.error('Cache write error:', error);
      // Silently fail - localStorage might be full or disabled
    }
  }

  /**
   * Remove cached item.
   */
  remove(key: string): void {
    try {
      const cacheKey = this.prefix + key;
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Cache remove error:', error);
    }
  }

  /**
   * Clear all cache entries.
   */
  clearAll(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache metadata (age, size, etc.).
   */
  getMeta(key: string): { age: number; size: number } | null {
    try {
      const cacheKey = this.prefix + key;
      const item = localStorage.getItem(cacheKey);

      if (!item) {
        return null;
      }

      const entry: CacheEntry<unknown> = JSON.parse(item);
      const now = Date.now();
      const age = now - entry.timestamp;
      const size = new Blob([item]).size;

      return { age, size };
    } catch (error) {
      console.error('Cache meta error:', error);
      return null;
    }
  }

  /**
   * Check if cache exists and is fresh.
   */
  isFresh(key: string): boolean {
    try {
      const cacheKey = this.prefix + key;
      const item = localStorage.getItem(cacheKey);

      if (!item) {
        return false;
      }

      const entry: CacheEntry<unknown> = JSON.parse(item);
      const now = Date.now();
      const age = now - entry.timestamp;

      return age <= entry.ttl;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const cache = new LocalCache();

// Cache keys
export const CACHE_KEYS = {
  CONVERSATIONS_LIST: 'conversations_list',
  CHATGPT_STATS: 'chatgpt_stats',
  MEDIA_LIST: 'media_list',
};

// Cache TTLs (in milliseconds)
export const CACHE_TTL = {
  SHORT: 2 * 60 * 1000,      // 2 minutes
  MEDIUM: 5 * 60 * 1000,     // 5 minutes
  LONG: 15 * 60 * 1000,      // 15 minutes
  VERY_LONG: 60 * 60 * 1000, // 1 hour
};
