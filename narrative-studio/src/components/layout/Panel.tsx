import type { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
}

export function Panel({ children, className = '' }: PanelProps) {
  return <div className={`panel ${className}`}>{children}</div>;
}

interface PanelHeaderProps {
  children: ReactNode;
  className?: string;
}

export function PanelHeader({ children, className = '' }: PanelHeaderProps) {
  return <div className={`panel-header ${className}`}>{children}</div>;
}

interface PanelContentProps {
  children: ReactNode;
  className?: string;
}

export function PanelContent({ children, className = '' }: PanelContentProps) {
  return <div className={`panel-content ${className}`}>{children}</div>;
}

interface PanelSectionProps {
  children: ReactNode;
  className?: string;
}

export function PanelSection({ children, className = '' }: PanelSectionProps) {
  return <div className={`panel-section ${className}`}>{children}</div>;
}
