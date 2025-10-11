import { useState } from 'react';
import './ToolPanel.css';
import TransformationPanel from './TransformationPanel';
import AnalysisPanel from './AnalysisPanel';
import ExtractionPanel from './ExtractionPanel';
import ComparisonPanel from './ComparisonPanel';

type ToolType = 'transform' | 'analyze' | 'extract' | 'compare';

interface ToolPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  selectedContent?: {
    text: string;
    source: 'conversation' | 'message' | 'custom';
    sourceId?: string;
    messageId?: string;
  } | null;
}

/**
 * ToolPanel - Right-side toolbar for applying tools to content
 *
 * Features:
 * - Transformation (TRM vs LLM comparison)
 * - Content analysis
 * - Information extraction
 * - Side-by-side comparison
 */
export default function ToolPanel({ collapsed, onToggle, selectedContent }: ToolPanelProps) {
  const [activeTool, setActiveTool] = useState<ToolType | null>('transform');

  return (
    <div className={`tool-panel ${collapsed ? 'collapsed' : ''}`}>
      {/* Toggle button */}
      <button className="tool-panel-toggle" onClick={onToggle} title={collapsed ? 'Open Tools' : 'Close Tools'}>
        {collapsed ? '◀' : '▶'}
      </button>

      {!collapsed && (
        <>
          {/* Tool selector */}
          <div className="tool-selector">
            <button
              className={`tool-btn ${activeTool === 'transform' ? 'active' : ''}`}
              onClick={() => setActiveTool('transform')}
              title="Transform text using TRM or LLM"
            >
              🔄 Transform
            </button>
            <button
              className={`tool-btn ${activeTool === 'analyze' ? 'active' : ''}`}
              onClick={() => setActiveTool('analyze')}
              title="Analyze content with POVMs"
            >
              🔬 Analyze
            </button>
            <button
              className={`tool-btn ${activeTool === 'extract' ? 'active' : ''}`}
              onClick={() => setActiveTool('extract')}
              title="Extract information"
            >
              📋 Extract
            </button>
            <button
              className={`tool-btn ${activeTool === 'compare' ? 'active' : ''}`}
              onClick={() => setActiveTool('compare')}
              title="Compare versions"
            >
              ⚖️ Compare
            </button>
          </div>

          {/* Tool content */}
          <div className="tool-content">
            {activeTool === 'transform' && <TransformationPanel selectedContent={selectedContent} />}
            {activeTool === 'analyze' && <AnalysisPanel selectedContent={selectedContent} />}
            {activeTool === 'extract' && <ExtractionPanel selectedContent={selectedContent} />}
            {activeTool === 'compare' && <ComparisonPanel selectedContent={selectedContent} />}
          </div>
        </>
      )}
    </div>
  );
}
