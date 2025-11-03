import { useState, useEffect } from 'react';

interface MailingListEntry {
  id: number;
  name: string;
  email: string;
  interest_comment?: string;
  created_at: string;
}

interface MailingListViewerProps {
  token: string;
}

export default function MailingListViewer({ token }: MailingListViewerProps) {
  const [entries, setEntries] = useState<MailingListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMailingList();
  }, [token]);

  const fetchMailingList = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('https://api.humanizer.com/mailing-list/export', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch mailing list');
      }

      const data = await response.json();
      setEntries(data.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mailing list');
    } finally {
      setIsLoading(false);
    }
  };

  const exportCSV = async () => {
    try {
      const response = await fetch('https://api.humanizer.com/mailing-list/export/csv', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export CSV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mailing-list-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV');
    }
  };

  const exportJSON = () => {
    const json = JSON.stringify(entries, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mailing-list-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
        <div className="loading"></div>
        <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
          Loading mailing list...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        {error}
      </div>
    );
  }

  return (
    <div>
      {/* Header with export buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--spacing-lg)'
      }}>
        <h2>Mailing List ({entries.length} subscribers)</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          <button
            onClick={exportJSON}
            className="btn"
            style={{
              background: 'var(--accent-cyan)',
              color: 'white'
            }}
          >
            Export JSON
          </button>
          <button
            onClick={exportCSV}
            className="btn btn-primary"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            No mailing list entries yet.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr style={{
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-color)'
              }}>
                <th style={{
                  padding: 'var(--spacing-md)',
                  textAlign: 'left',
                  fontWeight: 600
                }}>Name</th>
                <th style={{
                  padding: 'var(--spacing-md)',
                  textAlign: 'left',
                  fontWeight: 600
                }}>Email</th>
                <th style={{
                  padding: 'var(--spacing-md)',
                  textAlign: 'left',
                  fontWeight: 600
                }}>Interest</th>
                <th style={{
                  padding: 'var(--spacing-md)',
                  textAlign: 'left',
                  fontWeight: 600
                }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} style={{
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  <td style={{ padding: 'var(--spacing-md)' }}>{entry.name}</td>
                  <td style={{ padding: 'var(--spacing-md)' }}>
                    <a href={`mailto:${entry.email}`} style={{ color: 'var(--accent-purple)' }}>
                      {entry.email}
                    </a>
                  </td>
                  <td style={{
                    padding: 'var(--spacing-md)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.875rem',
                    maxWidth: '300px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }} title={entry.interest_comment}>
                    {entry.interest_comment || '-'}
                  </td>
                  <td style={{
                    padding: 'var(--spacing-md)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.875rem'
                  }}>
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
