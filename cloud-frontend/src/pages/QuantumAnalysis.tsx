import { useState, useEffect } from 'react';
import { cloudAPI } from '../lib/cloud-api-client';
import { TetralemmaViz } from '../components/quantum/TetralemmaViz';
import { DensityMatrixStats } from '../components/quantum/DensityMatrixStats';
import { NarrativePane } from '../components/quantum/NarrativePane';
import { MeasurementHistoryTable } from '../components/quantum/MeasurementHistoryTable';

interface QuantumSession {
  session_id: string;
  total_sentences: number;
  sentences: string[];
  initial_rho: {
    purity: number;
    entropy: number;
    top_eigenvalues: number[];
  };
}

interface Measurement {
  sentence_index: number;
  sentence: string;
  measurement: {
    literal: { probability: number; evidence: string };
    metaphorical: { probability: number; evidence: string };
    both: { probability: number; evidence: string };
    neither: { probability: number; evidence: string };
  };
  rho_before: {
    purity: number;
    entropy: number;
    top_eigenvalues: number[];
  };
  rho_after: {
    purity: number;
    entropy: number;
    top_eigenvalues: number[];
  };
  done: boolean;
}

export default function QuantumAnalysis() {
  const [text, setText] = useState('');
  const [session, setSession] = useState<QuantumSession | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const currentSentenceIndex = measurements.length;
  const isComplete = session && currentSentenceIndex >= session.total_sentences;

  const handleStartAnalysis = async () => {
    if (!text.trim()) {
      setError('Please enter some text to analyze');
      return;
    }

    setLoading(true);
    setError('');
    setMeasurements([]);

    try {
      const response = await cloudAPI.startQuantumAnalysis(text);
      setSession(response as QuantumSession);
    } catch (err) {
      setError('Failed to start quantum analysis');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNextSentence = async () => {
    if (!session) return;

    setProcessing(true);
    setError('');

    try {
      const response = await cloudAPI.quantumAnalysisStep(session.session_id);
      const measurement = response as Measurement;

      setMeasurements([...measurements, measurement]);

      if (measurement.done) {
        // All sentences processed
        console.log('Quantum reading analysis complete!');
      }
    } catch (err) {
      setError('Failed to process sentence');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setSession(null);
    setMeasurements([]);
    setText('');
    setError('');
    setLoading(false);
    setProcessing(false);
  };

  // Keyboard shortcuts for next sentence
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if session is active, not complete, and not processing
      if (session && !isComplete && !processing) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'Enter') {
          // Don't trigger if user is typing in textarea
          if (document.activeElement?.tagName === 'TEXTAREA') {
            return;
          }
          e.preventDefault();
          handleNextSentence();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session, isComplete, processing, handleNextSentence]);

  return (
    <div style={{
      minHeight: '100%',
      background: 'var(--bg-primary)',
      padding: 'var(--spacing-xl) var(--spacing-md)'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div className="text-center" style={{ marginBottom: 'var(--spacing-2xl)' }}>
          <h1 style={{
            fontSize: 'var(--text-4xl)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-md)'
          }}>
            ⚛️ Quantum Reading Analysis
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-lg)',
            maxWidth: '800px',
            margin: '0 auto',
            lineHeight: 1.6
          }}>
            Watch how a "blank slate" density matrix evolves sentence-by-sentence,
            forming a specific understanding through quantum measurement
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error" style={{ marginBottom: 'var(--spacing-lg)' }}>
            {error}
          </div>
        )}

        {/* Input Section */}
        {!session && (
          <div className="card" style={{
            padding: 'var(--spacing-xl)',
            marginBottom: 'var(--spacing-2xl)',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <label style={{
              display: 'block',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-xl)',
              fontWeight: 700,
              marginBottom: 'var(--spacing-md)'
            }}>
              Enter Text to Analyze
            </label>
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
              marginBottom: 'var(--spacing-md)',
              lineHeight: 1.6
            }}>
              Paste any text below. The quantum analysis will process it sentence-by-sentence,
              revealing how meaning crystallizes through measurement.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{
                width: '100%',
                minHeight: '300px',
                padding: 'var(--spacing-md)',
                background: 'var(--bg-tertiary)',
                border: '2px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-base)',
                fontFamily: 'var(--font-sans)',
                resize: 'vertical',
                lineHeight: 1.6
              }}
              placeholder={`Paste your text here...

The quantum analysis will process it sentence by sentence, showing how meaning emerges from measurement.

Try pasting a paragraph or two to see how the density matrix evolves!`}
              rows={12}
            />
            {text.length > 0 && (
              <div style={{
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                marginTop: 'var(--spacing-sm)'
              }}>
                {text.length} characters • {text.split(/[.!?]+/).filter(s => s.trim()).length} sentences
              </div>
            )}
            <div style={{ marginTop: 'var(--spacing-lg)' }}>
              <button
                onClick={handleStartAnalysis}
                disabled={loading || !text.trim()}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: 'var(--spacing-md) var(--spacing-xl)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 600,
                  opacity: (loading || !text.trim()) ? 0.5 : 1,
                  cursor: (loading || !text.trim()) ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '⏳ Initializing...' : '🚀 Start Quantum Analysis'}
              </button>
            </div>
          </div>
        )}

        {/* Split-Pane Layout: Active Session */}
        {session && (
          <div>
            {isComplete && (
              <div className="success" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <p className="text-center" style={{ fontWeight: 600 }}>
                  ✓ Analysis Complete! All {session.total_sentences} sentences processed.
                </p>
              </div>
            )}

            {/* Split Panes: Narrative + Analysis */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
              gap: 'var(--spacing-lg)',
              alignItems: 'start',
              height: 'calc(100vh - 300px)',
              minHeight: '500px'
            }}>
              {/* Left Pane: Narrative with highlighted sentences */}
              <NarrativePane
                sentences={session.sentences}
                currentIndex={currentSentenceIndex}
                totalSentences={session.total_sentences}
                onReset={handleReset}
              />

              {/* Right Pane: Current Analysis + History */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-lg)',
                height: '100%',
                overflow: 'auto',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                padding: 'var(--spacing-lg)'
              }}>
                {/* Next Sentence Button - Sticky at top */}
                {!isComplete && (
                  <div style={{
                    position: 'sticky',
                    top: 0,
                    background: 'var(--bg-secondary)',
                    paddingBottom: 'var(--spacing-md)',
                    marginBottom: 'var(--spacing-md)',
                    zIndex: 1,
                    borderBottom: '1px solid var(--border-color)'
                  }}>
                    <button
                      onClick={handleNextSentence}
                      disabled={processing}
                      className="btn"
                      style={{
                        width: '100%',
                        padding: 'var(--spacing-md) var(--spacing-lg)',
                        background: 'var(--accent-green)',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: 'var(--text-base)',
                        opacity: processing ? 0.5 : 1,
                        cursor: processing ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {processing ? '⏳ Processing...' : '▶ Next Sentence (↓ or →)'}
                    </button>
                  </div>
                )}
                {/* Current Sentence Analysis */}
                {measurements.length > 0 && (
                  <div style={{
                    padding: 'var(--spacing-md) 0'
                  }}>
                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                      <h3 style={{
                        fontSize: 'var(--text-lg)',
                        fontWeight: 600,
                        color: 'var(--accent-purple)',
                        marginBottom: 'var(--spacing-xs)'
                      }}>
                        Current: Sentence {measurements[measurements.length - 1].sentence_index + 1}
                      </h3>
                      <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: 'var(--text-sm)',
                        fontStyle: 'italic'
                      }}>
                        "{measurements[measurements.length - 1].sentence}"
                      </p>
                    </div>

                    <TetralemmaViz measurement={measurements[measurements.length - 1].measurement} />

                    <div style={{ marginTop: 'var(--spacing-lg)' }}>
                      <div style={{
                        background: 'rgba(52, 211, 153, 0.1)',
                        border: '1px solid var(--accent-green)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--spacing-md)'
                      }}>
                        <h4 style={{
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                          marginBottom: 'var(--spacing-md)',
                          fontSize: 'var(--text-sm)'
                        }}>
                          Density Matrix (ρ)
                        </h4>
                        <DensityMatrixStats
                          purity={measurements[measurements.length - 1].rho_after.purity}
                          entropy={measurements[measurements.length - 1].rho_after.entropy}
                          topEigenvalues={measurements[measurements.length - 1].rho_after.top_eigenvalues}
                        />
                        <div style={{
                          marginTop: 'var(--spacing-sm)',
                          color: 'var(--accent-green)',
                          fontSize: 'var(--text-sm)'
                        }}>
                          Δ Purity: +{(
                            measurements[measurements.length - 1].rho_after.purity -
                            measurements[measurements.length - 1].rho_before.purity
                          ).toFixed(4)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Initial State (before any measurements) */}
                {measurements.length === 0 && (
                  <div style={{
                    padding: 'var(--spacing-md) 0'
                  }}>
                    <h3 style={{
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      marginBottom: 'var(--spacing-md)',
                      fontSize: 'var(--text-lg)'
                    }}>
                      Initial State (ρ₀)
                    </h3>
                    <DensityMatrixStats
                      purity={session.initial_rho.purity}
                      entropy={session.initial_rho.entropy}
                      topEigenvalues={session.initial_rho.top_eigenvalues}
                      label="Maximally Mixed"
                    />
                    <p style={{
                      color: 'var(--text-secondary)',
                      fontSize: 'var(--text-sm)',
                      marginTop: 'var(--spacing-md)',
                      fontStyle: 'italic'
                    }}>
                      Starting from complete uncertainty - a "blank slate" ready to form understanding
                    </p>
                  </div>
                )}

                {/* Measurement History Table */}
                {measurements.length > 1 && (
                  <div style={{
                    padding: 'var(--spacing-md) 0',
                    borderTop: '1px solid var(--border-color)',
                    marginTop: 'var(--spacing-lg)',
                    paddingTop: 'var(--spacing-lg)'
                  }}>
                    <MeasurementHistoryTable
                      measurements={measurements.slice(0, -1)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
