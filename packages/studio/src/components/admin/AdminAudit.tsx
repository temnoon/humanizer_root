/**
 * Admin Audit Log Page
 *
 * System audit log with filtering and search capabilities.
 *
 * @module @humanizer/studio/components/admin/AdminAudit
 */

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  category: 'auth' | 'admin' | 'billing' | 'api' | 'system';
  actor: {
    type: 'user' | 'system' | 'api_key';
    id: string;
    email?: string;
  };
  target?: {
    type: string;
    id: string;
    name?: string;
  };
  metadata: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  success: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_EVENTS: AuditEvent[] = [
  {
    id: 'evt-001',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    action: 'user.login',
    category: 'auth',
    actor: { type: 'user', id: 'user-123', email: 'admin@humanizer.com' },
    metadata: { method: 'oauth', provider: 'google' },
    ip: '192.168.1.1',
    success: true,
  },
  {
    id: 'evt-002',
    timestamp: new Date(Date.now() - 180000).toISOString(),
    action: 'admin.user.role_change',
    category: 'admin',
    actor: { type: 'user', id: 'user-123', email: 'admin@humanizer.com' },
    target: { type: 'user', id: 'user-456', name: 'developer@example.com' },
    metadata: { oldRole: 'free', newRole: 'pro', reason: 'Beta tester promotion' },
    success: true,
  },
  {
    id: 'evt-003',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    action: 'api_key.create',
    category: 'api',
    actor: { type: 'user', id: 'user-456', email: 'developer@example.com' },
    target: { type: 'api_key', id: 'key-789', name: 'Production Key' },
    metadata: { scopes: ['read', 'write', 'transform'] },
    success: true,
  },
  {
    id: 'evt-004',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    action: 'billing.subscription.created',
    category: 'billing',
    actor: { type: 'user', id: 'user-789', email: 'enterprise@corp.com' },
    metadata: { tier: 'premium', stripeSubscriptionId: 'sub_123ABC' },
    success: true,
  },
  {
    id: 'evt-005',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    action: 'user.login_failed',
    category: 'auth',
    actor: { type: 'user', id: 'unknown', email: 'hacker@suspicious.net' },
    metadata: { reason: 'invalid_credentials', attempts: 3 },
    ip: '10.0.0.99',
    success: false,
  },
  {
    id: 'evt-006',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
    action: 'admin.prompt.update',
    category: 'admin',
    actor: { type: 'user', id: 'user-123', email: 'admin@humanizer.com' },
    target: { type: 'prompt', id: 'PERSONA_STYLE_TRANSFER', name: 'Style Transfer' },
    metadata: { version: 2 },
    success: true,
  },
  {
    id: 'evt-007',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    action: 'api.transform',
    category: 'api',
    actor: { type: 'api_key', id: 'key-789' },
    metadata: { model: 'claude-3-sonnet', tokens: 4521, duration_ms: 2341 },
    success: true,
  },
  {
    id: 'evt-008',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    action: 'system.maintenance.started',
    category: 'system',
    actor: { type: 'system', id: 'scheduler' },
    metadata: { task: 'database_vacuum', estimated_duration: '5m' },
    success: true,
  },
  {
    id: 'evt-009',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    action: 'api_key.revoke',
    category: 'api',
    actor: { type: 'user', id: 'user-123', email: 'admin@humanizer.com' },
    target: { type: 'api_key', id: 'key-old', name: 'Compromised Key' },
    metadata: { reason: 'security_incident' },
    success: true,
  },
  {
    id: 'evt-010',
    timestamp: new Date(Date.now() - 10800000).toISOString(),
    action: 'admin.tier.update',
    category: 'admin',
    actor: { type: 'user', id: 'user-123', email: 'admin@humanizer.com' },
    target: { type: 'tier', id: 'pro' },
    metadata: { field: 'tokensPerMonth', oldValue: 500000, newValue: 750000 },
    success: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AdminAudit() {
  // State
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [successFilter, setSuccessFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with real API call when endpoint is implemented
      await new Promise((resolve) => setTimeout(resolve, 300));
      setEvents(MOCK_EVENTS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const categories = ['all', 'auth', 'admin', 'billing', 'api', 'system'];

  const filteredEvents = events.filter((evt) => {
    if (categoryFilter !== 'all' && evt.category !== categoryFilter) return false;
    if (successFilter === 'success' && !evt.success) return false;
    if (successFilter === 'failure' && evt.success) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !evt.action.toLowerCase().includes(searchLower) &&
        !(evt.actor.email?.toLowerCase().includes(searchLower)) &&
        !(evt.target?.name?.toLowerCase().includes(searchLower))
      ) {
        return false;
      }
    }
    return true;
  });

  const selectedEvent = selectedEventId
    ? events.find((e) => e.id === selectedEventId)
    : null;

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString();
  };

  const formatRelativeTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getCategoryBadgeClass = (category: AuditEvent['category']) => {
    switch (category) {
      case 'auth':
        return 'admin-badge--primary';
      case 'admin':
        return 'admin-badge--warning';
      case 'billing':
        return 'admin-badge--success';
      case 'api':
        return 'admin-badge--neutral';
      case 'system':
        return 'admin-badge--info';
      default:
        return 'admin-badge--neutral';
    }
  };

  const getActionDescription = (event: AuditEvent) => {
    const parts = event.action.split('.');
    return parts[parts.length - 1].replace(/_/g, ' ');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="admin-audit">
      {/* Header */}
      <div className="admin-audit__header">
        <h1 className="admin-audit__title">Audit Log</h1>
        <div className="admin-audit__stats">
          <span className="admin-audit__stat">{events.length} events</span>
        </div>
      </div>

      <div className="admin-audit__layout">
        {/* Event List */}
        <div className="admin-audit__list-panel">
          {/* Filters */}
          <div className="admin-audit__filters">
            <input
              type="text"
              className="admin-form__input"
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="admin-audit__filter-row">
              <select
                className="admin-form__select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
              <select
                className="admin-form__select"
                value={successFilter}
                onChange={(e) => setSuccessFilter(e.target.value)}
              >
                <option value="all">All Results</option>
                <option value="success">Success Only</option>
                <option value="failure">Failures Only</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="admin-loading">
              <span className="admin-loading__spinner" />
            </div>
          ) : error ? (
            <div className="admin-alert admin-alert--error">
              <span className="admin-alert__icon">!</span>
              <div className="admin-alert__content">
                <p className="admin-alert__message">{error}</p>
              </div>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="admin-empty">
              <span className="admin-empty__icon">LOG</span>
              <h3 className="admin-empty__title">No Events Found</h3>
              <p className="admin-empty__description">
                No audit events match the selected filters.
              </p>
            </div>
          ) : (
            <div className="admin-audit__list">
              {filteredEvents.map((event) => (
                <button
                  key={event.id}
                  className={`admin-audit__item ${
                    selectedEventId === event.id ? 'admin-audit__item--selected' : ''
                  } ${!event.success ? 'admin-audit__item--failure' : ''}`}
                  onClick={() => setSelectedEventId(event.id)}
                >
                  <div className="admin-audit__item-info">
                    <div className="admin-audit__item-header">
                      <span className="admin-audit__item-action">
                        {getActionDescription(event)}
                      </span>
                      <span className={`admin-badge ${getCategoryBadgeClass(event.category)}`}>
                        {event.category}
                      </span>
                      {!event.success && (
                        <span className="admin-badge admin-badge--error">Failed</span>
                      )}
                    </div>
                    <div className="admin-audit__item-actor">
                      {event.actor.email || event.actor.id}
                      {event.target && (
                        <span className="admin-audit__item-target">
                          {' -> '}{event.target.name || event.target.id}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="admin-audit__item-time">
                    {formatRelativeTime(event.timestamp)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Event Detail */}
        <div className="admin-audit__detail-panel">
          {selectedEvent ? (
            <div className="admin-audit-detail">
              <div className="admin-audit-detail__header">
                <div>
                  <h2 className="admin-audit-detail__title">{selectedEvent.action}</h2>
                  <div className="admin-audit-detail__time">
                    {formatTimestamp(selectedEvent.timestamp)}
                  </div>
                </div>
                <div className="admin-audit-detail__badges">
                  <span className={`admin-badge ${getCategoryBadgeClass(selectedEvent.category)}`}>
                    {selectedEvent.category}
                  </span>
                  <span
                    className={`admin-badge ${
                      selectedEvent.success ? 'admin-badge--success' : 'admin-badge--error'
                    }`}
                  >
                    {selectedEvent.success ? 'Success' : 'Failed'}
                  </span>
                </div>
              </div>

              <div className="admin-audit-detail__content">
                {/* Actor */}
                <div className="admin-audit-detail__section">
                  <h3 className="admin-audit-detail__section-title">Actor</h3>
                  <div className="admin-audit-detail__grid">
                    <div className="admin-audit-detail__field">
                      <span className="admin-audit-detail__label">Type</span>
                      <span className="admin-audit-detail__value">{selectedEvent.actor.type}</span>
                    </div>
                    <div className="admin-audit-detail__field">
                      <span className="admin-audit-detail__label">ID</span>
                      <span className="admin-audit-detail__value admin-audit-detail__value--mono">
                        {selectedEvent.actor.id}
                      </span>
                    </div>
                    {selectedEvent.actor.email && (
                      <div className="admin-audit-detail__field">
                        <span className="admin-audit-detail__label">Email</span>
                        <span className="admin-audit-detail__value">{selectedEvent.actor.email}</span>
                      </div>
                    )}
                    {selectedEvent.ip && (
                      <div className="admin-audit-detail__field">
                        <span className="admin-audit-detail__label">IP Address</span>
                        <span className="admin-audit-detail__value admin-audit-detail__value--mono">
                          {selectedEvent.ip}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Target */}
                {selectedEvent.target && (
                  <div className="admin-audit-detail__section">
                    <h3 className="admin-audit-detail__section-title">Target</h3>
                    <div className="admin-audit-detail__grid">
                      <div className="admin-audit-detail__field">
                        <span className="admin-audit-detail__label">Type</span>
                        <span className="admin-audit-detail__value">{selectedEvent.target.type}</span>
                      </div>
                      <div className="admin-audit-detail__field">
                        <span className="admin-audit-detail__label">ID</span>
                        <span className="admin-audit-detail__value admin-audit-detail__value--mono">
                          {selectedEvent.target.id}
                        </span>
                      </div>
                      {selectedEvent.target.name && (
                        <div className="admin-audit-detail__field">
                          <span className="admin-audit-detail__label">Name</span>
                          <span className="admin-audit-detail__value">{selectedEvent.target.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="admin-audit-detail__section">
                  <h3 className="admin-audit-detail__section-title">Details</h3>
                  <pre className="admin-audit-detail__metadata">
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-empty">
              <span className="admin-empty__icon">LOG</span>
              <h3 className="admin-empty__title">Select an Event</h3>
              <p className="admin-empty__description">
                Choose an audit event from the list to view details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
