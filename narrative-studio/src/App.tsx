import { useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TextSizeProvider } from './contexts/TextSizeContext';
import { LoginPage } from './components/auth/LoginPage';
import { TopBar } from './components/layout/TopBar';
import { ArchivePanel } from './components/panels/ArchivePanel';
import { ToolsPanel } from './components/panels/ToolsPanel';
import { MainWorkspace } from './components/workspace/MainWorkspace';
import { api } from './utils/api';
import { runTransform } from './services/transformationService';
import { initializeSampleNarratives } from './data/sampleNarratives';
import type {
  Narrative,
  TransformConfig,
  TransformResult,
  WorkspaceMode,
} from './types';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [currentNarrativeId, setCurrentNarrativeId] = useState<string | null>(null);
  const [transformResults, setTransformResults] = useState<Map<string, TransformResult>>(
    new Map()
  );
  const [archivePanelOpen, setArchivePanelOpen] = useState(true);
  const [toolsPanelOpen, setToolsPanelOpen] = useState(true);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('single');
  const [isTransforming, setIsTransforming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize sample narratives and load from localStorage
  // NOTE: This must be called before conditional returns (Rules of Hooks)
  useEffect(() => {
    if (isAuthenticated) {
      initializeSampleNarratives();
      loadNarratives();
    }
  }, [isAuthenticated]);

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
    }

    setWorkspaceMode('single');
    setError(null);
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
      // Use local transformation service (Ollama) instead of cloud API
      console.log('[App] Running transformation:', config.type);
      const result = await runTransform(config, narrative.content);

      setTransformResults((prev) => {
        const next = new Map(prev);
        next.set(currentNarrativeId, result);
        return next;
      });

      setWorkspaceMode('split');
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
        archiveOpen={archivePanelOpen}
        toolsOpen={toolsPanelOpen}
      />

      <div className="flex-1 flex overflow-hidden">
        <ArchivePanel
          onSelectNarrative={handleSelectNarrative}
          isOpen={archivePanelOpen}
          onClose={() => setArchivePanelOpen(false)}
        />

        <MainWorkspace
          narrative={currentNarrative}
          transformResult={currentTransformResult}
          mode={workspaceMode}
          onUpdateNarrative={handleUpdateNarrative}
        />

        <ToolsPanel
          isOpen={toolsPanelOpen}
          onClose={() => setToolsPanelOpen(false)}
          onRunTransform={handleRunTransform}
          isTransforming={isTransforming}
        />
      </div>

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
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <TextSizeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </TextSizeProvider>
    </ThemeProvider>
  );
}
