import { Icons } from './Icons';
import { ThemeToggle } from './ThemeToggle';
import type { Narrative } from '../../types';

interface TopBarProps {
  currentNarrative: Narrative | null;
  onToggleArchive: () => void;
  onToggleTools: () => void;
  archiveOpen: boolean;
  toolsOpen: boolean;
}

export function TopBar({
  currentNarrative,
  onToggleArchive,
  onToggleTools,
  archiveOpen,
  toolsOpen,
}: TopBarProps) {
  return (
    <header
      className="h-16 px-4 flex items-center justify-between border-b sticky top-0 z-50"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* Left: Archive button + Logo */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleArchive}
          className="ui-text p-2 rounded-md transition-smooth hover:opacity-70"
          style={{
            backgroundColor: archiveOpen ? 'var(--accent-primary)' : 'var(--bg-secondary)',
            color: archiveOpen ? 'var(--text-inverse)' : 'var(--text-primary)',
          }}
          aria-label="Toggle archive panel"
          title="Archive"
        >
          <Icons.Archive />
        </button>

        <h1 className="ui-text text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Humanizer Narrative Studio
        </h1>
      </div>

      {/* Center: Current narrative info */}
      <div className="hidden md:flex flex-col items-center">
        {currentNarrative && (
          <>
            <div className="ui-text font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
              {currentNarrative.title}
            </div>
            <div className="ui-text text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {currentNarrative.metadata.wordCount?.toLocaleString()} words
              {currentNarrative.metadata.source && ` • ${currentNarrative.metadata.source}`}
            </div>
          </>
        )}
      </div>

      {/* Right: Tools button + Theme toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleTools}
          className="ui-text p-2 rounded-md transition-smooth hover:opacity-70"
          style={{
            backgroundColor: toolsOpen ? 'var(--accent-primary)' : 'var(--bg-secondary)',
            color: toolsOpen ? 'var(--text-inverse)' : 'var(--text-primary)',
          }}
          aria-label="Toggle tools panel"
          title="Tools"
        >
          <Icons.Tools />
        </button>

        <ThemeToggle />
      </div>
    </header>
  );
}
