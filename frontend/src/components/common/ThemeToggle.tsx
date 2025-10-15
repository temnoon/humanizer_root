import { useEffect, useState } from 'react';
import './ThemeToggle.css';

export type Theme = 'dark' | 'light';

interface ThemeToggleProps {
  className?: string;
}

/**
 * ThemeToggle - Switch between dark and light themes
 * Persists preference to localStorage
 */
export default function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Load from localStorage or default to dark
    const stored = localStorage.getItem('theme');
    return (stored as Theme) || 'dark';
  });

  useEffect(() => {
    // Apply theme to document root
    document.documentElement.setAttribute('data-theme', theme);

    // Save to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      className={`theme-toggle ${className || ''}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`${theme === 'dark' ? 'Light' : 'Dark'} mode`}
    >
      <span className="theme-icon">
        {theme === 'dark' ? '☀️' : '🌙'}
      </span>
      <span className="theme-label">
        {theme === 'dark' ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}
