// ============================================================
// CORE TYPES FOR NARRATIVE STUDIO
// ============================================================

export interface Narrative {
  id: string;
  title: string;
  content: string; // Markdown source
  metadata: NarrativeMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface NarrativeMetadata {
  source?: string; // e.g., "ChatGPT", "Claude", "Manual"
  date?: string;
  wordCount?: number;
  tags?: string[];
  author?: string;
  [key: string]: unknown; // Allow additional metadata
}

export interface TransformConfig {
  type: TransformationType;
  parameters: TransformParameters;
}

export type TransformationType =
  | 'computer-humanizer'
  | 'allegorical'
  | 'persona'
  | 'namespace'
  | 'style'
  | 'ai-detection';

export interface TransformParameters {
  // Computer Humanizer parameters
  intensity?: 'light' | 'moderate' | 'aggressive';
  voiceProfile?: string;
  useLLM?: boolean;

  // Allegorical transformation parameters
  persona?: string;
  namespace?: string;
  style?: string;

  // AI Detection parameters
  threshold?: number;
  detectorType?: 'lite' | 'gptzero';
  useLLMJudge?: boolean; // For Lite detector LLM meta-judge

  // Generic parameters for extensibility
  [key: string]: unknown;
}

export interface TransformResult {
  transformation_id: string;
  original: string;
  transformed: string;
  reflection?: string;
  metadata?: TransformMetadata;
}

export interface TransformMetadata {
  // Computer Humanizer metrics
  aiConfidenceBefore?: number;
  aiConfidenceAfter?: number;
  burstinessBefore?: number;
  burstinessAfter?: number;
  tellWordsRemoved?: number;
  usedLLM?: boolean;

  // Human-in-the-loop features
  manualReviewSuggestions?: Array<{
    phrase: string;
    reason: string;
    severity: 'high' | 'medium' | 'low';
    suggestion: string;
  }>;
  userGuidance?: Array<{
    type: 'success' | 'good' | 'warning' | 'tip' | 'action' | 'insight';
    message: string;
  }>;

  // AI Detection results
  aiDetection?: {
    confidence: number;
    verdict: 'human' | 'ai' | 'mixed';
    tellWords: Array<{
      word: string;
      category: string;
      count: number;
      weight: number;
    }>;
    burstiness: number;
    perplexity: number;
    reasoning: string;
    method?: 'lite' | 'gptzero'; // Which detector was used
    // GPTZero Premium fields:
    highlightedSentences?: string[]; // AI-flagged sentences
    paraphrasedProbability?: number; // Average paraphrased detection probability
    confidenceCategory?: string; // "low" | "medium" | "high"
    subclassType?: string; // "pure_ai" | "ai_paraphrased"
    paragraphScores?: Array<{
      start_sentence_index: number;
      num_sentences: number;
      completely_generated_prob: number;
    }>;
    modelVersion?: string; // GPTZero model version
    processingTimeMs?: number; // Processing time
  };

  // Transformation stages (different for each transformation type)
  stages?: {
    // Allegorical transformation stages
    deconstruct?: string;
    map?: string;
    reconstruct?: string;
    stylize?: string;

    // Computer Humanizer stages
    original?: string;
    tellWordsRemoved?: string;
    burstinessEnhanced?: string;
    llmPolished?: string;

    // Allow other stage types
    [key: string]: string | undefined;
  };

  // Generic metadata for extensibility
  [key: string]: unknown;
}

export interface APIError {
  message: string;
  status: number;
  details?: unknown;
}

export type ViewMode = 'rendered' | 'markdown';
export type WorkspaceMode = 'single' | 'split';
export type Theme = 'light' | 'dark';

export interface AppState {
  currentNarrativeId: string | null;
  narratives: Narrative[];
  transformResults: Map<string, TransformResult>;
  archivePanelOpen: boolean;
  toolsPanelOpen: boolean;
  workspaceMode: WorkspaceMode;
  originalViewMode: ViewMode;
  transformedViewMode: ViewMode;
}

// ============================================================
// CONVERSATION ARCHIVE TYPES
// ============================================================

export interface ConversationMetadata {
  id: string;
  title: string;
  folder: string;
  message_count: number;
  created_at?: number;
  updated_at?: number;
  tags?: string[]; // Auto-generated tags
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: number;
  tags?: string[]; // Auto-generated message-level tags
}

export interface Conversation {
  id: string;
  title: string;
  folder: string;
  messages: Message[];
  created_at?: number;
  updated_at?: number;
  tags?: string[]; // Auto-generated conversation-level tags
}

export interface GalleryImage {
  url: string;
  filename: string;
  conversationFolder: string;
  conversationTitle: string;
  conversationCreatedAt: number | null;
  messageIndex: number;
  width?: number;
  height?: number;
  sizeBytes?: number;
}

export interface GalleryResponse {
  images: GalleryImage[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface AutoTags {
  // Time-based tags
  year?: string;
  month?: string;
  recency?: 'recent' | 'archive';

  // Length-based tags
  length?: 'brief' | 'medium' | 'extended' | 'deep-dive';

  // Content-based tags
  hasCode?: boolean;
  hasImages?: boolean;
  category?: string; // 'technical', 'creative', etc.
}
