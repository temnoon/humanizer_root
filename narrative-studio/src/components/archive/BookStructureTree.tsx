/**
 * BookStructureTree - Displays the active book's structure in a collapsible tree
 *
 * Shows chapters, sections, and pages in a navigable tree format.
 * Supports drag-and-drop reordering within and across containers.
 */

import { useState, useMemo, useCallback, DragEvent } from 'react';
import { useActiveBook } from '../../contexts/ActiveBookContext';
import { booksService } from '../../services/booksService';
import type { Chapter, Section, PageSummary } from '../../services/booksService';

interface BookStructureTreeProps {
  onSelectPage?: (pageId: string, bookId: string) => void;
  onEditPage?: (pageId: string, bookId: string) => void;
  selectedPageId?: string | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

type DragItem = {
  type: 'chapter' | 'section' | 'page';
  id: string;
  parentId?: string; // chapterId for sections, sectionId for pages
};

export function BookStructureTree({
  onSelectPage,
  onEditPage,
  selectedPageId,
  collapsed = false,
  onToggleCollapse,
}: BookStructureTreeProps) {
  const { activeBook, loading, refreshActiveBook } = useActiveBook();
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<{ type: string; id: string; position: 'before' | 'after' | 'inside' } | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  // Auto-expand all chapters when book loads
  useMemo(() => {
    if (activeBook?.chapters) {
      setExpandedChapters(new Set(activeBook.chapters.map(c => c.id)));
      // Expand all sections too
      const allSectionIds = activeBook.chapters.flatMap(c => c.sections?.map(s => s.id) || []);
      setExpandedSections(new Set(allSectionIds));
    }
  }, [activeBook?.id]);

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handlePageClick = (pageId: string) => {
    if (activeBook && onSelectPage) {
      onSelectPage(pageId, activeBook.id);
    }
  };

  const handlePageDoubleClick = (pageId: string) => {
    if (activeBook && onEditPage) {
      onEditPage(pageId, activeBook.id);
    }
  };

  // Count total pages
  const totalPages = useMemo(() => {
    if (!activeBook?.chapters) return 0;
    return activeBook.chapters.reduce((acc, chapter) => {
      return acc + (chapter.sections?.reduce((sAcc, section) => {
        return sAcc + (section.pages?.length || 0);
      }, 0) || 0);
    }, 0);
  }, [activeBook]);

  // Drag handlers
  const handleDragStart = useCallback((e: DragEvent, item: DragItem) => {
    e.stopPropagation();
    setDragItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(item));

    // Add dragging class after a brief delay
    setTimeout(() => {
      (e.target as HTMLElement).classList.add('dragging');
    }, 0);
  }, []);

  const handleDragEnd = useCallback((e: DragEvent) => {
    (e.target as HTMLElement).classList.remove('dragging');
    setDragItem(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback((e: DragEvent, targetType: string, targetId: string, position: 'before' | 'after' | 'inside') => {
    e.preventDefault();
    e.stopPropagation();

    if (!dragItem) return;

    // Validate drop target
    if (dragItem.type === 'chapter' && targetType !== 'chapter') return;
    if (dragItem.type === 'section' && targetType !== 'section' && position !== 'inside') return;
    if (dragItem.type === 'page' && targetType !== 'page' && position !== 'inside') return;

    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ type: targetType, id: targetId, position });
  }, [dragItem]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    // Only clear if leaving the actual element, not entering a child
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDropTarget(null);
    }
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!dragItem || !dropTarget || !activeBook) {
      setDragItem(null);
      setDropTarget(null);
      return;
    }

    setIsReordering(true);

