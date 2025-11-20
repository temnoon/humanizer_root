/**
 * Lite AI Detector Service
 * Client for free-tier heuristic AI detection
 */

const API_URL = 'https://npe-api.tem-527.workers.dev';

// Type definitions
export interface LiteDetectionResult {
  detector_type: 'lite';
  ai_likelihood: number; // 0-1 score
  confidence: 'low' | 'medium' | 'high';
  label: 'likely_human' | 'mixed' | 'likely_ai';
  metrics: {
    burstiness: number;
    avgSentenceLength: number;
    sentenceLengthStd: number;
    typeTokenRatio: number;
    repeatedNgrams: number;
  };
  phraseHits: Array<{
    phrase: string;
    count: number;
    weight: number;
    category: string;
  }>;
  highlights: Array<{
    start: number;
    end: number;
    reason: string;
    score: number;
  }>;
  heuristicScore: number;
  llmScore?: number;
  processingTimeMs: number;
}

export interface LiteDetectionRequest {
  text: string;
  useLLMJudge?: boolean;
}

export class LiteDetectorError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'LiteDetectorError';
    this.status = status;
  }
}

/**
 * Run Lite AI detection
 */
export async function detectWithLite(
  request: LiteDetectionRequest
): Promise<LiteDetectionResult> {
  const response = await fetch(`${API_URL}/ai-detection/lite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new LiteDetectorError(
      errorData.error || `Detection failed with status ${response.status}`,
      response.status
    );
  }

  return await response.json();
}

/**
 * Helper: Format AI likelihood as percentage
 */
export function formatAILikelihood(likelihood: number): string {
  return `${(likelihood * 100).toFixed(1)}%`;
}

/**
 * Helper: Get color for confidence level
 */
export function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case 'high':
      return 'var(--accent-green)';
    case 'medium':
      return 'var(--accent-yellow)';
    case 'low':
      return 'var(--accent-red)';
    default:
      return 'var(--text-secondary)';
  }
}

/**
 * Helper: Get label display text
 */
export function getLabelText(label: string): string {
  switch (label) {
    case 'likely_human':
      return 'Likely Human';
    case 'likely_ai':
      return 'Likely AI';
    case 'mixed':
      return 'Mixed/Uncertain';
    default:
      return label;
  }
}

/**
 * Helper: Get color for label
 */
export function getLabelColor(label: string): string {
  switch (label) {
    case 'likely_human':
      return 'var(--accent-green)';
    case 'likely_ai':
      return 'var(--accent-red)';
    case 'mixed':
      return 'var(--accent-yellow)';
    default:
      return 'var(--text-secondary)';
  }
}

/**
 * Helper: Format metric names
 */
export function formatMetricName(key: string): string {
  switch (key) {
    case 'burstiness':
      return 'Burstiness';
    case 'avgSentenceLength':
      return 'Avg Sentence Length';
    case 'sentenceLengthStd':
      return 'Sentence Length StdDev';
    case 'typeTokenRatio':
      return 'Type-Token Ratio';
    case 'repeatedNgrams':
      return 'Repeated N-grams';
    default:
      return key;
  }
}

/**
 * Helper: Get interpretation for metrics
 */
export function getMetricInterpretation(key: string, value: number): string {
  switch (key) {
    case 'burstiness':
      if (value < 20) return 'Very low (AI-like)';
      if (value < 40) return 'Low';
      if (value < 70) return 'Moderate (human-like)';
      return 'High (very human-like)';
    case 'typeTokenRatio':
      if (value < 0.3) return 'Low diversity (AI-like)';
      if (value < 0.5) return 'Moderate diversity';
      return 'High diversity (human-like)';
    case 'repeatedNgrams':
      if (value > 5) return 'Many repetitions (AI-like)';
      if (value > 2) return 'Some repetitions';
      return 'Few/no repetitions';
    default:
      return '';
  }
}
