import { useState } from 'react';
import { cloudAPI } from '../../lib/cloud-api-client';
import type { MaieuticRespondResponse } from '../../../../workers/shared/types';
import InputCopyButton from '../InputCopyButton';
import { useWakeLock } from '../../hooks/useWakeLock';

interface DialogueTurn {
  question: string;
  answer: string;
  insights: string[];
  depth_level: number;
}

export default function MaieuticForm() {
  const [text, setText] = useState('');
  const [goal, setGoal] = useState('understand');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [depthLevel, setDepthLevel] = useState(0);
  const [turns, setTurns] = useState<DialogueTurn[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [finalUnderstanding, setFinalUnderstanding] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wake Lock: Keep screen awake during dialogue (5 min max for battery safety)
  useWakeLock(isLoading, { maxDuration: 5 * 60 * 1000, debug: false });

  const depthLabels = [
    'Surface Level',
    'Underlying Motivations',
    'Root Causes',
    'Assumptions & Worldview',
    'Universal & Archetypal'
  ];

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await cloudAPI.startMaieuticDialogue(text, goal);
      setSessionId(response.session_id);
      setCurrentQuestion(response.question);
      setDepthLevel(response.depth_level);
      setTurns([]);
      setIsComplete(false);
      setFinalUnderstanding(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start dialogue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRespond = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !currentQuestion || !currentAnswer.trim()) return;

    setError(null);
    setIsLoading(true);

    try {
      const response: MaieuticRespondResponse = await cloudAPI.respondToMaieuticQuestion(
        sessionId,
        currentAnswer
      );

      // Add current turn to history
      setTurns(prev => [...prev, {
        question: currentQuestion,
        answer: currentAnswer,
        insights: response.insights,
        depth_level: depthLevel
      }]);

      // Update state
      setCurrentAnswer('');

      if (response.is_complete) {
        setIsComplete(true);
        setFinalUnderstanding(response.final_understanding || null);
        setCurrentQuestion(null);
      } else {
        setCurrentQuestion(response.question || null);
        setDepthLevel(response.depth_level);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to continue dialogue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSessionId(null);
    setCurrentQuestion(null);
    setCurrentAnswer('');
    setDepthLevel(0);
    setTurns([]);
    setIsComplete(false);
    setFinalUnderstanding(null);
    setError(null);
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h2>🤔 Maieutic Dialogue</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Explore your narrative through Socratic questioning. Through a series of progressively deeper questions,
          we'll uncover the underlying meanings, assumptions, and universal themes in your text.
        </p>
      </div>

      {/* Initial Setup Form */}
      {!sessionId && !isComplete && (
        <form onSubmit={handleStart} style={{ marginBottom: 'var(--spacing-2xl)' }}>
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-sm)'
            }}>
              <label style={{
                fontWeight: 500
              }}>
                Narrative Text
              </label>
              <InputCopyButton text={text} label="Copy Input" />
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your narrative here..."
              required
              style={{
                width: '100%',
                minHeight: '150px',
                padding: 'var(--spacing-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                resize: 'vertical'
              }}
            />
            <div style={{
              fontSize: '0.875rem',
              color: 'var(--text-tertiary)',
              marginTop: 'var(--spacing-xs)'
            }}>
              {text.length} / 5,000 characters
            </div>
          </div>

          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-sm)',
              fontWeight: 500
            }}>
              Dialogue Goal
            </label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)'
              }}
            >
              <option value="understand">Understand</option>
              <option value="clarify">Clarify</option>
              <option value="discover">Discover</option>
              <option value="question">Question</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading || !text.trim()}
            className="btn btn-primary"
            style={{
              padding: 'var(--spacing-md) var(--spacing-xl)',
              fontSize: '1.125rem',
              opacity: (isLoading || !text.trim()) ? 0.5 : 1,
              cursor: (isLoading || !text.trim()) ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? (
              <>
                <div className="loading"></div>
                <span>Starting...</span>
              </>
            ) : (
              'Begin Dialogue'
            )}
          </button>
        </form>
      )}

      {/* Error */}
      {error && (
        <div className="error" style={{ marginBottom: 'var(--spacing-lg)' }}>
          {error}
        </div>
      )}

      {/* Dialogue History */}
      {turns.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Dialogue History</h3>

          {turns.map((turn, i) => (
            <div key={i} className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 'var(--spacing-sm)'
              }}>
                <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                  Turn {i + 1}
                </span>
                <span style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-tertiary)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  Depth: {depthLabels[turn.depth_level]}
                </span>
              </div>

              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <div style={{ fontWeight: 500, color: 'var(--accent-yellow)', marginBottom: 'var(--spacing-xs)' }}>
                  Question:
                </div>
                <p style={{ marginBottom: 0 }}>{turn.question}</p>
              </div>

              <div style={{ marginBottom: turn.insights.length > 0 ? 'var(--spacing-md)' : 0 }}>
                <div style={{ fontWeight: 500, color: 'var(--accent-green)', marginBottom: 'var(--spacing-xs)' }}>
                  Your Response:
                </div>
                <p style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{turn.answer}</p>
              </div>

              {turn.insights.length > 0 && (
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--accent-purple)', marginBottom: 'var(--spacing-xs)' }}>
                    Insights:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)' }}>
                    {turn.insights.map((insight, j) => (
                      <li key={j} style={{ marginBottom: 'var(--spacing-xs)', color: 'var(--text-secondary)' }}>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Current Question */}
      {sessionId && currentQuestion && !isComplete && (
        <form onSubmit={handleRespond} style={{ marginBottom: 'var(--spacing-2xl)' }}>
          <div className="card" style={{
            background: 'linear-gradient(135deg, rgba(139, 122, 216, 0.1), rgba(74, 158, 255, 0.1))',
            borderColor: 'var(--accent-purple)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--spacing-md)'
            }}>
              <h4 style={{ margin: 0, color: 'var(--accent-cyan)' }}>
                Current Question
              </h4>
              <span style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                background: 'var(--bg-secondary)',
                padding: '0.25rem 0.5rem',
                borderRadius: 'var(--radius-sm)'
              }}>
                Depth: {depthLabels[depthLevel]}
              </span>
            </div>

            <p style={{
              fontSize: '1.125rem',
              marginBottom: 'var(--spacing-lg)',
              color: 'var(--accent-yellow)'
            }}>
              {currentQuestion}
            </p>

            <textarea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="Your response..."
              required
              style={{
                width: '100%',
                minHeight: '120px',
                padding: 'var(--spacing-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                resize: 'vertical',
                marginBottom: 'var(--spacing-md)'
              }}
            />

            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
              <button
                type="submit"
                disabled={isLoading || !currentAnswer.trim()}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  opacity: (isLoading || !currentAnswer.trim()) ? 0.5 : 1,
                  cursor: (isLoading || !currentAnswer.trim()) ? 'not-allowed' : 'pointer'
                }}
              >
                {isLoading ? (
                  <>
                    <div className="loading"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  'Continue Dialogue'
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="btn btn-secondary"
              >
                End Dialogue
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Final Understanding */}
      {isComplete && finalUnderstanding && (
        <div style={{ marginTop: 'var(--spacing-2xl)' }}>
          <div className="success" style={{ marginBottom: 'var(--spacing-lg)' }}>
            Dialogue Complete
          </div>

          <div className="card" style={{
            background: 'linear-gradient(135deg, rgba(139, 122, 216, 0.15), rgba(74, 158, 255, 0.15))',
            borderColor: 'var(--accent-purple)'
          }}>
            <h3 style={{ color: 'var(--accent-cyan)', marginBottom: 'var(--spacing-md)' }}>
              Emergent Understanding
            </h3>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '1.125rem' }}>
              {finalUnderstanding}
            </p>
          </div>

          <div style={{ marginTop: 'var(--spacing-lg)' }}>
            <button
              onClick={handleReset}
              className="btn btn-primary"
            >
              Start New Dialogue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
