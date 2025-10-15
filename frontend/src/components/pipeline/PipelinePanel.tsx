import { useState, useEffect } from 'react';
import './PipelinePanel.css';

interface EmbeddingStats {
  total_messages: number;
  messages_with_embeddings: number;
  messages_without_embeddings: number;
  coverage_percent: number;
}

interface PipelineJob {
  id: string;
  job_type: string;
  status: string;
  target_type: string;
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  progress_percent: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  result_summary?: any;
}

export default function PipelinePanel() {
  const [stats, setStats] = useState<EmbeddingStats | null>(null);
  const [activeJob, setActiveJob] = useState<PipelineJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<PipelineJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Job creation form
  const [limit, setLimit] = useState<number | null>(null);
  const [authorRole, setAuthorRole] = useState<string>('');

  useEffect(() => {
    loadStats();
    loadJobs();
  }, []);

  // Auto-refresh active job
  useEffect(() => {
    if (activeJob && activeJob.status === 'running') {
      const interval = setInterval(() => {
        refreshActiveJob(activeJob.id);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeJob]);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/pipeline/stats/embeddings');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadJobs = async () => {
    try {
      const response = await fetch('/api/pipeline/jobs?limit=10');
      const data = await response.json();
      setRecentJobs(data.jobs);

      // Find active job
      const active = data.jobs.find((j: PipelineJob) => j.status === 'running' || j.status === 'pending');
      if (active) {
        setActiveJob(active);
      }
    } catch (err) {
      console.error('Failed to load jobs:', err);
    }
  };

  const refreshActiveJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/pipeline/jobs/${jobId}`);
      const job = await response.json();
      setActiveJob(job);

      // If job finished, reload all data
      if (job.status !== 'running' && job.status !== 'pending') {
        setActiveJob(null);
        await loadStats();
        await loadJobs();
      }
    } catch (err) {
      console.error('Failed to refresh job:', err);
    }
  };

  const startEmbeddingJob = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload: any = {};
      if (limit !== null && limit > 0) payload.limit = limit;
      if (authorRole) payload.author_role = authorRole;

      const response = await fetch('/api/pipeline/jobs/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to create job');
      }

      const job = await response.json();
      setActiveJob(job);
      setLimit(null);
      setAuthorRole('');

      // Start polling
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start job');
    } finally {
      setLoading(false);
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      await fetch(`/api/pipeline/jobs/${jobId}/cancel`, { method: 'POST' });
      setActiveJob(null);
      await loadJobs();
    } catch (err) {
      console.error('Failed to cancel job:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const formatDuration = (start?: string, end?: string) => {
    if (!start) return '-';
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const seconds = Math.floor((endTime - startTime) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="pipeline-panel">
      <div className="pipeline-header">
        <h2>⚡ Embedding Pipeline</h2>
        <p className="pipeline-subtitle">Batch embedding generation for semantic search</p>
      </div>

      {/* Coverage Stats */}
      {stats && (
        <div className="pipeline-section">
          <h3>📊 Coverage Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Messages</div>
              <div className="stat-value">{stats.total_messages.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">With Embeddings</div>
              <div className="stat-value">{stats.messages_with_embeddings.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Without Embeddings</div>
              <div className="stat-value">{stats.messages_without_embeddings.toLocaleString()}</div>
            </div>
            <div className="stat-card highlight">
              <div className="stat-label">Coverage</div>
              <div className="stat-value">{stats.coverage_percent.toFixed(2)}%</div>
            </div>
          </div>

          {/* Coverage bar */}
          <div className="coverage-bar">
            <div
              className="coverage-fill"
              style={{ width: `${stats.coverage_percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Active Job */}
      {activeJob && (
        <div className="pipeline-section">
          <h3>🚀 Active Job</h3>
          <div className="active-job">
            <div className="job-header">
              <span className={`job-status status-${activeJob.status}`}>
                {activeJob.status}
              </span>
              <span className="job-type">{activeJob.job_type}</span>
              <span className="job-duration">
                {formatDuration(activeJob.started_at)}
              </span>
            </div>

            <div className="job-progress">
              <div className="progress-info">
                <span>
                  {activeJob.processed_items.toLocaleString()} / {activeJob.total_items.toLocaleString()} messages
                </span>
                <span>{activeJob.progress_percent.toFixed(1)}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${activeJob.progress_percent}%` }}
                />
              </div>
            </div>

            <div className="job-stats">
              <span className="job-stat success">
                ✓ {activeJob.successful_items} successful
              </span>
              {activeJob.failed_items > 0 && (
                <span className="job-stat failed">
                  ✗ {activeJob.failed_items} failed
                </span>
              )}
            </div>

            {activeJob.status === 'running' && (
              <button
                className="cancel-button"
                onClick={() => cancelJob(activeJob.id)}
              >
                Cancel Job
              </button>
            )}
          </div>
        </div>
      )}

      {/* Job Creation */}
      {!activeJob && (
        <div className="pipeline-section">
          <h3>➕ Start New Job</h3>
          <div className="job-form">
            <div className="form-group">
              <label htmlFor="limit">Message Limit (leave empty for all)</label>
              <input
                id="limit"
                type="number"
                placeholder="e.g., 1000 or leave empty"
                value={limit ?? ''}
                onChange={(e) => setLimit(e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">Author Role Filter (optional)</label>
              <select
                id="role"
                value={authorRole}
                onChange={(e) => setAuthorRole(e.target.value)}
              >
                <option value="">All roles</option>
                <option value="user">User messages only</option>
                <option value="assistant">Assistant messages only</option>
                <option value="system">System messages only</option>
              </select>
            </div>

            {error && <div className="error-message">{error}</div>}

            <button
              className="start-button"
              onClick={startEmbeddingJob}
              disabled={loading}
            >
              {loading ? 'Starting...' : '🚀 Start Embedding Job'}
            </button>

            {stats && stats.messages_without_embeddings > 0 && (
              <p className="estimate-text">
                Estimated time: ~{Math.ceil(stats.messages_without_embeddings * 0.11 / 60)} minutes
                for {stats.messages_without_embeddings.toLocaleString()} remaining messages
              </p>
            )}
          </div>
        </div>
      )}

      {/* Recent Jobs */}
      {recentJobs.length > 0 && (
        <div className="pipeline-section">
          <h3>📋 Recent Jobs</h3>
          <div className="job-list">
            {recentJobs.map((job) => (
              <div key={job.id} className="job-item">
                <div className="job-item-header">
                  <span className={`job-status status-${job.status}`}>
                    {job.status}
                  </span>
                  <span className="job-date">{formatDate(job.created_at)}</span>
                </div>
                <div className="job-item-details">
                  <span>{job.total_items} messages</span>
                  <span>{job.progress_percent.toFixed(0)}% complete</span>
                  {job.result_summary && (
                    <span>
                      ✓ {job.result_summary.successful} / ✗ {job.result_summary.failed}
                    </span>
                  )}
                </div>
                {job.completed_at && (
                  <div className="job-duration-text">
                    Duration: {formatDuration(job.started_at, job.completed_at)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
