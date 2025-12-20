/**
 * MessageListView - Message list with search, selection, and related items
 *
 * Extracted from ArchivePanel.tsx for reusability and maintainability.
 */

import { useRef } from 'react';
import type { Conversation } from '../../types';

interface Message {
  id: string;
  role: string;
  content: string;
  created_at?: number;
}

interface FacebookItem {
  id: string;
  type: string;
  title?: string;
  text?: string;
  created_at?: number;
}

interface MessageListViewProps {
  // Data
  messages: Message[];
  selectedConversation: Conversation | null;
  selectedFacebookItem: FacebookItem | null;
  selectedMessageIndex: number | null;
  focusedIndex: number;
  relatedFacebookItems: FacebookItem[];

  // Actions
  onSelectMessage: (index: number) => void;
  onSelectFacebookItem: (item: FacebookItem) => void;

  // Refs for keyboard navigation
  itemRefs: React.MutableRefObject<Map<number, HTMLElement>>;
}

/**
 * Format message content - handles DALL-E prompts specially
 */
function formatMessageContent(content: string): React.ReactElement | string {
  // Try to detect and parse DALL-E prompt JSON
  if (content.trim().startsWith('{') && content.includes('"prompt"')) {
    try {
      const parsed = JSON.parse(content);
      if (parsed.prompt) {
        return (
          <div>
            <div className="text-tiny" style={{ fontWeight: 600, marginBottom: 'var(--space-xs)', opacity: 0.7 }}>
              Prompt:
            </div>
            <div>{parsed.prompt}</div>
          </div>
        );
      }
    } catch (e) {
      // Not valid JSON, return as-is
    }
  }
  return content;
}

export function MessageListView({
  messages,
  selectedConversation,
  selectedFacebookItem,
  selectedMessageIndex,
  focusedIndex,
  relatedFacebookItems,
  onSelectMessage,
  onSelectFacebookItem,
  itemRefs,
}: MessageListViewProps) {
  const isFacebookMode = !!selectedFacebookItem;

  return (
    <div className="scroll-container">
      <div className="space-y-2">
        {messages.map((msg, idx) => {
          const originalIndex = isFacebookMode
            ? 0
            : selectedConversation?.messages.findIndex(m => m.id === msg.id) ?? -1;
          const isSelected = isFacebookMode || selectedMessageIndex === originalIndex;
          const isFocused = focusedIndex === idx;

          return (
            <div
              key={msg.id}
              ref={(el) => {
                if (el) itemRefs.current.set(idx, el);
                else itemRefs.current.delete(idx);
              }}
              onClick={() => {
                if (!isFacebookMode) {
                  onSelectMessage(originalIndex);
                }
                // Facebook items are already loaded, no need to reload
              }}
              className="card cursor-pointer transition-all"
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
                border: `2px solid ${isFocused ? 'var(--accent-primary)' : 'transparent'}`,
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
                      : isFacebookMode
                      ? 'rgba(59, 130, 246, 0.2)'
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
                  {isFacebookMode && '📘 '}
                  {msg.role.toUpperCase()}
                </span>
                <div className="flex items-center gap-2">
                  {!isFacebookMode && (
                    <span className="text-tiny u-opacity-75">
                      #{originalIndex + 1}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-small line-clamp-3" style={{ opacity: isSelected ? 1 : 0.9 }}>
                {formatMessageContent(msg.content)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Related items from same day (for Facebook media items) */}
      {selectedFacebookItem && relatedFacebookItems.length > 0 && (
        <div style={{
          marginTop: 'var(--space-lg)',
          paddingTop: 'var(--space-md)',
          borderTop: '1px solid var(--border-color)',
        }}>
          <h4 style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-sm)',
          }}>
            Related Items from Same Day ({relatedFacebookItems.length})
          </h4>
          <div className="space-y-1">
            {relatedFacebookItems.slice(0, 10).map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectFacebookItem(item)}
                className="card cursor-pointer transition-all"
                style={{
                  padding: 'var(--space-sm)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-xs)',
                  marginBottom: 'var(--space-xs)',
                }}>
                  <span style={{
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    color: item.type === 'post' ? 'var(--accent-secondary)' : 'var(--accent-primary)',
                  }}>
                    {item.type === 'post' ? '📝 POST' : '💬 COMMENT'}
                  </span>
                  <span className="text-tiny u-opacity-75">
                    {item.created_at ? new Date(item.created_at * 1000).toLocaleTimeString() : ''}
                  </span>
                </div>
                <div className="text-small line-clamp-2" style={{ opacity: 0.9 }}>
                  {item.text || '[No text content]'}
                </div>
              </div>
            ))}
            {relatedFacebookItems.length > 10 && (
              <div className="text-tiny" style={{ color: 'var(--text-tertiary)', textAlign: 'center', paddingTop: 'var(--space-xs)' }}>
                +{relatedFacebookItems.length - 10} more items
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
