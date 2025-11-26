/**
 * Narrative Studio Page
 * 
 * Full 3-panel narrative composition environment:
 * - Left: Archive browser (personal content, references)
 * - Center: Main editor with split edit/preview
 * - Right: AI curator with suggestions and comments
 * 
 * Includes global lightbox for media viewing.
 */

import { Component, createSignal, Show } from 'solid-js';
import { useParams, useNavigate, useSearchParams } from '@solidjs/router';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import { StudioLayout } from '@/components/studio/StudioLayout';
import { ArchivePanel } from '@/components/studio/ArchivePanel';
import { EditorPanel } from '@/components/studio/EditorPanel';
import { CuratorPanel } from '@/components/studio/CuratorPanel';
import { Lightbox, useLightbox, LightboxItem } from '@/components/studio/Lightbox';

export const NarrativeStudioPage: Component = () => {
  const params = useParams<{ nodeSlug?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Redirect if not authenticated
  if (!authStore.isAuthenticated()) {
    navigate('/login');
    return null;
  }
  
  // Editor state
  const [content, setContent] = createSignal('');
  const [title, setTitle] = createSignal('');
  const [nodeId, setNodeId] = createSignal<string | null>(searchParams.node || null);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isPublishing, setIsPublishing] = createSignal(false);
  
  // Lightbox state
  const lightbox = useLightbox();
  
  // Handle content changes from editor
  const handleEditorChange = (newContent: string, newTitle: string) => {
    setContent(newContent);
    setTitle(newTitle);
  };
  
  // Handle save draft (local storage for now)
  const handleSave = (content: string, title: string) => {
    setIsSaving(true);
    
    // Save to localStorage as draft
    const draft = {
      title,
      content,
      nodeId: nodeId(),
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('post-social:draft', JSON.stringify(draft));
    
    setTimeout(() => setIsSaving(false), 500);
  };
  
  // Handle publish
  const handlePublish = async (content: string, title: string, tags: string[]) => {
    const token = authStore.token();
    const targetNodeId = nodeId();
    
    if (!token || !targetNodeId) {
      // TODO: Show node selection modal
      alert('Please select a Node to publish to');
      return;
    }
    
    setIsPublishing(true);
    
    try {
      const narrative = await nodesService.publishNarrative(
        targetNodeId,
        { title, content, tags },
        token
      );
      
      // Clear draft
      localStorage.removeItem('post-social:draft');
      
      // Navigate to the new narrative
      navigate(`/node/${params.nodeSlug || 'phenomenology'}/${narrative.slug}`);
    } catch (err) {
      console.error('Failed to publish:', err);
      alert('Failed to publish narrative. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };
  
  // Handle archive item selection - insert into editor
  const handleArchiveInsert = (content: string) => {
    // Append to current content with a divider
    setContent(prev => {
      if (prev.trim()) {
        return `${prev}\n\n---\n\n${content}`;
      }
      return content;
    });
  };
  
  // Handle lightbox open (for images in content)
  const handleOpenLightbox = (src: string, alt?: string) => {
    lightbox.open({
      type: 'image',
      src,
      alt,
      title: alt
    });
  };
  
  // Load draft on mount
  const loadDraft = () => {
    const saved = localStorage.getItem('post-social:draft');
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        setContent(draft.content || '');
        setTitle(draft.title || '');
        if (draft.nodeId) setNodeId(draft.nodeId);
      } catch (e) {
        console.error('Failed to load draft:', e);
      }
    }
  };
  
  // Load draft on component mount
  loadDraft();
  
  return (
    <div class="studio-page">
      {/* Studio Header */}
      <header class="studio-header">
        <div class="studio-header-left">
          <button 
            class="back-btn"
            onClick={() => navigate('/notes')}
          >
            ← Back
          </button>
          <h1 class="studio-title">Narrative Studio</h1>
        </div>
        
        <div class="studio-header-center">
          <Show when={isSaving()}>
            <span class="save-indicator">Saving...</span>
          </Show>
          <Show when={isPublishing()}>
            <span class="publish-indicator">Publishing...</span>
          </Show>
        </div>
        
        <div class="studio-header-right">
          <span class="user-email">{authStore.user()?.email}</span>
        </div>
      </header>
      
      {/* Main Studio Layout */}
      <StudioLayout
        leftPanel={
          <ArchivePanel 
            onInsert={handleArchiveInsert}
          />
        }
        centerPanel={
          <EditorPanel
            initialContent={content()}
            initialTitle={title()}
            onChange={handleEditorChange}
            onSave={handleSave}
            onPublish={handlePublish}
            onOpenLightbox={handleOpenLightbox}
          />
        }
        rightPanel={
          <CuratorPanel
            content={content()}
          />
        }
        leftTitle="Archive"
        rightTitle="AI Curator"
        leftWidth={300}
        rightWidth={350}
      />
      
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
