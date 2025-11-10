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
    const badges: Record<string, { emoji: string; color: string; label: string }> = {
      allegorical: { emoji: '🌟', color: 'bg-purple-900/40 text-purple-200 border-purple-700', label: 'Allegorical' },
      'round-trip': { emoji: '🌍', color: 'bg-blue-900/40 text-blue-200 border-blue-700', label: 'Round-Trip' },
      maieutic: { emoji: '🤔', color: 'bg-amber-900/40 text-amber-200 border-amber-700', label: 'Maieutic' },
      personalizer: { emoji: '🎭', color: 'bg-pink-900/40 text-pink-200 border-pink-700', label: 'Personalizer' },
      'ai-detection': { emoji: '🔍', color: 'bg-cyan-900/40 text-cyan-200 border-cyan-700', label: 'AI Detection' },
    };

    const badge = badges[type] || { emoji: '✨', color: 'bg-slate-700 text-slate-200 border-slate-600', label: type };

    return (
      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border ${badge.color}`}>
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
    <div className="rounded border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors">
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
            <span className="text-xs text-slate-400">
              {formatDate(item.created_at)}
            </span>
          </div>

          {/* Input Preview */}
          <div className="text-sm text-slate-300 mb-2 line-clamp-2">
            {item.input_text}
          </div>

          {/* Config (if available) */}
          {item.config && Object.keys(item.config).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {Object.entries(item.config).slice(0, 3).map(([key, value]) => (
                <span key={key} className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
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
            className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500"
            title="Load output to Canvas"
          >
            Load
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded bg-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-600"
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
        <div className="border-t border-slate-700 p-3 space-y-3">
          {/* Input */}
          <div>
            <div className="text-xs font-medium text-slate-400 mb-1">Input</div>
            <div className="rounded bg-slate-900 p-2 text-sm text-slate-300 max-h-32 overflow-y-auto">
              {item.input_text}
            </div>
          </div>

          {/* Output */}
          <div>
            <div className="text-xs font-medium text-slate-400 mb-1">Output</div>
            <div className="rounded bg-slate-900 p-2 text-sm text-slate-300 max-h-32 overflow-y-auto">
              {item.output_text}
            </div>
          </div>

          {/* Full Config */}
          {item.config && Object.keys(item.config).length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-300">
                Configuration
              </summary>
              <pre className="mt-2 rounded bg-slate-900 p-2 text-slate-400 overflow-x-auto">
                {JSON.stringify(item.config, null, 2)}
              </pre>
            </details>
          )}

          {/* Copy Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(item.input_text)}
              className="flex-1 rounded bg-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-600"
            >
              Copy Input
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(item.output_text)}
              className="flex-1 rounded bg-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-600"
            >
              Copy Output
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
