/**
 * BookEditor - Integrated reader/editor with sentence analysis
 *
 * Features:
 * - Read mode with sentence-level metrics on hover/click
 * - Edit mode for inline content modification
 * - Selection toolbar for transform/restyle/regenerate
 * - Print to PDF
 * - Theme switching (sepia, light, dark)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  SelectionProvider,
  SelectionToolbar,
  useSelection,
  useSentenceAnalysis,
  MetricsSidebar,
  type SentenceMetrics,
  type TransformAction,
} from '@humanizer/ui';

type EditorMode = 'read' | 'edit' | 'analyze';
type Theme = 'sepia' | 'dark' | 'light';

interface BookEditorProps {
  /** Initial content (markdown) */
  content?: string;
  /** Book title */
  title?: string;
  /** Called when content changes */
  onContentChange?: (content: string) => void;
  /** Called to close */
  onClose?: () => void;
  /** Enable editing */
  editable?: boolean;
}

// Transform actions for selection toolbar
const createTransformActions = (
  onTransform: (type: string, selection: string) => Promise<string>
): TransformAction[] => [
  {
    id: 'analyze',
    label: 'Analyze',
    group: 'analyze',
    handler: async (sel) => {
      console.log('Analyze:', sel.text);
    },
  },
  {
    id: 'transform-persona',
    label: 'Apply Persona',
    group: 'transform',
    handler: async (sel) => {
      await onTransform('persona', sel.text);
    },
  },
  {
    id: 'transform-style',
    label: 'Apply Style',
    group: 'transform',
    handler: async (sel) => {
      await onTransform('style', sel.text);
    },
  },
  {
    id: 'regenerate',
    label: 'Regenerate',
    group: 'generate',
    shortcut: '⌘R',
    handler: async (sel) => {
      await onTransform('regenerate', sel.text);
    },
  },
  {
    id: 'expand',
    label: 'Expand',
    group: 'generate',
    handler: async (sel) => {
      await onTransform('expand', sel.text);
    },
  },
  {
    id: 'compress',
    label: 'Compress',
    group: 'transform',
    handler: async (sel) => {
      await onTransform('compress', sel.text);
    },
  },
];

/**
 * Inner editor component (needs SelectionProvider context)
 */
