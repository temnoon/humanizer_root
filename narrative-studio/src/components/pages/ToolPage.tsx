/**
 * ToolPage - Full-page tool view
 *
 * Mobile-first design: Tools get the full viewport.
 * Desktop users can toggle split-view via useLayoutPreference hook.
 *
 * The document content persists in context across route changes.
 */

import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useUnifiedBuffer } from '../../contexts/UnifiedBufferContext';
import { useLayoutPreference } from '../../hooks/useLayoutPreference';
import { TOOL_REGISTRY, type ToolId } from '../../contexts/ToolTabContext';

// Import individual tool panes
import { AIAnalysisPane } from '../tools/AIAnalysisPane';
import { V2AnalysisPane } from '../tools/V2AnalysisPane';
import { V3AnalysisPane } from '../tools/V3AnalysisPane';
import { SICAnalysisPane } from '../tools/SICAnalysisPane';
import { HumanizerPane, PersonaPane, StylePane, RoundTripPane, AddToBookPane } from '../tools/ToolPanes';
import { ExportPane } from '../tools/ExportPane';
import { ProfileFactoryPane } from '../tools/ProfileFactoryPane';
import { AdminProfilesPane } from '../tools/AdminProfilesPane';

// Tool component map
const TOOL_COMPONENTS: Record<ToolId, React.ComponentType<{ content: string; onApplyTransform?: (text: string) => void; onHighlightText?: (h: any[]) => void }>> = {
  'ai-analysis': AIAnalysisPane,
  'v2-analysis': V2AnalysisPane,
  'v3-analysis': V3AnalysisPane,
  'sic-analysis': SICAnalysisPane,
  'humanizer': HumanizerPane,
  'persona': PersonaPane,
  'style': StylePane,
  'round-trip': RoundTripPane,
  'export': ExportPane,
  'profile-factory': ProfileFactoryPane,
  'add-to-book': AddToBookPane,
  'admin-profiles': AdminProfilesPane as any,
};

export default function ToolPage() {
  const { toolId } = useParams<{ toolId: string }>();
  const navigate = useNavigate();
  const { workingBuffer, getTextContent, setWorkingBuffer } = useUnifiedBuffer();
  const { isMobile, preferSplitView, toggleSplitView } = useLayoutPreference();
  const [localContent, setLocalContent] = useState('');

  // Get the tool metadata
  const toolMeta = TOOL_REGISTRY.find(t => t.id === toolId);

  // Get content from buffer or local state
  const content = workingBuffer ? getTextContent() : localContent;

  // If on desktop and user prefers split view, redirect to main with tool panel open
  useEffect(() => {
    if (!isMobile && preferSplitView && toolId) {
      // Store the active tool in localStorage so main view knows which tool to show
      localStorage.setItem('narrative-studio-active-tool', toolId);
      navigate('/', { replace: true });
    }
  }, [isMobile, preferSplitView, toolId, navigate]);

  // Handle 404 for invalid tool IDs
  if (!toolMeta || !toolId) {
    return (
      <div className="tool-page tool-page--not-found">
        <div className="tool-page__header">
          <Link to="/" className="tool-page__back-btn">
            <span className="tool-page__back-icon">←</span>
            Back to Workspace
          </Link>
        </div>
        <div className="tool-page__content">
          <h1>Tool Not Found</h1>
          <p>The tool "{toolId}" does not exist.</p>
          <Link to="/" className="tool-page__home-link">
            Return to Workspace
          </Link>
        </div>
      </div>
    );
  }

  // Get the tool component
  const ToolComponent = TOOL_COMPONENTS[toolId as ToolId];

  // Handle transform application - update the buffer
  const handleApplyTransform = (transformedText: string) => {
    if (workingBuffer) {
      // Create a new buffer with the transformed content
      // BufferContent uses 'text' property, not 'content'
      setWorkingBuffer({
        ...workingBuffer,
        text: transformedText,
      } as any); // Type assertion needed due to union type complexity
    } else {
      setLocalContent(transformedText);
    }
  };

  return (
    <div className="tool-page">
      {/* Header with navigation and tool info */}
      <header className="tool-page__header">
        <Link to="/" className="tool-page__back-btn">
          <span className="tool-page__back-icon">←</span>
          <span className="tool-page__back-text">Workspace</span>
        </Link>

        <div className="tool-page__title">
          <span className="tool-page__icon">{toolMeta.icon}</span>
          <h1 className="tool-page__name">{toolMeta.label}</h1>
        </div>

        <div className="tool-page__actions">
          {/* Desktop: Split view toggle */}
          {!isMobile && (
            <button
              onClick={toggleSplitView}
              className="tool-page__split-toggle"
              title={preferSplitView ? 'Using split view' : 'Using full page'}
            >
              {preferSplitView ? '◫' : '□'}
            </button>
          )}
        </div>
      </header>

      {/* Tool navigation - quick switch between tools */}
      <nav className="tool-page__nav">
        {TOOL_REGISTRY.filter(t => t.id !== 'admin-profiles').map(tool => (
          <Link
            key={tool.id}
            to={`/tool/${tool.id}`}
            className={`tool-page__nav-item ${tool.id === toolId ? 'tool-page__nav-item--active' : ''}`}
            title={tool.label}
          >
            <span className="tool-page__nav-icon">{tool.icon}</span>
          </Link>
        ))}
      </nav>

      {/* Document preview bar (shows what content is loaded) */}
      {content && (
        <div className="tool-page__document-bar">
          <span className="tool-page__document-icon">📄</span>
          <span className="tool-page__document-info">
            {content.split(/\s+/).filter(Boolean).length} words loaded
          </span>
          <button
            onClick={() => navigate('/')}
            className="tool-page__document-edit"
            title="Edit document"
          >
            Edit
          </button>
        </div>
      )}

      {/* Main tool content area */}
      <main className="tool-page__content">
        {ToolComponent ? (
          <ToolComponent
            content={content}
            onApplyTransform={handleApplyTransform}
            onHighlightText={() => {}}
          />
        ) : (
          <div className="tool-page__placeholder">
            <p>Tool component not available</p>
          </div>
        )}
      </main>

      {/* Empty state - no content loaded */}
      {!content && (
        <div className="tool-page__empty">
          <div className="tool-page__empty-icon">📝</div>
          <h2 className="tool-page__empty-title">No Content Loaded</h2>
          <p className="tool-page__empty-text">
            Go to the workspace to load or paste content, then return here to analyze.
          </p>
          <Link to="/" className="tool-page__empty-action">
            Open Workspace
          </Link>
        </div>
      )}
    </div>
  );
}
