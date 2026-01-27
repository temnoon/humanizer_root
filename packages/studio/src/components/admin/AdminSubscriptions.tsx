/**
 * Admin Subscriptions Page
 *
 * Subscription management with Stripe integration overview.
 *
 * @module @humanizer/studio/components/admin/AdminSubscriptions
 */

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface Subscription {
  id: string;
  userId: string;
  userEmail: string;
  tier: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string;
  monthlyAmount: number;
  createdAt: string;
}

interface SubscriptionStats {
  totalActive: number;
  totalMrr: number;
  churnRate: number;
  newThisMonth: number;
  canceledThisMonth: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 'sub-001',
    userId: 'user-123',
    userEmail: 'power@user.com',
    tier: 'pro',
    status: 'active',
    currentPeriodStart: '2024-12-01T00:00:00Z',
    currentPeriodEnd: '2025-01-01T00:00:00Z',
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: 'sub_1ABC123',
    monthlyAmount: 2900,
    createdAt: '2024-06-15T00:00:00Z',
  },
  {
    id: 'sub-002',
    userId: 'user-456',
    userEmail: 'enterprise@corp.com',
    tier: 'premium',
    status: 'active',
    currentPeriodStart: '2024-12-15T00:00:00Z',
    currentPeriodEnd: '2025-01-15T00:00:00Z',
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: 'sub_2DEF456',
    monthlyAmount: 9900,
    createdAt: '2024-03-01T00:00:00Z',
  },
  {
    id: 'sub-003',
    userId: 'user-789',
    userEmail: 'developer@startup.io',
    tier: 'member',
    status: 'active',
    currentPeriodStart: '2024-12-20T00:00:00Z',
    currentPeriodEnd: '2025-01-20T00:00:00Z',
    cancelAtPeriodEnd: true,
    stripeSubscriptionId: 'sub_3GHI789',
    monthlyAmount: 900,
    createdAt: '2024-09-20T00:00:00Z',
  },
  {
    id: 'sub-004',
    userId: 'user-101',
    userEmail: 'writer@content.co',
    tier: 'pro',
    status: 'past_due',
    currentPeriodStart: '2024-11-15T00:00:00Z',
    currentPeriodEnd: '2024-12-15T00:00:00Z',
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: 'sub_4JKL101',
    monthlyAmount: 2900,
    createdAt: '2024-08-15T00:00:00Z',
  },
  {
    id: 'sub-005',
    userId: 'user-102',
    userEmail: 'analyst@data.org',
    tier: 'member',
    status: 'canceled',
    currentPeriodStart: '2024-11-01T00:00:00Z',
    currentPeriodEnd: '2024-12-01T00:00:00Z',
    cancelAtPeriodEnd: true,
    stripeSubscriptionId: 'sub_5MNO102',
    monthlyAmount: 900,
    createdAt: '2024-04-01T00:00:00Z',
  },
  {
    id: 'sub-006',
    userId: 'user-103',
    userEmail: 'new@trial.com',
    tier: 'pro',
    status: 'trialing',
    currentPeriodStart: '2024-12-20T00:00:00Z',
    currentPeriodEnd: '2025-01-03T00:00:00Z',
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: 'sub_6PQR103',
    monthlyAmount: 2900,
    createdAt: '2024-12-20T00:00:00Z',
  },
];

