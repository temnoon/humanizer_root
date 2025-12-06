/**
 * Chapter Viewer Component
 *
 * Modal viewer for displaying a single chapter's content.
 * Shows reformatted markdown with beautiful typography.
 */

import { Component, Show, createResource, onMount, onCleanup } from 'solid-js';
import { workingTextsService } from '@/services/working-texts';
import './ChapterViewer.css';

interface ChapterViewerProps {
  nodeId: string;
  chapterNumber: number;
  onClose: () => void;
}

export const ChapterViewer: Component<ChapterViewerProps> = (props) => {
  let modalRef: HTMLDivElement | undefined;

  const [chapter] = createResource(
    () => ({ nodeId: props.nodeId, chapterNumber: props.chapterNumber }),
    async ({ nodeId, chapterNumber }) => {
      try {
        return await workingTextsService.getChapterContent(nodeId, chapterNumber);
      } catch (error) {
        console.error('Failed to load chapter:', error);
        return null;
      }
    }
  );

  // Handle escape key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose();
    }
  };

  // Handle click outside
  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === modalRef) {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
    document.body.style.overflow = '';
  });

  return (
    <div
      ref={modalRef}
      class="chapter-viewer-backdrop"
      onClick={handleBackdropClick}
    >
      <div class="chapter-viewer-modal">
        {/* Header */}
        <header class="chapter-viewer-header">
          <div class="header-info">
            <span class="chapter-number-badge">
              Chapter {props.chapterNumber}
            </span>
            <Show when={chapter()}>
              <h2 class="chapter-title">{chapter()!.title}</h2>
            </Show>
          </div>
          <button
            class="close-button"
            onClick={props.onClose}
            aria-label="Close chapter viewer"
          >
            ✕
          </button>
        </header>

        {/* Content */}
        <div class="chapter-viewer-content">
          <Show
            when={!chapter.loading && chapter()}
            fallback={
              <div class="chapter-loading">
                <div class="loading-spinner" />
                <p>Loading chapter...</p>
              </div>
            }
          >
            <Show
              when={chapter()}
              fallback={
                <div class="chapter-error">
                  <p>Failed to load chapter content.</p>
                </div>
              }
            >
              <article class="chapter-text">
                {/* Render markdown content */}
                <div
                  class="markdown-content"
                  innerHTML={convertMarkdownToHTML(chapter()!.workingContent)}
                />
              </article>

              {/* Footer with metadata */}
              <footer class="chapter-footer">
                <div class="chapter-stats">
                  <span class="stat">
                    {chapter()!.wordCount.toLocaleString()} words
                  </span>
                  <span class="stat">
                    ~{Math.ceil(chapter()!.wordCount / 200)} min read
                  </span>
                </div>
                <Show when={chapter()!.enhancements}>
                  <div class="enhancements-info">
                    <span class="enhancement-note">
                      Reformatted from original text
                    </span>
                  </div>
                </Show>
              </footer>
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
};

/**
 * Simple markdown to HTML converter
 * (For production, consider using a library like marked or remark)
 */
function convertMarkdownToHTML(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');

  // Blockquotes
  html = html.replace(/^&gt; (.*$)/gim, '<blockquote>$1</blockquote>');
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr>');
  html = html.replace(/^\*\*\*$/gim, '<hr>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>');

  // Paragraphs (split by double newlines)
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs
    .map((p) => {
      p = p.trim();
      // Don't wrap if already a block element
      if (
        p.startsWith('<h') ||
        p.startsWith('<blockquote') ||
        p.startsWith('<hr') ||
        p === ''
      ) {
        return p;
      }
      return `<p>${p}</p>`;
    })
    .join('\n');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

export default ChapterViewer;
