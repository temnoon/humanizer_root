import { useState, useEffect } from 'react';
import api from '@/lib/api-client';
import './EmbeddingsPanel.css';

interface EmbeddingsStatus {
  chatgpt_messages: {
    total: number;
    with_embeddings: number;
    without_embeddings: number;
    percentage_complete: number;
  };
  claude_messages: {
    total: number;
    with_embeddings: number;
    without_embeddings: number;
    percentage_complete: number;
  };
  document_chunks: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    percentage_complete: number;
  };
  overall: {
    total_embeddings: number;
    completed_embeddings: number;
    pending_embeddings: number;
    percentage_complete: number;
  };
}

interface GenerationResult {
  total_messages: number;
  processed: number;
  failed: number;
  processing_time_seconds: number;
}

export default function EmbeddingsPanel() {
  const [status, setStatus] = useState<EmbeddingsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);

  const loadStatus = async () => {
    try {
      setError(null);
      const data = await api.getEmbeddingsStatus();
      setStatus(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load embeddings status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load status');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleGenerateClaudeEmbeddings = async () => {
    if (!status || status.claude_messages.without_embeddings === 0) {
      return;
    }

    if (!confirm(`Generate embeddings for ${status.claude_messages.without_embeddings} Claude messages? This may take several minutes.`)) {
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      setGenerationResult(null);

      const result = await api.generateClaudeEmbeddings(1000);
      setGenerationResult(result);

      // Reload status after generation
      await loadStatus();
      setGenerating(false);
    } catch (err) {
      console.error('Failed to generate embeddings:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate embeddings');
      setGenerating(false);
    }
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  };

  if (loading) {
    return (
      <div className="embeddings-panel">
        <div className="embeddings-loading">
          <div className="loading-spinner"></div>
          <p>Loading embeddings status...</p>
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="embeddings-panel">
        <div className="embeddings-error">
          <p className="error-icon">⚠️</p>
          <p className="error-text">{error}</p>
          <button className="retry-button" onClick={loadStatus}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <div className="embeddings-panel">
      <div className="embeddings-header">
        <h2>Embeddings Management</h2>
        <button className="refresh-button" onClick={loadStatus} disabled={generating}>
          🔄 Refresh
        </button>
      </div>

      {/* Overall Status */}
      <div className="embeddings-section">
        <h3>Overall Status</h3>
        <div className="stat-card overall-card">
          <div className="stat-row">
            <span className="stat-label">Total Embeddings:</span>
            <span className="stat-value">{formatNumber(status.overall.total_embeddings)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Completed:</span>
            <span className="stat-value completed">{formatNumber(status.overall.completed_embeddings)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Pending:</span>
            <span className="stat-value pending">{formatNumber(status.overall.pending_embeddings)}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill overall"
              style={{ width: `${status.overall.percentage_complete}%` }}
            />
          </div>
          <div className="progress-text">
            {status.overall.percentage_complete.toFixed(1)}% complete
          </div>
        </div>
      </div>

      {/* ChatGPT Messages */}
      <div className="embeddings-section">
        <h3>💬 ChatGPT Messages</h3>
        <div className="stat-card">
          <div className="stat-row">
            <span className="stat-label">Total Messages:</span>
            <span className="stat-value">{formatNumber(status.chatgpt_messages.total)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">With Embeddings:</span>
            <span className="stat-value completed">{formatNumber(status.chatgpt_messages.with_embeddings)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Without Embeddings:</span>
            <span className="stat-value pending">{formatNumber(status.chatgpt_messages.without_embeddings)}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill chatgpt"
              style={{ width: `${status.chatgpt_messages.percentage_complete}%` }}
            />
          </div>
          <div className="progress-text">
            {status.chatgpt_messages.percentage_complete.toFixed(1)}% complete
          </div>
        </div>
      </div>

      {/* Claude Messages */}
      <div className="embeddings-section">
        <h3>🤖 Claude Messages</h3>
        <div className="stat-card">
          <div className="stat-row">
            <span className="stat-label">Total Messages:</span>
            <span className="stat-value">{formatNumber(status.claude_messages.total)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">With Embeddings:</span>
            <span className="stat-value completed">{formatNumber(status.claude_messages.with_embeddings)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Without Embeddings:</span>
            <span className="stat-value pending">{formatNumber(status.claude_messages.without_embeddings)}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill claude"
              style={{ width: `${status.claude_messages.percentage_complete}%` }}
            />
          </div>
          <div className="progress-text">
            {status.claude_messages.percentage_complete.toFixed(1)}% complete
          </div>

          {status.claude_messages.without_embeddings > 0 && (
            <button
              className="generate-button"
              onClick={handleGenerateClaudeEmbeddings}
              disabled={generating}
            >
              {generating ? '⚙️ Generating...' : '🚀 Generate Embeddings'}
            </button>
          )}
        </div>
      </div>

      {/* Document Chunks */}
      <div className="embeddings-section">
        <h3>📄 Document Chunks</h3>
        <div className="stat-card">
          <div className="stat-row">
            <span className="stat-label">Total Chunks:</span>
            <span className="stat-value">{formatNumber(status.document_chunks.total)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Completed:</span>
            <span className="stat-value completed">{formatNumber(status.document_chunks.completed)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Pending:</span>
            <span className="stat-value pending">{formatNumber(status.document_chunks.pending)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Processing:</span>
            <span className="stat-value processing">{formatNumber(status.document_chunks.processing)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Failed:</span>
            <span className="stat-value failed">{formatNumber(status.document_chunks.failed)}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill document"
              style={{ width: `${status.document_chunks.percentage_complete}%` }}
            />
          </div>
          <div className="progress-text">
            {status.document_chunks.percentage_complete.toFixed(1)}% complete
          </div>
        </div>
      </div>

      {/* Generation Result */}
      {generationResult && (
        <div className="embeddings-section">
          <h3>✅ Generation Complete</h3>
          <div className="result-card success">
            <div className="result-row">
              <span className="result-label">Messages Processed:</span>
              <span className="result-value">{formatNumber(generationResult.processed)} / {formatNumber(generationResult.total_messages)}</span>
            </div>
            <div className="result-row">
              <span className="result-label">Failed:</span>
              <span className="result-value">{formatNumber(generationResult.failed)}</span>
            </div>
            <div className="result-row">
              <span className="result-label">Processing Time:</span>
              <span className="result-value">{formatTime(generationResult.processing_time_seconds)}</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
