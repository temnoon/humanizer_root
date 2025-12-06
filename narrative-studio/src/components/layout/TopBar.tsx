import { useState } from 'react';
import { Icons } from './Icons';
import { ThemeToggle } from './ThemeToggle';
import { TextSizeControl } from './TextSizeControl';
import { ProviderSwitcher } from './ProviderSwitcher';
import { BookSelector } from './BookSelector';
import { useAuth } from '../../contexts/AuthContext';
import type { Narrative, WorkspaceMode } from '../../types';

interface TopBarProps {
  currentNarrative: Narrative | null;
  onToggleArchive: () => void;
  onToggleTools: () => void;
  onToggleView: () => void;
  onOpenSettings: () => void;
  archiveOpen: boolean;
  toolsOpen: boolean;
  viewPreference: 'split' | 'tabs';
  workspaceMode: WorkspaceMode;
  useStudioTools?: boolean;
  onToggleStudioTools?: () => void;
}

export function TopBar({
  currentNarrative: _currentNarrative,
  onToggleArchive,
  onToggleTools,
  onToggleView,
  onOpenSettings,
  archiveOpen,
  toolsOpen,
  viewPreference,
  workspaceMode,
  useStudioTools,
  onToggleStudioTools,
}: TopBarProps) {
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false);
  };

  return (
    <header
      className="h-16 flex items-center justify-between sticky top-0 z-[60]"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-color)',
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

      {/* Center: Active Book Selector */}
      <div className="hidden md:block">
        <BookSelector />
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
                    style={{
                      borderBottom: '1px solid var(--border-color)',
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

        {/* Provider switcher - only show when authenticated */}
        {user && <ProviderSwitcher />}

        {/* View toggle button - Only show in split mode */}
        {workspaceMode === 'split' && (
          <button
            onClick={onToggleView}
            className="ui-text p-2 rounded-md transition-smooth hover:opacity-70"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
            aria-label="Toggle split/tabs view"
            title={viewPreference === 'split' ? 'Switch to tabs' : 'Switch to split view'}
          >
            {viewPreference === 'split' ? <Icons.Tabs /> : <Icons.Split />}
          </button>
        )}

        {/* Studio Tools Mode Toggle */}
        {onToggleStudioTools && (
          <button
            onClick={onToggleStudioTools}
            className="ui-text px-2 py-1 rounded-md transition-smooth hover:opacity-70 text-xs font-medium"
            style={{
              backgroundImage: useStudioTools ? 'var(--accent-primary-gradient)' : 'none',
              backgroundColor: useStudioTools ? 'transparent' : 'var(--bg-secondary)',
              color: useStudioTools ? 'var(--text-inverse)' : 'var(--text-tertiary)',
            }}
            aria-label="Toggle studio tools mode"
            title={useStudioTools ? 'Using Studio Tools (click for Classic)' : 'Using Classic Tools (click for Studio)'}
          >
            {useStudioTools ? 'Studio' : 'Classic'}
          </button>
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

        {/* Settings button - only show when authenticated */}
        {user && (
          <button
            onClick={onOpenSettings}
            className="ui-text p-2 rounded-md transition-smooth hover:opacity-70"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
            aria-label="Open settings"
            title="Settings"
          >
            <Icons.Settings />
          </button>
        )}

        <ThemeToggle />
      </div>
    </header>
  );
}
