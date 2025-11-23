import type { Session } from '../../services/sessionStorage';
import { VIEW_MODES, VIEW_MODE_LABELS } from '../../config/view-modes';

interface ViewModeToggleProps {
  viewMode: Session['viewMode'];
  onChangeViewMode: (mode: Session['viewMode']) => void;
}

export function ViewModeToggle({ viewMode, onChangeViewMode }: ViewModeToggleProps) {
  return (
    <div
      className="view-mode-toggle"
      style={{
        display: 'flex',
        gap: '8px',
        padding: '8px 16px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)'
      }}
    >
      <button
        onClick={() => onChangeViewMode(VIEW_MODES.SPLIT)}
        className="ui-text"
        style={{
          padding: '6px 12px',
          fontSize: '13px',
          fontWeight: viewMode === VIEW_MODES.SPLIT ? 600 : 400,
          color: viewMode === VIEW_MODES.SPLIT ? 'white' : 'var(--text-secondary)',
          backgroundColor: viewMode === VIEW_MODES.SPLIT ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
          border: `1px solid ${viewMode === VIEW_MODES.SPLIT ? 'var(--accent-primary)' : 'var(--border-color)'}`,
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (viewMode !== VIEW_MODES.SPLIT) {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (viewMode !== VIEW_MODES.SPLIT) {
            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }
        }}
      >
        {VIEW_MODE_LABELS[VIEW_MODES.SPLIT]}
      </button>

      <button
        onClick={() => onChangeViewMode(VIEW_MODES.SINGLE_ORIGINAL)}
        className="ui-text"
        style={{
          padding: '6px 12px',
          fontSize: '13px',
          fontWeight: viewMode === VIEW_MODES.SINGLE_ORIGINAL ? 600 : 400,
          color: viewMode === VIEW_MODES.SINGLE_ORIGINAL ? 'white' : 'var(--text-secondary)',
          backgroundColor: viewMode === VIEW_MODES.SINGLE_ORIGINAL ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
          border: `1px solid ${viewMode === VIEW_MODES.SINGLE_ORIGINAL ? 'var(--accent-primary)' : 'var(--border-color)'}`,
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (viewMode !== VIEW_MODES.SINGLE_ORIGINAL) {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (viewMode !== VIEW_MODES.SINGLE_ORIGINAL) {
            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }
        }}
      >
        {VIEW_MODE_LABELS[VIEW_MODES.SINGLE_ORIGINAL]}
      </button>

      <button
        onClick={() => onChangeViewMode(VIEW_MODES.SINGLE_TRANSFORMED)}
        className="ui-text"
        style={{
          padding: '6px 12px',
          fontSize: '13px',
          fontWeight: viewMode === VIEW_MODES.SINGLE_TRANSFORMED ? 600 : 400,
          color: viewMode === VIEW_MODES.SINGLE_TRANSFORMED ? 'white' : 'var(--text-secondary)',
          backgroundColor: viewMode === VIEW_MODES.SINGLE_TRANSFORMED ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
          border: `1px solid ${viewMode === VIEW_MODES.SINGLE_TRANSFORMED ? 'var(--accent-primary)' : 'var(--border-color)'}`,
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (viewMode !== VIEW_MODES.SINGLE_TRANSFORMED) {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (viewMode !== VIEW_MODES.SINGLE_TRANSFORMED) {
            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }
        }}
      >
        {VIEW_MODE_LABELS[VIEW_MODES.SINGLE_TRANSFORMED]}
      </button>
    </div>
  );
}
