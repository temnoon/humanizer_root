/**
 * AI Curator Service
 * 
 * Interfaces with the backend curator API for:
 * - Content analysis and suggestions
 * - Comment evaluation
 * - Synthesis suggestions
 * - Node feed recommendations
 */

import { api } from './api';

// ===== Types =====

export interface ContentMetrics {
  clarity: number;
  depth: number;
  coherence: number;
  accessibility: number;
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
}

export interface Suggestion {
  id: string;
  type: 'clarity' | 'expansion' | 'reference' | 'style' | 'structure' | 'general';
  text: string;
  action?: string;
}

export interface AnalysisResult {
  metrics: ContentMetrics;
  suggestions: Suggestion[];
  curation: {
    summary: string;
    tags: string[];
  };
  processingTimeMs: number;
  model: string;
}

export interface CommentEvaluation {
  quality: number;
  relevance: number;
  synthesizable: boolean;
  reason: string;
  perspective?: string;
}

export interface SynthesisSuggestion {
  suggestion: string;
  reasoning: string;
  changes: string[];
  model: string;
  processingTimeMs: number;
}

export interface FeedSuggestion {
  nodeId: string;
  nodeName: string;
  reason: string;
  relevanceScore: number;
}

export interface CuratorConfig {
  personality: string;
  tone: string;
  autoSynthesis: boolean;
  synthesisThreshold: number;
  commentModeration: 'auto' | 'manual' | 'hybrid';
  feedPreferences: {
    topicsOfInterest: string[];
    excludeTopics: string[];
  };
}

export interface NodeContext {
  node: {
    id: string;
    name: string;
    description: string;
  };
  curatorConfig: CuratorConfig;
  subscriptions: Array<{
    nodeId: string;
    nodeName: string;
    nodeDescription: string;
  }>;
}

// ===== API Calls =====

/**
 * Analyze content for suggestions and metrics
 */
export async function analyzeContent(
  content: string,
  context?: { nodeType?: string; targetAudience?: string },
  token?: string
): Promise<AnalysisResult> {
  const response = await api.post<{ analysis: AnalysisResult }>(
    '/api/curator/analyze',
    { content, context },
    token
  );
  return response.analysis;
}

/**
 * Get tag suggestions for content
 */
export async function suggestTags(
  content: string,
  token?: string
): Promise<string[]> {
  const response = await api.post<{ tags: string[] }>(
    '/api/curator/suggest-tags',
    { content },
    token
  );
  return response.tags;
}

/**
 * Evaluate a comment for synthesis potential
 */
export async function evaluateComment(
  comment: string,
  narrativeContent: string,
  existingComments?: string,
  token?: string
): Promise<CommentEvaluation> {
  const response = await api.post<{ evaluation: CommentEvaluation }>(
    '/api/curator/evaluate-comment',
    { comment, narrativeContent, existingComments },
    token
  );
  return response.evaluation;
}

/**
 * Generate a curator response to a comment
 */
export async function generateCuratorResponse(
  comment: string,
  narrativeContent: string,
  existingComments?: string,
  token?: string
): Promise<{ response: string; model: string; processingTimeMs: number }> {
  return api.post(
    '/api/curator/respond',
    { comment, narrativeContent, existingComments },
    token
  );
}

/**
 * Get synthesis suggestion for comments
 */
export async function suggestSynthesis(
  narrativeId: string,
  narrativeContent: string,
  comments: Array<{ author?: string; content: string }>,
  token?: string
): Promise<SynthesisSuggestion> {
  const response = await api.post<SynthesisSuggestion>(
    '/api/curator/suggest-synthesis',
    { narrativeId, narrativeContent, comments },
    token
  );
  return response;
}

/**
 * Get node's curator context
 */
export async function getNodeContext(
  nodeId: string,
  token: string
): Promise<NodeContext> {
  return api.get(`/api/curator/node/${nodeId}/context`, token);
}

/**
 * Update node's curator config
 */
export async function updateCuratorConfig(
  nodeId: string,
  config: Partial<CuratorConfig>,
  token: string
): Promise<{ success: boolean; config: CuratorConfig }> {
  return api.put(`/api/curator/node/${nodeId}/config`, config, token);
}

/**
 * Get AI-suggested feeds for a node
 */
export async function suggestFeeds(
  nodeId: string,
  token: string
): Promise<FeedSuggestion[]> {
  const response = await api.post<{ suggestions: FeedSuggestion[] }>(
    `/api/curator/node/${nodeId}/suggest-feeds`,
    {},
    token
  );
  return response.suggestions;
}

// Export as service object
export const curatorService = {
  analyzeContent,
  suggestTags,
  evaluateComment,
  generateCuratorResponse,
  suggestSynthesis,
  getNodeContext,
  updateCuratorConfig,
  suggestFeeds,
};

// ==========================================
// CURATOR AGENT API (Active AI agent features)
// ==========================================

// Types for Curator Agent

