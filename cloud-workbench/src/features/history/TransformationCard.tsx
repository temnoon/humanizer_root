import { useState } from 'react';
import type { TransformationHistoryItem } from '../../core/adapters/api';

interface TransformationCardProps {
  item: TransformationHistoryItem;
  onLoadToCanvas: (text: string) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * TransformationCard - Display individual transformation history entry
 *
 * Features:
 * - Collapsible input/output preview
 * - Load to Canvas button
 * - Toggle favorite (star icon)
 * - Delete with confirmation
 * - Type badge and timestamp
 */
export function TransformationCard({
  item,
  onLoadToCanvas,
  onToggleFavorite,
  onDelete,
}: TransformationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getTypeBadge = (type: string) => {
    const badges: Record<string, { emoji: string; bgColor: string; textColor: string; borderColor: string; label: string }> = {
      allegorical: {
        emoji: '🌟',
        bgColor: 'rgba(167, 139, 250, 0.2)',
        textColor: 'var(--accent-purple)',
        borderColor: 'var(--accent-purple)',
        label: 'Allegorical'
      },
      'round-trip': {
        emoji: '🌍',
        bgColor: 'rgba(6, 182, 212, 0.2)',
        textColor: 'var(--accent-cyan)',
        borderColor: 'var(--accent-cyan)',
        label: 'Round-Trip'
      },
      maieutic: {
        emoji: '🤔',
        bgColor: 'rgba(251, 191, 36, 0.2)',
        textColor: 'var(--accent-yellow)',
        borderColor: 'var(--accent-yellow)',
        label: 'Maieutic'
      },
      personalizer: {
        emoji: '🎭',
        bgColor: 'rgba(236, 72, 153, 0.2)',
        textColor: '#ec4899',
        borderColor: '#ec4899',
        label: 'Personalizer'
      },
      'ai-detection': {
        emoji: '🔍',
        bgColor: 'rgba(6, 182, 212, 0.2)',
        textColor: 'var(--accent-cyan)',
        borderColor: 'var(--accent-cyan)',
        label: 'AI Detection'
      },
    };

    const badge = badges[type] || {
      emoji: '✨',
      bgColor: 'var(--bg-tertiary)',
      textColor: 'var(--text-primary)',
      borderColor: 'var(--border-color)',
      label: type
    };

    return (
      <span
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border"
        style={{
          background: badge.bgColor,
          color: badge.textColor,
          borderColor: badge.borderColor,
        }}
      >
        <span>{badge.emoji}</span>
        <span>{badge.label}</span>
      </span>
    );
  };

  const handleDelete = () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
      return;
    }
    onDelete(item.id);
  };

  return (
    <div
      className="rounded border transition-colors"
      style={{
        borderColor: 'var(--border-color)',
        background: 'var(--bg-secondary)',
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        {/* Favorite Star */}
        <button
          onClick={() => onToggleFavorite(item.id)}
          className="flex-shrink-0 text-lg transition-transform hover:scale-110"
          title={item.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {item.is_favorite ? '⭐' : '☆'}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Type Badge + Timestamp */}
          <div className="flex items-center gap-2 mb-2">
            {getTypeBadge(item.transformation_type)}
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {formatDate(item.created_at)}
            </span>
          </div>

          {/* Input Preview */}
          <div className="text-sm mb-2 line-clamp-2" style={{ color: 'var(--text-primary)' }}>
            {item.input_text}
          </div>

          {/* Config (if available) */}
          {item.config && Object.keys(item.config).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {Object.entries(item.config).slice(0, 3).map(([key, value]) => (
                <span
                  key={key}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {key}: {String(value)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onLoadToCanvas(item.output_text)}
            className="rounded btn-primary px-3 py-1 text-xs font-medium"
            title="Load output to Canvas"
          >
            Load
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded btn-secondary px-3 py-1 text-xs font-medium"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▲' : '▼'}
          </button>
          <button
            onClick={handleDelete}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              showDeleteConfirm
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title={showDeleteConfirm ? 'Click again to confirm' : 'Delete'}
          >
            {showDeleteConfirm ? '✓' : '×'}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t p-3 space-y-3" style={{ borderColor: 'var(--border-color)' }}>
          {/* Input */}
          <div>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Input</div>
            <div className="rounded p-2 text-sm max-h-32 overflow-y-auto" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
              {item.input_text}
            </div>
          </div>

          {/* Output */}
          <div>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Output</div>
            <div className="rounded p-2 text-sm max-h-32 overflow-y-auto" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
              {item.output_text}
            </div>
          </div>

          {/* Full Config */}
          {item.config && Object.keys(item.config).length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                Configuration
              </summary>
              <pre className="mt-2 rounded p-2 overflow-x-auto" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                {JSON.stringify(item.config, null, 2)}
              </pre>
            </details>
          )}

          {/* Copy Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(item.input_text)}
              className="flex-1 rounded btn-secondary px-3 py-1 text-xs font-medium"
            >
              Copy Input
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(item.output_text)}
              className="flex-1 rounded btn-secondary px-3 py-1 text-xs font-medium"
            >
              Copy Output
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
