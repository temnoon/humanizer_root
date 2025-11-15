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

      {/* Panel */}
      <aside
        className="fixed top-16 left-0 bottom-0 w-80 z-50 md:relative md:top-0 border-r overflow-y-auto"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-color)',
        }}
      >
        {/* Header */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="ui-text font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
              Archive
            </h2>
            <button
              onClick={onClose}
              className="md:hidden p-1 rounded hover:opacity-70"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Icons.Close />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search narratives..."
              className="ui-text w-full pl-9 pr-3 py-2 rounded-md text-sm"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
            <div className="absolute left-3 top-2.5" style={{ color: 'var(--text-tertiary)' }}>
              <Icons.Search />
            </div>
          </div>

          {/* Tag filters */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => setFilterTag(null)}
                className={`ui-text text-xs px-2 py-1 rounded ${!filterTag ? 'font-semibold' : ''}`}
                style={{
                  backgroundColor: !filterTag ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: !filterTag ? 'var(--text-inverse)' : 'var(--text-secondary)',
                }}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(tag)}
                  className={`ui-text text-xs px-2 py-1 rounded ${filterTag === tag ? 'font-semibold' : ''}`}
                  style={{
                    backgroundColor:
                      filterTag === tag ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: filterTag === tag ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Narrative list */}
        <div className="p-2">
          {filteredNarratives.length === 0 ? (
            <div className="p-8 text-center ui-text text-sm" style={{ color: 'var(--text-tertiary)' }}>
              No narratives found
            </div>
          ) : (
            filteredNarratives.map((narrative) => (
              <button
                key={narrative.id}
                onClick={() => {
                  onSelectNarrative(narrative.id);
                  // Close panel on mobile after selection
                  if (window.innerWidth < 768) {
                    onClose();
                  }
                }}
                className={`w-full text-left p-3 rounded-md mb-2 transition-smooth ${
                  currentNarrativeId === narrative.id ? 'shadow-md' : 'hover:shadow-sm'
                }`}
                style={{
                  backgroundColor:
                    currentNarrativeId === narrative.id
                      ? 'var(--accent-primary)'
                      : 'var(--bg-secondary)',
                  color:
                    currentNarrativeId === narrative.id
                      ? 'var(--text-inverse)'
                      : 'var(--text-primary)',
                }}
              >
                <div className="ui-text font-medium text-sm mb-1">{narrative.title}</div>
                <div className="ui-text text-xs opacity-80">
                  {narrative.metadata.wordCount?.toLocaleString()} words
                  {narrative.metadata.source && ` • ${narrative.metadata.source}`}
                </div>
                {narrative.metadata.tags && narrative.metadata.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {narrative.metadata.tags.map((tag) => (
                      <span
                        key={tag}
                        className="ui-text text-xs px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor:
                            currentNarrativeId === narrative.id
                              ? 'rgba(255, 255, 255, 0.2)'
                              : 'var(--bg-tertiary)',
                          color:
                            currentNarrativeId === narrative.id
                              ? 'var(--text-inverse)'
                              : 'var(--text-tertiary)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
