import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  role: 'FREE' | 'MEMBER' | 'PRO' | 'PREMIUM' | 'ADMIN';
  monthly_transformations: number;
  monthly_tokens_used: number;
  last_reset_date: string;
  created_at: string;
  total_transformations: number;
}

interface UserManagementProps {
  token: string;
}

export default function UserManagement({ token }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Edit state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>('');

  useEffect(() => {
    loadUsers();
  }, [search, roleFilter, offset]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });

      if (search) params.append('search', search);
      if (roleFilter) params.append('role', roleFilter);

      const response = await fetch(`https://npe-api.tem-527.workers.dev/admin/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load users');
      }

      const data = await response.json();
      setUsers(data.users);
      setTotal(data.total);
      setError(null);
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError(err.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRole = async (user: User, newRole: string) => {
    try {
      const response = await fetch(`https://npe-api.tem-527.workers.dev/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      // Reload users
      await loadUsers();
      setEditingUser(null);
      alert(`Updated ${user.email} to ${newRole}`);
    } catch (err: any) {
      console.error('Error updating user:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleResetQuota = async (user: User) => {
    if (!confirm(`Reset quota for ${user.email}?`)) return;

    try {
      const response = await fetch(`https://npe-api.tem-527.workers.dev/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          monthly_transformations: 0,
          monthly_tokens_used: 0
        })
      });

      if (!response.ok) {
        throw new Error('Failed to reset quota');
      }

      await loadUsers();
      alert(`Reset quota for ${user.email}`);
    } catch (err: any) {
      console.error('Error resetting quota:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const getRoleLimit = (role: string): number => {
    switch (role) {
      case 'FREE': return 10;
      case 'MEMBER': return 50;
      case 'PRO': return 200;
      default: return Infinity;
    }
  };

  const getQuotaPercentage = (user: User): number => {
    const limit = getRoleLimit(user.role);
    if (limit === Infinity) return 0;
    return Math.round((user.monthly_transformations / limit) * 100);
  };

  const getQuotaColor = (percentage: number): string => {
    if (percentage >= 90) return 'var(--accent-red)';
    if (percentage >= 70) return 'var(--accent-gold)';
    return 'var(--accent-green)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <h2 style={{ margin: 0 }}>User Management</h2>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-md)',
        flexWrap: 'wrap',
        padding: 'var(--spacing-md)',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)'
      }}>
        <input
          type="text"
          placeholder="Search by email or ID..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0); // Reset to first page
          }}
          style={{
            flex: '1 1 300px',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem'
          }}
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setOffset(0);
          }}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem'
          }}
        >
          <option value="">All Tiers</option>
          <option value="FREE">FREE</option>
          <option value="MEMBER">MEMBER</option>
          <option value="PRO">PRO</option>
          <option value="PREMIUM">PREMIUM</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <button
          onClick={loadUsers}
          className="btn"
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            fontSize: '0.875rem'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Results Summary */}
      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        Showing {users.length} of {total} users
        {search && ` (filtered by "${search}")`}
        {roleFilter && ` (role: ${roleFilter})`}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: 'var(--spacing-md)',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--accent-red)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--accent-red)',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)', color: 'var(--text-secondary)' }}>
          Loading users...
        </div>
      )}

      {/* Users Table */}
      {!isLoading && users.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.875rem',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden'
          }}>
            <thead>
              <tr style={{
                background: 'var(--bg-primary)',
                borderBottom: '2px solid var(--border-color)'
              }}>
                <th style={{ textAlign: 'left', padding: 'var(--spacing-md)' }}>Email</th>
                <th style={{ textAlign: 'center', padding: 'var(--spacing-md)' }}>Tier</th>
                <th style={{ textAlign: 'right', padding: 'var(--spacing-md)' }}>Quota Usage</th>
                <th style={{ textAlign: 'right', padding: 'var(--spacing-md)' }}>Total</th>
                <th style={{ textAlign: 'center', padding: 'var(--spacing-md)' }}>Joined</th>
                <th style={{ textAlign: 'center', padding: 'var(--spacing-md)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const quotaPercent = getQuotaPercentage(user);
                const quotaLimit = getRoleLimit(user.role);
                const isEditing = editingUser?.id === user.id;

                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: 'var(--spacing-md)' }}>
                      <div style={{ fontWeight: 500 }}>{user.email}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        ID: {user.id.substring(0, 8)}...
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: 'var(--spacing-md)' }}>
                      {isEditing ? (
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                          style={{
                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                            fontSize: '0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)'
                          }}
                        >
                          <option value="FREE">FREE</option>
                          <option value="MEMBER">MEMBER</option>
                          <option value="PRO">PRO</option>
                          <option value="PREMIUM">PREMIUM</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      ) : (
                        <span style={{
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          background: getTierBgColor(user.role),
                          color: getTierTextColor(),
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          {user.role}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', padding: 'var(--spacing-md)' }}>
                      <div style={{ fontWeight: 500, color: getQuotaColor(quotaPercent) }}>
                        {user.monthly_transformations} / {quotaLimit === Infinity ? '∞' : quotaLimit}
                      </div>
                      {quotaLimit !== Infinity && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {quotaPercent}% used
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', padding: 'var(--spacing-md)' }}>
                      {user.total_transformations}
                    </td>
                    <td style={{ textAlign: 'center', padding: 'var(--spacing-md)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'center', padding: 'var(--spacing-md)' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleUpdateRole(user, newRole)}
                            style={{
                              padding: 'var(--spacing-xs) var(--spacing-sm)',
                              fontSize: '0.75rem',
                              background: 'var(--accent-green)',
                              color: 'white',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer'
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            style={{
                              padding: 'var(--spacing-xs) var(--spacing-sm)',
                              fontSize: '0.75rem',
                              background: 'var(--text-secondary)',
                              color: 'white',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', justifyContent: 'center' }}>
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setNewRole(user.role);
                            }}
                            style={{
                              padding: 'var(--spacing-xs) var(--spacing-sm)',
                              fontSize: '0.75rem',
                              background: 'var(--accent-purple)',
                              color: 'white',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer'
                            }}
                          >
                            Edit Tier
                          </button>
                          <button
                            onClick={() => handleResetQuota(user)}
                            style={{
                              padding: 'var(--spacing-xs) var(--spacing-sm)',
                              fontSize: '0.75rem',
                              background: 'var(--accent-gold)',
                              color: 'white',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer'
                            }}
                          >
                            Reset Quota
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && total > limit && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--spacing-md)',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="btn"
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              fontSize: '0.875rem'
            }}
          >
            ← Previous
          </button>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="btn"
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              fontSize: '0.875rem'
            }}
          >
            Next →
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && users.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 'var(--spacing-2xl)',
          color: 'var(--text-secondary)',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)'
        }}>
          No users found
          {search && ' matching your search'}
          {roleFilter && ` with role ${roleFilter}`}
        </div>
      )}
    </div>
  );
}

function getTierBgColor(tier: string): string {
  switch (tier) {
    case 'ADMIN': return 'var(--accent-red)';
    case 'PREMIUM': return 'var(--accent-gold)';
    case 'PRO': return 'var(--accent-purple)';
    case 'MEMBER': return 'var(--accent-blue)';
    case 'FREE': return 'var(--text-secondary)';
    default: return 'var(--text-secondary)';
  }
}

function getTierTextColor(): string {
  return 'white';
}
