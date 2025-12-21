/**
 * ChatPane - AUI Chatbot Tool
 *
 * Conversational AI interface for:
 * - Discussing and analyzing content from the buffer
 * - Iterative content transformation through conversation
 * - Multi-provider LLM support (Ollama, Cloudflare, OpenAI, Anthropic, Groq)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToolState } from '../../contexts/ToolTabContext';
import { useProvider } from '../../contexts/ProviderContext';
import type { ChatThread, ChatMessage, ChatProvider } from '../../types/chat';
import * as chatService from '../../services/chatService';

interface ChatPaneProps {
  content: string;
  onApplyTransform?: (text: string) => void;
}

export function ChatPane({ content, onApplyTransform }: ChatPaneProps) {
  const [state, setState] = useToolState('chat');
  const { isOllamaAvailable, isElectron } = useProvider();

  // Local state
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load threads on mount
  useEffect(() => {
    const loadedThreads = chatService.loadThreads();
    setThreads(loadedThreads);

    // Restore active thread if one was selected
    if (state.activeThreadId) {
      const thread = loadedThreads.find(t => t.id === state.activeThreadId);
      if (thread) {
        setActiveThread(thread);
      }
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages]);

  // Create new thread
  const handleNewThread = useCallback(() => {
    const thread = chatService.createThread(null, 'ephemeral');
    setThreads(prev => [thread, ...prev]);
    setActiveThread(thread);
    setState({ activeThreadId: thread.id });
    setError(null);
  }, [setState]);

  // Select thread
  const handleSelectThread = useCallback((threadId: string) => {
    const thread = threads.find(t => t.id === threadId);
    if (thread) {
      setActiveThread(thread);
      setState({ activeThreadId: threadId });
      setError(null);
    }
  }, [threads, setState]);

  // Delete thread
  const handleDeleteThread = useCallback((threadId: string) => {
    if (confirm('Delete this chat thread?')) {
      chatService.deleteThread(threadId);
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (activeThread?.id === threadId) {
        setActiveThread(null);
        setState({ activeThreadId: null });
      }
    }
  }, [activeThread, setState]);

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || !activeThread || isLoading) return;

    const messageContent = inputValue.trim();
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await chatService.sendMessage(
        activeThread.id,
        messageContent,
        {
          provider: state.selectedProvider,
          model: state.selectedModel,
          includeBufferContext: content.length > 0,
          bufferContent: content,
        }
      );

      // Update local state with the updated thread
      setActiveThread(response.thread);
      setThreads(prev =>
        prev.map(t => (t.id === response.thread.id ? response.thread : t))
      );
    } catch (err) {
      console.error('[ChatPane] Send failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [inputValue, activeThread, isLoading, state.selectedProvider, state.selectedModel, content]);

  // Handle Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Apply assistant message to buffer
  const handleApplyToBuffer = useCallback((messageContent: string) => {
    if (onApplyTransform) {
      onApplyTransform(messageContent);
    }
  }, [onApplyTransform]);

  // Provider selector change
  const handleProviderChange = useCallback((provider: ChatProvider) => {
    const defaultModel = chatService.getDefaultModel(provider);
    setState({ selectedProvider: provider, selectedModel: defaultModel });
  }, [setState]);

  // Get available models for current provider
  const availableModels = chatService.getModelsForProvider(state.selectedProvider);

  // Check if current provider is available
  const isProviderAvailable = useCallback((provider: ChatProvider): boolean => {
    if (provider === 'ollama') {
      return isElectron && isOllamaAvailable;
    }
    if (provider === 'cloudflare') {
      return true; // Always available if backend is up
    }
    // For API providers, check if key is configured
    return !!chatService.getApiKey(provider);
  }, [isElectron, isOllamaAvailable]);

  return (
    <div className="chat-pane">
      {/* Header with thread selector */}
      <div className="chat-pane__header">
        <div className="chat-pane__thread-row">
          <select
            className="chat-pane__thread-select"
            value={activeThread?.id || ''}
            onChange={(e) => e.target.value && handleSelectThread(e.target.value)}
          >
            <option value="" disabled>Select a chat...</option>
            {threads.map(thread => (
              <option key={thread.id} value={thread.id}>
                {thread.title}
              </option>
            ))}
          </select>
          <button
            className="chat-pane__btn chat-pane__btn--new"
            onClick={handleNewThread}
            title="Start new chat"
          >
            +
          </button>
          <button
            className="chat-pane__btn chat-pane__btn--settings"
            onClick={() => setShowSettings(!showSettings)}
            title="Chat settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Settings panel (collapsible) */}
      {showSettings && (
        <div className="chat-pane__settings">
          <div className="chat-pane__setting-row">
            <label className="chat-pane__setting-label">Provider</label>
            <select
              className="chat-pane__setting-select"
              value={state.selectedProvider}
              onChange={(e) => handleProviderChange(e.target.value as ChatProvider)}
            >
              <option value="ollama" disabled={!isProviderAvailable('ollama')}>
                Ollama (Local) {!isProviderAvailable('ollama') && '(unavailable)'}
              </option>
              <option value="cloudflare">Cloudflare AI</option>
              <option value="openai" disabled={!isProviderAvailable('openai')}>
                OpenAI {!isProviderAvailable('openai') && '(no key)'}
              </option>
              <option value="anthropic" disabled={!isProviderAvailable('anthropic')}>
                Anthropic {!isProviderAvailable('anthropic') && '(no key)'}
              </option>
              <option value="groq" disabled={!isProviderAvailable('groq')}>
                Groq {!isProviderAvailable('groq') && '(no key)'}
              </option>
            </select>
          </div>
          <div className="chat-pane__setting-row">
            <label className="chat-pane__setting-label">Model</label>
            <select
              className="chat-pane__setting-select"
              value={state.selectedModel}
              onChange={(e) => setState({ selectedModel: e.target.value })}
            >
              {availableModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          {/* Buffer context indicator */}
          {content.length > 0 && (
            <div className="chat-pane__context-indicator">
              <span className="chat-pane__context-icon">📄</span>
              <span className="chat-pane__context-text">
                {content.length.toLocaleString()} chars loaded as context
              </span>
            </div>
          )}
        </div>
      )}

      {/* Messages area */}
      <div className="chat-pane__messages">
        {!activeThread ? (
          <div className="chat-pane__empty">
            <div className="chat-pane__empty-icon">💬</div>
            <div className="chat-pane__empty-text">
              Start a new chat to discuss your content
            </div>
            <button
              className="chat-pane__btn chat-pane__btn--primary"
              onClick={handleNewThread}
            >
              Start New Chat
            </button>
          </div>
        ) : activeThread.messages.length === 0 ? (
          <div className="chat-pane__empty">
            <div className="chat-pane__empty-text">
              {content.length > 0
                ? 'Ask me about your content, or request edits and suggestions.'
                : 'Start typing to chat. Load content from the archive for context-aware assistance.'}
            </div>
          </div>
        ) : (
          activeThread.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onApply={message.role === 'assistant' ? () => handleApplyToBuffer(message.content) : undefined}
            />
          ))
        )}
        <div ref={messagesEndRef} />

        {/* Loading indicator */}
        {isLoading && (
          <div className="chat-pane__loading">
            <div className="chat-pane__loading-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="chat-pane__error">
          {error}
        </div>
      )}

      {/* Input area */}
      {activeThread && (
        <div className="chat-pane__input-area">
          <textarea
            ref={inputRef}
            className="chat-pane__input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            disabled={isLoading}
            rows={2}
          />
          <button
            className="chat-pane__btn chat-pane__btn--send"
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            title="Send message"
          >
            {isLoading ? '...' : '▶'}
          </button>
        </div>
      )}

      {/* Delete thread button */}
      {activeThread && (
        <div className="chat-pane__footer">
          <button
            className="chat-pane__btn chat-pane__btn--danger"
            onClick={() => handleDeleteThread(activeThread.id)}
          >
            Delete Chat
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Message Bubble Component
// ============================================================

interface MessageBubbleProps {
  message: ChatMessage;
  onApply?: () => void;
}

function MessageBubble({ message, onApply }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div className={`chat-pane__message chat-pane__message--${message.role}`}>
      <div className="chat-pane__message-header">
        <span className="chat-pane__message-role">
          {isUser ? 'You' : isSystem ? 'System' : 'Assistant'}
        </span>
        <span className="chat-pane__message-time">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="chat-pane__message-content">
        {message.content}
      </div>
      {onApply && !isUser && (
        <button
          className="chat-pane__btn chat-pane__btn--apply"
          onClick={onApply}
          title="Apply this text to the buffer"
        >
          Apply to Buffer
        </button>
      )}
      {message.metadata?.model && (
        <div className="chat-pane__message-meta">
          {message.metadata.model.split('/').pop()}
          {message.metadata.processingTimeMs && ` • ${message.metadata.processingTimeMs}ms`}
        </div>
      )}
    </div>
  );
}
