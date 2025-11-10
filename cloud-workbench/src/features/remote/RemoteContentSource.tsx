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
      <div className="p-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold mb-2 text-slate-300">📝 Paste Text</h3>
        <textarea
          value={textBuffer}
          onChange={(e) => setTextBuffer(e.target.value)}
          placeholder="Paste your text here..."
          className="w-full h-32 p-2 bg-slate-800 text-slate-100 rounded border border-slate-700 focus:border-indigo-500 focus:outline-none resize-none text-sm"
        />
        <button
          onClick={handlePaste}
          disabled={!textBuffer.trim()}
          className="mt-2 w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded font-medium transition-colors"
        >
          Load to Canvas
        </button>
      </div>

      {/* File Upload Section */}
      <div className="p-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold mb-2 text-slate-300">📁 Upload Files</h3>
        <label className="block w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-center cursor-pointer transition-colors">
          Choose .txt or .md files
          <input
            type="file"
            accept=".txt,.md"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
        <p className="mt-2 text-xs text-slate-400">
          Supports: .txt, .md (PDF coming soon)
        </p>
      </div>

      {/* Uploaded Files List */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-semibold mb-2 text-slate-300">📚 Recent Uploads ({uploadedFiles.length})</h3>
        {uploadedFiles.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No files uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.timestamp}
                className="p-3 bg-slate-800 rounded border border-slate-700 hover:border-indigo-500 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(file.timestamp).toLocaleString()} • {file.content.length.toLocaleString()} chars
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => loadFileToCanvas(file.content)}
                      className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs transition-colors"
                      title="Load to Canvas"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => deleteFile(file.timestamp)}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
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
