import { useState } from 'react';
import './ComparisonPanel.css';

interface ComparisonPanelProps {
  selectedContent?: {
    text: string;
    source: 'conversation' | 'message' | 'custom';
    sourceId?: string;
    messageId?: string;
  } | null;
}

interface ComparisonResult {
  text_a: string;
  text_b: string;
  similarity: {
    cosine: number;
    embedding_distance: number;
  };
  povm_comparison: {
    [pack: string]: {
      text_a: { [axis: string]: number };
      text_b: { [axis: string]: number };
      difference: { [axis: string]: number };
    };
  };
  diff_stats: {
    words_added: number;
    words_removed: number;
    words_changed: number;
  };
  processing_time: number;
}

/**
 * ComparisonPanel - Side-by-side text comparison
 *
 * Features:
 * - Compare two texts
 * - Embedding similarity
 * - POVM reading differences
 * - Word-level diff
 * - Visual comparison charts
 */
export default function ComparisonPanel({ selectedContent }: ComparisonPanelProps) {
  const [textB, setTextB] = useState('');
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [povmPack, setPovmPack] = useState('tone');

  const handleCompare = async () => {
    if (!selectedContent?.text || !textB) return;

    setComparing(true);
    setError(null);

    try {
      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text_a: selectedContent.text,
          text_b: textB,
          povm_pack: povmPack,
        }),
      });

      if (!response.ok) {
        throw new Error(`Comparison failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error('Comparison error:', err);
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setComparing(false);
    }
  };

  if (!selectedContent) {
    return (
      <div className="comparison-panel">
        <div className="panel-empty">
          <h3>⚖️ Text Comparison</h3>
          <p>Select text in the main pane to compare</p>
          <div className="empty-hint">
            <p>Comparison features:</p>
            <ul>
              <li>Side-by-side text view</li>
              <li>Embedding similarity</li>
              <li>POVM reading differences</li>
              <li>Word-level diff statistics</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="comparison-panel">
      {/* Header */}
      <div className="panel-header">
        <h3>⚖️ Compare Texts</h3>
        <div className="content-info">
          <span className="content-length">{selectedContent.text.length} chars</span>
          <span className="content-source">{selectedContent.source}</span>
        </div>
      </div>

      {/* Text A (Selected) */}
      <div className="text-section">
        <label>Text A (Selected)</label>
        <div className="text-preview">{selectedContent.text}</div>
      </div>

      {/* Text B (Input) */}
      <div className="text-section">
        <label>Text B (Compare Against)</label>
        <textarea
          className="text-input"
          value={textB}
          onChange={(e) => setTextB(e.target.value)}
          placeholder="Enter text to compare..."
          rows={4}
        />
      </div>

      {/* POVM Pack Selection */}
      <div className="povm-selection">
        <label>POVM Pack for Comparison</label>
        <select value={povmPack} onChange={(e) => setPovmPack(e.target.value)}>
          <option value="tetralemma">Tetralemma</option>
          <option value="tone">Tone</option>
          <option value="ontology">Ontology</option>
          <option value="pragmatics">Pragmatics</option>
          <option value="audience">Audience</option>
        </select>
      </div>

      {/* Compare Button */}
      <button
        className="btn-compare"
        onClick={handleCompare}
        disabled={comparing || !textB}
      >
        {comparing ? 'Comparing...' : 'Compare Texts'}
      </button>

      {/* Error */}
      {error && (
        <div className="comparison-error">
          <p>⚠️ {error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="comparison-results">
          {/* Similarity Metrics */}
          <div className="similarity-metrics">
            <h4>Similarity Metrics</h4>
            <div className="metrics-grid">
              <div className="metric">
                <span className="metric-label">Cosine Similarity</span>
                <span className="metric-value">{result.similarity.cosine.toFixed(3)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Embedding Distance</span>
                <span className="metric-value">{result.similarity.embedding_distance.toFixed(3)}</span>
              </div>
            </div>
          </div>

          {/* Diff Statistics */}
          <div className="diff-stats">
            <h4>Word-Level Changes</h4>
            <div className="stats-grid">
              <div className="stat added">
                <span className="stat-value">{result.diff_stats.words_added}</span>
                <span className="stat-label">Added</span>
              </div>
              <div className="stat removed">
                <span className="stat-value">{result.diff_stats.words_removed}</span>
                <span className="stat-label">Removed</span>
              </div>
              <div className="stat changed">
                <span className="stat-value">{result.diff_stats.words_changed}</span>
                <span className="stat-label">Changed</span>
              </div>
            </div>
          </div>

          {/* POVM Comparison */}
          {Object.entries(result.povm_comparison).map(([pack, data]) => (
            <div key={pack} className="povm-comparison">
              <h4>{pack} Comparison</h4>
              <div className="comparison-bars">
                {Object.keys(data.text_a).map(axis => (
                  <div key={axis} className="comparison-bar">
                    <span className="axis-label">{axis}</span>
                    <div className="dual-bars">
                      <div className="bar-pair">
                        <span className="bar-label">A</span>
                        <div className="bar-container">
                          <div
                            className="bar-fill bar-a"
                            style={{ width: `${data.text_a[axis] * 100}%` }}
                          />
                          <span className="bar-value">{data.text_a[axis].toFixed(3)}</span>
                        </div>
                      </div>
                      <div className="bar-pair">
                        <span className="bar-label">B</span>
                        <div className="bar-container">
                          <div
                            className="bar-fill bar-b"
                            style={{ width: `${data.text_b[axis] * 100}%` }}
                          />
                          <span className="bar-value">{data.text_b[axis].toFixed(3)}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`diff-value ${data.difference[axis] > 0 ? 'positive' : data.difference[axis] < 0 ? 'negative' : 'neutral'}`}>
                      {data.difference[axis] > 0 ? '+' : ''}{data.difference[axis].toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Processing Time */}
          <div className="processing-info">
            <span>Comparison completed in {result.processing_time}ms</span>
          </div>
        </div>
      )}
    </div>
  );
}
