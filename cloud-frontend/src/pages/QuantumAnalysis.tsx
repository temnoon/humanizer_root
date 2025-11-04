import { useState } from 'react';
import { cloudAPI } from '../lib/cloud-api-client';
import { TetralemmaViz } from '../components/quantum/TetralemmaViz';
import { DensityMatrixStats } from '../components/quantum/DensityMatrixStats';

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
  };

  const currentSentenceIndex = measurements.length;
  const isComplete = session && currentSentenceIndex >= session.total_sentences;

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

        {/* Session Info */}
        {session && (
          <div className="card" style={{
            padding: 'var(--spacing-xl)',
            boxShadow: 'var(--shadow-lg)',
            marginBottom: 'var(--spacing-xl)'
          }}>
            <div className="flex justify-between items-center" style={{
              marginBottom: 'var(--spacing-lg)',
              flexWrap: 'wrap',
              gap: 'var(--spacing-md)'
            }}>
              <div>
                <h2 style={{
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--spacing-sm)'
                }}>
                  Analysis Session
                </h2>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Progress: {currentSentenceIndex} / {session.total_sentences} sentences
                </p>
              </div>
              <button
                onClick={handleReset}
                className="btn"
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  background: 'var(--accent-red)',
                  color: 'white'
                }}
              >
                Reset
              </button>
            </div>

            {/* Initial State */}
            {measurements.length === 0 && (
              <div style={{
                background: 'var(--accent-purple-alpha-10)',
                border: '1px solid var(--accent-purple)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-md)'
              }}>
                <h3 style={{
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  marginBottom: 'var(--spacing-sm)'
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
                  marginTop: 'var(--spacing-sm)'
                }}>
                  Starting from complete uncertainty - a "blank slate" ready to form understanding
                </p>
              </div>
            )}

            {/* Progress Button */}
            {!isComplete && (
              <button
                onClick={handleNextSentence}
                disabled={processing}
                className="btn"
                style={{
                  width: '100%',
                  padding: 'var(--spacing-md)',
                  background: 'var(--accent-green)',
                  color: 'white',
                  fontWeight: 600,
                  opacity: processing ? 0.5 : 1,
                  cursor: processing ? 'not-allowed' : 'pointer'
                }}
              >
                {processing ? 'Processing...' : `Process Next Sentence (${currentSentenceIndex + 1})`}
              </button>
            )}

            {isComplete && (
              <div className="success">
                <p className="text-center" style={{ fontWeight: 600 }}>
                  ✓ Analysis Complete! All {session.total_sentences} sentences processed.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Measurements Display */}
        {measurements.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
            {measurements.map((measurement, index) => (
              <div
                key={index}
                className="card"
                style={{
                  padding: 'var(--spacing-xl)',
                  boxShadow: 'var(--shadow-lg)'
                }}
              >
                {/* Sentence Header */}
                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <div className="flex items-center justify-between" style={{
                    marginBottom: 'var(--spacing-sm)',
                    flexWrap: 'wrap',
                    gap: 'var(--spacing-sm)'
                  }}>
                    <h3 style={{
                      fontSize: 'var(--text-lg)',
                      fontWeight: 600,
                      color: 'var(--accent-purple)'
                    }}>
                      Sentence {measurement.sentence_index + 1}
                    </h3>
                    <span style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-tertiary)'
                    }}>
                      Step {index + 1} of {session?.total_sentences}
                    </span>
                  </div>
                  <p style={{
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-lg)',
                    fontWeight: 500,
                    fontStyle: 'italic',
                    lineHeight: 1.6
                  }}>
                    "{measurement.sentence}"
                  </p>
                </div>

                {/* Tetralemma Measurement */}
                <TetralemmaViz measurement={measurement.measurement} />

                {/* Density Matrix Evolution */}
                <div style={{
                  marginTop: 'var(--spacing-xl)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 'var(--spacing-md)'
                }}>
                  <div style={{
                    background: 'var(--accent-purple-alpha-10)',
                    border: '1px solid var(--accent-purple)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--spacing-md)'
                  }}>
                    <h4 style={{
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      marginBottom: 'var(--spacing-md)'
                    }}>
                      ρ Before
                    </h4>
                    <DensityMatrixStats
                      purity={measurement.rho_before.purity}
                      entropy={measurement.rho_before.entropy}
                      topEigenvalues={measurement.rho_before.top_eigenvalues}
                    />
                  </div>
                  <div style={{
                    background: 'rgba(52, 211, 153, 0.1)',
                    border: '1px solid var(--accent-green)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--spacing-md)'
                  }}>
                    <h4 style={{
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      marginBottom: 'var(--spacing-md)'
                    }}>
                      ρ After
                    </h4>
                    <DensityMatrixStats
                      purity={measurement.rho_after.purity}
                      entropy={measurement.rho_after.entropy}
                      topEigenvalues={measurement.rho_after.top_eigenvalues}
                    />
                    <div style={{
                      marginTop: 'var(--spacing-sm)',
                      color: 'var(--accent-green)',
                      fontSize: 'var(--text-sm)'
                    }}>
                      Δ Purity: +{(measurement.rho_after.purity - measurement.rho_before.purity).toFixed(4)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
