import { useTheme } from '../../contexts/ThemeContext';
import { Icons } from './Icons';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="ui-text p-2 rounded-md transition-smooth hover:opacity-70"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
      }}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? <Icons.Moon /> : <Icons.Sun />}
    </button>
  );
}
