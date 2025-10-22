import './TopBar.css';
import ThemeToggle from '../common/ThemeToggle';

interface TopBarProps {
  onToggleSidebar: () => void;
  onOpenAUI?: () => void;
  onOpenSettings?: () => void;
}

/**
 * TopBar - Application header with navigation and actions
 */
export default function TopBar({ onToggleSidebar, onOpenAUI, onOpenSettings }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <button
          className="sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        <div className="logo">
          <span className="logo-icon">⚛️</span>
          <span className="logo-text">Humanizer</span>
        </div>
      </div>

      <div className="top-bar-center">
        <div className="search-container">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="search"
            placeholder="Search conversations..."
            className="search-input"
          />
          <kbd className="search-shortcut">⌘K</kbd>
        </div>
      </div>

      <div className="top-bar-right">
        <ThemeToggle className="compact" />

        <button className="icon-button" aria-label="Settings" onClick={onOpenSettings}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </button>

        <button className="aui-button" aria-label="Ask AUI" onClick={onOpenAUI}>
          <span>🤖</span>
          <span className="aui-button-text">Ask AUI</span>
        </button>
      </div>
    </header>
  );
}
