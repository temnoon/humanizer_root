/**
 * Humanizer API Client
 * Connects to the FastAPI backend with automatic AUI tracking
 */

const API_BASE_URL = '/api';

// Types
export interface ChatGPTStats {
  total_conversations: number;
  total_messages: number;
  total_media: number;
  archives: string[];
  date_range: {
    earliest: string;
    latest: string;
  };
}

export interface ChatGPTIngestRequest {
  home_dir: string;
  archive_pattern?: string;
  force_reimport?: boolean;
}

export interface ChatGPTIngestResponse {
  archives_found: number;
  conversations_processed: number;
  messages_imported: number;
  media_files_found: number;
  media_files_matched: number;
  errors: string[];
  processing_time_seconds: number;
}

export interface ClaudeIngestRequest {
  archive_path: string;
  force_reimport?: boolean;
  import_projects?: boolean;
}

export interface ClaudeIngestResponse {
  archives_found: number;
  conversations_processed: number;
  conversations_new: number;
  conversations_updated: number;
  messages_imported: number;
  projects_imported: number;
  media_files_found: number;
  media_files_matched: number;
  errors: string[];
  processing_time_seconds: number;
}

export interface ClaudeStats {
  total_conversations: number;
  total_messages: number;
  total_media: number;
  total_projects: number;
  archives: Array<{
    name: string;
    conversations: number;
    messages: number;
  }>;
  date_range: {
    earliest: string;
    latest: string;
  } | null;
  top_conversations: Array<{
    uuid: string;
    name: string;
    message_count: number;
  }>;
}

export interface ConversationListItem {
  uuid: string;
  title: string | null;
  created_at: string | null;
  updated_at: string | null;
  source_archive: string;
  message_count: number;
  media_count: number;
}

export interface ConversationSearchResult {
  uuid: string;
  conversation_uuid: string;
  created_at: string;
  author_role: string;
  content_text: string;
}

// Unified Conversations
export interface UnifiedConversationItem {
  uuid: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
  source: 'chatgpt' | 'claude';  // Source identifier
  source_archive: string;
  message_count: number;
  media_count: number;
  metadata: any;
  // Claude-specific fields (optional)
  summary?: string;
  project_uuid?: string;
}

