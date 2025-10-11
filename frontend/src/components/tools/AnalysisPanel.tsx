import { useState } from 'react';
import './AnalysisPanel.css';

interface AnalysisPanelProps {
  selectedContent?: {
    text: string;
    source: 'conversation' | 'message' | 'custom';
    sourceId?: string;
    messageId?: string;
  } | null;
}

interface AnalysisResult {
  readings: {
    [pack: string]: {
      [axis: string]: number;
    };
  };
  density_matrix: {
    purity: number;
    entropy: number;
    rank: number;
  };
  processing_time: number;
}

/**
 * AnalysisPanel - POVM measurement and semantic analysis
 *
 * Features:
 * - Measure text with multiple POVM packs
 * - Visualize readings as bar charts
 * - Show density matrix properties
 * - Compare readings across packs
 */
export default function AnalysisPanel({ selectedContent }: AnalysisPanelProps) {
  const [selectedPacks, setSelectedPacks] = useState<string[]>(['tetralemma', 'tone']);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availablePacks = [
    { name: 'tetralemma', label: 'Tetralemma', icon: '☯️' },
    { name: 'tone', label: 'Tone', icon: '🎵' },
    { name: 'ontology', label: 'Ontology', icon: '🌍' },
    { name: 'pragmatics', label: 'Pragmatics', icon: '💡' },
    { name: 'audience', label: 'Audience', icon: '👥' },
  ];

  const togglePack = (packName: string) => {
    setSelectedPacks(prev =>
      prev.includes(packName)
        ? prev.filter(p => p !== packName)
        : [...prev, packName]
    );
  };

  const handleAnalyze = async () => {
    if (!selectedContent?.text) return;

    setAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: selectedContent.text,
          povm_packs: selectedPacks,
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  if (!selectedContent) {
    return (
      <div className="analysis-panel">
        <div className="panel-empty">
          <h3>🔬 Semantic Analysis</h3>
          <p>Select text in the main pane to analyze</p>
          <div className="empty-hint">
            <p>Analysis tools:</p>
            <ul>
              <li>POVM measurements across multiple axes</li>
              <li>Density matrix properties</li>
              <li>Semantic stance visualization</li>
              <li>Compare readings across packs</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="analysis-panel">
      {/* Header */}
      <div className="panel-header">
        <h3>🔬 Analyze Text</h3>
        <div className="content-info">
          <span className="content-length">{selectedContent.text.length} chars</span>
          <span className="content-source">{selectedContent.source}</span>
        </div>
      </div>

      {/* POVM Pack Selection */}
      <div className="pack-selection">
        <label>POVM Packs to Measure</label>
        <div className="pack-grid">
          {availablePacks.map(pack => (
            <button
              key={pack.name}
              className={`pack-button ${selectedPacks.includes(pack.name) ? 'selected' : ''}`}
              onClick={() => togglePack(pack.name)}
            >
              <span className="pack-icon">{pack.icon}</span>
              <span className="pack-label">{pack.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Analyze Button */}
      <button
        className="btn-analyze"
        onClick={handleAnalyze}
        disabled={analyzing || selectedPacks.length === 0}
      >
        {analyzing ? 'Analyzing...' : `Analyze with ${selectedPacks.length} pack${selectedPacks.length !== 1 ? 's' : ''}`}
      </button>

      {/* Error */}
      {error && (
        <div className="analysis-error">
          <p>⚠️ {error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="analysis-results">
          {/* Density Matrix Properties */}
          <div className="density-properties">
            <h4>Density Matrix Properties</h4>
            <div className="properties-grid">
              <div className="property">
                <span className="property-label">Purity</span>
                <span className="property-value">{result.density_matrix.purity.toFixed(3)}</span>
              </div>
              <div className="property">
                <span className="property-label">Entropy</span>
                <span className="property-value">{result.density_matrix.entropy.toFixed(3)}</span>
              </div>
              <div className="property">
                <span className="property-label">Rank</span>
                <span className="property-value">{result.density_matrix.rank}</span>
              </div>
            </div>
          </div>

          {/* POVM Readings */}
          {Object.entries(result.readings).map(([packName, readings]) => (
            <div key={packName} className="povm-readings">
              <h4>{packName}</h4>
              <div className="readings-bars">
                {Object.entries(readings).map(([axis, value]) => (
                  <div key={axis} className="reading-bar">
                    <span className="axis-label">{axis}</span>
                    <div className="bar-container">
                      <div
                        className="bar-fill"
                        style={{ width: `${value * 100}%` }}
                      />
                      <span className="bar-value">{value.toFixed(3)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Processing Time */}
          <div className="processing-info">
            <span>Analysis completed in {result.processing_time}ms</span>
          </div>
        </div>
      )}
    </div>
  );
}
