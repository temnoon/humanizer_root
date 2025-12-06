/**
 * Result and validation type definitions
 */

/**
 * Validation result from input validation
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Highlight in analyzed text
 */
export interface Highlight {
  start: number;
  end: number;
  type: string;
  label?: string;
  score?: number;
}

/**
 * Analysis result structure
 */
export interface AnalysisResult {
  verdict?: string;
  confidence?: number;
  scores?: Record<string, number>;
  highlights?: Highlight[];
  details?: unknown;
}

/**
 * Extracted asset from extraction tools
 */
export interface ExtractedAsset {
  type: 'persona' | 'style';
  name: string;
  definition: unknown;
  saved?: boolean;
  assetId?: string;
}

/**
 * Session state for session-based tools
 */
export interface SessionState {
  sessionId: string;
  state: unknown;
  isComplete: boolean;
}

/**
 * Error details
 */
export interface ToolError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Complete tool execution result
 */
export interface ToolResult {
  success: boolean;
  toolId: string;

  // Timing
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;

  // For transformation tools
  originalText?: string;
  transformedText?: string;

  // For analysis tools
  analysis?: AnalysisResult;

  // For extraction tools
  extractedAsset?: ExtractedAsset;

  // For generation tools
  generatedContent?: string;

  // For session-based tools
  session?: SessionState;

  // Metadata
  tokensUsed?: number;
  model?: string;
  cached?: boolean;

  // Errors
  error?: ToolError;
}

/**
 * Result actions available to user
 */
export type ResultAction = 'apply' | 'copy' | 'chain' | 'discard' | 'save-asset';
