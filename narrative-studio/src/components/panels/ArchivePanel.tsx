import { useState, useEffect, useMemo, useRef } from 'react';
import type { ConversationMetadata, Conversation, GalleryImage } from '../../types';
import { Icons } from '../layout/Icons';
import { archiveService } from '../../services/archiveService';
import { galleryService } from '../../services/galleryService';
import { ImageLightbox } from './ImageLightbox';
import { SessionsView } from '../archive/SessionsView';
import type { Session } from '../../services/sessionStorage';

interface ArchivePanelProps {
  onSelectNarrative: (narrative: any) => void;
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'conversations' | 'messages' | 'gallery' | 'sessions';
type FilterCategory = 'date' | 'size' | 'media';

interface ActiveFilters {
  date?: string;
  size?: string;
  media?: string;
}

interface ArchiveState {
  conversationSearch: string;
  messageSearch: string;
  activeFilters: ActiveFilters;
  recentSearches: string[];
  sortDirection: 'ascending' | 'descending';
}

const STORAGE_KEY = 'archive-panel-state';
const MAX_RECENT_SEARCHES = 10;

export function ArchivePanel({ onSelectNarrative, isOpen, onClose }: ArchivePanelProps) {
  const [conversations, setConversations] = useState<ConversationMetadata[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('conversations');
  const [conversationSearch, setConversationSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
  const [showingCategory, setShowingCategory] = useState<FilterCategory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('descending');

  // Gallery state
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryOffset, setGalleryOffset] = useState(0);
  const [galleryTotal, setGalleryTotal] = useState(0);
  const [galleryHasMore, setGalleryHasMore] = useState(true);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null);
  const [galleryFolder, setGalleryFolder] = useState<string | undefined>(undefined); // Filter gallery by conversation folder
  const [gallerySearch, setGallerySearch] = useState<string>(''); // Search query for gallery

  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const state: ArchiveState = JSON.parse(savedState);
        setConversationSearch(state.conversationSearch || '');
        setMessageSearch(state.messageSearch || '');
        setActiveFilters(state.activeFilters || {});
        setRecentSearches(state.recentSearches || []);
        setSortDirection(state.sortDirection || 'descending');
      } catch (err) {
        console.error('Failed to restore archive state:', err);
      }
    }
  }, []);

  // Save state to localStorage
  useEffect(() => {
    const state: ArchiveState = {
      conversationSearch,
      messageSearch,
      activeFilters,
      recentSearches,
      sortDirection,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [conversationSearch, messageSearch, activeFilters, recentSearches, sortDirection]);

  // Load conversations on mount
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  const loadConversations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await archiveService.fetchConversations();
      setConversations(data);
      console.log(`Loaded ${data.length} conversations from archive`);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (folder: string) => {
    setLoading(true);
    // Save search when user clicks a conversation (meaningful action)
    saveCurrentSearch();
    try {
      const conv = await archiveService.fetchConversation(folder);
      setSelectedConversation(conv);
      setViewMode('messages');
      setMessageSearch(''); // Clear message search when entering conversation
      setSelectedMessageIndex(null);
      setFocusedIndex(0); // Reset focus when switching to messages
      console.log(`Loaded "${conv.title}" - ${conv.messages.length} messages`);

      // Auto-load first message to canvas
      if (conv.messages.length > 0) {
        const narrative = archiveService.conversationToNarrative(conv, 0);
        onSelectNarrative(narrative);
        setSelectedMessageIndex(0);
        console.log('Auto-loaded first message to canvas');
      }
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
      alert(`Could not load conversation: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load gallery images
  const loadGalleryImages = async (reset = false) => {
    if (galleryLoading) return;

    setGalleryLoading(true);
    setError(null);
    try {
      const offset = reset ? 0 : galleryOffset;
      const data = await galleryService.fetchImages(50, offset, galleryFolder, gallerySearch || undefined);

      if (reset) {
        setGalleryImages(data.images);
        setGalleryOffset(data.limit);
      } else {
        setGalleryImages(prev => [...prev, ...data.images]);
        setGalleryOffset(prev => prev + data.limit);
      }

      setGalleryTotal(data.total);
      setGalleryHasMore(data.hasMore);
      console.log(`Loaded ${data.images.length} images (${data.offset}-${data.offset + data.images.length} of ${data.total})`);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load gallery:', err);
    } finally {
      setGalleryLoading(false);
    }
  };

  // Load gallery when view mode changes to gallery
  useEffect(() => {
    if (viewMode === 'gallery' && galleryImages.length === 0 && !galleryLoading) {
      loadGalleryImages(true);
    }
  }, [viewMode]);

  // Reload gallery when filter or search changes
  useEffect(() => {
    if (viewMode === 'gallery') {
      loadGalleryImages(true);
    }
  }, [galleryFolder, gallerySearch]);

  // Listen for lightbox navigation events
  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<GalleryImage>;
      setLightboxImage(customEvent.detail);
    };

    const handleLoadMore = () => {
      if (galleryHasMore && !galleryLoading) {
        console.log('Auto-loading more images for navigation...');
        loadGalleryImages(false);
      }
    };

    window.addEventListener('lightbox-navigate', handleNavigate);
    window.addEventListener('gallery-load-more', handleLoadMore);
    return () => {
      window.removeEventListener('lightbox-navigate', handleNavigate);
      window.removeEventListener('gallery-load-more', handleLoadMore);
    };
  }, [galleryHasMore, galleryLoading]);

  // Handle viewing a conversation from the lightbox
  const handleViewConversation = async (image: GalleryImage) => {
    try {
      setLoading(true);
      const conv = await archiveService.fetchConversation(image.conversationFolder);
      setSelectedConversation(conv);
      setViewMode('messages');
      setMessageSearch('');
      setSelectedMessageIndex(image.messageIndex);
      setFocusedIndex(image.messageIndex);
      setLightboxImage(null); // Close lightbox

      // Load the specific message to canvas with scroll hint
      if (image.messageIndex >= 0 && image.messageIndex < conv.messages.length) {
        const narrative = archiveService.conversationToNarrative(
          conv,
          image.messageIndex,
          image.filename // Pass filename so MainWorkspace can scroll to this image
        );
        onSelectNarrative(narrative);
        console.log(`Loaded message ${image.messageIndex + 1} from "${conv.title}" to canvas, will scroll to image: ${image.filename}`);
      }
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
      alert(`Could not load conversation: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // View gallery for a specific conversation
  const viewConversationGallery = (folder: string) => {
    setGalleryFolder(folder);
    setGallerySearch('');
    setViewMode('gallery');
  };

  // Return to all images in gallery
  const viewAllGallery = () => {
    setGalleryFolder(undefined);
    setGallerySearch('');
    setViewMode('gallery');
  };

  // Add search to recent searches
  const addToRecentSearches = (query: string) => {
    if (!query.trim()) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== query);
      const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      return updated;
    });
  };

  const handleSearchChange = (query: string) => {
    if (viewMode === 'conversations') {
      setConversationSearch(query);
    } else {
      setMessageSearch(query);
    }
    // Don't save on every keystroke - only save when user actually uses the search
  };

  const selectRecentSearch = (query: string) => {
    if (viewMode === 'conversations') {
      setConversationSearch(query);
    } else {
      setMessageSearch(query);
    }
    setShowRecentSearches(false);
  };

  const saveCurrentSearch = () => {
    const query = viewMode === 'conversations' ? conversationSearch : messageSearch;
    if (query.trim()) {
      addToRecentSearches(query.trim());
    }
  };

  // Get the current search query based on view mode
  const currentSearchQuery = viewMode === 'conversations' ? conversationSearch : messageSearch;

  const loadMessageToCanvas = (index: number) => {
    if (selectedConversation) {
      // Save search when user clicks a message (meaningful action)
      saveCurrentSearch();
      setSelectedMessageIndex(index);
      const narrative = archiveService.conversationToNarrative(
        selectedConversation,
        index
      );
      onSelectNarrative(narrative);
      console.log('Loaded message to canvas');
    }
  };

  const loadFullConversationToCanvas = () => {
    if (selectedConversation) {
      const narrative = archiveService.conversationToNarrative(selectedConversation);
      onSelectNarrative(narrative);
      console.log('Loaded full conversation to canvas');
    }
  };

  // Import conversation.json file
  const handleImportJSON = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      // Read file content
      const content = await file.text();
      const conversation = JSON.parse(content);

      // Send to archive server
      const response = await fetch('http://localhost:3002/api/import/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation,
          filename: file.name
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const result = await response.json();
      console.log('✓ Imported:', result);

      // Show success message
      alert(`✓ Imported: ${result.title}\n${result.message_count} messages`);

      // Reload conversations list
      await loadConversations();

      // Reset file input
      event.target.value = '';
    } catch (error: any) {
      console.error('Import error:', error);
      alert(`Import failed: ${error.message}`);
      event.target.value = '';
    } finally {
      setLoading(false);
    }
  };

  // Categorize tags from conversations
  const categorizedTags = useMemo(() => {
    const dateTags = new Set<string>();
    const sizeTags = new Set<string>();
    const mediaTags = new Set<string>();

    conversations.forEach((conv) => {
      conv.tags?.forEach((tag) => {
        // Date tags: years, months, recency
        if (/^\d{4}$/.test(tag) ||
            /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4}$/.test(tag) ||
            ['This Week', 'This Month', 'Recent', 'Archive'].includes(tag)) {
          dateTags.add(tag);
        }
        // Size tags
        else if (['Brief', 'Medium', 'Extended', 'Deep Dive'].includes(tag)) {
          sizeTags.add(tag);
        }
        // Media tags
        else if (['Has Images', 'Has Code'].includes(tag)) {
          mediaTags.add(tag);
        }
      });
    });

    // Sort date tags
    const sortedDateTags = Array.from(dateTags).sort((a, b) => {
      const recencyOrder = ['This Week', 'This Month', 'Recent', 'Archive'];
      const aRecency = recencyOrder.indexOf(a);
      const bRecency = recencyOrder.indexOf(b);

      // Recency tags first, in order
      if (aRecency !== -1 && bRecency !== -1) return aRecency - bRecency;
      if (aRecency !== -1) return -1;
      if (bRecency !== -1) return 1;

      // Year tags: newest first
      if (/^\d{4}$/.test(a) && /^\d{4}$/.test(b)) {
        return parseInt(b) - parseInt(a);
      }

      // Month tags: parse and sort by date (newest first)
      const monthPattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{4})$/;
      const aMatch = a.match(monthPattern);
      const bMatch = b.match(monthPattern);

      if (aMatch && bMatch) {
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const aYear = parseInt(aMatch[2]);
        const bYear = parseInt(bMatch[2]);
        const aMonth = monthOrder.indexOf(aMatch[1]);
        const bMonth = monthOrder.indexOf(bMatch[1]);

        if (aYear !== bYear) return bYear - aYear; // Newer year first
        return bMonth - aMonth; // Newer month first
      }

      // Fallback to alphabetical
      return b.localeCompare(a);
    });

    // Sort size tags
    const sizeOrder = ['Brief', 'Medium', 'Extended', 'Deep Dive'];
    const sortedSizeTags = Array.from(sizeTags).sort((a, b) =>
      sizeOrder.indexOf(a) - sizeOrder.indexOf(b)
    );

    // Apply sort direction
    const finalDateTags = sortDirection === 'ascending' ? [...sortedDateTags].reverse() : sortedDateTags;
    const finalSizeTags = sortDirection === 'ascending' ? [...sortedSizeTags].reverse() : sortedSizeTags;

    return {
      date: finalDateTags,
      size: finalSizeTags,
      media: Array.from(mediaTags),
    };
  }, [conversations, sortDirection]);

  // Handle filter selection
  const selectFilter = (category: FilterCategory, tag: string) => {
    setActiveFilters(prev => ({ ...prev, [category]: tag }));
    setShowingCategory(null);
  };

  // Handle filter removal
  const removeFilter = (category: FilterCategory) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
  };

  // Check if any filters are active
  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  // Filter conversations
  const filteredConversations = useMemo(() => {
    const filtered = conversations.filter((conv) => {
      const matchesSearch =
        !conversationSearch ||
        conv.title.toLowerCase().includes(conversationSearch.toLowerCase()) ||
        conv.folder.toLowerCase().includes(conversationSearch.toLowerCase());

      // AND logic: must match all active filters
      const matchesFilters = Object.entries(activeFilters).every(([_, tag]) => {
        return conv.tags?.includes(tag);
      });

      return matchesSearch && matchesFilters;
    });

    // Sort based on active filters and sort direction
    const sorted = [...filtered].sort((a, b) => {
      // If date filter is active, sort by date
      if (activeFilters.date) {
        const aTime = a.created_at || 0;
        const bTime = b.created_at || 0;
        return sortDirection === 'descending' ? bTime - aTime : aTime - bTime;
      }

      // If size filter is active, sort by message count
      if (activeFilters.size) {
        const aCount = a.message_count || 0;
        const bCount = b.message_count || 0;
        return sortDirection === 'descending' ? bCount - aCount : aCount - bCount;
      }

      // Default: sort by date (newest first if descending)
      const aTime = a.created_at || 0;
      const bTime = b.created_at || 0;
      return sortDirection === 'descending' ? bTime - aTime : aTime - bTime;
    });

    return sorted;
  }, [conversations, conversationSearch, activeFilters, sortDirection]);

  // Filter messages
  const filteredMessages = useMemo(() => {
    if (!selectedConversation) return [];
    return selectedConversation.messages.filter((msg) =>
      !messageSearch || msg.content.toLowerCase().includes(messageSearch.toLowerCase())
    );
  }, [selectedConversation, messageSearch]);

  // Format message content (handle DALL-E prompts)
  const formatMessageContent = (content: string): React.ReactElement | string => {
    // Try to detect and parse DALL-E prompt JSON
    if (content.trim().startsWith('{') && content.includes('"prompt"')) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.prompt) {
          return (
            <div>
              <div className="text-tiny" style={{ fontWeight: 600, marginBottom: 'var(--space-xs)', opacity: 0.7 }}>
                Prompt:
              </div>
              <div>{parsed.prompt}</div>
            </div>
          );
        }
      } catch (e) {
        // Not valid JSON, return as-is
      }
    }
    return content;
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere if user is typing in search
      if (document.activeElement?.tagName === 'INPUT') return;

      const items = viewMode === 'conversations' ? filteredConversations : filteredMessages;
      if (items.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => Math.min(prev + 1, items.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          // saveCurrentSearch is called inside loadConversation/loadMessageToCanvas
          if (viewMode === 'conversations') {
            const conv = filteredConversations[focusedIndex];
            if (conv) {
              loadConversation(conv.folder);
              if (window.innerWidth < 768) {
                onClose();
              }
            }
          } else {
            const msg = filteredMessages[focusedIndex];
            if (msg) {
              const originalIndex = selectedConversation!.messages.findIndex(m => m.id === msg.id);
              loadMessageToCanvas(originalIndex);
            }
          }
          break;
        case 'Escape':
          if (viewMode === 'messages') {
            setViewMode('conversations');
            setFocusedIndex(0);
          } else {
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, viewMode, filteredConversations, filteredMessages, focusedIndex, selectedConversation]);

  // Auto-scroll focused item into view
  useEffect(() => {
    const element = itemRefs.current.get(focusedIndex);
    if (element) {
      element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedIndex]);

  // Reset focused index when filters change
  useEffect(() => {
    setFocusedIndex(0);
  }, [currentSearchQuery, activeFilters, viewMode]);

  if (!isOpen) return null;

  // MESSAGES VIEW
  if (viewMode === 'messages' && selectedConversation) {
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
          className="fixed top-16 left-0 bottom-0 w-80 md:w-full md:h-full z-50 md:relative md:top-0 overflow-y-auto panel"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderRight: '1px solid var(--border-color)',
            borderRadius: 0,
          }}
        >
          {/* Header */}
          <div
            className="panel-header"
            style={{
              padding: 'var(--space-lg)',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="heading-md" style={{ color: 'var(--text-primary)' }}>
                Messages
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

            {/* Back button + Title */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setViewMode('conversations')}
                className="rounded-md transition-smooth hover:opacity-70 font-medium"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  padding: 'var(--space-xs) var(--space-sm)',
                  fontSize: '0.8125rem',
                }}
              >
                ← Back
              </button>
              <div className="flex-1 font-medium text-small line-clamp-1" style={{ color: 'var(--text-primary)' }}>
                {selectedConversation.title}
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <input
                type="text"
                value={currentSearchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => setShowRecentSearches(true)}
                onBlur={() => setTimeout(() => setShowRecentSearches(false), 200)}
                placeholder="Search messages..."
                className="ui-text w-full"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  paddingLeft: '2.75rem',
                  paddingRight: currentSearchQuery ? '2.75rem' : '1rem',
                }}
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }}>
                <Icons.Search />
              </div>
              {currentSearchQuery && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--text-tertiary)' }}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <Icons.Close />
                </button>
              )}
              {showRecentSearches && recentSearches.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {recentSearches.map((search, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectRecentSearch(search)}
                      className="w-full text-left px-4 py-2 text-small hover:opacity-70"
                      style={{
                        color: 'var(--text-primary)',
                        backgroundColor: idx === 0 ? 'var(--bg-tertiary)' : 'transparent',
                      }}
                    >
                      <span style={{ display: 'inline-block', marginRight: '8px', color: 'var(--text-tertiary)' }}>
                        <Icons.Search />
                      </span>
                      {search}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between text-small" style={{ color: 'var(--text-secondary)' }}>
              <span>
                {currentSearchQuery
                  ? `${filteredMessages.length} of ${selectedConversation.messages.length}`
                  : `${selectedConversation.messages.length} messages`}
              </span>
              <button
                onClick={loadFullConversationToCanvas}
                className="font-medium rounded-md transition-smooth"
                style={{
                  backgroundImage: 'var(--accent-primary-gradient)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-inverse)',
                  padding: 'var(--space-xs) var(--space-sm)',
                  fontSize: '0.8125rem',
                }}
              >
                Load All →
              </button>
            </div>
          </div>

          {/* Messages list */}
          <div
            className="overflow-y-auto"
            style={{
              height: 'calc(100% - 240px)',
              padding: 'var(--space-md)',
            }}
          >
            <div className="space-y-2">
              {filteredMessages.map((msg, idx) => {
                const originalIndex = selectedConversation.messages.findIndex(m => m.id === msg.id);
                const isSelected = selectedMessageIndex === originalIndex;
                const isFocused = focusedIndex === idx;

                return (
                  <div
                    key={msg.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(idx, el);
                      else itemRefs.current.delete(idx);
                    }}
                    onClick={() => loadMessageToCanvas(originalIndex)}
                    className="card cursor-pointer transition-all"
                    style={{
                      ...(isSelected
                        ? {
                            backgroundImage: 'var(--accent-primary-gradient)',
                            backgroundColor: 'transparent',
                          }
                        : isFocused
                        ? {
                            backgroundColor: 'var(--bg-tertiary)',
                          }
                        : {
                            backgroundColor: 'var(--bg-elevated)',
                          }),
                      color: isSelected ? 'var(--text-inverse)' : 'var(--text-primary)',
                      padding: 'var(--space-sm)',
                      border: `2px solid ${isFocused ? 'var(--accent-primary)' : 'transparent'}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="tag"
                        style={{
                          backgroundColor: isSelected
                            ? 'rgba(255, 255, 255, 0.25)'
                            : msg.role === 'user'
                            ? 'rgba(6, 182, 212, 0.2)'
                            : 'rgba(167, 139, 250, 0.2)',
                          color: isSelected
                            ? 'var(--text-inverse)'
                            : msg.role === 'user'
                            ? 'var(--accent-secondary)'
                            : 'var(--accent-primary)',
                          border: 'none',
                          fontSize: '0.625rem',
                          fontWeight: 600,
                        }}
                      >
                        {msg.role.toUpperCase()}
                      </span>
                      <span className="text-tiny" style={{ opacity: 0.75 }}>
                        #{originalIndex + 1}
                      </span>
                    </div>
                    <div className="text-small line-clamp-3" style={{ opacity: isSelected ? 1 : 0.9 }}>
                      {formatMessageContent(msg.content)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </>
    );
  }

  // GALLERY VIEW
  if (viewMode === 'gallery') {
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
          className="fixed top-16 left-0 bottom-0 w-80 md:w-full md:h-full z-50 md:relative md:top-0 overflow-y-auto panel"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderRight: '1px solid var(--border-color)',
            borderRadius: 0,
          }}
        >
          {/* Gallery content */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{ padding: 'var(--space-lg)', borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-2 mb-3">
                {galleryFolder && (
                  <button
                    onClick={() => {
                      setGalleryFolder(undefined);
                      setGallerySearch('');
                    }}
                    className="p-1 rounded hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--text-secondary)' }}
                    title="Back to all images"
                    aria-label="Back to all images"
                  >
                    <Icons.ArrowLeft />
                  </button>
                )}
                <button
                  onClick={() => setViewMode('conversations')}
                  className="p-1 rounded hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--text-secondary)' }}
                  title="Back to conversations"
                  aria-label="Back to conversations"
                >
                  <Icons.Archive />
                </button>
                <h3 className="heading-sm flex-1" style={{ color: 'var(--text-primary)' }}>
                  {galleryFolder ? (
                    galleryImages[0]?.conversationTitle || 'Conversation Gallery'
                  ) : (
                    'Media Gallery'
                  )}
                </h3>
              </div>
              <div className="text-small mb-3" style={{ color: 'var(--text-secondary)' }}>
                {galleryTotal.toLocaleString()} images • {galleryImages.length} loaded
              </div>
              {/* Gallery search */}
              <div className="relative">
                <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }}>
                  <Icons.Search />
                </div>
                <input
                  type="text"
                  placeholder="Search images..."
                  value={gallerySearch}
                  onChange={(e) => setGallerySearch(e.target.value)}
                  className="w-full text-body rounded-md focus:outline-none focus:ring-2 transition-all"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    paddingLeft: '2.75rem',
                    paddingRight: gallerySearch ? '2.75rem' : '1rem',
                    paddingTop: '0.625rem',
                    paddingBottom: '0.625rem',
                  }}
                />
                {gallerySearch && (
                  <button
                    onClick={() => setGallerySearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--text-tertiary)' }}
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    <Icons.Close />
                  </button>
                )}
              </div>
            </div>

            {/* Gallery grid */}
            <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-md)' }}>
              {galleryLoading && galleryImages.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-xl)' }}>
                  Loading images...
                </div>
              ) : (
                <>
                  {/* Image grid - 2 columns on mobile, 3 on desktop */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                      gap: 'var(--space-sm)',
                    }}
                  >
                    {galleryImages.map((img, idx) => (
                      <div
                        key={idx}
                        className="gallery-image-item"
                        onClick={() => setLightboxImage(img)}
                        style={{
                          position: 'relative',
                          aspectRatio: '1',
                          overflow: 'hidden',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-tertiary)',
                          cursor: 'pointer',
                          transition: 'opacity 0.2s',
                        }}
                      >
                        <img
                          src={img.url}
                          alt={img.conversationTitle}
                          loading="lazy"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                        {/* Hover overlay with title */}
                        <div
                          className="gallery-image-overlay"
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
                            padding: 'var(--space-xs)',
                            pointerEvents: 'none',
                          }}
                        >
                          <div className="text-tiny" style={{ color: 'white', fontWeight: 600 }}>
                            {img.conversationTitle}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {galleryHasMore && (
                    <button
                      onClick={() => loadGalleryImages(false)}
                      disabled={galleryLoading}
                      className="btn-secondary mt-4 w-full"
                      style={{
                        opacity: galleryLoading ? 0.5 : 1,
                      }}
                    >
                      {galleryLoading ? 'Loading...' : `Load More (${galleryImages.length} of ${galleryTotal})`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Lightbox */}
        {lightboxImage && (
          <ImageLightbox
            image={lightboxImage}
            images={galleryImages}
            onClose={() => setLightboxImage(null)}
            onViewConversation={handleViewConversation}
          />
        )}
      </>
    );
  }

  // CONVERSATIONS VIEW
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
        className="fixed top-16 left-0 bottom-0 w-80 md:w-full md:h-full z-50 md:relative md:top-0 overflow-y-auto panel"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderRight: '1px solid var(--border-color)',
          borderRadius: 0,
        }}
      >
        {/* Header */}
        <div
          className="panel-header"
          style={{
            padding: 'var(--space-lg)',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="heading-md" style={{ color: 'var(--text-primary)' }}>
              Archive{' '}
              <span
                className="text-small"
                style={{ color: 'var(--text-tertiary)' }}
                title="/Users/tem/openai-export-parser/output_v13_final"
              >
                (output_v13_final)
              </span>
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

          {/* View Mode Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setViewMode('conversations')}
              className="tag"
              style={{
                backgroundColor: viewMode === 'conversations' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: viewMode === 'conversations' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                border: `1px solid ${viewMode === 'conversations' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                fontWeight: 600,
              }}
            >
              📄 Archive
            </button>
            <button
              onClick={() => setViewMode('sessions')}
              className="tag"
              style={{
                backgroundColor: viewMode === 'sessions' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: viewMode === 'sessions' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                border: `1px solid ${viewMode === 'sessions' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                fontWeight: 600,
              }}
            >
              📋 Sessions
            </button>
            <button
              onClick={() => setViewMode('gallery')}
              className="tag"
              style={{
                backgroundColor: viewMode === 'gallery' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: viewMode === 'gallery' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                border: `1px solid ${viewMode === 'gallery' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                fontWeight: 600,
              }}
            >
              🖼️ Gallery
            </button>
          </div>

          {/* Conversations View */}
          {viewMode === 'conversations' && (
            <>
          {/* Search */}
          <div className="relative mb-4">
            <input
              type="text"
              value={currentSearchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setShowRecentSearches(true)}
              onBlur={() => setTimeout(() => setShowRecentSearches(false), 200)}
              placeholder="Search conversations..."
              className="ui-text w-full"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                paddingLeft: '2.75rem',
                paddingRight: currentSearchQuery ? '2.75rem' : '1rem',
              }}
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }}>
              <Icons.Search />
            </div>
            {currentSearchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:opacity-70 transition-opacity"
                style={{ color: 'var(--text-tertiary)' }}
                title="Clear search"
                aria-label="Clear search"
              >
                <Icons.Close />
              </button>
            )}
            {showRecentSearches && recentSearches.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-1 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {recentSearches.map((search, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectRecentSearch(search)}
                    className="w-full text-left px-4 py-2 text-small hover:opacity-70"
                    style={{
                      color: 'var(--text-primary)',
                      backgroundColor: idx === 0 ? 'var(--bg-tertiary)' : 'transparent',
                    }}
                  >
                    <span style={{ display: 'inline-block', marginRight: '8px', color: 'var(--text-tertiary)' }}>
                      <Icons.Search />
                    </span>
                    {search}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Import JSON Button */}
          <div className="mb-4">
              <label
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer transition-colors"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <span>📥</span>
                <span className="ui-text font-medium">Import JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                  disabled={loading}
                />
              </label>
            </div>

          {/* Filter UI - single line */}
          <div className="mb-4">
            <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
              {/* Show "All" button when no filters active */}
              {!hasActiveFilters && (
                <button
                  className="tag"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--text-inverse)',
                    border: '1px solid var(--accent-primary)',
                    fontWeight: 600,
                  }}
                >
                  All
                </button>
              )}

              {/* Show active filter chips */}
              {Object.entries(activeFilters).map(([category, tag]) => (
                <button
                  key={category}
                  onClick={() => removeFilter(category as FilterCategory)}
                  className="tag"
                  style={{
                    backgroundImage: 'var(--accent-primary-gradient)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-inverse)',
                    border: '1px solid transparent',
                    fontWeight: 600,
                  }}
                >
                  {tag} ✕
                </button>
              ))}

              {/* Show category buttons for unselected categories */}
              {!activeFilters.date && (
                <button
                  onClick={() => setShowingCategory(showingCategory === 'date' ? null : 'date')}
                  className="tag"
                  style={{
                    backgroundColor: showingCategory === 'date' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: showingCategory === 'date' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                    border: `1px solid ${showingCategory === 'date' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    fontWeight: 600,
                  }}
                >
                  Date {showingCategory === 'date' ? '▼' : '+'}
                </button>
              )}

              {!activeFilters.size && (
                <button
                  onClick={() => setShowingCategory(showingCategory === 'size' ? null : 'size')}
                  className="tag"
                  style={{
                    backgroundColor: showingCategory === 'size' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: showingCategory === 'size' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                    border: `1px solid ${showingCategory === 'size' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    fontWeight: 600,
                  }}
                >
                  Size {showingCategory === 'size' ? '▼' : '+'}
                </button>
              )}

              {!activeFilters.media && categorizedTags.media.length > 0 && (
                <button
                  onClick={() => setShowingCategory(showingCategory === 'media' ? null : 'media')}
                  className="tag"
                  style={{
                    backgroundColor: showingCategory === 'media' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: showingCategory === 'media' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                    border: `1px solid ${showingCategory === 'media' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    fontWeight: 600,
                  }}
                >
                  Media {showingCategory === 'media' ? '▼' : '+'}
                </button>
              )}

              {/* Sort direction toggle */}
              <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
              <button
                onClick={() => setSortDirection(sortDirection === 'descending' ? 'ascending' : 'descending')}
                className="tag"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  fontWeight: 600,
                }}
                title={sortDirection === 'descending' ? 'Newest first' : 'Oldest first'}
              >
                {sortDirection === 'descending' ? '↓ Descending' : '↑ Ascending'}
              </button>

              {/* Show tag options for selected category */}
              {showingCategory && (
                <>
                  <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
                  {categorizedTags[showingCategory].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => selectFilter(showingCategory, tag)}
                      className="tag"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

        {/* Stats */}
        <div className="text-small" style={{ color: 'var(--text-secondary)' }}>
            {currentSearchQuery || hasActiveFilters
              ? `${filteredConversations.length} of ${conversations.length}`
              : `${conversations.length} conversations`}
          </div>

        {/* Conversations list */}
        <div
          className="overflow-y-auto"
          style={{
            height: 'calc(100% - 260px)',
            padding: 'var(--space-lg)',
          }}
        >
          {loading && (
            <div className="flex items-center justify-center" style={{ paddingTop: 'var(--space-2xl)' }}>
              <div className="animate-spin" style={{ color: 'var(--accent-primary)' }}>
                <Icons.Archive />
              </div>
            </div>
          )}

          {error && (
            <div
              className="card"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                padding: 'var(--space-md)',
                border: '1px solid var(--error)',
              }}
            >
              <p className="text-small font-medium mb-2" style={{ color: 'var(--error)' }}>
                Archive Connection Error
              </p>
              <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
                {error}
              </p>
              <button
                onClick={loadConversations}
                className="mt-4 font-medium rounded-md transition-smooth"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--text-inverse)',
                  padding: 'var(--space-sm) var(--space-md)',
                  fontSize: '0.875rem',
                }}
              >
                Retry Connection
              </button>
            </div>
          )}

          {!loading && !error && filteredConversations.length === 0 && (
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
                No conversations found
              </p>
              <p className="text-small" style={{ color: 'var(--text-tertiary)' }}>
                {currentSearchQuery || hasActiveFilters
                  ? 'Try adjusting your search or filters'
                  : 'Make sure the archive server is running'}
              </p>
            </div>
          )}

          {!loading && !error && filteredConversations.length > 0 && (
            <div className="space-y-2">
              {filteredConversations.map((conv, idx) => {
                const isSelected = selectedConversation?.id === conv.id;
                const isFocused = focusedIndex === idx;

                const hasImages = conv.tags?.includes('Has Images');

                return (
                  <div key={conv.folder} className="relative">
                    <button
                      ref={(el) => {
                        if (el) itemRefs.current.set(idx, el);
                        else itemRefs.current.delete(idx);
                      }}
                      onClick={() => {
                        loadConversation(conv.folder);
                        if (window.innerWidth < 768) {
                          onClose();
                        }
                      }}
                      className="card w-full text-left transition-all"
                      style={{
                        ...(isSelected
                          ? {
                              backgroundImage: 'var(--accent-primary-gradient)',
                              backgroundColor: 'transparent',
                            }
                          : isFocused
                          ? {
                              backgroundColor: 'var(--bg-tertiary)',
                            }
                          : {
                              backgroundColor: 'var(--bg-elevated)',
                            }),
                        color: isSelected ? 'var(--text-inverse)' : 'var(--text-primary)',
                        padding: 'var(--space-sm)',
                        paddingRight: hasImages ? '3rem' : 'var(--space-sm)',
                        border: `2px solid ${isFocused ? 'var(--accent-primary)' : 'transparent'}`,
                      }}
                    >
                      <div className="font-medium mb-2 line-clamp-2" style={{ fontSize: '0.9375rem' }}>
                        {conv.title}
                      </div>
                      <div className="text-small mb-2" style={{ opacity: 0.9 }}>
                        {conv.message_count} messages
                      </div>
                      {conv.tags && conv.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {conv.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="tag"
                              style={{
                                backgroundColor: isSelected
                                  ? 'rgba(255, 255, 255, 0.25)'
                                  : 'var(--bg-tertiary)',
                                color: isSelected ? 'var(--text-inverse)' : 'var(--text-secondary)',
                                borderColor: 'transparent',
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                    {hasImages && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          viewConversationGallery(conv.folder);
                        }}
                        className="absolute right-2 top-2 p-2 rounded-md transition-all hover:opacity-70"
                        style={{
                          color: isSelected ? 'var(--text-inverse)' : 'var(--text-secondary)',
                          backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.15)' : 'var(--bg-secondary)',
                        }}
                        title="View images from this conversation"
                        aria-label="View gallery"
                      >
                        <Icons.Image />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

          {/* Sessions View */}
          {viewMode === 'sessions' && (
            <SessionsView
              onSelectSession={(session: Session) => {
                console.log('Selected session:', session);
                // TODO: Load session buffers into workspace
              }}
            />
          )}
        </div>
      </aside>
    </>
  );
}
