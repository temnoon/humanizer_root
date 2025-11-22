import { SessionBuffer } from '../../services/sessionStorage';

interface BufferTabsProps {
  buffers: SessionBuffer[];
  activeBufferId: string;
  onSelectBuffer: (bufferId: string) => void;
  onCloseBuffer: (bufferId: string) => void;
}

export function BufferTabs({
  buffers,
  activeBufferId,
  onSelectBuffer,
  onCloseBuffer
}: BufferTabsProps) {
  if (buffers.length === 0) {
    return null;
  }

  return (
    <div
      className="buffer-tabs"
      style={{
        display: 'flex',
        gap: '4px',
        padding: '8px 16px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        overflowX: 'auto',
        overflowY: 'hidden',
        whiteSpace: 'nowrap'
      }}
    >
      {buffers.map((buffer) => {
        const isActive = buffer.bufferId === activeBufferId;
        const isOriginal = buffer.bufferId === 'buffer-0';

        return (
          <div
            key={buffer.bufferId}
            className="buffer-tab"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              backgroundColor: isActive ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
              border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              borderBottom: isActive ? 'none' : `1px solid var(--border-color)`,
              borderRadius: '6px 6px 0 0',
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
              maxWidth: '200px'
            }}
            onClick={() => onSelectBuffer(buffer.bufferId)}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              }
            }}
          >
            {/* Buffer Name */}
            <span
              className="ui-text"
              style={{
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {buffer.displayName}
              {buffer.isEdited && ' *'}
            </span>

            {/* Close Button (not for original buffer) */}
            {!isOriginal && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseBuffer(buffer.bufferId);
                }}
                className="ui-text"
                style={{
                  padding: '2px 4px',
                  fontSize: '12px',
                  color: 'var(--text-tertiary)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  lineHeight: 1,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                  e.currentTarget.style.color = '#ef4444';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                }}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
