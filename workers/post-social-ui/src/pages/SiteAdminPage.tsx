/**
 * Site Admin Dashboard
 *
 * Unified admin interface for:
 * - Site metrics and analytics
 * - Stripe billing overview
 * - Service costs and margins
 * - User management and provisioning
 * - System health monitoring
 *
 * Requires admin role.
 */

import { Component, createSignal, createResource, Show, For, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { authStore } from '@/stores/auth';
import { AUTH_API_URL } from '@/config/constants';
import { toast } from '@/components/ui/Toast';
import { confirm } from '@/components/ui/ConfirmDialog';
import '@/styles/admin.css';

// Types
interface OverviewMetrics {
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
  daily_activity: Array<{ date: string; users: number; transformations: number }>;
  quota_usage: { users_near_limit: number; avg_usage_percentage: number };
}

interface BillingMetrics {
  subscriptions: {
    active: number;
    trialing: number;
    past_due: number;
    canceled: number;
    total_paying: number;
  };
  revenue: {
    mrr_cents: number;
    mrr_formatted: string;
    total_revenue_formatted: string;
    day_passes_24h: number;
    day_passes_total: number;
  };
  by_tier: Record<string, number>;
  recent_events: Array<{
    stripe_event_id: string;
    event_type: string;
    processed: number;
    error_message: string | null;
    created_at: number;
  }>;
  recent_payments: Array<{
    id: string;
    email: string;
    amount_cents: number;
    status: string;
    created_at: number;
  }>;
}

interface CostMetrics {
  services: {
    cloudflare_workers: { note: string; estimated_cost: number };
    cloudflare_d1: { size_mb: number; note: string; estimated_cost: number };
    cloudflare_ai: { tokens_used: number; note: string; estimated_cost: number };
    stripe: { transactions: number; total_fees_formatted: string };
  };
  totals: {
    estimated_monthly_costs: number;
    total_revenue: number;
    margin_percent: number;
    profit_estimate: number;
  };
  notes: string[];
}

interface UserRecord {
  id: string;
  email: string;
  role: string;
  monthly_transformations: number;
  created_at: number;
  total_transformations: number;
}

export const SiteAdminPage: Component = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal<'overview' | 'billing' | 'costs' | 'users'>('overview');
  const [error, setError] = createSignal('');

  // Check auth on mount
  onMount(() => {
    if (!authStore.isAuthenticated()) {
      navigate('/login?redirect=/admin');
      return;
    }
    // Check if admin
    const user = authStore.user();
    if (user?.role !== 'admin') {
      setError('Admin access required');
    }
  });

  // Fetch helpers
  const fetchWithAuth = async (endpoint: string) => {
    const token = authStore.token();
    const res = await fetch(`${AUTH_API_URL}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  // Resources
  const [metrics] = createResource(() => authStore.isAuthenticated(), async (isAuth) => {
    if (!isAuth) return null;
    try {
      return await fetchWithAuth('/admin/metrics') as OverviewMetrics;
    } catch (err) {
      console.error('Failed to load metrics:', err);
      return null;
    }
  });

  const [billing] = createResource(() => authStore.isAuthenticated(), async (isAuth) => {
    if (!isAuth) return null;
    try {
      return await fetchWithAuth('/admin/billing') as BillingMetrics;
    } catch (err) {
      console.error('Failed to load billing:', err);
      return null;
    }
  });

  const [costs] = createResource(() => authStore.isAuthenticated(), async (isAuth) => {
    if (!isAuth) return null;
    try {
      return await fetchWithAuth('/admin/costs') as CostMetrics;
    } catch (err) {
      console.error('Failed to load costs:', err);
      return null;
    }
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div class="admin-page">
      <header class="admin-page-header">
        <h1>Site Administration</h1>
        <div class="admin-nav">
          <button class="back-btn" onClick={() => navigate('/app')}>
            ← Back to Studio
          </button>
        </div>
      </header>

      <Show when={error()}>
        <div class="admin-error">{error()}</div>
      </Show>

      <Show when={!error()}>
        {/* Tabs */}
        <div class="admin-tabs">
          <button
            class={`admin-tab ${activeTab() === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            class={`admin-tab ${activeTab() === 'billing' ? 'active' : ''}`}
            onClick={() => setActiveTab('billing')}
          >
            Billing
          </button>
          <button
            class={`admin-tab ${activeTab() === 'costs' ? 'active' : ''}`}
            onClick={() => setActiveTab('costs')}
          >
            Costs
          </button>
          <button
            class={`admin-tab ${activeTab() === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
        </div>

        {/* Overview Tab */}
        <Show when={activeTab() === 'overview'}>
          <div class="admin-content">
            <Show when={metrics.loading}>
              <div class="loading-state">Loading metrics...</div>
            </Show>

            <Show when={metrics()}>
              {/* KPI Cards */}
              <div class="kpi-grid">
                <div class="kpi-card">
                  <div class="kpi-value">{metrics()!.overview.total_users}</div>
                  <div class="kpi-label">Total Users</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">{metrics()!.overview.active_users_7d}</div>
                  <div class="kpi-label">Active (7d)</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">{metrics()!.overview.total_transformations}</div>
                  <div class="kpi-label">Transformations</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">{metrics()!.overview.mailing_list_signups}</div>
                  <div class="kpi-label">Waitlist</div>
                </div>
              </div>

              {/* Users by Tier */}
              <div class="admin-section">
                <h3>Users by Tier</h3>
                <div class="tier-breakdown">
                  <For each={Object.entries(metrics()!.users_by_tier)}>
                    {([tier, count]) => (
                      <div class="tier-item">
                        <span class="tier-name">{tier}</span>
                        <span class="tier-count">{count}</span>
                      </div>
                    )}
                  </For>
                </div>
              </div>

              {/* Daily Activity */}
              <div class="admin-section">
                <h3>Daily Activity (14 days)</h3>
                <div class="activity-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Users</th>
                        <th>Transformations</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={metrics()!.daily_activity.slice(0, 7)}>
                        {(day) => (
                          <tr>
                            <td>{day.date}</td>
                            <td>{day.users}</td>
                            <td>{day.transformations}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        {/* Billing Tab */}
        <Show when={activeTab() === 'billing'}>
          <div class="admin-content">
            <Show when={billing.loading}>
              <div class="loading-state">Loading billing...</div>
            </Show>

            <Show when={billing()}>
              {/* Revenue KPIs */}
              <div class="kpi-grid">
                <div class="kpi-card highlight">
                  <div class="kpi-value">{billing()!.revenue.mrr_formatted}</div>
                  <div class="kpi-label">Monthly Recurring</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">{billing()!.subscriptions.total_paying}</div>
                  <div class="kpi-label">Paying Customers</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">{billing()!.subscriptions.trialing}</div>
                  <div class="kpi-label">Trialing</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">{billing()!.revenue.day_passes_total}</div>
                  <div class="kpi-label">Day Passes</div>
                </div>
              </div>

              {/* Subscriptions by Status */}
              <div class="admin-section">
                <h3>Subscription Status</h3>
                <div class="status-grid">
                  <div class="status-item ok">
                    <span class="status-label">Active</span>
                    <span class="status-value">{billing()!.subscriptions.active}</span>
                  </div>
                  <div class="status-item warning">
                    <span class="status-label">Past Due</span>
                    <span class="status-value">{billing()!.subscriptions.past_due}</span>
                  </div>
                  <div class="status-item neutral">
                    <span class="status-label">Canceled</span>
                    <span class="status-value">{billing()!.subscriptions.canceled}</span>
                  </div>
                </div>
              </div>

              {/* By Tier */}
              <div class="admin-section">
                <h3>Subscriptions by Tier</h3>
                <div class="tier-breakdown">
                  <For each={Object.entries(billing()!.by_tier)}>
                    {([tier, count]) => (
                      <div class="tier-item">
                        <span class="tier-name">{tier}</span>
                        <span class="tier-count">{count}</span>
                        <span class="tier-revenue">
                          ${tier === 'member' ? (count * 9.99).toFixed(2) :
                            tier === 'pro' ? (count * 29.99).toFixed(2) :
                            (count * 99.99).toFixed(2)}/mo
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </div>

              {/* Recent Events */}
              <div class="admin-section">
                <h3>Recent Stripe Events</h3>
                <div class="events-list">
                  <For each={billing()!.recent_events.slice(0, 10)}>
                    {(event) => (
                      <div class={`event-item ${event.error_message ? 'error' : event.processed ? 'processed' : 'pending'}`}>
                        <span class="event-type">{event.event_type}</span>
                        <span class="event-time">{formatDate(event.created_at)}</span>
                        <Show when={event.error_message}>
                          <span class="event-error">{event.error_message}</span>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        {/* Costs Tab */}
        <Show when={activeTab() === 'costs'}>
          <div class="admin-content">
            <Show when={costs.loading}>
              <div class="loading-state">Loading costs...</div>
            </Show>

            <Show when={costs()}>
              {/* Profit/Loss KPIs */}
              <div class="kpi-grid">
                <div class="kpi-card">
                  <div class="kpi-value">${costs()!.totals.total_revenue.toFixed(2)}</div>
                  <div class="kpi-label">Total Revenue</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">${costs()!.totals.estimated_monthly_costs.toFixed(2)}</div>
                  <div class="kpi-label">Est. Costs</div>
                </div>
                <div class="kpi-card highlight">
                  <div class="kpi-value">${costs()!.totals.profit_estimate.toFixed(2)}</div>
                  <div class="kpi-label">Profit</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">{costs()!.totals.margin_percent}%</div>
                  <div class="kpi-label">Margin</div>
                </div>
              </div>

              {/* Service Breakdown */}
              <div class="admin-section">
                <h3>Service Costs</h3>
                <div class="costs-breakdown">
                  <div class="cost-item">
                    <div class="cost-header">
                      <span class="cost-service">Cloudflare Workers</span>
                      <span class="cost-amount">${costs()!.services.cloudflare_workers.estimated_cost.toFixed(2)}</span>
                    </div>
                    <div class="cost-note">{costs()!.services.cloudflare_workers.note}</div>
                  </div>

                  <div class="cost-item">
                    <div class="cost-header">
                      <span class="cost-service">Cloudflare D1</span>
                      <span class="cost-amount">${costs()!.services.cloudflare_d1.estimated_cost.toFixed(2)}</span>
                    </div>
                    <div class="cost-note">
                      {costs()!.services.cloudflare_d1.size_mb.toFixed(2)} MB used
                    </div>
                  </div>

                  <div class="cost-item">
                    <div class="cost-header">
                      <span class="cost-service">Cloudflare AI</span>
                      <span class="cost-amount">${costs()!.services.cloudflare_ai.estimated_cost.toFixed(2)}</span>
                    </div>
                    <div class="cost-note">
                      {costs()!.services.cloudflare_ai.tokens_used.toLocaleString()} tokens
                    </div>
                  </div>

                  <div class="cost-item">
                    <div class="cost-header">
                      <span class="cost-service">Stripe Fees</span>
                      <span class="cost-amount">{costs()!.services.stripe.total_fees_formatted}</span>
                    </div>
                    <div class="cost-note">
                      {costs()!.services.stripe.transactions} transactions (2.9% + $0.30)
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div class="admin-section">
                <h3>Notes</h3>
                <ul class="cost-notes">
                  <For each={costs()!.notes}>
                    {(note) => <li>{note}</li>}
                  </For>
                </ul>
              </div>
            </Show>
          </div>
        </Show>

        {/* Users Tab */}
        <Show when={activeTab() === 'users'}>
          <UsersTab />
        </Show>
      </Show>
    </div>
  );
};

/**
 * Users Tab Component
 */
const UsersTab: Component = () => {
  const [users, setUsers] = createSignal<UserRecord[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [search, setSearch] = createSignal('');
  const [roleFilter, setRoleFilter] = createSignal('');
  const [showProvision, setShowProvision] = createSignal(false);
  const [provisionForm, setProvisionForm] = createSignal({
    email: '',
    password: '',
    role: 'free' as string,
    withStripeCustomer: false
  });
  const [provisionResult, setProvisionResult] = createSignal<any>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = authStore.token();
      let url = `${AUTH_API_URL}/admin/users?limit=50`;
      if (search()) url += `&search=${encodeURIComponent(search())}`;
      if (roleFilter()) url += `&role=${roleFilter()}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount
  onMount(() => fetchUsers());

  const handleSearch = () => fetchUsers();

  const handleProvision = async () => {
    try {
      const token = authStore.token();
      const res = await fetch(`${AUTH_API_URL}/admin/users/provision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(provisionForm())
      });
      const data = await res.json();
      if (data.success) {
        setProvisionResult(data);
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to provision user');
      }
    } catch (err) {
      console.error('Provision error:', err);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const token = authStore.token();
      const res = await fetch(`${AUTH_API_URL}/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(`Failed to update role: ${data.error || res.statusText}`);
        return;
      }

      fetchUsers();
    } catch (err) {
      console.error('Update role error:', err);
      toast.error(`Error updating role: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    const confirmed = await confirm({
      title: 'Delete User',
      message: `Delete user ${email}? This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true
    });
    if (!confirmed) return;

    try {
      const token = authStore.token();
      const res = await fetch(`${AUTH_API_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  return (
    <div class="admin-content">
      {/* Search Bar */}
      <div class="users-toolbar">
        <div class="search-group">
          <input
            type="text"
            placeholder="Search by email..."
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <select value={roleFilter()} onChange={(e) => setRoleFilter(e.currentTarget.value)}>
            <option value="">All Roles</option>
            <option value="free">Free</option>
            <option value="member">Member</option>
            <option value="pro">Pro</option>
            <option value="premium">Premium</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={handleSearch}>Search</button>
        </div>

        <button class="provision-btn" onClick={() => setShowProvision(!showProvision())}>
          {showProvision() ? 'Cancel' : '+ Provision User'}
        </button>
      </div>

      {/* Provision Form */}
      <Show when={showProvision()}>
        <div class="provision-form">
          <h4>Provision Test User</h4>
          <div class="form-row">
            <input
              type="email"
              placeholder="Email"
              value={provisionForm().email}
              onInput={(e) => setProvisionForm({ ...provisionForm(), email: e.currentTarget.value })}
            />
            <input
              type="text"
              placeholder="Password"
              value={provisionForm().password}
              onInput={(e) => setProvisionForm({ ...provisionForm(), password: e.currentTarget.value })}
            />
            <select
              value={provisionForm().role}
              onChange={(e) => setProvisionForm({ ...provisionForm(), role: e.currentTarget.value })}
            >
              <option value="free">Free</option>
              <option value="member">Member</option>
              <option value="pro">Pro</option>
              <option value="premium">Premium</option>
            </select>
            <label class="checkbox-label">
              <input
                type="checkbox"
                checked={provisionForm().withStripeCustomer}
                onChange={(e) => setProvisionForm({ ...provisionForm(), withStripeCustomer: e.currentTarget.checked })}
              />
              Create Stripe Customer
            </label>
            <button onClick={handleProvision}>Create</button>
          </div>

          <Show when={provisionResult()}>
            <div class="provision-result">
              <p>Created: {provisionResult().user?.email}</p>
              <Show when={provisionResult().stripeCustomerId}>
                <p>Stripe: {provisionResult().stripeCustomerId}</p>
              </Show>
              <code class="login-cmd">{provisionResult().loginCommand}</code>
            </div>
          </Show>
        </div>
      </Show>

      {/* Users Table */}
      <Show when={loading()}>
        <div class="loading-state">Loading users...</div>
      </Show>

      <Show when={!loading()}>
        <div class="users-table-container">
          <table class="users-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Transformations</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <For each={users()}>
                {(user) => (
                  <tr>
                    <td class="user-email">{user.email}</td>
                    <td>
                      <select
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user.id, e.currentTarget.value)}
                        disabled={user.role === 'admin'}
                      >
                        <option value="free">free</option>
                        <option value="member">member</option>
                        <option value="pro">pro</option>
                        <option value="premium">premium</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td>{user.monthly_transformations} / {user.total_transformations}</td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        class="delete-btn"
                        onClick={() => handleDelete(user.id, user.email)}
                        disabled={user.role === 'admin'}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
};

export default SiteAdminPage;
