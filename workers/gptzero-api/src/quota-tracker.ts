/**
 * Quota Tracker for GPTZero API
 *
 * Tracks word usage per user per month using KV storage.
 * Key format: usage:<userId>:<YYYY-MM>
 * Value: { used: number, limit: number, resetDate: string }
 */

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  resetDate: string;
  percentUsed: number;
}

export interface QuotaRecord {
  used: number;
  limit: number;
  resetDate: string;
}

export class QuotaTracker {
  constructor(private kv: KVNamespace) {}

  /**
   * Get current quota info for a user
   */
  async getQuota(userId: string, defaultLimit: number = 50000): Promise<QuotaInfo> {
    const key = this.getQuotaKey(userId);
    const record = await this.kv.get<QuotaRecord>(key, 'json');

    if (!record) {
      // First use this month - initialize quota
      const resetDate = this.getNextResetDate();
      const newRecord: QuotaRecord = {
        used: 0,
        limit: defaultLimit,
        resetDate,
      };
      await this.kv.put(key, JSON.stringify(newRecord), {
        expirationTtl: this.getSecondsUntilReset(),
      });

      return {
        used: 0,
        limit: defaultLimit,
        remaining: defaultLimit,
        resetDate,
        percentUsed: 0,
      };
    }

    // Check if we've passed the reset date
    const now = new Date();
    const reset = new Date(record.resetDate);

    if (now >= reset) {
      // Reset quota for new month
      const newResetDate = this.getNextResetDate();
      const newRecord: QuotaRecord = {
        used: 0,
        limit: record.limit,
        resetDate: newResetDate,
      };
      await this.kv.put(key, JSON.stringify(newRecord), {
        expirationTtl: this.getSecondsUntilReset(),
      });

      return {
        used: 0,
        limit: record.limit,
        remaining: record.limit,
        resetDate: newResetDate,
        percentUsed: 0,
      };
    }

    // Return current quota
    const remaining = Math.max(0, record.limit - record.used);
    const percentUsed = (record.used / record.limit) * 100;

    return {
      used: record.used,
      limit: record.limit,
      remaining,
      resetDate: record.resetDate,
      percentUsed,
    };
  }

  /**
   * Check if user has enough quota for a request
   */
  async hasQuota(userId: string, wordsNeeded: number, defaultLimit: number = 50000): Promise<boolean> {
    const quota = await this.getQuota(userId, defaultLimit);
    return quota.remaining >= wordsNeeded;
  }

  /**
   * Consume quota (increment usage)
   */
  async consumeQuota(userId: string, words: number, defaultLimit: number = 50000): Promise<QuotaInfo> {
    const key = this.getQuotaKey(userId);
    const current = await this.getQuota(userId, defaultLimit);

    const newUsed = current.used + words;
    const newRecord: QuotaRecord = {
      used: newUsed,
      limit: current.limit,
      resetDate: current.resetDate,
    };

    await this.kv.put(key, JSON.stringify(newRecord), {
      expirationTtl: this.getSecondsUntilReset(),
    });

    const remaining = Math.max(0, current.limit - newUsed);
    const percentUsed = (newUsed / current.limit) * 100;

    return {
      used: newUsed,
      limit: current.limit,
      remaining,
      resetDate: current.resetDate,
      percentUsed,
    };
  }

  /**
   * Set custom quota limit for a user
   */
  async setQuotaLimit(userId: string, newLimit: number): Promise<void> {
    const key = this.getQuotaKey(userId);
    const current = await this.kv.get<QuotaRecord>(key, 'json');

    const record: QuotaRecord = current
      ? { ...current, limit: newLimit }
      : {
          used: 0,
          limit: newLimit,
          resetDate: this.getNextResetDate(),
        };

    await this.kv.put(key, JSON.stringify(record), {
      expirationTtl: this.getSecondsUntilReset(),
    });
  }

  /**
   * Generate KV key for user's current month
   */
  private getQuotaKey(userId: string): string {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `usage:${userId}:${month}`;
  }

  /**
   * Calculate the reset date (first day of next month)
   */
  private getNextResetDate(): string {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString();
  }

  /**
   * Calculate seconds until quota reset
   */
  private getSecondsUntilReset(): number {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diff = nextMonth.getTime() - now.getTime();
    return Math.floor(diff / 1000);
  }
}
