import { useState } from 'react';
import DeviceManager from './DeviceManager';
import MailingListViewer from './MailingListViewer';
import SiteMetrics from './SiteMetrics';
import UserManagement from './UserManagement';

interface AdminDashboardProps {
  token: string;
  userEmail: string;
  onLogout: () => void;
}

export default function AdminDashboard({ token, userEmail, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'metrics' | 'users' | 'mailing-list' | 'devices'>('metrics');

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: 'var(--spacing-xl)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--spacing-2xl)'
      }}>
        <div>
          <h1 style={{ marginBottom: 'var(--spacing-xs)' }}>Admin Dashboard</h1>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>{userEmail}</span>
            <span style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              background: 'var(--accent-purple)',
              color: 'white',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase'
            }}>
              ADMIN
            </span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="btn"
          style={{
            background: 'none',
            color: 'var(--text-secondary)'
          }}
        >
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-md)',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: 'var(--spacing-xl)',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => setActiveTab('metrics')}
          style={{
            padding: 'var(--spacing-md) var(--spacing-lg)',
            background: 'none',
            color: activeTab === 'metrics' ? 'var(--accent-purple)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'metrics' ? '2px solid var(--accent-purple)' : 'none',
            fontWeight: activeTab === 'metrics' ? 600 : 400,
            marginBottom: '-1px',
            whiteSpace: 'nowrap'
          }}
        >
          📊 Site Metrics
        </button>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: 'var(--spacing-md) var(--spacing-lg)',
            background: 'none',
            color: activeTab === 'users' ? 'var(--accent-purple)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'users' ? '2px solid var(--accent-purple)' : 'none',
            fontWeight: activeTab === 'users' ? 600 : 400,
            marginBottom: '-1px',
            whiteSpace: 'nowrap'
          }}
        >
          👥 Users
        </button>
        <button
          onClick={() => setActiveTab('mailing-list')}
          style={{
            padding: 'var(--spacing-md) var(--spacing-lg)',
            background: 'none',
            color: activeTab === 'mailing-list' ? 'var(--accent-purple)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'mailing-list' ? '2px solid var(--accent-purple)' : 'none',
            fontWeight: activeTab === 'mailing-list' ? 600 : 400,
            marginBottom: '-1px',
            whiteSpace: 'nowrap'
          }}
        >
          📧 Mailing List
        </button>
        <button
          onClick={() => setActiveTab('devices')}
          style={{
            padding: 'var(--spacing-md) var(--spacing-lg)',
            background: 'none',
            color: activeTab === 'devices' ? 'var(--accent-purple)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'devices' ? '2px solid var(--accent-purple)' : 'none',
            fontWeight: activeTab === 'devices' ? 600 : 400,
            marginBottom: '-1px',
            whiteSpace: 'nowrap'
          }}
        >
          🔐 Devices
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'metrics' && (
        <SiteMetrics token={token} />
      )}

      {activeTab === 'users' && (
        <UserManagement token={token} />
      )}

      {activeTab === 'mailing-list' && (
        <MailingListViewer token={token} />
      )}

      {activeTab === 'devices' && (
        <DeviceManager token={token} userEmail={userEmail} />
      )}
    </div>
  );
}
