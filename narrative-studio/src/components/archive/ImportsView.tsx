import { useState, useEffect } from 'react';

const ARCHIVE_SERVER_URL = 'http://localhost:3002';

interface ImportJob {
  id: string;
  status: 'uploaded' | 'parsing' | 'previewing' | 'ready' | 'applying' | 'completed' | 'failed';
  progress: number;
  filename?: string;
  size?: number;
  startTime?: number;
  error?: string;
}

export function ImportsView() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(false);

  // For this MVP, we'll just show placeholder text since we don't have
  // persistent job storage. In production, you'd store jobs in a database.
  const loadJobs = async () => {
    setLoading(true);
    try {
      // TODO: Implement job history endpoint
      // For now, just show empty state
      setJobs([]);
    } catch (err) {
      console.error('Error loading import jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'applying':
      case 'parsing':
      case 'previewing':
        return '⏳';
      case 'ready':
        return '📋';
      default:
        return '📤';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4ade80';
      case 'failed':
        return '#ff6464';
      case 'applying':
      case 'parsing':
      case 'previewing':
        return '#fbbf24';
      case 'ready':
        return '#60a5fa';
      default:
        return 'var(--text-secondary)';
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '200px',
          color: 'var(--text-secondary)',
        }}
      >
        Loading imports...
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '400px',
          gap: '1rem',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ fontSize: '4rem' }}>📦</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>No Import History</div>
        <div style={{ fontSize: '0.9rem', textAlign: 'center', maxWidth: '400px' }}>
          Import OpenAI or Claude conversation archives using the "📥 Import Archive" button
          in the Archive tab.
        </div>
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            fontSize: '0.85rem',
            maxWidth: '500px',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Supported Formats:</div>
          <ul style={{ paddingLeft: '1.5rem', margin: 0 }}>
            <li>OpenAI conversation exports (conversations.json)</li>
            <li>Claude conversation exports (conversations.json + users.json)</li>
            <li>Smart merge: New messages are appended to existing conversations</li>
            <li>Media files automatically matched and imported</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h3
        style={{
          fontSize: '1.2rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1rem',
        }}
      >
        Import History
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {jobs.map((job) => (
          <div
            key={job.id}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>{getStatusIcon(job.status)}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {job.filename || 'archive.zip'}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                {job.startTime && formatDate(job.startTime)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <div>
                Size: {job.size ? formatFileSize(job.size) : 'Unknown'}
              </div>
              <div style={{ color: getStatusColor(job.status), fontWeight: 600 }}>
                Status: {job.status}
              </div>
              {job.progress > 0 && job.progress < 100 && (
                <div>Progress: {job.progress}%</div>
              )}
            </div>

            {job.error && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: 'rgba(255, 100, 100, 0.1)',
                  borderRadius: '4px',
                  color: '#ff6464',
                  fontSize: '0.85rem',
                }}
              >
                Error: {job.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
