/**
 * Settings Usage Page
 *
 * Usage dashboard showing current and historical usage.
 *
 * @module @humanizer/studio/components/settings/SettingsUsage
 */

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../contexts/ApiContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface UsageSummary {
  period: string;
  usage: {
    tokensUsed: number;
    requestsCount: number;
    costMillicents: number;
  };
  limits: {
    tokensLimit: number;
    requestsLimit: number;
    costLimitMillicents: number;
  };
  tier: string;
  percentUsed: number;
  withinLimits: boolean;
  byModel: Record<string, number>;
  byOperation: Record<string, number>;
}

interface UsageHistoryEntry {
  period: string;
  tokens: number;
  requests: number;
  costMillicents: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function SettingsUsage() {
  const api = useApi();

  // State
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [history, setHistory] = useState<UsageHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usageResult, historyResult] = await Promise.all([
        api.settings.getUsage(),
        api.settings.getUsageHistory(6),
      ]);
      setSummary(usageResult);
      setHistory(historyResult.history);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api.settings]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const formatNumber = (n: number) => n.toLocaleString();
  const formatCost = (millicents: number) => {
    const dollars = millicents / 100000;
    return dollars < 0.01 ? '< $0.01' : `$${dollars.toFixed(2)}`;
  };
  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="settings-section">
        <div className="settings-loading">
          <span className="settings-loading__spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="settings-section">
        <div className="settings-alert settings-alert--error">{error}</div>
      </div>
    );
  }

  return (
    <div className="settings-section">
      <div className="settings-section__header">
        <h2 className="settings-section__title">Usage Dashboard</h2>
        <p className="settings-section__description">
          Monitor your usage and remaining quota
        </p>
      </div>

      <div className="settings-section__content">
        {/* Current Period Summary */}
        {summary && (
          <div className="settings-card">
            <h3 className="settings-card__title">
              Current Period: {formatPeriod(summary.period)}
            </h3>
            <div className="settings-card__content">
              {/* Progress Bar */}
              <div className="usage-progress">
                <div className="usage-progress__header">
                  <span>Usage</span>
                  <span>{summary.percentUsed}%</span>
                </div>
                <div className="usage-progress__bar">
                  <div
                    className={`usage-progress__fill ${
                      summary.percentUsed >= 90
                        ? 'usage-progress__fill--danger'
                        : summary.percentUsed >= 75
                        ? 'usage-progress__fill--warning'
                        : ''
                    }`}
                    style={{ width: `${Math.min(summary.percentUsed, 100)}%` }}
                  />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="usage-stats">
                <div className="usage-stat">
                  <span className="usage-stat__label">Tokens Used</span>
                  <span className="usage-stat__value">
                    {formatNumber(summary.usage.tokensUsed)}
                  </span>
                  <span className="usage-stat__limit">
                    of {formatNumber(summary.limits.tokensLimit)}
                  </span>
                </div>
                <div className="usage-stat">
                  <span className="usage-stat__label">Requests</span>
                  <span className="usage-stat__value">
                    {formatNumber(summary.usage.requestsCount)}
                  </span>
                  <span className="usage-stat__limit">
                    of {formatNumber(summary.limits.requestsLimit)}
                  </span>
                </div>
                <div className="usage-stat">
                  <span className="usage-stat__label">Cost</span>
                  <span className="usage-stat__value">
                    {formatCost(summary.usage.costMillicents)}
                  </span>
                  <span className="usage-stat__limit">
                    {summary.limits.costLimitMillicents > 0
                      ? `of ${formatCost(summary.limits.costLimitMillicents)}`
                      : 'No limit'}
                  </span>
                </div>
                <div className="usage-stat">
                  <span className="usage-stat__label">Tier</span>
                  <span className={`usage-stat__badge usage-stat__badge--${summary.tier}`}>
                    {summary.tier}
                  </span>
                </div>
              </div>

              {/* Warnings */}
              {!summary.withinLimits && (
                <div className="settings-alert settings-alert--warning">
                  You have exceeded your usage quota. Consider upgrading your plan.
                </div>
              )}
              {summary.percentUsed >= 90 && summary.withinLimits && (
                <div className="settings-alert settings-alert--warning">
                  You are approaching your usage limit ({summary.percentUsed}% used).
                </div>
              )}
            </div>
          </div>
        )}

        {/* Usage by Model */}
        {summary && Object.keys(summary.byModel).length > 0 && (
          <div className="settings-card">
            <h3 className="settings-card__title">Usage by Model</h3>
            <div className="settings-card__content">
              <div className="usage-breakdown">
                {Object.entries(summary.byModel).map(([model, tokens]) => (
                  <div key={model} className="usage-breakdown__item">
                    <span className="usage-breakdown__label">{model}</span>
                    <span className="usage-breakdown__value">
                      {formatNumber(tokens as number)} tokens
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Usage by Operation */}
        {summary && Object.keys(summary.byOperation).length > 0 && (
          <div className="settings-card">
            <h3 className="settings-card__title">Usage by Operation</h3>
            <div className="settings-card__content">
              <div className="usage-breakdown">
                {Object.entries(summary.byOperation).map(([op, count]) => (
                  <div key={op} className="usage-breakdown__item">
                    <span className="usage-breakdown__label">{op}</span>
                    <span className="usage-breakdown__value">
                      {formatNumber(count as number)} requests
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="settings-card">
            <h3 className="settings-card__title">Usage History</h3>
            <div className="settings-card__content">
              <div className="settings-table">
                <table>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Tokens</th>
                      <th>Requests</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry.period}>
                        <td>{formatPeriod(entry.period)}</td>
                        <td>{formatNumber(entry.tokens)}</td>
                        <td>{formatNumber(entry.requests)}</td>
                        <td>{formatCost(entry.costMillicents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
