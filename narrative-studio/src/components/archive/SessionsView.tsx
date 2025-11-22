import { useEffect } from 'react';
import { useSession } from '../../contexts/SessionContext';
import { SessionListItem } from './SessionListItem';
import { Session } from '../../services/sessionStorage';

interface SessionsViewProps {
  onSelectSession: (session: Session) => void;
}

export function SessionsView({ onSelectSession }: SessionsViewProps) {
  const {
    sessions,
    currentSession,
    isLoading,
    error,
    refreshSessions,
    loadSession,
    renameSession,
    deleteSession,
    createSession
  } = useSession();

  // Load sessions on mount
  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const handleSelectSession = async (session: Session) => {
    await loadSession(session.sessionId);
    onSelectSession(session);
  };

  const handleRename = async (sessionId: string, newName: string) => {
    await renameSession(sessionId, newName);
    await refreshSessions();
  };

  const handleDelete = async (sessionId: string) => {
    await deleteSession(sessionId);
    await refreshSessions();
  };

  const handleNewSession = async () => {
    const session = await createSession();
    if (session) {
      await refreshSessions();
    }
  };

  return (
    <div
      className="sessions-view"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary)'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <h2
          className="ui-text"
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0
          }}
        >
          Sessions
        </h2>
        <button
          onClick={handleNewSession}
          className="ui-text"
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: 500,
            color: 'white',
            backgroundColor: 'var(--accent-primary)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
          }}
        >
          + New Session
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div
          style={{
            padding: '32px',
            textAlign: 'center'
          }}
        >
          <div
            className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-3"
            style={{
              borderColor: 'var(--accent-primary)',
              borderTopColor: 'transparent'
            }}
          />
          <p
            className="ui-text"
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)'
            }}
          >
            Loading sessions...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          style={{
            padding: '16px',
            margin: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: '8px'
          }}
        >
          <p
            className="ui-text"
            style={{
              fontSize: '14px',
              color: '#ef4444',
              margin: 0
            }}
          >
            {error}
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && sessions.length === 0 && (
        <div
          style={{
            padding: '32px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              fontSize: '48px',
              marginBottom: '16px',
              opacity: 0.3
            }}
          >
            📋
          </div>
          <p
            className="ui-text"
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              marginBottom: '16px'
            }}
          >
            No sessions yet
          </p>
          <p
            className="ui-text"
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              maxWidth: '250px',
              margin: '0 auto'
            }}
          >
            Sessions will be auto-created when you perform transformations or analyses.
          </p>
        </div>
      )}

      {/* Sessions List */}
      {!isLoading && !error && sessions.length > 0 && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto'
          }}
        >
          {sessions.map((session) => (
            <SessionListItem
              key={session.sessionId}
              session={session}
              onSelect={handleSelectSession}
              onRename={handleRename}
              onDelete={handleDelete}
              isActive={currentSession?.sessionId === session.sessionId}
            />
          ))}
        </div>
      )}

      {/* Footer Info */}
      {!isLoading && sessions.length > 0 && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)'
          }}
        >
          <p
            className="ui-text"
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              margin: 0
            }}
          >
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} • Click to load
          </p>
        </div>
      )}
    </div>
  );
}
