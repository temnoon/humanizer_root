/**
 * GPTZero Service
 *
 * Client for GPTZero API worker with quota tracking
 */

const GPTZERO_API_URL = import.meta.env.PROD
  ? 'https://gptzero-api.tem-527.workers.dev'
  : 'http://localhost:8787';

// Types matching backend API
export interface DetectionResult {
  detector_type: 'gptzero';
  ai_likelihood: number;
  confidence: 'low' | 'medium' | 'high';
  label: 'likely_human' | 'mixed' | 'likely_ai';
  metrics: {
    averageGeneratedProb: number;
    completelyGeneratedProb: number;
    overallBurstiness: number;
  };
  highlights: Array<{
    start: number;
    end: number;
    sentence: string;
    score: number;
    reason: string;
  }>;
  quota: QuotaInfo;
  wordsProcessed: number;
}

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  resetDate: string;
  percentUsed: number;
}

export interface DetectionRequest {
  text: string;
  userId: string;
  userTier?: 'free' | 'pro' | 'premium';
}

export class GPTZeroError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public quota?: QuotaInfo
  ) {
    super(message);
    this.name = 'GPTZeroError';
  }
}

/**
 * Run GPTZero AI detection on text
 */
export async function detectWithGPTZero(
  request: DetectionRequest
): Promise<DetectionResult> {
  try {
    const response = await fetch(`${GPTZERO_API_URL}/api/gptzero/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 429) {
        // Quota exceeded
        throw new GPTZeroError(
          'Monthly quota exceeded. Upgrade to Premium for unlimited access.',
          429,
          errorData.quota
        );
      }

      throw new GPTZeroError(
        errorData.error || `Detection failed: ${response.statusText}`,
        response.status
      );
    }

    const result: DetectionResult = await response.json();
    return result;
  } catch (error) {
    if (error instanceof GPTZeroError) {
      throw error;
    }
    throw new GPTZeroError(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
}

/**
 * Get quota information for a user
 */
export async function getQuota(
  userId: string,
  tier: 'free' | 'pro' | 'premium' = 'pro'
): Promise<QuotaInfo> {
  try {
    const response = await fetch(
      `${GPTZERO_API_URL}/api/gptzero/quota/${userId}?tier=${tier}`
    );

    if (!response.ok) {
      throw new GPTZeroError(
        `Failed to fetch quota: ${response.statusText}`,
        response.status
      );
    }

    const quota: QuotaInfo = await response.json();
    return quota;
  } catch (error) {
    if (error instanceof GPTZeroError) {
      throw error;
    }
    throw new GPTZeroError(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
}

/**
 * Check if user has enough quota for a detection
 */
export function hasEnoughQuota(quota: QuotaInfo, wordsNeeded: number): boolean {
  return quota.remaining >= wordsNeeded;
}

/**
 * Format quota for display
 */
export function formatQuota(quota: QuotaInfo): string {
  const used = quota.used.toLocaleString();
  const limit = quota.limit.toLocaleString();
  return `${used} / ${limit} words`;
}

/**
 * Format reset date for display
 */
export function formatResetDate(resetDate: string): string {
  const date = new Date(resetDate);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `${diffDays} days`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get quota status color
 */
export function getQuotaColor(percentUsed: number): string {
  if (percentUsed >= 90) return 'text-red-500';
  if (percentUsed >= 70) return 'text-yellow-500';
  return 'text-green-500';
}

/**
 * Count words in text (matches backend logic)
 */
export function countWords(text: string): number {
  const words = text.trim().split(/\s+/);
  return words.filter(w => w.length > 0).length;
}
