import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import './TransformationHistory.css';

interface Transformation {
  id: string;
  user_id: string;
  source_type: string;
  source_uuid: string | null;
  transformation_type: string;
  user_prompt: string | null;
  parameters: any;
  created_at: string;
  updated_at: string;
  source_preview?: string;
  result_preview?: string;
  source_text?: string;
  result_text?: string;
  metrics?: any;
}

interface TransformationHistoryProps {
  onSelectTransformation?: (transformation: Transformation) => void;
}

const TransformationHistory: React.FC<TransformationHistoryProps> = ({
  onSelectTransformation,
}) => {
  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTransformation, setSelectedTransformation] = useState<Transformation | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // Load transformation history
  useEffect(() => {
    loadHistory();
  }, [page, filter]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const filterType = filter === 'all' ? undefined : filter;
      const result = await api.getTransformationHistory(
        pageSize,
        page * pageSize,
        filterType
      );
      setTransformations(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  // Load full transformation details
  const loadTransformationDetails = async (id: string) => {
    try {
      const details = await api.getTransformation(id);
      setSelectedTransformation(details);
      setSelectedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load details');
    }
  };

  // Format transformation type for display
  const formatType = (type: string): string => {
    const typeMap: Record<string, string> = {
      'trm': 'TRM',
      'llm': 'LLM',
      'personify_trm': 'Personify (TRM)',
      'personify_llm': 'Personify (LLM)',
      'custom': 'Custom',
    };
    return typeMap[type] || type;
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  // Handle filter change
  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setPage(0); // Reset to first page
  };

  // Handle reapply
  const handleReapply = (transformation: Transformation) => {
    if (onSelectTransformation) {
      onSelectTransformation(transformation);
    }
  };

  return (
    <div className="transformation-history">
      <div className="history-header">
        <h2>Transformation History</h2>
        <div className="history-stats">
          <span className="stat">{total} total</span>
        </div>
      </div>

      <div className="history-filters">
        <button
          className={filter === 'all' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => handleFilterChange('all')}
        >
          All
        </button>
        <button
          className={filter === 'trm' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => handleFilterChange('trm')}
        >
          TRM
        </button>
        <button
          className={filter === 'llm' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => handleFilterChange('llm')}
        >
          LLM
        </button>
        <button
          className={filter === 'personify_trm' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => handleFilterChange('personify_trm')}
        >
          Personify (TRM)
        </button>
        <button
          className={filter === 'personify_llm' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => handleFilterChange('personify_llm')}
        >
          Personify (LLM)
        </button>
      </div>

      {loading && (
        <div className="history-loading">
          <div className="loading-spinner"></div>
          <p>Loading history...</p>
        </div>
      )}

      {error && (
        <div className="history-error">
          <p>Error: {error}</p>
          <button onClick={loadHistory}>Retry</button>
        </div>
      )}

      {!loading && !error && transformations.length === 0 && (
        <div className="history-empty">
          <p>No transformations found.</p>
          <p className="empty-hint">
            Transformations will appear here after you use the transformation tools.
          </p>
        </div>
      )}

      {!loading && !error && transformations.length > 0 && (
        <>
          <div className="history-list">
            {transformations.map((t) => (
              <div
                key={t.id}
                className={`history-item ${selectedId === t.id ? 'selected' : ''}`}
                onClick={() => loadTransformationDetails(t.id)}
              >
                <div className="item-header">
                  <span className="item-type">{formatType(t.transformation_type)}</span>
                  <span className="item-time">{formatTimestamp(t.created_at)}</span>
                </div>
                <div className="item-prompt">
                  {t.user_prompt || <em>No prompt specified</em>}
                </div>
                <div className="item-preview">
                  <div className="preview-text">
                    {t.source_preview || t.source_text?.substring(0, 100)}
                  </div>
                  <div className="preview-arrow">→</div>
                  <div className="preview-text">
                    {t.result_preview || t.result_text?.substring(0, 100)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="history-pagination">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              ← Previous
            </button>
            <span className="page-info">
              Page {page + 1} of {Math.ceil(total / pageSize)}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * pageSize >= total}
            >
              Next →
            </button>
          </div>
        </>
      )}

      {selectedTransformation && (
        <div className="transformation-details-modal" onClick={() => setSelectedTransformation(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Transformation Details</h3>
              <button className="modal-close" onClick={() => setSelectedTransformation(null)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h4>Type</h4>
                <p>{formatType(selectedTransformation.transformation_type)}</p>
              </div>

              <div className="detail-section">
                <h4>User Prompt</h4>
                <p>{selectedTransformation.user_prompt || <em>No prompt specified</em>}</p>
              </div>

              <div className="detail-section">
                <h4>Original Text</h4>
                <div className="text-box">{selectedTransformation.source_text}</div>
              </div>

              <div className="detail-section">
                <h4>Transformed Text</h4>
                <div className="text-box">{selectedTransformation.result_text}</div>
              </div>

              {selectedTransformation.metrics && (
                <div className="detail-section">
                  <h4>Metrics</h4>
                  <div className="metrics-grid">
                    {selectedTransformation.metrics.processing_time_ms && (
                      <div className="metric-item">
                        <span className="metric-label">Processing Time:</span>
                        <span className="metric-value">
                          {selectedTransformation.metrics.processing_time_ms}ms
                        </span>
                      </div>
                    )}
                    {selectedTransformation.metrics.iterations && (
                      <div className="metric-item">
                        <span className="metric-label">Iterations:</span>
                        <span className="metric-value">
                          {selectedTransformation.metrics.iterations}
                        </span>
                      </div>
                    )}
                    {selectedTransformation.metrics.convergence_score && (
                      <div className="metric-item">
                        <span className="metric-label">Convergence:</span>
                        <span className="metric-value">
                          {selectedTransformation.metrics.convergence_score.toFixed(4)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h4>Parameters</h4>
                <pre className="parameters-json">
                  {JSON.stringify(selectedTransformation.parameters, null, 2)}
                </pre>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-reapply"
                onClick={() => {
                  handleReapply(selectedTransformation);
                  setSelectedTransformation(null);
                }}
              >
                Reapply Settings
              </button>
              <button
                className="btn-close"
                onClick={() => setSelectedTransformation(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransformationHistory;