    try {
      if (dragItem.type === 'chapter' && dropTarget.type === 'chapter') {
        // Reorder chapters
        const chapters = activeBook.chapters || [];
        const currentIndex = chapters.findIndex(c => c.id === dragItem.id);
        const targetIndex = chapters.findIndex(c => c.id === dropTarget.id);

        if (currentIndex !== -1 && targetIndex !== -1 && currentIndex !== targetIndex) {
          const newOrder = [...chapters];
          const [moved] = newOrder.splice(currentIndex, 1);
          const insertIndex = dropTarget.position === 'before' ? targetIndex : targetIndex + 1;
          newOrder.splice(currentIndex < targetIndex ? insertIndex - 1 : insertIndex, 0, moved);

          await booksService.reorderChapters(activeBook.id, newOrder.map(c => c.id));
          await refreshActiveBook();
        }
      } else if (dragItem.type === 'section') {
        // Find source chapter
        const sourceChapter = activeBook.chapters?.find(c => c.id === dragItem.parentId);
        if (!sourceChapter) return;

        if (dropTarget.type === 'section') {
          // Reorder within or across chapters
          const targetChapter = activeBook.chapters?.find(c =>
            c.sections?.some(s => s.id === dropTarget.id)
          );
          if (!targetChapter) return;

          if (sourceChapter.id === targetChapter.id) {
            // Same chapter reorder
            const sections = sourceChapter.sections || [];
            const currentIndex = sections.findIndex(s => s.id === dragItem.id);
            const targetIndex = sections.findIndex(s => s.id === dropTarget.id);

            if (currentIndex !== -1 && targetIndex !== -1 && currentIndex !== targetIndex) {
              const newOrder = [...sections];
              const [moved] = newOrder.splice(currentIndex, 1);
              const insertIndex = dropTarget.position === 'before' ? targetIndex : targetIndex + 1;
              newOrder.splice(currentIndex < targetIndex ? insertIndex - 1 : insertIndex, 0, moved);

              await booksService.reorderSections(activeBook.id, sourceChapter.id, newOrder.map(s => s.id));
              await refreshActiveBook();
            }
          } else {
            // Move to different chapter
            const targetIndex = targetChapter.sections?.findIndex(s => s.id === dropTarget.id) ?? 0;
            const insertIndex = dropTarget.position === 'before' ? targetIndex : targetIndex + 1;
            await booksService.moveSection(activeBook.id, dragItem.id, targetChapter.id, insertIndex);
            await refreshActiveBook();
          }
        }
      } else if (dragItem.type === 'page') {
        // Find source section
        let sourceSection: Section | undefined;
        for (const chapter of activeBook.chapters || []) {
          sourceSection = chapter.sections?.find(s => s.id === dragItem.parentId);
          if (sourceSection) break;
        }
        if (!sourceSection) return;

        if (dropTarget.type === 'page') {
          // Reorder within or across sections
          let targetSection: Section | undefined;
          for (const chapter of activeBook.chapters || []) {
            targetSection = chapter.sections?.find(s =>
              s.pages?.some(p => p.id === dropTarget.id)
            );
            if (targetSection) break;
          }
          if (!targetSection) return;

          if (sourceSection.id === targetSection.id) {
            // Same section reorder
            const pages = sourceSection.pages || [];
            const currentIndex = pages.findIndex(p => p.id === dragItem.id);
            const targetIndex = pages.findIndex(p => p.id === dropTarget.id);

            if (currentIndex !== -1 && targetIndex !== -1 && currentIndex !== targetIndex) {
              const newOrder = [...pages];
              const [moved] = newOrder.splice(currentIndex, 1);
              const insertIndex = dropTarget.position === 'before' ? targetIndex : targetIndex + 1;
              newOrder.splice(currentIndex < targetIndex ? insertIndex - 1 : insertIndex, 0, moved);

              await booksService.reorderPages(activeBook.id, sourceSection.id, newOrder.map(p => p.id));
              await refreshActiveBook();
            }
          } else {
            // Move to different section
            const targetIndex = targetSection.pages?.findIndex(p => p.id === dropTarget.id) ?? 0;
            const insertIndex = dropTarget.position === 'before' ? targetIndex : targetIndex + 1;
            await booksService.movePage(activeBook.id, dragItem.id, targetSection.id, insertIndex);
            await refreshActiveBook();
          }
        } else if (dropTarget.type === 'section' && dropTarget.position === 'inside') {
          // Drop page into section
          await booksService.movePage(activeBook.id, dragItem.id, dropTarget.id);
          await refreshActiveBook();
        }
      }
    } catch (error) {
      console.error('Reorder failed:', error);
    } finally {
      setIsReordering(false);
      setDragItem(null);
      setDropTarget(null);
    }
  }, [dragItem, dropTarget, activeBook, refreshActiveBook]);

  // No active book state
  if (!activeBook) {
    return (
      <div
        style={{
          padding: 'var(--space-md)',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: '0.8125rem',
        }}
      >
        <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-xs)' }}>📚</div>
        <p style={{ margin: 0 }}>No book selected</p>
        <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.75rem', opacity: 0.7 }}>
          Select a book from the top bar
        </p>
      </div>
    );
  }

  // Collapsed state - just show header
  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        style={{
          width: '100%',
          padding: 'var(--space-sm) var(--space-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          background: 'none',
          border: 'none',
          borderTop: '1px solid var(--border-color)',
          cursor: 'pointer',
          color: 'var(--text-primary)',
        }}
      >
        <span style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)' }}>&#9654;</span>
        <span style={{ fontSize: '1rem' }}>📖</span>
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{activeBook.title}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          {totalPages} pages
        </span>
      </button>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderTop: '1px solid var(--border-color)',
        opacity: isReordering ? 0.7 : 1,
        pointerEvents: isReordering ? 'none' : 'auto',
      }}
    >
      {/* Header */}
      <button
        onClick={onToggleCollapse}
        style={{
          width: '100%',
          padding: 'var(--space-sm) var(--space-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          background: 'none',
          border: 'none',
          borderBottom: '1px solid var(--border-color)',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '0.625rem',
            color: 'var(--text-tertiary)',
            transform: 'rotate(90deg)',
          }}
        >
          &#9654;
        </span>
        <span style={{ fontSize: '1rem' }}>📖</span>
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{activeBook.title}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          {totalPages} pages
        </span>
      </button>

      {/* Tree content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--space-sm)',
        }}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-md)', color: 'var(--text-tertiary)' }}>
            Loading...
          </div>
        ) : !activeBook.chapters || activeBook.chapters.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-md)',
              color: 'var(--text-tertiary)',
              fontSize: '0.8125rem',
            }}
          >
            <p style={{ margin: 0 }}>No chapters yet</p>
            <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.75rem', opacity: 0.7 }}>
              Add content using "Add to Book" in Tools
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {activeBook.chapters.map((chapter, chapterIdx) => (
              <ChapterNode
                key={chapter.id}
                chapter={chapter}
                chapterIndex={chapterIdx}
                isExpanded={expandedChapters.has(chapter.id)}
                onToggle={() => toggleChapter(chapter.id)}
                expandedSections={expandedSections}
                onToggleSection={toggleSection}
                selectedPageId={selectedPageId}
                onSelectPage={handlePageClick}
                onEditPage={handlePageDoubleClick}
                dragItem={dragItem}
                dropTarget={dropTarget}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ChapterNodeProps {
  chapter: Chapter;
  chapterIndex: number;
  isExpanded: boolean;
  onToggle: () => void;
  expandedSections: Set<string>;
  onToggleSection: (sectionId: string) => void;
  selectedPageId?: string | null;
  onSelectPage: (pageId: string) => void;
  onEditPage: (pageId: string) => void;
  dragItem: DragItem | null;
  dropTarget: { type: string; id: string; position: 'before' | 'after' | 'inside' } | null;
  onDragStart: (e: DragEvent, item: DragItem) => void;
  onDragEnd: (e: DragEvent) => void;
  onDragOver: (e: DragEvent, type: string, id: string, position: 'before' | 'after' | 'inside') => void;
  onDragLeave: (e: DragEvent) => void;
}

function ChapterNode({
  chapter,
  chapterIndex,
  isExpanded,
  onToggle,
  expandedSections,
  onToggleSection,
  selectedPageId,
  onSelectPage,
  onEditPage,
  dragItem,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
}: ChapterNodeProps) {
  const pageCount = chapter.sections?.reduce((acc, s) => acc + (s.pages?.length || 0), 0) || 0;
  const isDropBefore = dropTarget?.type === 'chapter' && dropTarget.id === chapter.id && dropTarget.position === 'before';
  const isDropAfter = dropTarget?.type === 'chapter' && dropTarget.id === chapter.id && dropTarget.position === 'after';
  const isDragging = dragItem?.type === 'chapter' && dragItem.id === chapter.id;

  return (
    <div style={{ opacity: isDragging ? 0.5 : 1 }}>
      {/* Drop indicator before */}
      {isDropBefore && (
        <div style={{ height: '2px', backgroundColor: 'var(--accent-primary)', margin: '2px 0', borderRadius: '1px' }} />
      )}

      {/* Chapter header */}
      <button
        draggable
        onDragStart={(e) => onDragStart(e as unknown as DragEvent, { type: 'chapter', id: chapter.id })}
        onDragEnd={onDragEnd as unknown as React.DragEventHandler}
        onDragOver={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const position = e.clientY < midY ? 'before' : 'after';
          onDragOver(e as unknown as DragEvent, 'chapter', chapter.id, position);
        }}
        onDragLeave={onDragLeave as unknown as React.DragEventHandler}
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          padding: '6px 8px',
          background: 'none',
          border: 'none',
          borderRadius: '4px',
          cursor: 'grab',
          textAlign: 'left',
          color: 'var(--text-primary)',
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <span
          style={{
            fontSize: '0.5rem',
            color: 'var(--text-tertiary)',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
            transition: 'transform 0.15s',
            width: '10px',
          }}
        >
          &#9654;
        </span>
        <span style={{ fontSize: '0.875rem' }}>&#128218;</span>
        <span
          style={{
            flex: 1,
            fontWeight: 500,
            fontSize: '0.8125rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {chapter.title || `Chapter ${chapterIndex + 1}`}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
          {pageCount}p
        </span>
      </button>

      {/* Drop indicator after */}
      {isDropAfter && (
        <div style={{ height: '2px', backgroundColor: 'var(--accent-primary)', margin: '2px 0', borderRadius: '1px' }} />
      )}

      {/* Sections */}
      {isExpanded && chapter.sections && chapter.sections.length > 0 && (
        <div style={{ paddingLeft: '16px' }}>
          {chapter.sections.map((section, sectionIdx) => (
            <SectionNode
              key={section.id}
              section={section}
              sectionIndex={sectionIdx}
              chapterId={chapter.id}
              isExpanded={expandedSections.has(section.id)}
              onToggle={() => onToggleSection(section.id)}
              selectedPageId={selectedPageId}
              onSelectPage={onSelectPage}
              onEditPage={onEditPage}
              dragItem={dragItem}
              dropTarget={dropTarget}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
            />
          ))}
        </div>
      )}

      {/* Empty state for chapter */}
      {isExpanded && (!chapter.sections || chapter.sections.length === 0) && (
        <div
          style={{
            paddingLeft: '24px',
            padding: '4px 8px 4px 24px',
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
            fontStyle: 'italic',
          }}
        >
          No sections
        </div>
      )}
    </div>
  );
}

