import { useState } from 'react';

interface MailingListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MailingListModal({ isOpen, onClose }: MailingListModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [interestComment, setInterestComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('https://api.humanizer.com/mailing-list/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          interest_comment: interestComment || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to sign up for mailing list');
      }

      setSuccess(true);
      // Reset form after 2 seconds and close
      setTimeout(() => {
        setName('');
        setEmail('');
        setInterestComment('');
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div className="card" style={{
        maxWidth: '500px',
        width: '90%',
        position: 'relative',
      }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 'var(--spacing-md)',
            right: 'var(--spacing-md)',
            background: 'none',
            color: 'var(--text-secondary)',
            fontSize: '1.5rem',
            padding: 0,
            width: '2rem',
            height: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Close"
        >
          ×
        </button>

        <h2 style={{ marginBottom: 'var(--spacing-md)' }}>
          Join Our Mailing List
        </h2>

        {success ? (
          <div style={{
            padding: 'var(--spacing-lg)',
            background: 'rgba(74, 222, 128, 0.1)',
            border: '1px solid var(--accent-green)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '3rem',
              marginBottom: 'var(--spacing-md)',
            }}>✓</div>
            <div style={{
              fontWeight: 600,
              color: 'var(--accent-green)',
              marginBottom: 'var(--spacing-xs)',
            }}>
              Successfully Subscribed!
            </div>
            <div style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
            }}>
              We'll keep you updated on the Narrative Projection Engine launch.
            </div>
          </div>
        ) : (
          <>
            <p style={{
              color: 'var(--text-secondary)',
              marginBottom: 'var(--spacing-lg)',
            }}>
              Get notified when the Narrative Projection Engine launches publicly. We'll send you
              updates on new features and early access opportunities.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--spacing-sm)',
                  fontWeight: 500,
                }}>
                  Name <span style={{ color: 'var(--accent-purple)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your name"
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--spacing-sm)',
                  fontWeight: 500,
                }}>
                  Email <span style={{ color: 'var(--accent-purple)' }}>*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--spacing-sm)',
                  fontWeight: 500,
                }}>
                  Tell us about your interest (optional)
                </label>
                <textarea
                  value={interestComment}
                  onChange={(e) => setInterestComment(e.target.value)}
                  placeholder="What aspects of narrative transformation are you most interested in?"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {error && (
                <div className="error" style={{ marginBottom: 'var(--spacing-lg)' }}>
                  {error}
                </div>
              )}

              <div style={{
                display: 'flex',
                gap: 'var(--spacing-md)',
                justifyContent: 'flex-end',
              }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn"
                  style={{
                    background: 'none',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-primary"
                  style={{
                    opacity: isLoading ? 0.5 : 1,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? (
                    <>
                      <div className="loading"></div>
                      <span>Signing up...</span>
                    </>
                  ) : (
                    'Sign Up'
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
