import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import api from '@/lib/api-client';
import './ConversationViewer.css';

interface ConversationViewerProps {
  conversationId: string;
  onSelectContent?: (content: {
    text: string;
    source: 'conversation' | 'message' | 'custom';
    sourceId?: string;
    messageId?: string;
  } | null) => void;
}

interface Message {
  id: string;
  role: string;
  content: string;
  created_at?: string;
  images?: Array<{ file_id: string }>;
  isHidden?: boolean;  // For JSON/tool messages
  isExpanded?: boolean;  // For collapsible sections
}

type ViewMode = 'messages' | 'markdown' | 'html' | 'json';
type WidthMode = 'narrow' | 'medium' | 'wide' | 'xwide';

export default function ConversationViewer({ conversationId, onSelectContent }: ConversationViewerProps) {
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('messages');
  const [rawMarkdown, setRawMarkdown] = useState<string>('');
  const [rawJSON, setRawJSON] = useState<any>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [widthMode, setWidthMode] = useState<WidthMode>('narrow');
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    loadConversation();
  }, [conversationId]);

  const loadConversation = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get conversation metadata
      const conv = await api.getConversation(conversationId);
      setConversation(conv);
      setRawJSON(conv);

      // Render conversation with markdown
      const rendered = await api.renderConversation(conversationId, {
        include_media: true,
        filter_empty_messages: true,
      });

      // Store raw markdown for markdown view
      setRawMarkdown(rendered.markdown);

      // Parse markdown into message objects
      const parsedMessages = parseMarkdownToMessages(rendered.markdown, rendered.media_refs);

      // Mark JSON/tool messages as hidden by default
      // And move their images to adjacent messages
      const processedMessages = processMessages(parsedMessages);

      setMessages(processedMessages);

      setLoading(false);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
      setLoading(false);
    }
  };

  const isJSONContent = (content: string): boolean => {
    // Check if content looks like JSON
    const trimmed = content.trim();
    return (trimmed.startsWith('{') || trimmed.startsWith('[')) &&
           (trimmed.endsWith('}') || trimmed.endsWith(']'));
  };

  const processMessages = (messages: Message[]): Message[] => {
    const processed: Message[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isHidden = msg.role === 'tool' || isJSONContent(msg.content);

      // If this message should be hidden and has images, pass them to adjacent message
      if (isHidden && msg.images && msg.images.length > 0) {
        // Try to attach to previous user/assistant message
        for (let j = processed.length - 1; j >= 0; j--) {
          if (processed[j].role === 'user' || processed[j].role === 'assistant') {
            processed[j].images = [
              ...(processed[j].images || []),
              ...msg.images
            ];
            break;
          }
        }

        // If no previous message found, try next message
        if (!processed.some((m, idx) => idx === processed.length - 1 && m.images?.length)) {
          for (let j = i + 1; j < messages.length; j++) {
            if (messages[j].role === 'user' || messages[j].role === 'assistant') {
              messages[j].images = [
                ...(messages[j].images || []),
                ...msg.images
              ];
              break;
            }
          }
        }

        // Remove images from the hidden message
        msg.images = [];
      }

      processed.push({
        ...msg,
        isHidden,
      });
    }

    return processed;
  };

  const toggleMessageExpand = (messageId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const parseMarkdownToMessages = (markdown: string, _mediaRefs: any[]): Message[] => {
    // Parse markdown by looking for role indicators
    // Format is: 👤 **User** [timestamp] or 🤖 **Assistant** [timestamp]
    const messages: Message[] = [];
    const lines = markdown.split('\n');
    let currentMessage: Message | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      // Check for role indicators (emoji at start, then **Role**)
      if (line.match(/^👤 \*\*User\*\*/i) || line.match(/^\*\*User\*\*/i)) {
        if (currentMessage && currentContent.length > 0) {
          currentMessage.content = currentContent.join('\n').trim();
          if (currentMessage.content) {
            messages.push(currentMessage);
          }
        }
        currentMessage = {
          id: `msg-${messages.length}`,
          role: 'user',
          content: '',
        };
        currentContent = [];
      } else if (line.match(/^🤖 \*\*Assistant\*\*/i) || line.match(/^\*\*Assistant\*\*/i)) {
        if (currentMessage && currentContent.length > 0) {
          currentMessage.content = currentContent.join('\n').trim();
          if (currentMessage.content) {
            messages.push(currentMessage);
          }
        }
        currentMessage = {
          id: `msg-${messages.length}`,
          role: 'assistant',
          content: '',
        };
        currentContent = [];
      } else if (line.match(/^🔧 \*\*Tool\*\*/i) || line.match(/^\*\*Tool\*\*/i)) {
        if (currentMessage && currentContent.length > 0) {
          currentMessage.content = currentContent.join('\n').trim();
          if (currentMessage.content) {
            messages.push(currentMessage);
          }
        }
        currentMessage = {
          id: `msg-${messages.length}`,
          role: 'tool',
          content: '',
        };
        currentContent = [];
      } else if (currentMessage) {
        // Only add content if we're in a message
        currentContent.push(line);
      }
    }

    // Add last message
    if (currentMessage && currentContent.length > 0) {
      currentMessage.content = currentContent.join('\n').trim();
      if (currentMessage.content) {
        messages.push(currentMessage);
      }
    }

    return messages;
  };

  const handleEdit = (message: Message) => {
    // TODO: Open transformation modal
    console.log('Edit message:', message);
  };

  // Preprocess markdown to convert LaTeX delimiters for KaTeX
  // Pattern from working humanizer-agent implementation
  const preprocessLatex = (content: string): string => {
    if (!content) return '';

    let processed = content;

    // Protect code blocks from LaTeX processing
    const codeBlocks: string[] = [];
    processed = processed.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // STEP 1: Convert LaTeX display math \[ ... \] to $$...$$
    // KaTeX/rehype-katex expect $$ delimiters for display math
    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => {
      return '\n\n$$' + math.trim() + '$$\n\n';
    });

    // STEP 2: Convert LaTeX inline math \( ... \) to $...$
    // KaTeX/rehype-katex expect $ delimiters for inline math
    processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => {
      return '$' + math.trim() + '$';
    });

    // STEP 3: Wrap bare subscripts/superscripts in $ delimiters
    // Patterns like: ρ_i, E_i, x^2, p_i, |ψ_i⟩, etc.
    // Match: letter/symbol followed by _ or ^ and one or more chars
    processed = processed.replace(/([a-zA-ZρσψφθαβγδεζηικλμνξπτωΣΔΛΠΩ|⟨⟩])([_^])([a-zA-Z0-9ijk]+)/g,
      (_match, base, op, subscript) => {
        return `$${base}${op}{${subscript}}$`;
      }
    );

    // STEP 4: Handle bra-ket notation: |ψ⟩, ⟨ψ|
    processed = processed.replace(/\|([^|⟩\n]+)⟩/g, (_match, state) => {
      return `$|${state}\\rangle$`;
    });
    processed = processed.replace(/⟨([^⟨|\n]+)\|/g, (_match, state) => {
      return `$\\langle ${state}|$`;
    });

    // STEP 5: Clean up adjacent $ delimiters (merge them)
    processed = processed.replace(/\$\s*\$/g, ' ');
    processed = processed.replace(/\$([^\$\n]+)\$\s*\$([^\$\n]+)\$/g, '$$$1 $2$$');

    // Restore code blocks
    codeBlocks.forEach((block, i) => {
      processed = processed.replace(`__CODE_BLOCK_${i}__`, block);
    });

    return processed;
  };

  // Get navigable messages (skip hidden/empty messages)
  const getNavigableMessages = () => {
    return messages.filter(msg => !msg.isHidden && msg.content.trim().length > 0);
  };

  const navigableMessages = getNavigableMessages();
  const totalNavigableMessages = navigableMessages.length;

  const goToPreviousMessage = () => {
    if (currentMessageIndex > 0) {
      setCurrentMessageIndex(currentMessageIndex - 1);
      // Scroll to the message
      const messageId = navigableMessages[currentMessageIndex - 1]?.id;
      if (messageId) {
        document.getElementById(messageId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const goToNextMessage = () => {
    if (currentMessageIndex < totalNavigableMessages - 1) {
      setCurrentMessageIndex(currentMessageIndex + 1);
      // Scroll to the message
      const messageId = navigableMessages[currentMessageIndex + 1]?.id;
      if (messageId) {
        document.getElementById(messageId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleUseInTools = (message: Message) => {
    if (onSelectContent) {
      onSelectContent({
        text: message.content,
        source: 'message',
        sourceId: conversationId,
        messageId: message.id,
      });
    }
  };

  const handleUseConversation = () => {
    if (onSelectContent) {
      // Combine all non-hidden messages
      const allText = messages
        .filter(m => !m.isHidden || expandedMessages.has(m.id))
        .map(m => `[${m.role}]\n${m.content}`)
        .join('\n\n');

      onSelectContent({
        text: allText,
        source: 'conversation',
        sourceId: conversationId,
      });
    }
  };

  // Get width class based on mode
  const getWidthClass = () => {
    switch (widthMode) {
      case 'narrow': return 'width-narrow';
      case 'medium': return 'width-medium';
      case 'wide': return 'width-wide';
      case 'xwide': return 'width-xwide';
      default: return 'width-narrow';
    }
  };

  if (loading) {
    return (
      <div className="conversation-viewer-loading">
        <div className="loading-spinner"></div>
        <p>Loading conversation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="conversation-viewer-error">
        <p className="error-icon">⚠️</p>
        <p className="error-text">{error}</p>
        <button className="retry-button" onClick={loadConversation}>
          Retry
        </button>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="conversation-viewer-empty">
        <p>Select a conversation to view</p>
      </div>
    );
  }

  return (
    <div className="conversation-viewer">
      <div className="conversation-header">
        <div className="conversation-title-row">
          <h1 className="conversation-title">{conversation.title || 'Untitled'}</h1>

          {/* Message Navigation */}
          {viewMode === 'messages' && totalNavigableMessages > 0 && (
            <div className="message-navigation">
              <button
                className="nav-button"
                onClick={goToPreviousMessage}
                disabled={currentMessageIndex === 0}
                title="Previous message"
              >
                ◀ Previous
              </button>
              <span className="message-position">
                {currentMessageIndex + 1} of {totalNavigableMessages}
              </span>
              <button
                className="nav-button"
                onClick={goToNextMessage}
                disabled={currentMessageIndex === totalNavigableMessages - 1}
                title="Next message"
              >
                Next ▶
              </button>
            </div>
          )}
        </div>

        <div className="conversation-metadata">
          <span className="metadata-item">
            {conversation.message_count} messages
          </span>
          {conversation.created_at && (
            <span className="metadata-item">
              {new Date(conversation.created_at).toLocaleDateString()}
            </span>
          )}
          <span className="metadata-item">
            {conversation.source_archive}
          </span>
        </div>

        {/* View Mode Toggle */}
        <div className="view-mode-toggle">
          <button
            className={`view-mode-button ${viewMode === 'messages' ? 'active' : ''}`}
            onClick={() => setViewMode('messages')}
          >
            💬 Messages
          </button>
          <button
            className={`view-mode-button ${viewMode === 'markdown' ? 'active' : ''}`}
            onClick={() => setViewMode('markdown')}
          >
            📝 Markdown
          </button>
          <button
            className={`view-mode-button ${viewMode === 'html' ? 'active' : ''}`}
            onClick={() => setViewMode('html')}
          >
            🌐 HTML
          </button>
          <button
            className={`view-mode-button ${viewMode === 'json' ? 'active' : ''}`}
            onClick={() => setViewMode('json')}
          >
            {} JSON
          </button>
        </div>

        {/* Width Toggle */}
        {(viewMode === 'messages' || viewMode === 'html') && (
          <div className="width-toggle">
            <button
              className={`width-button ${widthMode === 'narrow' ? 'active' : ''}`}
              onClick={() => setWidthMode('narrow')}
              title="Narrow (700px)"
            >
              Narrow
            </button>
            <button
              className={`width-button ${widthMode === 'medium' ? 'active' : ''}`}
              onClick={() => setWidthMode('medium')}
              title="Medium (1240px)"
            >
              Medium
            </button>
            <button
              className={`width-button ${widthMode === 'wide' ? 'active' : ''}`}
              onClick={() => setWidthMode('wide')}
              title="Wide (1600px)"
            >
              Wide
            </button>
          </div>
        )}

        {/* Tools Action */}
        {onSelectContent && (
          <div className="tools-action">
            <button
              className="use-in-tools-button"
              onClick={handleUseConversation}
              title="Use entire conversation in transformation tools"
            >
              🔄 Use in Tools
            </button>
          </div>
        )}
      </div>

      {/* Messages View */}
      {viewMode === 'messages' && (
        <div className="messages-container">
          <div className={`messages-wrapper ${getWidthClass()}`}>
            {messages.map((msg) => {
              const isExpanded = expandedMessages.has(msg.id);
              const shouldHide = msg.isHidden && !isExpanded;

              if (shouldHide) {
                return (
                  <div key={msg.id} id={msg.id} className="message-card message-hidden">
                    <button
                      className="expand-button"
                      onClick={() => toggleMessageExpand(msg.id)}
                    >
                      <span className="chevron">▶</span>
                      <span className="role-label">{msg.role}</span>
                      <span className="hidden-label">(hidden - click to expand)</span>
                    </button>
                  </div>
                );
              }

              return (
                <div key={msg.id} id={msg.id} className={`message-card message-${msg.role}`}>
                <div className="message-header">
                  {msg.isHidden && (
                    <button
                      className="collapse-button"
                      onClick={() => toggleMessageExpand(msg.id)}
                      title="Collapse"
                    >
                      <span className="chevron">▼</span>
                    </button>
                  )}
                  <span className="role-icon">
                    {msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '🔧'}
                  </span>
                  <span className="role-label">{msg.role}</span>
                  {msg.created_at && (
                    <span className="message-timestamp">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                  )}
                  {onSelectContent && (
                    <button
                      className="message-use-tools"
                      onClick={() => handleUseInTools(msg)}
                      title="Use this message in transformation tools"
                    >
                      🔄
                    </button>
                  )}
                </div>

                <div className="message-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {preprocessLatex(msg.content)}
                  </ReactMarkdown>

                  {msg.images?.map((img) => (
                    <img
                      key={img.file_id}
                      src={api.getMediaFile(img.file_id)}
                      alt="Message attachment"
                      className="message-image"
                    />
                  ))}
                </div>

                <div className="message-actions">
                  <button
                    className="action-button edit-button"
                    onClick={() => handleEdit(msg)}
                  >
                    ✏️ Edit
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Raw Markdown View */}
      {viewMode === 'markdown' && (
        <div className="raw-view markdown-view">
          <div className="raw-view-header">
            <button
              className="copy-button"
              onClick={() => navigator.clipboard.writeText(rawMarkdown)}
            >
              📋 Copy
            </button>
          </div>
          <pre className="raw-content">{rawMarkdown}</pre>
        </div>
      )}

      {/* HTML View */}
      {viewMode === 'html' && (
        <div className="raw-view html-view">
          <div className="raw-view-header">
            <button
              className="copy-button"
              onClick={() => {
                const html = document.querySelector('.rendered-html')?.innerHTML || '';
                navigator.clipboard.writeText(html);
              }}
            >
              📋 Copy HTML
            </button>
          </div>
          <div className={`rendered-html ${getWidthClass()}`}>
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {preprocessLatex(rawMarkdown)}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* JSON View */}
      {viewMode === 'json' && (
        <div className="raw-view json-view">
          <div className="raw-view-header">
            <button
              className="copy-button"
              onClick={() => navigator.clipboard.writeText(JSON.stringify(rawJSON, null, 2))}
            >
              📋 Copy JSON
            </button>
          </div>
          <pre className="raw-content json-content">
            {JSON.stringify(rawJSON, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
