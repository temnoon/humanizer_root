/**
 * Admin Users Page
 *
 * User management interface with list, search, and detail views.
 *
 * @module @humanizer/studio/components/admin/AdminUsers
 */

import { useState, useEffect, useCallback } from 'react';
import { useApi, type AdminUser } from '../../contexts/ApiContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type TierFilter = '' | 'free' | 'member' | 'pro' | 'premium' | 'admin';
type StatusFilter = '' | 'active' | 'banned';

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AdminUsers() {
  const api = useApi();

  // State
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Selected user for detail view
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.admin.listUsers({
        search: search || undefined,
        tier: tierFilter || undefined,
        status: statusFilter || undefined,
        limit: pageSize,
        offset: page * pageSize,
      });

      setUsers(result.users);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [api.admin, search, tierFilter, statusFilter, page]);

  const fetchUserDetail = useCallback(async (userId: string) => {
    setLoadingDetail(true);
    try {
      const user = await api.admin.getUser(userId);
      setSelectedUser(user);
    } catch (err) {
      console.error('Failed to load user detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  }, [api.admin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (selectedUserId) {
      fetchUserDetail(selectedUserId);
    } else {
      setSelectedUser(null);
    }
  }, [selectedUserId, fetchUserDetail]);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  const handleChangeRole = async (newRole: string, reason: string) => {
    if (!selectedUserId) return;

    setActionLoading(true);
    setActionError(null);

    try {
      await api.admin.updateUserRole(selectedUserId, newRole, reason);
      setShowRoleModal(false);
      fetchUsers();
      fetchUserDetail(selectedUserId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBanUser = async (reason: string, duration?: string) => {
    if (!selectedUserId) return;

    setActionLoading(true);
    setActionError(null);

    try {
      await api.admin.banUser(selectedUserId, reason, duration);
      setShowBanModal(false);
      fetchUsers();
      fetchUserDetail(selectedUserId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to ban user');
    } finally {
      setActionLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString();
  };

  const getRoleBadgeClass = (role: string): string => {
    switch (role) {
      case 'admin': return 'admin-badge--error';
      case 'premium': return 'admin-badge--warning';
      case 'pro': return 'admin-badge--info';
      case 'member': return 'admin-badge--success';
      default: return 'admin-badge--neutral';
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="admin-users">
      {/* Header */}
      <div className="admin-users__header">
        <h1 className="admin-users__title">User Management</h1>
        <div className="admin-users__stats">
          <span className="admin-users__stat">{total} users total</span>
        </div>
      </div>

      <div className="admin-users__layout">
        {/* User List Panel */}
        <div className="admin-users__list-panel">
          {/* Filters */}
          <div className="admin-users__filters">
            <input
              type="text"
              className="admin-form__input"
              placeholder="Search by email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
            <select
              className="admin-form__input"
              value={tierFilter}
              onChange={(e) => {
                setTierFilter(e.target.value as TierFilter);
                setPage(0);
              }}
            >
              <option value="">All Tiers</option>
              <option value="free">Free</option>
              <option value="member">Member</option>
              <option value="pro">Pro</option>
              <option value="premium">Premium</option>
              <option value="admin">Admin</option>
            </select>
            <select
              className="admin-form__input"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setPage(0);
              }}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
            </select>
          </div>

          {/* User List */}
          {loading ? (
            <div className="admin-loading">
              <span className="admin-loading__spinner" />
            </div>
          ) : error ? (
            <div className="admin-alert admin-alert--error">
              <span className="admin-alert__icon">⚠️</span>
              <div className="admin-alert__content">
                <p className="admin-alert__message">{error}</p>
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="admin-empty">
              <span className="admin-empty__icon">👤</span>
              <h3 className="admin-empty__title">No Users Found</h3>
              <p className="admin-empty__description">
                {search || tierFilter || statusFilter
                  ? 'Try adjusting your filters.'
                  : 'No users have registered yet.'}
              </p>
            </div>
          ) : (
            <>
              <div className="admin-users__list">
                {users.map((user) => (
                  <button
                    key={user.id}
                    className={`admin-users__item ${selectedUserId === user.id ? 'admin-users__item--selected' : ''}`}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <div className="admin-users__item-avatar">
                      {user.email.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="admin-users__item-info">
                      <div className="admin-users__item-email">{user.email}</div>
                      <div className="admin-users__item-meta">
                        <span className={`admin-badge ${getRoleBadgeClass(user.role)}`}>
                          {user.role}
                        </span>
                        {user.bannedAt && (
                          <span className="admin-badge admin-badge--error">Banned</span>
                        )}
                      </div>
                    </div>
                    <div className="admin-users__item-date">
                      {formatDate(user.createdAt)}
                    </div>
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="admin-users__pagination">
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </button>
                  <span className="admin-users__pagination-info">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* User Detail Panel */}
        <div className="admin-users__detail-panel">
          {selectedUserId ? (
            loadingDetail ? (
              <div className="admin-loading">
                <span className="admin-loading__spinner" />
              </div>
            ) : selectedUser ? (
              <UserDetailView
                user={selectedUser}
                onChangeRole={() => setShowRoleModal(true)}
                onBan={() => setShowBanModal(true)}
                onClose={() => setSelectedUserId(null)}
              />
            ) : (
              <div className="admin-empty">
                <span className="admin-empty__icon">❓</span>
                <h3 className="admin-empty__title">User Not Found</h3>
              </div>
            )
          ) : (
            <div className="admin-empty">
              <span className="admin-empty__icon">👈</span>
              <h3 className="admin-empty__title">Select a User</h3>
              <p className="admin-empty__description">
                Choose a user from the list to view details.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Role Change Modal */}
      {showRoleModal && selectedUser && (
        <RoleChangeModal
          currentRole={selectedUser.role}
          onConfirm={handleChangeRole}
          onCancel={() => setShowRoleModal(false)}
          loading={actionLoading}
          error={actionError}
        />
      )}

      {/* Ban Modal */}
      {showBanModal && selectedUser && (
        <BanUserModal
          userEmail={selectedUser.email}
          onConfirm={handleBanUser}
          onCancel={() => setShowBanModal(false)}
          loading={actionLoading}
          error={actionError}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// USER DETAIL VIEW
// ═══════════════════════════════════════════════════════════════════════════

interface UserDetailViewProps {
  user: AdminUser;
  onChangeRole: () => void;
  onBan: () => void;
  onClose: () => void;
}

function UserDetailView({ user, onChangeRole, onBan, onClose }: UserDetailViewProps) {
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  const formatNumber = (num: number | undefined): string => {
    if (num === undefined) return '0';
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="admin-user-detail">
      <div className="admin-user-detail__header">
        <h2 className="admin-user-detail__title">User Details</h2>
        <button
          className="btn btn--ghost btn--icon btn--sm"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="admin-user-detail__content">
        {/* User Info */}
        <div className="admin-user-detail__section">
          <div className="admin-user-detail__avatar">
            {user.email.substring(0, 2).toUpperCase()}
          </div>
          <div className="admin-user-detail__primary">
            <div className="admin-user-detail__email">{user.email}</div>
            <div className="admin-user-detail__id">ID: {user.id}</div>
          </div>
        </div>

        {/* Status */}
        <div className="admin-user-detail__section">
          <h3 className="admin-user-detail__section-title">Status</h3>
          <div className="admin-user-detail__grid">
            <div className="admin-user-detail__field">
              <span className="admin-user-detail__label">Role</span>
              <span className={`admin-badge ${user.role === 'admin' ? 'admin-badge--error' : 'admin-badge--info'}`}>
                {user.role}
              </span>
            </div>
            <div className="admin-user-detail__field">
              <span className="admin-user-detail__label">Status</span>
              <span className={`admin-badge ${user.bannedAt ? 'admin-badge--error' : 'admin-badge--success'}`}>
                {user.bannedAt ? 'Banned' : 'Active'}
              </span>
            </div>
            <div className="admin-user-detail__field">
              <span className="admin-user-detail__label">Created</span>
              <span className="admin-user-detail__value">{formatDate(user.createdAt)}</span>
            </div>
            <div className="admin-user-detail__field">
              <span className="admin-user-detail__label">Last Active</span>
              <span className="admin-user-detail__value">{formatDate(user.lastActiveAt)}</span>
            </div>
          </div>
        </div>

        {/* Usage Stats */}
        {user.usage && (
          <div className="admin-user-detail__section">
            <h3 className="admin-user-detail__section-title">Usage (Current Period)</h3>
            <div className="admin-user-detail__grid">
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">Tokens Used</span>
                <span className="admin-user-detail__value">{formatNumber(user.usage.tokensUsed)}</span>
              </div>
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">Requests</span>
                <span className="admin-user-detail__value">{formatNumber(user.usage.requestsCount)}</span>
              </div>
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">Cost</span>
                <span className="admin-user-detail__value">
                  ${((user.usage.costMillicents ?? 0) / 100000).toFixed(2)}
                </span>
              </div>
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">Period</span>
                <span className="admin-user-detail__value">{user.usage.period}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="admin-user-detail__section">
          <h3 className="admin-user-detail__section-title">Actions</h3>
          <div className="btn-group">
            <button
              className="btn btn--secondary"
              onClick={onChangeRole}
            >
              Change Role
            </button>
            {!user.bannedAt && (
              <button
                className="btn btn--danger"
                onClick={onBan}
              >
                Ban User
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROLE CHANGE MODAL
// ═══════════════════════════════════════════════════════════════════════════

interface RoleChangeModalProps {
  currentRole: string;
  onConfirm: (newRole: string, reason: string) => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}

function RoleChangeModal({ currentRole, onConfirm, onCancel, loading, error }: RoleChangeModalProps) {
  const [newRole, setNewRole] = useState(currentRole);
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRole && reason) {
      onConfirm(newRole, reason);
    }
  };

  return (
    <div className="admin-modal__overlay" onClick={onCancel}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal__header">
          <h2 className="admin-modal__title">Change User Role</h2>
          <button
            className="btn btn--ghost btn--icon btn--sm"
            onClick={onCancel}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="admin-modal__content">
            {error && (
              <div className="admin-alert admin-alert--error">
                <span className="admin-alert__icon">⚠️</span>
                <div className="admin-alert__content">
                  <p className="admin-alert__message">{error}</p>
                </div>
              </div>
            )}
            <div className="admin-form__group">
              <label className="admin-form__label">New Role</label>
              <select
                className="admin-form__input"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="free">Free</option>
                <option value="member">Member</option>
                <option value="pro">Pro</option>
                <option value="premium">Premium</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="admin-form__group">
              <label className="admin-form__label">Reason</label>
              <textarea
                className="admin-form__input admin-form__input--textarea"
                placeholder="Reason for role change..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="admin-modal__footer">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading || !reason || newRole === currentRole}
            >
              {loading ? 'Saving...' : 'Change Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BAN USER MODAL
// ═══════════════════════════════════════════════════════════════════════════

interface BanUserModalProps {
  userEmail: string;
  onConfirm: (reason: string, duration?: string) => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}

function BanUserModal({ userEmail, onConfirm, onCancel, loading, error }: BanUserModalProps) {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('permanent');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason) {
      onConfirm(reason, duration === 'permanent' ? undefined : duration);
    }
  };

  return (
    <div className="admin-modal__overlay" onClick={onCancel}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal__header">
          <h2 className="admin-modal__title">Ban User</h2>
          <button
            className="btn btn--ghost btn--icon btn--sm"
            onClick={onCancel}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="admin-modal__content">
            <div className="admin-alert admin-alert--warning">
              <span className="admin-alert__icon">⚠️</span>
              <div className="admin-alert__content">
                <p className="admin-alert__message">
                  You are about to ban <strong>{userEmail}</strong>. This will prevent them from accessing the service.
                </p>
              </div>
            </div>
            {error && (
              <div className="admin-alert admin-alert--error">
                <span className="admin-alert__icon">⚠️</span>
                <div className="admin-alert__content">
                  <p className="admin-alert__message">{error}</p>
                </div>
              </div>
            )}
            <div className="admin-form__group">
              <label className="admin-form__label">Reason</label>
              <textarea
                className="admin-form__input admin-form__input--textarea"
                placeholder="Reason for ban..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
            <div className="admin-form__group">
              <label className="admin-form__label">Duration</label>
              <select
                className="admin-form__input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                <option value="permanent">Permanent</option>
                <option value="7d">7 Days</option>
                <option value="30d">30 Days</option>
                <option value="90d">90 Days</option>
              </select>
            </div>
          </div>
          <div className="admin-modal__footer">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--danger"
              disabled={loading || !reason}
            >
              {loading ? 'Processing...' : 'Ban User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
