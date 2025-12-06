/**
 * Working Texts List Component
 *
 * Displays list of book chapters (working texts) for a node.
 * Shows chapter titles, word counts, and allows navigation to individual chapters.
 */

import { Component, Show, For, createResource, createSignal } from 'solid-js';
import { workingTextsService } from '@/services/working-texts';
import { ChapterViewer } from './ChapterViewer';
import './WorkingTextsList.css';

interface WorkingTextsListProps {
  nodeId: string;
  className?: string;
}

export const WorkingTextsList: Component<WorkingTextsListProps> = (props) => {
  const [selectedChapter, setSelectedChapter] = createSignal<number | null>(null);

  const [workingTexts] = createResource(
    () => props.nodeId,
    async (nodeId) => {
      try {
        return await workingTextsService.getNodeChapters(nodeId);
      } catch (error) {
        console.error('Failed to load working texts:', error);
        return null;
      }
    }
  );

  const handleChapterClick = (chapterNumber: number) => {
    setSelectedChapter(chapterNumber);
  };

  const handleCloseChapter = () => {
    setSelectedChapter(null);
  };

  return (
    <div class={`working-texts-list ${props.className || ''}`}>
      <Show
        when={!workingTexts.loading && workingTexts()}
        fallback={
          <div class="working-texts-loading">
            <div class="loading-spinner" />
            <p>Loading chapters...</p>
          </div>
        }
      >
        <Show
          when={workingTexts()!.hasWorkingTexts && workingTexts()!.chapters.length > 0}
          fallback={
            <div class="working-texts-empty">
              <div class="empty-icon">📚</div>
              <h3>No chapters available yet</h3>
              <p class="empty-hint">
                Book chapters will appear here once the text has been processed and reformatted.
              </p>
            </div>
          }
        >
          <div class="chapters-grid">
            <For each={workingTexts()!.chapters}>
              {(chapter) => (
                <button
                  class="chapter-card"
                  onClick={() => handleChapterClick(chapter.chapterNumber)}
                >
                  <div class="chapter-number">
                    {chapter.chapterNumber}
                  </div>
                  <div class="chapter-info">
                    <h4 class="chapter-title">{chapter.title}</h4>
                    <div class="chapter-meta">
                      <span class="word-count">
                        {chapter.wordCount.toLocaleString()} words
                      </span>
                      <span class="read-time">
                        ~{Math.ceil(chapter.wordCount / 200)} min read
                      </span>
                    </div>
                  </div>
                  <div class="chapter-arrow">→</div>
                </button>
              )}
            </For>
          </div>

          <div class="chapters-summary">
            <span class="summary-stat">
              <strong>{workingTexts()!.chapters.length}</strong> chapters
            </span>
            <span class="summary-stat">
              <strong>
                {workingTexts()!.chapters.reduce((sum, ch) => sum + ch.wordCount, 0).toLocaleString()}
              </strong> total words
            </span>
          </div>
        </Show>
      </Show>

      {/* Chapter Viewer Modal */}
      <Show when={selectedChapter() !== null}>
        <ChapterViewer
          nodeId={props.nodeId}
          chapterNumber={selectedChapter()!}
          onClose={handleCloseChapter}
        />
      </Show>
    </div>
  );
};

export default WorkingTextsList;