interface SectionNodeProps {
  section: Section;
  sectionIndex: number;
  chapterId: string;
  isExpanded: boolean;
  onToggle: () => void;
  selectedPageId?: string | null;
  onSelectPage: (pageId: string) => void;
  onEditPage: (pageId: string) => void;
  dragItem: DragItem | null;
  dropTarget: { type: string; id: string; position: 'before' | 'after' | 'inside' } | null;
  onDragStart: (e: DragEvent, item: DragItem) => void;
  onDragEnd: (e: DragEvent) => void;
  onDragOver: (e: DragEvent, type: string, id: string, position: 'before' | 'after' | 'inside') => void;
  onDragLeave: (e: DragEvent) => void;
}

function SectionNode({
  section,
  sectionIndex,
  chapterId,
  isExpanded,
  onToggle,
  selectedPageId,
  onSelectPage,
  onEditPage,
  dragItem,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
}: SectionNodeProps) {
  const hasPages = section.pages && section.pages.length > 0;
  const isDropBefore = dropTarget?.type === 'section' && dropTarget.id === section.id && dropTarget.position === 'before';
  const isDropAfter = dropTarget?.type === 'section' && dropTarget.id === section.id && dropTarget.position === 'after';
  const isDropInside = dropTarget?.type === 'section' && dropTarget.id === section.id && dropTarget.position === 'inside';
  const isDragging = dragItem?.type === 'section' && dragItem.id === section.id;

  return (
    <div style={{ opacity: isDragging ? 0.5 : 1 }}>
      {/* Drop indicator before */}
      {isDropBefore && (
        <div style={{ height: '2px', backgroundColor: 'var(--accent-primary)', margin: '2px 0', borderRadius: '1px' }} />
      )}

      {/* Section header */}
      <button
        draggable
        onDragStart={(e) => onDragStart(e as unknown as DragEvent, { type: 'section', id: section.id, parentId: chapterId })}
        onDragEnd={onDragEnd as unknown as React.DragEventHandler}
        onDragOver={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          // Check if dragging a page - allow drop inside section
          if (dragItem?.type === 'page') {
            onDragOver(e as unknown as DragEvent, 'section', section.id, 'inside');
          } else {
            const position = e.clientY < midY ? 'before' : 'after';
            onDragOver(e as unknown as DragEvent, 'section', section.id, position);
          }
        }}
        onDragLeave={onDragLeave as unknown as React.DragEventHandler}
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          padding: '4px 8px',
          background: isDropInside ? 'var(--accent-primary)20' : 'none',
          border: isDropInside ? '1px dashed var(--accent-primary)' : 'none',
          borderRadius: '4px',
          cursor: 'grab',
          textAlign: 'left',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={e => { if (!isDropInside) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; }}
        onMouseLeave={e => { if (!isDropInside) e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <span
          style={{
            fontSize: '0.5rem',
            color: 'var(--text-tertiary)',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
            transition: 'transform 0.15s',
            width: '10px',
            visibility: hasPages ? 'visible' : 'hidden',
          }}
        >
          &#9654;
        </span>
        <span style={{ fontSize: '0.75rem' }}>&#128196;</span>
        <span
          style={{
            flex: 1,
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {section.title || `Section ${sectionIndex + 1}`}
        </span>
        {hasPages && (
          <span style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)' }}>
            {section.pages!.length}
          </span>
        )}
      </button>

      {/* Drop indicator after */}
      {isDropAfter && (
        <div style={{ height: '2px', backgroundColor: 'var(--accent-primary)', margin: '2px 0', borderRadius: '1px' }} />
      )}

      {/* Pages */}
      {isExpanded && hasPages && (
        <div style={{ paddingLeft: '16px' }}>
          {section.pages!.map((page, pageIdx) => (
            <PageNode
              key={page.id}
              page={page}
              pageIndex={pageIdx}
              sectionId={section.id}
              isSelected={selectedPageId === page.id}
              onSelect={() => onSelectPage(page.id)}
              onDoubleClick={() => onEditPage(page.id)}
              dragItem={dragItem}
              dropTarget={dropTarget}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PageNodeProps {
  page: PageSummary;
  pageIndex: number;
  sectionId: string;
  isSelected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
  dragItem: DragItem | null;
  dropTarget: { type: string; id: string; position: 'before' | 'after' | 'inside' } | null;
  onDragStart: (e: DragEvent, item: DragItem) => void;
  onDragEnd: (e: DragEvent) => void;
  onDragOver: (e: DragEvent, type: string, id: string, position: 'before' | 'after' | 'inside') => void;
  onDragLeave: (e: DragEvent) => void;
}

function PageNode({
  page,
  pageIndex,
  sectionId,
  isSelected,
  onSelect,
  onDoubleClick,
  dragItem,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
}: PageNodeProps) {
  const isDropBefore = dropTarget?.type === 'page' && dropTarget.id === page.id && dropTarget.position === 'before';
  const isDropAfter = dropTarget?.type === 'page' && dropTarget.id === page.id && dropTarget.position === 'after';
  const isDragging = dragItem?.type === 'page' && dragItem.id === page.id;

  return (
    <div style={{ opacity: isDragging ? 0.5 : 1 }}>
      {/* Drop indicator before */}
      {isDropBefore && (
        <div style={{ height: '2px', backgroundColor: 'var(--accent-primary)', margin: '1px 0', borderRadius: '1px' }} />
      )}

      <button
        draggable
        onDragStart={(e) => onDragStart(e as unknown as DragEvent, { type: 'page', id: page.id, parentId: sectionId })}
        onDragEnd={onDragEnd as unknown as React.DragEventHandler}
        onDragOver={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const position = e.clientY < midY ? 'before' : 'after';
          onDragOver(e as unknown as DragEvent, 'page', page.id, position);
        }}
        onDragLeave={onDragLeave as unknown as React.DragEventHandler}
        onClick={onSelect}
        onDoubleClick={onDoubleClick}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          padding: '3px 8px',
          background: isSelected ? 'var(--accent-primary)' : 'none',
          border: 'none',
          borderRadius: '4px',
          cursor: 'grab',
          textAlign: 'left',
          color: isSelected ? 'white' : 'var(--text-tertiary)',
        }}
        onMouseEnter={e => {
          if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
        }}
        onMouseLeave={e => {
          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
        }}
        title="Click to view, double-click to edit"
      >
        <span style={{ fontSize: '0.625rem', width: '10px' }}>&#8226;</span>
        <span
          style={{
            flex: 1,
            fontSize: '0.6875rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Page {pageIndex + 1}
        </span>
        <span style={{ fontSize: '0.5625rem', opacity: 0.7 }}>
          {page.wordCount}w
        </span>
      </button>

      {/* Drop indicator after */}
      {isDropAfter && (
        <div style={{ height: '2px', backgroundColor: 'var(--accent-primary)', margin: '1px 0', borderRadius: '1px' }} />
      )}
    </div>
  );
}
