import { useState } from 'react';
import MailingListModal from './MailingListModal';

interface LandingTutorialProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>; // Temporarily disabled
  onWebAuthnLogin?: (token: string, user: any) => void;
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

          <div style={{
            marginTop: 'var(--spacing-lg)',
            paddingTop: 'var(--spacing-lg)',
            borderTop: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            <div>
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

        {/* Mailing List Modal */}
        <MailingListModal
          isOpen={showMailingListModal}
          onClose={() => setShowMailingListModal(false)}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Announcement Section */}
      <section style={{
        padding: 'var(--spacing-2xl) var(--spacing-lg)',
        background: 'linear-gradient(180deg, rgba(139, 122, 216, 0.05) 0%, rgba(74, 158, 255, 0.05) 100%)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 'var(--spacing-2xl)',
        textAlign: 'center'
      }}>
        <blockquote style={{
          fontSize: '1.25rem',
          fontStyle: 'italic',
          color: 'var(--accent-purple)',
          marginBottom: 'var(--spacing-xl)',
          lineHeight: 1.6
        }}>
          "The world of words is empty enough to change, structured enough to care, and lawful enough to conserve what matters."
        </blockquote>

        <h2 style={{
          fontSize: '2rem',
          fontWeight: 700,
          marginBottom: 'var(--spacing-lg)',
          color: 'var(--text-primary)'
        }}>
          From the Crisis to the Field of Agency
        </h2>

        <p style={{
          fontSize: '1.125rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
          marginBottom: 'var(--spacing-lg)'
        }}>
          When Edmund Husserl warned of the <strong style={{ color: 'var(--text-primary)' }}>Crisis of the European Sciences</strong>,
          he saw a civilization drifting away from lived meaning.
          At <strong style={{ color: 'var(--accent-purple)' }}>Humanizer.com</strong>, we're answering that call —
          not only diagnosing the crisis, but <strong style={{ color: 'var(--text-primary)' }}>building the instrument that heals it</strong>.
        </p>

        <p style={{
          color: 'var(--text-tertiary)',
          marginBottom: 'var(--spacing-lg)',
          lineHeight: 1.7
        }}>
          Humanizer is a <strong style={{ color: 'var(--text-secondary)' }}>phenomenological laboratory</strong> where sentences are treated as the atoms of narrative,
          and the dynamics of meaning can be measured, visualized, and transformed.
          We use the mathematics of quantum mechanics not to reduce thought to physics,
          but because it already describes how any observer resonates with a field of possibilities.
        </p>

        <p style={{
          color: 'var(--text-tertiary)',
          marginBottom: 'var(--spacing-lg)',
          lineHeight: 1.7
        }}>
          Each sentence closes like a measurement: intentions collapse into understanding; meaning becomes visible.
          Our system models this process as a <strong style={{ color: 'var(--text-secondary)' }}>Field of Agency</strong> — where writers, readers, and AI agents share a living field of sense.
        </p>

        <ul style={{
          listStyle: 'none',
          padding: 0,
          marginBottom: 'var(--spacing-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-sm)'
        }}>
          <li style={{ color: 'var(--text-secondary)' }}>
            🜂 <strong>Phenomenology</strong> gives us the method.
          </li>
          <li style={{ color: 'var(--text-secondary)' }}>
            🜁 <strong>Quantum formalism</strong> gives us the grammar.
          </li>
          <li style={{ color: 'var(--text-secondary)' }}>
            🜃 <strong>Humanizer</strong> gives us the tool.
          </li>
        </ul>

        <p style={{
          color: 'var(--text-tertiary)',
          marginBottom: 'var(--spacing-2xl)',
          lineHeight: 1.7
        }}>
          We're finishing internal tests now. Until public accounts open, you can follow the philosophy and progress here.
          If you care about language, consciousness, or the future of meaning itself,
          you're already part of the Field.
        </p>

        <button
          onClick={() => setShowMailingListModal(true)}
          className="btn btn-primary"
          style={{
            background: 'var(--accent-purple)',
            color: 'white',
            fontSize: '1.125rem',
            fontWeight: 600,
            padding: 'var(--spacing-md) var(--spacing-2xl)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 4px 14px rgba(139, 122, 216, 0.4)',
            transition: 'all 0.2s'
          }}
        >
          Join the Field →
        </button>

        <p style={{
          marginTop: 'var(--spacing-xl)',
          fontSize: '0.875rem',
          color: 'var(--text-tertiary)'
        }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Tem Noon</strong> · Founder, Humanizer.com<br />
          <em>A science of meaning for the next renaissance.</em>
        </p>
      </section>

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
          Currently in testing phase • Limited access •{' '}
          <button
            onClick={() => setShowMailingListModal(true)}
            style={{
              background: 'none',
              color: 'var(--accent-cyan)',
              fontSize: '0.875rem',
              textDecoration: 'underline',
              padding: 0
            }}
          >
            Join our mailing list
          </button>
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
