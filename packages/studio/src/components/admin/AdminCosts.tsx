/**
 * Admin Cost Tracking Page
 *
 * Provider cost tracking with margin analysis and breakdowns.
 *
 * @module @humanizer/studio/components/admin/AdminCosts
 */

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface CostEntry {
  date: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  providerCostCents: number;
  userChargedCents: number;
  marginCents: number;
}

interface CostSummary {
  totalProviderCost: number;
  totalUserCharged: number;
  totalMargin: number;
  marginPercentage: number;
}

interface ProviderBreakdown {
  provider: string;
  cost: number;
  charged: number;
  margin: number;
  requests: number;
}

interface DailyCost {
  date: string;
  providerCost: number;
  userCharged: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════

const generateMockData = () => {
  const now = new Date();
  const daily: DailyCost[] = [];

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const providerCost = Math.floor(Math.random() * 2000) + 500;
    const margin = Math.floor(providerCost * (0.2 + Math.random() * 0.3));
    daily.push({
      date: date.toISOString().split('T')[0],
      providerCost,
      userCharged: providerCost + margin,
    });
  }

  const summary: CostSummary = {
    totalProviderCost: daily.reduce((sum, d) => sum + d.providerCost, 0),
    totalUserCharged: daily.reduce((sum, d) => sum + d.userCharged, 0),
    totalMargin: daily.reduce((sum, d) => sum + (d.userCharged - d.providerCost), 0),
    marginPercentage: 0,
  };
  summary.marginPercentage = (summary.totalMargin / summary.totalProviderCost) * 100;

  const providers: ProviderBreakdown[] = [
    { provider: 'Anthropic', cost: 2845, charged: 3840, margin: 995, requests: 45000 },
    { provider: 'OpenAI', cost: 892, charged: 1250, margin: 358, requests: 12000 },
    { provider: 'Ollama', cost: 0, charged: 500, margin: 500, requests: 32234 },
  ];

  const recentEntries: CostEntry[] = [
    {
      date: new Date().toISOString(),
      provider: 'Anthropic',
      model: 'claude-3-sonnet',
      inputTokens: 125000,
      outputTokens: 45000,
      providerCostCents: 525,
      userChargedCents: 680,
      marginCents: 155,
    },
    {
      date: new Date(Date.now() - 3600000).toISOString(),
      provider: 'Anthropic',
      model: 'claude-3-haiku',
      inputTokens: 89000,
      outputTokens: 32000,
      providerCostCents: 62,
      userChargedCents: 95,
      marginCents: 33,
    },
    {
      date: new Date(Date.now() - 7200000).toISOString(),
      provider: 'OpenAI',
      model: 'gpt-4-turbo',
      inputTokens: 45000,
      outputTokens: 12000,
      providerCostCents: 810,
      userChargedCents: 1100,
      marginCents: 290,
    },
    {
      date: new Date(Date.now() - 10800000).toISOString(),
      provider: 'Ollama',
      model: 'llama3.2:8b',
      inputTokens: 230000,
      outputTokens: 78000,
      providerCostCents: 0,
      userChargedCents: 150,
      marginCents: 150,
    },
  ];

