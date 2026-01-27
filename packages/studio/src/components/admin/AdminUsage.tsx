/**
 * Admin Usage Analytics Page
 *
 * System-wide usage analytics with charts, trends, and breakdowns.
 *
 * @module @humanizer/studio/components/admin/AdminUsage
 */

import { useState, useEffect, useCallback } from 'react';
import { useApi, type AdminUsageStats } from '../../contexts/ApiContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface UsageBreakdown {
  name: string;
  requests: number;
  tokens: number;
  cost: number;
}

interface DailyUsage {
  date: string;
  requests: number;
  tokens: number;
  users: number;
}

interface ExtendedUsageStats extends AdminUsageStats {
  byModel: UsageBreakdown[];
  byTier: UsageBreakdown[];
  daily: DailyUsage[];
  topUsers: Array<{
    userId: string;
    email: string;
    requests: number;
    tokens: number;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════

const generateMockData = (): ExtendedUsageStats => {
  const now = new Date();
  const daily: DailyUsage[] = [];

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    daily.push({
      date: date.toISOString().split('T')[0],
      requests: Math.floor(Math.random() * 5000) + 1000,
      tokens: Math.floor(Math.random() * 500000) + 100000,
      users: Math.floor(Math.random() * 50) + 20,
    });
  }

  return {
    totalTokens: 12547890,
    totalRequests: 89234,
    totalCostCents: 4521,
    userCount: 247,
    byModel: [
      { name: 'Claude 3 Sonnet', requests: 45000, tokens: 8500000, cost: 3200 },
      { name: 'Claude 3 Haiku', requests: 32000, tokens: 2500000, cost: 625 },
      { name: 'Llama 3.2 8B', requests: 12234, tokens: 1547890, cost: 0 },
    ],
    byTier: [
      { name: 'Free', requests: 12500, tokens: 1250000, cost: 0 },
      { name: 'Member', requests: 25000, tokens: 3500000, cost: 875 },
      { name: 'Pro', requests: 35000, tokens: 5000000, cost: 2000 },
      { name: 'Premium', requests: 16734, tokens: 2797890, cost: 1646 },
    ],
    daily,
    topUsers: [
      { userId: 'user-001', email: 'power@user.com', requests: 8924, tokens: 1250000 },
      { userId: 'user-002', email: 'enterprise@corp.com', requests: 7512, tokens: 980000 },
      { userId: 'user-003', email: 'developer@startup.io', requests: 5421, tokens: 720000 },
      { userId: 'user-004', email: 'writer@content.co', requests: 4892, tokens: 650000 },
      { userId: 'user-005', email: 'analyst@data.org', requests: 3241, tokens: 480000 },
    ],
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AdminUsage() {
  const api = useApi();

  // State
  const [stats, setStats] = useState<ExtendedUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [viewMode, setViewMode] = useState<'overview' | 'models' | 'tiers' | 'users'>('overview');

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Try real API first
      const result = await api.admin.getUsage();
      // Merge with mock data for extended fields
      const mockData = generateMockData();
      setStats({
        ...mockData,
        ...result,
      });
    } catch (err) {
      // Fall back to mock data if API fails
      console.warn('Usage endpoint not available, using mock data:', err);
      setStats(generateMockData());
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, period]);

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const formatCost = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getBarWidth = (value: number, max: number) => {
    return `${Math.max((value / max) * 100, 2)}%`;
  };

  const getDaysForPeriod = () => {
    switch (period) {
      case '7d':
        return 7;
      case '30d':
        return 30;
      case '90d':
        return 90;
      default:
        return 30;
    }
  };

  const filteredDaily = stats?.daily.slice(-getDaysForPeriod()) || [];
  const maxDailyRequests = Math.max(...filteredDaily.map((d) => d.requests), 1);
  const maxDailyTokens = Math.max(...filteredDaily.map((d) => d.tokens), 1);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="admin-usage">
        <div className="admin-loading">
          <span className="admin-loading__spinner" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="admin-usage">
        <div className="admin-alert admin-alert--error">
          <span className="admin-alert__icon">!</span>
          <div className="admin-alert__content">
            <p className="admin-alert__message">{error || 'Failed to load usage data'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-usage">
      {/* Header */}
      <div className="admin-usage__header">
        <div className="admin-usage__header-left">
          <h1 className="admin-usage__title">Usage Analytics</h1>
          <div className="admin-usage__period-toggle">
            <button
              className={`admin-usage__period-btn ${period === '7d' ? 'admin-usage__period-btn--active' : ''}`}
              onClick={() => setPeriod('7d')}
            >
              7 days
            </button>
            <button
              className={`admin-usage__period-btn ${period === '30d' ? 'admin-usage__period-btn--active' : ''}`}
              onClick={() => setPeriod('30d')}
            >
              30 days
            </button>
            <button
              className={`admin-usage__period-btn ${period === '90d' ? 'admin-usage__period-btn--active' : ''}`}
              onClick={() => setPeriod('90d')}
            >
              90 days
            </button>
          </div>
        </div>
        <div className="admin-usage__view-toggle">
          <button
            className={`admin-usage__view-btn ${viewMode === 'overview' ? 'admin-usage__view-btn--active' : ''}`}
            onClick={() => setViewMode('overview')}
          >
            Overview
          </button>
          <button
            className={`admin-usage__view-btn ${viewMode === 'models' ? 'admin-usage__view-btn--active' : ''}`}
            onClick={() => setViewMode('models')}
          >
            By Model
          </button>
          <button
            className={`admin-usage__view-btn ${viewMode === 'tiers' ? 'admin-usage__view-btn--active' : ''}`}
            onClick={() => setViewMode('tiers')}
          >
            By Tier
          </button>
          <button
            className={`admin-usage__view-btn ${viewMode === 'users' ? 'admin-usage__view-btn--active' : ''}`}
            onClick={() => setViewMode('users')}
          >
            Top Users
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="admin-usage__summary">
        <div className="admin-usage__card">
          <div className="admin-usage__card-label">Total Requests</div>
          <div className="admin-usage__card-value">{formatNumber(stats.totalRequests)}</div>
          <div className="admin-usage__card-trend admin-usage__card-trend--up">+12.3%</div>
        </div>
        <div className="admin-usage__card">
          <div className="admin-usage__card-label">Total Tokens</div>
          <div className="admin-usage__card-value">{formatNumber(stats.totalTokens)}</div>
          <div className="admin-usage__card-trend admin-usage__card-trend--up">+8.7%</div>
        </div>
        <div className="admin-usage__card">
          <div className="admin-usage__card-label">Provider Cost</div>
          <div className="admin-usage__card-value">{formatCost(stats.totalCostCents)}</div>
          <div className="admin-usage__card-trend admin-usage__card-trend--down">-2.1%</div>
        </div>
        <div className="admin-usage__card">
          <div className="admin-usage__card-label">Active Users</div>
          <div className="admin-usage__card-value">{stats.userCount}</div>
          <div className="admin-usage__card-trend admin-usage__card-trend--up">+5.2%</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-usage__content">
        {viewMode === 'overview' && (
          <>
            {/* Daily Trend Chart */}
            <div className="admin-usage__section">
              <h2 className="admin-usage__section-title">Daily Requests</h2>
              <div className="admin-usage__chart">
                <div className="admin-usage__chart-bars">
                  {filteredDaily.map((day) => (
                    <div key={day.date} className="admin-usage__chart-bar-container">
                      <div
                        className="admin-usage__chart-bar"
                        style={{ height: getBarWidth(day.requests, maxDailyRequests) }}
                        title={`${day.date}: ${day.requests.toLocaleString()} requests`}
                      />
                    </div>
                  ))}
                </div>
                <div className="admin-usage__chart-labels">
                  <span>{filteredDaily[0]?.date}</span>
                  <span>{filteredDaily[filteredDaily.length - 1]?.date}</span>
                </div>
              </div>
            </div>

            {/* Token Usage Chart */}
            <div className="admin-usage__section">
              <h2 className="admin-usage__section-title">Daily Tokens</h2>
              <div className="admin-usage__chart">
                <div className="admin-usage__chart-bars admin-usage__chart-bars--tokens">
                  {filteredDaily.map((day) => (
                    <div key={day.date} className="admin-usage__chart-bar-container">
                      <div
                        className="admin-usage__chart-bar admin-usage__chart-bar--tokens"
                        style={{ height: getBarWidth(day.tokens, maxDailyTokens) }}
                        title={`${day.date}: ${day.tokens.toLocaleString()} tokens`}
                      />
                    </div>
                  ))}
                </div>
                <div className="admin-usage__chart-labels">
                  <span>{filteredDaily[0]?.date}</span>
                  <span>{filteredDaily[filteredDaily.length - 1]?.date}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {viewMode === 'models' && (
          <div className="admin-usage__section">
            <h2 className="admin-usage__section-title">Usage by Model</h2>
            <div className="admin-usage__breakdown">
              {stats.byModel.map((item) => {
                const maxRequests = Math.max(...stats.byModel.map((m) => m.requests));
                return (
                  <div key={item.name} className="admin-usage__breakdown-item">
                    <div className="admin-usage__breakdown-header">
                      <span className="admin-usage__breakdown-name">{item.name}</span>
                      <span className="admin-usage__breakdown-value">
                        {formatNumber(item.requests)} requests
                      </span>
                    </div>
                    <div className="admin-usage__breakdown-bar">
                      <div
                        className="admin-usage__breakdown-fill"
                        style={{ width: getBarWidth(item.requests, maxRequests) }}
                      />
                    </div>
                    <div className="admin-usage__breakdown-meta">
                      <span>{formatNumber(item.tokens)} tokens</span>
                      <span>{formatCost(item.cost)} cost</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'tiers' && (
          <div className="admin-usage__section">
            <h2 className="admin-usage__section-title">Usage by Tier</h2>
            <div className="admin-usage__breakdown">
              {stats.byTier.map((item) => {
                const maxRequests = Math.max(...stats.byTier.map((t) => t.requests));
                return (
                  <div key={item.name} className="admin-usage__breakdown-item">
                    <div className="admin-usage__breakdown-header">
                      <span className="admin-usage__breakdown-name">{item.name}</span>
                      <span className="admin-usage__breakdown-value">
                        {formatNumber(item.requests)} requests
                      </span>
                    </div>
                    <div className="admin-usage__breakdown-bar">
                      <div
                        className="admin-usage__breakdown-fill admin-usage__breakdown-fill--tier"
                        style={{ width: getBarWidth(item.requests, maxRequests) }}
                      />
                    </div>
                    <div className="admin-usage__breakdown-meta">
                      <span>{formatNumber(item.tokens)} tokens</span>
                      <span>{formatCost(item.cost)} cost</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'users' && (
          <div className="admin-usage__section">
            <h2 className="admin-usage__section-title">Top Users</h2>
            <div className="admin-usage__table">
              <div className="admin-usage__table-header">
                <span className="admin-usage__table-cell admin-usage__table-cell--user">User</span>
                <span className="admin-usage__table-cell admin-usage__table-cell--num">Requests</span>
                <span className="admin-usage__table-cell admin-usage__table-cell--num">Tokens</span>
              </div>
              {stats.topUsers.map((user, index) => (
                <div key={user.userId} className="admin-usage__table-row">
                  <span className="admin-usage__table-cell admin-usage__table-cell--user">
                    <span className="admin-usage__rank">{index + 1}</span>
                    <span className="admin-usage__user-email">{user.email}</span>
                  </span>
                  <span className="admin-usage__table-cell admin-usage__table-cell--num">
                    {user.requests.toLocaleString()}
                  </span>
                  <span className="admin-usage__table-cell admin-usage__table-cell--num">
                    {formatNumber(user.tokens)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
