import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface VerticalDropdownProps {
  options: string[];
  position: { top: number; left: number };
  onSelect: (option: string) => void;
  onClose: () => void;
  autoHideMs?: number;
}

export function VerticalDropdown({
  options,
  position,
  onSelect,
  onClose,
  autoHideMs = 5000,
}: VerticalDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide after timeout
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      onClose();
    }, autoHideMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [autoHideMs, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSelect = (option: string) => {
    onSelect(option);
    onClose();
  };

  // Render as portal to avoid z-index issues
  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-50"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        minWidth: '120px',
      }}
    >
      {options.map((option, index) => (
        <button
          key={option}
          onClick={() => handleSelect(option)}
          className="w-full text-left px-4 py-2 text-small transition-colors"
          style={{
            color: 'var(--text-primary)',
            backgroundColor: 'transparent',
            borderTop: index === 0 ? 'none' : '1px solid var(--border-color)',
            borderRadius: index === 0
              ? 'var(--radius-md) var(--radius-md) 0 0'
              : index === options.length - 1
              ? '0 0 var(--radius-md) var(--radius-md)'
              : '0',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {option}
        </button>
      ))}
    </div>,
    document.body
  );
}
