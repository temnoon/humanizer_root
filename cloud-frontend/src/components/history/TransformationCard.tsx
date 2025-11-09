// TransformationCard - Display individual transformation history item
// Compact card with expand-on-click, favorite toggle, delete, and load actions

import { useState } from 'react';
import { cloudAPI } from '../../lib/cloud-api-client';

interface TransformationCardProps {
  transformation: any;
  onDelete: () => void;
  onLoadInput: (text: string) => void;
  onLoadOutput: (data: any) => void;
}

export default function TransformationCard({
  transformation,
  onDelete,
  onLoadInput,
  onLoadOutput
}: TransformationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(transformation.is_favorite === 1);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await cloudAPI.toggleFavorite(transformation.id);
      setIsFavorite(result.is_favorite);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this transformation from history?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await cloudAPI.deleteTransformation(transformation.id);
      onDelete();
    } catch (err) {
      console.error('Failed to delete:', err);
      setIsDeleting(false);
    }
  };

  const handleLoadInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLoadInput(transformation.input_text);
  };

  const handleLoadOutput = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (transformation.output_data) {
      try {
        const data = typeof transformation.output_data === 'string'
          ? JSON.parse(transformation.output_data)
          : transformation.output_data;
        onLoadOutput(data);
      } catch (err) {
        console.error('Failed to parse output data:', err);
      }
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'var(--accent-green)';
      case 'failed': return 'var(--accent-red)';
      case 'processing': return 'var(--accent-cyan)';
      case 'pending': return 'var(--accent-yellow)';
      default: return 'var(--text-secondary)';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'allegorical': return '🎭 Allegorical';
      case 'round-trip': return '🔄 Round-Trip';
      case 'maieutic': return '🤔 Maieutic';
      case 'ai-detection': return '🔍 AI Detection';
      default: return type;
    }
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div
      className="transformation-card"
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: 'var(--spacing-md)',
        background: 'var(--bg-secondary)',
        border: `1px solid ${isFavorite ? 'var(--accent-purple)' : 'var(--border-color)'}`,
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--spacing-sm)',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
    >
      {/* Header Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: expanded ? 'var(--spacing-md)' : '0'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            marginBottom: 'var(--spacing-xs)'
          }}>
            <span style={{ fontWeight: 500 }}>{getTypeLabel(transformation.transformation_type)}</span>
            <span style={{
              fontSize: 'var(--text-sm)',
              color: getStatusColor(transformation.status),
              fontWeight: 500
            }}>
              {transformation.status}
            </span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
              {formatDate(transformation.created_at)}
            </span>
          </div>
          {!expanded && (
            <div style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              marginTop: 'var(--spacing-xs)'
            }}>
              {truncateText(transformation.input_text)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginLeft: 'var(--spacing-md)' }}>
          <button
            onClick={handleToggleFavorite}
            className="icon-button"
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: 'var(--spacing-xs)'
            }}
          >
            {isFavorite ? '⭐' : '☆'}
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="icon-button"
            title="Delete"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              fontSize: '1.2rem',
              padding: 'var(--spacing-xs)',
              opacity: isDeleting ? 0.5 : 1
            }}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div style={{ marginTop: 'var(--spacing-md)' }}>
          {/* Input Text */}
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-xs)'
            }}>
              <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Input:
              </strong>
              <button
                onClick={handleLoadInput}
                className="copy-button"
                style={{ fontSize: 'var(--text-xs)' }}
              >
                📄 Load Input
              </button>
            </div>
            <div style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)',
              background: 'var(--bg-tertiary)',
              padding: 'var(--spacing-sm)',
              borderRadius: 'var(--radius-sm)',
              maxHeight: '150px',
              overflowY: 'auto'
            }}>
              {transformation.input_text}
            </div>
          </div>

          {/* Output Data */}
          {transformation.status === 'completed' && transformation.output_data && (
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--spacing-xs)'
              }}>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  Output:
                </strong>
                <button
                  onClick={handleLoadOutput}
                  className="copy-button"
                  style={{ fontSize: 'var(--text-xs)' }}
                >
                  📝 Load Output
                </button>
              </div>
              <div style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                fontStyle: 'italic'
              }}>
                Click "Load Output" to view full results
              </div>
            </div>
          )}

          {/* Error Message */}
          {transformation.status === 'failed' && transformation.error_message && (
            <div style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--accent-red)',
              background: 'rgba(248, 113, 113, 0.1)',
              padding: 'var(--spacing-sm)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <strong>Error:</strong> {transformation.error_message}
            </div>
          )}

          {/* Parameters */}
          {transformation.input_params && (
            <div style={{ marginTop: 'var(--spacing-sm)' }}>
              <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                Parameters:
              </strong>
              <div style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                marginTop: 'var(--spacing-xs)'
              }}>
                {JSON.stringify(
                  typeof transformation.input_params === 'string'
                    ? JSON.parse(transformation.input_params)
                    : transformation.input_params
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
