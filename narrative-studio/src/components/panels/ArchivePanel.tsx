import { useState, useEffect, useMemo, useRef } from 'react';
import type { ConversationMetadata, Conversation, GalleryImage } from '../../types';
import { Icons } from '../layout/Icons';
import { archiveService } from '../../services/archiveService';
import { galleryService } from '../../services/galleryService';
import { ImageLightbox } from './ImageLightbox';
import { ImportsView } from '../archive/ImportsView';
import { ExploreView } from '../archive/ExploreView';
import { FacebookFeedView } from '../archive/FacebookFeedView';
import { BooksView } from '../archive/BooksView';
import { BookStructureTree } from '../archive/BookStructureTree';
import { ThisBookView } from '../archive/ThisBookView';
import { PageEditorView } from '../archive/PageEditorView';
import { WorkspacesView } from '../archive/WorkspacesView';
import { GutenbergView } from '../archive/GutenbergView';
import { PasteImportView } from '../archive/PasteImportView';
import { useActiveBook } from '../../contexts/ActiveBookContext';
import { useUnifiedBuffer } from '../../contexts/UnifiedBufferContext';
import { STORAGE_PATHS } from '../../config/storage-paths';
import { features } from '../../config/feature-flags';

// Extracted archive components
import { useArchiveState, type ViewMode, type FilterCategory } from '../../hooks/useArchiveState';
import { ArchivePanelWrapper } from '../archive/ArchivePanelWrapper';
import { ArchiveSearchBar } from '../archive/ArchiveSearchBar';
import { ConversationsListView } from '../archive/ConversationsListView';
import { MessageListView } from '../archive/MessageListView';
import { GalleryGridView } from '../archive/GalleryGridView';

const API_BASE = STORAGE_PATHS.archiveServerUrl;

interface ArchivePanelProps {
  onSelectNarrative: (narrative: any) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ArchivePanel({ onSelectNarrative, isOpen, onClose }: ArchivePanelProps) {
  // Centralized archive state from hook
  const archiveState = useArchiveState({
    defaultViewMode: 'conversations',
    localArchivesEnabled: features.localArchives,
  });

  // Destructure for convenience
  const {
    viewMode,
    setViewMode,
    conversationSearch,
    messageSearch,
    setMessageSearch,
    currentSearchQuery,
    handleSearchChange,
    clearSearch,
    saveCurrentSearch,
    recentSearches,
    showRecentSearches,
    setShowRecentSearches,
    selectRecentSearch,
    activeFilters,
    hasActiveFilters,
    showingCategory,
    setShowingCategory,
    selectFilter,
    removeFilter,
    categorizeConversationTags,
    filterConversations,
    sortDirection,
    toggleSortDirection,
  } = archiveState;

  // Local state for data and UI
  const [conversations, setConversations] = useState<ConversationMetadata[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);
  const [selectedFacebookItem, setSelectedFacebookItem] = useState<any | null>(null);
  const [relatedFacebookItems, setRelatedFacebookItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  // Book structure tree state
  const [bookTreeCollapsed, setBookTreeCollapsed] = useState(() => {
    const saved = localStorage.getItem('archive-book-tree-collapsed');
    return saved === 'true';
  });
  const { activeBook, refreshActiveBook } = useActiveBook();

  // Unified buffer for sending content to tools
  const {
    setWorkingBuffer,
    createFromMessage,
    createFromConversation,
    createFromFacebookPost,
    createFromMedia,
    createFromText,
    workingBuffer,
  } = useUnifiedBuffer();

  // Page editor state
  const [editingPage, setEditingPage] = useState<{ bookId: string; pageId: string } | null>(null);

  // Gallery state
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryOffset, setGalleryOffset] = useState(0);
  const [galleryTotal, setGalleryTotal] = useState(0);
  const [galleryHasMore, setGalleryHasMore] = useState(true);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null);
  const [galleryFolder, setGalleryFolder] = useState<string | undefined>(undefined); // Filter gallery by conversation folder
  const [gallerySearch, setGallerySearch] = useState<string>(''); // Search query for gallery
  const [gallerySource, setGallerySource] = useState<'openai' | 'facebook'>('openai'); // Source toggle for gallery

