/**
 * Admin Navigation
 *
 * Sidebar navigation for the admin interface.
 * Groups navigation items into logical sections.
 *
 * @module @humanizer/studio/components/admin/AdminNav
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
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/admin', icon: '📊' },
      { label: 'System Status', path: '/admin/status', icon: '🔋' },
    ],
  },
  {
    title: 'Users & Access',
    items: [
      { label: 'Users', path: '/admin/users', icon: '👤' },
      { label: 'API Keys', path: '/admin/api-keys', icon: '🔑' },
      { label: 'Tiers & Quotas', path: '/admin/tiers', icon: '📈' },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { label: 'Models', path: '/admin/models', icon: '🤖' },
      { label: 'Prompts', path: '/admin/prompts', icon: '📝' },
      { label: 'Providers', path: '/admin/providers', icon: '🔌' },
      { label: 'Features', path: '/admin/features', icon: '⚙️' },
    ],
  },
  {
    title: 'Billing',
    items: [
      { label: 'Subscriptions', path: '/admin/subscriptions', icon: '💳' },
      { label: 'Cost Tracking', path: '/admin/costs', icon: '💰' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'Usage', path: '/admin/analytics/usage', icon: '📉' },
      { label: 'Audit Log', path: '/admin/audit', icon: '📋' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AdminNav() {
  const { user } = useAuth();
  const location = useLocation();

  // Get initials for avatar
  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'AD';

  return (
    <nav className="admin-nav">
      {/* Header with Logo */}
      <div className="admin-nav__header">
        <NavLink to="/" className="admin-nav__logo">
          <span className="admin-nav__logo-text">humanizer</span>
          <span className="admin-nav__logo-badge">Admin</span>
        </NavLink>
      </div>

      {/* Navigation Sections */}
      <div className="admin-nav__sections">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="admin-nav__section">
            <h3 className="admin-nav__section-title">{section.title}</h3>
            <ul className="admin-nav__items">
              {section.items.map((item) => {
                // Check if this is the active route
                // For the dashboard, match exactly; for others, check if path starts with item.path
                const isActive = item.path === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname.startsWith(item.path);

                return (
                  <li key={item.path} className="admin-nav__item">
                    <NavLink
                      to={item.path}
                      className={`admin-nav__link ${isActive ? 'admin-nav__link--active' : ''}`}
                    >
                      <span className="admin-nav__icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer with User Info */}
      <div className="admin-nav__footer">
        <div className="admin-nav__user">
          <div className="admin-nav__user-avatar">{initials}</div>
          <div className="admin-nav__user-info">
            <div className="admin-nav__user-name">{user?.email ?? 'Admin'}</div>
            <div className="admin-nav__user-role">{user?.role ?? 'admin'}</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
