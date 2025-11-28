import { useState, useEffect, useRef } from 'react';
import { ImportPreviewModal } from './ImportPreviewModal';
import { ArchiveSelector } from './ArchiveSelector';

const ARCHIVE_SERVER_URL = 'http://localhost:3002';

type ArchiveType = 'auto' | 'openai' | 'claude' | 'facebook' | 'custom';

interface ImportJob {
  id: string;
  status: 'uploaded' | 'parsing' | 'previewing' | 'ready' | 'applying' | 'completed' | 'failed';
  progress: number;
  filename?: string;
  size?: number;
  startTime?: number;
  error?: string;
  preview?: any;
  archiveType?: string;
}

interface ImportHistoryItem {
  id: string;
  filename: string;
  archiveType: string;
  conversationCount: number;
  messageCount: number;
  mediaCount: number;
  timestamp: number;
  status: 'completed' | 'failed';
  error?: string;
}

const IMPORT_HISTORY_KEY = 'humanizer-import-history';

export function ImportsView() {
  const [archiveType, setArchiveType] = useState<ArchiveType>('auto');
  const [createNewArchive, setCreateNewArchive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [folderPath, setFolderPath] = useState('');
  const [mediaFolderPath, setMediaFolderPath] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Load import history from localStorage (deduplicate by ID)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(IMPORT_HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Deduplicate by ID, keeping the most recent entry
        const uniqueMap = new Map<string, ImportHistoryItem>();
        for (const item of parsed) {
          const existing = uniqueMap.get(item.id);
          if (!existing || item.timestamp > existing.timestamp) {
            uniqueMap.set(item.id, item);
          }
        }
        const deduplicated = Array.from(uniqueMap.values())
          .sort((a, b) => b.timestamp - a.timestamp);
        setImportHistory(deduplicated);
        // Save deduplicated version back
        localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(deduplicated));
      }
    } catch (err) {
      console.error('Failed to load import history:', err);
    }
  }, []);

  // Save import history to localStorage (prevent duplicates)
  const saveToHistory = (item: ImportHistoryItem) => {
    setImportHistory(prev => {
      // Remove any existing entry with the same ID
      const filtered = prev.filter(i => i.id !== item.id);
      const updated = [item, ...filtered].slice(0, 50); // Keep last 50 imports
      localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const pollJobStatus = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${ARCHIVE_SERVER_URL}/api/import/archive/status/${id}`);
        const jobData: ImportJob = await res.json();

        setJob(jobData);

        if (jobData.status === 'ready') {
          clearInterval(interval);
          // Fetch preview
          const previewRes = await fetch(`${ARCHIVE_SERVER_URL}/api/import/archive/preview/${id}`);
          const previewData = await previewRes.json();
          setJob({ ...jobData, preview: previewData.preview });
          setShowPreview(true);
          setUploading(false);
        } else if (jobData.status === 'completed') {
          clearInterval(interval);
          setUploading(false);

          // Add to history
          saveToHistory({
            id: jobData.id || id,
            filename: jobData.filename || 'archive',
            archiveType: jobData.archiveType || 'unknown',
            conversationCount: jobData.preview?.conversations?.length || 0,
            messageCount: jobData.preview?.totalMessages || 0,
            mediaCount: jobData.preview?.totalMedia || 0,
            timestamp: Date.now(),
            status: 'completed',
          });

          setJobId(null);
          setJob(null);
          // Refresh archive list
          window.location.reload();
        } else if (jobData.status === 'failed') {
          clearInterval(interval);
          setUploading(false);

          // Add failed import to history
          saveToHistory({
            id: jobData.id || id,
            filename: jobData.filename || 'archive',
            archiveType: jobData.archiveType || 'unknown',
            conversationCount: 0,
            messageCount: 0,
            mediaCount: 0,
            timestamp: Date.now(),
            status: 'failed',
            error: jobData.error,
          });

          alert(`Import failed: ${jobData.error}`);
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    }, 1000);
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      alert('Please select a ZIP file');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('archive', file);
      if (archiveType !== 'auto') {
        formData.append('archiveType', archiveType);
      }

      const uploadRes = await fetch(`${ARCHIVE_SERVER_URL}/api/import/archive/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('Upload failed');
      }

      const { jobId: newJobId } = await uploadRes.json();
      setJobId(newJobId);

      // Trigger parsing
      await fetch(`${ARCHIVE_SERVER_URL}/api/import/archive/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: newJobId }),
      });

      // Poll for status
      pollJobStatus(newJobId);
    } catch (err) {
      console.error('Error uploading archive:', err);
      alert('Failed to upload archive');
      setUploading(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      alert('Please select a JSON file');
      return;
    }

    setUploading(true);

    try {
      const content = await file.text();
      const conversation = JSON.parse(content);

      const response = await fetch(`${ARCHIVE_SERVER_URL}/api/import/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation,
          filename: file.name
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const result = await response.json();

      // Add to history
      saveToHistory({
        id: `json-${Date.now()}`,
        filename: file.name,
        archiveType: 'json',
        conversationCount: 1,
        messageCount: result.message_count || 0,
        mediaCount: 0,
        timestamp: Date.now(),
        status: 'completed',
      });

      alert(`Imported: ${result.title}\n${result.message_count} messages`);
      window.location.reload();
    } catch (error: any) {
      console.error('Import error:', error);
      alert(`Import failed: ${error.message}`);
    } finally {
      setUploading(false);
      if (jsonInputRef.current) {
        jsonInputRef.current.value = '';
      }
    }
  };

  const handleFolderImport = async () => {
    if (!folderPath.trim()) {
      alert('Please enter a folder path');
      return;
    }

    setUploading(true);

    try {
      const response = await fetch(`${ARCHIVE_SERVER_URL}/api/import/archive/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: folderPath.trim(),
          archiveType: archiveType !== 'auto' ? archiveType : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Folder import failed');
      }

      const { jobId: newJobId } = await response.json();
      setJobId(newJobId);

      // Poll for status (same as ZIP import)
      pollJobStatus(newJobId);
    } catch (err: any) {
      console.error('Error importing folder:', err);
      alert(`Failed to import folder: ${err.message}`);
      setUploading(false);
    }
  };

  const handleMediaOnlyImport = async () => {
    if (!mediaFolderPath.trim()) {
      alert('Please enter a media folder path');
      return;
    }

    setUploading(true);

    try {
      const response = await fetch(`${ARCHIVE_SERVER_URL}/api/import/media-only`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaFolderPath: mediaFolderPath.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Media import failed');
      }

      const { jobId: newJobId } = await response.json();
      setJobId(newJobId);
      setJob({ id: newJobId, status: 'processing', progress: 0 });

      // Poll for status
      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${ARCHIVE_SERVER_URL}/api/import/archive/status/${newJobId}`);
          const statusData = await statusRes.json();

          setJob(statusData);

          if (statusData.status === 'completed') {
            clearInterval(interval);
            setUploading(false);
            const result = statusData.result;
            alert(`Media import complete!\n\nConversations updated: ${result.conversationsUpdated}\nMedia files copied: ${result.mediaFilesCopied}`);
            setJobId(null);
            setJob(null);
          } else if (statusData.status === 'failed') {
            clearInterval(interval);
            setUploading(false);
            alert(`Media import failed: ${statusData.error}`);
            setJobId(null);
            setJob(null);
          }
        } catch (pollErr) {
          console.error('Error polling media import status:', pollErr);
        }
      }, 1000);
    } catch (err: any) {
      console.error('Error importing media:', err);
      alert(`Failed to import media: ${err.message}`);
      setUploading(false);
    }
  };

  const handleApplyImport = async () => {
    if (!jobId) return;

    try {
      setShowPreview(false);
      setUploading(true);

      await fetch(`${ARCHIVE_SERVER_URL}/api/import/archive/apply/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createNewArchive }),
      });

      pollJobStatus(jobId);
    } catch (err) {
      console.error('Error applying import:', err);
      alert('Failed to apply import');
      setUploading(false);
    }
  };

  const handleCancelImport = () => {
    setShowPreview(false);
    setJobId(null);
    setJob(null);
  };

  const clearHistory = () => {
    if (confirm('Clear all import history?')) {
      setImportHistory([]);
      localStorage.removeItem(IMPORT_HISTORY_KEY);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      {/* Archive Selector - Switch between archives */}
      <ArchiveSelector />

      {/* Import Section */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1rem',
        }}
      >
        <h3
          style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>📥</span> Import Archives
        </h3>

        {/* Archive Type Selector */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.5rem',
            }}
          >
            Archive Format
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { value: 'auto', label: 'Auto-detect', icon: '🔍' },
              { value: 'openai', label: 'OpenAI/ChatGPT', icon: '🤖' },
              { value: 'claude', label: 'Claude', icon: '🧠' },
              { value: 'facebook', label: 'Facebook', icon: '📘' },
              { value: 'custom', label: 'Custom JSON', icon: '📄' },
            ].map((type) => (
              <button
                key={type.value}
                onClick={() => setArchiveType(type.value as ArchiveType)}
                disabled={uploading}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: archiveType === type.value
                    ? '2px solid var(--accent-primary)'
                    : '1px solid var(--border-color)',
                  backgroundColor: archiveType === type.value
                    ? 'var(--accent-primary)'
                    : 'var(--bg-tertiary)',
                  color: archiveType === type.value
                    ? 'var(--text-inverse)'
                    : 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>{type.icon}</span>
                <span>{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Import Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              backgroundColor: uploading ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
              color: uploading ? 'var(--text-secondary)' : 'var(--text-inverse)',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading && job?.status !== 'parsing' ? (
              <>
                <span>⏳</span>
                <span>Uploading...</span>
              </>
            ) : uploading && job?.status === 'parsing' ? (
              <>
                <span>⏳</span>
                <span>Parsing... {job.progress > 0 ? `(${job.progress}%)` : ''}</span>
              </>
            ) : (
              <>
                <span>📦</span>
                <span>Import ZIP Archive</span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleZipUpload}
              style={{ display: 'none' }}
              disabled={uploading}
            />
          </label>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            <span>📄</span>
            <span>Import JSON File</span>
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json"
              onChange={handleJsonUpload}
              style={{ display: 'none' }}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Folder Path Input */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.5rem',
            }}
          >
            Or import from expanded folder
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="/path/to/expanded/archive"
              disabled={uploading}
              style={{
                flex: 1,
                padding: '0.6rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                opacity: uploading ? 0.6 : 1,
              }}
            />
            <button
              onClick={handleFolderImport}
              disabled={uploading || !folderPath.trim()}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: uploading || !folderPath.trim() ? 'var(--bg-tertiary)' : 'var(--accent-secondary)',
                color: uploading || !folderPath.trim() ? 'var(--text-tertiary)' : 'var(--text-inverse)',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: uploading || !folderPath.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>📂</span>
              <span>Import</span>
            </button>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.35rem' }}>
            Paste path to an already-extracted ChatGPT or Claude export folder
          </div>
        </div>

        {/* Media-Only Import */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.5rem',
            }}
          >
            Import media files only (add to existing conversations)
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={mediaFolderPath}
              onChange={(e) => setMediaFolderPath(e.target.value)}
              placeholder="/path/to/media/folder"
              disabled={uploading}
              style={{
                flex: 1,
                padding: '0.6rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                opacity: uploading ? 0.6 : 1,
              }}
            />
            <button
              onClick={handleMediaOnlyImport}
              disabled={uploading || !mediaFolderPath.trim()}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: uploading || !mediaFolderPath.trim() ? 'var(--bg-tertiary)' : '#9b59b6',
                color: uploading || !mediaFolderPath.trim() ? 'var(--text-tertiary)' : 'white',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: uploading || !mediaFolderPath.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>📸</span>
              <span>Import Media</span>
            </button>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.35rem' }}>
            Match and copy media files to existing conversations using file IDs, sizes, and hashes
          </div>
        </div>

        {/* Options */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            cursor: uploading ? 'not-allowed' : 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={createNewArchive}
            onChange={(e) => setCreateNewArchive(e.target.checked)}
            disabled={uploading}
            style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}
          />
          <span>Create new archive folder (instead of merging)</span>
        </label>
      </div>

      {/* Supported Formats Info */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1rem',
        }}
      >
        <h4
          style={{
            fontSize: '0.95rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>📋</span> Supported Formats
        </h4>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <FormatInfo
            icon="🤖"
            title="OpenAI / ChatGPT"
            description="Full export ZIP from ChatGPT Settings > Data Controls > Export"
            features={['Conversations', 'DALL-E images', 'Voice transcripts', 'File attachments']}
          />
          <FormatInfo
            icon="🧠"
            title="Claude"
            description="Data export ZIP from Claude Settings > Privacy > Export Data"
            features={['Conversations', 'Projects', 'File attachments']}
          />
          <FormatInfo
            icon="📄"
            title="Single Conversation JSON"
            description="Individual conversation.json files"
            features={['Quick import', 'Manual backups']}
          />
        </div>
      </div>

      {/* Import History */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '12px',
          padding: '1.25rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <h4
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>📜</span> Import History
            {importHistory.length > 0 && (
              <span
                style={{
                  fontSize: '0.75rem',
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '10px',
                  color: 'var(--text-secondary)',
                }}
              >
                {importHistory.length}
              </span>
            )}
          </h4>
          {importHistory.length > 0 && (
            <button
              onClick={clearHistory}
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-tertiary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>

        {importHistory.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem 1rem',
              color: 'var(--text-tertiary)',
              fontSize: '0.9rem',
            }}
          >
            No imports yet. Your import history will appear here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {importHistory.slice(0, showHistory ? undefined : 5).map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>
                  {item.status === 'completed' ? '✅' : '❌'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.filename}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {item.status === 'completed' ? (
                      <>
                        {item.conversationCount} conversations • {item.messageCount} messages
                        {item.mediaCount > 0 && ` • ${item.mediaCount} media`}
                      </>
                    ) : (
                      <span style={{ color: '#ff6464' }}>{item.error || 'Import failed'}</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  {formatDate(item.timestamp)}
                </div>
              </div>
            ))}

            {importHistory.length > 5 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                style={{
                  padding: '0.5rem',
                  fontSize: '0.85rem',
                  color: 'var(--accent-primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                {showHistory ? 'Show less' : `Show ${importHistory.length - 5} more`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && job?.preview && (
        <ImportPreviewModal
          preview={job.preview}
          filename={job.filename || 'archive'}
          createNewArchive={createNewArchive}
          onApply={handleApplyImport}
          onCancel={handleCancelImport}
        />
      )}
    </div>
  );
}

function FormatInfo({
  icon,
  title,
  description,
  features,
}: {
  icon: string;
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.75rem',
        padding: '0.75rem',
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: '8px',
      }}
    >
      <span style={{ fontSize: '1.5rem' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          {title}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
          {description}
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {features.map((feature) => (
            <span
              key={feature}
              style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.5rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '4px',
                color: 'var(--text-tertiary)',
              }}
            >
              {feature}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
