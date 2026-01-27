/**
 * Admin Dashboard
 *
 * Main dashboard view with system metrics and quick actions.
 *
 * @module @humanizer/studio/components/admin/AdminDashboard
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../contexts/ApiContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  totalTokens: number;
  totalRequests: number;
  totalCost: number;
  activeApiKeys: number;
}

interface SystemStatus {
  api: 'healthy' | 'degraded' | 'down';
  database: 'healthy' | 'degraded' | 'down';
  providers: {
    name: string;
    status: 'healthy' | 'degraded' | 'down';
  }[];
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  user?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AdminDashboard() {
  const api = useApi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [activity, setActivity] = useState<RecentActivity[]>([]);

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch multiple endpoints in parallel
      const [statusRes, usageRes, apiKeysRes, tiersRes] = await Promise.allSettled([
        api.admin.getStatus(),
        api.admin.getUsage(),
        api.admin.listApiKeys(),
        api.admin.listTiers(),
      ]);

      // Build metrics from responses
      const newMetrics: DashboardMetrics = {
        totalUsers: 0,
        activeUsers: 0,
        totalTokens: 0,
        totalRequests: 0,
        totalCost: 0,
        activeApiKeys: 0,
      };

      if (usageRes.status === 'fulfilled') {
        newMetrics.totalTokens = usageRes.value.totalTokens ?? 0;
        newMetrics.totalRequests = usageRes.value.totalRequests ?? 0;
        newMetrics.totalCost = usageRes.value.totalCostCents ?? 0;
        newMetrics.totalUsers = usageRes.value.userCount ?? 0;
      }

      if (apiKeysRes.status === 'fulfilled') {
        newMetrics.activeApiKeys = apiKeysRes.value.total ?? 0;
      }

      setMetrics(newMetrics);

      // Build system status
      const newStatus: SystemStatus = {
        api: statusRes.status === 'fulfilled' ? 'healthy' : 'down',
        database: statusRes.status === 'fulfilled' ? 'healthy' : 'degraded',
        providers: [
          { name: 'Anthropic', status: 'healthy' },
          { name: 'OpenAI', status: 'healthy' },
          { name: 'Ollama', status: 'healthy' },
        ],
      };

      setStatus(newStatus);

      // Mock recent activity for now
      setActivity([
        {
          id: '1',
          type: 'user',
          description: 'New user registered',
          timestamp: new Date().toISOString(),
        },
        {
          id: '2',
          type: 'api_key',
          description: 'API key created',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '3',
          type: 'config',
          description: 'Model configuration updated',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
        },
      ]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [api.admin]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getStatusClass = (status: string): string => {
    switch (status) {
      case 'healthy': return 'admin-badge--success';
      case 'degraded': return 'admin-badge--warning';
      case 'down': return 'admin-badge--error';
      default: return 'admin-badge--neutral';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="admin-loading">
        <span className="admin-loading__spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-alert admin-alert--error">
        <span className="admin-alert__icon">⚠️</span>
        <div className="admin-alert__content">
          <h4 className="admin-alert__title">Error Loading Dashboard</h4>
          <p className="admin-alert__message">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Metrics Grid */}
      <div className="admin-dashboard__grid">
        <div className="admin-metric">
          <div className="admin-metric__header">
            <span className="admin-metric__label">Total Users</span>
            <span className="admin-metric__icon">👤</span>
          </div>
          <div className="admin-metric__value">
            {formatNumber(metrics?.totalUsers ?? 0)}
          </div>
          <div className="admin-metric__change admin-metric__change--neutral">
            All registered users
          </div>
        </div>

        <div className="admin-metric">
          <div className="admin-metric__header">
            <span className="admin-metric__label">Total Tokens</span>
            <span className="admin-metric__icon">📊</span>
          </div>
          <div className="admin-metric__value">
            {formatNumber(metrics?.totalTokens ?? 0)}
          </div>
          <div className="admin-metric__change admin-metric__change--neutral">
            This billing period
          </div>
        </div>

        <div className="admin-metric">
          <div className="admin-metric__header">
            <span className="admin-metric__label">Requests</span>
            <span className="admin-metric__icon">🔄</span>
          </div>
          <div className="admin-metric__value">
            {formatNumber(metrics?.totalRequests ?? 0)}
          </div>
          <div className="admin-metric__change admin-metric__change--neutral">
            This billing period
          </div>
        </div>

        <div className="admin-metric">
          <div className="admin-metric__header">
            <span className="admin-metric__label">Provider Cost</span>
            <span className="admin-metric__icon">💰</span>
          </div>
          <div className="admin-metric__value">
            {formatCurrency(metrics?.totalCost ?? 0)}
          </div>
          <div className="admin-metric__change admin-metric__change--neutral">
            This billing period
          </div>
        </div>

        <div className="admin-metric">
          <div className="admin-metric__header">
            <span className="admin-metric__label">Active API Keys</span>
            <span className="admin-metric__icon">🔑</span>
          </div>
          <div className="admin-metric__value">
            {metrics?.activeApiKeys ?? 0}
          </div>
          <div className="admin-metric__change admin-metric__change--neutral">
            Across all users
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="admin-dashboard__grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* System Status */}
        <div className="admin-section">
          <div className="admin-section__header">
            <h2 className="admin-section__title">System Status</h2>
            <button
              className="btn btn--ghost btn--sm"
              onClick={fetchDashboardData}
            >
              Refresh
            </button>
          </div>
          <div className="admin-section__content">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>API</td>
                  <td>
                    <span className={`admin-badge ${getStatusClass(status?.api ?? 'down')}`}>
                      {status?.api ?? 'Unknown'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>Database</td>
                  <td>
                    <span className={`admin-badge ${getStatusClass(status?.database ?? 'down')}`}>
                      {status?.database ?? 'Unknown'}
                    </span>
                  </td>
                </tr>
                {status?.providers.map((provider) => (
                  <tr key={provider.name}>
                    <td>{provider.name}</td>
                    <td>
                      <span className={`admin-badge ${getStatusClass(provider.status)}`}>
                        {provider.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="admin-section">
          <div className="admin-section__header">
            <h2 className="admin-section__title">Recent Activity</h2>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => navigate('/admin/audit')}
            >
              View All
            </button>
          </div>
          <div className="admin-section__content">
            {activity.length === 0 ? (
              <div className="admin-table__empty">No recent activity</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td>{formatTimestamp(item.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="admin-section">
        <div className="admin-section__header">
          <h2 className="admin-section__title">Quick Actions</h2>
        </div>
        <div className="admin-section__content">
          <div className="btn-group">
            <button
              className="btn btn--secondary"
              onClick={() => navigate('/admin/users')}
            >
              👤 Manage Users
            </button>
            <button
              className="btn btn--secondary"
              onClick={() => navigate('/admin/models')}
            >
              🤖 Configure Models
            </button>
            <button
              className="btn btn--secondary"
              onClick={() => navigate('/admin/prompts')}
            >
              📝 Edit Prompts
            </button>
            <button
              className="btn btn--secondary"
              onClick={() => navigate('/admin/tiers')}
            >
              📈 Manage Tiers
            </button>
            <button
              className="btn btn--secondary"
              onClick={() => navigate('/admin/analytics/usage')}
            >
              📊 View Analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
