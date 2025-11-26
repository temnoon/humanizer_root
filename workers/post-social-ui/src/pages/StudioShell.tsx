/**
 * Studio Shell - The Unified Studio-First Interface
 * 
 * This is THE interface. Users land here after login.
 * 
 * Structure:
 * - Left: NavigationPanel (FIND - browse, search, subscriptions)
 * - Center: ContentPanel (FOCUS - reader, editor, compare)
 * - Right: ContextPanel / CuratorPanel (TRANSFORM - tools, analysis, comments)
 * 
 * No separate pages for nodes, narratives, etc.
 * Everything is a mode within this shell.
 */

import { Component, createSignal, createEffect, Show, on } from 'solid-js';
import { useNavigate, useSearchParams, useParams } from '@solidjs/router';
import { authStore } from '@/stores/auth';
import { StudioLayout } from '@/components/studio/StudioLayout';
import { NavigationPanel, CenterMode } from '@/components/studio/NavigationPanel';
import { ContentPanel } from '@/components/studio/ContentPanel';
import { ContextPanel } from '@/components/studio/ContextPanel';
import { EditorPanel } from '@/components/studio/EditorPanel';
import { CuratorPanel } from '@/components/studio/CuratorPanel';
import { CuratorRulesEditor } from '@/components/studio/CuratorRulesEditor';
import { Lightbox, useLightbox } from '@/components/studio/Lightbox';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { curatorService, type Suggestion, type CuratorRules } from '@/services/curator';
import { nodesService } from '@/services/nodes';
import type { Narrative, Node } from '@/types/models';