function BookEditorInner({
  content,
  title,
  onContentChange,
  onClose,
  editable = true,
}: BookEditorProps & { content: string }) {
  const [editableContent, setEditableContent] = useState(content);
  const [mode, setMode] = useState<EditorMode>('read');
  const [theme, setTheme] = useState<Theme>('sepia');
  const [fontSize, setFontSize] = useState(18);
  const [showControls, setShowControls] = useState(true);
  const [selectedSentence, setSelectedSentence] = useState<SentenceMetrics | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Sentence analysis
  const analysis = useSentenceAnalysis(editableContent, {
    useLocal: true,
    debounceMs: 500,
  });

  // Selection context
  const { registerAction } = useSelection();

  // Register transform actions
  useEffect(() => {
    const handleTransform = async (type: string, text: string): Promise<string> => {
      setIsTransforming(true);
      try {
        // TODO: Call actual transform API
        console.log(`Transform ${type}:`, text.substring(0, 50));
        // Placeholder - in real implementation, call transform service
        return text;
      } finally {
        setIsTransforming(false);
      }
    };

    const actions = createTransformActions(handleTransform);
    actions.forEach((action) => registerAction(action));
  }, [registerAction]);

  // Auto-hide controls
  useEffect(() => {
    if (mode !== 'read') return;

    let timeout: ReturnType<typeof setTimeout>;
    const handleMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    window.addEventListener('mousemove', handleMove);
    handleMove();

    return () => {
      window.removeEventListener('mousemove', handleMove);
      clearTimeout(timeout);
    };
  }, [mode]);

  // Handle content edit
  const handleContentChange = useCallback(
    (newContent: string) => {
      setEditableContent(newContent);
      onContentChange?.(newContent);
    },
    [onContentChange]
  );

  // Handle sentence click
  const handleSentenceClick = useCallback((sentence: SentenceMetrics) => {
    setSelectedSentence(sentence);
    setSidebarOpen(true);
  }, []);

  // Print to PDF
  const handlePrint = useCallback(() => {
    // Create print-friendly version
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = `
      <style>
        @page { margin: 1in; }
        body {
          font-family: Georgia, serif;
          font-size: 12pt;
          line-height: 1.6;
          max-width: 6in;
          margin: 0 auto;
          color: #333;
        }
        h1 { font-size: 24pt; margin-top: 0; }
        h2 { font-size: 18pt; margin-top: 1.5em; }
        h3 { font-size: 14pt; margin-top: 1.2em; }
        blockquote {
          margin: 1em 0;
          padding-left: 1em;
          border-left: 3px solid #666;
          font-style: italic;
        }
        hr { border: none; border-top: 1px solid #ccc; margin: 2em 0; }
        @media print {
          body { color: black; }
        }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title || 'Book'}</title>
          ${styles}
        </head>
        <body>
          ${contentRef.current?.innerHTML || ''}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    // Delay print to allow styles to load
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }, [title]);

  // Switch to edit mode
  const enterEditMode = useCallback(() => {
    setMode('edit');
    setTimeout(() => editorRef.current?.focus(), 0);
  }, []);

  // Exit edit mode
  const exitEditMode = useCallback(() => {
    setMode('read');
  }, []);

  // Toggle analyze mode
  const toggleAnalyzeMode = useCallback(() => {
    setMode((prev) => (prev === 'analyze' ? 'read' : 'analyze'));
  }, []);

  const controlsClass = `book-editor__controls ${
    showControls || mode !== 'read' ? '' : 'book-editor__controls--hidden'
  }`;

  return (
    <div className={`book-editor book-editor--${theme}`} data-mode={mode}>
      {/* Top Controls */}
      <div className={controlsClass}>
        <div className="book-editor__controls-left">
          {onClose && (
            <button className="book-editor__btn" onClick={onClose}>
              ← Back
            </button>
          )}
          {editable && (
            <div className="book-editor__mode-toggle">
              <button
                className={`book-editor__btn ${mode === 'read' ? 'book-editor__btn--active' : ''}`}
                onClick={() => setMode('read')}
              >
                Read
              </button>
              <button
                className={`book-editor__btn ${mode === 'edit' ? 'book-editor__btn--active' : ''}`}
                onClick={enterEditMode}
              >
                Edit
              </button>
              <button
                className={`book-editor__btn ${mode === 'analyze' ? 'book-editor__btn--active' : ''}`}
                onClick={toggleAnalyzeMode}
              >
                Analyze
              </button>
            </div>
          )}
        </div>

        <div className="book-editor__controls-center">
          {title && <span className="book-editor__title">{title}</span>}
          {mode === 'analyze' && (
            <span className="book-editor__analysis-badge">
              {analysis.overall.totalSentences} sentences •
              Avg SIC: {analysis.overall.avgSicScore.toFixed(0)}
            </span>
          )}
        </div>

        <div className="book-editor__controls-right">
          <button className="book-editor__btn" onClick={handlePrint} title="Print / PDF">
            🖨️
          </button>
          <button
            className="book-editor__btn"
            onClick={() => setFontSize((f) => Math.max(14, f - 2))}
          >
            A−
          </button>
          <button
            className="book-editor__btn"
            onClick={() => setFontSize((f) => Math.min(28, f + 2))}
          >
            A+
          </button>
          <select
            className="book-editor__select"
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
          >
            <option value="sepia">Sepia</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="book-editor__main">
        {/* Read/Analyze Mode */}
        {mode !== 'edit' && (
          <div
            ref={contentRef}
            className="book-editor__content"
            style={{ fontSize: `${fontSize}px` }}
          >
            <article className="book-editor__article">
              {mode === 'analyze' ? (
                // Analyze mode: render with sentence highlighting
                <AnalyzableContent
                  content={editableContent}
                  sentences={analysis.sentences}
                  onSentenceClick={handleSentenceClick}
                />
              ) : (
                // Read mode: standard markdown
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {editableContent}
                </ReactMarkdown>
              )}
            </article>
          </div>
        )}

        {/* Edit Mode */}
        {mode === 'edit' && (
          <div className="book-editor__edit-container">
            <textarea
              ref={editorRef}
              className="book-editor__textarea"
              value={editableContent}
              onChange={(e) => handleContentChange(e.target.value)}
              style={{ fontSize: `${fontSize}px` }}
              placeholder="Enter your content in Markdown..."
            />
            <div className="book-editor__edit-actions">
              <button className="book-editor__btn book-editor__btn--primary" onClick={exitEditMode}>
                Done Editing
              </button>
            </div>
          </div>
        )}

        {/* Selection Toolbar (appears on text selection) */}
        <SelectionToolbar />

        {/* Metrics Sidebar */}
        <MetricsSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          metrics={selectedSentence}
        />
      </div>

      {/* Transform loading indicator */}
      {isTransforming && (
        <div className="book-editor__loading">
          <span>Transforming...</span>
        </div>
      )}
    </div>
  );
}

/**
 * Analyzable content renderer with sentence highlighting
 */
function AnalyzableContent({
  content,
  sentences,
  onSentenceClick,
}: {
  content: string;
  sentences: SentenceMetrics[];
  onSentenceClick: (sentence: SentenceMetrics) => void;
}) {
  // For now, render markdown with click handling on paragraphs
  // Full sentence-level highlighting would require custom markdown renderer
  return (
    <div className="book-editor__analyzable">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children, ...props }) => (
            <p
              {...props}
              className="book-editor__paragraph book-editor__paragraph--analyzable"
              onClick={() => {
                // Find matching sentence
                const text = String(children);
                const match = sentences.find((s) => text.includes(s.text));
                if (match) onSentenceClick(match);
              }}
            >
              {children}
            </p>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote
              {...props}
              className="book-editor__blockquote book-editor__blockquote--analyzable"
            >
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>

      {/* Analysis summary */}
      <div className="book-editor__analysis-summary">
        <h4>Sentence Analysis</h4>
        <div className="book-editor__sentences-list">
          {sentences.slice(0, 20).map((s, i) => (
            <div
              key={i}
              className={`book-editor__sentence-item book-editor__sentence-item--${s.sicLevel}`}
              onClick={() => onSentenceClick(s)}
            >
              <span className="book-editor__sentence-index">#{i + 1}</span>
              <span className="book-editor__sentence-text">{s.text.substring(0, 80)}...</span>
              <span className="book-editor__sentence-score">{s.sicScore}</span>
            </div>
          ))}
          {sentences.length > 20 && (
            <div className="book-editor__sentences-more">
              +{sentences.length - 20} more sentences
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Main BookEditor with SelectionProvider wrapper
 */
export function BookEditor(props: BookEditorProps) {
  const content = props.content || '';

  return (
    <SelectionProvider>
      <BookEditorInner {...props} content={content} />
    </SelectionProvider>
  );
}

export default BookEditor;
