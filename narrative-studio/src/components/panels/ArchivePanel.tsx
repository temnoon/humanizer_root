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
import { useActiveBook } from '../../contexts/ActiveBookContext';
import { useUnifiedBuffer } from '../../contexts/UnifiedBufferContext';
import { STORAGE_PATHS } from '../../config/storage-paths';

const API_BASE = STORAGE_PATHS.archiveServerUrl;

interface ArchivePanelProps {
  onSelectNarrative: (narrative: any) => void;
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'conversations' | 'messages' | 'gallery' | 'imports' | 'explore' | 'facebook' | 'books' | 'thisbook' | 'workspaces';
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
  const [selectedFacebookItem, setSelectedFacebookItem] = useState<any | null>(null);
  const [relatedFacebookItems, setRelatedFacebookItems] = useState<any[]>([]);
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
  const iconTabScrollRef = useRef<HTMLDivElement>(null);

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

  // Persist book tree collapsed state
  useEffect(() => {
    localStorage.setItem('archive-book-tree-collapsed', String(bookTreeCollapsed));
  }, [bookTreeCollapsed]);

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

  // Tab list for navigation
  const tabList = [
    { id: 'conversations', icon: '📄', title: 'Archive' },
    ...(activeBook ? [{ id: 'thisbook', icon: '📖', title: `This Book - "${activeBook.title}"` }] : []),
    { id: 'workspaces', icon: '📂', title: 'Workspaces' },
    { id: 'gallery', icon: '🖼️', title: 'Gallery' },
    { id: 'imports', icon: '📥', title: 'Imports' },
    { id: 'explore', icon: '🧭', title: 'Explore' },
    { id: 'facebook', icon: '📘', title: 'Facebook' },
    { id: 'books', icon: '📚', title: 'Books' },
  ];

  // Scroll selected tab into view
  const scrollTabIntoView = (index: number) => {
    const container = iconTabScrollRef.current;
    if (!container) return;
    const tabWidth = 38; // 34px button + 4px gap
    const scrollTarget = index * tabWidth - container.clientWidth / 2 + tabWidth / 2;
    container.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
  };

  // Navigate to previous/next tab (like right pane does)
  const navigatePrevTab = () => {
    const currentIndex = tabList.findIndex(t => t.id === viewMode);
    const prevIndex = currentIndex <= 0 ? tabList.length - 1 : currentIndex - 1;
    setViewMode(tabList[prevIndex].id as ViewMode);
    scrollTabIntoView(prevIndex);
  };

  const navigateNextTab = () => {
    const currentIndex = tabList.findIndex(t => t.id === viewMode);
    const nextIndex = currentIndex >= tabList.length - 1 ? 0 : currentIndex + 1;
    setViewMode(tabList[nextIndex].id as ViewMode);
    scrollTabIntoView(nextIndex);
  };

  // Determine which tab should appear selected (handle 'messages' view case)
  const effectiveTabId = viewMode === 'messages'
    ? (selectedFacebookItem ? 'facebook' : 'conversations')
    : viewMode;

