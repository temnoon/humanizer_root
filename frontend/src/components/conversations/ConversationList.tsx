import { useState, useEffect } from 'react';
import api from '@/lib/api-client';
import './ConversationList.css';

interface Conversation {
  uuid: string;
  title: string | null;
  created_at: string | null;
  message_count: number;
  source_archive: string;
}

interface ConversationListProps {
  selectedConversation?: string | null;
  onSelect?: (uuid: string) => void;
}

type SortField = 'created_at' | 'title' | 'message_count';
type SortOrder = 'asc' | 'desc';

export default function ConversationList({ selectedConversation, onSelect }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [sortField, sortOrder]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      loadConversations();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build API options from current state
      const options = {
        search: searchQuery || undefined,
        sortBy: sortField,
        order: sortOrder,
      };

      // Load all conversations using the new list endpoint
      const allConversations: Conversation[] = [];
      const pageSize = 100;
      let page = 1;
      let totalPages = 1;

      // Load first page to get total
      const firstPage = await api.listConversations(page, pageSize, options);
      setTotalCount(firstPage.total);
      totalPages = firstPage.total_pages;

      // Add conversations from first page
      allConversations.push(...firstPage.conversations);
      setLoadedCount(allConversations.length);
      setConversations([...allConversations]);

      // Load remaining pages
      for (page = 2; page <= totalPages; page++) {
        const result = await api.listConversations(page, pageSize, options);
        allConversations.push(...result.conversations);
        setLoadedCount(allConversations.length);
        setConversations([...allConversations]);
      }

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
        <button className="retry-button" onClick={loadConversations}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button
            className="settings-button"
            onClick={() => setShowSettings(!showSettings)}
            title="Sort and filter options"
          >
            ⚙️
          </button>
        </div>

        {showSettings && (
          <div className="settings-panel">
            <div className="setting-group">
              <label className="setting-label">Sort by:</label>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="setting-select"
              >
                <option value="created_at">Date Created</option>
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

        <p className="conversation-count">
          {conversations.length} conversations
        </p>
      </div>

      <div className="conversation-flat-list">
        {conversations.map((conv) => (
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
    </div>
  );
}
