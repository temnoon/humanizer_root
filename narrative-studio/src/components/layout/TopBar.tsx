import { useState } from 'react';
import { Icons } from './Icons';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../../contexts/AuthContext';
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
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false);
  };

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

        <h1 className="ui-text text-lg font-semibold hidden sm:block" style={{ color: 'var(--text-primary)' }}>
          Narrative Studio
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

      {/* Right: User menu + Tools button + Theme toggle */}
      <div className="flex items-center gap-3">
        {/* User Menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="ui-text flex items-center gap-2 px-3 py-2 rounded-md transition-smooth hover:opacity-70"
              style={{
                backgroundColor: userMenuOpen ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                color: userMenuOpen ? 'var(--text-inverse)' : 'var(--text-primary)',
              }}
              aria-label="User menu"
            >
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-medium">{user.email}</span>
                <span className="text-xs opacity-75">{user.role}</span>
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 8L2 4h8L6 8z" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                  aria-hidden="true"
                />

                {/* Menu */}
                <div
                  className="absolute right-0 mt-2 w-56 rounded-md shadow-lg z-50"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <p className="ui-text text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {user.email}
                    </p>
                    <p className="ui-text text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      Role: {user.role}
                    </p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={handleLogout}
                      className="ui-text w-full text-left px-3 py-2 rounded-md text-sm transition-smooth"
                      style={{
                        color: 'var(--error)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

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
