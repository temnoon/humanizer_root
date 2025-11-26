/**
 * Domain Models
 */

export interface Post {
  id: string;
  user_id: string;
  content: string;
  summary?: string;
  tags?: string[];
  visibility: 'public' | 'private' | 'unlisted';
  status: 'draft' | 'published' | 'archived';
  version: number;
  created_at: string;
  updated_at: string;
  user_email?: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_email?: string;
}

export interface PostVersion {
  id: string;
  post_id: string;
  version: number;
  content: string;
  summary?: string;
  tags?: string[];
  synthesis_model?: string;
  comment_count_at_synthesis: number;
  author_approved: boolean;
  approved_at?: string;
  created_at: string;
}

export interface SynthesisStatus {
  ready: boolean;
  commentCount: number;
  threshold: number;
  currentVersion: number;
}

export interface SearchResult extends Post {
  relevanceScore?: number;
  similarityScore?: number;
}

export interface Tag {
  name: string;
  post_count: number;
}

// ===== POST-SOCIAL NODE SYSTEM TYPES =====

export interface Node {
  id: string;
  name: string;
  slug: string;
  description?: string;
  creatorUserId: string;
  curatorConfig: {
    personality?: string;
    systemPrompt?: string;
    model?: string;
    filterCriteria?: {
      minQuality?: number;
      acceptedTopics?: string[];
      rejectedTopics?: string[];
    };
  };
  curatorRules?: {
    publishing?: {
      requireApproval?: boolean;
      autoApproveCreator?: boolean;
      minWordCount?: number;
      maxWordCount?: number;
      acceptedTopics?: string[];
      rejectedTopics?: string[];
      qualityThreshold?: number;
    };
    comments?: {
      autoRespond?: boolean;
      moderationLevel?: 'strict' | 'conversational' | 'permissive';
      synthesisThreshold?: number;
      synthesisQualityMin?: number;
    };
    persona?: {
      name?: string;
      voice?: string;
      expertise?: string[];
      systemPrompt?: string;
    };
  };
  archiveMetadata: {
    narrativeCount?: number;
    lastPublished?: string;
  };
  status: 'active' | 'archived';
  createdAt: number;
  updatedAt: number;
  narratives?: Narrative[];
}

export interface Narrative {
  id: string;
  nodeId: string;
  nodeName?: string;
  nodeSlug?: string;
  title: string;
  slug: string;
  content: string;
  currentVersion: number;
  requestedVersion?: number | null;
  metadata: {
    tags?: string[];
    wordCount?: number;
    readingTime?: number;
    lexicalSignature?: string;
  };
  synthesis: {
    status: 'none' | 'pending' | 'in_progress' | 'completed';
    lastSynthesized?: string;
    pendingComments: number;
  };
  subscriberCount: number;
  visibility: 'public' | 'node-only' | 'private';
  createdAt: number;
  updatedAt: number;
  isOwner?: boolean;
  versions?: NarrativeVersionSummary[];
}

export interface NarrativeVersion {
  id: string;
  narrativeId: string;
  version: number;
  content: string;
  changes: {
    summary?: string;
    addedLines?: number;
    removedLines?: number;
    semanticShift?: number;
  };
  trigger: {
    type: 'manual' | 'synthesis' | 'schedule';
    actor?: string;
    commentIds?: string[];
  };
  createdAt: number;
}

export interface NarrativeVersionSummary {
  id?: string;
  version: number;
  changes: {
    summary?: string;
    addedLines?: number;
    removedLines?: number;
  };
  trigger: {
    type: 'manual' | 'synthesis' | 'schedule';
    actor?: string;
  };
  createdAt: number;
}

// Curator response to a comment
export interface CuratorResponse {
  id: string;
  commentId: string;
  response: string;
  responseType: 'acknowledgment' | 'clarification' | 'pushback' | 'synthesis_note' | 'rejection';
  model: string;
  processingTimeMs: number;
  createdAt: number;
}

export interface NarrativeComment {
  id: string;
  narrativeId: string;
  version: number;
  authorUserId: string;
  authorEmail?: string;
  content: string;
  context?: {
    selectedText?: string;
    position?: number;
  };
  contextQuote?: string;  // Legacy field - selected text user was responding to
  status: 'pending' | 'approved' | 'rejected' | 'synthesized';
  curatorEvaluation?: {
    quality?: number;
    relevance?: number;
    synthesizable?: boolean;
    perspective?: string;
    evaluatedAt?: string;
  };
  // Curator response data (populated when conversation is fetched)
  curatorResponse?: {
    response: string;
    type: 'acknowledgment' | 'clarification' | 'pushback' | 'synthesis_note' | 'rejection';
    respondedAt: number;
  };
  synthesizedInVersion?: number;
  createdAt: number;
  updatedAt: number;
}

export interface NodeSubscription {
  id: string;
  userId: string;
  nodeId: string;
  nodeName?: string;
  nodeSlug?: string;
  nodeDescription?: string;
  preferences: {
    notifyNewNarrative?: boolean;
    notifyUpdates?: boolean;
    emailDigest?: 'realtime' | 'daily' | 'weekly' | 'none';
  };
  lastChecked: number;
  unreadCount: number;
  createdAt: number;
}

export interface VersionComparison {
  narrativeId: string;
  narrativeTitle: string;
  from: {
    version: number;
    content: string;
    changes: Record<string, unknown>;
    trigger: Record<string, unknown>;
    createdAt: number;
  };
  to: {
    version: number;
    content: string;
    changes: Record<string, unknown>;
    trigger: Record<string, unknown>;
    createdAt: number;
  };
  diff: DiffResult | string | SideBySideLine[];
  format: 'structured' | 'unified' | 'side-by-side';
  stats: {
    semanticShift: number;
    addedLines?: number;
    removedLines?: number;
    similarity?: number;
  };
}

export interface DiffResult {
  lines: DiffLine[];
  addedLines: number;
  removedLines: number;
  unchangedLines: number;
  similarity: number;
}

export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineNumber?: number;
}

export interface SideBySideLine {
  left: {
    lineNumber: number | null;
    content: string;
    type: 'unchanged' | 'removed' | 'empty';
  };
  right: {
    lineNumber: number | null;
    content: string;
    type: 'unchanged' | 'added' | 'empty';
  };
}
