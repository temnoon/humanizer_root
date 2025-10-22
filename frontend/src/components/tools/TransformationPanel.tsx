import { useState } from 'react';
import './TransformationPanel.css';

type TransformMethod = 'trm' | 'llm';
type TransformMode = 'custom' | 'personifier';
type TransformStatus = 'idle' | 'running' | 'complete' | 'error';

interface TransformationPanelProps {
  selectedContent?: {
    text: string;
    source: 'conversation' | 'message' | 'document' | 'chunk' | 'custom';
    sourceId?: string;
    messageId?: string;
    chunkId?: string;
  } | null;
  onShowTransformation?: (result: TransformResult) => void;
}

interface ErrorState {
  message: string;
  details?: string;
}

interface TransformResult {
  transformation_id?: string;
  method: string;
  original_text: string;
  transformed_text: string;  // This is what the API actually returns
  iterations?: number;
  convergenceScore?: number;
  convergence_score?: number;  // API uses snake_case
  processingTime?: number;
  processing_time?: number;  // API uses snake_case
  embeddingDrift?: number[];
  embedding_drift?: number[];  // API uses snake_case
  aiPatterns?: any;
  ai_patterns?: any;  // API uses snake_case
  aiConfidence?: number;
  ai_confidence?: number;  // API uses snake_case
  targetStance?: any;
  target_stance?: any;  // API uses snake_case
  examples_used?: any[];
  strength?: number;
  saved?: boolean;
}

/**
 * TransformationPanel - TRM vs LLM transformation comparison
 *
 * Features:
 * - Custom mode: Manual target stance configuration
 * - Personifier mode: AI → conversational (learned from 396 training pairs)
 * - Iterative embedding approximation (TRM method)
 * - Direct LLM transformation (baseline)
 * - Side-by-side A/B comparison
 * - Convergence metrics
 */
