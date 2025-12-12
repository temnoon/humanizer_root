import { useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TextSizeProvider } from './contexts/TextSizeContext';
import { SessionProvider, useSession } from './contexts/SessionContext';
import { ProviderProvider } from './contexts/ProviderContext';
import { ExploreProvider } from './contexts/ExploreContext';
import { ActiveBookProvider } from './contexts/ActiveBookContext';
import { UnifiedBufferProvider, useUnifiedBuffer } from './contexts/UnifiedBufferContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { LoginPage } from './components/auth/LoginPage';
import { TopBar } from './components/layout/TopBar';
import { PanelToggle } from './components/layout/PanelToggle';
import { ArchivePanel } from './components/panels/ArchivePanel';
import { ToolsPanel } from './components/panels/ToolsPanel';
import { StudioToolsPanel } from './components/panels/StudioToolsPanel';
import { TabbedToolsPanel } from './components/tools';
import { MainWorkspace } from './components/workspace/MainWorkspace';
import { SetupWizard } from './components/onboarding';
import { SettingsModal } from './components/settings';
import { api } from './utils/api';
import { runTransform } from './services/transformationService';
import { initializeSampleNarratives } from './data/sampleNarratives';
import { formatToolName } from './config/tool-names';
import { NARRATIVE_STUDIO_SOURCE } from './config/buffer-constants';
import { VIEW_MODES, ANALYSIS_VIEW_MODE, TRANSFORMATION_VIEW_MODE } from './config/view-modes';
import type {
  Narrative,
  TransformConfig,
  TransformResult,
  TransformationType,
  TransformParameters,
  WorkspaceMode,
} from './types';

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const {
    hasSession,
    buffers,
    getActiveBuffer,
    autoCreateSession,
    createOriginalBuffer,
    createTransformationBuffer,
    updateViewMode
  } = useSession();
  // UnifiedBuffer for syncing narrative selection with buffer system
  const { createFromText, setWorkingBuffer, clearWorkingBuffer } = useUnifiedBuffer();
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [currentNarrativeId, setCurrentNarrativeId] = useState<string | null>(null);
  const [transformResults, setTransformResults] = useState<Map<string, TransformResult>>(
    new Map()
  );
  const [archivePanelOpen, setArchivePanelOpen] = useState(true);
  const [toolsPanelOpen, setToolsPanelOpen] = useState(true);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('single');
  const [viewPreference, setViewPreference] = useState<'split' | 'tabs'>(() => {
    const saved = localStorage.getItem('narrative-studio-view-preference');
    return (saved === 'split' || saved === 'tabs') ? saved : 'split';
  });
  const [archivePanelWidth, setArchivePanelWidth] = useState(() => {
    const saved = localStorage.getItem('narrative-studio-archive-width');
    return saved ? Number(saved) : 300;
  });
  const [toolsPanelWidth, setToolsPanelWidth] = useState(() => {
    const saved = localStorage.getItem('narrative-studio-tools-width');
    return saved ? Number(saved) : 350;
  });
  const [isResizing, setIsResizing] = useState<'archive' | 'tools' | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiAnalysisHighlights, setAiAnalysisHighlights] = useState<Array<{
    start: number;
    end: number;
    reason: string;
    type?: 'tellword' | 'suspect' | 'gptzero';
  }>>([]);
  const [useStudioTools, setUseStudioTools] = useState<boolean>(() => {
    const saved = localStorage.getItem('narrative-studio-use-studio-tools');
    return saved === 'true';
  });

  // Transformation configuration state (lifted from ToolsPanel)
  const [selectedTransformType, setSelectedTransformType] = useState<TransformationType>('computer-humanizer');
  const [transformParameters, setTransformParameters] = useState<TransformParameters>({
    // Computer Humanizer defaults
    intensity: 'moderate',
    useLLM: false,
    // Persona/Style defaults (will be updated from API)
    persona: '',
    style: '',
    // Round-Trip Translation defaults
    intermediateLanguage: 'spanish',
    // AI Detection defaults
    threshold: 0.2,
  });

  // Initialize sample narratives and load from localStorage
  // NOTE: This must be called before conditional returns (Rules of Hooks)
  useEffect(() => {
    if (isAuthenticated) {
      initializeSampleNarratives();
      loadNarratives();
    }
  }, [isAuthenticated]);

  // Persist view preference to localStorage
  useEffect(() => {
    localStorage.setItem('narrative-studio-view-preference', viewPreference);
  }, [viewPreference]);

  // Persist panel widths to localStorage
  useEffect(() => {
    localStorage.setItem('narrative-studio-archive-width', String(archivePanelWidth));
  }, [archivePanelWidth]);

  useEffect(() => {
    localStorage.setItem('narrative-studio-tools-width', String(toolsPanelWidth));
  }, [toolsPanelWidth]);

  // Persist studio tools preference
  useEffect(() => {
    localStorage.setItem('narrative-studio-use-studio-tools', String(useStudioTools));
  }, [useStudioTools]);

  // Responsive panel behavior
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleResize = () => {
      if (window.innerWidth < 768) {
        // Close panels on mobile by default
        setArchivePanelOpen(false);
        setToolsPanelOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAuthenticated]);

  // Resize handlers for panels
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing === 'archive') {
        const newWidth = Math.max(200, Math.min(600, e.clientX));
        setArchivePanelWidth(newWidth);
      } else if (isResizing === 'tools') {
        const newWidth = Math.max(200, Math.min(600, window.innerWidth - e.clientX));
        setToolsPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}
          />
          <p className="ui-text text-sm" style={{ color: 'var(--text-secondary)' }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const loadNarratives = async () => {
    try {
      const loaded = await api.getNarratives();
      setNarratives(loaded);

      // Don't auto-select sample narratives - let the Archive panel handle loading
      // the first message of the most recent conversation instead
    } catch (err) {
      console.error('Failed to load narratives:', err);
    }
  };

  const handleSelectNarrative = (narrativeOrId: string | Narrative) => {
    if (typeof narrativeOrId === 'string') {
      // Selecting by ID (from existing narratives list)
      setCurrentNarrativeId(narrativeOrId);
    } else {
      // Selecting a narrative object (from archive)
      const narrative = narrativeOrId;

      // Add to narratives if not already present
      const existingIndex = narratives.findIndex((n) => n.id === narrative.id);
      if (existingIndex === -1) {
        setNarratives((prev) => [narrative, ...prev]);
      } else {
        // Update existing narrative
        setNarratives((prev) =>
          prev.map((n) => (n.id === narrative.id ? narrative : n))
        );
      }

      setCurrentNarrativeId(narrative.id);

      // IMPORTANT: Clear any existing workspace buffer when loading new content
      // This ensures the new narrative content displays, not stale buffer content
      clearWorkingBuffer();
    }

    setWorkspaceMode('single');
    setError(null);
    // Clear AI analysis highlights when switching narratives - they're not valid for new content
    setAiAnalysisHighlights([]);
  };

  const handleUpdateNarrative = async (content: string) => {
    if (!currentNarrativeId) return;

    const narrative = narratives.find((n) => n.id === currentNarrativeId);
    if (!narrative) return;

    const updated: Narrative = {
      ...narrative,
      content,
      metadata: {
        ...narrative.metadata,
        wordCount: content.split(/\s+/).length,
      },
    };

    try {
      await api.saveNarrative(updated);
      setNarratives((prev) =>
        prev.map((n) => (n.id === currentNarrativeId ? updated : n))
      );
    } catch (err) {
      console.error('Failed to save narrative:', err);
      setError('Failed to save changes');
    }
  };

  const handleRunTransform = async (config: TransformConfig) => {
    if (!currentNarrativeId) return;

    const narrative = narratives.find((n) => n.id === currentNarrativeId);
    if (!narrative) return;

    setIsTransforming(true);
    setError(null);

    try {
      // Get text to transform: selected text > transform source setting > narrative content
      let textToTransform: string;
      if (selectedText?.text) {
        textToTransform = selectedText.text;
      } else if (hasSession && buffers.length > 0) {
        // Check user's transform source preference
        const transformSource = localStorage.getItem('narrative-studio-transform-source') || 'active';

        if (transformSource === 'original') {
          // Always use original buffer (buffer-0)
          const originalBuffer = buffers.find(b => b.bufferId === 'buffer-0');
          textToTransform = originalBuffer?.text || narrative.content;
          console.log('[App] Using original buffer (buffer-0):', `(${textToTransform.length} chars)`);
        } else {
          // Use active buffer text (chain transformations)
          const activeBuffer = getActiveBuffer();
          // Original buffers use 'text', transformation buffers use 'resultText'
          textToTransform = activeBuffer?.text || activeBuffer?.resultText || narrative.content;
          console.log('[App] Using active buffer text:', activeBuffer?.bufferId, `(${textToTransform.length} chars)`);
        }
      } else {
        // No session - use original narrative content
        textToTransform = narrative.content;
      }
      console.log('[App] Running transformation:', config.type, selectedText ? '(selection)' : '(full)');
      const result = await runTransform(config, textToTransform);

      // If scoped transformation, add metadata about the selection
      if (selectedText) {
        result.metadata = {
          ...result.metadata,
          scopedTransformation: {
            originalSelection: selectedText.text,
            transformedSelection: result.transformed,
            fullDocument: narrative.content,
            selectionStart: selectedText.start,
            selectionEnd: selectedText.end,
          },
        };
      }

      setTransformResults((prev) => {
        const next = new Map(prev);
        next.set(currentNarrativeId, result);
        return next;
      });

      // Auto-create session or add buffer to existing session
      if (!hasSession) {
        console.log('[App] Auto-creating session for transformation:', config.type);

        // Create buffers array
        const buffers = [];

        // Create original buffer (buffer-0)
        const originalBuffer = createOriginalBuffer(
          narrative.content,
          NARRATIVE_STUDIO_SOURCE,
          currentNarrativeId
        );
        if (originalBuffer) {
          buffers.push(originalBuffer);
          console.log('[App] Created original buffer:', originalBuffer.bufferId);
        }

        // Create transformation result buffer
        const toolName = formatToolName(config.type, config);

        const transformBuffer = createTransformationBuffer(
          toolName,
          config,
          result.transformed,
          originalBuffer?.bufferId
        );
        if (transformBuffer) {
          buffers.push(transformBuffer);
          console.log('[App] Created transformation buffer:', transformBuffer.bufferId);
        }

        // Auto-create session with both buffers
        if (buffers.length > 0) {
          await autoCreateSession(buffers, currentNarrativeId);
          console.log('[App] Session auto-created with', buffers.length, 'buffers');

          // Set view mode to split for transformations, single for analysis
          if (result.metadata?.aiDetection) {
            updateViewMode(ANALYSIS_VIEW_MODE);
          } else {
            updateViewMode(TRANSFORMATION_VIEW_MODE);
          }
        }
      } else {
        // Session exists - add new buffer to existing session
        console.log('[App] Adding buffer to existing session:', config.type);

        const toolName = formatToolName(config.type, config);

        // Create transformation buffer linked to current active buffer
        const transformBuffer = createTransformationBuffer(
          toolName,
          config,
          result.transformed,
          undefined  // Will use current active buffer as source
        );

        if (transformBuffer) {
          console.log('[App] Created chained transformation buffer:', transformBuffer.bufferId);
          // Buffer is automatically added to session by createTransformationBuffer
          // and becomes the new active buffer
        }

        // Update view mode for existing session transformations
        if (result.metadata?.aiDetection) {
          updateViewMode(ANALYSIS_VIEW_MODE);
        } else {
          updateViewMode(TRANSFORMATION_VIEW_MODE);
        }
      }

      // All transformations use split mode: original left, result right
      // AI detection shows highlighted text in right pane
      setWorkspaceMode('split');

      // Clear selection after transform
      setSelectedText(null);
    } catch (err: any) {
      console.error('Transformation failed:', err);
      setError(err.message || 'Transformation failed');
    } finally {
      setIsTransforming(false);
    }
  };

  const currentNarrative = narratives.find((n) => n.id === currentNarrativeId) || null;
  const currentTransformResult = currentNarrativeId
    ? transformResults.get(currentNarrativeId) || null
    : null;

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <TopBar
        currentNarrative={currentNarrative}
        onToggleArchive={() => setArchivePanelOpen((o) => !o)}
        onToggleTools={() => setToolsPanelOpen((o) => !o)}
        onToggleView={() => setViewPreference((v) => (v === 'split' ? 'tabs' : 'split'))}
        onOpenSettings={() => setSettingsOpen(true)}
        archiveOpen={archivePanelOpen}
        toolsOpen={toolsPanelOpen}
        viewPreference={viewPreference}
        workspaceMode={workspaceMode}
        useStudioTools={useStudioTools}
        onToggleStudioTools={() => setUseStudioTools((v) => !v)}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Archive Panel */}
        {archivePanelOpen && (
          <div
            className="relative flex-shrink-0"
            style={{
              width: `${archivePanelWidth}px`,
              minWidth: `${archivePanelWidth}px`,
              maxWidth: `${archivePanelWidth}px`,
              height: '100%'
            }}
          >
          <ArchivePanel
            onSelectNarrative={handleSelectNarrative}
            isOpen={archivePanelOpen}
            onClose={() => setArchivePanelOpen(false)}
          />
          <div
            className="resize-handle resize-handle-right hidden md:block"
            onMouseDown={() => setIsResizing('archive')}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: -4,
              width: '8px',
              cursor: 'col-resize',
              zIndex: 10,
              backgroundColor: 'transparent',
              transition: 'background-color 0.2s',
            }}
          />
          </div>
        )}

        <div
          className="flex-1 min-w-0 flex flex-col"
          style={{
            minHeight: 0,
            height: '100%',
          }}
        >
          <MainWorkspace
            narrative={currentNarrative}
            transformResult={currentTransformResult}
            mode={workspaceMode}
            viewPreference={viewPreference}
            onUpdateNarrative={handleUpdateNarrative}
            selectedText={selectedText}
            onTextSelection={setSelectedText}
            aiAnalysisHighlights={aiAnalysisHighlights}
          />
        </div>

        {/* Tools Panel */}
        {toolsPanelOpen && (
          <div
            className="relative flex-shrink-0"
            style={{
              width: `${toolsPanelWidth}px`,
              minWidth: `${toolsPanelWidth}px`,
              maxWidth: `${toolsPanelWidth}px`,
              height: '100%'
            }}
          >
          <div
            className="resize-handle resize-handle-left hidden md:block"
            onMouseDown={() => setIsResizing('tools')}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: -4,
              width: '8px',
              cursor: 'col-resize',
              zIndex: 10,
              backgroundColor: 'transparent',
              transition: 'background-color 0.2s',
            }}
          />
          {useStudioTools ? (
            <StudioToolsPanel
              isOpen={toolsPanelOpen}
              onClose={() => setToolsPanelOpen(false)}
              content={currentNarrative?.content ?? ''}
              onApplyTransform={(transformedText) => {
                // Apply the transformed text to the current narrative
                if (currentNarrative) {
                  handleUpdateNarrative(transformedText);
                }
              }}
            />
          ) : (
            <TabbedToolsPanel
              isOpen={toolsPanelOpen}
              onClose={() => setToolsPanelOpen(false)}
              content={currentNarrative?.content ?? ''}
              onApplyTransform={(transformedText) => {
                // Apply the transformed text to the current narrative
                if (currentNarrative) {
                  handleUpdateNarrative(transformedText);
                }
              }}
              onHighlightText={setAiAnalysisHighlights}
            />
          )}
          </div>
        )}
      </div>

      {/* Panel Toggles */}
      <PanelToggle
        side="left"
        isOpen={archivePanelOpen}
        onToggle={() => setArchivePanelOpen(true)}
        label="Archive"
      />
      <PanelToggle
        side="right"
        isOpen={toolsPanelOpen}
        onToggle={() => setToolsPanelOpen(true)}
        label="Tools"
      />

      {/* Error toast */}
      {error && (
        <div
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 px-8 py-4 rounded-lg shadow-2xl max-w-2xl z-50"
          style={{
            backgroundColor: 'var(--error)',
            color: 'white',
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <p className="ui-text text-sm text-center flex-1" style={{ paddingLeft: '8px' }}>{error}</p>
            <button
              onClick={() => setError(null)}
              className="ui-text text-sm font-semibold hover:opacity-80 flex-shrink-0"
              style={{ padding: '4px 8px' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

function AppWithSession() {
  const { user } = useAuth();
  const userTier = user?.role || 'free';

  return (
    <SessionProvider userTier={userTier} archiveName="main">
      <UnifiedBufferProvider archiveName="main">
        <WorkspaceProvider>
          <ExploreProvider>
            <ActiveBookProvider>
              <AppContent />
            </ActiveBookProvider>
          </ExploreProvider>
        </WorkspaceProvider>
      </UnifiedBufferProvider>
    </SessionProvider>
  );
}

/**
 * Check if running in Electron and if first-run wizard should be shown
 */
function useFirstRunCheck() {
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    async function checkFirstRun() {
      // Dev mode: allow forcing wizard via URL param (?wizard=true)
      const urlParams = new URLSearchParams(window.location.search);
      const forceWizard = urlParams.get('wizard') === 'true';

      if (forceWizard) {
        console.log('[App] Forcing wizard mode via URL param');
        setIsElectron(true); // Pretend we're in Electron for UI purposes
        setIsFirstRun(true);
        return;
      }

      // Check if running in Electron
      if (window.isElectron && window.electronAPI) {
        setIsElectron(true);
        const firstRun = await window.electronAPI.isFirstRun();
        setIsFirstRun(firstRun);
      } else {
        // Not in Electron - skip wizard
        setIsElectron(false);
        setIsFirstRun(false);
      }
    }
    checkFirstRun();
  }, []);

  const completeFirstRun = () => {
    setIsFirstRun(false);
    // Remove wizard param from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('wizard');
    window.history.replaceState({}, '', url.toString());
  };

  return { isFirstRun, isElectron, completeFirstRun };
}

export default function App() {
  const { isFirstRun, isElectron, completeFirstRun } = useFirstRunCheck();

  // Show loading while checking first-run status (only in Electron)
  if (isElectron && isFirstRun === null) {
    return (
      <ThemeProvider>
        <div
          className="h-screen flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <div className="text-center">
            <div
              className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-4"
              style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}
            />
            <p className="ui-text text-sm" style={{ color: 'var(--text-secondary)' }}>
              Starting Humanizer Studio...
            </p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Show setup wizard on first run (Electron only)
  if (isElectron && isFirstRun) {
    return (
      <ThemeProvider>
        <SetupWizard onComplete={completeFirstRun} />
      </ThemeProvider>
    );
  }

  // Normal app flow
  return (
    <ThemeProvider>
      <TextSizeProvider>
        <ProviderProvider>
          <AuthProvider>
            <AppWithSession />
          </AuthProvider>
        </ProviderProvider>
      </TextSizeProvider>
    </ThemeProvider>
  );
}
