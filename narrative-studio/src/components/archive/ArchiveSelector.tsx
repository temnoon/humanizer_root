import { useState, useEffect } from 'react';
import { STORAGE_PATHS } from '../../config/storage-paths';

const ARCHIVE_SERVER_URL = STORAGE_PATHS.archiveServerUrl;

interface Archive {
  name: string;
  path: string;
  conversationCount: number;
  isActive: boolean;
  createdAt: string;
  modifiedAt: string;
}

interface ArchiveSelectorProps {
  onArchiveChange?: () => void;
}

export function ArchiveSelector({ onArchiveChange }: ArchiveSelectorProps) {
  const [archives, setArchives] = useState<Archive[]>([]);
  const [currentArchive, setCurrentArchive] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadArchives = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${ARCHIVE_SERVER_URL}/api/archives`);
      const data = await res.json();
      setArchives(data.archives || []);
      setCurrentArchive(data.current || '');
    } catch (err) {
      console.error('Failed to load archives:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchives();
  }, []);

  const handleSwitch = async (archiveName: string) => {
    if (archiveName === currentArchive || switching) return;

    setSwitching(true);
    try {
      const res = await fetch(`${ARCHIVE_SERVER_URL}/api/archives/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archiveName }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to switch archive');
      }

      const result = await res.json();
      setCurrentArchive(result.currentArchive);
      setExpanded(false);

      // Notify parent and reload page to refresh conversation list
      if (onArchiveChange) {
        onArchiveChange();
      }

      // Reload the page to refresh all data
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to switch archive:', err);
      alert(`Failed to switch archive: ${err.message}`);
    } finally {
      setSwitching(false);
    }
  };

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString();
  };

  const currentArchiveData = archives.find((a) => a.name === currentArchive);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: expanded ? '1rem' : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>📁</span>
          <div>
            <div
              style={{
                fontSize: '0.95rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Current Archive
            </div>
            <div
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
              }}
            >
              {loading ? (
                'Loading...'
              ) : (
                <>
                  {currentArchive || 'None selected'}
                  {currentArchiveData && (
                    <span style={{ marginLeft: '0.5rem', color: 'var(--text-tertiary)' }}>
                      ({currentArchiveData.conversationCount} conversations)
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <span>{expanded ? '▲' : '▼'}</span>
          <span>{expanded ? 'Hide' : 'Switch'}</span>
        </button>
      </div>

      {expanded && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxHeight: '300px',
            overflow: 'auto',
          }}
        >
          {archives.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '1rem',
                color: 'var(--text-tertiary)',
              }}
            >
              No archives found
            </div>
          ) : (
            archives.map((archive) => (
              <button
                key={archive.name}
                onClick={() => handleSwitch(archive.name)}
                disabled={switching || archive.isActive}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: archive.isActive
                    ? 'var(--accent-primary)'
                    : 'var(--bg-tertiary)',
                  color: archive.isActive
                    ? 'var(--text-inverse)'
                    : 'var(--text-primary)',
                  border: archive.isActive
                    ? '2px solid var(--accent-primary)'
                    : '1px solid var(--border-color)',
                  cursor:
                    switching || archive.isActive ? 'not-allowed' : 'pointer',
                  opacity: switching ? 0.6 : 1,
                  textAlign: 'left',
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    {archive.isActive && <span>✓</span>}
                    {archive.name}
                  </div>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      opacity: 0.8,
                      marginTop: '0.25rem',
                    }}
                  >
                    {archive.conversationCount} conversations • Modified{' '}
                    {formatDate(archive.modifiedAt)}
                  </div>
                </div>
                {!archive.isActive && (
                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                    {switching ? 'Switching...' : 'Select'}
                  </span>
                )}
              </button>
            ))
          )}

          <button
            onClick={loadArchives}
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              color: 'var(--accent-primary)',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh list'}
          </button>
        </div>
      )}
    </div>
  );
}
