// API response format from IncrementalImporter.generatePreview()
interface ImportPreview {
  newConversations: number;
  existingConversationsToUpdate: number;
  newMessages: number;
  newMediaFiles: number;
  conflicts: Array<{
    conversationId: string;
    conversationTitle: string;
    type: string;
    existingCount: number;
    newCount: number;
    resolution: string;
  }>;
  estimatedSize: number;
}

interface ImportPreviewModalProps {
  preview: ImportPreview;
  filename: string;
  createNewArchive?: boolean;
  onApply: () => void;
  onCancel: () => void;
}

export function ImportPreviewModal({
  preview,
  filename,
  createNewArchive = false,
  onApply,
  onCancel,
}: ImportPreviewModalProps) {
  // Defensive defaults for preview fields (counts, not arrays)
  const newConversationsCount = preview?.newConversations ?? 0;
  const updatedConversationsCount = preview?.existingConversationsToUpdate ?? 0;
  const newMessagesCount = preview?.newMessages ?? 0;
  const newMediaFilesCount = preview?.newMediaFiles ?? 0;
  const conflicts = preview?.conflicts || [];
  const estimatedSize = preview?.estimatedSize ?? 0;

  const totalConversations = newConversationsCount + updatedConversationsCount;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
            }}
          >
            📋 Import Preview
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {filename}
          </p>
        </div>

        {/* Summary */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
          }}
        >
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.75rem',
            }}
          >
            Summary
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Import Mode */}
            <div
              style={{
                color: createNewArchive ? 'var(--accent-purple)' : 'var(--accent-primary)',
                fontWeight: 600,
                paddingBottom: '0.5rem',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              {createNewArchive ? '📁 Creating new archive folder' : '🔄 Merging into current archive'}
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>{totalConversations}</strong> conversation(s) will be affected
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>{newConversationsCount}</strong> new conversation(s)
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>{updatedConversationsCount}</strong> existing conversation(s) will be
              updated
            </div>
            {newMessagesCount > 0 && (
              <div style={{ color: 'var(--text-secondary)' }}>
                <strong>{newMessagesCount}</strong> new message(s) to be added
              </div>
            )}
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>{newMediaFilesCount}</strong> media file(s) to be imported
            </div>
            {estimatedSize > 0 && (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Estimated size: {Math.round(estimatedSize / 1024 / 1024)} MB
              </div>
            )}
          </div>
        </div>

        {/* New Conversations Summary */}
        {newConversationsCount > 0 && (
          <div
            style={{
              backgroundColor: 'rgba(100, 200, 100, 0.1)',
              padding: '1rem',
              borderRadius: '6px',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>✨</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {newConversationsCount} New Conversation{newConversationsCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              These conversations will be added to your archive.
            </div>
          </div>
        )}

        {/* Updated Conversations Summary */}
        {updatedConversationsCount > 0 && (
          <div
            style={{
              backgroundColor: 'rgba(100, 150, 255, 0.1)',
              padding: '1rem',
              borderRadius: '6px',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🔄</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {updatedConversationsCount} Existing Conversation{updatedConversationsCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              These conversations already exist and will be checked for new messages.
            </div>
          </div>
        )}

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div
            style={{
              backgroundColor: 'rgba(255, 100, 100, 0.1)',
              padding: '1rem',
              borderRadius: '6px',
              marginBottom: '1.5rem',
            }}
          >
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: '#ff6464',
                marginBottom: '0.5rem',
              }}
            >
              ⚠️ Conflicts ({conflicts.length})
            </h3>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {conflicts.map((conflict, idx) => (
                <div key={idx} style={{ marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {conflict.conversationTitle || conflict.conversationId}
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    Type: {conflict.type} • Resolution: {conflict.resolution}
                    {conflict.existingCount > 0 && ` • ${conflict.existingCount} existing messages`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button
            onClick={onApply}
            className="tag"
            style={{
              flex: 1,
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--text-inverse)',
              border: '1px solid var(--accent-primary)',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✅ Apply Import
          </button>
          <button
            onClick={onCancel}
            className="tag"
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ❌ Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
