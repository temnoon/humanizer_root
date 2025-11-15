import { useState, useMemo } from 'react';
import type { Narrative } from '../../types';
import { Icons } from '../layout/Icons';

interface ArchivePanelProps {
  narratives: Narrative[];
  currentNarrativeId: string | null;
  onSelectNarrative: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ArchivePanel({
  narratives,
  currentNarrativeId,
  onSelectNarrative,
  isOpen,
  onClose,
}: ArchivePanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    narratives.forEach((n) => {
      n.metadata.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [narratives]);

  // Filter narratives
  const filteredNarratives = useMemo(() => {
    return narratives.filter((n) => {
      const matchesSearch =
        !searchQuery ||
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTag = !filterTag || n.metadata.tags?.includes(filterTag);

      return matchesSearch && matchesTag;
    });
  }, [narratives, searchQuery, filterTag]);

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel - now with panel styles */}
      <aside
        className="fixed top-16 left-0 bottom-0 w-80 md:w-96 z-50 md:relative md:top-0 overflow-hidden panel"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderRight: '1px solid var(--border-color)',
          borderRadius: 0,
        }}
      >
        {/* Header - generous padding */}
        <div
          className="panel-header"
          style={{
            padding: 'var(--space-lg)',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="heading-md" style={{ color: 'var(--text-primary)' }}>
              Archive
            </h2>
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-md hover:opacity-70"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-tertiary)',
              }}
            >
              <Icons.Close />
            </button>
          </div>

          {/* Search - larger input */}
          <div className="relative mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search narratives..."
              className="ui-text w-full pl-11 pr-4"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }}>
              <Icons.Search />
            </div>
          </div>

          {/* Tag filters - using .tag class */}
          {allTags.length > 0 && (
            <div>
              <p className="text-small mb-3" style={{ color: 'var(--text-secondary)' }}>
                Filter by tag:
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterTag(null)}
                  className={!filterTag ? 'tag tag-selected' : 'tag tag-default'}
                >
                  All
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setFilterTag(tag)}
                    className={filterTag === tag ? 'tag tag-selected' : 'tag tag-default'}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Narrative list - generous padding */}
        <div
          className="overflow-y-auto"
          style={{
            height: 'calc(100% - 200px)',
            padding: 'var(--space-lg)',
          }}
        >
          {filteredNarratives.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center text-center"
              style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-2xl)' }}
            >
              <div
                className="mb-4"
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icons.Archive />
              </div>
              <p className="text-body mb-2" style={{ color: 'var(--text-secondary)' }}>
                No narratives found
              </p>
              <p className="text-small" style={{ color: 'var(--text-tertiary)' }}>
                {searchQuery || filterTag
                  ? 'Try adjusting your search or filters'
                  : 'Upload some narratives to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNarratives.map((narrative) => (
                <button
                  key={narrative.id}
                  onClick={() => {
                    onSelectNarrative(narrative.id);
                    // Close panel on mobile after selection
                    if (window.innerWidth < 768) {
                      onClose();
                    }
                  }}
                  className="card w-full text-left"
                  style={{
                    backgroundColor:
                      currentNarrativeId === narrative.id
                        ? 'var(--accent-primary)'
                        : 'var(--bg-elevated)',
                    color:
                      currentNarrativeId === narrative.id
                        ? 'var(--text-inverse)'
                        : 'var(--text-primary)',
                    padding: 'var(--space-md)',
                  }}
                >
                  <div className="font-medium mb-2" style={{ fontSize: '1rem' }}>
                    {narrative.title}
                  </div>
                  <div className="text-small opacity-90 mb-3">
                    {narrative.metadata.wordCount?.toLocaleString()} words
                    {narrative.metadata.source && ` • ${narrative.metadata.source}`}
                  </div>
                  {narrative.metadata.tags && narrative.metadata.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {narrative.metadata.tags.map((tag) => (
                        <span
                          key={tag}
                          className="tag"
                          style={{
                            backgroundColor:
                              currentNarrativeId === narrative.id
                                ? 'rgba(255, 255, 255, 0.25)'
                                : 'var(--bg-tertiary)',
                            color:
                              currentNarrativeId === narrative.id
                                ? 'var(--text-inverse)'
                                : 'var(--text-secondary)',
                            borderColor: 'transparent',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
