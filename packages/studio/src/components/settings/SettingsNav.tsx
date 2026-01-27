/**
 * Settings Navigation
 *
 * Sidebar navigation for the user settings interface.
 *
 * @module @humanizer/studio/components/settings/SettingsNav
 */

import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface NavItem {
  label: string;
  path: string;
  icon: string;
  requiresTier?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Account',
    items: [
      { label: 'Profile', path: '/settings', icon: '👤' },
      { label: 'API Keys', path: '/settings/api-keys', icon: '🔑' },
    ],
  },
  {
    title: 'Usage',
    items: [
      { label: 'Dashboard', path: '/settings/usage', icon: '📊' },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { label: 'General', path: '/settings/preferences', icon: '⚙️' },
      { label: 'Custom Prompts', path: '/settings/prompts', icon: '📝', requiresTier: 'pro' },
    ],
  },
];

// Tier hierarchy for checking access
const TIER_ORDER: Record<string, number> = {
  free: 0,
  member: 1,
  pro: 2,
  premium: 3,
  admin: 4,
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function SettingsNav() {
  const { user } = useAuth();
  const location = useLocation();
  const userTier = user?.role ?? 'free';
  const userTierLevel = TIER_ORDER[userTier] ?? 0;

  // Get initials for avatar
  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'U';

  // Check if user has access to a tier-gated item
  const hasAccess = (requiresTier?: string) => {
    if (!requiresTier) return true;
    const requiredLevel = TIER_ORDER[requiresTier] ?? 0;
    return userTierLevel >= requiredLevel;
  };

  return (
    <nav className="settings-nav">
      {/* Header with Logo */}
      <div className="settings-nav__header">
        <NavLink to="/" className="settings-nav__logo">
          <span className="settings-nav__logo-text">humanizer</span>
          <span className="settings-nav__logo-badge">Settings</span>
        </NavLink>
      </div>

      {/* Navigation Sections */}
      <div className="settings-nav__sections">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="settings-nav__section">
            <h3 className="settings-nav__section-title">{section.title}</h3>
            <ul className="settings-nav__items">
              {section.items.map((item) => {
                // Check if this is the active route
                const isActive = item.path === '/settings'
                  ? location.pathname === '/settings'
                  : location.pathname.startsWith(item.path);

                const accessible = hasAccess(item.requiresTier);

                return (
                  <li key={item.path} className="settings-nav__item">
                    {accessible ? (
                      <NavLink
                        to={item.path}
                        className={`settings-nav__link ${isActive ? 'settings-nav__link--active' : ''}`}
                      >
                        <span className="settings-nav__icon">{item.icon}</span>
                        <span>{item.label}</span>
                      </NavLink>
                    ) : (
                      <span className="settings-nav__link settings-nav__link--locked">
                        <span className="settings-nav__icon">{item.icon}</span>
                        <span>{item.label}</span>
                        <span className="settings-nav__badge">PRO</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer with User Info */}
      <div className="settings-nav__footer">
        <div className="settings-nav__user">
          <div className="settings-nav__user-avatar">{initials}</div>
          <div className="settings-nav__user-info">
            <div className="settings-nav__user-name">{user?.email ?? 'User'}</div>
            <div className="settings-nav__user-role">{userTier}</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