  // Current archive state
  const [currentArchiveName, setCurrentArchiveName] = useState<string>('');
  const [currentArchivePath, setCurrentArchivePath] = useState<string>('');

  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());
  const prevViewModeRef = useRef<ViewMode>(viewMode);

  // Persist book tree collapsed state
  useEffect(() => {
    localStorage.setItem('archive-book-tree-collapsed', String(bookTreeCollapsed));
  }, [bookTreeCollapsed]);

  // Load conversations on mount - only in Electron mode with local archives
  useEffect(() => {
    if (isOpen && features.localArchives) {
      loadConversations();
    }
  }, [isOpen]);

  const loadConversations = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch current archive info
      try {
        const archiveRes = await fetch(`${API_BASE}/api/archives/current`);
        if (archiveRes.ok) {
          const archiveInfo = await archiveRes.json();
          setCurrentArchiveName(archiveInfo.name || '');
          setCurrentArchivePath(archiveInfo.path || '');
        }
      } catch (archiveErr) {
        console.warn('Could not fetch current archive info:', archiveErr);
      }

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
      setSelectedFacebookItem(null); // Clear any previous Facebook item
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

        // Also set unified buffer so workspace can be auto-created
        const firstMessage = conv.messages[0];
        const bufferContent = createFromMessage(firstMessage, conv, 0);
        setWorkingBuffer(bufferContent);
        console.log('[ArchivePanel] Auto-loaded first message to canvas + unified buffer:', bufferContent.id);
      }
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
      alert(`Could not load conversation: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadFacebookItem = async (item: any) => {
    setSelectedFacebookItem(item);
    setSelectedConversation(null); // Clear any previous conversation
    setViewMode('messages');

    // Build content with inline images
    let content = item.text || '[No text content]';

    // Parse media_refs and append markdown images
    try {
      const mediaRefs = item.media_refs ? JSON.parse(item.media_refs) : [];
      if (mediaRefs.length > 0) {
        content += '\n\n'; // Add spacing before images

        // Add each image as markdown
        mediaRefs.forEach((imagePath: string, index: number) => {
          // Base64 encode the path for URL safety (browser-compatible)
          const encodedPath = btoa(imagePath);
          const imageUrl = `${API_BASE}/api/facebook/image?path=${encodedPath}`;

          // Add markdown image syntax
          content += `![Image ${index + 1}](${imageUrl})\n\n`;
        });
      }
    } catch (e) {
      console.error('Failed to parse media_refs:', e);
    }

    // Convert Facebook item to narrative format for transformation
    const narrative = {
      id: item.id,
      title: item.title || `Facebook ${item.type}`,
      content: content,
      metadata: {
        source: 'facebook',
        type: item.type,
        created_at: item.created_at,
        author: item.author_name,
        context: item.context,
        media_count: item.media_count || 0,
      },
    };

    onSelectNarrative(narrative);
    console.log(`Loaded Facebook ${item.type}:`, item.id);

    // Check if this item has media - if so, load related items from same day
    const hasMedia = item.media_refs && JSON.parse(item.media_refs || '[]').length > 0;
    if (hasMedia) {
      await loadRelatedFacebookItems(item.created_at);
    } else {
      setRelatedFacebookItems([]);
    }
  };

  // Load related Facebook items from the same day as the given timestamp
  const loadRelatedFacebookItems = async (timestamp: number) => {
    try {
      const date = new Date(timestamp * 1000);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 1000;
      const endOfDay = startOfDay + 86400; // +24 hours

      const response = await fetch(`${API_BASE}/api/content/items?source=facebook&limit=100`);
      const data = await response.json();

      // Filter items from the same day, excluding the current item
      const related = data.items.filter((item: any) =>
        item.created_at >= startOfDay &&
        item.created_at < endOfDay &&
        item.id !== selectedFacebookItem?.id
      );

      setRelatedFacebookItems(related);
      console.log(`Found ${related.length} related items from same day`);
    } catch (err) {
      console.error('Failed to load related Facebook items:', err);
      setRelatedFacebookItems([]);
    }
  };

  // Load gallery images
  const loadGalleryImages = async (reset = false) => {
    if (galleryLoading) return;

    setGalleryLoading(true);
    setError(null);
    try {
      const offset = reset ? 0 : galleryOffset;

      if (gallerySource === 'facebook') {
        // Load Facebook media
        const params = new URLSearchParams({
          limit: '50',
          offset: offset.toString(),
        });
        const response = await fetch(`${API_BASE}/api/facebook/media?${params}`);
        const data = await response.json();

        // Convert Facebook media to GalleryImage format
        const images: GalleryImage[] = data.media.map((m: any) => ({
          url: `file://${m.url}`,
          conversationTitle: m.postTitle || m.postText?.substring(0, 50) || 'Facebook Post',
          conversationId: m.postId,
          messageRole: m.postType,
          timestamp: m.created_at,
        }));

        if (reset) {
          setGalleryImages(images);
          setGalleryOffset(50);
        } else {
          setGalleryImages(prev => [...prev, ...images]);
          setGalleryOffset(prev => prev + 50);
        }

        setGalleryTotal(data.total);
        setGalleryHasMore(data.hasMore);
        console.log(`Loaded ${images.length} Facebook images`);
      } else {
        // Load OpenAI images
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
      }
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

  // Reload gallery when filter, search, or source changes
  useEffect(() => {
    if (viewMode === 'gallery') {
      loadGalleryImages(true);
    }
  }, [galleryFolder, gallerySearch, gallerySource]);

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

      // Also set the unified buffer so workspace can be auto-created
      const message = selectedConversation.messages[index];
      if (message) {
        const bufferContent = createFromMessage(message, selectedConversation, index);
        setWorkingBuffer(bufferContent);
        console.log('[ArchivePanel] Loaded message to canvas + unified buffer:', bufferContent.id);
      }
    }
  };

  const loadFullConversationToCanvas = () => {
    if (selectedConversation) {
      const narrative = archiveService.conversationToNarrative(selectedConversation);
      onSelectNarrative(narrative);
      console.log('Loaded full conversation to canvas');
    }
  };

  // ============================================================
  // SEND TO BUFFER HANDLERS
  // ============================================================

  /** Send a single message to the unified buffer */
  const sendMessageToBuffer = (index: number) => {
    if (selectedConversation && selectedConversation.messages[index]) {
      const message = selectedConversation.messages[index];
      const bufferContent = createFromMessage(message, selectedConversation, index);
      setWorkingBuffer(bufferContent);
      console.log('[Buffer] Sent message to buffer:', bufferContent.displayName);
    }
  };

  /** Send full conversation to the unified buffer */
  const sendConversationToBuffer = () => {
    if (selectedConversation) {
      const bufferContent = createFromConversation(selectedConversation);
      setWorkingBuffer(bufferContent);
      console.log('[Buffer] Sent conversation to buffer:', bufferContent.displayName);
    }
  };

  /** Send Facebook post/comment to the unified buffer */
  const sendFacebookItemToBuffer = (item: any) => {
    // Parse media refs if present
    let mediaUrls: string[] = [];
    try {
      const mediaRefs = item.media_refs ? JSON.parse(item.media_refs) : [];
      mediaUrls = mediaRefs.map((ref: any) => `${API_BASE}/media/${ref.path}`);
    } catch (e) {
      console.warn('Failed to parse media refs:', e);
    }

    // Parse comments if this is a post
    let comments: any[] = [];
    if (item.comments) {
      try {
        comments = typeof item.comments === 'string' ? JSON.parse(item.comments) : item.comments;
      } catch (e) {
        comments = [];
      }
    }

    const bufferContent = createFromFacebookPost({
      text: item.text || '',
      timestamp: item.created_at ? item.created_at * 1000 : undefined,
      author: item.author || 'Unknown',
      postType: item.type === 'post' ? 'status' : undefined,
      mediaUrls,
      comments: comments.map((c: any) => ({
        text: c.text || c.comment || '',
        timestamp: c.timestamp ? c.timestamp * 1000 : undefined,
        author: c.author || 'Unknown',
      })),
      location: item.place ? {
        name: item.place.name,
        city: item.place.city,
      } : undefined,
    });
    setWorkingBuffer(bufferContent);
    console.log('[Buffer] Sent Facebook item to buffer:', bufferContent.displayName);
  };

  /** Send gallery image to the unified buffer */
  const sendImageToBuffer = (image: GalleryImage) => {
    const bufferContent = createFromMedia(image);
    setWorkingBuffer(bufferContent);
    console.log('[Buffer] Sent image to buffer:', bufferContent.displayName);
  };

  // Categorize tags from conversations (using hook's helper)
  const categorizedTags = useMemo(
    () => categorizeConversationTags(conversations),
    [conversations, categorizeConversationTags]
  );

  // Filter and sort conversations (using hook's helper)
  const filteredConversations = useMemo(
    () => filterConversations(conversations, conversationSearch, activeFilters, sortDirection),
    [conversations, conversationSearch, activeFilters, sortDirection, filterConversations]
  );

  // Filter messages (works for both conversations and Facebook items)
  const filteredMessages = useMemo(() => {
    if (selectedConversation && selectedConversation.messages) {
      return selectedConversation.messages.filter((msg) =>
        !messageSearch || msg.content.toLowerCase().includes(messageSearch.toLowerCase())
      );
    } else if (selectedFacebookItem) {
      // Facebook items are single items, not conversations with multiple messages
      // Just return a single "message" object
      return [{
        id: selectedFacebookItem.id,
        role: selectedFacebookItem.type,
        content: selectedFacebookItem.text || '[No text content]',
        created_at: selectedFacebookItem.created_at,
      }];
    }
    return [];
  }, [selectedConversation, selectedFacebookItem, messageSearch]);

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
            // Restore focus to the selected conversation
            if (selectedConversation) {
              const idx = filteredConversations.findIndex(c => c.id === selectedConversation.id);
              setFocusedIndex(idx !== -1 ? idx : 0);
            } else {
              setFocusedIndex(0);
            }
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
      // Use 'center' to position selected conversation in the middle of viewport
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [focusedIndex]);

  // Reset focused index when filters/search change (but NOT when viewMode changes)
  useEffect(() => {
    // Only reset if we're in conversations view and filters/search actually changed
    if (viewMode === 'conversations') {
      setFocusedIndex(0);
    }
  }, [currentSearchQuery, activeFilters]);

  // Focus the selected conversation when returning to conversations view
  useEffect(() => {
    const prevViewMode = prevViewModeRef.current;

    // Only focus selected conversation when transitioning TO conversations view
    if (viewMode === 'conversations' && prevViewMode !== 'conversations' && selectedConversation) {
      // Find the index of the selected conversation in the filtered list
      const selectedIndex = filteredConversations.findIndex(
        conv => conv.id === selectedConversation.id
      );

      if (selectedIndex !== -1) {
        setFocusedIndex(selectedIndex);
        console.log(`Focused conversation "${selectedConversation.title}" at index ${selectedIndex}`);
      }
    }

    // Update ref for next render
    prevViewModeRef.current = viewMode;
  }, [viewMode, selectedConversation, filteredConversations]);

  // Tab list for navigation - conditional based on environment
  const tabList = [
    // Both: Paste/Import - always available, first for discoverability
    { id: 'paste', icon: '📥', title: 'Import' },
    // Electron-only: Local archive browsing
    ...(features.localArchives ? [{ id: 'conversations', icon: '📄', title: 'Archive' }] : []),
    // Web-only: Project Gutenberg
    ...(features.gutenberg ? [{ id: 'gutenberg', icon: '📜', title: 'Gutenberg' }] : []),
    // Both: Active book view
    ...(activeBook ? [{ id: 'thisbook', icon: '📖', title: `This Book - "${activeBook.title}"` }] : []),
    // Both: Workspaces and Books
    { id: 'workspaces', icon: '📂', title: 'Workspaces' },
    { id: 'books', icon: '📚', title: 'Books' },
    // Electron-only: Gallery, Imports, Explore, Facebook
    ...(features.localArchives ? [
      { id: 'gallery', icon: '🖼️', title: 'Gallery' },
      { id: 'imports', icon: '⬇️', title: 'Archive Imports' },
      { id: 'explore', icon: '🧭', title: 'Explore' },
      { id: 'facebook', icon: 'ⓕ', title: 'Facebook' },
    ] : []),
  ];

  // Determine which tab should appear selected (handle 'messages' view case)
  const effectiveTabId = viewMode === 'messages'
    ? (selectedFacebookItem ? 'facebook' : 'conversations')
    : viewMode;

  // Focus selected conversation when returning to conversations view
  const handleFocusConversation = () => {
    if (selectedConversation) {
      const idx = filteredConversations.findIndex(c => c.id === selectedConversation.id);
      setFocusedIndex(idx !== -1 ? idx : 0);
    }
  };

  if (!isOpen) return null;

  // MESSAGES VIEW (for both conversations and Facebook items)
  if (viewMode === 'messages' && (selectedConversation || selectedFacebookItem)) {
    const isConversation = !!selectedConversation;
    const messageTitle = isConversation
      ? selectedConversation.title
      : (selectedFacebookItem.title || `Facebook ${selectedFacebookItem.type}`);

    const messagesHeaderContent = (
      <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        {/* Back button + Title */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => {
              if (isConversation) {
                setViewMode('conversations');
                if (selectedConversation) {
                  const idx = filteredConversations.findIndex(c => c.id === selectedConversation.id);
                  if (idx !== -1) setFocusedIndex(idx);
                }
              } else {
                setViewMode('facebook');
                setSelectedFacebookItem(null);
              }
            }}
            style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.75rem' }}
          >← Back</button>
          <div className="flex-1 font-medium text-small line-clamp-1 u-text-primary">{messageTitle}</div>
        </div>

        {/* Search - compact */}
        <div className="relative mb-3">
          <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none u-text-tertiary">
            <Icons.Search />
          </div>
          <input
            type="text"
            value={currentSearchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setShowRecentSearches(true)}
            onBlur={() => setTimeout(() => setShowRecentSearches(false), 200)}
            placeholder="Search..."
            style={{
              width: '100%', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              color: 'var(--text-primary)', paddingLeft: '2.5rem', paddingRight: currentSearchQuery ? '2.5rem' : '0.75rem',
              paddingTop: '0.5rem', paddingBottom: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem',
            }}
          />
          {currentSearchQuery && (
            <button onClick={() => handleSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <Icons.Close />
            </button>
          )}
        </div>

        {/* Action row - compact */}
        <div className="flex items-center justify-between" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <span>
            {selectedConversation?.messages ? (
              currentSearchQuery ? `${filteredMessages.length}/${selectedConversation.messages.length}` : `${selectedConversation.messages.length} msgs`
            ) : selectedFacebookItem ? 'Facebook' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={loadFullConversationToCanvas}
              style={{
                backgroundImage: 'var(--accent-primary-gradient)', backgroundColor: 'transparent',
                color: 'var(--text-inverse)', padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 600,
              }}
            >Load All →</button>
          </div>
        </div>
      </div>
    );

    return (
      <ArchivePanelWrapper
        onClose={onClose}
        tabs={tabList}
        viewMode={viewMode}
        effectiveTabId={effectiveTabId}
        onTabChange={setViewMode}
        onFocusConversation={handleFocusConversation}
        headerContent={messagesHeaderContent}
      >
        <MessageListView
          messages={filteredMessages}
          selectedConversation={selectedConversation}
          selectedFacebookItem={selectedFacebookItem}
          selectedMessageIndex={selectedMessageIndex}
          focusedIndex={focusedIndex}
          relatedFacebookItems={relatedFacebookItems}
          onSelectMessage={loadMessageToCanvas}
          onSelectFacebookItem={loadFacebookItem}
          itemRefs={itemRefs}
        />
      </ArchivePanelWrapper>
    );
  }

  // GALLERY VIEW
  if (viewMode === 'gallery') {
    const lightboxOverlay = lightboxImage ? (
      <ImageLightbox
        image={lightboxImage}
        images={galleryImages}
        onClose={() => setLightboxImage(null)}
        onViewConversation={handleViewConversation}
      />
    ) : undefined;

    return (
      <ArchivePanelWrapper
        onClose={onClose}
        tabs={tabList}
        viewMode={viewMode}
        effectiveTabId={effectiveTabId}
        onTabChange={setViewMode}
        onFocusConversation={handleFocusConversation}
        overlay={lightboxOverlay}
      >
        <GalleryGridView
          images={galleryImages}
          total={galleryTotal}
          hasMore={galleryHasMore}
          loading={galleryLoading}
          folder={galleryFolder}
          source={gallerySource}
          searchQuery={gallerySearch}
          onSourceChange={setGallerySource}
          onSearchChange={setGallerySearch}
          onLoadMore={() => loadGalleryImages(false)}
          onImageClick={setLightboxImage}
        />
      </ArchivePanelWrapper>
    );
  }

  // CONVERSATIONS VIEW (main view with multiple sub-views)
  const conversationsHeaderContent = viewMode === 'conversations' ? (
    <ArchiveSearchBar
      searchQuery={conversationSearch}
      onSearchChange={handleSearchChange}
      onClearSearch={clearSearch}
      placeholder="Search conversations..."
      recentSearches={recentSearches}
      showRecentSearches={showRecentSearches}
      onShowRecentSearches={setShowRecentSearches}
      onSelectRecentSearch={selectRecentSearch}
      activeFilters={activeFilters}
      hasActiveFilters={hasActiveFilters}
      showingCategory={showingCategory}
      onShowCategory={setShowingCategory}
      onSelectFilter={selectFilter}
      onRemoveFilter={removeFilter}
      categorizedTags={categorizedTags}
      sortDirection={sortDirection}
      onToggleSortDirection={toggleSortDirection}
      totalCount={conversations.length}
      filteredCount={filteredConversations.length}
    />
  ) : undefined;

  const pageEditorOverlay = editingPage ? (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--bg-panel)',
        zIndex: 100,
      }}
    >
      <PageEditorView
        bookId={editingPage.bookId}
        pageId={editingPage.pageId}
        onClose={() => setEditingPage(null)}
        onSaved={() => {
          refreshActiveBook();
        }}
      />
    </div>
  ) : undefined;

  return (
    <ArchivePanelWrapper
      onClose={onClose}
      tabs={tabList}
      viewMode={viewMode}
      effectiveTabId={effectiveTabId}
      onTabChange={setViewMode}
      onFocusConversation={handleFocusConversation}
      archiveName={currentArchiveName}
      archivePath={currentArchivePath}
      showArchiveName={true}
      headerContent={conversationsHeaderContent}
      overlay={pageEditorOverlay}
    >
      {/* Imports View */}
      {viewMode === 'imports' && (
        <div className="overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>
          <ImportsView />
        </div>
      )}

      {/* Paste Import View */}
      {viewMode === 'paste' && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <PasteImportView
            onImportComplete={(title) => console.log(`[ArchivePanel] Imported: ${title}`)}
            onClose={onClose}
          />
        </div>
      )}

      {/* Workspaces View */}
      {viewMode === 'workspaces' && (
        <div className="overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>
          <WorkspacesView />
        </div>
      )}

      {/* Gutenberg View */}
      {viewMode === 'gutenberg' && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <GutenbergView
            onSelectText={(text, title) => {
              const narrativeId = `gutenberg-${Date.now()}`;
              onSelectNarrative({
                id: narrativeId,
                content: text,
                title: title,
                source: 'gutenberg',
                metadata: {},
              });
              const bufferContent = createFromText(text, 'markdown');
              bufferContent.displayName = title;
              bufferContent.metadata = {
                ...bufferContent.metadata,
                source: { platform: 'import', archiveName: 'Project Gutenberg' },
              };
              setWorkingBuffer(bufferContent);
            }}
            onClose={onClose}
          />
        </div>
      )}

      {/* Explore View */}
      {viewMode === 'explore' && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <ExploreView
            onNavigateToConversation={(conversationId, messageIndex) => {
              const conv = conversations.find(c => c.id === conversationId);
              if (conv) {
                loadConversation(conv.folder);
                if (messageIndex !== undefined) setSelectedMessageIndex(messageIndex);
                setViewMode('messages');
              }
            }}
          />
        </div>
      )}

      {/* Facebook View */}
      {viewMode === 'facebook' && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <FacebookFeedView onSelectItem={loadFacebookItem} />
        </div>
      )}

      {/* Books View */}
      {viewMode === 'books' && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <BooksView
            onSelectContent={(content, metadata) => {
              onSelectNarrative({
                id: `book-${metadata.pageId}`,
                title: `${metadata.bookTitle} - Page`,
                content: content,
                metadata: metadata,
              });
            }}
          />
        </div>
      )}

      {/* This Book View */}
      {viewMode === 'thisbook' && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <ThisBookView
            onSelectPage={(content, metadata) => {
              onSelectNarrative({
                id: `book-${metadata.pageId}`,
                title: `${metadata.bookTitle} - ${metadata.chapterTitle}`,
                content: content,
                metadata: metadata,
              });
            }}
          />
        </div>
      )}

      {/* Conversations list */}
      {viewMode === 'conversations' && (
        <div className="overflow-y-auto" style={{ flex: 1, minHeight: 0, padding: 'var(--space-md)' }}>
          <ConversationsListView
            conversations={conversations}
            filteredConversations={filteredConversations}
            selectedConversation={selectedConversation}
            focusedIndex={focusedIndex}
            loading={loading}
            error={error}
            searchQuery={conversationSearch}
            hasActiveFilters={hasActiveFilters}
            onSelectConversation={(folder) => {
              loadConversation(folder);
              if (window.innerWidth < 768) onClose();
            }}
            onViewGallery={viewConversationGallery}
            onAddToBook={activeBook ? (folder) => {
              loadConversation(folder).then(() => setViewMode('thisbook'));
            } : undefined}
            onRetry={loadConversations}
            itemRefs={itemRefs}
            activeBook={activeBook}
          />
        </div>
      )}

      {/* Book Structure Tree - shows at bottom when active book exists */}
      {activeBook && (
        <div
          style={{
            flexShrink: 0,
            maxHeight: bookTreeCollapsed ? 'auto' : '40%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <BookStructureTree
            collapsed={bookTreeCollapsed}
            onToggleCollapse={() => setBookTreeCollapsed(!bookTreeCollapsed)}
            onSelectPage={async (pageId, bookId) => {
              try {
                const { booksService } = await import('../../services/booksService');
                const page = await booksService.getPage(bookId, pageId);
                onSelectNarrative({
                  id: `book-page-${pageId}`,
                  title: `Page from ${activeBook.title}`,
                  content: page.content,
                  metadata: { source: 'book', bookId, pageId, bookTitle: activeBook.title },
                });
              } catch (err) {
                console.error('Failed to load page:', err);
              }
            }}
            onEditPage={(pageId, bookId) => setEditingPage({ bookId, pageId })}
          />
        </div>
      )}
    </ArchivePanelWrapper>
  );
}