export interface UnifiedConversationListResponse {
  conversations: UnifiedConversationItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface UnifiedConversationDetail {
  uuid: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
  source: 'chatgpt' | 'claude';
  source_archive: string;
  metadata: any;
  messages: Array<{
    uuid: string;
    created_at: string;
    role: string;
    text: string;
    content?: any;  // ChatGPT content_parts
    content_blocks?: any;  // Claude content_blocks
  }>;
  media: any[];
  summary?: string;
  project_uuid?: string;
}

export interface UnifiedSearchRequest {
  query: string;
  source?: 'chatgpt' | 'claude';
  limit?: number;
}

export interface UnifiedSearchResult {
  message_uuid: string;
  conversation_uuid: string;
  conversation_title: string;
  created_at: string;
  role: string;
  text: string;
  source: 'chatgpt' | 'claude';
}

export interface UnifiedSearchResponse {
  results: UnifiedSearchResult[];
  count: number;
  query: string;
}

export interface UnifiedConversationStats {
  total_conversations: number;
  total_messages: number;
  by_source: {
    chatgpt: {
      conversations: number;
      messages: number;
    };
    claude: {
      conversations: number;
      messages: number;
    };
  };
}

export interface MediaItem {
  file_id: string;
  file_path?: string;
  filename?: string;
  content_type?: string;
  size_bytes?: number;
  width?: number;
  height?: number;
  source_archive?: string;
  conversation_uuid?: string;
  created_at?: string;  // May not exist for all sources
}

export interface RenderConfig {
  include_media?: boolean;
  pagination?: boolean;
  messages_per_page?: number;
  filter_empty_messages?: boolean;
}

export interface ConversationRender {
  conversation_uuid: string;
  title: string;
  total_messages: number;
  total_pages: number;
  current_page: number;
  markdown: string;
  media_refs: any[];
}

// Document types
export interface DocumentListItem {
  id: string;
  filename: string;
  file_path: string;
  file_type: string;
  file_size: number;
  mime_type: string | null;
  title: string | null;
  author: string | null;
  created_at: string;
  ingested_at: string;
  source_directory: string | null;
  embedding_status: string;
  chunk_count: number;
  media_count: number;
}

export interface DocumentListResponse {
  documents: DocumentListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface IngestionBatch {
  id: string;
  source_directory: string;
  batch_type: string;
  storage_strategy: string;
  total_files: number;
  successful: number;
  failed: number;
  skipped: number;
  started_at: string;
  completed_at: string | null;
  processing_time_ms: number | null;
  errors: string[];
}

export interface BatchListResponse {
  batches: IngestionBatch[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DocumentSearchRequest {
  query: string;
  semantic?: boolean;
  file_types?: string[];
  limit?: number;
}

export interface DocumentSearchResult {
  document_id: string;
  document_title: string;
  document_filename: string;
  chunk_id?: string;
  chunk_text?: string;
  chunk_index?: number;
  page_number?: number | null;
  score: number;
  highlight?: string;
}

export interface DocumentSearchResponse {
  results: DocumentSearchResult[];
  total: number;
  query: string;
  processing_time_ms: number;
}

// API Client
class HumanizerAPIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    // Handle 204 No Content responses (e.g., DELETE)
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ChatGPT Archive endpoints
  async getStats(): Promise<ChatGPTStats> {
    return this.request<ChatGPTStats>('/chatgpt/stats');
  }

  async listConversations(
    page: number = 1,
    pageSize: number = 50,
    options?: {
      search?: string;
      sortBy?: string;
      order?: string;
      hasImages?: boolean;
      hasLatex?: boolean;
      gizmoId?: string;
    }
  ): Promise<{
    conversations: ConversationListItem[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }> {
    // Build query string
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());

    if (options?.search) {
      params.append('search', options.search);
    }
    if (options?.sortBy) {
      params.append('sort_by', options.sortBy);
    }
    if (options?.order) {
      params.append('order', options.order);
    }
    if (options?.hasImages !== undefined) {
      params.append('has_images', options.hasImages.toString());
    }
    if (options?.hasLatex !== undefined) {
      params.append('has_latex', options.hasLatex.toString());
    }
    if (options?.gizmoId) {
      params.append('gizmo_id', options.gizmoId);
    }

    return this.request(`/chatgpt/conversations?${params.toString()}`);
  }

  async searchConversations(
    query: string,
    limit: number = 50
  ): Promise<{ results: ConversationSearchResult[] }> {
    return this.request('/chatgpt/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    });
  }

  async getConversation(uuid: string): Promise<any> {
    // Use unified endpoint that works for both ChatGPT and Claude
    return this.request(`/conversations/${uuid}`);
  }

  async renderConversation(
    uuid: string,
    config: RenderConfig = {}
  ): Promise<ConversationRender> {
    // Use unified endpoint that works for both ChatGPT and Claude
    return this.request(`/conversations/${uuid}/render`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async exportConversation(
    uuid: string,
    format: 'markdown' | 'rendered_html' | 'pdf',
    config: RenderConfig = {}
  ): Promise<any> {
    return this.request(`/chatgpt/conversation/${uuid}/export`, {
      method: 'POST',
      body: JSON.stringify({ format, ...config }),
    });
  }

  async ingestChatGPTArchive(
    request: ChatGPTIngestRequest
  ): Promise<ChatGPTIngestResponse> {
    return this.request('/chatgpt/ingest', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Claude Archive endpoints
  async getClaudeStats(): Promise<ClaudeStats> {
    return this.request<ClaudeStats>('/claude/stats');
  }

  async ingestClaudeArchive(
    request: ClaudeIngestRequest
  ): Promise<ClaudeIngestResponse> {
    return this.request('/claude/ingest', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async listClaudeConversations(
    page: number = 1,
    pageSize: number = 50,
    options?: {
      search?: string;
      project_uuid?: string;
    }
  ): Promise<{
    conversations: any[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());

    if (options?.search) {
      params.append('search', options.search);
    }
    if (options?.project_uuid) {
      params.append('project_uuid', options.project_uuid);
    }

    return this.request(`/claude/conversations?${params.toString()}`);
  }

  async getClaudeConversation(uuid: string): Promise<any> {
    return this.request(`/claude/conversation/${uuid}`);
  }

  async searchClaudeMessages(
    query: string,
    options?: {
      sender?: string;
      project_uuid?: string;
      start_date?: string;
      end_date?: string;
      limit?: number;
    }
  ): Promise<{ results: any[]; total: number; query: string }> {
    return this.request('/claude/search', {
      method: 'POST',
      body: JSON.stringify({ query, ...options }),
    });
  }

  // ========================================
  // Unified Conversations (ChatGPT + Claude)
  // ========================================

  async getUnifiedConversationStats(): Promise<UnifiedConversationStats> {
    return this.request<UnifiedConversationStats>('/conversations/stats');
  }

  async listUnifiedConversations(
    page: number = 1,
    pageSize: number = 50,
    options?: {
      search?: string;
      source?: 'chatgpt' | 'claude';
      sort_by?: 'created_at' | 'updated_at' | 'title';
      sort_desc?: boolean;
    }
  ): Promise<UnifiedConversationListResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());

    if (options?.search) {
      params.append('search', options.search);
    }
    if (options?.source) {
      params.append('source', options.source);
    }
    if (options?.sort_by) {
      params.append('sort_by', options.sort_by);
    }
    if (options?.sort_desc !== undefined) {
      params.append('sort_desc', options.sort_desc.toString());
    }

    return this.request(`/conversations/?${params.toString()}`);
  }

  async getUnifiedConversation(uuid: string): Promise<UnifiedConversationDetail> {
    return this.request<UnifiedConversationDetail>(`/conversations/${uuid}`);
  }

  async searchUnifiedConversations(
    request: UnifiedSearchRequest
  ): Promise<UnifiedSearchResponse> {
    return this.request<UnifiedSearchResponse>('/conversations/search', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ========================================
  // Embeddings Management
  // ========================================

  async getEmbeddingsStatus(): Promise<{
    chatgpt_messages: {
      total: number;
      with_embeddings: number;
      without_embeddings: number;
      percentage_complete: number;
    };
    claude_messages: {
      total: number;
      with_embeddings: number;
      without_embeddings: number;
      percentage_complete: number;
    };
    document_chunks: {
      total: number;
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      percentage_complete: number;
    };
    overall: {
      total_embeddings: number;
      completed_embeddings: number;
      pending_embeddings: number;
      percentage_complete: number;
    };
  }> {
    return this.request('/embeddings/status');
  }

  async generateClaudeEmbeddings(batchSize: number = 1000): Promise<{
    total_messages: number;
    processed: number;
    failed: number;
    processing_time_seconds: number;
  }> {
    return this.request('/claude/generate-embeddings', {
      method: 'POST',
      body: JSON.stringify({ batch_size: batchSize }),
    });
  }

  // Media endpoints (universal - works for all sources)
  async getMedia(page: number = 1, pageSize: number = 50, source?: string): Promise<{
    items: MediaItem[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }> {
    const sourceParam = source ? `&source=${source}` : '';
    return this.request(`/media?page=${page}&page_size=${pageSize}${sourceParam}`);
  }

  getMediaFile(fileId: string): string {
    return `${this.baseURL}/media/${fileId}`;
  }

  async getMediaInfo(fileId: string): Promise<MediaItem> {
    return this.request(`/media/info/${fileId}`);
  }

  // Agent Chat endpoints
  async agentChat(message: string, conversationId?: string): Promise<{
    conversation_id: string;
    message: {
      role: string;
      content: string;
      tool_call?: any;
      tool_result?: any;
      gui_action?: string;
      gui_data?: any;
    };
    messages: any[];
  }> {
    return this.request('/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversation_id: conversationId }),
    });
  }

  async getAgentConversations(): Promise<any> {
    return this.request('/agent/conversations');
  }

  async getAgentConversation(conversationId: string): Promise<any> {
    return this.request(`/agent/conversations/${conversationId}`);
  }

  // Embedding Explorer endpoints
  async semanticSearch(query: string, k: number = 10, minSimilarity: number = 0.0): Promise<{
    query: string;
    results: Array<{
      uuid: string;
      content_text: string;
      author_role: string;
      conversation_uuid: string;
      similarity: number;
      distance: number;
    }>;
    total_results: number;
  }> {
    return this.request('/explore/search', {
      method: 'POST',
      body: JSON.stringify({ query, k, min_similarity: minSimilarity }),
    });
  }

  async findNeighbors(messageUuid: string, k: number = 10): Promise<any> {
    return this.request('/explore/neighbors', {
      method: 'POST',
      body: JSON.stringify({ message_uuid: messageUuid, k }),
    });
  }

  async computeSemanticDirection(positiveQuery: string, negativeQuery: string): Promise<any> {
    return this.request('/explore/direction', {
      method: 'POST',
      body: JSON.stringify({ positive_query: positiveQuery, negative_query: negativeQuery }),
    });
  }

  async analyzePerturbation(
    text: string,
    positiveQuery?: string,
    negativeQuery?: string,
    magnitude: number = 0.1,
    povmPack: string = 'tetralemma'
  ): Promise<any> {
    return this.request('/explore/perturb', {
      method: 'POST',
      body: JSON.stringify({
        text,
        positive_query: positiveQuery,
        negative_query: negativeQuery,
        magnitude,
        povm_pack: povmPack,
      }),
    });
  }

  // Transformation History
  async getTransformationHistory(
    limit: number = 50,
    offset: number = 0,
    transformationType?: string
  ): Promise<{
    items: any[];
    total: number;
    limit: number;
    offset: number;
  }> {
    let endpoint = `/transform/history?limit=${limit}&offset=${offset}`;
    if (transformationType) {
      endpoint += `&transformation_type=${transformationType}`;
    }
    return this.request(endpoint);
  }

  async getTransformation(id: string): Promise<any> {
    return this.request(`/transform/${id}`);
  }

  async getTransformationsBySource(sourceUuid: string): Promise<{
    source_uuid: string;
    count: number;
    transformations: any[];
  }> {
    return this.request(`/transform/by-source/${sourceUuid}`);
  }

  // Interest Tracking endpoints
  async markInteresting(params: {
    interestType: string;
    targetUuid?: string;
    momentText?: string;
    salienceScore?: number;
    targetMetadata?: any;
    context?: any;
    tags?: string[];
  }): Promise<any> {
    return this.request('/interests', {
      method: 'POST',
      body: JSON.stringify({
        interest_type: params.interestType,
        target_uuid: params.targetUuid,
        moment_text: params.momentText,
        salience_score: params.salienceScore,
        target_metadata: params.targetMetadata,
        context: params.context,
        tags: params.tags,
      }),
    });
  }

  async getCurrentInterest(): Promise<any> {
    return this.request('/interests/current');
  }

  async getInterestTrajectory(): Promise<any> {
    return this.request('/interests/trajectory');
  }

  // Interest List endpoints
  async createInterestList(params: {
    name: string;
    description?: string;
    listType?: string;
  }): Promise<any> {
    return this.request('/interest-lists', {
      method: 'POST',
      body: JSON.stringify({
        name: params.name,
        description: params.description,
        list_type: params.listType || 'custom',
      }),
    });
  }

  async getInterestLists(): Promise<{
    lists: any[];
    total: number;
  }> {
    return this.request('/interest-lists');
  }

  async getInterestList(listId: string): Promise<any> {
    return this.request(`/interest-lists/${listId}`);
  }

  async deleteInterestList(listId: string): Promise<void> {
    return this.request(`/interest-lists/${listId}`, {
      method: 'DELETE',
    });
  }

  async addToInterestList(listId: string, params: {
    itemType: string;
    itemUuid?: string;
    itemMetadata?: any;
    notes?: string;
  }): Promise<any> {
    return this.request(`/interest-lists/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify({
        item_type: params.itemType,
        item_uuid: params.itemUuid,
        item_metadata: params.itemMetadata,
        notes: params.notes,
      }),
    });
  }

  async removeFromInterestList(listId: string, itemId: string): Promise<any> {
    return this.request(`/interest-lists/${listId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  async updateInterestListItemStatus(
    listId: string,
    itemId: string,
    status: string
  ): Promise<any> {
    return this.request(`/interest-lists/${listId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // ========================================
  // Document Management
  // ========================================

  async listDocuments(params?: {
    page?: number;
    page_size?: number;
    file_type?: string;
    embedding_status?: string;
    search?: string;
  }): Promise<DocumentListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params?.file_type) queryParams.append('file_type', params.file_type);
    if (params?.embedding_status) queryParams.append('embedding_status', params.embedding_status);
    if (params?.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    return this.request(`/documents${queryString ? `?${queryString}` : ''}`);
  }

  async getDocument(documentId: string): Promise<DocumentListItem> {
    return this.request(`/documents/${documentId}`);
  }

  async getDocumentContent(documentId: string): Promise<{ content: string }> {
    return this.request(`/documents/${documentId}/content`);
  }

  async getDocumentChunks(documentId: string): Promise<{
    chunks: Array<{
      id: string;
      chunk_index: number;
      chunk_text: string;
      page_number: number | null;
      embedding_status: string;
    }>;
    total: number;
  }> {
    return this.request(`/documents/${documentId}/chunks`);
  }

  async getDocumentMedia(documentId: string): Promise<{
    media: MediaItem[];
    total: number;
  }> {
    return this.request(`/documents/${documentId}/media`);
  }

  async ingestDocuments(params: {
    source_directory: string;
    file_types?: string[];
    storage_strategy?: 'centralized' | 'in_place';
    centralized_base_path?: string;
    recursive?: boolean;
    force_reimport?: boolean;
    generate_embeddings?: boolean;
  }): Promise<{
    batch_id: string;
    total_files: number;
    successful: number;
    failed: number;
    skipped: number;
    processing_time_ms: number;
    errors: Array<{ file: string; error: string }>;
  }> {
    return this.request('/documents/ingest', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async listIngestionBatches(page: number = 1, pageSize: number = 20): Promise<{
    batches: Array<{
      id: string;
      source_directory: string;
      total_files: number;
      successful: number;
      failed: number;
      skipped: number;
      storage_strategy: string;
      processing_time_ms: number | null;
      errors: Array<{ file: string; error: string }> | null;
      created_at: string;
    }>;
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }> {
    return this.request(`/documents/batches?page=${page}&page_size=${pageSize}`);
  }

  async getIngestionBatch(batchId: string): Promise<{
    id: string;
    source_directory: string;
    total_files: number;
    successful: number;
    failed: number;
    skipped: number;
    storage_strategy: string;
    processing_time_ms: number | null;
    errors: Array<{ file: string; error: string }> | null;
    created_at: string;
    documents: Array<{
      id: string;
      filename: string;
      file_type: string;
      file_size: number;
    }>;
  }> {
    return this.request(`/documents/batches/${batchId}`);
  }

  async searchDocuments(params: DocumentSearchRequest): Promise<DocumentSearchResponse> {
    return this.request('/documents/search', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async listBatches(params?: {
    page?: number;
    page_size?: number;
  }): Promise<BatchListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.page_size) queryParams.append('page_size', params.page_size.toString());

    const queryString = queryParams.toString();
    return this.request(`/documents/batches${queryString ? `?${queryString}` : ''}`);
  }

  async getBatch(batchId: string): Promise<IngestionBatch> {
    return this.request(`/documents/batches/${batchId}`);
  }

  async ingestDirectory(params: {
    source_directory: string;
    storage_strategy?: 'centralized' | 'in_place';
  }): Promise<{ batch_id: string; message: string }> {
    return this.request('/documents/ingest', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async deleteDocument(documentId: string): Promise<void> {
    return this.request(`/documents/${documentId}`, {
      method: 'DELETE',
    });
  }

  // Health check
  async health(): Promise<{ status: string }> {
    return this.request('/health');
  }
}

// Export singleton instance
export const api = new HumanizerAPIClient();
export default api;
