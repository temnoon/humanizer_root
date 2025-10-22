import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import api, { DocumentListItem, MediaItem } from '@/lib/api-client';
import { useToast } from '@/contexts/ToastContext';
import './DocumentViewer.css';

interface DocumentViewerProps {
  documentId: string;
  onSelectContent?: (content: {
    text: string;
    source: 'document' | 'chunk' | 'custom';
    sourceId?: string;
    chunkId?: string;
  } | null) => void;
}

interface Chunk {
  id: string;
  chunk_index: number;
  chunk_text: string;
  page_number: number | null;
  embedding_status: string;
}

type ViewMode = 'content' | 'chunks' | 'media' | 'json';
type WidthMode = 'narrow' | 'medium' | 'wide';

export default function DocumentViewer({ documentId, onSelectContent }: DocumentViewerProps) {
  const [docData, setDocData] = useState<DocumentListItem | null>(null);
  const [content, setContent] = useState<string>('');
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('content');
  const [widthMode, setWidthMode] = useState<WidthMode>('narrow');
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);

  // Interest list dropdown state
  const [showListDropdown, setShowListDropdown] = useState<string | null>(null);
  const [availableLists, setAvailableLists] = useState<any[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { showSuccess, showError } = useToast();

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load document metadata
      const doc = await api.getDocument(documentId);
      setDocData(doc);

      // Load content
      const contentResponse = await api.getDocumentContent(documentId);
      setContent(contentResponse.content);

      // Load chunks
      const chunksResponse = await api.getDocumentChunks(documentId);
      setChunks(chunksResponse.chunks);

      // Load media if any
      if (doc.media_count > 0) {
        const mediaResponse = await api.getDocumentMedia(documentId);
        setMedia(mediaResponse.media);
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to load document:', err);
      setError(err instanceof Error ? err.message : 'Failed to load document');
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getFileTypeIcon = (fileType: string): string => {
    switch (fileType.toLowerCase()) {
      case 'pdf': return '📄';
      case 'txt': case 'text': return '📝';
      case 'md': case 'markdown': return '📋';
      case 'image': case 'jpg': case 'jpeg': case 'png': case 'gif': return '🖼️';
      default: return '📄';
    }
  };

  const getEmbeddingStatusBadge = (status: string): JSX.Element => {
    const statusClass = status.toLowerCase().replace('_', '-');
    const statusLabel = status.replace('_', ' ');
    return <span className={`status-badge status-${statusClass}`}>{statusLabel}</span>;
  };

  const goToPreviousChunk = () => {
    if (currentChunkIndex > 0) {
      setCurrentChunkIndex(currentChunkIndex - 1);
      const chunkId = chunks[currentChunkIndex - 1]?.id;
      if (chunkId) {
        document.getElementById(`chunk-${chunkId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const goToNextChunk = () => {
    if (currentChunkIndex < chunks.length - 1) {
      setCurrentChunkIndex(currentChunkIndex + 1);
      const chunkId = chunks[currentChunkIndex + 1]?.id;
      if (chunkId) {
        document.getElementById(`chunk-${chunkId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleStar = async () => {
    if (!docData) return;
    try {
      await api.markInteresting({
        interestType: 'document',
        targetUuid: docData.id,
        momentText: `Starred document: ${docData.title || docData.filename}`,
        salienceScore: 0.8,
        targetMetadata: {
          filename: docData.filename,
          file_type: docData.file_type,
          title: docData.title,
          author: docData.author,
        },
      });
      showSuccess('Document starred!');
    } catch (err) {
      console.error('Failed to star document:', err);
      showError('Failed to star document');
    }
  };

  const handleAddToList = async () => {
    if (showListDropdown) {
      setShowListDropdown(null);
      return;
    }

    setShowListDropdown('document');

    if (availableLists.length === 0) {
      setLoadingLists(true);
      try {
        const response = await api.getInterestLists();
        setAvailableLists(response.lists || []);
      } catch (err) {
        console.error('Failed to load lists:', err);
        showError('Failed to load interest lists');
      } finally {
        setLoadingLists(false);
      }
    }
  };

  const handleSelectList = async (listId: string) => {
    if (!docData) return;
    try {
      await api.addToInterestList(listId, {
        itemType: 'document',
        itemUuid: docData.id,
        itemMetadata: {
          filename: docData.filename,
          title: docData.title,
          file_type: docData.file_type,
          file_size: docData.file_size,
        },
      });

      const list = availableLists.find((l) => l.id === listId);
      showSuccess(`Added to "${list?.name || 'list'}"`);
      setShowListDropdown(null);
    } catch (err) {
      console.error('Failed to add to list:', err);
      showError('Failed to add to list');
    }
  };

  const handleUseInTools = () => {
    if (onSelectContent && docData) {
      onSelectContent({
        text: content,
        source: 'document',
        sourceId: documentId,
      });
    }
  };

  const handleUseChunk = (chunk: Chunk) => {
    if (onSelectContent) {
      onSelectContent({
        text: chunk.chunk_text,
        source: 'chunk',
        sourceId: documentId,
        chunkId: chunk.id,
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowListDropdown(null);
      }
    };

    if (showListDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showListDropdown]);

  const getWidthClass = () => {
    switch (widthMode) {
      case 'narrow': return 'width-narrow';
      case 'medium': return 'width-medium';
      case 'wide': return 'width-wide';
      default: return 'width-narrow';
    }
  };

  if (loading) {
    return (
      <div className="document-viewer-loading">
        <div className="loading-spinner"></div>
        <p>Loading document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="document-viewer-error">
        <p className="error-icon">⚠️</p>
        <p className="error-text">{error}</p>
        <button className="retry-button" onClick={loadDocument}>
          Retry
        </button>
      </div>
    );
  }

  if (!docData) {
    return (
      <div className="document-viewer-empty">
        <p>Select a document to view</p>
      </div>
    );
  }

  return (
    <div className="document-viewer">
      <div className="document-header">
        <div className="document-title-row">
          <span className="file-type-icon">{getFileTypeIcon(docData.file_type)}</span>
          <h1 className="document-title">{docData.title || docData.filename}</h1>
        </div>

        {/* Chunk Navigation - Separate Row */}
        {viewMode === 'chunks' && chunks.length > 0 && (
          <div className="chunk-navigation-row">
            <div className="chunk-navigation">
              <button
                className="nav-button"
                onClick={goToPreviousChunk}
                disabled={currentChunkIndex === 0}
                title="Previous chunk"
              >
                ◀ Previous
              </button>
              <span className="chunk-position">
                {currentChunkIndex + 1} of {chunks.length}
              </span>
              <button
                className="nav-button"
                onClick={goToNextChunk}
                disabled={currentChunkIndex === chunks.length - 1}
                title="Next chunk"
              >
                Next ▶
              </button>
            </div>
          </div>
        )}

        <div className="document-metadata">
          {docData.filename !== docData.title && (
            <span className="metadata-item filename-meta">{docData.filename}</span>
          )}
          <span className="metadata-item">{formatFileSize(docData.file_size)}</span>
          <span className="metadata-item">{docData.chunk_count} chunks</span>
          {docData.media_count > 0 && (
            <span className="metadata-item">{docData.media_count} media</span>
          )}
          {docData.author && (
            <span className="metadata-item">by {docData.author}</span>
          )}
          <span className="metadata-item">{formatDate(docData.ingested_at)}</span>
          <span className="metadata-item">{getEmbeddingStatusBadge(docData.embedding_status)}</span>
        </div>

        {/* View Mode Toggle */}
        <div className="view-mode-toggle">
          <button
            className={`view-mode-button ${viewMode === 'content' ? 'active' : ''}`}
            onClick={() => setViewMode('content')}
          >
            📄 Content
          </button>
          <button
            className={`view-mode-button ${viewMode === 'chunks' ? 'active' : ''}`}
            onClick={() => setViewMode('chunks')}
          >
            🧩 Chunks ({chunks.length})
          </button>
          {media.length > 0 && (
            <button
              className={`view-mode-button ${viewMode === 'media' ? 'active' : ''}`}
              onClick={() => setViewMode('media')}
            >
              🖼️ Media ({media.length})
            </button>
          )}
          <button
            className={`view-mode-button ${viewMode === 'json' ? 'active' : ''}`}
            onClick={() => setViewMode('json')}
          >
            {} JSON
          </button>
        </div>

        {/* Width Toggle */}
        {(viewMode === 'content' || viewMode === 'chunks') && (
          <div className="width-toggle">
            <button
              className={`width-button ${widthMode === 'narrow' ? 'active' : ''}`}
              onClick={() => setWidthMode('narrow')}
              title="Narrow (700px)"
            >
              Narrow
            </button>
            <button
              className={`width-button ${widthMode === 'medium' ? 'active' : ''}`}
              onClick={() => setWidthMode('medium')}
              title="Medium (1240px)"
            >
              Medium
            </button>
            <button
              className={`width-button ${widthMode === 'wide' ? 'active' : ''}`}
              onClick={() => setWidthMode('wide')}
              title="Wide (1600px)"
            >
              Wide
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="document-actions">
          <button className="action-button star-button" onClick={handleStar}>
            ⭐ Star
          </button>
          <div className="list-button-container" style={{ position: 'relative' }}>
            <button className="action-button list-button" onClick={handleAddToList}>
              📝 Add to List
            </button>

            {showListDropdown && (
              <div className="list-dropdown" ref={dropdownRef}>
                {loadingLists ? (
                  <div className="list-dropdown-loading">Loading lists...</div>
                ) : availableLists.length === 0 ? (
                  <div className="list-dropdown-empty">
                    No lists yet. Create one in the sidebar!
                  </div>
                ) : (
                  <>
                    <div className="list-dropdown-header">Add to list:</div>
                    {availableLists.map((list) => (
                      <button
                        key={list.id}
                        className="list-dropdown-item"
                        onClick={() => handleSelectList(list.id)}
                      >
                        <span className="list-name">{list.name}</span>
                        {list.description && (
                          <span className="list-description">{list.description}</span>
                        )}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          {onSelectContent && (
            <button className="action-button use-tools-button" onClick={handleUseInTools}>
              🔄 Use in Tools
            </button>
          )}
        </div>
      </div>

      {/* Content View */}
      {viewMode === 'content' && (
        <div className="content-container">
          <div className={`content-wrapper ${getWidthClass()}`}>
            <div className="document-content">
              {docData.file_type === 'md' || docData.file_type === 'markdown' ? (
                <ReactMarkdown>{content}</ReactMarkdown>
              ) : (
                <pre className="text-content">{content}</pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chunks View */}
      {viewMode === 'chunks' && (
        <div className="chunks-container">
          <div className={`chunks-wrapper ${getWidthClass()}`}>
            {chunks.map((chunk) => (
              <div key={chunk.id} id={`chunk-${chunk.id}`} className="chunk-card">
                <div className="chunk-header">
                  <span className="chunk-label">Chunk {chunk.chunk_index + 1}</span>
                  {chunk.page_number !== null && (
                    <span className="page-label">Page {chunk.page_number}</span>
                  )}
                  <span className="embedding-status">{getEmbeddingStatusBadge(chunk.embedding_status)}</span>
                  {onSelectContent && (
                    <button
                      className="chunk-use-tools"
                      onClick={() => handleUseChunk(chunk)}
                      title="Use this chunk in transformation tools"
                    >
                      🔄
                    </button>
                  )}
                </div>
                <div className="chunk-content">
                  {docData.file_type === 'md' || docData.file_type === 'markdown' ? (
                    <ReactMarkdown>{chunk.chunk_text}</ReactMarkdown>
                  ) : (
                    <p className="chunk-text">{chunk.chunk_text}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Media View */}
      {viewMode === 'media' && (
        <div className="media-container">
          <div className="media-grid">
            {media.map((item) => (
              <div key={item.file_id} className="media-item">
                <img
                  src={api.getMediaFile(item.file_id)}
                  alt={item.filename || 'Document media'}
                  className="media-image"
                />
                {item.filename && (
                  <div className="media-caption">{item.filename}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* JSON View */}
      {viewMode === 'json' && (
        <div className="raw-view json-view">
          <div className="raw-view-header">
            <button
              className="copy-button"
              onClick={() => navigator.clipboard.writeText(JSON.stringify(docData, null, 2))}
            >
              📋 Copy JSON
            </button>
          </div>
          <pre className="raw-content json-content">
            {JSON.stringify(docData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