  // Shared icon tab bar component - MUST be defined BEFORE early returns
  const IconTabBar = () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 8px',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <button
        onClick={navigatePrevTab}
        style={{ width: '22px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, flexShrink: 0 }}
        title="Previous tab"
      >‹</button>
      <div
        ref={iconTabScrollRef}
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', overflowX: 'auto', scrollbarWidth: 'none', flex: 1 }}
      >
        {tabList.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setViewMode(tab.id as ViewMode);
              if (tab.id === 'conversations' && selectedConversation) {
                const idx = filteredConversations.findIndex(c => c.id === selectedConversation.id);
                setFocusedIndex(idx !== -1 ? idx : 0);
              }
            }}
            title={tab.title}
            style={{
              width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: effectiveTabId === tab.id ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              backgroundImage: effectiveTabId === tab.id ? 'var(--accent-primary-gradient)' : 'none',
              border: effectiveTabId === tab.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)', color: effectiveTabId === tab.id ? 'var(--text-inverse)' : 'var(--text-primary)',
              cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0,
            }}
          >{tab.icon}</button>
        ))}
      </div>
      <button
        onClick={navigateNextTab}
        style={{ width: '22px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, flexShrink: 0 }}
        title="Next tab"
      >›</button>
    </div>
  );

  if (!isOpen) return null;

  // MESSAGES VIEW (for both conversations and Facebook items)
  if (viewMode === 'messages' && (selectedConversation || selectedFacebookItem)) {
    const isConversation = !!selectedConversation;
    const title = isConversation
      ? selectedConversation.title
      : (selectedFacebookItem.title || `Facebook ${selectedFacebookItem.type}`);

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
          className="fixed top-16 left-0 bottom-0 w-80 md:w-full md:h-full z-50 md:relative md:top-0 panel"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderRight: '1px solid var(--border-color)',
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header with title */}
          <div style={{ padding: 'var(--space-md) var(--space-lg)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
            <div className="flex items-center justify-between">
              <h2 className="heading-md" style={{ color: 'var(--text-primary)' }}>Archive</h2>
              <button onClick={onClose} title="Collapse" style={{ padding: '8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '16px' }}>‹</button>
            </div>
          </div>

          {/* Icon Tab Bar */}
          <IconTabBar />

          {/* Messages header */}
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
              <div className="flex-1 font-medium text-small line-clamp-1" style={{ color: 'var(--text-primary)' }}>{title}</div>
            </div>

            {/* Search - compact */}
            <div className="relative mb-3">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }}>
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
                {/* Load All button */}
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

          {/* Messages list */}
          <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-md)', minHeight: 0 }}>
            <div className="space-y-2">
              {filteredMessages.map((msg, idx) => {
                const isFacebookItem = !!selectedFacebookItem;
                const originalIndex = isFacebookItem
                  ? 0
                  : selectedConversation?.messages.findIndex(m => m.id === msg.id) ?? -1;
                const isSelected = isFacebookItem || selectedMessageIndex === originalIndex;
                const isFocused = focusedIndex === idx;

                return (
                  <div
                    key={msg.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(idx, el);
                      else itemRefs.current.delete(idx);
                    }}
                    onClick={() => {
                      if (!isFacebookItem) {
                        loadMessageToCanvas(originalIndex);
                      }
                      // Facebook items are already loaded, no need to reload
                    }}
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
                            : isFacebookItem
                            ? 'rgba(59, 130, 246, 0.2)'
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
                        {isFacebookItem && '📘 '}
                        {msg.role.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-2">
                        {!isFacebookItem && (
                          <span className="text-tiny" style={{ opacity: 0.75 }}>
                            #{originalIndex + 1}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-small line-clamp-3" style={{ opacity: isSelected ? 1 : 0.9 }}>
                      {formatMessageContent(msg.content)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Related items from same day (for media items) */}
            {selectedFacebookItem && relatedFacebookItems.length > 0 && (
              <div style={{
                marginTop: 'var(--space-lg)',
                paddingTop: 'var(--space-md)',
                borderTop: '1px solid var(--border-color)',
              }}>
                <h4 style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-sm)',
                }}>
                  Related Items from Same Day ({relatedFacebookItems.length})
                </h4>
                <div className="space-y-1">
                  {relatedFacebookItems.slice(0, 10).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => loadFacebookItem(item)}
                      className="card cursor-pointer transition-all"
                      style={{
                        padding: 'var(--space-sm)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-xs)',
                        marginBottom: 'var(--space-xs)',
                      }}>
                        <span style={{
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          color: item.type === 'post' ? 'var(--accent-secondary)' : 'var(--accent-primary)',
                        }}>
                          {item.type === 'post' ? '📝 POST' : '💬 COMMENT'}
                        </span>
                        <span className="text-tiny" style={{ opacity: 0.75 }}>
                          {new Date(item.created_at * 1000).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-small line-clamp-2" style={{ opacity: 0.9 }}>
                        {item.text || '[No text content]'}
                      </div>
                    </div>
                  ))}
                  {relatedFacebookItems.length > 10 && (
                    <div className="text-tiny" style={{ color: 'var(--text-tertiary)', textAlign: 'center', paddingTop: 'var(--space-xs)' }}>
                      +{relatedFacebookItems.length - 10} more items
                    </div>
                  )}
                </div>
              </div>
            )}
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
          className="fixed top-16 left-0 bottom-0 w-80 md:w-full md:h-full z-50 md:relative md:top-0 panel"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderRight: '1px solid var(--border-color)',
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header with title */}
          <div style={{ padding: 'var(--space-md) var(--space-lg)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
            <div className="flex items-center justify-between">
              <h2 className="heading-md" style={{ color: 'var(--text-primary)' }}>Archive</h2>
              <button onClick={onClose} title="Collapse" style={{ padding: '8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '16px' }}>‹</button>
            </div>
          </div>

          {/* Icon Tab Bar */}
          <IconTabBar />

          {/* Gallery content */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Gallery-specific header */}
            <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
              {/* Source Toggle - compact */}
              {!galleryFolder && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <button
                    onClick={() => setGallerySource('openai')}
                    style={{
                      padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)',
                      backgroundColor: gallerySource === 'openai' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                      color: gallerySource === 'openai' ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                    }}
                  >OpenAI</button>
                  <button
                    onClick={() => setGallerySource('facebook')}
                    style={{
                      padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)',
                      backgroundColor: gallerySource === 'facebook' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                      color: gallerySource === 'facebook' ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                    }}
                  >📘 Facebook</button>
                </div>
              )}

              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                {galleryTotal.toLocaleString()} images • {galleryImages.length} loaded
              </div>

              {/* Gallery search - compact */}
              <div className="relative">
                <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }}>
                  <Icons.Search />
                </div>
                <input
                  type="text"
                  placeholder="Search..."
                  value={gallerySearch}
                  onChange={(e) => setGallerySearch(e.target.value)}
                  style={{
                    width: '100%', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)', paddingLeft: '2.5rem', paddingRight: gallerySearch ? '2.5rem' : '0.75rem',
                    paddingTop: '0.5rem', paddingBottom: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem',
                  }}
                />
                {gallerySearch && (
                  <button onClick={() => setGallerySearch('')} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Icons.Close />
                  </button>
                )}
              </div>
            </div>

            {/* Gallery grid */}
            <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-md)', minHeight: 0 }}>
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
        className="fixed top-16 left-0 bottom-0 w-80 md:w-full md:h-full z-50 md:relative md:top-0 panel"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderRight: '1px solid var(--border-color)',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="panel-header"
          style={{
            padding: 'var(--space-lg)',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="heading-md" style={{ color: 'var(--text-primary)' }}>
              Archive{' '}
              {currentArchiveName && (
                <span
                  className="text-small"
                  style={{ color: 'var(--text-tertiary)' }}
                  title={currentArchivePath}
                >
                  ({currentArchiveName})
                </span>
              )}
            </h2>
            <button
              onClick={onClose}
              title="Collapse Archive Panel"
              className="p-2 rounded-md hover:opacity-70"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-tertiary)',
                fontSize: '16px',
              }}
            >
              ‹
            </button>
          </div>

          {/* Icon Tab Bar */}
          <IconTabBar />

          {/* Conversations View - Header Content */}
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
        </>
      )}

        </div>

        {/* Imports View - outside header for proper scrolling */}
        {viewMode === 'imports' && (
          <div
            className="overflow-y-auto"
            style={{
              flex: 1,
              minHeight: 0,
            }}
          >
            <ImportsView />
          </div>
        )}

        {/* Workspaces View - transformation history */}
        {viewMode === 'workspaces' && (
          <div
            className="overflow-y-auto"
            style={{
              flex: 1,
              minHeight: 0,
            }}
          >
            <WorkspacesView />
          </div>
        )}

        {/* Explore View - semantic search and clustering */}
        {viewMode === 'explore' && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
            }}
          >
            <ExploreView
              onNavigateToConversation={(conversationId, messageIndex) => {
                // Find conversation by ID and load it
                const conv = conversations.find(c => c.id === conversationId);
                if (conv) {
                  loadConversation(conv.folder);
                  if (messageIndex !== undefined) {
                    setSelectedMessageIndex(messageIndex);
                  }
                  setViewMode('messages');
                }
              }}
            />
          </div>
        )}

        {/* Facebook View - posts and comments feed */}
        {viewMode === 'facebook' && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
            }}
          >
            <FacebookFeedView onSelectItem={loadFacebookItem} />
          </div>
        )}

        {/* Books View - bookmaking tool */}
        {viewMode === 'books' && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
            }}
          >
            <BooksView
              onSelectContent={(content, metadata) => {
                // Convert book page to narrative format for transformation
                const narrative = {
                  id: `book-${metadata.pageId}`,
                  title: `${metadata.bookTitle} - Page`,
                  content: content,
                  metadata: metadata,
                };
                onSelectNarrative(narrative);
              }}
            />
          </div>
        )}

        {/* This Book View - browse active book pages as source */}
        {viewMode === 'thisbook' && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <ThisBookView
              onSelectPage={(content, metadata) => {
                // Convert book page to narrative format for transformation
                const narrative = {
                  id: `book-${metadata.pageId}`,
                  title: `${metadata.bookTitle} - ${metadata.chapterTitle}`,
                  content: content,
                  metadata: metadata,
                };
                onSelectNarrative(narrative);
              }}
            />
          </div>
        )}

        {/* Conversations list - outside header for proper scrolling */}
        {viewMode === 'conversations' && (
          <div
            className="overflow-y-auto"
            style={{
              flex: 1,
              minHeight: 0,
              padding: 'var(--space-md)',
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
                          paddingRight: (hasImages || activeBook) ? '3rem' : 'var(--space-sm)',
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
                      {activeBook && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Load conversation and navigate to "This Book" tab with add dialog
                            loadConversation(conv.folder).then(() => {
                              setViewMode('thisbook');
                            });
                          }}
                          className="absolute right-2 p-2 rounded-md transition-all hover:opacity-70"
                          style={{
                            top: hasImages ? '2.5rem' : '0.5rem',
                            color: isSelected ? 'var(--text-inverse)' : 'var(--accent-primary)',
                            backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.15)' : 'var(--bg-secondary)',
                            fontSize: '0.875rem',
                          }}
                          title={`Quick add to "${activeBook.title}"`}
                          aria-label="Add to book"
                        >
                          📖+
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
                // Load page as narrative for transformation
                try {
                  const { booksService } = await import('../../services/booksService');
                  const page = await booksService.getPage(bookId, pageId);
                  const narrative = {
                    id: `book-page-${pageId}`,
                    title: `Page from ${activeBook.title}`,
                    content: page.content,
                    metadata: {
                      source: 'book',
                      bookId,
                      pageId,
                      bookTitle: activeBook.title,
                    },
                  };
                  onSelectNarrative(narrative);
                } catch (err) {
                  console.error('Failed to load page:', err);
                }
              }}
              onEditPage={(pageId, bookId) => {
                setEditingPage({ bookId, pageId });
              }}
            />
          </div>
        )}

        {/* Page Editor Modal */}
        {editingPage && (
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
        )}
      </aside>
    </>
  );
}
