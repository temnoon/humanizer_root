import { useState, useEffect } from 'react';
import './DocumentsPanel.css';
import api, { DocumentListItem } from '@/lib/api-client';

interface DocumentsPanelProps {
  onSelectDocument?: (documentId: string) => void;
  onNavigateToPipeline?: () => void;
}

/**
 * DocumentsPanel - Displays list of ingested documents with filtering
 */
export default function DocumentsPanel({ onSelectDocument, onNavigateToPipeline }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedFileType, setSelectedFileType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Load documents
  useEffect(() => {
    loadDocuments();
  }, [page, selectedFileType, searchQuery]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.listDocuments({
        page,
        page_size: 20,
        file_type: selectedFileType || undefined,
        search: searchQuery || undefined,
      });

      setDocuments(response.documents);
      setTotalPages(response.total_pages);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset to first page on search
  };

  const handleFileTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedFileType(e.target.value);
    setPage(1); // Reset to first page on filter
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileTypeIcon = (fileType: string): string => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return '📄';
      case 'txt':
      case 'text':
        return '📝';
      case 'md':
      case 'markdown':
        return '📋';
      case 'image':
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return '🖼️';
      default:
        return '📄';
    }
  };

  const getEmbeddingStatusBadge = (status: string): JSX.Element => {
    const statusClass = status.toLowerCase().replace('_', '-');
    const statusLabel = status.replace('_', ' ');
    return <span className={`status-badge status-${statusClass}`}>{statusLabel}</span>;
  };

  return (
    <div className="documents-panel">
      {/* Import Button */}
      <button
        className="import-documents-button"
        onClick={onNavigateToPipeline}
        title="Import documents from local directories"
      >
        📥 Import Documents
      </button>

      {/* Search and Filters */}
      <div className="documents-controls">
        <input
          type="text"
          className="search-input"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={handleSearchChange}
        />

        <select
          className="file-type-filter"
          value={selectedFileType}
          onChange={handleFileTypeChange}
        >
          <option value="">All Types</option>
          <option value="pdf">PDF</option>
          <option value="txt">Text</option>
          <option value="md">Markdown</option>
          <option value="image">Image</option>
        </select>
      </div>

      {/* Document List */}
      <div className="documents-list">
        {loading && <div className="loading-message">Loading documents...</div>}

        {error && <div className="error-message">{error}</div>}

        {!loading && !error && documents.length === 0 && (
          <div className="empty-message">
            <p>No documents found</p>
            <p className="empty-hint">Upload documents to get started</p>
          </div>
        )}

        {!loading && !error && documents.map((doc) => (
          <div
            key={doc.id}
            className="document-item"
            onClick={() => onSelectDocument?.(doc.id)}
          >
            <div className="document-header">
              <span className="file-icon">{getFileTypeIcon(doc.file_type)}</span>
              <div className="document-info">
                <div className="document-title">
                  {doc.title || doc.filename}
                </div>
                <div className="document-meta">
                  {doc.filename !== doc.title && (
                    <span className="filename">{doc.filename}</span>
                  )}
                  <span className="file-size">{formatFileSize(doc.file_size)}</span>
                  {doc.author && <span className="author">by {doc.author}</span>}
                </div>
              </div>
            </div>

            <div className="document-footer">
              <div className="document-stats">
                <span title="Number of chunks">📄 {doc.chunk_count} chunks</span>
                {doc.media_count > 0 && (
                  <span title="Media files">🖼️ {doc.media_count}</span>
                )}
              </div>
              {getEmbeddingStatusBadge(doc.embedding_status)}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-button"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span className="pagination-info">
            Page {page} of {totalPages}
          </span>
          <button
            className="pagination-button"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