export const StudioShell: Component = () => {
  const navigate = useNavigate();
  const params = useParams<{ 
    nodeSlug?: string; 
    narrativeSlug?: string;
    mode?: string;
  }>();
  const [searchParams] = useSearchParams();
  
  // Redirect if not authenticated
  if (!authStore.isAuthenticated()) {
    navigate('/login');
    return null;
  }
  
  // Current mode state
  const [mode, setMode] = createSignal<CenterMode>(getInitialMode());
  
  // Selected narrative (for context panel)
  const [selectedNarrative, setSelectedNarrative] = createSignal<Narrative | null>(null);
  
  // Editor mode flag
  const [isEditorMode, setIsEditorMode] = createSignal(false);
  
  // Editor content state (for curator panel analysis)
  const [editorContent, setEditorContent] = createSignal('');
  const [editorTitle, setEditorTitle] = createSignal('');
  
  // Editing existing narrative
  const [editingNarrative, setEditingNarrative] = createSignal<Narrative | null>(null);
  
  // Target node for new narratives
  const [targetNodeId, setTargetNodeId] = createSignal<string | undefined>(undefined);
  
  // Curator settings modal state
  const [curatorSettingsNodeId, setCuratorSettingsNodeId] = createSignal<string | null>(null);
  const [curatorSettingsNode, setCuratorSettingsNode] = createSignal<Node | null>(null);
  
  // Lightbox
  const lightbox = useLightbox();
  
  // Determine initial mode from URL params
  function getInitialMode(): CenterMode {
    // If we have route params, use them
    if (params.nodeSlug && params.narrativeSlug) {
      if (searchParams.compare) {
        const [from, to] = (searchParams.compare as string).split('-').map(Number);
        return {
          type: 'compare',
          nodeSlug: params.nodeSlug,
          narrativeSlug: params.narrativeSlug,
          fromVersion: from || 1,
          toVersion: to || 2
        };
      }
      return {
        type: 'narrative',
        nodeSlug: params.nodeSlug,
        narrativeSlug: params.narrativeSlug,
        version: searchParams.version ? parseInt(searchParams.version as string) : undefined
      };
    }
    
    if (params.nodeSlug) {
      return {
        type: 'node-detail',
        nodeId: '',
        nodeSlug: params.nodeSlug
      };
    }
    
    if (params.mode === 'edit') {
      return { type: 'editor' };
    }
    
    // Default: welcome
    return { type: 'welcome' };
  }
  
  // Sync mode changes to URL (optional, for deep linking)
  createEffect(() => {
    const currentMode = mode();
    // Could update URL here for shareable links
  });
  
  // Handle mode changes
  const handleModeChange = (newMode: CenterMode) => {
    setMode(newMode);
    
    // Clear selected narrative when changing away from narrative mode
    if (newMode.type !== 'narrative') {
      setSelectedNarrative(null);
    }
    
    // Switch editor mode
    setIsEditorMode(newMode.type === 'editor');
    
    // Clear editing state when leaving editor
    if (newMode.type !== 'editor') {
      setEditingNarrative(null);
      setEditorContent('');
      setEditorTitle('');
    }
  };
  
  // Handle create new narrative
  const handleCreateNew = (nodeId?: string) => {
    setEditingNarrative(null);
    setEditorContent('');
    setEditorTitle('');
    setTargetNodeId(nodeId);
    setIsEditorMode(true);
    setMode({ type: 'editor', nodeId });
  };
  
  // Handle edit existing narrative
  const handleEditNarrative = (narrative: Narrative) => {
    setEditingNarrative(narrative);
    setEditorContent(narrative.content);
    setEditorTitle(narrative.title);
    setTargetNodeId(narrative.nodeId);
    setIsEditorMode(true);
    setMode({ type: 'editor', nodeId: narrative.nodeId });
  };
  
  // Handle narrative selection (from ContentPanel)
  const handleNarrativeSelect = (narrative: Narrative) => {
    setSelectedNarrative(narrative);
  };
  
  // Handle editor content changes (for curator panel)
  const handleEditorChange = (content: string, title: string) => {
    setEditorContent(content);
    setEditorTitle(title);
  };
  
  // Handle publish success
  const handlePublishSuccess = (narrative: Narrative) => {
    // Navigate to the new/updated narrative
    if (narrative.nodeSlug && narrative.slug) {
      handleModeChange({
        type: 'narrative',
        nodeSlug: narrative.nodeSlug,
        narrativeSlug: narrative.slug
      });
    }
  };
  
  // Handle applying a curator suggestion
  const handleApplySuggestion = (suggestion: Suggestion) => {
    // This could insert text, modify content, etc.
    console.log('Apply suggestion:', suggestion);
    // For now, just log - actual implementation would depend on suggestion type
  };
  
  // Handle cancel editing
  const handleCancelEdit = () => {
    setEditingNarrative(null);
    setEditorContent('');
    setEditorTitle('');
    handleModeChange({ type: 'welcome' });
  };

  // Handle import from Gutenberg
  const handleImportFromGutenberg = (
    content: string,
    title: string,
    source: { bookTitle: string; author: string; chapter?: string }
  ) => {
    // Format the content with attribution
    const formattedContent = `${content}\n\n---\n*From "${source.bookTitle}" by ${source.author}${source.chapter ? ` - ${source.chapter}` : ''}*`;

    // Set up editor with the imported content
    setEditingNarrative(null);
    setEditorContent(formattedContent);
    setEditorTitle(title);
    setTargetNodeId(undefined); // User will select node when publishing
    setIsEditorMode(true);
    setMode({ type: 'editor' });
  };

  // Open curator settings modal
  const handleOpenCuratorSettings = async (nodeId: string) => {
    setCuratorSettingsNodeId(nodeId);
    
    // Fetch node details for the modal header
    const token = authStore.token();
    if (token) {
      try {
        const nodes = await nodesService.listNodes(token);
        const node = nodes.find((n: Node) => n.id === nodeId);
        if (node) {
          setCuratorSettingsNode(node);
        }
      } catch (err) {
        console.error('Failed to fetch node:', err);
      }
    }
  };
  
  // Close curator settings modal
  const handleCloseCuratorSettings = () => {
    setCuratorSettingsNodeId(null);
    setCuratorSettingsNode(null);
  };
  
  // Handle curator rules saved
  const handleCuratorRulesSaved = (rules: CuratorRules) => {
    console.log('Curator rules saved:', rules);
    // Could show a toast notification here
  };
  
  // Handle logout
  const handleLogout = () => {
    authStore.logout();
    navigate('/login');
  };
  
  return (
    <div class="studio-shell">
      {/* Header */}
      <header class="studio-shell-header">
        <div class="header-left">
          <h1 class="studio-logo">
            post<span class="accent">-social</span>
          </h1>
        </div>
        <div class="header-center">
          <Show when={isEditorMode() && editorTitle()}>
            <span class="current-title">
              {editingNarrative() ? '✏️ Editing: ' : '📝 New: '}
              {editorTitle() || 'Untitled'}
            </span>
          </Show>
        </div>
        <div class="header-right">
          <ThemeToggle />
          <span class="user-name">{authStore.user()?.email}</span>
          <button class="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>
      
      {/* Main Layout */}
      <StudioLayout
        leftPanel={
          <NavigationPanel
            currentMode={mode()}
            onModeChange={handleModeChange}
            onCreateNew={() => handleCreateNew()}
            onImportFromGutenberg={handleImportFromGutenberg}
          />
        }
        centerPanel={
          <Show
            when={!isEditorMode()}
            fallback={
              <EditorPanel
                initialContent={editingNarrative()?.content || editorContent() || ''}
                initialTitle={editingNarrative()?.title || editorTitle() || ''}
                editingNarrative={editingNarrative() || undefined}
                targetNodeId={targetNodeId()}
                onChange={handleEditorChange}
                onSave={(content, title) => {
                  console.log('Draft saved:', title);
                }}
                onPublish={handlePublishSuccess}
                onCancel={handleCancelEdit}
                onOpenCuratorSettings={handleOpenCuratorSettings}
              />
            }
          >
            <ContentPanel
              mode={mode()}
              onModeChange={handleModeChange}
              onNarrativeSelect={handleNarrativeSelect}
            />
          </Show>
        }
        rightPanel={
          <Show
            when={isEditorMode()}
            fallback={
              <ContextPanel
                mode={mode()}
                selectedNarrative={selectedNarrative()}
              />
            }
          >
            <CuratorPanel
              content={editorContent()}
              narrative={editingNarrative() || undefined}
              nodeId={targetNodeId()}
              onApplySuggestion={handleApplySuggestion}
              onIncorporateComment={(comment) => {
                // Insert comment content into editor
                console.log('Incorporate comment:', comment);
              }}
            />
          </Show>
        }
        leftTitle="Navigation"
        rightTitle={isEditorMode() ? 'AI Curator' : 'Context'}
        leftWidth={280}
        rightWidth={320}
      />
      
      {/* Curator Rules Modal */}
      <Show when={curatorSettingsNodeId()}>
        <div class="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) handleCloseCuratorSettings();
        }}>
          <div class="modal-container curator-modal">
            <CuratorRulesEditor
              nodeId={curatorSettingsNodeId()!}
              nodeName={curatorSettingsNode()?.name}
              onClose={handleCloseCuratorSettings}
              onSaved={handleCuratorRulesSaved}
            />
          </div>
        </div>
      </Show>
      
      {/* Global Lightbox */}
      <Show when={lightbox.state()}>
        <Lightbox
          item={lightbox.state()!.items[lightbox.state()!.currentIndex]}
          items={lightbox.state()!.items}
          currentIndex={lightbox.state()!.currentIndex}
          onClose={lightbox.close}
          onNext={lightbox.next}
          onPrev={lightbox.prev}
        />
      </Show>
    </div>
  );
};
