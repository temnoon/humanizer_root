/**
 * Remote Content Source
 * Allows users to paste text or upload files when archive is not available (cloud deployment)
 */

import { useState } from 'react';
import { useCanvas } from '../../core/context/CanvasContext';

export function RemoteContentSource() {
  const { setText } = useCanvas();
  const [textBuffer, setTextBuffer] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string; timestamp: number }[]>([]);

  const handlePaste = () => {
    if (textBuffer.trim()) {
      setText(textBuffer);
      setTextBuffer('');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      // Only accept .txt and .md files
      if (!file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
        alert(`Skipped ${file.name}: Only .txt and .md files are supported`);
        continue;
      }

      try {
        const content = await file.text();
        const uploaded = {
          name: file.name,
          content,
          timestamp: Date.now(),
        };

        setUploadedFiles(prev => [uploaded, ...prev].slice(0, 10)); // Keep last 10
        setText(content); // Auto-load to canvas
      } catch (error) {
        console.error(`Failed to read ${file.name}:`, error);
        alert(`Failed to read ${file.name}`);
      }
    }

    // Reset input
    event.target.value = '';
  };

  const loadFileToCanvas = (content: string) => {
    setText(content);
  };

  const deleteFile = (timestamp: number) => {
    setUploadedFiles(prev => prev.filter(f => f.timestamp !== timestamp));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Paste Buffer Section */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>📝 Paste Text</h3>
        <textarea
          value={textBuffer}
          onChange={(e) => setTextBuffer(e.target.value)}
          placeholder="Paste your text here..."
          className="w-full h-32 p-2 rounded border focus:outline-none resize-none text-sm"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            borderColor: 'var(--border-color)',
          }}
        />
        <button
          onClick={handlePaste}
          disabled={!textBuffer.trim()}
          className="mt-2 w-full px-4 py-2 rounded font-medium transition-colors disabled:opacity-50"
          style={{
            background: textBuffer.trim() ? 'var(--accent-purple)' : 'var(--bg-tertiary)',
            color: textBuffer.trim() ? 'white' : 'var(--text-tertiary)',
          }}
        >
          Load to Canvas
        </button>
      </div>

      {/* File Upload Section */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>📁 Upload Files</h3>
        <label
          className="block w-full px-4 py-2 rounded font-medium text-center cursor-pointer transition-colors"
          style={{ background: 'var(--accent-purple)', color: 'var(--text-on-accent)' }}
        >
          Choose .txt or .md files
          <input
            type="file"
            accept=".txt,.md"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Supports: .txt, .md (PDF coming soon)
        </p>
      </div>

      {/* Uploaded Files List */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>📚 Recent Uploads ({uploadedFiles.length})</h3>
        {uploadedFiles.length === 0 ? (
          <p className="text-sm italic" style={{ color: 'var(--text-tertiary)' }}>No files uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.timestamp}
                className="p-3 rounded border transition-colors"
                style={{
                  background: 'var(--bg-tertiary)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {file.name}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(file.timestamp).toLocaleString()} • {file.content.length.toLocaleString()} chars
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => loadFileToCanvas(file.content)}
                      className="px-2 py-1 text-white rounded text-xs transition-colors"
                      style={{ background: 'var(--accent-purple)' }}
                      title="Load to Canvas"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => deleteFile(file.timestamp)}
                      className="px-2 py-1 text-white rounded text-xs transition-colors"
                      style={{ background: 'var(--accent-red)' }}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
