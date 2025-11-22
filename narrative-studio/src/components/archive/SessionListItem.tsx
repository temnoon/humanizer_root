import { useState } from 'react';
import { Session } from '../../services/sessionStorage';

interface SessionListItemProps {
  session: Session;
  onSelect: (session: Session) => void;
  onRename: (sessionId: string, newName: string) => void;
  onDelete: (sessionId: string) => void;
  isActive?: boolean;
}

export function SessionListItem({
  session,
  onSelect,
  onRename,
  onDelete,
  isActive = false
}: SessionListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(session.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleRename = () => {
    if (editedName.trim() && editedName !== session.name) {
      onRename(session.sessionId, editedName.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditedName(session.name);
      setIsEditing(false);
    }
  };

  const handleDelete = () => {
    onDelete(session.sessionId);
    setShowDeleteConfirm(false);
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <div
      className={`session-list-item ${isActive ? 'active' : ''}`}
      style={{
        padding: '12px',
        borderBottom: '1px solid var(--border-color)',
        cursor: 'pointer',
        backgroundColor: isActive ? 'var(--bg-secondary)' : 'transparent',
        transition: 'background-color 0.2s'
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <div onClick={() => !isEditing && onSelect(session)}>
        {/* Session Name */}
        {isEditing ? (
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            autoFocus
            className="ui-text"
            style={{
              width: '100%',
              padding: '4px 8px',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '4px',
              outline: 'none'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="ui-text"
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              marginBottom: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {session.name}
          </div>
        )}

        {/* Session Metadata */}
        <div
          className="ui-text"
          style={{
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '4px'
          }}
        >
          <span>{formatDate(session.updated)}</span>
          <span>•</span>
          <span>{session.buffers.length} buffer{session.buffers.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Actions */}
      {!isEditing && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '8px'
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="ui-text"
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            Rename
          </button>

          {showDeleteConfirm ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="ui-text"
                style={{
                  padding: '4px 12px',
                  fontSize: '12px',
                  color: 'white',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ef4444';
                }}
              >
                Confirm
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                className="ui-text"
                style={{
                  padding: '4px 12px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              className="ui-text"
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                color: '#ef4444',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.borderColor = '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
