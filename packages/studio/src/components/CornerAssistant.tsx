/**
 * CornerAssistant - Floating AUI assistant button
 *
 * A discrete "?" button in the lower right corner that opens
 * the AUI chat interface for natural language search.
 *
 * Design principles:
 * - Book-safe: resembles a footnote marker or bookmark
 * - Non-intrusive: muted colors, minimal visual weight
 * - Generous padding from edges
 * - Action-driven: search results display in main workspace
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useApi } from '../contexts/ApiContext';
import type { SearchResult } from '../contexts/ApiContext';

interface CornerAssistantProps {
  onSelectResult?: (result: SearchResult) => void;
  sessionId?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  results?: SearchResult[];
}

export function CornerAssistant({ onSelectResult, sessionId }: CornerAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const api = useApi();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Keyboard shortcut: Cmd+/ to toggle chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // Escape to close chat
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 40), 120);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !sessionId) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    if (inputRef.current) {
      inputRef.current.style.height = '40px';
    }

    try {
      // Use the search API
      const response = await api.search(sessionId, input.trim(), { limit: 5 });

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          response.results.length > 0
            ? `Found ${response.results.length} results:`
            : 'No results found. Try a different query.',
        results: response.results,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Search failed. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
      console.error('Search failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  const handleResultClick = (result: SearchResult) => {
    onSelectResult?.(result);
  };

  return (
    <>
      {/* The floating button */}
      <button
        className={`corner-assistant ${isOpen ? 'corner-assistant--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Search Archive (Cmd+/)"
        aria-label="Open assistant"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className="corner-assistant__icon">{isOpen ? '\u00d7' : '?'}</span>
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="corner-assistant__chat"
          role="dialog"
          aria-modal="false"
          aria-label="AUI Assistant"
        >
          {/* Header */}
          <div className="corner-assistant__chat-header">
            <div className="corner-assistant__chat-title">
              <span className="corner-assistant__chat-icon">&#10022;</span>
              <span>Search Archive</span>
            </div>
            <div className="corner-assistant__chat-actions">
              <button
                className="corner-assistant__chat-action"
                onClick={handleClear}
                title="Clear conversation"
                aria-label="Clear conversation"
              >
                &#8634;
              </button>
              <button
                className="corner-assistant__chat-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close (Escape)"
              >
                &#215;
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            className="corner-assistant__chat-messages"
            role="log"
            aria-live="polite"
            aria-label="Conversation messages"
          >
            {messages.length === 0 && (
              <div className="corner-assistant__chat-welcome">
                <p>Search your archive using natural language.</p>
                <p className="corner-assistant__chat-hint">
                  Try: "philosophy of mind" or "conversations about music"
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`corner-assistant__chat-msg corner-assistant__chat-msg--${msg.role}`}
              >
                <p>{msg.content}</p>
                {msg.results && msg.results.length > 0 && (
                  <div className="corner-assistant__results">
                    {msg.results.map((result, idx) => (
                      <button
                        key={result.id}
                        className="corner-assistant__result-card"
                        onClick={() => handleResultClick(result)}
                      >
                        <div className="corner-assistant__result-header">
                          <span className="corner-assistant__result-index">{idx + 1}</span>
                          <span className="corner-assistant__result-source">
                            {result.provenance?.threadTitle || result.source}
                          </span>
                          <span className="corner-assistant__result-level">
                            L{result.hierarchyLevel}
                          </span>
                        </div>
                        <div className="corner-assistant__result-preview">
                          {result.text.slice(0, 150)}
                          {result.text.length > 150 ? '...' : ''}
                        </div>
                        <div className="corner-assistant__result-footer">
                          <div className="corner-assistant__result-ratings">
                            <span className="corner-assistant__result-rating">
                              {Math.round(result.score * 100)}%
                            </span>
                            {result.quality && (
                              <span className="corner-assistant__result-rating">
                                Q: {Math.round(result.quality.qualityScore * 100)}
                              </span>
                            )}
                          </div>
                          <span className="corner-assistant__result-meta">
                            {result.wordCount} words
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="corner-assistant__chat-msg corner-assistant__chat-msg--loading">
                <div className="corner-assistant__loading-dots">
                  <span>&#9679;</span>
                  <span>&#9679;</span>
                  <span>&#9679;</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="corner-assistant__chat-input">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Search archive..."
              disabled={isLoading || !sessionId}
              rows={1}
              aria-label="Search input"
            />
            <button
              className="corner-assistant__chat-send"
              onClick={handleSend}
              disabled={!input.trim() || isLoading || !sessionId}
              aria-label="Send"
            >
              &#8593;
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default CornerAssistant;
