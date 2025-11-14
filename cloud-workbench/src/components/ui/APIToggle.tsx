import { useState, useEffect } from 'react';
import { ApiConfig, type ProcessingTarget } from '../../core/adapters/api';
import { LoginModal } from '../auth/LoginModal';
import { useAuth } from '../../core/context/AuthContext';

/**
 * APIToggle - UI component to switch between local and remote API backends
 *
 * Features:
 * - Dropdown to select "Local (FastAPI)" or "Remote (Cloud)"
 * - Connection status indicator
 * - Persists choice to localStorage
 * - Auto-detect local API health
 */

export function APIToggle() {
  const { isAuthenticated, user, logout } = useAuth();
  const [target, setTarget] = useState<ProcessingTarget>(ApiConfig.processingTarget);
  const [localHealthy, setLocalHealthy] = useState<boolean | null>(null);
  const [remoteHealthy, setRemoteHealthy] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Check backend health on mount and when target changes
  useEffect(() => {
    checkHealth();
  }, [target]);

  const checkHealth = async () => {
    setChecking(true);

    // ONLY check local API if we're actually running on localhost
    // Cloud deployments should NEVER check localhost:8000
    const isLocalDeployment = window.location.hostname === 'localhost' ||
                              window.location.hostname === '127.0.0.1';

    if (isLocalDeployment) {
      // Check local API only when running on localhost
      try {
        const localResponse = await fetch(`${ApiConfig.baseUrlLocal}/`, {
          method: 'GET',
          signal: AbortSignal.timeout(2000), // 2 second timeout
        });
        setLocalHealthy(localResponse.ok);
      } catch {
        setLocalHealthy(false);
      }
    } else {
      // Cloud deployment - skip localhost check entirely
      setLocalHealthy(null); // null = not applicable
    }

    // Always check remote API
    try {
      const remoteResponse = await fetch(`${ApiConfig.baseUrlRemote}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });
      setRemoteHealthy(remoteResponse.ok);
    } catch {
      setRemoteHealthy(false);
    }

    setChecking(false);
  };

  const handleSwitch = (newTarget: ProcessingTarget) => {
    setTarget(newTarget);
    localStorage.setItem('processingTarget', newTarget);
    ApiConfig.setProcessingTarget(newTarget);
  };

  const getCurrentStatus = () => {
    if (checking) return '⏳ Checking...';

    if (target === 'local') {
      if (localHealthy === null) return '❓ Unknown';
      return localHealthy ? '✅ Connected' : '❌ Offline';
    } else {
      if (remoteHealthy === null) return '❓ Unknown';
      if (!remoteHealthy) return '❌ Offline';

      // Check if authenticated for remote
      const token = localStorage.getItem('auth_token');
      return token ? '✅ Connected' : '⚠️ Not Authenticated';
    }
  };

  const getStatusColor = () => {
    const status = getCurrentStatus();
    if (status.includes('✅')) return 'text-green-400';
    if (status.includes('❌')) return 'text-red-400';
    if (status.includes('⚠️')) return 'text-yellow-400';
    return 'text-slate-400';
  };

  return (
    <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0">
      {/* Target Selector - Hidden on small mobile, icon-only on mobile */}
      <select
        value={target}
        onChange={(e) => handleSwitch(e.target.value as ProcessingTarget)}
        className="hidden sm:block rounded bg-slate-700 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-100 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="remote">🌐 Remote</option>
        <option value="local">💻 Local</option>
      </select>

      {/* Status Indicator - Simplified on mobile */}
      <div className="flex items-center gap-1 sm:gap-2">
        <span className={`text-xs sm:text-sm ${getStatusColor()} hidden sm:inline`}>
          {getCurrentStatus()}
        </span>
        {/* Mobile: Show only status emoji */}
        <span className={`text-xs sm:hidden ${getStatusColor()}`}>
          {getCurrentStatus().split(' ')[0]}
        </span>
        <button
          onClick={checkHealth}
          disabled={checking}
          className="rounded bg-slate-700 px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-50"
          title="Refresh connection status"
        >
          🔄
        </button>
      </div>

      {/* Login/Logout Button for Remote Mode */}
      {target === 'remote' && remoteHealthy && (
        <>
          {isAuthenticated && user ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xs text-slate-400 hidden md:inline truncate max-w-[120px]">
                {user.email}
              </span>
              <button
                onClick={logout}
                className="rounded bg-slate-700 px-2 sm:px-3 py-1 text-xs text-slate-300 hover:bg-slate-600"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="rounded bg-indigo-600 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white hover:bg-indigo-500"
            >
              Login
            </button>
          )}
        </>
      )}

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          checkHealth(); // Refresh status after login
        }}
        canDismiss={true}
      />
    </div>
  );
}
