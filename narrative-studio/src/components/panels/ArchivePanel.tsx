import { useState, useEffect, useMemo } from 'react';
import type { ConversationMetadata, Conversation, Message } from '../../types';
import { Icons } from '../layout/Icons';
import { archiveService } from '../../services/archiveService';

interface ArchivePanelProps {
  onSelectNarrative: (narrative: any) => void;
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'conversations' | 'messages';

export function ArchivePanel({ onSelectNarrative, isOpen, onClose }: ArchivePanelProps) {
  const [conversations, setConversations] = useState<ConversationMetadata[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('conversations');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load conversations on mount
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  const loadConversations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await archiveService.fetchConversations();
      setConversations(data);
      console.log(`Loaded ${data.length} conversations from archive`);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (folder: string) => {
    setLoading(true);
    try {
      const conv = await archiveService.fetchConversation(folder);
      setSelectedConversation(conv);
      setViewMode('messages');
      setSelectedMessageIndex(null);
      setSearchQuery('');
      console.log(`Loaded "${conv.title}" - ${conv.messages.length} messages`);
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
      alert(`Could not load conversation: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadMessageToCanvas = () => {
    if (selectedMessageIndex !== null && selectedConversation) {
      const narrative = archiveService.conversationToNarrative(
        selectedConversation,
        selectedMessageIndex
      );
      onSelectNarrative(narrative);
      console.log('Loaded message to canvas');
    }
  };

  const loadFullConversationToCanvas = () => {
    if (selectedConversation) {
      const narrative = archiveService.conversationToNarrative(selectedConversation);
      onSelectNarrative(narrative);
      console.log('Loaded full conversation to canvas');
    }
  };

  // Get all unique tags from conversations
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    conversations.forEach((conv) => {
      conv.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [conversations]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      const matchesSearch =
        !searchQuery ||
        conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.folder.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTag = !filterTag || conv.tags?.includes(filterTag);

      return matchesSearch && matchesTag;
    });
  }, [conversations, searchQuery, filterTag]);

  // Filter messages
  const filteredMessages = useMemo(() => {
    if (!selectedConversation) return [];
    return selectedConversation.messages.filter((msg) =>
      !searchQuery || msg.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [selectedConversation, searchQuery]);

  if (!isOpen) return null;

  // MESSAGES VIEW
  if (viewMode === 'messages' && selectedConversation) {
    return (
      <>
        {/* Mobile backdrop */}
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Panel */}
        <aside
          className="fixed top-16 left-0 bottom-0 w-80 md:w-96 z-50 md:relative md:top-0 overflow-hidden panel"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderRight: '1px solid var(--border-color)',
            borderRadius: 0,
          }}
        >
          {/* Header */}
          <div
            className="panel-header"
            style={{
              padding: 'var(--space-lg)',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="heading-md" style={{ color: 'var(--text-primary)' }}>
                Messages
              </h2>
              <button
                onClick={onClose}
                className="md:hidden p-2 rounded-md hover:opacity-70"
                style={{
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-tertiary)',
                }}
              >
                <Icons.Close />
              </button>
            </div>

            {/* Back button + Title */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setViewMode('conversations')}
                className="rounded-md transition-smooth hover:opacity-70 font-medium"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  padding: 'var(--space-xs) var(--space-sm)',
                  fontSize: '0.8125rem',
                }}
              >
                ← Back
              </button>
              <div className="flex-1 font-medium text-small line-clamp-1" style={{ color: 'var(--text-primary)' }}>
                {selectedConversation.title}
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="ui-text w-full pl-11 pr-4"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }}>
                <Icons.Search />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between text-small" style={{ color: 'var(--text-secondary)' }}>
              <span>
                {searchQuery
                  ? `${filteredMessages.length} of ${selectedConversation.messages.length}`
                  : `${selectedConversation.messages.length} messages`}
              </span>
              <button
                onClick={loadFullConversationToCanvas}
                className="font-medium rounded-md transition-smooth"
                style={{
                  backgroundImage: 'var(--accent-primary-gradient)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-inverse)',
                  padding: 'var(--space-xs) var(--space-sm)',
                  fontSize: '0.8125rem',
                }}
              >
                Load All →
              </button>
            </div>
          </div>

          {/* Messages list */}
          <div
            className="overflow-y-auto"
            style={{
              height: 'calc(100% - 240px)',
              padding: 'var(--space-md)',
            }}
          >
            <div className="space-y-2">
              {filteredMessages.map((msg, idx) => {
                const originalIndex = selectedConversation.messages.findIndex(m => m.id === msg.id);
                const isSelected = selectedMessageIndex === originalIndex;

                return (
                  <div
                    key={msg.id}
                    onClick={() => setSelectedMessageIndex(originalIndex)}
                    className="card cursor-pointer"
                    style={{
                      ...(isSelected
                        ? {
                            backgroundImage: 'var(--accent-primary-gradient)',
                            backgroundColor: 'transparent',
                          }
                        : {
                            backgroundColor: 'var(--bg-elevated)',
                          }),
                      color: isSelected ? 'var(--text-inverse)' : 'var(--text-primary)',
                      padding: 'var(--space-sm)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="tag"
                        style={{
                          backgroundColor: isSelected
                            ? 'rgba(255, 255, 255, 0.25)'
                            : msg.role === 'user'
                            ? 'rgba(6, 182, 212, 0.2)'
                            : 'rgba(167, 139, 250, 0.2)',
                          color: isSelected
                            ? 'var(--text-inverse)'
                            : msg.role === 'user'
                            ? 'var(--accent-secondary)'
                            : 'var(--accent-primary)',
                          border: 'none',
                          fontSize: '0.625rem',
                          fontWeight: 600,
                        }}
                      >
                        {msg.role.toUpperCase()}
                      </span>
                      <span className="text-tiny" style={{ opacity: 0.75 }}>
                        #{originalIndex + 1}
                      </span>
                    </div>
                    <div className="text-small line-clamp-3" style={{ opacity: isSelected ? 1 : 0.9 }}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Load button (sticky bottom) */}
          {selectedMessageIndex !== null && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: 'var(--space-md)',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-panel)',
              }}
            >
              <button
                onClick={loadMessageToCanvas}
                className="w-full font-medium rounded-md transition-smooth"
                style={{
                  backgroundImage: 'var(--accent-primary-gradient)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-inverse)',
                  padding: 'var(--space-md)',
                  fontSize: '1rem',
                }}
              >
                Load Message to Canvas →
              </button>
            </div>
          )}
        </aside>
      </>
    );
  }

  // CONVERSATIONS VIEW
  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="fixed top-16 left-0 bottom-0 w-80 md:w-96 z-50 md:relative md:top-0 overflow-hidden panel"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderRight: '1px solid var(--border-color)',
          borderRadius: 0,
        }}
      >
        {/* Header */}
        <div
          className="panel-header"
          style={{
            padding: 'var(--space-lg)',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="heading-md" style={{ color: 'var(--text-primary)' }}>
              Archive
            </h2>
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-md hover:opacity-70"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-tertiary)',
              }}
            >
              <Icons.Close />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="ui-text w-full pl-11 pr-4"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }}>
              <Icons.Search />
            </div>
          </div>

          {/* Tag filters - horizontal scrolling */}
          {allTags.length > 0 && (
            <div>
              <p className="text-small mb-2" style={{ color: 'var(--text-secondary)' }}>
                Filter by tag:
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
                <button
                  onClick={() => setFilterTag(null)}
                  className={!filterTag ? 'tag tag-selected' : 'tag tag-default'}
                >
                  All
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setFilterTag(tag)}
                    className={filterTag === tag ? 'tag tag-selected' : 'tag tag-default'}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="mt-4 text-small" style={{ color: 'var(--text-secondary)' }}>
            {searchQuery || filterTag
              ? `${filteredConversations.length} of ${conversations.length}`
              : `${conversations.length} conversations`}
          </div>
        </div>

        {/* Conversations list */}
        <div
          className="overflow-y-auto"
          style={{
            height: 'calc(100% - 280px)',
            padding: 'var(--space-lg)',
          }}
        >
          {loading && (
            <div className="flex items-center justify-center" style={{ paddingTop: 'var(--space-2xl)' }}>
              <div className="animate-spin" style={{ color: 'var(--accent-primary)' }}>
                <Icons.Archive />
              </div>
            </div>
          )}

          {error && (
            <div
              className="card"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                padding: 'var(--space-md)',
                border: '1px solid var(--error)',
              }}
            >
              <p className="text-small font-medium mb-2" style={{ color: 'var(--error)' }}>
                Archive Connection Error
              </p>
              <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
                {error}
              </p>
              <button
                onClick={loadConversations}
                className="mt-4 font-medium rounded-md transition-smooth"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--text-inverse)',
                  padding: 'var(--space-sm) var(--space-md)',
                  fontSize: '0.875rem',
                }}
              >
                Retry Connection
              </button>
            </div>
          )}

          {!loading && !error && filteredConversations.length === 0 && (
            <div
              className="flex flex-col items-center justify-center text-center"
              style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-2xl)' }}
            >
              <div
                className="mb-4"
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icons.Archive />
              </div>
              <p className="text-body mb-2" style={{ color: 'var(--text-secondary)' }}>
                No conversations found
              </p>
              <p className="text-small" style={{ color: 'var(--text-tertiary)' }}>
                {searchQuery || filterTag
                  ? 'Try adjusting your search or filters'
                  : 'Make sure the archive server is running'}
              </p>
            </div>
          )}

          {!loading && !error && filteredConversations.length > 0 && (
            <div className="space-y-2">
              {filteredConversations.map((conv) => {
                const isSelected = selectedConversation?.id === conv.id;

                return (
                  <button
                    key={conv.folder}
                    onClick={() => {
                      loadConversation(conv.folder);
                      // Close panel on mobile after selection
                      if (window.innerWidth < 768) {
                        onClose();
                      }
                    }}
                    className="card w-full text-left"
                    style={{
                      ...(isSelected
                        ? {
                            backgroundImage: 'var(--accent-primary-gradient)',
                            backgroundColor: 'transparent',
                          }
                        : {
                            backgroundColor: 'var(--bg-elevated)',
                          }),
                      color: isSelected ? 'var(--text-inverse)' : 'var(--text-primary)',
                      padding: 'var(--space-sm)',
                    }}
                  >
                    <div className="font-medium mb-2 line-clamp-2" style={{ fontSize: '0.9375rem' }}>
                      {conv.title}
                    </div>
                    <div className="text-small mb-2" style={{ opacity: 0.9 }}>
                      {conv.message_count} messages
                    </div>
                    {conv.tags && conv.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {conv.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="tag"
                            style={{
                              backgroundColor: isSelected
                                ? 'rgba(255, 255, 255, 0.25)'
                                : 'var(--bg-tertiary)',
                              color: isSelected ? 'var(--text-inverse)' : 'var(--text-secondary)',
                              borderColor: 'transparent',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
