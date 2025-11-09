// Toast - Simple notification component for user feedback
// Auto-dismisses after 3 seconds, mobile-friendly

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'info' | 'error';
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  message,
  type = 'success',
  onClose,
  duration = 3000
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'var(--accent-green)';
      case 'error':
        return 'var(--accent-red)';
      case 'info':
      default:
        return 'var(--accent-purple)';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: getBackgroundColor(),
        color: 'white',
        padding: 'var(--spacing-md) var(--spacing-lg)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        fontSize: 'var(--text-base)',
        fontWeight: 500,
        maxWidth: '90vw',
        animation: 'slideDown 0.3s ease-out'
      }}
      role="alert"
    >
      <span style={{ fontSize: '1.2rem' }}>{getIcon()}</span>
      <span>{message}</span>
    </div>
  );
}

// Add animation CSS to global styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translate(-50%, -20px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }
`;
document.head.appendChild(style);
