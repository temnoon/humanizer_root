import { useState, useEffect } from 'react';

interface AdminMetrics {
  overview: {
    total_users: number;
    active_users_24h: number;
    active_users_7d: number;
    active_users_30d: number;
    total_transformations: number;
    transformations_24h: number;
    transformations_7d: number;
    mailing_list_signups: number;
  };
  users_by_tier: Record<string, number>;
  transformations_by_type: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  daily_activity: Array<{
    date: string;
    users: number;
    transformations: number;
  }>;
  popular_features: Array<{
    feature: string;
    users: number;
  }>;
  quota_usage: {
    users_near_limit: number;
    avg_usage_percentage: number;
  };
}

interface SiteMetricsProps {
  token: string;
}

export default function SiteMetrics({ token }: SiteMetricsProps) {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const loadMetrics = async () => {
    try {
      const response = await fetch('https://npe-api.tem-527.workers.dev/admin/metrics', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load metrics');
      }

      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err: any) {
      console.error('Error loading metrics:', err);
      setError(err.message || 'Failed to load metrics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)', color: 'var(--text-secondary)' }}>
        Loading metrics...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: 'var(--spacing-xl)',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--accent-red)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--accent-red)'
      }}>
        <strong>Error:</strong> {error}
        <button
          onClick={loadMetrics}
          style={{
            marginLeft: 'var(--spacing-md)',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            background: 'var(--accent-purple)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const { overview, users_by_tier, transformations_by_type, daily_activity, popular_features, quota_usage } = metrics;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
      {/* Header with refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Site Metrics</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Auto-refreshes every 30s
          </span>
          <button
            onClick={loadMetrics}
            className="btn"
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              fontSize: '0.875rem'
            }}
          >
            🔄 Refresh Now
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--spacing-md)'
      }}>
        <MetricCard
          label="Total Users"
          value={overview.total_users}
          icon="👥"
          color="var(--accent-purple)"
        />
        <MetricCard
          label="Active (24h)"
          value={overview.active_users_24h}
          icon="⚡"
          color="var(--accent-blue)"
        />
        <MetricCard
          label="Active (7d)"
          value={overview.active_users_7d}
          icon="📅"
          color="var(--accent-green)"
        />
        <MetricCard
          label="Active (30d)"
          value={overview.active_users_30d}
          icon="📊"
          color="var(--accent-gold)"
        />
        <MetricCard
          label="Total Transforms"
          value={overview.total_transformations}
          icon="✨"
          color="var(--accent-purple)"
        />
        <MetricCard
          label="Transforms (24h)"
          value={overview.transformations_24h}
          icon="🔥"
          color="var(--accent-red)"
        />
        <MetricCard
          label="Transforms (7d)"
          value={overview.transformations_7d}
          icon="📈"
          color="var(--accent-green)"
        />
        <MetricCard
          label="Mailing List"
          value={overview.mailing_list_signups}
          icon="📧"
          color="var(--accent-gold)"
        />
      </div>

      {/* Users by Tier */}
      <div style={{
        background: 'var(--bg-secondary)',
        padding: 'var(--spacing-xl)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)'
      }}>
        <h3 style={{ marginTop: 0 }}>Users by Tier</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 'var(--spacing-md)'
        }}>
          {Object.entries(users_by_tier).map(([tier, count]) => (
            <div
              key={tier}
              style={{
                textAlign: 'center',
                padding: 'var(--spacing-md)',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)'
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: getTierColor(tier) }}>
                {count}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 'var(--spacing-xs)' }}>
                {tier}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transformations by Type */}
      <div style={{
        background: 'var(--bg-secondary)',
        padding: 'var(--spacing-xl)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)'
      }}>
        <h3 style={{ marginTop: 0 }}>Transformations by Type</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {transformations_by_type.map((item) => (
            <div key={item.type}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 'var(--spacing-xs)'
              }}>
                <span style={{ fontWeight: 500 }}>{item.type}</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {item.count} ({item.percentage}%)
                </span>
              </div>
              <div style={{
                height: '8px',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${item.percentage}%`,
                  height: '100%',
                  background: 'var(--accent-purple)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Activity */}
      <div style={{
        background: 'var(--bg-secondary)',
        padding: 'var(--spacing-xl)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)'
      }}>
        <h3 style={{ marginTop: 0 }}>Daily Activity (Last 14 Days)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.875rem'
          }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: 'var(--spacing-sm)' }}>Date</th>
                <th style={{ textAlign: 'right', padding: 'var(--spacing-sm)' }}>Users</th>
                <th style={{ textAlign: 'right', padding: 'var(--spacing-sm)' }}>Transformations</th>
              </tr>
            </thead>
            <tbody>
              {daily_activity.map((day: any) => (
                <tr key={day.date} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: 'var(--spacing-sm)' }}>{day.date}</td>
                  <td style={{ textAlign: 'right', padding: 'var(--spacing-sm)' }}>{day.users}</td>
                  <td style={{ textAlign: 'right', padding: 'var(--spacing-sm)' }}>{day.transformations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Popular Features */}
      <div style={{
        background: 'var(--bg-secondary)',
        padding: 'var(--spacing-xl)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)'
      }}>
        <h3 style={{ marginTop: 0 }}>Popular Features (by User Count)</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 'var(--spacing-md)'
        }}>
          {popular_features.map((feature: any) => (
            <div
              key={feature.feature}
              style={{
                textAlign: 'center',
                padding: 'var(--spacing-md)',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)'
              }}
            >
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-purple)' }}>
                {feature.users}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 'var(--spacing-xs)' }}>
                {feature.feature}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quota Usage */}
      <div style={{
        background: quota_usage.users_near_limit > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary)',
        padding: 'var(--spacing-xl)',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${quota_usage.users_near_limit > 0 ? 'var(--accent-red)' : 'var(--border-color)'}`
      }}>
        <h3 style={{ marginTop: 0 }}>Quota Usage</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--spacing-md)'
        }}>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: quota_usage.users_near_limit > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
              {quota_usage.users_near_limit}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 'var(--spacing-xs)' }}>
              Users near limit (&gt;80%)
            </div>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
              {quota_usage.avg_usage_percentage}%
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 'var(--spacing-xs)' }}>
              Average quota usage
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      padding: 'var(--spacing-lg)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--spacing-sm)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        <span style={{ fontSize: '1.5rem' }}>{icon}</span>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color }}>{value.toLocaleString()}</div>
    </div>
  );
}

function getTierColor(tier: string): string {
  switch (tier) {
    case 'ADMIN': return 'var(--accent-red)';
    case 'PREMIUM': return 'var(--accent-gold)';
    case 'PRO': return 'var(--accent-purple)';
    case 'MEMBER': return 'var(--accent-blue)';
    case 'FREE': return 'var(--text-secondary)';
    default: return 'var(--text-secondary)';
  }
}
