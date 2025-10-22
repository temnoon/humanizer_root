import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import './AgentPrompt.css';
import { api } from '@/lib/api-client';

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  tool_call?: {
    tool: string;
    parameters: Record<string, any>;
  };
  tool_result?: any;
  gui_action?: string;
  timestamp: Date;
}

interface AgentPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
  messages: AgentMessage[];
  isLoading: boolean;
  conversationId: string | null;
  onConversationChange: (conversationId: string | null) => void;
}

export default function AgentPrompt({
  isOpen,
  onClose,
  onSubmit,
  messages,
  isLoading,
  conversationId,
  onConversationChange
}: AgentPromptProps) {
  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [showConversationList, setShowConversationList] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Focus input and load conversations when opened
  useEffect(() => {
    if (isOpen) {
      if (inputRef.current) {
        inputRef.current.focus();
      }
      loadConversations();
    }
  }, [isOpen]);

  const loadConversations = async () => {
    try {
      const response = await api.getAgentConversations();
      // API returns {conversations: [...], total: N}
      setConversations(response.conversations || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setConversations([]);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Escape key to close
  useEffect(() => {
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    await onSubmit(message);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="agent-prompt-overlay" onClick={onClose}>
      <div className="agent-prompt-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="agent-prompt-header">
          <div className="agent-prompt-title">
            <span className="agent-icon">🤖</span>
            <span>Agentic UI</span>
          </div>
          <div className="agent-conversation-controls">
            <button
              className="agent-conversation-btn"
              onClick={() => setShowConversationList(!showConversationList)}
              title="View conversation history"
            >
              📚 {conversationId ? 'Switch' : 'History'} ({conversations.length})
            </button>
            {conversationId && (
              <button
                className="agent-new-conversation-btn"
                onClick={() => onConversationChange(null)}
                title="Start new conversation"
              >
                ➕ New
              </button>
            )}
          </div>
          <button className="agent-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Conversation List Dropdown */}
        {showConversationList && (
          <div className="agent-conversation-list">
            <div className="agent-conversation-list-header">
              <h4>Conversation History</h4>
              <button onClick={() => setShowConversationList(false)}>Close</button>
            </div>
            <div className="agent-conversation-list-items">
              {conversations.length === 0 ? (
                <div className="agent-conversation-empty">No conversations yet</div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    className={`agent-conversation-item ${conv.id === conversationId ? 'active' : ''}`}
                    onClick={() => {
                      onConversationChange(conv.id);
                      setShowConversationList(false);
                    }}
                  >
                    <div className="agent-conversation-item-title">
                      {conv.title || `Conversation ${conv.id.slice(0, 8)}...`}
                    </div>
                    <div className="agent-conversation-item-meta">
                      {conv.message_count} messages • {new Date(conv.created_at).toLocaleDateString()}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="agent-messages">
          {messages.length === 0 ? (
            <div className="agent-welcome">
              <h3>What would you like to do?</h3>
              <p>Try asking:</p>
              <ul>
                <li>"Find conversations about consciousness"</li>
                <li>"Show me similar messages to this one"</li>
                <li>"Transform this text to be more formal"</li>
                <li>"Analyze the semantic direction between casual and formal"</li>
              </ul>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`agent-message agent-message-${msg.role}`}>
                <div className="agent-message-role">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="agent-message-content">
                  <div className="agent-message-text">{msg.content}</div>

                  {/* Show tool call if present */}
                  {msg.tool_call && (
                    <div className="agent-tool-call">
                      <span className="agent-tool-icon">🔧</span>
                      <span className="agent-tool-name">{msg.tool_call.tool}</span>
                      <code className="agent-tool-params">
                        {JSON.stringify(msg.tool_call.parameters, null, 2)}
                      </code>
                    </div>
                  )}

                  {/* Show GUI action if present */}
                  {msg.gui_action && (
                    <div className="agent-gui-action">
                      <span className="agent-action-icon">🎯</span>
                      <span>Action: {msg.gui_action}</span>
                    </div>
                  )}

                  <div className="agent-message-time">
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="agent-message agent-message-assistant">
              <div className="agent-message-role">🤖</div>
              <div className="agent-message-content">
                <div className="agent-loading">
                  <span className="agent-loading-dot">●</span>
                  <span className="agent-loading-dot">●</span>
                  <span className="agent-loading-dot">●</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="agent-input-container">
          <input
            ref={inputRef}
            type="text"
            className="agent-input"
            placeholder="Ask me anything... (Press Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className="agent-submit-btn"
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
          >
            Send
          </button>
        </div>

        {/* Footer hint */}
        <div className="agent-footer">
          Press <kbd>Esc</kbd> to close • <kbd>Enter</kbd> to send
        </div>
      </div>
    </div>
  );
}
