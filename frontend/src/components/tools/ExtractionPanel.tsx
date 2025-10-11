import { useState } from 'react';
import './ExtractionPanel.css';

interface ExtractionPanelProps {
  selectedContent?: {
    text: string;
    source: 'conversation' | 'message' | 'custom';
    sourceId?: string;
    messageId?: string;
  } | null;
}

type ExtractionMode = 'semantic' | 'entities' | 'summary' | 'keywords';

interface SemanticMatch {
  text: string;
  similarity: number;
  source: {
    type: string;
    id: string;
    title?: string;
  };
}

interface ExtractedEntity {
  text: string;
  type: string;
  confidence: number;
}

interface ExtractionResult {
  mode: ExtractionMode;
  semantic_matches?: SemanticMatch[];
  entities?: ExtractedEntity[];
  summary?: string;
  keywords?: string[];
  processing_time: number;
}

/**
 * ExtractionPanel - Semantic search and information extraction
 *
 * Features:
 * - Semantic similarity search across corpus
 * - Entity extraction (NER)
 * - Automatic summarization
 * - Keyword extraction
 */
export default function ExtractionPanel({ selectedContent }: ExtractionPanelProps) {
  const [mode, setMode] = useState<ExtractionMode>('semantic');
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topK, setTopK] = useState(5);

  const modes = [
    { name: 'semantic' as ExtractionMode, label: 'Semantic Search', icon: '🔍' },
    { name: 'entities' as ExtractionMode, label: 'Entities', icon: '🏷️' },
    { name: 'summary' as ExtractionMode, label: 'Summary', icon: '📝' },
    { name: 'keywords' as ExtractionMode, label: 'Keywords', icon: '🔑' },
  ];

  const handleExtract = async () => {
    if (!selectedContent?.text) return;

    setExtracting(true);
    setError(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: selectedContent.text,
          mode: mode,
          top_k: topK,
        }),
      });

      if (!response.ok) {
        throw new Error(`Extraction failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error('Extraction error:', err);
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  if (!selectedContent) {
    return (
      <div className="extraction-panel">
        <div className="panel-empty">
          <h3>📋 Information Extraction</h3>
          <p>Select text in the main pane to extract information</p>
          <div className="empty-hint">
            <p>Extraction modes:</p>
            <ul>
              <li>🔍 Semantic search - Find similar content</li>
              <li>🏷️ Entity extraction - Identify people, places, concepts</li>
              <li>📝 Summarization - Generate concise summaries</li>
              <li>🔑 Keywords - Extract key terms and phrases</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="extraction-panel">
      {/* Header */}
      <div className="panel-header">
        <h3>📋 Extract Information</h3>
        <div className="content-info">
          <span className="content-length">{selectedContent.text.length} chars</span>
          <span className="content-source">{selectedContent.source}</span>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="mode-selection">
        <label>Extraction Mode</label>
        <div className="mode-grid">
          {modes.map(m => (
            <button
              key={m.name}
              className={`mode-button ${mode === m.name ? 'selected' : ''}`}
              onClick={() => setMode(m.name)}
            >
              <span className="mode-icon">{m.icon}</span>
              <span className="mode-label">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      {mode === 'semantic' && (
        <div className="extraction-options">
          <label>Number of Results</label>
          <input
            type="number"
            min="1"
            max="20"
            value={topK}
            onChange={(e) => setTopK(parseInt(e.target.value))}
          />
        </div>
      )}

      {/* Extract Button */}
      <button
        className="btn-extract"
        onClick={handleExtract}
        disabled={extracting}
      >
        {extracting ? 'Extracting...' : `Extract ${modes.find(m => m.name === mode)?.label}`}
      </button>

      {/* Error */}
      {error && (
        <div className="extraction-error">
          <p>⚠️ {error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="extraction-results">
          {/* Semantic Matches */}
          {result.mode === 'semantic' && result.semantic_matches && (
            <div className="semantic-results">
              <h4>Similar Content ({result.semantic_matches.length} results)</h4>
              <div className="matches-list">
                {result.semantic_matches.map((match, idx) => (
                  <div key={idx} className="match-card">
                    <div className="match-header">
                      <span className="match-similarity">{(match.similarity * 100).toFixed(1)}%</span>
                      <span className="match-source">{match.source.type}</span>
                    </div>
                    <div className="match-text">{match.text}</div>
                    {match.source.title && (
                      <div className="match-title">{match.source.title}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Entities */}
          {result.mode === 'entities' && result.entities && (
            <div className="entities-results">
              <h4>Extracted Entities ({result.entities.length})</h4>
              <div className="entities-list">
                {result.entities.map((entity, idx) => (
                  <div key={idx} className="entity-card">
                    <span className="entity-text">{entity.text}</span>
                    <span className="entity-type">{entity.type}</span>
                    <span className="entity-confidence">{(entity.confidence * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {result.mode === 'summary' && result.summary && (
            <div className="summary-results">
              <h4>Summary</h4>
              <div className="summary-text">{result.summary}</div>
            </div>
          )}

          {/* Keywords */}
          {result.mode === 'keywords' && result.keywords && (
            <div className="keywords-results">
              <h4>Keywords ({result.keywords.length})</h4>
              <div className="keywords-list">
                {result.keywords.map((keyword, idx) => (
                  <span key={idx} className="keyword-tag">{keyword}</span>
                ))}
              </div>
            </div>
          )}

          {/* Processing Time */}
          <div className="processing-info">
            <span>Extraction completed in {result.processing_time}ms</span>
          </div>
        </div>
      )}
    </div>
  );
}
