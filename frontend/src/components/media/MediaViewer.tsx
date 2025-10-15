import { useState, useEffect } from 'react';
import './MediaViewer.css';

interface MediaItem {
  file_id: string;
  file_path?: string;
  filename?: string;
  content_type?: string;
  size_bytes?: number;
  width?: number;
  height?: number;
  source_archive?: string;
  conversation_uuid?: string;
  created_at?: string;
}

interface MediaViewerProps {
  selectedMedia: MediaItem | null;
  onClose?: () => void;
  onNavigateToConversation?: (conversationId: string) => void;
}

/**
 * MediaViewer - Display full resolution media in main pane
 *
 * Features:
 * - Full resolution image scaled to fit
 * - Metadata display (conversation, date, dimensions)
 * - Click conversation to navigate
 * - Close/back functionality
 */
export default function MediaViewer({ selectedMedia, onClose, onNavigateToConversation }: MediaViewerProps) {
  const [conversationTitle, setConversationTitle] = useState<string | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);

  useEffect(() => {
    if (selectedMedia?.conversation_uuid) {
      loadConversationTitle(selectedMedia.conversation_uuid);
    }
  }, [selectedMedia?.conversation_uuid]);

  const loadConversationTitle = async (conversationId: string) => {
    setLoadingConversation(true);
    try {
      const response = await fetch(`/api/chatgpt/conversations/${conversationId}`);
      const data = await response.json();
      setConversationTitle(data.title || 'Untitled Conversation');
    } catch (error) {
      console.error('Failed to load conversation title:', error);
      setConversationTitle('Unknown Conversation');
    } finally {
      setLoadingConversation(false);
    }
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatBytes = (bytes?: number): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleConversationClick = () => {
    if (selectedMedia?.conversation_uuid && onNavigateToConversation) {
      onNavigateToConversation(selectedMedia.conversation_uuid);
    }
  };

  if (!selectedMedia) {
    return (
      <div className="media-viewer-empty">
        <div className="empty-icon">🖼️</div>
        <h2>No Media Selected</h2>
        <p>Select an image from the gallery to view it here</p>
      </div>
    );
  }

  const mediaUrl = `/api/media/${selectedMedia.file_id}`;

  return (
    <div className="media-viewer">
      {/* Header with metadata */}
      <div className="media-viewer-header">
        <div className="header-left">
          <button className="back-button" onClick={onClose} title="Back to conversation list">
            ← Back
          </button>
          <h2 className="media-filename">
            {selectedMedia.filename || selectedMedia.file_id}
          </h2>
        </div>
      </div>

      {/* Main image display */}
      <div className="media-viewer-content">
        <div className="media-container">
          <img
            src={mediaUrl}
            alt={selectedMedia.filename || 'Media'}
            className="media-image"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
      </div>

      {/* Metadata sidebar */}
      <div className="media-viewer-sidebar">
        <div className="metadata-section">
          <h3>Media Information</h3>

          <div className="metadata-item">
            <span className="metadata-label">Dimensions:</span>
            <span className="metadata-value">
              {selectedMedia.width && selectedMedia.height
                ? `${selectedMedia.width} × ${selectedMedia.height}px`
                : 'Unknown'}
            </span>
          </div>

          <div className="metadata-item">
            <span className="metadata-label">Size:</span>
            <span className="metadata-value">{formatBytes(selectedMedia.size_bytes)}</span>
          </div>

          <div className="metadata-item">
            <span className="metadata-label">Type:</span>
            <span className="metadata-value">{selectedMedia.content_type || 'Unknown'}</span>
          </div>

          {selectedMedia.created_at && (
            <div className="metadata-item">
              <span className="metadata-label">Date:</span>
              <span className="metadata-value">{formatDate(selectedMedia.created_at)}</span>
            </div>
          )}

          {selectedMedia.source_archive && (
            <div className="metadata-item">
              <span className="metadata-label">Archive:</span>
              <span className="metadata-value">{selectedMedia.source_archive}</span>
            </div>
          )}
        </div>

        {/* Conversation link */}
        {selectedMedia.conversation_uuid && (
          <div className="metadata-section">
            <h3>Source</h3>
            <button
              className="conversation-link-button"
              onClick={handleConversationClick}
              disabled={loadingConversation}
            >
              <div className="conversation-link-icon">💬</div>
              <div className="conversation-link-text">
                <span className="conversation-link-label">From conversation:</span>
                <span className="conversation-link-title">
                  {loadingConversation ? 'Loading...' : conversationTitle || 'Unknown'}
                </span>
              </div>
              <div className="conversation-link-arrow">→</div>
            </button>
          </div>
        )}

        {/* Download button */}
        <div className="metadata-section">
          <a
            href={mediaUrl}
            download={selectedMedia.filename || selectedMedia.file_id}
            className="download-button"
          >
            ⬇️ Download Original
          </a>
        </div>
      </div>
    </div>
  );
}
