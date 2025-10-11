import { useState } from 'react';
import './TransformationPanel.css';

type TransformMethod = 'trm' | 'llm';
type TransformStatus = 'idle' | 'running' | 'complete' | 'error';

interface TransformationPanelProps {
  selectedContent?: {
    text: string;
    source: 'conversation' | 'message' | 'custom';
    sourceId?: string;
    messageId?: string;
  } | null;
}

interface TransformResult {
  method: TransformMethod;
  text: string;
  iterations?: number;
  convergenceScore?: number;
  processingTime: number;
  embeddingDrift?: number[];
}

/**
 * TransformationPanel - TRM vs LLM transformation comparison
 *
 * Features:
 * - Iterative embedding approximation (TRM method)
 * - Direct LLM transformation (baseline)
 * - Side-by-side A/B comparison
 * - Convergence metrics
 */
export default function TransformationPanel({ selectedContent }: TransformationPanelProps) {
  const [transformMethod, setTransformMethod] = useState<TransformMethod>('trm');
  const [targetStance, setTargetStance] = useState({ A: 0.7, notA: 0.1, both: 0.1, neither: 0.1 });
  const [maxIterations, setMaxIterations] = useState(5);
  const [povmPack, setPovmPack] = useState('tetralemma');
  const [status, setStatus] = useState<TransformStatus>('idle');
  const [trmResult, setTrmResult] = useState<TransformResult | null>(null);
  const [llmResult, setLlmResult] = useState<TransformResult | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const handleTransform = async () => {
    if (!selectedContent?.text) return;

    setStatus('running');
    setShowComparison(false);

    try {
      if (transformMethod === 'trm') {
        // TRM iterative embedding approximation
        const response = await fetch('/api/transform/trm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: selectedContent.text,
            povm_pack: povmPack,
            target_stance: targetStance,
            max_iterations: maxIterations,
          }),
        });

        const result = await response.json();
        setTrmResult(result);
      } else {
        // LLM-only transformation
        const response = await fetch('/api/transform/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: selectedContent.text,
            target_stance: targetStance,
          }),
        });

        const result = await response.json();
        setLlmResult(result);
      }

      setStatus('complete');
    } catch (error) {
      console.error('Transformation error:', error);
      setStatus('error');
    }
  };

  const handleCompare = async () => {
    if (!selectedContent?.text) return;

    setStatus('running');
    setShowComparison(true);

    try {
      // Run both transformations in parallel
      const [trmResponse, llmResponse] = await Promise.all([
        fetch('/api/transform/trm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: selectedContent.text,
            povm_pack: povmPack,
            target_stance: targetStance,
            max_iterations: maxIterations,
          }),
        }),
        fetch('/api/transform/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: selectedContent.text,
            target_stance: targetStance,
          }),
        }),
      ]);

      const [trmData, llmData] = await Promise.all([trmResponse.json(), llmResponse.json()]);

      setTrmResult(trmData);
      setLlmResult(llmData);
      setStatus('complete');
    } catch (error) {
      console.error('Comparison error:', error);
      setStatus('error');
    }
  };

  if (!selectedContent) {
    return (
      <div className="transformation-panel">
        <div className="panel-empty">
          <h3>🔄 Text Transformation</h3>
          <p>Select text in the main pane to begin transformation</p>
          <div className="empty-hint">
            <p>You can select:</p>
            <ul>
              <li>A single message</li>
              <li>Multiple messages</li>
              <li>An entire conversation</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="transformation-panel">
      {/* Header */}
      <div className="panel-header">
        <h3>🔄 Transform Text</h3>
        <div className="content-info">
          <span className="content-length">{selectedContent.text.length} chars</span>
          <span className="content-source">{selectedContent.source}</span>
        </div>
      </div>

      {/* Configuration */}
      <div className="transform-config">
        <div className="config-section">
          <label>Method</label>
          <div className="method-selector">
            <button
              className={`method-btn ${transformMethod === 'trm' ? 'active' : ''}`}
              onClick={() => setTransformMethod('trm')}
            >
              TRM (Iterative)
            </button>
            <button
              className={`method-btn ${transformMethod === 'llm' ? 'active' : ''}`}
              onClick={() => setTransformMethod('llm')}
            >
              LLM Only
            </button>
          </div>
        </div>

        {transformMethod === 'trm' && (
          <>
            <div className="config-section">
              <label>POVM Pack</label>
              <select value={povmPack} onChange={(e) => setPovmPack(e.target.value)}>
                <option value="tetralemma">Tetralemma (4-state)</option>
                <option value="tone">Tone Analysis</option>
                <option value="clarity">Clarity Measurement</option>
                <option value="narrative">Narrative Stance</option>
              </select>
            </div>

            <div className="config-section">
              <label>Max Iterations</label>
              <input
                type="number"
                min="1"
                max="10"
                value={maxIterations}
                onChange={(e) => setMaxIterations(parseInt(e.target.value))}
              />
            </div>
          </>
        )}

        <div className="config-section">
          <label>Target Stance</label>
          <div className="stance-inputs">
            <div className="stance-input">
              <span>A:</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={targetStance.A}
                onChange={(e) => setTargetStance({ ...targetStance, A: parseFloat(e.target.value) })}
              />
            </div>
            <div className="stance-input">
              <span>¬A:</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={targetStance.notA}
                onChange={(e) => setTargetStance({ ...targetStance, notA: parseFloat(e.target.value) })}
              />
            </div>
            <div className="stance-input">
              <span>Both:</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={targetStance.both}
                onChange={(e) => setTargetStance({ ...targetStance, both: parseFloat(e.target.value) })}
              />
            </div>
            <div className="stance-input">
              <span>Neither:</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={targetStance.neither}
                onChange={(e) => setTargetStance({ ...targetStance, neither: parseFloat(e.target.value) })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="transform-actions">
        <button
          className="btn-primary"
          onClick={handleTransform}
          disabled={status === 'running'}
        >
          {status === 'running' ? 'Transforming...' : 'Transform'}
        </button>
        <button
          className="btn-secondary"
          onClick={handleCompare}
          disabled={status === 'running'}
        >
          Compare TRM vs LLM
        </button>
      </div>

      {/* Results */}
      {status === 'complete' && !showComparison && (
        <div className="transform-results">
          <h4>Result ({transformMethod.toUpperCase()})</h4>
          {transformMethod === 'trm' && trmResult && (
            <>
              <div className="result-metrics">
                <span>Iterations: {trmResult.iterations}</span>
                <span>Convergence: {trmResult.convergenceScore?.toFixed(3)}</span>
                <span>Time: {trmResult.processingTime}ms</span>
              </div>
              <div className="result-text">{trmResult.text}</div>
            </>
          )}
          {transformMethod === 'llm' && llmResult && (
            <>
              <div className="result-metrics">
                <span>Time: {llmResult.processingTime}ms</span>
              </div>
              <div className="result-text">{llmResult.text}</div>
            </>
          )}
        </div>
      )}

      {/* Comparison view */}
      {status === 'complete' && showComparison && trmResult && llmResult && (
        <div className="comparison-view">
          <h4>TRM vs LLM Comparison</h4>

          <div className="comparison-metrics">
            <div className="metric-card trm">
              <h5>TRM (Iterative)</h5>
              <div className="metrics">
                <span>Iterations: {trmResult.iterations}</span>
                <span>Convergence: {trmResult.convergenceScore?.toFixed(3)}</span>
                <span>Time: {trmResult.processingTime}ms</span>
              </div>
            </div>
            <div className="metric-card llm">
              <h5>LLM Only</h5>
              <div className="metrics">
                <span>Single pass</span>
                <span>Time: {llmResult.processingTime}ms</span>
              </div>
            </div>
          </div>

          <div className="comparison-results">
            <div className="result-column trm">
              <h5>TRM Result</h5>
              <div className="result-text">{trmResult.text}</div>
            </div>
            <div className="result-column llm">
              <h5>LLM Result</h5>
              <div className="result-text">{llmResult.text}</div>
            </div>
          </div>

          {trmResult.embeddingDrift && (
            <div className="convergence-chart">
              <h5>Embedding Drift Per Iteration</h5>
              <div className="drift-bars">
                {trmResult.embeddingDrift.map((drift, idx) => (
                  <div key={idx} className="drift-bar-container">
                    <div className="drift-bar" style={{ height: `${drift * 100}px` }} />
                    <span className="drift-label">{idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="transform-error">
          <p>⚠️ Transformation failed. Please try again.</p>
        </div>
      )}
    </div>
  );
}
