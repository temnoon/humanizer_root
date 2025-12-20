/**
 * ConversationsListView - Conversation list with search, filters, and selection
 *
 * Extracted from ArchivePanel.tsx for reusability and maintainability.
 */

import { useRef } from 'react';
import type { ConversationMetadata, Conversation } from '../../types';
import { Icons } from '../layout/Icons';

interface ConversationsListViewProps {
  conversations: ConversationMetadata[];
  filteredConversations: ConversationMetadata[];
  selectedConversation: Conversation | null;
  focusedIndex: number;
  loading: boolean;
  error: string | null;

  // Search & filters
  searchQuery: string;
  hasActiveFilters: boolean;

  // Actions
  onSelectConversation: (folder: string) => void;
  onViewGallery: (folder: string) => void;
  onAddToBook?: (folder: string) => void;
  onRetry: () => void;

  // Refs for keyboard navigation
  itemRefs: React.MutableRefObject<Map<number, HTMLElement>>;

  // Active book context (optional)
  activeBook?: { title: string } | null;
}

export function ConversationsListView({
  conversations,
  filteredConversations,
  selectedConversation,
  focusedIndex,
  loading,
  error,
  searchQuery,
  hasActiveFilters,
  onSelectConversation,
  onViewGallery,
  onAddToBook,
  onRetry,
  itemRefs,
  activeBook,
}: ConversationsListViewProps) {
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ paddingTop: 'var(--space-2xl)' }}>
        <div className="animate-spin" style={{ color: 'var(--accent-primary)' }}>
          <Icons.Archive />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
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
        <p className="text-small u-text-secondary">{error}</p>
        <button
          onClick={onRetry}
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
    );
  }

  // Empty state
  if (filteredConversations.length === 0) {
    return (
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
        <p className="text-small u-text-tertiary">
          {searchQuery || hasActiveFilters
            ? 'Try adjusting your search or filters'
            : 'Make sure the archive server is running'}
        </p>
      </div>
    );
  }

  // Conversation list
  return (
    <div className="space-y-2">
      {filteredConversations.map((conv, idx) => {
        const isSelected = selectedConversation?.id === conv.id;
        const isFocused = focusedIndex === idx;
        const hasImages = conv.tags?.includes('Has Images');

        return (
          <div key={conv.folder} className="relative">
            <button
              ref={(el) => {
                if (el) itemRefs.current.set(idx, el);
                else itemRefs.current.delete(idx);
              }}
              onClick={() => onSelectConversation(conv.folder)}
              className="card w-full text-left transition-all"
              style={{
                ...(isSelected
                  ? {
                      backgroundImage: 'var(--accent-primary-gradient)',
                      backgroundColor: 'transparent',
                    }
                  : isFocused
                  ? {
                      backgroundColor: 'var(--bg-tertiary)',
                    }
                  : {
                      backgroundColor: 'var(--bg-elevated)',
                    }),
                color: isSelected ? 'var(--text-inverse)' : 'var(--text-primary)',
                padding: 'var(--space-sm)',
                paddingRight: hasImages || activeBook ? '3rem' : 'var(--space-sm)',
                border: `2px solid ${isFocused ? 'var(--accent-primary)' : 'transparent'}`,
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

            {/* Gallery button */}
            {hasImages && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewGallery(conv.folder);
                }}
                className="absolute right-2 top-2 p-2 rounded-md transition-all hover:opacity-70"
                style={{
                  color: isSelected ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.15)' : 'var(--bg-secondary)',
                }}
                title="View images from this conversation"
                aria-label="View gallery"
              >
                <Icons.Image />
              </button>
            )}

            {/* Add to book button */}
            {activeBook && onAddToBook && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToBook(conv.folder);
                }}
                className="absolute right-2 p-2 rounded-md transition-all hover:opacity-70"
                style={{
                  top: hasImages ? '2.5rem' : '0.5rem',
                  color: isSelected ? 'var(--text-inverse)' : 'var(--accent-primary)',
                  backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.15)' : 'var(--bg-secondary)',
                  fontSize: '0.875rem',
                }}
                title={`Quick add to "${activeBook.title}"`}
                aria-label="Add to book"
              >
                📖+
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
