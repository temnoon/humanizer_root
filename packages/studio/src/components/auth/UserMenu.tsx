/**
 * User Menu Component
 *
 * Dropdown menu showing user info and logout option.
 * Displayed in topbar when user is authenticated.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth, type User } from '../../contexts/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface UserMenuProps {
  user: User;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getInitials(email: string): string {
  const [name] = email.split('@');
  if (name.length >= 2) {
    return name.slice(0, 2).toUpperCase();
  }
  return name.toUpperCase();
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    free: 'Free',
    member: 'Member',
    pro: 'Pro',
    premium: 'Premium',
    admin: 'Admin',
  };
  return labels[role] || role;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function UserMenu({ user }: UserMenuProps) {
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const toggleDropdown = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleLogout = useCallback(() => {
    setIsOpen(false);
    logout();
  }, [logout]);

  return (
    <div className="auth-user" ref={menuRef}>
      <button
        type="button"
        className="auth-user__trigger"
        onClick={toggleDropdown}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="auth-user__avatar">{getInitials(user.email)}</span>
        <span className="auth-user__role">{getRoleLabel(user.role)}</span>
      </button>

      {isOpen && (
        <div className="auth-user__dropdown" role="menu">
          <div className="auth-user__dropdown-header">
            <div className="auth-user__dropdown-email">{user.email}</div>
            <div className="auth-user__dropdown-role">{getRoleLabel(user.role)} Account</div>
          </div>
          <div className="auth-user__dropdown-actions">
            <button
              type="button"
              className="auth-user__dropdown-btn auth-user__dropdown-btn--danger"
              onClick={handleLogout}
              role="menuitem"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
