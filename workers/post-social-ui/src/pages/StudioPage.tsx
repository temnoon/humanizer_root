/**
 * Narrative Studio Page
 * 
 * Full 3-panel narrative composition environment.
 * - Left: Archive browser
 * - Center: Editor with split view
 * - Right: AI Curator
 */

import { Component, createSignal, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import { 
  StudioLayout, 
  ArchivePanel, 
  EditorPanel, 
  CuratorPanel,
  Lightbox,
  useLightbox
} from '@/components/studio';
import type { LightboxItem } from '@/components/studio';

export const StudioPage: Component = () => {
  const params = useParams<{ nodeId?: string }>();
  const navigate = useNavigate();
  const lightbox = useLightbox();
  
  // Redirect if not authenticated
  if (!authStore.isAuthenticated()) {
    navigate('/login');
    return null;
  }
  
  const [editorContent, setEditorContent] = createSignal('');
  const [editorTitle, setEditorTitle] = createSignal('');
  const [isSaving, setIsSaving] = createSignal(false);
  const [isPublishing, setIsPublishing] = createSignal(false);
  
  // Handle content from archive
  const handleInsertFromArchive = (content: string) => {
    setEditorContent(prev => prev + '\n\n' + content);
  };
  
  // Handle editor changes
  const handleEditorChange = (content: string, title: string) => {
    setEditorContent(content);
    setEditorTitle(title);
  };
  
  // Save draft (local storage for now)
  const handleSave = async (content: string, title: string) => {
    setIsSaving(true);
    try {
      localStorage.setItem('studio-draft', JSON.stringify({ content, title, savedAt: Date.now() }));
      // In future: save to server as draft
    } finally {
      setIsSaving(false);
    }
  };
  
  // Publish to node
  const handlePublish = async (content: string, title: string, tags: string[]) => {
    const token = authStore.token();
    if (!token || !params.nodeId) {
      // Need to select a node first
      alert('Please select a target Node first');
      return;
    }
    
    setIsPublishing(true);
    try {
      const narrative = await nodesService.publishNarrative(
        params.nodeId,
        { title, content, tags },
        token
      );
      
      // Navigate to the new narrative
      navigate(`/node/${narrative.nodeSlug || params.nodeId}/${narrative.slug}`);
    } catch (err) {
      console.error('Failed to publish:', err);
      alert('Failed to publish narrative');
    } finally {
      setIsPublishing(false);
    }
  };
  
  // Handle AI suggestion
  const handleApplySuggestion = (suggestion: any) => {
    // In future: intelligently apply suggestion to content
    console.log('Apply suggestion:', suggestion);
  };
  
  // Handle comment incorporation
  const handleIncorporateComment = (comment: any) => {
    // In future: AI-assisted comment synthesis
    console.log('Incorporate comment:', comment);
  };
  
  // Open media in lightbox
  const handleOpenLightbox = (src: string, alt?: string) => {
    const item: LightboxItem = {
      type: src.match(/\.(mp4|webm|ogg)$/i) ? 'video' 
           : src.match(/\.pdf$/i) ? 'pdf'
           : 'image',
      src,
      alt
    };
    lightbox.open(item);
  };
  
  return (
    <div class="studio-page">
      {/* Header */}
      <header class="studio-header">
        <div class="studio-header-left">
          <button class="back-btn" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h1 class="studio-title">Narrative Studio</h1>
        </div>
        <div class="studio-header-right">
          <span class="user-email">{authStore.user()?.email}</span>
        </div>
      </header>
      
      {/* Main Studio Layout */}
      <StudioLayout
        leftPanel={
          <ArchivePanel
            onInsert={handleInsertFromArchive}
          />
        }
        centerPanel={
          <EditorPanel
            onChange={handleEditorChange}
            onSave={handleSave}
            onPublish={handlePublish}
            onOpenLightbox={handleOpenLightbox}
          />
        }
        rightPanel={
          <CuratorPanel
            content={editorContent()}
            onApplySuggestion={handleApplySuggestion}
            onIncorporateComment={handleIncorporateComment}
          />
        }
        leftTitle="Archive"
        rightTitle="AI Curator"
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
