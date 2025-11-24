interface ImportPreview {
  new_conversations: Array<{ id: string; title: string; message_count: number }>;
  updated_conversations: Array<{
    id: string;
    title: string;
    existing_messages: number;
    new_messages: number;
  }>;
  conflicts: Array<{ conversation_id: string; reason: string }>;
  media_files: {
    total: number;
    new: number;
    duplicates: number;
  };
}

interface ImportPreviewModalProps {
  preview: ImportPreview;
  filename: string;
  onApply: () => void;
  onCancel: () => void;
}

export function ImportPreviewModal({
  preview,
  filename,
  onApply,
  onCancel,
}: ImportPreviewModalProps) {
  const totalConversations = preview.new_conversations.length + preview.updated_conversations.length;
  const totalNewMessages = preview.updated_conversations.reduce(
    (sum, conv) => sum + conv.new_messages,
    0
  );

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
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>{totalConversations}</strong> conversation(s) will be affected
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>{preview.new_conversations.length}</strong> new conversation(s)
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>{preview.updated_conversations.length}</strong> existing conversation(s) will be
              updated
            </div>
            {totalNewMessages > 0 && (
              <div style={{ color: 'var(--text-secondary)' }}>
                <strong>{totalNewMessages}</strong> new message(s) to be added
              </div>
            )}
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>{preview.media_files.new}</strong> media file(s) to be imported
            </div>
          </div>
        </div>

        {/* New Conversations */}
        {preview.new_conversations.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
              }}
            >
              ✨ New Conversations ({preview.new_conversations.length})
            </h3>
            <div
              style={{
                maxHeight: '150px',
                overflow: 'auto',
                backgroundColor: 'var(--bg-secondary)',
                padding: '0.75rem',
                borderRadius: '6px',
              }}
            >
              {preview.new_conversations.map((conv) => (
                <div
                  key={conv.id}
                  style={{
                    padding: '0.5rem',
                    borderBottom: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {conv.title}
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    {conv.message_count} messages
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Updated Conversations */}
        {preview.updated_conversations.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
              }}
            >
              🔄 Updated Conversations ({preview.updated_conversations.length})
            </h3>
            <div
              style={{
                maxHeight: '150px',
                overflow: 'auto',
                backgroundColor: 'var(--bg-secondary)',
                padding: '0.75rem',
                borderRadius: '6px',
              }}
            >
              {preview.updated_conversations.map((conv) => (
                <div
                  key={conv.id}
                  style={{
                    padding: '0.5rem',
                    borderBottom: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {conv.title}
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    {conv.existing_messages} existing + <strong>{conv.new_messages} new</strong> messages
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conflicts */}
        {preview.conflicts && preview.conflicts.length > 0 && (
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
              ⚠️ Conflicts ({preview.conflicts.length})
            </h3>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {preview.conflicts.map((conflict, idx) => (
                <div key={idx} style={{ marginBottom: '0.25rem' }}>
                  {conflict.conversation_id}: {conflict.reason}
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
