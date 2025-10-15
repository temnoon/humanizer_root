import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './TransformationSplitView.css';

interface TransformationResult {
  transformation_id?: string;
  method: string;
  original_text: string;
  transformed_text: string;
  iterations?: number;
  convergence_score?: number;
  processing_time?: number;
  embedding_drift?: number[];
  ai_patterns?: any;
  ai_confidence?: number;
  target_stance?: any;
  examples_used?: any[];
  strength?: number;
}

interface TransformationSplitViewProps {
  result: TransformationResult;
  onClose: () => void;
}

/**
 * TransformationSplitView - Side-by-side display of original vs transformed text
 *
 * Displays in the main pane with original text on left, transformation on right
 */
export default function TransformationSplitView({ result, onClose }: TransformationSplitViewProps) {
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleCopyTransformed = async () => {
    try {
      await navigator.clipboard.writeText(result.transformed_text);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Preprocess LaTeX delimiters for KaTeX rendering
  // Simplified to only handle \[...\] and \(...\) conversions
  const preprocessLatex = (content: string): string => {
    if (!content) return '';

    let processed = content;

    // Protect code blocks from LaTeX processing
    const codeBlocks: string[] = [];
    processed = processed.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // Convert LaTeX display math \[ ... \] to $$...$$
    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => {
      return '\n\n$$' + math.trim() + '$$\n\n';
    });

    // Convert LaTeX inline math \( ... \) to $...$
    processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => {
      return '$' + math.trim() + '$';
    });

    // Restore code blocks
    codeBlocks.forEach((block, i) => {
      processed = processed.replace(`__CODE_BLOCK_${i}__`, block);
    });

    return processed;
  };

  // Defensive checks for malformed data
  if (!result.original_text || !result.transformed_text) {
    return (
      <div className="transformation-split-view">
        <div className="split-view-header">
          <div className="header-info">
            <h2 className="header-title">Transformation Error</h2>
          </div>
          <div className="header-actions">
            <button className="header-button close" onClick={onClose}>
              ✕ Close
            </button>
          </div>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p>Transformation data is incomplete. Please try again.</p>
          {!result.original_text && <p>Missing: original_text</p>}
          {!result.transformed_text && <p>Missing: transformed_text</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="transformation-split-view">
      {/* Header */}
      <div className="split-view-header">
        <div className="header-info">
          <h2 className="header-title">Transformation Result</h2>
          <div className="header-meta">
            <span className="meta-badge method">
              {result.method === 'trm' ? 'TRM Iterative' : 'LLM Direct'}
            </span>
            {result.iterations && (
              <span className="meta-badge">
                {result.iterations} iterations
              </span>
            )}
            {result.processing_time && (
              <span className="meta-badge">
                {result.processing_time}ms
              </span>
            )}
          </div>
        </div>
        <div className="header-actions">
          <button className="header-button" onClick={handleCopyTransformed}>
            {copyFeedback ? '✓ Copied' : '📋 Copy Result'}
          </button>
          <button className="header-button close" onClick={onClose}>
            ✕ Close
          </button>
        </div>
      </div>

      {/* Split Content */}
      <div className="split-content">
        {/* Original (Left) */}
        <div className="split-pane original">
          <div className="pane-header">
            <h3 className="pane-title">
              <span className="pane-icon">📄</span>
              Original
            </h3>
            <span className="pane-badge">
              {result.original_text.split(' ').length} words
            </span>
          </div>
          <div className="pane-content">
            <div className="text-content">
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {preprocessLatex(result.original_text)}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="split-divider">
          <div className="divider-line"></div>
          <div className="divider-icon">→</div>
          <div className="divider-line"></div>
        </div>

        {/* Transformed (Right) */}
        <div className="split-pane transformed">
          <div className="pane-header">
            <h3 className="pane-title">
              <span className="pane-icon">✨</span>
              Transformed
            </h3>
            <span className="pane-badge">
              {result.transformed_text.split(' ').length} words
            </span>
          </div>
          <div className="pane-content">
            <div className="text-content">
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {preprocessLatex(result.transformed_text)}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Footer */}
      {(result.convergence_score !== undefined || result.ai_confidence !== undefined) && (
        <div className="split-footer">
          <div className="footer-metrics">
            {result.convergence_score !== undefined && (
              <div className="metric">
                <span className="metric-label">Convergence:</span>
                <span className="metric-value">
                  {(result.convergence_score * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {result.ai_confidence !== undefined && (
              <div className="metric">
                <span className="metric-label">AI Confidence:</span>
                <span className="metric-value">
                  {result.ai_confidence.toFixed(1)}%
                </span>
              </div>
            )}
            {result.embedding_drift && result.embedding_drift.length > 0 && (
              <div className="metric">
                <span className="metric-label">Embedding Drift:</span>
                <span className="metric-value">
                  {result.embedding_drift[result.embedding_drift.length - 1].toFixed(3)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
