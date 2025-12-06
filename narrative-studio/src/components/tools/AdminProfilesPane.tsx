/**
 * AdminProfilesPane - Admin dashboard for managing global transformation profiles
 *
 * Features:
 * - List all personas and styles with feedback stats
 * - Edit profile prompts and status
 * - Delete profiles
 * - View negative feedback for attention
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://npe-api.tem-527.workers.dev';

// Inline icons
const Edit = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const Trash = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const RefreshCw = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

interface Profile {
  id: number;
  name: string;
  description?: string;
  system_prompt?: string;
  style_prompt?: string;
  status: string;
  total_uses: number;
  thumbs_up: number;
  thumbs_down: number;
  success_rate: number;
}

interface FeedbackItem {
  profile_name: string;
  transformation_type: string;
  feedback_text: string;
  created_at: number;
  user_email: string;
}

interface FeedbackSummary {
  overall: { total: number; good: number; bad: number };
  recentNegative: FeedbackItem[];
}

export function AdminProfilesPane() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [personas, setPersonas] = useState<Profile[]>([]);
  const [styles, setStyles] = useState<Profile[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'personas' | 'styles' | 'feedback'>('personas');

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ status: string; description?: string }>({ status: 'active' });

  const getToken = () => localStorage.getItem('narrative-studio-auth-token') ||
                         localStorage.getItem('post-social:token');

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError(null);

    try {
      const token = getToken();
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const [personasRes, stylesRes, feedbackRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/profiles/personas`, { headers }),
        fetch(`${API_BASE_URL}/admin/profiles/styles`, { headers }),
        fetch(`${API_BASE_URL}/admin/profiles/feedback/summary`, { headers }),
      ]);

      if (!personasRes.ok || !stylesRes.ok) {
        throw new Error('Failed to fetch profiles');
      }

      const [personasData, stylesData, feedbackData] = await Promise.all([
        personasRes.json(),
        stylesRes.json(),
        feedbackRes.ok ? feedbackRes.json() : null,
      ]);

      setPersonas(personasData.personas || []);
      setStyles(stylesData.styles || []);
      setFeedbackSummary(feedbackData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update profile status
  const handleUpdateStatus = useCallback(async (type: 'personas' | 'styles', id: number, status: string) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/admin/profiles/${type}/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Update failed');
      }

      fetchData();
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }, [fetchData]);

  // Delete profile
  const handleDelete = useCallback(async (type: 'personas' | 'styles', id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/admin/profiles/${type}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }, [fetchData]);

  if (!isAdmin) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
        Admin access required
      </div>
    );
  }

  const renderProfileTable = (profiles: Profile[], type: 'personas' | 'styles') => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
            <th style={{ textAlign: 'left', padding: '6px 4px', color: 'var(--text-tertiary)' }}>Name</th>
            <th style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--text-tertiary)' }}>Status</th>
            <th style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--text-tertiary)' }}>👍</th>
            <th style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--text-tertiary)' }}>👎</th>
            <th style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--text-tertiary)' }}>Rate</th>
            <th style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--text-tertiary)' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '6px 4px', fontWeight: 500 }}>{p.name}</td>
              <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                {editingId === p.id ? (
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    style={{
                      fontSize: '0.625rem',
                      padding: '2px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '3px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="disabled">Disabled</option>
                  </select>
                ) : (
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '0.625rem',
                    backgroundColor: p.status === 'active' ? 'rgba(34, 197, 94, 0.2)' :
                                    p.status === 'draft' ? 'rgba(234, 179, 8, 0.2)' :
                                    'rgba(239, 68, 68, 0.2)',
                    color: p.status === 'active' ? '#22c55e' :
                           p.status === 'draft' ? '#eab308' : '#ef4444',
                  }}>
                    {p.status || 'active'}
                  </span>
                )}
              </td>
              <td style={{ padding: '6px 4px', textAlign: 'center', color: '#22c55e' }}>{p.thumbs_up}</td>
              <td style={{ padding: '6px 4px', textAlign: 'center', color: '#ef4444' }}>{p.thumbs_down}</td>
              <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                {p.total_uses > 0 ? `${Math.round(p.success_rate)}%` : '-'}
              </td>
              <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                {editingId === p.id ? (
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                    <button
                      onClick={() => handleUpdateStatus(type, p.id, editForm.status)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '0.625rem',
                        backgroundColor: '#22c55e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '0.625rem',
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                    <button
                      onClick={() => {
                        setEditingId(p.id);
                        setEditForm({ status: p.status || 'active' });
                      }}
                      title="Edit"
                      style={{
                        padding: '2px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                      }}
                    >
                      <Edit size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(type, p.id, p.name)}
                      title="Delete"
                      style={{
                        padding: '2px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {profiles.length === 0 && (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          No {type} found
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Profile Management</div>
        <button
          onClick={fetchData}
          disabled={loading}
          title="Refresh"
          style={{
            padding: '4px 8px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
          }}
        >
          <RefreshCw size={12} /> {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div style={{
          marginBottom: '12px',
          padding: '8px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '4px',
          color: '#ef4444',
          fontSize: '0.75rem',
        }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
        {(['personas', 'styles', 'feedback'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              backgroundColor: activeTab === tab ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: activeTab === tab ? 'var(--text-inverse)' : 'var(--text-primary)',
              border: activeTab === tab ? 'none' : '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'personas' && renderProfileTable(personas, 'personas')}
      {activeTab === 'styles' && renderProfileTable(styles, 'styles')}
      {activeTab === 'feedback' && feedbackSummary && (
        <div>
          {/* Overall stats */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: '6px',
          }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{feedbackSummary.overall.total}</div>
              <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)' }}>Total</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#22c55e' }}>{feedbackSummary.overall.good}</div>
              <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)' }}>Good</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444' }}>{feedbackSummary.overall.bad}</div>
              <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)' }}>Bad</div>
            </div>
          </div>

          {/* Recent negative feedback */}
          <div style={{ marginBottom: '8px', fontSize: '0.75rem', fontWeight: 600 }}>
            Recent Negative Feedback
          </div>
          {feedbackSummary.recentNegative.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
              No negative feedback yet 🎉
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {feedbackSummary.recentNegative.map((fb, i) => (
                <div
                  key={i}
                  style={{
                    padding: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    borderRadius: '4px',
                    borderLeft: '3px solid #ef4444',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{fb.profile_name}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{fb.feedback_text || 'No comment'}</div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    {fb.user_email} • {new Date(fb.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminProfilesPane;
