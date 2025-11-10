/**
 * Dialogue Panel Component
 * Chat interface for conversational attribute extraction
 */

import React, { useState, useRef, useEffect } from 'react';
import type { DialogueMessage, AttributeDefinition } from './types';

interface DialoguePanelProps {
  messages: DialogueMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onDefinitionReceived?: (definition: AttributeDefinition, dialogueId?: string) => void;
}

export const DialoguePanel: React.FC<DialoguePanelProps> = ({
  messages,
  isLoading,
  onSendMessage,
  // onDefinitionReceived, // unused
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              Start by describing what you'd like to create...
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-200'
                  }`}
                >
                  {message.role === 'assistant' && message.content.includes('\n') ? (
                    // Format multi-line assistant responses (questions)
                    <div className="space-y-2">
                      {message.content.split('\n').filter(line => line.trim()).map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-gray-400 text-sm">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="border-t border-gray-800 p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              !input.trim() || isLoading
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};