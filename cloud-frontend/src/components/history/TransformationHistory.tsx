// TransformationHistory - Main history panel with filters and search
// Displays user's transformation history with pagination

import { useState, useEffect } from 'react';
import { cloudAPI } from '../../lib/cloud-api-client';
import TransformationCard from './TransformationCard';

interface TransformationHistoryProps {
  onLoadInput?: (text: string) => void;
  onLoadOutput?: (data: any) => void;
}

export default function TransformationHistory({
  onLoadInput,
  onLoadOutput
}: TransformationHistoryProps) {
  const [transformations, setTransformations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({ type: 'all', status: 'all' });
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0, has_more: false });

  const loadHistory = async (offset: number = 0) => {
    setLoading(true);
    setError(null);

    try {
      const params: any = {
        limit: 20,
        offset
      };

      if (filter.type !== 'all') params.type = filter.type;
      if (filter.status !== 'all') params.status = filter.status;

      const response = await cloudAPI.getTransformationHistory(params);
      setTransformations(response.transformations);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [filter]);

  const handleLoadInput = (text: string) => {
    if (onLoadInput) {
      onLoadInput(text);
      alert('Input loaded! Switch to the transformation tab to use it.');
    }
  };

  const handleLoadOutput = (data: any) => {
    if (onLoadOutput) {
      onLoadOutput(data);
      alert('Output loaded! Check the results below.');
    }
  };

  const handleNextPage = () => {
    if (pagination.has_more) {
      loadHistory(pagination.offset + pagination.limit);
    }
  };

  const handlePrevPage = () => {
    if (pagination.offset > 0) {
      loadHistory(Math.max(0, pagination.offset - pagination.limit));
    }
  };

  return (
    <div style={{ padding: 'var(--spacing-lg)', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h2>📚 Transformation History</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--spacing-sm)' }}>
          View and manage your past transformations. Click any card to expand details.
        </p>
      </div>

      {/* Filters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-lg)',
        padding: 'var(--spacing-md)',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)'
      }}>
        <div>
          <label style={{
            display: 'block',
            marginBottom: 'var(--spacing-xs)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500
          }}>
            Type
          </label>
          <select
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)'
            }}
          >
            <option value="all">All Types</option>
            <option value="allegorical">🎭 Allegorical</option>
            <option value="round-trip">🔄 Round-Trip</option>
            <option value="maieutic">🤔 Maieutic</option>
            <option value="ai-detection">🔍 AI Detection</option>
          </select>
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: 'var(--spacing-xs)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500
          }}>
            Status
          </label>
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)'
            }}
          >
            <option value="all">All Status</option>
            <option value="completed">✅ Completed</option>
            <option value="pending">⏳ Pending</option>
            <option value="processing">🔄 Processing</option>
            <option value="failed">❌ Failed</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{
          textAlign: 'center',
          padding: 'var(--spacing-2xl)',
          color: 'var(--text-secondary)'
        }}>
          Loading transformations...
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={{
          padding: 'var(--spacing-md)',
          background: 'rgba(248, 113, 113, 0.1)',
          border: '1px solid var(--accent-red)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--accent-red)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && transformations.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 'var(--spacing-2xl)',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>📭</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
            No transformations found
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
            Run a transformation to see it appear here
          </div>
        </div>
      )}

      {/* Transformation List */}
      {!loading && transformations.length > 0 && (
        <div>
          {transformations.map((t) => (
            <TransformationCard
              key={t.id}
              transformation={t}
              onDelete={() => loadHistory(pagination.offset)}
              onLoadInput={handleLoadInput}
              onLoadOutput={handleLoadOutput}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && transformations.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 'var(--spacing-lg)',
          padding: 'var(--spacing-md)',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)'
        }}>
          <button
            onClick={handlePrevPage}
            disabled={pagination.offset === 0}
            className="copy-button"
            style={{
              opacity: pagination.offset === 0 ? 0.5 : 1,
              cursor: pagination.offset === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            ← Previous
          </button>

          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
          </div>

          <button
            onClick={handleNextPage}
            disabled={!pagination.has_more}
            className="copy-button"
            style={{
              opacity: !pagination.has_more ? 0.5 : 1,
              cursor: !pagination.has_more ? 'not-allowed' : 'pointer'
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
