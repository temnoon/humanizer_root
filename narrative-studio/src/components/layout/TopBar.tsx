import { useState } from 'react';
import { Icons } from './Icons';
import { ThemeToggle } from './ThemeToggle';
import { TextSizeControl } from './TextSizeControl';
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
  currentNarrative: _currentNarrative,
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
      className="h-16 flex items-center justify-between border-b sticky top-0 z-50"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-color)',
        paddingLeft: 'var(--space-lg)',
        paddingRight: 'var(--space-lg)',
      }}
    >
      {/* Left: Archive button + Logo */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleArchive}
          className="ui-text p-2 rounded-md transition-smooth hover:opacity-70"
          style={{
            backgroundImage: archiveOpen ? 'var(--accent-primary-gradient)' : 'none',
            backgroundColor: archiveOpen ? 'transparent' : 'var(--bg-secondary)',
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

      {/* Center: Empty space for future content (menus, quotes, subtitle, etc.) */}
      <div className="hidden md:block">
        {/* Placeholder for future content */}
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
                backgroundImage: userMenuOpen ? 'var(--accent-primary-gradient)' : 'none',
                backgroundColor: userMenuOpen ? 'transparent' : 'var(--bg-secondary)',
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
                  className="absolute right-0 mt-2 w-56 shadow-lg z-50 overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                  }}
                >
                  <div
                    className="border-b"
                    style={{
                      borderColor: 'var(--border-color)',
                      padding: 'var(--space-md)',
                    }}
                  >
                    <p className="ui-text font-medium" style={{ color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                      {user.email}
                    </p>
                    <p className="ui-text" style={{ color: 'var(--text-tertiary)', fontSize: '0.8125rem', marginTop: 'var(--space-xs)' }}>
                      Role: {user.role}
                    </p>
                  </div>
                  <div style={{ padding: 'var(--space-sm)' }}>
                    <button
                      onClick={handleLogout}
                      className="ui-text w-full text-left rounded-md transition-smooth font-medium"
                      style={{
                        color: 'var(--error)',
                        padding: 'var(--space-sm) var(--space-md)',
                        fontSize: '0.9375rem',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Logout
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
            backgroundImage: toolsOpen ? 'var(--accent-primary-gradient)' : 'none',
            backgroundColor: toolsOpen ? 'transparent' : 'var(--bg-secondary)',
            color: toolsOpen ? 'var(--text-inverse)' : 'var(--text-primary)',
          }}
          aria-label="Toggle tools panel"
          title="Tools"
        >
          <Icons.Tools />
        </button>

        {/* Text size control - only show when authenticated */}
        {user && <TextSizeControl />}

        <ThemeToggle />
      </div>
    </header>
  );
}
