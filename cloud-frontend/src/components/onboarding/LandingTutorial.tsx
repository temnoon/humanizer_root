import { useState } from 'react';
import MailingListModal from './MailingListModal';

interface LandingTutorialProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>; // Temporarily disabled
}

export default function LandingTutorial({ onLogin }: LandingTutorialProps) {
  const [showAuth, setShowAuth] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMailingListModal, setShowMailingListModal] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (showAuth) {
    return (
      <div style={{
        maxWidth: '500px',
        margin: '0 auto',
        paddingTop: 'var(--spacing-2xl)'
      }}>
        <div className="card">
          <h2 style={{ marginBottom: 'var(--spacing-lg)', textAlign: 'center' }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>

          {!isLogin && (
            <div style={{
              padding: 'var(--spacing-md)',
              background: 'rgba(74, 158, 255, 0.1)',
              border: '1px solid var(--accent-cyan)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-lg)'
            }}>
              <div style={{
                fontWeight: 600,
                color: 'var(--accent-cyan)',
                marginBottom: 'var(--spacing-xs)'
              }}>
                Registration Temporarily Disabled
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                marginBottom: 'var(--spacing-md)'
              }}>
                We are currently in the testing phase and not accepting new signups at this time.
                The Narrative Projection Engine is being refined before public release.
              </div>
              <button
                onClick={() => setShowMailingListModal(true)}
                className="btn"
                style={{
                  background: 'var(--accent-cyan)',
                  color: 'white',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  fontSize: '0.875rem',
                }}
              >
                Join Our Mailing List
              </button>
            </div>
          )}

          <form onSubmit={isLogin ? handleAuth : (e) => e.preventDefault()}>
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label style={{
                display: 'block',
                marginBottom: 'var(--spacing-sm)',
                fontWeight: 500
              }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!isLogin}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  opacity: !isLogin ? 0.5 : 1,
                  cursor: !isLogin ? 'not-allowed' : 'text'
                }}
              />
            </div>

            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label style={{
                display: 'block',
                marginBottom: 'var(--spacing-sm)',
                fontWeight: 500
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={!isLogin}
                minLength={8}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  opacity: !isLogin ? 0.5 : 1,
                  cursor: !isLogin ? 'not-allowed' : 'text'
                }}
              />
            </div>

            {error && (
              <div className="error" style={{ marginBottom: 'var(--spacing-lg)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !isLogin}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-md)',
                opacity: (isLoading || !isLogin) ? 0.5 : 1,
                cursor: (isLoading || !isLogin) ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? (
                <>
                  <div className="loading"></div>
                  <span>Logging in...</span>
                </>
              ) : (
                isLogin ? 'Log In' : 'Sign Up (Disabled)'
              )}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                }}
                style={{
                  background: 'none',
                  color: 'var(--accent-purple)',
                  fontSize: '0.875rem'
                }}
              >
                {isLogin ? 'Need an account? Sign up' : 'Have an account? Log in'}
              </button>
            </div>
          </form>

          <div style={{ marginTop: 'var(--spacing-lg)', textAlign: 'center' }}>
            <button
              onClick={() => setShowAuth(false)}
              style={{
                background: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem'
              }}
            >
              ← Back to tutorial
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-2xl)' }}>
        <h1 style={{
          fontSize: '3rem',
          marginBottom: 'var(--spacing-md)',
          background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Transform Your Narratives
        </h1>
        <p style={{
          fontSize: '1.25rem',
          color: 'var(--text-secondary)',
          marginBottom: 'var(--spacing-xl)'
        }}>
          Explore meaning through allegory, translation, and Socratic dialogue
        </p>
        <button
          onClick={() => setShowAuth(true)}
          className="btn btn-primary"
          style={{
            padding: 'var(--spacing-md) var(--spacing-2xl)',
            fontSize: '1.125rem'
          }}
        >
          Get Started
        </button>
      </div>

      {/* Feature Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 'var(--spacing-lg)',
        marginBottom: 'var(--spacing-2xl)'
      }}>
        {/* Allegorical */}
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(139, 122, 216, 0.1), rgba(139, 122, 216, 0.05))',
          borderColor: 'var(--accent-purple)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>🎭</div>
          <h3 style={{ color: 'var(--accent-purple)' }}>Allegorical Projection</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Transform your narrative through fictional universes. Your story retold through
            mythology, quantum physics, corporate dystopia, and more.
          </p>
          <div style={{
            fontSize: '0.875rem',
            color: 'var(--text-tertiary)',
            marginTop: 'var(--spacing-md)'
          }}>
            5 personas × 6 namespaces × 5 styles = 150 unique transformations
          </div>
        </div>

        {/* Round-Trip */}
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(74, 158, 255, 0.1), rgba(74, 158, 255, 0.05))',
          borderColor: 'var(--accent-cyan)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>🔄</div>
          <h3 style={{ color: 'var(--accent-cyan)' }}>Round-Trip Translation</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Discover what meaning survives translation. Analyze semantic drift through
            18 languages and see what's preserved, lost, or gained.
          </p>
          <div style={{
            fontSize: '0.875rem',
            color: 'var(--text-tertiary)',
            marginTop: 'var(--spacing-md)'
          }}>
            Supports: Spanish, French, German, Chinese, Japanese, Arabic, and 12 more
          </div>
        </div>

        {/* Maieutic */}
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.1), rgba(74, 222, 128, 0.05))',
          borderColor: 'var(--accent-green)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>🤔</div>
          <h3 style={{ color: 'var(--accent-green)' }}>Maieutic Dialogue</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Explore through Socratic questioning. Progressively deeper questions
            reveal underlying assumptions and universal themes.
          </p>
          <div style={{
            fontSize: '0.875rem',
            color: 'var(--text-tertiary)',
            marginTop: 'var(--spacing-md)'
          }}>
            5 depth levels: Surface → Motivations → Root → Assumptions → Universal
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="card" style={{ marginBottom: 'var(--spacing-2xl)' }}>
        <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>How It Works</h2>

        <div style={{ display: 'grid', gap: 'var(--spacing-lg)' }}>
          {[
            {
              step: 1,
              title: 'Enter Your Narrative',
              description: 'Paste any text - a story, article, conversation, or personal narrative.'
            },
            {
              step: 2,
              title: 'Choose Your Transformation',
              description: 'Select allegorical projection, round-trip translation, or maieutic dialogue.'
            },
            {
              step: 3,
              title: 'Configure Settings',
              description: 'Pick your persona, namespace, style, or language depending on the transformation type.'
            },
            {
              step: 4,
              title: 'Explore Results',
              description: 'Discover new perspectives, analyze semantic changes, or uncover deeper meanings.'
            }
          ].map(item => (
            <div key={item.step} style={{
              display: 'flex',
              gap: 'var(--spacing-md)',
              alignItems: 'flex-start'
            }}>
              <div style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                background: 'var(--accent-purple)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                flexShrink: 0
              }}>
                {item.step}
              </div>
              <div>
                <h4 style={{ marginBottom: 'var(--spacing-xs)' }}>{item.title}</h4>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={() => setShowAuth(true)}
          className="btn btn-primary"
          style={{
            padding: 'var(--spacing-lg) var(--spacing-2xl)',
            fontSize: '1.25rem'
          }}
        >
          Start Transforming Narratives
        </button>
        <p style={{
          color: 'var(--text-tertiary)',
          fontSize: '0.875rem',
          marginTop: 'var(--spacing-md)'
        }}>
          Currently in testing phase • Limited access
        </p>
      </div>

      {/* Mailing List Modal */}
      <MailingListModal
        isOpen={showMailingListModal}
        onClose={() => setShowMailingListModal(false)}
      />
    </div>
  );
}
