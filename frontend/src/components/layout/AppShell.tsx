import { ReactNode } from 'react';
import './AppShell.css';

interface AppShellProps {
  children: ReactNode;
}

/**
 * AppShell - Main application container
 * Provides the root layout structure for the entire app
 */
export default function AppShell({ children }: AppShellProps) {
  return <div className="app-shell">{children}</div>;
}