export default function TransformationPanel({ selectedContent, onShowTransformation }: TransformationPanelProps) {
  const [transformMode, setTransformMode] = useState<TransformMode>('personifier');
  const [transformMethod, setTransformMethod] = useState<TransformMethod>('trm');
  const [targetStance, setTargetStance] = useState({ A: 0.7, notA: 0.1, both: 0.1, neither: 0.1 });
  const [maxIterations, setMaxIterations] = useState(5);
  const [povmPack, setPovmPack] = useState('tetralemma');
  const [llmStrength, setLlmStrength] = useState(1.0);
  const [userPrompt, setUserPrompt] = useState('');
  const [status, setStatus] = useState<TransformStatus>('idle');
  const [trmResult, setTrmResult] = useState<TransformResult | null>(null);
  const [llmResult, setLlmResult] = useState<TransformResult | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [savedTransformationId, setSavedTransformationId] = useState<string | null>(null);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);

  const handleTransform = async () => {
    if (!selectedContent?.text) {
      alert('No text selected. Please select some text to transform.');
      return;
    }

    if (selectedContent.text.trim().length === 0) {
      alert('Selected text is empty. Please select valid text to transform.');
      return;
    }

    setStatus('running');
    setShowComparison(false);
    setSavedTransformationId(null);
    setShowSaveConfirmation(false);
    setTrmResult(null);
    setLlmResult(null);
    setError(null);

    try {
      let response;
      if (transformMode === 'personifier') {
        // Personifier mode - AI → conversational
        if (transformMethod === 'trm') {
          response = await fetch('/api/personify/trm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: selectedContent.text,
              user_prompt: userPrompt || undefined,
              source_message_uuid: selectedContent.messageId || undefined,
              povm_pack: povmPack,
              max_iterations: maxIterations,
            }),
          });
        } else {
          response = await fetch('/api/personify/llm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: selectedContent.text,
              user_prompt: userPrompt || undefined,
              source_message_uuid: selectedContent.messageId || undefined,
              strength: llmStrength,
              use_examples: true,
              n_examples: 3,
            }),
          });
        }
      } else {
        // Custom mode - manual target stance
        if (transformMethod === 'trm') {
          response = await fetch('/api/transform/trm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: selectedContent.text,
              user_prompt: userPrompt || undefined,
              source_message_uuid: selectedContent.messageId || undefined,
              povm_pack: povmPack,
              target_stance: targetStance,
              max_iterations: maxIterations,
            }),
          });
        } else {
          response = await fetch('/api/transform/llm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: selectedContent.text,
              user_prompt: userPrompt || undefined,
              source_message_uuid: selectedContent.messageId || undefined,
              target_stance: targetStance,
            }),
          });
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));

        // More specific error messages based on status code
        if (response.status === 404) {
          throw new Error('Transformation endpoint not found. Check backend is running at http://localhost:8000');
        } else if (response.status === 422) {
          throw new Error(`Invalid request: ${errorData.detail || 'Missing required fields'}`);
        } else if (response.status === 500) {
          throw new Error(`Server error: ${errorData.detail || 'Transformation failed internally'}`);
        } else if (response.status === 503) {
          throw new Error('Ollama not responding. Check it\'s running at http://localhost:11434');
        }

        throw new Error(errorData.detail || `API error: ${response.status}`);
      }

      const result = await response.json();

      // Backend returns "transformed_text" not "text"
      if (!result) {
        throw new Error('Transformation returned empty response. Check Ollama is running at http://localhost:11434');
      }

      if (!result.transformed_text) {
        throw new Error(`Transformation returned unexpected format. Expected "transformed_text" field but got: ${JSON.stringify(Object.keys(result)).substring(0, 100)}`);
      }

      if (transformMethod === 'trm') {
        setTrmResult(result);
      } else {
        setLlmResult(result);
      }

      if (result.transformation_id) {
        setSavedTransformationId(result.transformation_id);
        setShowSaveConfirmation(true);
        setTimeout(() => setShowSaveConfirmation(false), 3000);
      }

      setStatus('complete');

      // Show transformation in main pane split view
      if (onShowTransformation) {
        onShowTransformation({
          ...result,
          original_text: selectedContent.text
        });
      }
    } catch (err) {
      console.error('Transformation error:', err);
      setStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError({
        message: 'Transformation failed',
        details: errorMessage
      });
    }
  };

  const handleCompare = async () => {
    if (!selectedContent?.text) return;

    setStatus('running');
    setShowComparison(true);

    try {
      if (transformMode === 'personifier') {
        // Use personify comparison endpoint
        const response = await fetch('/api/personify/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: selectedContent.text,
            povm_pack: povmPack,
            max_iterations: maxIterations,
            llm_strength: llmStrength,
          }),
        });

        const data = await response.json();
        setTrmResult(data.trm_result);
        setLlmResult(data.llm_result);
      } else {
        // Custom mode - run both in parallel
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
      }

      setStatus('complete');
    } catch (error) {
      console.error('Comparison error:', error);
      setStatus('error');
    }
  };

  const handleCopyResult = (text: string) => {
    navigator.clipboard.writeText(text);
    setShowCopyFeedback(true);
    setTimeout(() => setShowCopyFeedback(false), 2000);
  };

  const handleTransformAgain = (text: string | undefined) => {
    if (!text) {
      alert('No text available to transform again.');
      return;
    }
    // TODO: Update selected content with transformed text
    console.log('Transform again:', text.substring(0, Math.min(50, text.length)) + '...');
    alert('Transform Again: This will use the transformed text as new input for another transformation.\n\nFeature coming soon!');
  };

  const handleSaveToList = (text: string | undefined) => {
    if (!text) {
      alert('No text available to save.');
      return;
    }
    // TODO: Show list selector modal
    console.log('Save to list:', text.substring(0, Math.min(50, text.length)) + '...');
    alert('Save to List: Choose an interest list to save this transformation.\n\nFeature coming soon!');
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
          <label>Mode</label>
          <div className="mode-selector">
            <button
              className={`mode-btn ${transformMode === 'personifier' ? 'active' : ''}`}
              onClick={() => setTransformMode('personifier')}
            >
              🤖 Personifier
            </button>
            <button
              className={`mode-btn ${transformMode === 'custom' ? 'active' : ''}`}
              onClick={() => setTransformMode('custom')}
            >
              🎯 Custom
            </button>
          </div>
          {transformMode === 'personifier' && (
            <div className="mode-description">
              Transform AI-written text to conversational register (trained on 396 pairs)
            </div>
          )}
        </div>

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
                <option value="ontology">Ontology Stance</option>
                <option value="pragmatics">Pragmatics Analysis</option>
                <option value="audience">Audience Targeting</option>
              </select>
            </div>

            <div className="config-section">
              <label>Max Iterations</label>
              <input
                type="number"
                min="1"
                max="10"
                value={maxIterations}
                onChange={(e) => setMaxIterations(parseInt(e.target.value) || 5)}
              />
            </div>
          </>
        )}

        {transformMethod === 'llm' && transformMode === 'personifier' && (
          <div className="config-section">
            <label>Strength</label>
            <input
              type="number"
              min="0.5"
              max="2.0"
              step="0.1"
              value={llmStrength}
              onChange={(e) => setLlmStrength(parseFloat(e.target.value) || 1.0)}
            />
            <span className="strength-hint">
              {llmStrength < 0.8 ? 'Light' : llmStrength > 1.5 ? 'Aggressive' : 'Moderate'}
            </span>
          </div>
        )}

        {transformMode === 'custom' && (
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
        )}
      </div>

      {/* User Prompt Input */}
      <div className="user-prompt-section">
        <label htmlFor="user-prompt">What should this transformation do?</label>
        <textarea
          id="user-prompt"
          className="user-prompt-input"
          placeholder={
            transformMode === 'personifier'
              ? "e.g., 'Transform from AI register to natural conversational tone' or 'Make this sound like a friend explaining'"
              : "e.g., 'Make this sound more casual', 'Add more examples', 'Simplify for a general audience'"
          }
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          rows={3}
        />
        <p className="user-prompt-hint">
          Optional: Describe your transformation goal. This will be saved with the transformation.
        </p>
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

      {/* Save Confirmation */}
      {showSaveConfirmation && savedTransformationId && (
        <div className="save-confirmation">
          ✓ Transformation saved! (ID: {savedTransformationId.substring(0, 8)}...)
        </div>
      )}

      {/* Results */}
      {status === 'complete' && !showComparison && (
        <div className="transform-results">
          <h4>✨ Transformed Text</h4>

          {/* Show AI patterns if in personifier mode */}
          {transformMode === 'personifier' && (transformMethod === 'trm' ? trmResult : llmResult)?.ai_patterns && (
            <div className="ai-patterns">
              <h5>AI Patterns Detected ({(transformMethod === 'trm' ? trmResult : llmResult)?.ai_confidence?.toFixed(0)}% confidence)</h5>
              <div className="pattern-list">
                <span>Hedging: {(transformMethod === 'trm' ? trmResult : llmResult)?.ai_patterns?.hedging || 0}</span>
                <span>Formal: {(transformMethod === 'trm' ? trmResult : llmResult)?.ai_patterns?.formal_transitions || 0}</span>
                <span>Passive: {(transformMethod === 'trm' ? trmResult : llmResult)?.ai_patterns?.passive_voice || 0}</span>
              </div>
            </div>
          )}

          {transformMethod === 'trm' && trmResult && (
            <>
              <div className="result-metrics">
                <span>Method: TRM (Iterative)</span>
                <span>Iterations: {trmResult.iterations}</span>
                <span>Convergence: {(trmResult.convergence_score ?? trmResult.convergenceScore ?? 0).toFixed(3)}</span>
                <span>Time: {trmResult.processing_time ?? trmResult.processingTime ?? 0}ms</span>
              </div>
              <div className="result-text-wrapper">
                <div className="result-text">{trmResult.transformed_text}</div>
                {showCopyFeedback && <div className="copy-feedback">✓ Copied!</div>}
              </div>
              <div className="result-actions">
                <button
                  className="result-action-btn primary"
                  onClick={() => handleCopyResult(trmResult.transformed_text)}
                  title="Copy to clipboard"
                >
                  📋 Copy
                </button>
                <button
                  className="result-action-btn"
                  onClick={() => handleTransformAgain(trmResult.transformed_text)}
                  title="Use this as input for another transformation"
                >
                  🔄 Transform Again
                </button>
                <button
                  className="result-action-btn"
                  onClick={() => handleSaveToList(trmResult.transformed_text)}
                  title="Save to an interest list"
                >
                  📝 Save to List
                </button>
              </div>
            </>
          )}
          {transformMethod === 'llm' && llmResult && (
            <>
              <div className="result-metrics">
                <span>Method: LLM Only</span>
                <span>Time: {llmResult.processing_time ?? llmResult.processingTime ?? 0}ms</span>
              </div>
              <div className="result-text-wrapper">
                <div className="result-text">{llmResult.transformed_text}</div>
                {showCopyFeedback && <div className="copy-feedback">✓ Copied!</div>}
              </div>
              <div className="result-actions">
                <button
                  className="result-action-btn primary"
                  onClick={() => handleCopyResult(llmResult.transformed_text)}
                  title="Copy to clipboard"
                >
                  📋 Copy
                </button>
                <button
                  className="result-action-btn"
                  onClick={() => handleTransformAgain(llmResult.transformed_text)}
                  title="Use this as input for another transformation"
                >
                  🔄 Transform Again
                </button>
                <button
                  className="result-action-btn"
                  onClick={() => handleSaveToList(llmResult.transformed_text)}
                  title="Save to an interest list"
                >
                  📝 Save to List
                </button>
              </div>
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
                <span>Convergence: {(trmResult.convergence_score ?? trmResult.convergenceScore ?? 0).toFixed(3)}</span>
                <span>Time: {trmResult.processing_time ?? trmResult.processingTime ?? 0}ms</span>
              </div>
            </div>
            <div className="metric-card llm">
              <h5>LLM Only</h5>
              <div className="metrics">
                <span>Single pass</span>
                <span>Time: {llmResult.processing_time ?? llmResult.processingTime ?? 0}ms</span>
              </div>
            </div>
          </div>

          <div className="comparison-results">
            <div className="result-column trm">
              <h5>TRM Result</h5>
              <div className="result-text">{trmResult.transformed_text}</div>
            </div>
            <div className="result-column llm">
              <h5>LLM Result</h5>
              <div className="result-text">{llmResult.transformed_text}</div>
            </div>
          </div>

          {(trmResult.embedding_drift ?? trmResult.embeddingDrift) && (
            <div className="convergence-chart">
              <h5>Embedding Drift Per Iteration</h5>
              <div className="drift-bars">
                {(trmResult.embedding_drift ?? trmResult.embeddingDrift)!.map((drift, idx) => (
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

      {status === 'error' && error && (
        <div className="transform-error">
          <h4>⚠️ {error.message}</h4>
          {error.details && <p className="error-details">{error.details}</p>}
          <p className="error-hint">
            Common issues:
            • Make sure you've selected text to transform
            • Check that Ollama is running (http://localhost:11434)
            • Verify the backend API is accessible (http://localhost:8000)
          </p>
        </div>
      )}
    </div>
  );
}
