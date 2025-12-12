/**
 * PasteImportView - Import narratives via paste or file upload
 *
 * Allows users to:
 * - Paste any text/markdown directly into the workspace
 * - Upload .txt, .md, or .pdf files
 * - Content is saved to the buffer system for transformation
 */

import { useState, useRef, useCallback } from 'react';
import { useUnifiedBuffer } from '../../contexts/UnifiedBufferContext';
import { Icons } from '../layout/Icons';

interface PasteImportViewProps {
  onImportComplete?: (title: string) => void;
  onClose?: () => void;
}

export function PasteImportView({ onImportComplete, onClose }: PasteImportViewProps) {
  const [pasteContent, setPasteContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { createFromText, setWorkingBuffer } = useUnifiedBuffer();

  // Extract text from PDF using pdf.js (via dynamic import)
  const extractPdfText = async (file: File): Promise<string> => {
    // Use the browser's built-in PDF text extraction via pdfjs-dist
    // For MVP, we'll use a simple fetch + text extraction approach
    const arrayBuffer = await file.arrayBuffer();

    // Dynamic import pdf.js
    const pdfjsLib = await import('pdfjs-dist');

    // Set worker source (use CDN for simplicity)
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      textParts.push(pageText);
    }

    return textParts.join('\n\n');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setUploadedFileName(file.name);

    try {
      let content: string;
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'pdf') {
        content = await extractPdfText(file);
      } else if (extension === 'txt' || extension === 'md') {
        content = await file.text();
      } else {
        throw new Error(`Unsupported file type: .${extension}. Please use .txt, .md, or .pdf`);
      }

      setPasteContent(content);

      // Auto-set title from filename (without extension)
      if (!title) {
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        setTitle(baseName);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to read file');
      setUploadedFileName(null);
    } finally {
      setLoading(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = useCallback(() => {
    if (!pasteContent.trim()) {
      setError('Please enter or paste some content');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Determine format based on content
      const hasMarkdown = /^#{1,6}\s|\*\*|__|\[.*\]\(.*\)|```/.test(pasteContent);
      const format = hasMarkdown ? 'markdown' : 'plain';

      // Create buffer from text
      const buffer = createFromText(pasteContent, format);

      // Override display name if title provided
      if (title.trim()) {
        buffer.displayName = title.trim();
      }

      // Set as working buffer
      setWorkingBuffer(buffer);

      // Notify parent
      onImportComplete?.(buffer.displayName);

      // Reset form
      setPasteContent('');
      setTitle('');
      setUploadedFileName(null);

      // Close sidebar on mobile
      if (window.innerWidth < 768 && onClose) {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import content');
    } finally {
      setLoading(false);
    }
  }, [pasteContent, title, createFromText, setWorkingBuffer, onImportComplete, onClose]);

  const handleClear = () => {
    setPasteContent('');
    setTitle('');
    setUploadedFileName(null);
    setError(null);
  };

  const wordCount = pasteContent.trim().split(/\s+/).filter(Boolean).length;
  const charCount = pasteContent.length;

  return (
    <div className="paste-import-view">
      {/* Header */}
      <div className="paste-import-view__header">
        <h3 className="paste-import-view__title">
          Import Content
        </h3>
        <p className="paste-import-view__subtitle">
          Paste text or upload a file to start working
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div className="paste-import-view__error">
          {error}
        </div>
      )}

      {/* Title input */}
      <div className="paste-import-view__field">
        <label className="paste-import-view__label">
          Title (optional)
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Give your narrative a name..."
          className="paste-import-view__input"
          disabled={loading}
        />
      </div>

      {/* File upload */}
      <div className="paste-import-view__upload">
        <label className="paste-import-view__upload-btn">
          <span className="paste-import-view__upload-icon">
            <Icons.Upload />
          </span>
          <span>Upload File</span>
          <span className="paste-import-view__upload-formats">
            .txt, .md, .pdf
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.pdf"
            onChange={handleFileUpload}
            disabled={loading}
            style={{ display: 'none' }}
          />
        </label>
        {uploadedFileName && (
          <div className="paste-import-view__upload-file">
            <span className="paste-import-view__upload-file-icon">📄</span>
            <span className="paste-import-view__upload-file-name">{uploadedFileName}</span>
            <button
              onClick={() => { setUploadedFileName(null); setPasteContent(''); }}
              className="paste-import-view__upload-file-clear"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="paste-import-view__divider">
        <span>or paste directly</span>
      </div>

      {/* Paste textarea */}
      <div className="paste-import-view__field">
        <label className="paste-import-view__label">
          Content
          {pasteContent && (
            <span className="paste-import-view__stats">
              {wordCount.toLocaleString()} words · {charCount.toLocaleString()} chars
            </span>
          )}
        </label>
        <textarea
          value={pasteContent}
          onChange={(e) => setPasteContent(e.target.value)}
          placeholder="Paste your narrative, essay, article, or any text here...

Supports:
• Plain text
• Markdown formatting
• Any length content"
          className="paste-import-view__textarea"
          disabled={loading}
          rows={12}
        />
      </div>

      {/* Actions */}
      <div className="paste-import-view__actions">
        <button
          onClick={handleClear}
          disabled={loading || (!pasteContent && !title)}
          className="paste-import-view__btn paste-import-view__btn--secondary"
        >
          Clear
        </button>
        <button
          onClick={handleImport}
          disabled={loading || !pasteContent.trim()}
          className="paste-import-view__btn paste-import-view__btn--primary"
        >
          {loading ? 'Importing...' : 'Import to Workspace'}
        </button>
      </div>

      {/* Help text */}
      <div className="paste-import-view__help">
        <p>
          <strong>Tip:</strong> You can also paste directly into the main workspace area
          to quickly import content.
        </p>
      </div>
    </div>
  );
}