const MOCK_STATS: SubscriptionStats = {
  totalActive: 4,
  totalMrr: 16600,
  churnRate: 2.4,
  newThisMonth: 3,
  canceledThisMonth: 1,
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AdminSubscriptions() {
  // State
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with real API call when endpoint is implemented
      await new Promise((resolve) => setTimeout(resolve, 300));
      setSubscriptions(MOCK_SUBSCRIPTIONS);
      setStats(MOCK_STATS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const statuses = ['all', 'active', 'trialing', 'past_due', 'canceled'];
  const tiers = ['all', ...new Set(subscriptions.map((s) => s.tier))];

  const filteredSubscriptions = subscriptions.filter((sub) => {
    if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
    if (tierFilter !== 'all' && sub.tier !== tierFilter) return false;
    return true;
  });

  const selectedSub = selectedSubId
    ? subscriptions.find((s) => s.id === selectedSubId)
    : null;

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const getStatusBadgeClass = (status: Subscription['status']) => {
    switch (status) {
      case 'active':
        return 'admin-badge--success';
      case 'trialing':
        return 'admin-badge--primary';
      case 'past_due':
        return 'admin-badge--warning';
      case 'canceled':
        return 'admin-badge--neutral';
      default:
        return 'admin-badge--neutral';
    }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="admin-subscriptions">
        <div className="admin-loading">
          <span className="admin-loading__spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-subscriptions">
        <div className="admin-alert admin-alert--error">
          <span className="admin-alert__icon">!</span>
          <div className="admin-alert__content">
            <p className="admin-alert__message">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-subscriptions">
      {/* Header */}
      <div className="admin-subscriptions__header">
        <h1 className="admin-subscriptions__title">Subscriptions</h1>
      </div>

      {/* Stats */}
      {stats && (
        <div className="admin-subscriptions__stats">
          <div className="admin-subscriptions__stat-card">
            <div className="admin-subscriptions__stat-label">Active Subscriptions</div>
            <div className="admin-subscriptions__stat-value">{stats.totalActive}</div>
          </div>
          <div className="admin-subscriptions__stat-card">
            <div className="admin-subscriptions__stat-label">Monthly Recurring Revenue</div>
            <div className="admin-subscriptions__stat-value">{formatCurrency(stats.totalMrr)}</div>
          </div>
          <div className="admin-subscriptions__stat-card">
            <div className="admin-subscriptions__stat-label">Churn Rate</div>
            <div className="admin-subscriptions__stat-value">{stats.churnRate}%</div>
          </div>
          <div className="admin-subscriptions__stat-card">
            <div className="admin-subscriptions__stat-label">New This Month</div>
            <div className="admin-subscriptions__stat-value admin-subscriptions__stat-value--success">
              +{stats.newThisMonth}
            </div>
          </div>
        </div>
      )}

      <div className="admin-subscriptions__layout">
        {/* Subscription List */}
        <div className="admin-subscriptions__list-panel">
          {/* Filters */}
          <div className="admin-subscriptions__filters">
            <select
              className="admin-form__select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All Status' : status.replace('_', ' ')}
                </option>
              ))}
            </select>
            <select
              className="admin-form__select"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
            >
              {tiers.map((tier) => (
                <option key={tier} value={tier}>
                  {tier === 'all' ? 'All Tiers' : tier}
                </option>
              ))}
            </select>
          </div>

          {filteredSubscriptions.length === 0 ? (
            <div className="admin-empty">
              <span className="admin-empty__icon">$</span>
              <h3 className="admin-empty__title">No Subscriptions Found</h3>
              <p className="admin-empty__description">
                No subscriptions match the selected filters.
              </p>
            </div>
          ) : (
            <div className="admin-subscriptions__list">
              {filteredSubscriptions.map((sub) => (
                <button
                  key={sub.id}
                  className={`admin-subscriptions__item ${
                    selectedSubId === sub.id ? 'admin-subscriptions__item--selected' : ''
                  }`}
                  onClick={() => setSelectedSubId(sub.id)}
                >
                  <div className="admin-subscriptions__item-info">
                    <div className="admin-subscriptions__item-header">
                      <span className="admin-subscriptions__item-email">{sub.userEmail}</span>
                      <span className={`admin-badge ${getStatusBadgeClass(sub.status)}`}>
                        {sub.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="admin-subscriptions__item-meta">
                      <span className="admin-subscriptions__item-tier">{sub.tier}</span>
                      <span className="admin-subscriptions__item-amount">
                        {formatCurrency(sub.monthlyAmount)}/mo
                      </span>
                    </div>
                    {sub.cancelAtPeriodEnd && (
                      <div className="admin-subscriptions__item-warning">
                        Cancels {formatDate(sub.currentPeriodEnd)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="admin-subscriptions__detail-panel">
          {selectedSub ? (
            <div className="admin-subscription-detail">
              <div className="admin-subscription-detail__header">
                <div>
                  <h2 className="admin-subscription-detail__title">{selectedSub.userEmail}</h2>
                  <div className="admin-subscription-detail__tier">{selectedSub.tier} plan</div>
                </div>
                <div className={`admin-badge ${getStatusBadgeClass(selectedSub.status)}`}>
                  {selectedSub.status.replace('_', ' ')}
                </div>
              </div>

              <div className="admin-subscription-detail__content">
                {/* Billing */}
                <div className="admin-subscription-detail__section">
                  <h3 className="admin-subscription-detail__section-title">Billing</h3>
                  <div className="admin-subscription-detail__grid">
                    <div className="admin-subscription-detail__field">
                      <span className="admin-subscription-detail__label">Amount</span>
                      <span className="admin-subscription-detail__value">
                        {formatCurrency(selectedSub.monthlyAmount)}/month
                      </span>
                    </div>
                    <div className="admin-subscription-detail__field">
                      <span className="admin-subscription-detail__label">Next Billing</span>
                      <span className="admin-subscription-detail__value">
                        {formatDate(selectedSub.currentPeriodEnd)}
                        <span className="admin-subscription-detail__days">
                          ({getDaysRemaining(selectedSub.currentPeriodEnd)} days)
                        </span>
                      </span>
                    </div>
                    <div className="admin-subscription-detail__field">
                      <span className="admin-subscription-detail__label">Current Period</span>
                      <span className="admin-subscription-detail__value">
                        {formatDate(selectedSub.currentPeriodStart)} - {formatDate(selectedSub.currentPeriodEnd)}
                      </span>
                    </div>
                    <div className="admin-subscription-detail__field">
                      <span className="admin-subscription-detail__label">Subscribed Since</span>
                      <span className="admin-subscription-detail__value">
                        {formatDate(selectedSub.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stripe */}
                <div className="admin-subscription-detail__section">
                  <h3 className="admin-subscription-detail__section-title">Stripe</h3>
                  <div className="admin-subscription-detail__grid">
                    <div className="admin-subscription-detail__field">
                      <span className="admin-subscription-detail__label">Subscription ID</span>
                      <span className="admin-subscription-detail__value admin-subscription-detail__value--mono">
                        {selectedSub.stripeSubscriptionId}
                      </span>
                    </div>
                    <div className="admin-subscription-detail__field">
                      <span className="admin-subscription-detail__label">User ID</span>
                      <span className="admin-subscription-detail__value admin-subscription-detail__value--mono">
                        {selectedSub.userId}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Alerts */}
                {selectedSub.cancelAtPeriodEnd && (
                  <div className="admin-alert admin-alert--warning">
                    <span className="admin-alert__icon">!</span>
                    <div className="admin-alert__content">
                      <h4 className="admin-alert__title">Scheduled for Cancellation</h4>
                      <p className="admin-alert__message">
                        This subscription will be canceled on {formatDate(selectedSub.currentPeriodEnd)}.
                      </p>
                    </div>
                  </div>
                )}

                {selectedSub.status === 'past_due' && (
                  <div className="admin-alert admin-alert--error">
                    <span className="admin-alert__icon">!</span>
                    <div className="admin-alert__content">
                      <h4 className="admin-alert__title">Payment Past Due</h4>
                      <p className="admin-alert__message">
                        The most recent payment attempt failed. Stripe will retry automatically.
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="admin-subscription-detail__section">
                  <h3 className="admin-subscription-detail__section-title">Actions</h3>
                  <div className="admin-subscription-detail__actions">
                    <a
                      href={`https://dashboard.stripe.com/subscriptions/${selectedSub.stripeSubscriptionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn--secondary btn--sm"
                    >
                      View in Stripe
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-empty">
              <span className="admin-empty__icon">$</span>
              <h3 className="admin-empty__title">Select a Subscription</h3>
              <p className="admin-empty__description">
                Choose a subscription from the list to view details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
