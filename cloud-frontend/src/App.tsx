import { useState, useEffect } from 'react';
import { cloudAPI } from './lib/cloud-api-client';
import AllegoricalForm from './components/transformations/AllegoricalForm';
import RoundTripForm from './components/transformations/RoundTripForm';
import MaieuticForm from './components/transformations/MaieuticForm';
import LandingTutorial from './components/onboarding/LandingTutorial';
import HelpPanel from './components/help/HelpPanel';
import AdminDashboard from './components/admin/AdminDashboard';
import type { User } from '../../workers/shared/types';

type View = 'landing' | 'allegorical' | 'round-trip' | 'maieutic' | 'admin';

function App() {
  const [currentView, setCurrentView] = useState<View>('landing');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = cloudAPI.getToken();
      if (token) {
        try {
          const currentUser = await cloudAPI.getCurrentUser();
          setUser(currentUser as User);
        } catch (error) {
          // Token invalid, clear it
          cloudAPI.clearToken();
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await cloudAPI.login(email, password);
      setUser(response.user);
      setCurrentView('allegorical');
    } catch (error) {
      throw error;
    }
  };

  const handleRegister = async (email: string, password: string) => {
    try {
      const response = await cloudAPI.register(email, password);
      setUser(response.user);
      setCurrentView('allegorical');
    } catch (error) {
      throw error;
    }
  };

  const handleWebAuthnLogin = (token: string, userData: User) => {
    cloudAPI.setToken(token);
    setUser(userData);
    // If admin, go to admin dashboard; otherwise go to allegorical
    setCurrentView(userData.role === 'admin' ? 'admin' : 'allegorical');
  };

  const handleLogout = () => {
    cloudAPI.logout();
    setUser(null);
    setCurrentView('landing');
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
        <div className="loading" style={{ width: '2rem', height: '2rem' }}></div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: 'var(--spacing-md) var(--spacing-lg)'
      }}>
        <div className="container" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h1 style={{
            fontSize: '1.5rem',
            margin: 0,
            background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Narrative Projection Engine
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            {user && (
              <>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  {user.email}
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowHelp(!showHelp)}
                  style={{ padding: 'var(--spacing-xs) var(--spacing-md)' }}
                >
                  {showHelp ? 'Close Help' : 'Help'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleLogout}
                  style={{ padding: 'var(--spacing-xs) var(--spacing-md)' }}
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Navigation (if logged in) */}
      {user && (
        <nav style={{
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          padding: 'var(--spacing-sm) 0'
        }}>
          <div className="container" style={{
            display: 'flex',
            gap: 'var(--spacing-sm)',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              {(['allegorical', 'round-trip', 'maieutic'] as View[]).map(view => (
                <button
                  key={view}
                  className="btn"
                  onClick={() => setCurrentView(view)}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    background: currentView === view ? 'var(--accent-purple)' : 'transparent',
                    color: currentView === view ? 'white' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  {view === 'allegorical' && '🎭 Allegorical'}
                  {view === 'round-trip' && '🔄 Round-Trip'}
                  {view === 'maieutic' && '🤔 Maieutic'}
                </button>
              ))}
            </div>
            {user.role === 'admin' && (
              <button
                className="btn"
                onClick={() => setCurrentView('admin')}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-md)',
                  background: currentView === 'admin' ? 'var(--accent-purple)' : 'transparent',
                  color: currentView === 'admin' ? 'white' : 'var(--accent-purple)',
                  borderRadius: 'var(--radius-sm)',
                  border: currentView === 'admin' ? 'none' : '1px solid var(--accent-purple)'
                }}
              >
                ⚙️ Admin
              </button>
            )}
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main style={{
        flex: 1,
        padding: currentView === 'admin' ? 0 : 'var(--spacing-xl) 0'
      }}>
        {currentView === 'admin' && user ? (
          <AdminDashboard
            token={cloudAPI.getToken() || ''}
            userEmail={user.email}
            onLogout={handleLogout}
          />
        ) : (
          <div className="container">
            {showHelp ? (
              <HelpPanel onClose={() => setShowHelp(false)} />
            ) : currentView === 'landing' ? (
              <LandingTutorial
                onLogin={handleLogin}
                onRegister={handleRegister}
                onWebAuthnLogin={handleWebAuthnLogin}
              />
            ) : currentView === 'allegorical' ? (
              <AllegoricalForm />
            ) : currentView === 'round-trip' ? (
              <RoundTripForm />
            ) : currentView === 'maieutic' ? (
              <MaieuticForm />
            ) : null}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        padding: 'var(--spacing-lg)',
        textAlign: 'center',
        color: 'var(--text-tertiary)',
        fontSize: '0.875rem'
      }}>
        <div className="container">
          <p style={{ margin: 0 }}>
            Narrative Projection Engine © 2025 • Transform narratives through allegory, translation, and dialogue
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