export interface CuratorRules {
  publishing: {
    requireApproval: boolean;
    autoApproveCreator: boolean;
    minWordCount: number;
    maxWordCount: number;
    requiredElements: string[];
    acceptedTopics: string[];
    rejectedTopics: string[];
    qualityThreshold: number;
  };
  comments: {
    autoRespond: boolean;
    moderationLevel: 'strict' | 'conversational' | 'permissive';
    synthesisThreshold: number;
    synthesisQualityMin: number;
  };
  persona: {
    name: string;
    voice: string;
    expertise: string[];
    systemPrompt: string;
  };
}

export interface PrePublishResult {
  status: 'approved' | 'needs_revision' | 'rejected';
  requestId: string;
  message: string;
  canPublish: boolean;
  feedback: string;
  suggestions: string[];
  scores: {
    quality: number;
    relevance: number;
    clarity: number;
  };
}

export interface CuratorCommentResponse {
  responseId: string;
  response: string;
  responseType: 'acknowledgment' | 'clarification' | 'pushback' | 'synthesis_note' | 'rejection';
  evaluation: {
    quality: number;
    relevance: number;
    synthesizable: boolean;
    perspective: string;
  };
}

export interface SynthesisTask {
  id: string;
  status: 'pending' | 'in_progress' | 'approved' | 'applied' | 'rejected' | 'expired';
  commentCount: number;
  suggestion: string;
  reasoning: string;
  changes: string[];
  createdAt: number;
  reviewedAt?: number;
  appliedVersion?: number;
}

// ===== Curator Agent API Calls =====

/**
 * Get curator rules for a node
 */
export async function getCuratorRules(
  nodeId: string,
  token: string
): Promise<{ rules: CuratorRules; nodeName: string }> {
  return api.get(`/api/curator-agent/node/${nodeId}/rules`, token);
}

/**
 * Update curator rules for a node (owner only)
 */
export async function updateCuratorRules(
  nodeId: string,
  rules: Partial<CuratorRules>,
  token: string
): Promise<{ success: boolean; rules: CuratorRules }> {
  return api.put(`/api/curator-agent/node/${nodeId}/rules`, rules, token);
}

/**
 * Pre-publish check - evaluate content before publishing
 */
export async function prePublishCheck(
  nodeId: string,
  title: string,
  content: string,
  tags: string[],
  token: string
): Promise<PrePublishResult> {
  return api.post('/api/curator-agent/pre-publish-check', { nodeId, title, content, tags }, token);
}

/**
 * Publish an approved request
 */
export async function publishApprovedRequest(
  requestId: string,
  token: string
): Promise<{ success: boolean; narrativeId: string; slug: string }> {
  return api.post(`/api/curator-agent/publish-request/${requestId}/publish`, {}, token);
}

/**
 * Generate curator response to a comment
 */
export async function respondToComment(
  commentId: string,
  token: string
): Promise<CuratorCommentResponse> {
  return api.post(`/api/curator-agent/comment/${commentId}/respond`, {}, token);
}

/**
 * Get conversation thread for a comment
 */
export async function getCommentConversation(
  commentId: string
): Promise<{
  comment: { id: string; content: string; status: string; createdAt: number };
  curatorResponse: { response: string; type: string; respondedAt: number } | null;
  evaluation: CommentEvaluation | null;
}> {
  return api.get(`/api/curator-agent/comment/${commentId}/conversation`);
}

/**
 * Compile synthesis from approved comments
 */
export async function compileSynthesis(
  narrativeId: string,
  token: string
): Promise<{
  taskId: string;
  commentCount: number;
  suggestion: string;
  reasoning: string;
  changes: string[];
}> {
  return api.post(`/api/curator-agent/narrative/${narrativeId}/compile-synthesis`, {}, token);
}

/**
 * List synthesis tasks for a narrative
 */
export async function listSynthesisTasks(
  narrativeId: string,
  token: string
): Promise<{ tasks: SynthesisTask[] }> {
  return api.get(`/api/curator-agent/narrative/${narrativeId}/synthesis-tasks`, token);
}

/**
 * Apply a synthesis task (create new version)
 */
export async function applySynthesis(
  taskId: string,
  customContent?: string,
  token?: string
): Promise<{ success: boolean; newVersion: number; synthesizedComments: number }> {
  return api.post(`/api/curator-agent/synthesis/${taskId}/apply`, { customContent }, token);
}

/**
 * Reject a synthesis task
 */
export async function rejectSynthesis(
  taskId: string,
  reason: string,
  token: string
): Promise<{ success: boolean }> {
  return api.post(`/api/curator-agent/synthesis/${taskId}/reject`, { reason }, token);
}

// Export curator agent service
export const curatorAgentService = {
  getCuratorRules,
  updateCuratorRules,
  prePublishCheck,
  publishApprovedRequest,
  respondToComment,
  getCommentConversation,
  compileSynthesis,
  listSynthesisTasks,
  applySynthesis,
  rejectSynthesis,
};
