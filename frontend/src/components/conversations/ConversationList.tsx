import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api-client';
import { cache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';
import SemanticSearch, { SearchResult } from '../search/SemanticSearch';
import './ConversationList.css';

interface Conversation {
  uuid: string;
  title: string | null;
  created_at: string | null;
  updated_at: string | null;
  message_count: number;
  source_archive: string;
  source: 'chatgpt' | 'claude';  // NEW: Source identifier
  summary?: string;  // Claude-specific
}

interface ConversationListProps {
  selectedConversation?: string | null;
  onSelect?: (uuid: string) => void;
}

type SortField = 'created_at' | 'updated_at' | 'title' | 'message_count';
type SortOrder = 'asc' | 'desc';
type SearchMode = 'title' | 'semantic';
type SourceFilter = 'all' | 'chatgpt' | 'claude';

export default function ConversationList({ selectedConversation, onSelect }: ConversationListProps) {
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [usingCache, setUsingCache] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('title');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');  // NEW: Source filter
  const [showSettings, setShowSettings] = useState(false);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Apply client-side filtering and sorting (memoized)
  const filteredConversations = useMemo(() => {
    let filtered = [...allConversations];

    // Apply source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter((conv) => conv.source === sourceFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((conv) =>
        conv.title?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'created_at':
          aVal = new Date(a.created_at || 0).getTime();
          bVal = new Date(b.created_at || 0).getTime();
          break;
        case 'updated_at':
          aVal = new Date(a.updated_at || 0).getTime();
          bVal = new Date(b.updated_at || 0).getTime();
          break;
        case 'title':
          aVal = (a.title || '').toLowerCase();
          bVal = (b.title || '').toLowerCase();
          break;
        case 'message_count':
          aVal = a.message_count;
          bVal = b.message_count;
          break;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    return filtered;
  }, [allConversations, searchQuery, sortField, sortOrder, sourceFilter]);

  const loadConversations = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      setUsingCache(false);

      // Try cache first (unless forced refresh)
      if (!forceRefresh) {
        const cached = cache.get<Conversation[]>(CACHE_KEYS.CONVERSATIONS_LIST);
        if (cached) {
          console.log('✅ Using cached conversations:', cached.length);
          setAllConversations(cached);
          setTotalCount(cached.length);
          setLoadedCount(cached.length);
          setUsingCache(true);
          setLoading(false);
          return;
        }
      }

      // Cache miss or forced refresh - fetch from API
      console.log('🌐 Fetching conversations from unified API...');

      // Load all conversations from unified endpoint
      const fetchedConversations: Conversation[] = [];
      const pageSize = 100;
      let page = 1;
      let totalPages = 1;

      // Load first page to get total
      const firstPage = await api.listUnifiedConversations(page, pageSize, {
        sort_by: 'updated_at',
        sort_desc: true,
      });
      setTotalCount(firstPage.total);
      totalPages = Math.ceil(firstPage.total / pageSize);

      // Add conversations from first page
      fetchedConversations.push(...firstPage.conversations);
      setLoadedCount(fetchedConversations.length);
      setAllConversations([...fetchedConversations]);

      // Load remaining pages
      for (page = 2; page <= totalPages; page++) {
        const result = await api.listUnifiedConversations(page, pageSize, {
          sort_by: 'updated_at',
          sort_desc: true,
        });
        fetchedConversations.push(...result.conversations);
        setLoadedCount(fetchedConversations.length);
        setAllConversations([...fetchedConversations]);
      }

      // Cache the full list
      cache.set(CACHE_KEYS.CONVERSATIONS_LIST, fetchedConversations, CACHE_TTL.MEDIUM);
      console.log('💾 Cached', fetchedConversations.length, 'conversations');

      setLoading(false);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string | null): string => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSourceBadge = (source: 'chatgpt' | 'claude'): string => {
    return source === 'chatgpt' ? '💬' : '🤖';
  };

  const getSourceName = (source: 'chatgpt' | 'claude'): string => {
    return source === 'chatgpt' ? 'ChatGPT' : 'Claude';
  };

  const handleSemanticSearchResult = (result: SearchResult) => {
    // When a semantic search result is clicked, load that conversation
    if (onSelect) {
      onSelect(result.conversation_uuid);
    }
  };

  if (loading) {
    return (
      <div className="conversation-list-loading">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading conversations...</p>
        {totalCount > 0 && (
          <p className="loading-progress">
            {loadedCount} / {totalCount}
          </p>
        )}
        <div className="loading-bar">
          <div
            className="loading-bar-fill"
            style={{ width: `${(loadedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="conversation-list-error">
        <p className="error-icon">⚠️</p>
        <p className="error-text">{error}</p>
        <button className="retry-button" onClick={() => loadConversations()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <div className="search-mode-toggle">
          <button
            className={`mode-button ${searchMode === 'title' ? 'active' : ''}`}
            onClick={() => setSearchMode('title')}
            title="Search by title (fast)"
          >
            📝 Title
          </button>
          <button
            className={`mode-button ${searchMode === 'semantic' ? 'active' : ''}`}
            onClick={() => setSearchMode('semantic')}
            title="Semantic search (find by meaning)"
          >
            🧠 Semantic
          </button>
        </div>

        {searchMode === 'title' ? (
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button
              className="refresh-button"
              onClick={() => loadConversations(true)}
              title="Refresh conversation list"
            >
              🔄
            </button>
            <button
              className="settings-button"
              onClick={() => setShowSettings(!showSettings)}
              title="Sort and filter options"
            >
              ⚙️
            </button>
          </div>
        ) : null}

        {usingCache && (
          <div className="cache-indicator">
            ⚡ Loaded from cache
          </div>
        )}

        {showSettings && (
          <div className="settings-panel">
            <div className="setting-group">
              <label className="setting-label">Source:</label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                className="setting-select"
              >
                <option value="all">All Sources</option>
                <option value="chatgpt">💬 ChatGPT</option>
                <option value="claude">🤖 Claude</option>
              </select>
            </div>

            <div className="setting-group">
              <label className="setting-label">Sort by:</label>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="setting-select"
              >
                <option value="created_at">Date Created</option>
                <option value="updated_at">Date Updated</option>
                <option value="title">Title (A-Z)</option>
                <option value="message_count"># Messages</option>
              </select>
            </div>

            <div className="setting-group">
              <label className="setting-label">Order:</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="setting-select"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        )}

        {searchMode === 'title' && (
          <p className="conversation-count">
            {filteredConversations.length} of {allConversations.length} conversations
          </p>
        )}
      </div>

      {searchMode === 'title' ? (
        <div className="conversation-flat-list">
          {filteredConversations.map((conv) => (
            <button
              key={conv.uuid}
              className={`conversation-item ${
                selectedConversation === conv.uuid ? 'selected' : ''
              }`}
              onClick={() => onSelect?.(conv.uuid)}
              title={formatDateTime(conv.created_at)}
            >
              <div className="conversation-item-main">
                <div className="conversation-item-title">
                  <span className="source-badge" title={getSourceName(conv.source)}>
                    {getSourceBadge(conv.source)}
                  </span>
                  {conv.title || 'Untitled Conversation'}
                </div>
                <div className="conversation-item-meta">
                  <span className="meta-messages" title="Number of messages">
                    {conv.message_count} msgs
                  </span>
                  <span className="meta-date" title="Date created">
                    {formatDate(conv.created_at)}
                  </span>
                </div>
              </div>
              <div className="conversation-item-hover">
                <div className="hover-detail">
                  <span className="hover-label">Source:</span>
                  <span className="hover-value">{getSourceBadge(conv.source)} {getSourceName(conv.source)}</span>
                </div>
                <div className="hover-detail">
                  <span className="hover-label">Created:</span>
                  <span className="hover-value">{formatDateTime(conv.created_at)}</span>
                </div>
                <div className="hover-detail">
                  <span className="hover-label">Messages:</span>
                  <span className="hover-value">{conv.message_count}</span>
                </div>
                <div className="hover-detail">
                  <span className="hover-label">Archive:</span>
                  <span className="hover-value">{conv.source_archive}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="semantic-search-container">
          <SemanticSearch
            onSelectResult={handleSemanticSearchResult}
            onSelectConversation={onSelect}
          />
        </div>
      )}
    </div>
  );
}
