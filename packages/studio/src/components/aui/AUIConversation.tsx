/**
 * AUI Conversation Interface
 *
 * A chat-like interface for interacting with the Archive Understanding Interface.
 * Supports natural language queries and displays results as rated cards.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SearchResult as ApiSearchResult } from '../../contexts/ApiContext';

// Re-export the type for external use
export type SearchResult = ApiSearchResult;

export interface ConversationMessage {
  id: string;
  role: 'user' | 'aui';
  content: string;
  timestamp: number;
  results?: SearchResult[];
  isLoading?: boolean;
}

export interface AUIConversationProps {
  /** API base URL (archive server) */
  apiBaseUrl?: string;
  /** Callback when a result card is selected */
  onSelectResult?: (result: SearchResult) => void;
  /** Callback when results are loaded */
  onResultsLoaded?: (results: SearchResult[]) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// RATING HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function computeGeneralRating(result: SearchResult): number {
  // General usefulness: 0-5 scale
  let rating = 0;

  // From enrichment if available
  if (result.enrichment?.rating) {
    return result.enrichment.rating;
  }

  // Compute from quality indicators
  if (result.quality) {
    // Word count contribution (more content = more useful, up to 2 points)
    const wordScore = Math.min(result.quality.wordCount / 500, 1) * 2;

    // Quality score contribution (up to 2 points)
    const qualityScore = (result.quality.qualityScore || 0.5) * 2;

    // Bonus for code/math content (0.5 each)
    const codeBonus = result.quality.hasCodeBlocks ? 0.5 : 0;
    const mathBonus = result.quality.hasMathBlocks ? 0.5 : 0;

    rating = Math.min(5, wordScore + qualityScore + codeBonus + mathBonus);
  } else {
    // Fallback: estimate from word count and hierarchy level
    const wordScore = Math.min(result.wordCount / 300, 1) * 2;
    // Higher hierarchy = more condensed/useful
    const levelBonus = result.hierarchyLevel * 0.5;
    rating = Math.min(5, wordScore + 2 + levelBonus);
  }

  return Math.round(rating * 10) / 10;
}

function computeTaskRating(result: SearchResult): number {
  // Task relevance: score is 0-1, convert to 0-5
  return Math.round(result.score * 5 * 10) / 10;
}

function getRatingColor(rating: number): string {
  if (rating >= 4) return 'var(--color-success)';
  if (rating >= 3) return 'var(--color-info)';
  if (rating >= 2) return 'var(--color-warning)';
  return 'var(--color-text-tertiary)';
}

function getHierarchyLabel(level: number): string {
  switch (level) {
    case 0:
      return 'L0 Base';
    case 1:
      return 'L1 Summary';
    case 2:
      return 'Apex';
    default:
      return `L${level}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RESULT CARD
// ═══════════════════════════════════════════════════════════════════════════

interface ResultCardProps {
  result: SearchResult;
  index: number;
  onSelect: () => void;
}

function ResultCard({ result, index, onSelect }: ResultCardProps) {
  const generalRating = computeGeneralRating(result);
  const taskRating = computeTaskRating(result);

  // Extract display values with safe fallbacks
  const sourceType = result.provenance?.sourceType || result.source;
  const threadTitle = result.provenance?.threadTitle;
  const authorRole = result.provenance?.authorRole;

  return (
    <article className="result-card" onClick={onSelect}>
      <div className="result-card__header">
        <span className="result-card__index">{index + 1}</span>
        <span className="result-card__source">
          {sourceType}
          {threadTitle && (
            <span className="result-card__title"> - {threadTitle}</span>
          )}
        </span>
        <span className="result-card__level">{getHierarchyLabel(result.hierarchyLevel)}</span>
      </div>

      <p className="result-card__preview">
        {result.enrichment?.summary || result.text.slice(0, 200)}
        {!result.enrichment?.summary && result.text.length > 200 && '...'}
      </p>

      <div className="result-card__footer">
        <div className="result-card__ratings">
          <span
            className="result-card__rating"
            title="General usefulness"
            style={{ color: getRatingColor(generalRating) }}
          >
            <span className="result-card__rating-icon">★</span>
            {generalRating.toFixed(1)}
          </span>
          <span
            className="result-card__rating result-card__rating--task"
            title="Task relevance"
            style={{ color: getRatingColor(taskRating) }}
          >
            <span className="result-card__rating-icon">◎</span>
            {taskRating.toFixed(1)}
          </span>
        </div>
        <span className="result-card__meta">
          {result.wordCount} words
          {authorRole && ` · ${authorRole}`}
        </span>
      </div>
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AUIConversation({
  apiBaseUrl = 'http://localhost:3030',
  onSelectResult,
  onResultsLoaded,
}: AUIConversationProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      id: 'welcome',
      role: 'aui',
      content:
        'I can help you search your archive. Ask me about topics, find similar content, or explore clusters of related ideas.',
      timestamp: Date.now(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Create session on mount
  useEffect(() => {
    fetch(`${apiBaseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'AUI Conversation' }),
    })
      .then((r) => r.json())
      .then((session) => setSessionId(session.id))
      .catch(console.error);
  }, [apiBaseUrl]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || isSearching || !sessionId) return;

      const userQuery = inputValue.trim();
      setInputValue('');
      setIsSearching(true);

      // Add user message
      const userMsgId = `user-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          role: 'user',
          content: userQuery,
          timestamp: Date.now(),
        },
      ]);

      // Add loading AUI message
      const auiMsgId = `aui-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: auiMsgId,
          role: 'aui',
          content: 'Searching...',
          timestamp: Date.now(),
          isLoading: true,
        },
      ]);

      try {
        // Call search API
        const response = await fetch(`${apiBaseUrl}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            query: userQuery,
            limit: 20,
            threshold: 0.3,
            autoEnrich: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`);
        }

        const data = await response.json();
        const results: SearchResult[] = data.results || [];

        // Update AUI message with results
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === auiMsgId
              ? {
                  ...msg,
                  content:
                    results.length > 0
                      ? `Found ${results.length} results for "${userQuery}". Here are the most relevant:`
                      : `No results found for "${userQuery}". Try a different query or explore clusters.`,
                  isLoading: false,
                  results: results.length > 0 ? results : undefined,
                }
              : msg
          )
        );

        onResultsLoaded?.(results);
      } catch (error) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === auiMsgId
              ? {
                  ...msg,
                  content: `Error: ${error instanceof Error ? error.message : 'Search failed'}`,
                  isLoading: false,
                }
              : msg
          )
        );
      } finally {
        setIsSearching(false);
      }
    },
    [inputValue, isSearching, sessionId, apiBaseUrl, onResultsLoaded]
  );

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      onSelectResult?.(result);
    },
    [onSelectResult]
  );

  return (
    <div className="aui-conversation">
      <div className="aui-conversation__messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`aui-conversation__message aui-conversation__message--${msg.role}`}
          >
            <div className="aui-conversation__message-content">
              <span className="aui-conversation__message-role">
                {msg.role === 'user' ? 'You' : 'AUI'}
              </span>
              <p className={msg.isLoading ? 'aui-conversation__message-loading' : ''}>
                {msg.content}
              </p>
              {msg.results && (
                <div className="aui-conversation__results">
                  {msg.results.map((result, i) => (
                    <ResultCard
                      key={result.id}
                      result={result}
                      index={i}
                      onSelect={() => handleSelectResult(result)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="aui-conversation__input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask about your archive..."
          disabled={isSearching || !sessionId}
        />
        <button type="submit" disabled={!inputValue.trim() || isSearching || !sessionId}>
          {isSearching ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
