/**
 * Import View - Unified import for all archive types
 */

import { useState, useRef, useEffect, useCallback } from 'react';

interface ImportType {
  id: string;
  icon: string;
  label: string;
  description: string;
  accept?: string;
}

interface ImportJob {
  id: string;
  status: 'uploaded' | 'parsing' | 'ready' | 'applying' | 'complete' | 'error';
  progress: number;
  filename?: string;
  error?: string;
  conversationCount?: number;
  mediaCount?: number;
}

const IMPORT_TYPES: ImportType[] = [
  { id: 'chatgpt', icon: '💬', label: 'ChatGPT', description: 'OpenAI export ZIP', accept: '.zip' },
  { id: 'claude', icon: '🤖', label: 'Claude', description: 'Anthropic conversations', accept: '.json' },
  { id: 'facebook', icon: '👤', label: 'Facebook', description: 'Full archive export', accept: '.zip' },
  { id: 'folder', icon: '📁', label: 'Folder', description: 'Local documents folder' },
  { id: 'json', icon: '📄', label: 'JSON', description: 'Conversation JSON file', accept: '.json' },
  { id: 'paste', icon: '📋', label: 'Paste', description: 'Paste text or JSON' },
];

const ARCHIVE_SERVER = 'http://localhost:3002';

export function ImportView() {
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<number | null>(null);

  // Poll for job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`${ARCHIVE_SERVER}/api/import/archive/status/${jobId}`);
      if (!response.ok) throw new Error('Failed to check status');

      const job: ImportJob = await response.json();
      setCurrentJob(job);

      if (job.status === 'ready') {
        setImportStatus(`Found ${job.conversationCount || 0} conversations, ${job.mediaCount || 0} media files. Ready to import.`);
        setImporting(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } else if (job.status === 'error') {
        setImportStatus(`Error: ${job.error || 'Import failed'}`);
        setImporting(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } else if (job.status === 'complete') {
        setImportStatus('Import complete! Refresh to see new conversations.');
        setImporting(false);
        setCurrentJob(null);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } else if (job.status === 'parsing') {
        setImportStatus(`Parsing... ${job.progress}%`);
      } else if (job.status === 'applying') {
        setImportStatus(`Importing... ${job.progress}%`);
      }
    } catch (err) {
      console.error('Error polling status:', err);
    }
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleFiles(files);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await handleFiles(files);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFiles = async (files: File[]) => {
    setImporting(true);
    setImportStatus('Uploading...');
    setCurrentJob(null);

    try {
      const file = files[0];

      // Upload the file
      const formData = new FormData();
      formData.append('archive', file);

      const uploadResponse = await fetch(`${ARCHIVE_SERVER}/api/import/archive/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || 'Upload failed');
      }

      const { jobId, filename } = await uploadResponse.json();
      setImportStatus(`Uploaded ${filename}. Starting parse...`);

      // Start parsing
      const parseResponse = await fetch(`${ARCHIVE_SERVER}/api/import/archive/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      if (!parseResponse.ok) {
        const error = await parseResponse.json();
        throw new Error(error.error || 'Parse failed');
      }

      setImportStatus('Parsing archive...');
      setCurrentJob({ id: jobId, status: 'parsing', progress: 0 });

      // Start polling for status
      pollIntervalRef.current = window.setInterval(() => {
        pollJobStatus(jobId);
      }, 1000);

    } catch (err) {
      console.error('Import error:', err);
      setImportStatus(`Error: ${err instanceof Error ? err.message : 'Import failed'}`);
      setImporting(false);
    }
  };

  const handleApplyImport = async () => {
    if (!currentJob?.id) return;

    setImporting(true);
    setImportStatus('Applying import...');

    try {
      const response = await fetch(`${ARCHIVE_SERVER}/api/import/archive/apply/${currentJob.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Apply failed');
      }

      // Start polling for completion
      setCurrentJob(prev => prev ? { ...prev, status: 'applying' } : null);
      pollIntervalRef.current = window.setInterval(() => {
        pollJobStatus(currentJob.id);
      }, 1000);

    } catch (err) {
      console.error('Apply error:', err);
      setImportStatus(`Error: ${err instanceof Error ? err.message : 'Apply failed'}`);
      setImporting(false);
    }
  };

  const handleTypeClick = (type: ImportType) => {
    if (type.id === 'paste') {
      setPasteMode(true);
      setSelectedType(null);
      return;
    }

    if (type.id === 'folder') {
      // Folder import requires entering a path
      const folderPath = prompt('Enter the folder path to import:');
      if (folderPath) {
        handleFolderImport(folderPath);
      }
      return;
    }

    setSelectedType(type.id);
    // Update accepted file types and trigger file picker
    if (fileInputRef.current) {
      fileInputRef.current.accept = type.accept || '.zip,.json';
      fileInputRef.current.click();
    }
  };

  const handleFolderImport = async (folderPath: string) => {
    setImporting(true);
    setImportStatus('Scanning folder...');

    try {
      const response = await fetch(`${ARCHIVE_SERVER}/api/import/archive/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Folder import failed');
      }

      const { jobId } = await response.json();
      setCurrentJob({ id: jobId, status: 'parsing', progress: 0 });

      // Start polling
      pollIntervalRef.current = window.setInterval(() => {
        pollJobStatus(jobId);
      }, 1000);

    } catch (err) {
      console.error('Folder import error:', err);
      setImportStatus(`Error: ${err instanceof Error ? err.message : 'Folder import failed'}`);
      setImporting(false);
    }
  };

  const handlePasteImport = async () => {
    if (!pasteContent.trim()) return;

    setImporting(true);
    setImportStatus('Processing pasted content...');

    try {
      // Try to parse as JSON
      let conversationData;
      try {
        conversationData = JSON.parse(pasteContent);
      } catch {
        // Not JSON, treat as plain text conversation
        conversationData = {
          title: 'Pasted Conversation',
          create_time: Date.now() / 1000,
          mapping: {
            root: {
              id: 'root',
              message: {
                content: { parts: [pasteContent] },
                author: { role: 'user' },
                create_time: Date.now() / 1000,
              },
            },
          },
        };
      }

      const response = await fetch(`${ARCHIVE_SERVER}/api/import/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: conversationData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      setImportStatus('Content imported successfully!');
      setPasteContent('');
      setPasteMode(false);
    } catch (err) {
      console.error('Paste import error:', err);
      setImportStatus(`Error: ${err instanceof Error ? err.message : 'Import failed'}`);
    } finally {
      setImporting(false);
    }
  };

  const cancelJob = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setCurrentJob(null);
    setImportStatus(null);
    setImporting(false);
  };

  return (
    <div className="import-tab">
      {/* Drop zone */}
      <div
        className={`import-dropzone ${dragActive ? 'import-dropzone--active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <span className="import-dropzone__icon">📥</span>
        <span className="import-dropzone__text">
          Drop files here or click to browse
        </span>
        <span className="import-dropzone__hint">
          Supports ZIP archives, JSON files, and folders
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Import status */}
      {importStatus && (
        <div className={`import-status ${currentJob?.status === 'error' ? 'import-status--error' : ''}`}>
          {importing && <span className="import-status__spinner">⏳</span>}
          <span className="import-status__text">{importStatus}</span>
        </div>
      )}

      {/* Ready to apply */}
      {currentJob?.status === 'ready' && (
        <div className="import-actions">
          <button
            className="archive-browser__btn archive-browser__btn--primary"
            onClick={handleApplyImport}
            disabled={importing}
          >
            Apply Import
          </button>
          <button
            className="archive-browser__btn"
            onClick={cancelJob}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Import type buttons */}
      {!pasteMode && !currentJob && (
        <>
          <div className="import-section-label">
            Import From
          </div>
          <div className="import-types">
            {IMPORT_TYPES.map(type => (
              <button
                key={type.id}
                className={`import-type ${selectedType === type.id ? 'import-type--selected' : ''}`}
                onClick={() => handleTypeClick(type)}
                disabled={importing}
              >
                <span className="import-type__icon">{type.icon}</span>
                <span className="import-type__label">{type.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Paste mode */}
      {pasteMode && (
        <div className="import-paste">
          <label className="import-section-label">Paste Content</label>
          <textarea
            className="import-paste__textarea"
            placeholder="Paste JSON conversation or plain text..."
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
          />
          <div className="import-actions">
            <button
              className="archive-browser__btn archive-browser__btn--primary"
              onClick={handlePasteImport}
              disabled={!pasteContent.trim() || importing}
            >
              Import
            </button>
            <button
              className="archive-browser__btn"
              onClick={() => {
                setPasteMode(false);
                setPasteContent('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
