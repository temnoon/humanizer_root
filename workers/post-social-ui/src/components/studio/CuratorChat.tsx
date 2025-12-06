/**
 * Curator Chat Component
 *
 * Chat interface for conversing with a node's curator.
 * Features semantic search through the corpus with cited passages.
 */

import { Component, Show, For, createSignal, onMount, createEffect } from 'solid-js';
import {  curatorChatService, type ChatTurn, type CitedPassage } from '@/services/curator-chat';
import { AnimatedResponse } from './AnimatedText';
import { toast } from '@/components/ui/Toast';
import './CuratorChat.css';

interface CuratorChatProps {
  nodeId: string;
  className?: string;
}

export const CuratorChat: Component<CuratorChatProps> = (props) => {
  const [sessionId, setSessionId] = createSignal<string>('');
  const [turns, setTurns] = createSignal<ChatTurn[]>([]);
  const [citedPassages, setCitedPassages] = createSignal<Record<number, CitedPassage[]>>({});
  const [inputText, setInputText] = createSignal('');
  const [sending, setSending] = createSignal(false);

  let messagesEndRef: HTMLDivElement | undefined;
  let textareaRef: HTMLTextAreaElement | undefined;

  // Generate session ID on mount
  onMount(() => {
    setSessionId(curatorChatService.generateSessionId());
  });

  // Auto-scroll to bottom when new messages arrive
  createEffect(() => {
    if (turns().length > 0 && messagesEndRef) {
      messagesEndRef.scrollIntoView({ behavior: 'smooth' });
    }
  });

  const handleSendMessage = async () => {
    const message = inputText().trim();
    if (!message || sending()) return;

    setSending(true);
    const userTurn: ChatTurn = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    // Optimistically add user message
    setTurns(prev => [...prev, userTurn]);
    setInputText('');

    try {
      const response = await curatorChatService.sendChatMessage(
        props.nodeId,
        message,
        sessionId()
      );

      // Add curator response
      const curatorTurn: ChatTurn = {
        role: 'curator',
        content: response.response,
        timestamp: Date.now(),
      };

      setTurns(prev => [...prev, curatorTurn]);

      // Store cited passages for this turn
      if (response.passagesCited && response.passagesCited.length > 0) {
        setCitedPassages(prev => ({
          ...prev,
          [turns().length]: response.passagesCited,
        }));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic user message on error
      setTurns(prev => prev.slice(0, -1));
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
      textareaRef?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div class={`curator-chat ${props.className || ''}`}>
      {/* Chat Header */}
      <div class="chat-header">
        <div class="header-content">
          <h3>Chat with the Curator</h3>
          <p class="header-description">
            Ask questions about the text. The curator responds with insights grounded in the source.
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div class="chat-messages">
        <Show
          when={turns().length > 0}
          fallback={
            <div class="chat-empty">
              <div class="empty-icon">💬</div>
              <h4>Start a Conversation</h4>
              <p>Ask the curator about themes, characters, or connections to other works.</p>
              <div class="suggested-questions">
                <p class="suggested-label">Try asking:</p>
                <button
                  class="suggested-question"
                  onClick={() => setInputText('What is the central question of this text?')}
                >
                  What is the central question of this text?
                </button>
                <button
                  class="suggested-question"
                  onClick={() => setInputText('How does this connect to contemporary issues?')}
                >
                  How does this connect to contemporary issues?
                </button>
                <button
                  class="suggested-question"
                  onClick={() => setInputText('Tell me about the main themes.')}
                >
                  Tell me about the main themes.
                </button>
              </div>
            </div>
          }
        >
          <For each={turns()}>
            {(turn, index) => (
              <div class={`chat-turn ${turn.role}`}>
                <div class="turn-header">
                  <span class="turn-role">
                    {turn.role === 'user' ? '👤 You' : '🤖 Curator'}
                  </span>
                  <span class="turn-time">
                    {new Date(turn.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div class="turn-content">
                  <Show
                    when={turn.role === 'curator'}
                    fallback={<p>{turn.content}</p>}
                  >
                    <AnimatedResponse
                      content={turn.content}
                      delay={100}
                      speed={50}
                    />
                  </Show>
                </div>

                {/* Cited Passages */}
                <Show when={turn.role === 'curator' && citedPassages()[index()]}>
                  <div class="cited-passages">
                    <h5 class="passages-header">📖 Referenced Passages</h5>
                    <For each={citedPassages()[index()]}>
                      {(passage) => (
                        <div class="passage-card">
                          <div class="passage-quote">
                            "{passage.quote}..."
                          </div>
                          <div class="passage-meta">
                            <span class="passage-citation">{passage.citation}</span>
                            <span class="passage-relevance">
                              {Math.round(passage.relevance * 100)}% relevant
                            </span>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            )}
          </For>
          <div ref={messagesEndRef} />
        </Show>
      </div>

      {/* Input Area */}
      <div class="chat-input-area">
        <textarea
          ref={textareaRef}
          class="chat-input"
          placeholder="Ask the curator anything..."
          value={inputText()}
          onInput={(e) => setInputText(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          disabled={sending()}
          rows={2}
        />
        <div class="input-actions">
          <span class="input-hint">
            <Show when={!sending()} fallback={<>Sending...</>}>
              Press Enter to send, Shift+Enter for new line
            </Show>
          </span>
          <button
            class="send-button"
            onClick={handleSendMessage}
            disabled={!inputText().trim() || sending()}
          >
            {sending() ? '⏳' : '📤'} Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default CuratorChat;
