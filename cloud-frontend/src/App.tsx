import { useState, useEffect } from 'react';
import { cloudAPI } from './lib/cloud-api-client';
import AllegoricalForm from './components/transformations/AllegoricalForm';
import RoundTripForm from './components/transformations/RoundTripForm';
import MaieuticForm from './components/transformations/MaieuticForm';
import LandingTutorial from './components/onboarding/LandingTutorial';
import HelpPanel from './components/help/HelpPanel';
import AdminDashboard from './components/admin/AdminDashboard';
import QuantumAnalysis from './pages/QuantumAnalysis';
import type { User } from '../../workers/shared/types';

type View = 'landing' | 'allegorical' | 'round-trip' | 'maieutic' | 'quantum-analysis' | 'admin';

function App() {
  const [currentView, setCurrentView] = useState<View>('landing');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

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
      <div className="flex items-center" style={{
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-primary)'
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
        padding: 'var(--spacing-md) var(--spacing-lg)',
        flexShrink: 0
      }}>
        <div className="container flex items-center justify-between">
          <h1 style={{
            fontSize: 'var(--text-2xl)',
            margin: 0,
            background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 700
          }}>
            Narrative Projection Engine
          </h1>

          <div className="flex items-center gap-md">
            {user && (
              <>
                <span style={{
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--text-sm)'
                }}>
                  {user.email}
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={toggleTheme}
                  style={{ padding: 'var(--spacing-xs) var(--spacing-md)' }}
                  title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                  {theme === 'dark' ? '☀️' : '🌙'}
                </button>
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
          padding: 'var(--spacing-sm) 0',
          flexShrink: 0
        }}>
          <div className="container flex justify-between items-center" style={{
            gap: 'var(--spacing-sm)',
            flexWrap: 'wrap'
          }}>
            <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
              {(['allegorical', 'round-trip', 'maieutic', 'quantum-analysis'] as View[]).map(view => (
                <button
                  key={view}
                  className="btn"
                  onClick={() => setCurrentView(view)}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    background: currentView === view ? 'var(--accent-purple)' : 'transparent',
                    color: currentView === view ? 'white' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-sm)',
                    transition: 'all 0.2s'
                  }}
                >
                  {view === 'allegorical' && '🎭 Allegorical'}
                  {view === 'round-trip' && '🔄 Round-Trip'}
                  {view === 'maieutic' && '🤔 Maieutic'}
                  {view === 'quantum-analysis' && '⚛️ Quantum Reading'}
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
                  border: currentView === 'admin' ? 'none' : '1px solid var(--accent-purple)',
                  fontSize: 'var(--text-sm)',
                  transition: 'all 0.2s'
                }}
              >
                ⚙️ Admin
              </button>
            )}
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="scrollable-pane">
        {currentView === 'admin' && user ? (
          <AdminDashboard
            token={cloudAPI.getToken() || ''}
            userEmail={user.email}
            onLogout={handleLogout}
          />
        ) : currentView === 'quantum-analysis' ? (
          <QuantumAnalysis />
        ) : (
          <div className="content-wrapper">
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
        fontSize: 'var(--text-sm)',
        flexShrink: 0
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
