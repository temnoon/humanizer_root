import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import {
  analyzeSIC,
  type SICAnalysis,
  type SICCategory,
  type SICPositiveSignals,
  type SICNegativeSignals,
  type SignalScore,
} from '@humanizer/core';
import { BookReader } from './BookReader';
import { Studio } from './Studio';
import { AuthProvider } from './lib/auth';
import { handleOAuthCallback } from './lib/auth/api';

// ═══════════════════════════════════════════════════════════════════
// LEGACY SIC ANALYZER (kept at /analyze)
// ═══════════════════════════════════════════════════════════════════

function AnalyzePage() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<SICAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const navigate = useNavigate();

  const handleAnalyze = async () => {
    if (!text.trim()) return;

    setAnalyzing(true);
    await new Promise(r => setTimeout(r, 100));

    const analysis = analyzeSIC(text);
    setResult(analysis);
    setAnalyzing(false);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <Link to="/" className="app-header__logo">humanizer</Link>
        <nav className="app-header__nav">
          <button
            className="button button--secondary"
            onClick={() => navigate('/book')}
          >
            Read the Book
          </button>
        </nav>
      </header>

      <main className="app-main">
        {!result ? (
          <div className="landing">
            <h1 className="landing__title">SIC Analyzer</h1>
            <p className="landing__subtitle">
              Analyze text for traces of lived constraint—the marks of a mind
              paying the cost of being itself.
            </p>

            <div className="analyze-section">
              <textarea
                className="analyze-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste text to analyze..."
                rows={6}
              />
              <button
                className="button button--primary"
                onClick={handleAnalyze}
                disabled={analyzing || !text.trim()}
              >
                {analyzing ? 'Analyzing...' : 'Analyze SIC'}
              </button>
            </div>

            <blockquote className="landing__quote">
              "We are here to help people find their inner human. Through the
              ability to see words through every lens, and through that, find
              the subjective human inside myself."
            </blockquote>
          </div>
        ) : (
          <div className="result-container">
            <div className="result-header">
              <h2>Analysis Complete</h2>
              <button
                className="button button--secondary"
                onClick={() => setResult(null)}
              >
                Analyze Another
              </button>
            </div>

            <div className="result-score">
              <div className="score-display">
                <span className="score-value">{result.score.toFixed(0)}</span>
                <span className="score-label">/100 SIC Score</span>
              </div>
              <span className={`sic-badge sic-badge--${getCategoryLevel(result.category)}`}>
                {formatCategory(result.category)}
              </span>
            </div>

            <div className="result-interpretation">
              <h3>Interpretation</h3>
              <p>{getInterpretation(result.category)}</p>
            </div>

            <div className="result-signals">
              <h3>Signal Breakdown</h3>
              <div className="signals-grid">
                <SignalGroup title="Positive Signals" signals={result.positive} positive />
                <SignalGroup title="Negative Signals" signals={result.negative} positive={false} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function BookPage() {
  const navigate = useNavigate();

  return (
    <BookReader
      title="Three Threads: A Phenomenological Weave"
      onClose={() => navigate('/')}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════
// AUTH CALLBACK - Handles OAuth redirects
// ═══════════════════════════════════════════════════════════════════

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Handle the OAuth callback (token in URL)
    const result = handleOAuthCallback();
    if (result) {
      // Redirect to home (Studio) after successful auth
      navigate('/', { replace: true });
    } else {
      // No token found, redirect to home anyway
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="auth-callback">
      <p>Signing you in...</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// APP - Routing
// ═══════════════════════════════════════════════════════════════════

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Studio is the default */}
          <Route path="/" element={<Studio />} />

          {/* Auth callback */}
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Book reader */}
          <Route path="/book" element={<BookPage />} />

          {/* Legacy SIC analyzer */}
          <Route path="/analyze" element={<AnalyzePage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function SignalGroup({ title, signals, positive }: {
  title: string;
  signals: SICPositiveSignals | SICNegativeSignals;
  positive: boolean;
}) {
  const entries = Object.entries(signals) as [string, SignalScore][];

  return (
    <div className="signal-group">
      <h4 className={positive ? 'text-success' : 'text-error'}>{title}</h4>
      <div className="signal-list">
        {entries.map(([name, data]) => (
          <div key={name} className="signal-item">
            <span className="signal-name">{formatSignalName(name)}</span>
            <span className="signal-score">{data.raw.toFixed(1)}</span>
            <span className="signal-count">({data.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatSignalName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function getCategoryLevel(category: SICCategory): 'high' | 'medium' | 'low' {
  if (category === 'polished-human' || category === 'raw-human') return 'high';
  if (category === 'messy-low-craft') return 'medium';
  return 'low';
}

function formatCategory(category: SICCategory): string {
  const labels: Record<SICCategory, string> = {
    'polished-human': 'Polished Human',
    'raw-human': 'Raw Human',
    'neat-slop': 'Neat Slop',
    'messy-low-craft': 'Messy Low-Craft',
  };
  return labels[category];
}

function getInterpretation(category: SICCategory): string {
  const interpretations: Record<SICCategory, string> = {
    'polished-human':
      'This text shows strong traces of lived constraint—irreversibility, genuine uncertainty, and embodied stakes. It bears the marks of a mind paying the cost of being itself.',
    'raw-human':
      'This text has authentic human traces but rough edges. The constraint signals are present, but the craft could use refinement. This is often the voice of genuine thought in progress.',
    'neat-slop':
      'This text is suspiciously clean. It resolves tension too easily, covers all angles, and lacks the scar tissue of genuine commitment. The pattern matches LLM output.',
    'messy-low-craft':
      'This text lacks both polish and authentic constraint signals. It may be struggling human writing or degraded/edited AI output.',
  };
  return interpretations[category];
}
