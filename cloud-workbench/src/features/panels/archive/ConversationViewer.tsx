import { useState, useEffect } from 'react';
import { parseConversation, type ParsedConversation } from '../../../lib/conversation-parser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import '../../canvas/Canvas.css';

interface ConversationViewerProps {
  conversationJson: string;
  fileId: string;
  onLoadImages?: (fileId: string) => Promise<Map<string, string>>; // file-id -> object URL
}

/**
 * ConversationViewer - Renders encrypted conversation archives
 *
 * Features:
 * - Parses ChatGPT and Claude conversation formats
 * - Renders markdown with tables, code blocks, and LaTeX
 * - Displays images from encrypted storage
 * - Reuses Canvas.tsx rendering pipeline
 */
export function ConversationViewer({ conversationJson, fileId, onLoadImages }: ConversationViewerProps) {
  const [parsed, setParsed] = useState<ParsedConversation | null>(null);
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConversation();
  }, [conversationJson]);

  const loadConversation = async () => {
    try {
      setLoading(true);
      setError(null);

      // Parse conversation JSON
      const data = JSON.parse(conversationJson);
      const parsed = parseConversation(data);
      setParsed(parsed);

      // Load images if available
      if (onLoadImages && parsed.metadata.has_images) {
        const urls = await onLoadImages(fileId);
        setImageUrls(urls);
      }
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
      setError(err.message || 'Failed to parse conversation');
    } finally {
      setLoading(false);
    }
  };

  const processContent = (content: string): string => {
    // Step 1: Convert image placeholders to <img> tags
    let processed = convertMediaLinks(content);

    // Step 2: Fix malformed single-row tables (like Canvas.tsx does)
    processed = fixMalformedTables(processed);

    // Step 3: Process LaTeX (inline and block)
    processed = processLatex(processed);

    // Step 4: Convert markdown to HTML
    let html = marked(processed, {
      breaks: true,
      gfm: true,
    }) as string;

    // Step 5: Sanitize HTML
    html = DOMPurify.sanitize(html, {
      ADD_TAGS: ['iframe'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling'],
    });

    return html;
  };

  const convertMediaLinks = (text: string): string => {
    // Convert [Image: file-XXXXX] to <img> tags with decrypted URLs
    return text.replace(/\[Image:\s*(file-[^\]]+)\]/g, (_match, fileId) => {
      const imageUrl = imageUrls.get(fileId);
      if (imageUrl) {
        return `<img src="${imageUrl}" alt="${fileId}" class="conversation-image" />`;
      }
      // Fallback: show placeholder if image not loaded yet
      return `<div class="image-placeholder">🖼️ Loading image: ${fileId}</div>`;
    });
  };

  const fixMalformedTables = (text: string): string => {
    // Fix tables with only header row (common in ChatGPT exports)
    const lines = text.split('\n');
    const fixedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      fixedLines.push(line);

      // If this line looks like a table header (has |)
      if (line.trim().match(/^\|.*\|$/)) {
        const nextLine = lines[i + 1];
        // If next line is NOT a separator (|---|---|), add one
        if (!nextLine || !nextLine.trim().match(/^\|[\s\-:]+\|$/)) {
          const cols = line.split('|').filter(Boolean);
          const separator = '| ' + cols.map(() => '---').join(' | ') + ' |';
          fixedLines.push(separator);
        }
      }
    }

    return fixedLines.join('\n');
  };

  const processLatex = (text: string): string => {
    // Process block LaTeX: $...$ or \[...\]
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, latex) => {
      try {
        return katex.renderToString(latex, { displayMode: true, throwOnError: false });
      } catch (e) {
        return match;
      }
    });

    text = text.replace(/\\\[([\s\S]+?)\\\]/g, (match, latex) => {
      try {
        return katex.renderToString(latex, { displayMode: true, throwOnError: false });
      } catch (e) {
        return match;
      }
    });

    // Process inline LaTeX: $...$ or \(...\)
    text = text.replace(/\$([^\$\n]+?)\$/g, (match, latex) => {
      try {
        return katex.renderToString(latex, { displayMode: false, throwOnError: false });
      } catch (e) {
        return match;
      }
    });

    text = text.replace(/\\\(([^\)]+?)\\\)/g, (match, latex) => {
      try {
        return katex.renderToString(latex, { displayMode: false, throwOnError: false });
      } catch (e) {
        return match;
      }
    });

    return text;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <div className="text-center space-y-2">
          <div className="text-4xl">⏳</div>
          <p>Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        <div className="text-center space-y-2">
          <div className="text-4xl">❌</div>
          <p className="font-medium">Failed to Load Conversation</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <p>No conversation data</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-100 mb-1">
              {parsed.metadata.title}
            </h2>
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                parsed.metadata.provider === 'chatgpt'
                  ? 'bg-green-900/40 text-green-300'
                  : 'bg-purple-900/40 text-purple-300'
              }`}>
                {parsed.metadata.provider === 'chatgpt' ? '💬 ChatGPT' : '🤖 Claude'}
              </span>
              <span>💬 {parsed.metadata.message_count} messages</span>
              {parsed.metadata.has_images && <span>🖼️ Images</span>}
              {parsed.metadata.has_code && <span>💻 Code</span>}
              {parsed.metadata.created_at && (
                <span>📅 {new Date(parsed.metadata.created_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {parsed.messages.map((message, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${
              message.role === 'user'
                ? 'bg-slate-800 border border-slate-700'
                : 'bg-slate-850 border border-slate-750'
            }`}
          >
            {/* Message header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-slate-300">
                {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
              </span>
              {message.timestamp !== undefined && (
                <span className="text-xs text-slate-500">
                  {new Date(message.timestamp).toLocaleString()}
                </span>
              )}
            </div>

            {/* Message content */}
            <div
              className="prose prose-invert prose-sm max-w-none canvas-content"
              dangerouslySetInnerHTML={{ __html: processContent(message.content) }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