  return { summary, providers, daily, recentEntries };
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AdminCosts() {
  // State
  const [data, setData] = useState<ReturnType<typeof generateMockData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with real API call when endpoint is implemented
      await new Promise((resolve) => setTimeout(resolve, 300));
      setData(generateMockData());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cost data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, period]);

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const formatCost = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
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

  const filteredDaily = data?.daily.slice(-getDaysForPeriod()) || [];
  const maxDailyCost = Math.max(...filteredDaily.map((d) => d.userCharged), 1);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="admin-costs">
        <div className="admin-loading">
          <span className="admin-loading__spinner" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-costs">
        <div className="admin-alert admin-alert--error">
          <span className="admin-alert__icon">!</span>
          <div className="admin-alert__content">
            <p className="admin-alert__message">{error || 'Failed to load cost data'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-costs">
      {/* Header */}
      <div className="admin-costs__header">
        <div className="admin-costs__header-left">
          <h1 className="admin-costs__title">Cost Tracking</h1>
          <div className="admin-costs__period-toggle">
            <button
              className={`admin-costs__period-btn ${period === '7d' ? 'admin-costs__period-btn--active' : ''}`}
              onClick={() => setPeriod('7d')}
            >
              7 days
            </button>
            <button
              className={`admin-costs__period-btn ${period === '30d' ? 'admin-costs__period-btn--active' : ''}`}
              onClick={() => setPeriod('30d')}
            >
              30 days
            </button>
            <button
              className={`admin-costs__period-btn ${period === '90d' ? 'admin-costs__period-btn--active' : ''}`}
              onClick={() => setPeriod('90d')}
            >
              90 days
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="admin-costs__summary">
        <div className="admin-costs__card">
          <div className="admin-costs__card-label">Provider Cost</div>
          <div className="admin-costs__card-value">{formatCost(data.summary.totalProviderCost)}</div>
          <div className="admin-costs__card-sub">Our expense to providers</div>
        </div>
        <div className="admin-costs__card">
          <div className="admin-costs__card-label">User Charged</div>
          <div className="admin-costs__card-value">{formatCost(data.summary.totalUserCharged)}</div>
          <div className="admin-costs__card-sub">Revenue from users</div>
        </div>
        <div className="admin-costs__card admin-costs__card--highlight">
          <div className="admin-costs__card-label">Gross Margin</div>
          <div className="admin-costs__card-value">{formatCost(data.summary.totalMargin)}</div>
          <div className="admin-costs__card-sub admin-costs__card-sub--success">
            {data.summary.marginPercentage.toFixed(1)}% margin
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="admin-costs__content">
        {/* Daily Cost Chart */}
        <div className="admin-costs__section">
          <h2 className="admin-costs__section-title">Daily Revenue vs Cost</h2>
          <div className="admin-costs__chart">
            <div className="admin-costs__chart-bars">
              {filteredDaily.map((day) => (
                <div key={day.date} className="admin-costs__chart-bar-group">
                  <div
                    className="admin-costs__chart-bar admin-costs__chart-bar--charged"
                    style={{ height: getBarWidth(day.userCharged, maxDailyCost) }}
                    title={`${day.date}: ${formatCost(day.userCharged)} charged`}
                  />
                  <div
                    className="admin-costs__chart-bar admin-costs__chart-bar--cost"
                    style={{ height: getBarWidth(day.providerCost, maxDailyCost) }}
                    title={`${day.date}: ${formatCost(day.providerCost)} cost`}
                  />
                </div>
              ))}
            </div>
            <div className="admin-costs__chart-labels">
              <span>{filteredDaily[0]?.date}</span>
              <span>{filteredDaily[filteredDaily.length - 1]?.date}</span>
            </div>
            <div className="admin-costs__chart-legend">
              <span className="admin-costs__legend-item">
                <span className="admin-costs__legend-dot admin-costs__legend-dot--charged" />
                User Charged
              </span>
              <span className="admin-costs__legend-item">
                <span className="admin-costs__legend-dot admin-costs__legend-dot--cost" />
                Provider Cost
              </span>
            </div>
          </div>
        </div>

        {/* Provider Breakdown */}
        <div className="admin-costs__section">
          <h2 className="admin-costs__section-title">By Provider</h2>
          <div className="admin-costs__providers">
            {data.providers.map((provider) => {
              const maxCost = Math.max(...data.providers.map((p) => p.charged));
              return (
                <div key={provider.provider} className="admin-costs__provider">
                  <div className="admin-costs__provider-header">
                    <span className="admin-costs__provider-name">{provider.provider}</span>
                    <span className="admin-costs__provider-requests">
                      {formatNumber(provider.requests)} requests
                    </span>
                  </div>
                  <div className="admin-costs__provider-bar">
                    <div
                      className="admin-costs__provider-fill admin-costs__provider-fill--charged"
                      style={{ width: getBarWidth(provider.charged, maxCost) }}
                    />
                    <div
                      className="admin-costs__provider-fill admin-costs__provider-fill--cost"
                      style={{ width: getBarWidth(provider.cost, maxCost) }}
                    />
                  </div>
                  <div className="admin-costs__provider-meta">
                    <span>Cost: {formatCost(provider.cost)}</span>
                    <span>Charged: {formatCost(provider.charged)}</span>
                    <span className="admin-costs__provider-margin">
                      Margin: {formatCost(provider.margin)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="admin-costs__section">
          <h2 className="admin-costs__section-title">Recent Transactions</h2>
          <div className="admin-costs__table">
            <div className="admin-costs__table-header">
              <span className="admin-costs__table-cell admin-costs__table-cell--time">Time</span>
              <span className="admin-costs__table-cell admin-costs__table-cell--model">Model</span>
              <span className="admin-costs__table-cell admin-costs__table-cell--tokens">Tokens</span>
              <span className="admin-costs__table-cell admin-costs__table-cell--num">Cost</span>
              <span className="admin-costs__table-cell admin-costs__table-cell--num">Charged</span>
              <span className="admin-costs__table-cell admin-costs__table-cell--num">Margin</span>
            </div>
            {data.recentEntries.map((entry, index) => (
              <div key={index} className="admin-costs__table-row">
                <span className="admin-costs__table-cell admin-costs__table-cell--time">
                  {new Date(entry.date).toLocaleTimeString()}
                </span>
                <span className="admin-costs__table-cell admin-costs__table-cell--model">
                  <span className="admin-costs__model-provider">{entry.provider}</span>
                  <span className="admin-costs__model-name">{entry.model}</span>
                </span>
                <span className="admin-costs__table-cell admin-costs__table-cell--tokens">
                  {formatNumber(entry.inputTokens + entry.outputTokens)}
                </span>
                <span className="admin-costs__table-cell admin-costs__table-cell--num">
                  {formatCost(entry.providerCostCents)}
                </span>
                <span className="admin-costs__table-cell admin-costs__table-cell--num">
                  {formatCost(entry.userChargedCents)}
                </span>
                <span className="admin-costs__table-cell admin-costs__table-cell--num admin-costs__table-cell--margin">
                  {formatCost(entry.marginCents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
