interface PanelToggleProps {
  side: 'left' | 'right';
  isOpen: boolean;
  onToggle: () => void;
  label: string;
}

export function PanelToggle({ side, isOpen, onToggle, label }: PanelToggleProps) {
  if (isOpen) return null;

  return (
    <button
      onClick={onToggle}
      title={`Show ${label}`}
      className="panel-toggle"
      style={{
        position: 'fixed',
        top: '50%',
        [side]: '0',
        transform: 'translateY(-50%)',
        width: '32px',
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-secondary)',
        border: `1px solid var(--border-color)`,
        borderRadius: side === 'left' ? '0 8px 8px 0' : '8px 0 0 8px',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        zIndex: 30,
        fontSize: '18px',
        transition: 'all 0.2s',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
        e.currentTarget.style.color = 'var(--accent-primary)';
        e.currentTarget.style.width = '40px';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
        e.currentTarget.style.color = 'var(--text-secondary)';
        e.currentTarget.style.width = '32px';
      }}
    >
      {side === 'left' ? '›' : '‹'}
    </button>
  );
}
