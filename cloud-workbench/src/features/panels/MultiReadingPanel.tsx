import { useState } from 'react';
import { useCanvas } from '../../core/context/CanvasContext';
import { api } from '../../core/adapters/api';

interface POVMReading {
  axis: string;
  T: number;
  F: number;
  B: number;
  N: number;
  alpha: number;
  label_T: string;
  label_F: string;
  label_B: string;
  label_N: string;
}

interface SentenceReading {
  sentence: string;
  index: number;
  readings: POVMReading[];
  embedding?: number[];
  rho_state?: {
    purity: number;
    entropy: number;
  };
}

export function MultiReadingPanel() {
  const { getActiveText } = useCanvas();
  const [selectedAxes, setSelectedAxes] = useState<string[]>(['literalness']);
  const [readings, setReadings] = useState<SentenceReading[]>([]);
  const [currentSentence, setCurrentSentence] = useState(0);
  const [loading, setLoading] = useState(false);
  const [, setSessionId] = useState<string | null>(null);

  const availableAxes = [
    { id: 'literalness', name: 'Literalness', description: 'Concrete ↔ Abstract' },
    { id: 'ai-detectability', name: 'AI Detection', description: 'Human ↔ AI markers' },
    { id: 'formality', name: 'Formality', description: 'Casual ↔ Academic' },
    { id: 'affect', name: 'Emotion', description: 'Positive ↔ Negative' },
    { id: 'epistemic', name: 'Certainty', description: 'Assertion ↔ Question' },
    { id: 'temporality', name: 'Time', description: 'Past ↔ Future' },
  ];

  const handleAnalyze = async () => {
    const text = getActiveText();

    if (!text || text.trim().length === 0) {
      alert('No text to analyze. Please load text to Canvas first.');
      return;
    }

    setLoading(true);
    try {
      // Start quantum reading session
      const session = await api.quantumStart({ text });
      setSessionId(session.session_id);

      // Process all sentences
      const allReadings: SentenceReading[] = [];
      for (let i = 0; i < session.total_sentences; i++) {
        const step = await api.quantumStep(session.session_id);

        // Convert Tetralemma to POVM reading format
        const reading: POVMReading = {
          axis: 'literalness',
          T: step.measurement.literal,
          F: step.measurement.metaphorical,
          B: step.measurement.both,
          N: step.measurement.neither,
          alpha: step.rho_state.purity, // Use purity as coherence proxy
          label_T: 'Literal',
          label_F: 'Metaphorical',
          label_B: 'Both',
          label_N: 'Neither',
        };

        allReadings.push({
          sentence: step.sentence,
          index: step.index,
          readings: [reading],
          rho_state: step.rho_state,
        });
      }

      setReadings(allReadings);
      setCurrentSentence(0);
    } catch (error) {
      console.error('Quantum reading failed:', error);
      alert(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const current = readings[currentSentence];

  return (
    <div className="flex h-full flex-col p-4">
      <h2 className="mb-4 text-lg font-semibold">Multi-Reading Analysis</h2>

      {/* Axis Selection */}
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium">Select POVM Axes:</label>
        <div className="grid grid-cols-2 gap-2">
          {availableAxes.map((axis) => (
            <label key={axis.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedAxes.includes(axis.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedAxes([...selectedAxes, axis.id]);
                  } else {
                    setSelectedAxes(selectedAxes.filter((a) => a !== axis.id));
                  }
                }}
                className="rounded"
              />
              <div>
                <div className="text-sm font-medium">{axis.name}</div>
                <div className="text-xs text-slate-400">{axis.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Canvas Text Info */}
      <div className="mb-4 rounded bg-slate-800 p-3">
        <div className="text-xs text-slate-400 mb-1">Reading from Canvas</div>
        <div className="text-sm text-slate-300">
          {getActiveText() ? `${getActiveText().substring(0, 100)}...` : 'No text in Canvas'}
        </div>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={!getActiveText() || selectedAxes.length === 0 || loading}
        className="w-full rounded bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50 mb-4"
      >
        {loading ? '⏳ Analyzing...' : `◈ Analyze on ${selectedAxes.length} ${selectedAxes.length === 1 ? 'axis' : 'axes'}`}
      </button>

      {/* Sentence Navigator */}
      {readings.length > 0 && (
        <>
          <div className="mb-4 flex items-center gap-2">
            <button
              onClick={() => setCurrentSentence(Math.max(0, currentSentence - 1))}
              disabled={currentSentence === 0}
              className="rounded bg-slate-700 px-3 py-1 text-sm disabled:opacity-50"
            >
              ← Prev
            </button>
            <span className="text-sm">
              Sentence {currentSentence + 1} of {readings.length}
            </span>
            <button
              onClick={() => setCurrentSentence(Math.min(readings.length - 1, currentSentence + 1))}
              disabled={currentSentence === readings.length - 1}
              className="rounded bg-slate-700 px-3 py-1 text-sm disabled:opacity-50"
            >
              Next →
            </button>
          </div>

          {/* Current Sentence */}
          <div className="mb-4 rounded bg-slate-800 p-3">
            <div className="text-sm font-medium text-slate-400">Current Sentence:</div>
            <div className="mt-1">{current?.sentence}</div>
          </div>

          {/* Multi-Axis Readings */}
          <div className="flex-1 space-y-4 overflow-y-auto">
            {selectedAxes.map((axisId) => {
              const axisInfo = availableAxes.find((a) => a.id === axisId);
              const reading = current?.readings.find((r) => r.axis === axisId);

              return (
                <div key={axisId} className="rounded bg-slate-800 p-3">
                  <h3 className="mb-2 text-sm font-semibold">{axisInfo?.name}</h3>

                  {reading ? (
                    <div className="space-y-2">
                      {/* Four-corner grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded bg-red-900/30 p-2">
                          <div className="font-medium">{reading.label_T}</div>
                          <div className="mt-1 text-lg font-bold">{(reading.T * 100).toFixed(0)}%</div>
                        </div>
                        <div className="rounded bg-green-900/30 p-2">
                          <div className="font-medium">{reading.label_F}</div>
                          <div className="mt-1 text-lg font-bold">{(reading.F * 100).toFixed(0)}%</div>
                        </div>
                        <div className="rounded bg-blue-900/30 p-2">
                          <div className="font-medium">{reading.label_B}</div>
                          <div className="mt-1 text-lg font-bold">{(reading.B * 100).toFixed(0)}%</div>
                        </div>
                        <div className="rounded bg-purple-900/30 p-2">
                          <div className="font-medium">{reading.label_N}</div>
                          <div className="mt-1 text-lg font-bold">{(reading.N * 100).toFixed(0)}%</div>
                        </div>
                      </div>

                      {/* Alpha (coherence) */}
                      <div className="rounded bg-slate-700/50 p-2">
                        <div className="mb-1 flex justify-between text-xs">
                          <span>Coherence (α)</span>
                          <span className="font-bold">{(reading.alpha * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded bg-slate-600">
                          <div
                            className="h-full bg-indigo-500"
                            style={{ width: `${reading.alpha * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">No reading available</div>
                  )}
                </div>
              );
            })}

            {/* ρ State (if available) */}
            {current?.rho_state && (
              <div className="rounded bg-slate-800 p-3">
                <h3 className="mb-2 text-sm font-semibold">Density Matrix (ρ)</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Purity:</span>
                    <span className="font-bold">{current.rho_state.purity.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Entropy:</span>
                    <span className="font-bold">{current.rho_state.entropy.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
