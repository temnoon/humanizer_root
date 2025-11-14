import { useState, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './Canvas.css';
import { useArchive } from '../../core/context/ArchiveContext';
import { useCanvas } from '../../core/context/CanvasContext';

type CenterPaneTab = 'edit' | 'render';

const ARCHIVE_API = 'http://localhost:3002';

interface MediaMapping {
  fileMapping: Record<string, string>;
  mediaMapping: Record<string, string>;
}

export function Canvas() {
  const { selectedConv, selectedMessageIndex, nextMessage, prevMessage } = useArchive();
  const { text, setText, selectedText, setSelectedText, setSourceType, clearSelection } = useCanvas();
  const [centerTab, setCenterTab] = useState<CenterPaneTab>('render');
  const [editedContent, setEditedContent] = useState('');
  const [renderedHtml, setRenderedHtml] = useState('');
  const [mediaMapping, setMediaMapping] = useState<MediaMapping | null>(null);

  const currentMessage = selectedMessageIndex !== null && selectedConv?.messages[selectedMessageIndex]
    ? selectedConv.messages[selectedMessageIndex]
    : null;

  // Handle text selection in render view
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const selectedStr = selection?.toString().trim();

    if (selectedStr && selectedStr.length > 0) {
      setSelectedText(selectedStr);
      setSourceType('selection');
    } else {
      clearSelection();
    }
  };

  // Send selected text to tools
  const handleSendToTool = () => {
    if (selectedText) {
      // Selection is already in context, tools will read it
      // Could trigger tool panel here if needed
      console.log('Sending selection to tools:', selectedText.substring(0, 50) + '...');
    }
  };

  // Convert [Image: file-XXX] placeholders to actual img tags
  const convertMediaLinks = (text: string): string => {
    if (!mediaMapping || !selectedConv) {
      console.log('convertMediaLinks: No media mapping or conversation');
      return text;
    }

    let convertCount = 0;
    // Match both file-XXXXX (old-style) and file_XXXXX (sediment new-style)
    const result = text.replace(/\[Image: (file[-_][^\]]+)\]/g, (_match, fileId) => {
      // Look up the hashed filename in media mapping
      const hashedName = mediaMapping.mediaMapping[fileId];
      if (hashedName) {
        convertCount++;
        const imgUrl = `${ARCHIVE_API}/api/conversations/${encodeURIComponent(selectedConv.folder)}/media/${hashedName}`;
        return `<img src="${imgUrl}" alt="Image" loading="lazy" style="max-width: 100%; height: auto; border-radius: 8px; margin: 1em 0;">`;
      }
      // If not found, leave as placeholder
      console.warn(`Image not found in mapping: ${fileId}`);
      return `<em>[Image: ${fileId}]</em>`;
    });

    console.log(`convertMediaLinks: Converted ${convertCount} images`);
    return result;
  };

  // Process LaTeX and markdown (same approach as conversation.html)
  const processContent = (text: string): string => {
    let processed = text;

    // Convert image placeholders to img tags FIRST
    processed = convertMediaLinks(processed);

    // Protect code blocks
    const codeBlocks: string[] = [];
    processed = processed.replace(/```[\s\S]*?```|`[^`]+`/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // Process LaTeX with KaTeX - Priority: \[ \], \( \), $$, $ (to avoid conflicts)

    // Block math: \[ ... \]
    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => {
      try {
        return '<div class="math-display">' + katex.renderToString(math, {
          displayMode: true,
          throwOnError: false
        }) + '</div>';
      } catch (e) {
        return match;
      }
    });

    // Inline math: \( ... \)
    processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (match, math) => {
      try {
        return katex.renderToString(math, {
          displayMode: false,
          throwOnError: false
        });
      } catch (e) {
        return match;
      }
    });

    // Block math: $$ ... $$
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => {
      try {
        return '<div class="math-display">' + katex.renderToString(math, {
          displayMode: true,
          throwOnError: false
        }) + '</div>';
      } catch (e) {
        return match;
      }
    });

    // Inline math: $ ... $ (be careful with false positives)
    processed = processed.replace(/(?<!\w)\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\w)/g, (match, math) => {
      // Additional check: math should contain LaTeX-like content
      if (/[\\{}^_]/.test(math) || math.length > 2) {
        try {
          return katex.renderToString(math, {
            displayMode: false,
            throwOnError: false
          });
        } catch (e) {
          return match;
        }
      }
      return match;
    });

    // Fix malformed tables (single-row tables missing header separator)
    const lines = processed.split('\n');
    const fixedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = i + 1 < lines.length ? lines[i + 1] : '';

      // Check if this is a table row
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        // Check if next line is NOT a separator (---) and NOT another table row
        if (!nextLine.match(/^\s*\|[\s:-]+\|/) &&
            !nextLine.trim().startsWith('|')) {
          // This is a malformed single-row table - add separator
          const cells = line.split('|').filter(c => c.trim().length > 0);
          const separator = '| ' + cells.map(() => '---').join(' | ') + ' |';
          fixedLines.push(line);
          fixedLines.push(separator);
          continue;
        }
      }

      fixedLines.push(line);
    }

    processed = fixedLines.join('\n');

    // Restore code blocks
    processed = processed.replace(/__CODE_BLOCK_(\d+)__/g, (_match, index) => {
      return codeBlocks[parseInt(index)];
    });

    // Render markdown to HTML
    const html = marked.parse(processed, {
      gfm: true,
      breaks: false
    }) as string;

    // Sanitize HTML
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ['span'], // KaTeX uses span elements
      ADD_ATTR: ['class', 'style', 'src', 'alt', 'loading'], // KaTeX + images need these
    });
  };

  // Fetch media mapping when conversation changes
  useEffect(() => {
    if (selectedConv?.folder) {
      fetch(`${ARCHIVE_API}/api/conversations/${encodeURIComponent(selectedConv.folder)}/media-mapping`)
        .then(res => res.json())
        .then(data => setMediaMapping(data))
        .catch(err => console.error('Error fetching media mapping:', err));
    }
  }, [selectedConv?.folder]);

  // Update content when message changes (from Archive)
  useEffect(() => {
    if (currentMessage) {
      console.log('[Canvas] Loading Archive message, length:', currentMessage.content?.length);
      setEditedContent(currentMessage.content);
      setText(currentMessage.content); // Sync with CanvasContext
      const html = processContent(currentMessage.content);
      setRenderedHtml(html);
    }
  }, [currentMessage, mediaMapping]); // Re-render when media mapping loads

  // Check if content is a full HTML document
  const isFullHtmlDocument = (content: string): boolean => {
    return content.trim().startsWith('<!DOCTYPE html>') ||
           content.trim().startsWith('<html');
  };

  // Update content when text changes (from RemoteContentSource)
  useEffect(() => {
    if (!currentMessage && text) {
      setEditedContent(text);
      // If it's a full HTML document, don't process it - render as-is in iframe
      if (isFullHtmlDocument(text)) {
        setRenderedHtml(text); // Will be rendered in iframe
      } else {
        const html = processContent(text);
        setRenderedHtml(html);
      }
    }
  }, [text, currentMessage, mediaMapping]);

  // Update rendered HTML when edited content changes (in edit tab)
  useEffect(() => {
    if (centerTab === 'edit' && editedContent) {
      // Check if it's a full HTML document
      if (isFullHtmlDocument(editedContent)) {
        setRenderedHtml(editedContent); // Keep as-is for iframe rendering
      } else {
        const html = processContent(editedContent);
        setRenderedHtml(html);
      }
    }
  }, [editedContent, centerTab, mediaMapping]); // Re-render when media mapping loads

  // If no archive message AND no text from RemoteContentSource, show placeholder
  if (!currentMessage && !text) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Select a conversation from the Archive or paste/upload text via Remote tab
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between border-b border-slate-700 px-6 py-3">
        {/* Navigation Arrows (only show for Archive messages) */}
        <div className="flex items-center gap-3">
          {currentMessage ? (
            <>
              <button
                onClick={prevMessage}
                disabled={selectedMessageIndex === 0}
                className="rounded bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600 disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="text-sm text-slate-400">
                {selectedMessageIndex !== null ? selectedMessageIndex + 1 : 0} / {selectedConv!.messages.length}
              </span>
              <button
                onClick={nextMessage}
                disabled={selectedMessageIndex !== null && selectedMessageIndex === selectedConv!.messages.length - 1}
                className="rounded bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600 disabled:opacity-30"
              >
                Next →
              </button>
            </>
          ) : (
            <span className="text-sm text-slate-400">☁️ Remote Content</span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex">
          <button
            onClick={() => setCenterTab('render')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              centerTab === 'render'
                ? 'border-b-2 border-indigo-500 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📄 Render
          </button>
          <button
            onClick={() => setCenterTab('edit')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              centerTab === 'edit'
                ? 'border-b-2 border-indigo-500 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ✏️ Edit
          </button>
        </div>

        {/* Role Badge (only for Archive messages) */}
        {currentMessage && (
          <span className={`rounded px-3 py-1 text-sm font-bold ${
            currentMessage.role === 'user'
              ? 'bg-blue-900/50 text-blue-200'
              : 'bg-purple-900/50 text-purple-200'
          }`}>
            {currentMessage.role.toUpperCase()}
          </span>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Send to Tool button (appears when text is selected) */}
        {selectedText && (
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={handleSendToTool}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-indigo-500 transition-colors"
            >
              Send Selection to Tool →
            </button>
          </div>
        )}

        {centerTab === 'edit' ? (
          <textarea
            value={editedContent}
            onChange={(e) => {
              console.log('[Canvas] Edit mode, updating text, length:', e.target.value?.length);
              setEditedContent(e.target.value);
              setText(e.target.value); // Sync with CanvasContext
            }}
            className="h-full w-full resize-none p-8 font-mono text-base"
            style={{
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: 'none',
            }}
            spellCheck={false}
          />
        ) : isFullHtmlDocument(text || '') ? (
          // Render full HTML documents in iframe for XSS safety
          <iframe
            srcDoc={renderedHtml}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title="HTML Content"
          />
        ) : (
          <div
            className="message-content h-full max-w-none overflow-y-auto p-8"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
            onMouseUp={handleTextSelection}
          />
        )}
      </div>
    </div>
  );
}
