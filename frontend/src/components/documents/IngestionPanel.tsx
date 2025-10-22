import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import './IngestionPanel.css';

interface IngestionBatch {
  id: string;
  source_directory: string;
  total_files: number;
  successful: number;
  failed: number;
  skipped: number;
  storage_strategy: string;
  processing_time_ms: number | null;
  errors: Array<{ file: string; error: string }> | null;
  created_at: string;
}

export default function IngestionPanel() {
  const [recentBatches, setRecentBatches] = useState<IngestionBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [sourceDirectory, setSourceDirectory] = useState('');
  const [fileTypes, setFileTypes] = useState<string[]>([]);
  const [storageStrategy, setStorageStrategy] = useState<'centralized' | 'in_place'>('in_place');
  const [centralizedBasePath, setCentralizedBasePath] = useState('~/humanizer_media');
  const [recursive, setRecursive] = useState(true);
  const [forceReimport, setForceReimport] = useState(false);
  const [generateEmbeddings, setGenerateEmbeddings] = useState(true);

  useEffect(() => {
    loadRecentBatches();
  }, []);

  const loadRecentBatches = async () => {
    try {
      const response = await api.listIngestionBatches(1, 10);
      setRecentBatches(response.batches);
    } catch (err) {
      console.error('Failed to load batches:', err);
    }
  };

  const startIngestion = async () => {
    if (!sourceDirectory.trim()) {
      setError('Please enter a source directory');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.ingestDocuments({
        source_directory: sourceDirectory,
        file_types: fileTypes.length > 0 ? fileTypes : undefined,
        storage_strategy: storageStrategy,
        centralized_base_path: storageStrategy === 'centralized' ? centralizedBasePath : undefined,
        recursive,
        force_reimport: forceReimport,
        generate_embeddings: generateEmbeddings,
      });

      setSuccess(
        `Ingestion complete! ${response.successful} files processed successfully, ` +
        `${response.skipped} skipped, ${response.failed} failed. ` +
        `Time: ${(response.processing_time_ms / 1000).toFixed(2)}s`
      );

      // Reset form
      setSourceDirectory('');
      setFileTypes([]);
      setForceReimport(false);

      // Reload batches
      await loadRecentBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest documents');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const toggleFileType = (type: string) => {
    setFileTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const availableFileTypes = ['pdf', 'txt', 'md', 'image'];

  return (
    <div className="ingestion-panel">
      <div className="ingestion-header">
        <h2>📥 Document Ingestion</h2>
        <p className="ingestion-subtitle">Import documents from local directories</p>
      </div>

      {/* Ingestion Form */}
      <div className="ingestion-section">
        <h3>➕ Start New Ingestion</h3>
        <div className="ingestion-form">
          <div className="form-group">
            <label htmlFor="source-directory">Source Directory *</label>
            <input
              id="source-directory"
              type="text"
              placeholder="/path/to/documents"
              value={sourceDirectory}
              onChange={(e) => setSourceDirectory(e.target.value)}
              className="directory-input"
            />
            <small className="form-hint">
              Absolute path to directory containing documents
            </small>
          </div>

          <div className="form-group">
            <label>File Types (leave empty for all)</label>
            <div className="file-type-checkboxes">
              {availableFileTypes.map(type => (
                <label key={type} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={fileTypes.includes(type)}
                    onChange={() => toggleFileType(type)}
                  />
                  <span>{type.toUpperCase()}</span>
                </label>
              ))}
            </div>
            <small className="form-hint">
              Select specific file types or leave empty to ingest all supported types
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="storage-strategy">Storage Strategy</label>
            <select
              id="storage-strategy"
              value={storageStrategy}
              onChange={(e) => setStorageStrategy(e.target.value as 'centralized' | 'in_place')}
              className="storage-select"
            >
              <option value="in_place">In-Place (keep files where they are)</option>
              <option value="centralized">Centralized (copy to media folder)</option>
            </select>
          </div>

          {storageStrategy === 'centralized' && (
            <div className="form-group">
              <label htmlFor="base-path">Centralized Storage Path</label>
              <input
                id="base-path"
                type="text"
                value={centralizedBasePath}
                onChange={(e) => setCentralizedBasePath(e.target.value)}
                className="directory-input"
              />
              <small className="form-hint">
                Base directory for centralized storage (files organized by type/year/month)
              </small>
            </div>
          )}

          <div className="form-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={recursive}
                onChange={(e) => setRecursive(e.target.checked)}
              />
              <span>Recursive (include subdirectories)</span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={forceReimport}
                onChange={(e) => setForceReimport(e.target.checked)}
              />
              <span>Force Re-import (reimport existing files)</span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={generateEmbeddings}
                onChange={(e) => setGenerateEmbeddings(e.target.checked)}
              />
              <span>Generate Embeddings (queue for semantic search)</span>
            </label>
          </div>

          {error && (
            <div className="message error-message">
              ❌ {error}
            </div>
          )}

          {success && (
            <div className="message success-message">
              ✅ {success}
            </div>
          )}

          <button
            className="start-button"
            onClick={startIngestion}
            disabled={loading}
          >
            {loading ? 'Ingesting...' : '🚀 Start Ingestion'}
          </button>
        </div>
      </div>

      {/* Recent Batches */}
      {recentBatches.length > 0 && (
        <div className="ingestion-section">
          <h3>📋 Recent Batches</h3>
          <div className="batch-list">
            {recentBatches.map((batch) => (
              <div key={batch.id} className="batch-item">
                <div className="batch-header">
                  <span className="batch-directory">{batch.source_directory}</span>
                  <span className="batch-date">{formatDate(batch.created_at)}</span>
                </div>
                <div className="batch-stats">
                  <span className="stat-badge success">✓ {batch.successful}</span>
                  <span className="stat-badge skipped">⊘ {batch.skipped}</span>
                  {batch.failed > 0 && (
                    <span className="stat-badge failed">✗ {batch.failed}</span>
                  )}
                  <span className="stat-badge total">
                    {batch.total_files} total
                  </span>
                </div>
                {batch.processing_time_ms !== null && (
                  <div className="batch-time">
                    Processing time: {(batch.processing_time_ms / 1000).toFixed(2)}s
                  </div>
                )}
                {batch.errors && batch.errors.length > 0 && (
                  <div className="batch-errors">
                    <details>
                      <summary>{batch.errors.length} error(s)</summary>
                      <ul className="error-list">
                        {batch.errors.map((err, idx) => (
                          <li key={idx}>
                            <strong>{err.file}</strong>: {err.error}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="ingestion-section info-section">
        <h3>ℹ️ Supported File Types</h3>
        <ul className="file-type-list">
          <li><strong>PDF</strong> - Text extraction + embedded images</li>
          <li><strong>TXT</strong> - Plain text files (auto-detects encoding)</li>
          <li><strong>MD</strong> - Markdown with frontmatter support</li>
          <li><strong>Images</strong> - JPG, PNG, GIF, WebP, BMP, TIFF (with EXIF metadata)</li>
        </ul>

        <h3>🔍 Processing Pipeline</h3>
        <ol className="pipeline-steps">
          <li>Discover files matching patterns</li>
          <li>Check for duplicates (SHA256 hash)</li>
          <li>Parse each file (extract text + metadata)</li>
          <li>Store files (centralized or in-place)</li>
          <li>Chunk large documents (~1000 chars, 100 char overlap)</li>
          <li>Queue for embedding generation (if enabled)</li>
          <li>Track batch statistics</li>
        </ol>
      </div>
    </div>
  );
}
