import { useState, useEffect } from 'react';
import { cloudAPI } from './lib/cloud-api-client';
import AllegoricalForm from './components/transformations/AllegoricalForm';
import RoundTripForm from './components/transformations/RoundTripForm';
import MaieuticForm from './components/transformations/MaieuticForm';
import PersonalizerForm from './components/transformations/PersonalizerForm';
import AIDetectorPanel from './components/transformations/AIDetectorPanel';
import VoiceManager from './components/personalizer/VoiceManager';
import LandingTutorial from './components/onboarding/LandingTutorial';
import HelpPanel from './components/help/HelpPanel';
import AdminDashboard from './components/admin/AdminDashboard';
import QuantumAnalysis from './pages/QuantumAnalysis';
import type { User } from '../../workers/shared/types';

type View = 'landing' | 'allegorical' | 'round-trip' | 'maieutic' | 'personalizer' | 'ai-detector' | 'voice-manager' | 'quantum-analysis' | 'admin';

function App() {
  const [currentView, setCurrentView] = useState<View>('landing');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Check localStorage first (user preference override)
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }

    // Fall back to system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  // Apply theme to document and save preference
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Listen for system theme changes (only if user hasn't manually set theme)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-update if user hasn't manually set a preference recently
      const lastManualChange = localStorage.getItem('theme-manual-timestamp');
      const oneHourAgo = Date.now() - (60 * 60 * 1000);

      if (!lastManualChange || parseInt(lastManualChange) < oneHourAgo) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
    // Mark as manual change to prevent auto-switching for 1 hour
    localStorage.setItem('theme-manual-timestamp', Date.now().toString());
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
        <div className="container" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--spacing-md)'
        }}>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              // Navigate to appropriate home based on auth status
              setCurrentView(user ? 'allegorical' : 'landing');
            }}
            style={{
              fontSize: 'var(--text-2xl)',
              margin: 0,
              background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 700,
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            title={user ? 'Go to Allegorical Transform' : 'Go to Home'}
          >
            humanizer.com
          </a>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            flexWrap: 'wrap'
          }}>
            {user && (
              <>
                <span style={{
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--text-sm)',
                  whiteSpace: 'nowrap'
                }}>
                  {user.email}
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={toggleTheme}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    whiteSpace: 'nowrap'
                  }}
                  title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? '☀️' : '🌙'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowHelp(!showHelp)}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {showHelp ? 'Close Help' : 'Help'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleLogout}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    whiteSpace: 'nowrap'
                  }}
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
              {(['allegorical', 'round-trip', 'maieutic', 'personalizer', 'ai-detector', 'quantum-analysis'] as View[]).map(view => (
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
                  {view === 'personalizer' && '🎨 Personalizer'}
                  {view === 'ai-detector' && '🔍 AI Detector'}
                  {view === 'quantum-analysis' && '⚛️ Quantum Reading'}
                </button>
              ))}
            </div>
            <button
              className="btn"
              onClick={() => setCurrentView('voice-manager')}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-md)',
                background: currentView === 'voice-manager' ? 'var(--accent-cyan)' : 'transparent',
                color: currentView === 'voice-manager' ? 'white' : 'var(--accent-cyan)',
                borderRadius: 'var(--radius-sm)',
                border: currentView === 'voice-manager' ? 'none' : '1px solid var(--accent-cyan)',
                fontSize: 'var(--text-sm)',
                transition: 'all 0.2s'
              }}
            >
              🎭 Manage Voices
            </button>
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
        ) : currentView === 'voice-manager' ? (
          <div className="content-wrapper">
            <VoiceManager />
          </div>
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
            ) : currentView === 'personalizer' ? (
              <PersonalizerForm />
            ) : currentView === 'ai-detector' ? (
              <AIDetectorPanel />
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
