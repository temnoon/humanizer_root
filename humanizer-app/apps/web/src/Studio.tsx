import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * Convert ChatGPT-style LaTeX delimiters to standard $ delimiters
 * ChatGPT uses \(...\) for inline and \[...\] for display
 * remarkMath expects $...$ for inline and $$...$$ for display
 */
function processLatex(content: string): string {
  return content
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
}

import {
  BufferProvider,
  useBuffers,
  type OperatorDefinition,
} from './lib/buffer';
import {
  fetchConversations,
  fetchConversation,
  getMessages,
  groupConversationsByMonth,
  checkArchiveHealth,
  getCurrentArchive,
  type ArchiveConversation,
  type FlatMessage,
} from './lib/archive';
import {
  humanize,
  transformPersona,
  transformStyle,
  analyzeSentences,
  getPersonas,
  getStyles,
  type HumanizationIntensity,
  type TransformResult,
  type PersonaDefinition,
  type StyleDefinition,
  type SentenceAnalysisResult,
} from './lib/transform';
import { useAuth, TIER_LABELS, type UserRole } from './lib/auth';
import { LoginPage } from './components/auth/LoginPage';
import { ThemeProvider } from './lib/theme/ThemeContext';
import { ThemeToggle } from './components/theme';
import { ArchiveTabs, type SelectedFacebookMedia } from './components/archive';
import { ProfileCardsContainer } from './components/tools/ProfileCards';

// ═══════════════════════════════════════════════════════════════════
// HOVER PANEL
// ═══════════════════════════════════════════════════════════════════

interface HoverPanelProps {
  side: 'left' | 'right';
  isOpen: boolean;
  onToggle: () => void;
  title: string;
  children: ReactNode;
}

function HoverPanel({ side, isOpen, onToggle, title, children }: HoverPanelProps) {
  return (
    <>
      <div
        className={`studio-panel__trigger studio-panel__trigger--${side}`}
        onMouseEnter={() => !isOpen && onToggle()}
      />

      <aside className={`studio-panel studio-panel--${side} ${isOpen ? 'studio-panel--open' : ''}`}>
        <header className="studio-panel__header">
          <h2 className="studio-panel__title">{title}</h2>
          <button className="studio-panel__close" onClick={onToggle}>×</button>
        </header>
        <div className="studio-panel__content">
          {children}
        </div>
      </aside>

      {isOpen && (
        <div className="studio-panel__backdrop" onClick={onToggle} />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ARCHIVE PANEL
// ═══════════════════════════════════════════════════════════════════

interface ArchivePanelProps {
  onClose: () => void;
  onSelectMedia: (media: SelectedFacebookMedia) => void;
}

function ArchivePanel({ onClose, onSelectMedia }: ArchivePanelProps) {
  const { importText, buffers } = useBuffers();

  // Archive state
  const [allConversations, setAllConversations] = useState<ArchiveConversation[]>([]); // Full index for search
  const [conversations, setConversations] = useState<ArchiveConversation[]>([]); // Current page
  const [loading, setLoading] = useState(true);
  const [indexLoading, setIndexLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedConv, setExpandedConv] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<FlatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [archiveInfo, setArchiveInfo] = useState<{ name: string; conversationCount: number } | null>(null);

  // Pagination, sorting, search, and filters
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'messages-desc' | 'length-desc'>('messages-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideEmpty, setHideEmpty] = useState(true);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'images' | 'audio' | 'any'>('all');
  const PAGE_SIZE = 50;

  // Filter ALL conversations by search query (searches full index)
  const filteredConversations = searchQuery.trim()
    ? allConversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations; // When not searching, show paginated results

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    loadArchiveInfo();
    loadSearchIndex();
  }, []);

  const loadArchiveInfo = async () => {
    const info = await getCurrentArchive();
    setArchiveInfo(info);
  };

  // Load ALL conversations for title search (just metadata, no messages)
  const loadSearchIndex = async () => {
    setIndexLoading(true);
    try {
      // Load all conversations (no limit) for search index, with filters
      const result = await fetchConversations({
        sortBy: 'recent',
        minMessages: hideEmpty ? 1 : undefined,
        hasImages: mediaFilter === 'images' ? true : undefined,
        hasAudio: mediaFilter === 'audio' ? true : undefined,
        hasMedia: mediaFilter === 'any' ? true : undefined,
      });
      setAllConversations(result.conversations);
    } catch (err) {
      console.error('Failed to load search index:', err);
    } finally {
      setIndexLoading(false);
    }
  };

  const loadConversations = async (
    newOffset = 0,
    newSortBy = sortBy,
    newHideEmpty = hideEmpty,
    newMediaFilter = mediaFilter
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Check if archive server is available
      const healthy = await checkArchiveHealth();
      if (!healthy) {
        setError('Archive server not available. Start with: npx tsx archive-server.js');
        setLoading(false);
        return;
      }

      const result = await fetchConversations({
        limit: PAGE_SIZE,
        offset: newOffset,
        sortBy: newSortBy,
        minMessages: newHideEmpty ? 1 : undefined,
        hasImages: newMediaFilter === 'images' ? true : undefined,
        hasAudio: newMediaFilter === 'audio' ? true : undefined,
        hasMedia: newMediaFilter === 'any' ? true : undefined,
      });

      setConversations(result.conversations);
      setTotal(result.total);
      setOffset(newOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (newSort: typeof sortBy) => {
    setSortBy(newSort);
    loadConversations(0, newSort, hideEmpty, mediaFilter);
  };

  const handleHideEmptyChange = (hide: boolean) => {
    setHideEmpty(hide);
    loadConversations(0, sortBy, hide, mediaFilter);
    // Reload search index with new filter
    loadSearchIndex();
  };

  const handleMediaFilterChange = (filter: typeof mediaFilter) => {
    setMediaFilter(filter);
    loadConversations(0, sortBy, hideEmpty, filter);
    // Reload search index with new filter
    loadSearchIndex();
  };

  const handleExpandConversation = async (conv: ArchiveConversation) => {
    if (expandedConv === conv.folder) {
      setExpandedConv(null);
      setExpandedMessages([]);
      return;
    }

    setExpandedConv(conv.folder);
    setLoadingMessages(true);

    try {
      const fullConv = await fetchConversation(conv.folder);
      // Limit to first 20 messages for quick loading
      const messages = getMessages(fullConv, 20);
      setExpandedMessages(messages);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setExpandedMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSelectMessage = (conv: ArchiveConversation, msg: FlatMessage, totalMessages: number) => {
    importText(msg.content, `${conv.title} [${msg.role}]`, {
      type: 'chatgpt',
      conversationId: conv.id,
      conversationFolder: conv.folder,
      messageId: msg.id,
      messageIndex: msg.index,
      totalMessages,
      path: [conv.title, `Message ${(msg.index ?? 0) + 1}`],
    });
    onClose();
  };

  const handleImportFullConversation = (conv: ArchiveConversation) => {
    const allContent = expandedMessages
      .map(m => `**[${m.role.toUpperCase()}]**\n\n${m.content}`)
      .join('\n\n---\n\n');
    importText(allContent, conv.title);
    onClose();
  };

  // Group filtered conversations by month
  const groupedConversations = groupConversationsByMonth(filteredConversations);

  // Show buffer list
  const allBuffers = buffers.getAllBuffers();

  // Render the conversation browser content
  const renderConversationsBrowser = () => (
    <div className="archive-browser">
      {/* Archive Info */}
      {archiveInfo && (
        <div className="archive-browser__info">
          <span className="archive-browser__info-name">{archiveInfo.name}</span>
          <span className="archive-browser__info-count">{archiveInfo.conversationCount.toLocaleString()} conversations</span>
        </div>
      )}

      {/* Search */}
      <div className="archive-browser__search">
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="archive-browser__search-input"
        />
        {searchQuery && (
          <button
            className="archive-browser__search-clear"
            onClick={() => setSearchQuery('')}
          >
            ×
          </button>
        )}
      </div>

      {/* Buffer List */}
      {allBuffers.length > 0 && (
        <div className="archive-browser__section">
          <h3 className="archive-browser__section-title">Buffers</h3>
          <div className="archive-browser__list">
            {allBuffers.map(buffer => (
              <button
                key={buffer.id}
                className={`archive-item__header ${buffers.getActiveBufferId() === buffer.id ? 'archive-item__header--expanded' : ''}`}
                onClick={() => buffers.setActiveBuffer(buffer.id)}
              >
                <span className="archive-item__icon">◉</span>
                <span className="archive-item__title">{buffer.name}</span>
                {buffer.pinned && <span className="archive-item__date">📌</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="archive-browser__error">
          <p>{error}</p>
          <button onClick={() => loadConversations()} className="archive-browser__retry">
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="archive-browser__loading">
          Loading conversations...
        </div>
      )}

      {/* Conversations grouped by month */}
      {!loading && !error && (
        <div className="archive-browser__section">
          <div className="archive-browser__header">
            <h3 className="archive-browser__section-title">
              {searchQuery ? 'Results' : 'Archive'}
              <span className="archive-browser__total">
                {searchQuery
                  ? ` (${filteredConversations.length} of ${total.toLocaleString()})`
                  : total > 0 ? ` (${total.toLocaleString()})` : ''
                }
              </span>
            </h3>
            <div className="archive-browser__filters">
              <select
                className="archive-browser__filter"
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value as typeof sortBy)}
                title="Sort by"
              >
                <option value="messages-desc">Most messages</option>
                <option value="length-desc">Longest</option>
                <option value="recent">Recent</option>
                <option value="oldest">Oldest</option>
              </select>
              <select
                className="archive-browser__filter"
                value={mediaFilter}
                onChange={(e) => handleMediaFilterChange(e.target.value as typeof mediaFilter)}
                title="Filter by media"
              >
                <option value="all">All</option>
                <option value="images">Has images</option>
                <option value="audio">Has audio</option>
                <option value="any">Has media</option>
              </select>
              <label className="archive-browser__checkbox" title="Hide empty conversations">
                <input
                  type="checkbox"
                  checked={hideEmpty}
                  onChange={(e) => handleHideEmptyChange(e.target.checked)}
                />
                <span>Hide empty</span>
              </label>
            </div>
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="archive-browser__pagination">
              <button
                disabled={offset === 0}
                onClick={() => loadConversations(Math.max(0, offset - PAGE_SIZE))}
              >
                ← Prev
              </button>
              <span>{offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total}</span>
              <button
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => loadConversations(offset + PAGE_SIZE)}
              >
                Next →
              </button>
            </div>
          )}

          {/* Grouped by month */}
          {Array.from(groupedConversations.entries()).map(([month, convs]) => (
            <div key={month} className="archive-browser__month">
              <div className="archive-browser__month-header">{month}</div>
              <div className="archive-browser__list">
                {convs.map(conv => (
                  <div key={conv.folder} className="archive-item">
                    <button
                      className={`archive-item__header ${expandedConv === conv.folder ? 'archive-item__header--expanded' : ''}`}
                      onClick={() => handleExpandConversation(conv)}
                    >
                      <span className="archive-item__icon">{expandedConv === conv.folder ? '▼' : '▶'}</span>
                      <span className="archive-item__title">{conv.title}</span>
                      <span className="archive-item__meta">
                        {conv.message_count} msgs
                        {conv.has_media && ' 📎'}
                      </span>
                    </button>

                    {expandedConv === conv.folder && (
                      <div className="archive-item__messages">
                        {loadingMessages ? (
                          <div className="archive-item__loading">Loading...</div>
                        ) : (
                          <>
                            {/* Import full conversation button */}
                            {expandedMessages.length > 1 && (
                              <button
                                className="archive-message archive-message--full"
                                onClick={() => handleImportFullConversation(conv)}
                              >
                                <span className="archive-message__preview">
                                  Import full conversation ({expandedMessages.length} messages)
                                </span>
                              </button>
                            )}

                            {/* Individual messages */}
                            {expandedMessages.map(msg => (
                              <button
                                key={msg.id}
                                className={`archive-message archive-message--${msg.role}`}
                                onClick={() => handleSelectMessage(conv, msg, conv.message_count)}
                              >
                                <span className="archive-message__role">{msg.role}</span>
                                <span className="archive-message__preview">
                                  {msg.content.substring(0, 100)}
                                  {msg.content.length > 100 ? '...' : ''}
                                </span>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Return the tabbed archive interface
  return (
    <ArchiveTabs renderConversations={renderConversationsBrowser} onSelectMedia={onSelectMedia} />
  );
}

// ═══════════════════════════════════════════════════════════════════
// TOOL REGISTRY - Configurable tools with visibility settings
// ═══════════════════════════════════════════════════════════════════

interface ToolDefinition {
  id: string;
  icon: string;
  label: string;
  description: string;
  category: 'transform' | 'analyze' | 'edit' | 'advanced' | 'settings';
  defaultVisible: boolean;
}

const TOOL_REGISTRY: ToolDefinition[] = [
  // Transform tools - the main humanizer features
  { id: 'humanizer', icon: '✦', label: 'Humanize', description: 'Computer humanizer - make AI text human', category: 'transform', defaultVisible: true },
  { id: 'persona', icon: '◐', label: 'Persona', description: 'Apply persona transformation', category: 'transform', defaultVisible: true },
  { id: 'style', icon: '❧', label: 'Style', description: 'Style transformation', category: 'transform', defaultVisible: true },

  // Analyze tools
  { id: 'sentencing', icon: '◈', label: 'Sentencing', description: 'Narrative sentencing - quantum density analysis', category: 'analyze', defaultVisible: true },
  { id: 'profile', icon: '◑', label: 'Profile', description: 'Profile factory - create personas', category: 'analyze', defaultVisible: true },

  // Edit tools
  { id: 'editor', icon: '¶', label: 'Editor', description: 'Markdown editor', category: 'edit', defaultVisible: true },
  { id: 'book', icon: '❡', label: 'Book', description: 'Book environment', category: 'edit', defaultVisible: false },

  // Advanced tools (hidden by default)
  { id: 'pipelines', icon: '⚡', label: 'Pipelines', description: 'Preset workflows', category: 'advanced', defaultVisible: false },
  { id: 'split', icon: '✂', label: 'Split', description: 'Split content into parts', category: 'advanced', defaultVisible: false },
  { id: 'filter', icon: '◇', label: 'Filter', description: 'Filter by criteria', category: 'advanced', defaultVisible: false },
  { id: 'order', icon: '≡', label: 'Order', description: 'Arrange content', category: 'advanced', defaultVisible: false },
  { id: 'buffer', icon: '◎', label: 'Buffer', description: 'Buffer operations', category: 'advanced', defaultVisible: false },

  // Settings - always last
  { id: 'settings', icon: '⚙', label: 'Settings', description: 'Tool visibility settings', category: 'settings', defaultVisible: true },
];

// Load/save tool visibility from localStorage
const STORAGE_KEY = 'humanizer-tool-visibility';

function loadToolVisibility(): Record<string, boolean> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load tool visibility:', e);
  }
  // Return defaults
  return TOOL_REGISTRY.reduce((acc, tool) => {
    acc[tool.id] = tool.defaultVisible;
    return acc;
  }, {} as Record<string, boolean>);
}

function saveToolVisibility(visibility: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
  } catch (e) {
    console.error('Failed to save tool visibility:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════
// TOOLS PANEL - Photoshop-style tabbed interface
// ═══════════════════════════════════════════════════════════════════

function ToolsPanel({ onClose }: { onClose: () => void }) {
  const {
    activeContent,
    applyOperator,
    applyPipeline,
    getOperators,
    getPipelines,
    forkBuffer,
    activeBuffer,
    activeNode,
    importText,
  } = useBuffers();

  const operators = getOperators();
  const pipelines = getPipelines();

  // Tool visibility state
  const [toolVisibility, setToolVisibility] = useState<Record<string, boolean>>(loadToolVisibility);
  const [activeTab, setActiveTab] = useState<string>('humanizer');
  const [filterParams, setFilterParams] = useState({ threshold: 70, comparison: '>' as '>' | '<' | '=' });
  const [selectParams, setSelectParams] = useState({ count: 10 });

  // Transform state
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformResult, setTransformResult] = useState<TransformResult | null>(null);
  const [transformError, setTransformError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Humanizer settings
  const [humanizeIntensity, setHumanizeIntensity] = useState<HumanizationIntensity>('moderate');
  const [enableSicAnalysis, setEnableSicAnalysis] = useState(false);

  // Persona settings
  const [selectedPersona, setSelectedPersona] = useState('');
  const [customPersona, setCustomPersona] = useState('');
  const [availablePersonas, setAvailablePersonas] = useState<PersonaDefinition[]>([
    { name: 'Academic', description: 'Scholarly, precise, citation-aware', icon: '📚' },
    { name: 'Conversational', description: 'Friendly, accessible, warm', icon: '💬' },
    { name: 'Technical', description: 'Detailed, systematic, thorough', icon: '⚙️' },
  ]);

  // Style settings
  const [selectedStyle, setSelectedStyle] = useState('');
  const [availableStyles, setAvailableStyles] = useState<StyleDefinition[]>([
    { name: 'Formal', description: 'Professional, polished', icon: '📝' },
    { name: 'Casual', description: 'Relaxed, natural', icon: '✏️' },
    { name: 'Concise', description: 'Tighten, remove fluff', icon: '✂️' },
    { name: 'Elaborate', description: 'Expand, add detail', icon: '📖' },
  ]);

  // Profile visibility (for showing all vs common profiles)
  const [showAllPersonas, setShowAllPersonas] = useState(true);
  const [showAllStyles, setShowAllStyles] = useState(true);

  // Sentencing analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{ current: number; total: number } | null>(null);
  const [sentenceResults, setSentenceResults] = useState<SentenceAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Load available personas and styles on mount
  useEffect(() => {
    getPersonas().then(setAvailablePersonas).catch(() => {});
    getStyles().then(setAvailableStyles).catch(() => {});
  }, []);

  // Reset transform/analysis state when content changes
  useEffect(() => {
    setTransformResult(null);
    setTransformError(null);
    setSentenceResults(null);
    setAnalysisError(null);
    setAnalysisProgress(null);
  }, [activeContent]);

  // Cancel transform on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Get visible tools (settings is always visible)
  const visibleTools = TOOL_REGISTRY.filter(tool =>
    tool.id === 'settings' || toolVisibility[tool.id]
  );

  // Toggle tool visibility
  const toggleToolVisibility = (toolId: string) => {
    const newVisibility = { ...toolVisibility, [toolId]: !toolVisibility[toolId] };
    setToolVisibility(newVisibility);
    saveToolVisibility(newVisibility);
  };

  // Group operators by type
  const operatorsByType = operators.reduce((acc, op) => {
    if (!acc[op.type]) acc[op.type] = [];
    acc[op.type].push(op);
    return acc;
  }, {} as Record<string, OperatorDefinition[]>);

  const handleApplyOperator = async (operatorId: string, params?: Record<string, unknown>) => {
    await applyOperator(operatorId, params);
  };

  const handleApplyPipeline = async (pipelineId: string) => {
    await applyPipeline(pipelineId);
  };

  // Content stats
  const items = activeContent
    ? (Array.isArray(activeContent) ? activeContent : [activeContent])
    : [];
  const totalChars = items.reduce((sum, item) => sum + item.text.length, 0);
  const contentText = items.map(i => i.text).join('\n\n');

  // Transform handlers
  const cancelTransform = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsTransforming(false);
    }
  }, []);

  const handleHumanize = useCallback(async () => {
    if (!contentText.trim()) return;

    setIsTransforming(true);
    setTransformError(null);
    setTransformResult(null);

    abortControllerRef.current = new AbortController();

    try {
      const result = await humanize(
        contentText,
        {
          intensity: humanizeIntensity,
          enableSicAnalysis,
          enableLLMPolish: true,
        },
        abortControllerRef.current.signal
      );

      setTransformResult(result);
      // Import the transformed text to buffer
      importText(result.transformed, `Humanized (${humanizeIntensity})`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // User cancelled, don't show error
      } else {
        setTransformError(error instanceof Error ? error.message : 'Transformation failed');
      }
    } finally {
      setIsTransforming(false);
      abortControllerRef.current = null;
    }
  }, [contentText, humanizeIntensity, enableSicAnalysis, importText]);

  const handlePersonaTransform = useCallback(async () => {
    const persona = customPersona.trim() || selectedPersona;
    if (!contentText.trim() || !persona) return;

    setIsTransforming(true);
    setTransformError(null);
    setTransformResult(null);

    abortControllerRef.current = new AbortController();

    try {
      const result = await transformPersona(
        contentText,
        persona,
        { preserveLength: true, enableValidation: true },
        abortControllerRef.current.signal
      );

      setTransformResult(result);
      importText(result.transformed, `Persona: ${persona}`);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setTransformError(error instanceof Error ? error.message : 'Transformation failed');
      }
    } finally {
      setIsTransforming(false);
      abortControllerRef.current = null;
    }
  }, [contentText, selectedPersona, customPersona, importText]);

  const handleStyleTransform = useCallback(async () => {
    if (!contentText.trim() || !selectedStyle) return;

    setIsTransforming(true);
    setTransformError(null);
    setTransformResult(null);

    abortControllerRef.current = new AbortController();

    try {
      const result = await transformStyle(
        contentText,
        selectedStyle,
        { preserveLength: true, enableValidation: true },
        abortControllerRef.current.signal
      );

      setTransformResult(result);
      importText(result.transformed, `Style: ${selectedStyle}`);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setTransformError(error instanceof Error ? error.message : 'Transformation failed');
      }
    } finally {
      setIsTransforming(false);
      abortControllerRef.current = null;
    }
  }, [contentText, selectedStyle, importText]);

  const handleSentenceAnalysis = useCallback(async () => {
    if (!contentText.trim()) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setSentenceResults(null);
    setAnalysisProgress(null);

    abortControllerRef.current = new AbortController();

    try {
      const result = await analyzeSentences(
        contentText,
        (current, total) => {
          setAnalysisProgress({ current, total });
        },
        abortControllerRef.current.signal
      );

      setSentenceResults(result);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setAnalysisError(error instanceof Error ? error.message : 'Analysis failed');
      }
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(null);
      abortControllerRef.current = null;
    }
  }, [contentText]);

  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsAnalyzing(false);
      setAnalysisProgress(null);
    }
  }, []);

  // Ensure active tab is visible
  useEffect(() => {
    if (!visibleTools.find(t => t.id === activeTab)) {
      const firstVisible = visibleTools.find(t => t.id !== 'settings');
      if (firstVisible) setActiveTab(firstVisible.id);
    }
  }, [toolVisibility, activeTab, visibleTools]);

  return (
    <div className="tool-tabs">
      {/* Tab bar - horizontal scroll */}
      <nav className="tool-tabs__nav">
        {visibleTools.map(tool => (
          <button
            key={tool.id}
            className={`tool-tabs__tab ${activeTab === tool.id ? 'tool-tabs__tab--active' : ''}`}
            onClick={() => setActiveTab(tool.id)}
            title={tool.description}
          >
            <span className="tool-tabs__tab-icon">{tool.icon}</span>
            <span className="tool-tabs__tab-label">{tool.label}</span>
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="tool-tabs__content">
        {/* ═══════════════════════════════════════════════════════════════
            HUMANIZER - Core transformation
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'humanizer' && (
          <div className="tool-panel">
            <div className="tool-panel__header">
              <h3>Humanize</h3>
              <span className="tool-panel__subtitle">Transform AI text to human voice</span>
            </div>
            {!activeContent ? (
              <div className="tool-panel__empty">
                <p>Select content from the Archive to humanize</p>
              </div>
            ) : (
              <div className="tool-panel__body">
                {/* Intensity selector */}
                <div className="tool-panel__section">
                  <label className="tool-panel__label">Intensity</label>
                  <select
                    className="tool-control__select"
                    value={humanizeIntensity}
                    onChange={(e) => setHumanizeIntensity(e.target.value as HumanizationIntensity)}
                    disabled={isTransforming}
                  >
                    <option value="light">Light (50%) - Minimal changes</option>
                    <option value="moderate">Moderate (70%) - Balanced</option>
                    <option value="aggressive">Aggressive (95%) - Maximum</option>
                  </select>
                </div>

                {/* SIC Analysis toggle */}
                <div className="tool-panel__section">
                  <label className="tool-check">
                    <input
                      type="checkbox"
                      checked={enableSicAnalysis}
                      onChange={(e) => setEnableSicAnalysis(e.target.checked)}
                      disabled={isTransforming}
                    />
                    Enable SIC Analysis (Paid feature)
                  </label>
                </div>

                {/* Transform button */}
                <div className="tool-panel__actions">
                  {isTransforming ? (
                    <button
                      className="tool-card tool-card--cancel"
                      onClick={cancelTransform}
                    >
                      <span className="tool-card__name">Cancel</span>
                    </button>
                  ) : (
                    <button
                      className="tool-card tool-card--primary"
                      onClick={handleHumanize}
                      disabled={!contentText.trim()}
                    >
                      <span className="tool-card__name">
                        {isTransforming ? '⏳ Processing...' : '✦ Humanize Text'}
                      </span>
                      <span className="tool-card__desc">Apply SIC-optimized transformation</span>
                    </button>
                  )}
                </div>

                {/* Error display */}
                {transformError && (
                  <div className="tool-panel__error">
                    {transformError}
                  </div>
                )}

                {/* Result summary */}
                {transformResult && !transformError && (
                  <div className="tool-panel__result">
                    <span className="tool-panel__result-success">✓ Transformed</span>
                    {transformResult.metadata?.modelUsed && (
                      <span className="tool-panel__result-meta">
                        via {transformResult.metadata.modelUsed.split('/').pop()}
                      </span>
                    )}
                    {transformResult.metadata?.processingTimeMs && (
                      <span className="tool-panel__result-meta">
                        {(transformResult.metadata.processingTimeMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                )}

                {/* Content info */}
                <div className="tool-panel__info">
                  <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  <span>{totalChars.toLocaleString()} chars</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            PERSONA - Apply persona transformation
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'persona' && (
          <div className="tool-panel">
            <div className="tool-panel__header">
              <h3>Persona</h3>
              <span className="tool-panel__subtitle">Transform voice and perspective</span>
            </div>
            {!activeContent ? (
              <div className="tool-panel__empty">
                <p>Select content from the Archive to transform</p>
              </div>
            ) : (
              <div className="tool-panel__body">
                {/* Persona selector - Horizontal scroll cards */}
                <div className="tool-panel__section">
                  <label className="tool-panel__label">Select Persona</label>
                  <ProfileCardsContainer
                    profiles={availablePersonas}
                    selectedName={selectedPersona}
                    onSelect={(p) => {
                      setSelectedPersona(p.name);
                      setCustomPersona('');
                    }}
                    disabled={isTransforming}
                    showAllProfiles={showAllPersonas}
                    onToggleShowAll={() => setShowAllPersonas(!showAllPersonas)}
                    type="persona"
                  />
                </div>

                {/* Custom persona input */}
                <div className="tool-panel__section">
                  <label className="tool-panel__label">Or Custom Persona</label>
                  <input
                    type="text"
                    className="tool-control__input tool-control__input--full"
                    placeholder="e.g., Victorian scholar, enthusiastic chef..."
                    value={customPersona}
                    onChange={(e) => {
                      setCustomPersona(e.target.value);
                      if (e.target.value) setSelectedPersona('');
                    }}
                    disabled={isTransforming}
                  />
                </div>

                {/* Transform button */}
                <div className="tool-panel__actions">
                  {isTransforming ? (
                    <button
                      className="tool-card tool-card--cancel"
                      onClick={cancelTransform}
                    >
                      <span className="tool-card__name">Cancel</span>
                    </button>
                  ) : (
                    <button
                      className="tool-card tool-card--primary"
                      onClick={handlePersonaTransform}
                      disabled={!contentText.trim() || (!selectedPersona && !customPersona.trim())}
                    >
                      <span className="tool-card__name">
                        {availablePersonas.find(p => p.name === selectedPersona)?.icon || '◐'} Apply {customPersona.trim() || selectedPersona || 'Persona'}
                      </span>
                      <span className="tool-card__desc">Transform to selected voice</span>
                    </button>
                  )}
                </div>

                {/* Error display */}
                {transformError && activeTab === 'persona' && (
                  <div className="tool-panel__error">{transformError}</div>
                )}

                {/* Result summary */}
                {transformResult && !transformError && (
                  <div className="tool-panel__result">
                    <span className="tool-panel__result-success">✓ Transformed</span>
                  </div>
                )}

                {/* Content info */}
                <div className="tool-panel__info">
                  <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  <span>{totalChars.toLocaleString()} chars</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            STYLE - Style transformation
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'style' && (
          <div className="tool-panel">
            <div className="tool-panel__header">
              <h3>Style</h3>
              <span className="tool-panel__subtitle">Adjust tone and register</span>
            </div>
            {!activeContent ? (
              <div className="tool-panel__empty">
                <p>Select content from the Archive to transform</p>
              </div>
            ) : (
              <div className="tool-panel__body">
                {/* Style selector - Horizontal scroll cards */}
                <div className="tool-panel__section">
                  <label className="tool-panel__label">Select Style</label>
                  <ProfileCardsContainer
                    profiles={availableStyles}
                    selectedName={selectedStyle}
                    onSelect={(s) => setSelectedStyle(s.name)}
                    disabled={isTransforming}
                    showAllProfiles={showAllStyles}
                    onToggleShowAll={() => setShowAllStyles(!showAllStyles)}
                    type="style"
                  />
                </div>

                {/* Transform button */}
                <div className="tool-panel__actions">
                  {isTransforming ? (
                    <button
                      className="tool-card tool-card--cancel"
                      onClick={cancelTransform}
                    >
                      <span className="tool-card__name">Cancel</span>
                    </button>
                  ) : (
                    <button
                      className="tool-card tool-card--primary"
                      onClick={handleStyleTransform}
                      disabled={!contentText.trim() || !selectedStyle}
                    >
                      <span className="tool-card__name">
                        {availableStyles.find(s => s.name === selectedStyle)?.icon || '❧'} Apply {selectedStyle || 'Style'}
                      </span>
                      <span className="tool-card__desc">Transform writing style</span>
                    </button>
                  )}
                </div>

                {/* Error display */}
                {transformError && activeTab === 'style' && (
                  <div className="tool-panel__error">{transformError}</div>
                )}

                {/* Result summary */}
                {transformResult && !transformError && (
                  <div className="tool-panel__result">
                    <span className="tool-panel__result-success">✓ Transformed</span>
                  </div>
                )}

                {/* Content info */}
                <div className="tool-panel__info">
                  <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  <span>{totalChars.toLocaleString()} chars</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SENTENCING - Narrative Sentencing / Quantum Reading
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'sentencing' && (
          <div className="tool-panel">
            <div className="tool-panel__header">
              <h3>Narrative Sentencing</h3>
              <span className="tool-panel__subtitle">Tetralemma density analysis per sentence</span>
            </div>
            {!activeContent ? (
              <div className="tool-panel__empty">
                <p>Select content to analyze</p>
              </div>
            ) : (
              <div className="tool-panel__body">
                {/* Action buttons */}
                <div className="tool-panel__actions">
                  {isAnalyzing ? (
                    <>
                      <div className="tool-panel__progress">
                        <div className="tool-panel__progress-bar">
                          <div
                            className="tool-panel__progress-fill"
                            style={{
                              width: analysisProgress
                                ? `${(analysisProgress.current / analysisProgress.total) * 100}%`
                                : '0%'
                            }}
                          />
                        </div>
                        <span className="tool-panel__progress-text">
                          {analysisProgress
                            ? `Analyzing sentence ${analysisProgress.current}/${analysisProgress.total}`
                            : 'Starting...'}
                        </span>
                      </div>
                      <button
                        className="tool-card tool-card--cancel"
                        onClick={cancelAnalysis}
                      >
                        <span className="tool-card__name">Cancel</span>
                      </button>
                    </>
                  ) : (
                    <button
                      className="tool-card tool-card--primary"
                      onClick={handleSentenceAnalysis}
                      disabled={!contentText.trim()}
                    >
                      <span className="tool-card__name">◈ Analyze Sentences</span>
                      <span className="tool-card__desc">Tetralemma measurement + entropy tracking</span>
                    </button>
                  )}
                </div>

                {/* Error display */}
                {analysisError && (
                  <div className="tool-panel__error">{analysisError}</div>
                )}

                {/* Results summary */}
                {sentenceResults && !analysisError && (
                  <div className="sentencing-results">
                    {/* Overall stats */}
                    <div className="sentencing-results__summary">
                      <div className="sentencing-stat">
                        <span className="sentencing-stat__value">{sentenceResults.overall.totalSentences}</span>
                        <span className="sentencing-stat__label">Sentences</span>
                      </div>
                      <div className="sentencing-stat">
                        <span className="sentencing-stat__value">{sentenceResults.overall.avgEntropy.toFixed(2)}</span>
                        <span className="sentencing-stat__label">Avg Entropy</span>
                      </div>
                      <div className="sentencing-stat">
                        <span className="sentencing-stat__value sentencing-stat__value--stance">
                          {sentenceResults.overall.dominantStance}
                        </span>
                        <span className="sentencing-stat__label">Dominant</span>
                      </div>
                    </div>

                    {/* Per-sentence results */}
                    <div className="sentencing-results__sentences">
                      {sentenceResults.sentences.map((s) => (
                        <div key={s.index} className="sentencing-sentence">
                          <div className="sentencing-sentence__header">
                            <span className="sentencing-sentence__index">#{s.index + 1}</span>
                            <span className={`sentencing-sentence__stance sentencing-sentence__stance--${s.dominant}`}>
                              {s.dominant}
                            </span>
                          </div>
                          <div className="sentencing-sentence__text">{s.text}</div>
                          <div className="sentencing-sentence__probs">
                            <div className="sentencing-prob" style={{ width: `${s.tetralemma.literal * 100}%` }}>
                              <span title={`Literal: ${(s.tetralemma.literal * 100).toFixed(1)}%`}>L</span>
                            </div>
                            <div className="sentencing-prob sentencing-prob--meta" style={{ width: `${s.tetralemma.metaphorical * 100}%` }}>
                              <span title={`Metaphorical: ${(s.tetralemma.metaphorical * 100).toFixed(1)}%`}>M</span>
                            </div>
                            <div className="sentencing-prob sentencing-prob--both" style={{ width: `${s.tetralemma.both * 100}%` }}>
                              <span title={`Both: ${(s.tetralemma.both * 100).toFixed(1)}%`}>B</span>
                            </div>
                            <div className="sentencing-prob sentencing-prob--neither" style={{ width: `${s.tetralemma.neither * 100}%` }}>
                              <span title={`Neither: ${(s.tetralemma.neither * 100).toFixed(1)}%`}>N</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content info */}
                <div className="tool-panel__info">
                  <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  <span>{totalChars.toLocaleString()} chars</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            PROFILE - Profile Factory
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'profile' && (
          <div className="tool-panel">
            <div className="tool-panel__header">
              <h3>Profile Factory</h3>
              <span className="tool-panel__subtitle">Create and manage personas</span>
            </div>
            <div className="tool-panel__body">
              <button className="tool-card tool-card--primary">
                <span className="tool-card__name">New Profile</span>
                <span className="tool-card__desc">Create from selected text</span>
              </button>
              <div className="tool-panel__divider" />
              <div className="tool-panel__section">
                <label className="tool-panel__label">Saved Profiles</label>
                <p className="tool-panel__muted">No profiles yet</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            EDITOR - Markdown Editor
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'editor' && (
          <div className="tool-panel">
            <div className="tool-panel__header">
              <h3>Editor</h3>
              <span className="tool-panel__subtitle">Direct markdown editing</span>
            </div>
            {!activeContent ? (
              <div className="tool-panel__empty">
                <p>Select content to edit</p>
              </div>
            ) : (
              <div className="tool-panel__body">
                <textarea
                  className="tool-editor"
                  defaultValue={items.map(i => i.text).join('\n\n---\n\n')}
                  placeholder="Edit content here..."
                />
                <button className="tool-card tool-card--primary">
                  <span className="tool-card__name">Save Changes</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            BOOK - Book Environment (stub)
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'book' && (
          <div className="tool-panel">
            <div className="tool-panel__header">
              <h3>Book</h3>
              <span className="tool-panel__subtitle">Book composition environment</span>
            </div>
            <div className="tool-panel__empty">
              <p>Book environment coming soon</p>
              <span className="tool-panel__muted">Chapter organization, export, formatting</span>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            PIPELINES - Advanced workflows
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'pipelines' && (
          <div className="tool-panel">
            <div className="tool-panel__header">
              <h3>Pipelines</h3>
              <span className="tool-panel__subtitle">Preset workflows</span>
            </div>
            <div className="tool-panel__body">
              {pipelines.map(p => (
                <button
                  key={p.id}
                  className="tool-card"
                  onClick={() => handleApplyPipeline(p.id)}
                >
                  <span className="tool-card__name">{p.name}</span>
                  <span className="tool-card__desc">{p.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SPLIT - Advanced operator
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'split' && (
          <div className="tool-panel">
            <div className="tool-panel__header">
              <h3>Split</h3>
              <span className="tool-panel__subtitle">Break content apart</span>
            </div>
            <div className="tool-panel__body">
              {operatorsByType['split']?.map(op => (
                <button
                  key={op.id}
                  className="tool-card"
                  onClick={() => handleApplyOperator(op.id)}
                >
                  <span className="tool-card__name">{op.name}</span>
                  <span className="tool-card__desc">{op.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            FILTER - Advanced operator
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'filter' && (
          <div className="tool-panel">
            <div className="tool-panel__header">
              <h3>Filter</h3>
              <span className="tool-panel__subtitle">Select by criteria</span>
            </div>
            <div className="tool-panel__section">
              <label className="tool-panel__label">SIC Score Filter</label>
              <div className="tool-control">
                <select
                  className="tool-control__select"
                  value={filterParams.comparison}
                  onChange={(e) => setFilterParams(p => ({ ...p, comparison: e.target.value as '>' | '<' | '=' }))}
                >
                  <option value=">">&gt; greater than</option>
                  <option value="<">&lt; less than</option>
                  <option value="=">=  equal to</option>
                </select>
                <input
                  type="number"
                  className="tool-control__input"
                  value={filterParams.threshold}
                  onChange={(e) => setFilterParams(p => ({ ...p, threshold: Number(e.target.value) }))}
                  min={0}
                  max={100}
                />
                <button
                  className="tool-control__apply"
                  onClick={() => handleApplyOperator('filter:sic', filterParams)}
                >
                  Apply
                </button>
              </div>
            </div>
            <div className="tool-panel__divider" />
            <div className="tool-panel__body">
              {operatorsByType['filter']?.filter(op => op.id !== 'filter:sic').map(op => (
                <button
                  key={op.id}
                  className="tool-card tool-card--compact"
                  onClick={() => handleApplyOperator(op.id)}
                >
                  <span className="tool-card__name">{op.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            ORDER - Advanced operator
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'order' && (
          <div className="tool-panel">
            <div className="tool-panel__header">
              <h3>Order</h3>
              <span className="tool-panel__subtitle">Arrange content</span>
            </div>
            <div className="tool-panel__body">
              {operatorsByType['order']?.map(op => (
                <button
                  key={op.id}
                  className="tool-card"
                  onClick={() => handleApplyOperator(op.id)}
                >
                  <span className="tool-card__name">{op.name}</span>
                  <span className="tool-card__desc">{op.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            BUFFER - Document operations
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'buffer' && (
          <div className="tool-panel">
            <div className="tool-panel__header">
              <h3>Buffer</h3>
              <span className="tool-panel__subtitle">Current document</span>
            </div>
            <div className="tool-panel__stats">
              <div className="tool-stat">
                <span className="tool-stat__value">{items.length}</span>
                <span className="tool-stat__label">items</span>
              </div>
              <div className="tool-stat">
                <span className="tool-stat__value">{totalChars.toLocaleString()}</span>
                <span className="tool-stat__label">chars</span>
              </div>
              {activeNode?.metadata.avgSicScore !== undefined && (
                <div className="tool-stat">
                  <span className="tool-stat__value">{activeNode.metadata.avgSicScore.toFixed(0)}</span>
                  <span className="tool-stat__label">avg SIC</span>
                </div>
              )}
            </div>
            <div className="tool-panel__divider" />
            <div className="tool-panel__body">
              <button
                className="tool-card"
                onClick={() => activeBuffer && forkBuffer(activeBuffer.id)}
              >
                <span className="tool-card__name">Fork Buffer</span>
                <span className="tool-card__desc">Create a copy to experiment with</span>
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SETTINGS - Tool visibility
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="tool-panel">
            <div className="tool-panel__header">
              <h3>Settings</h3>
              <span className="tool-panel__subtitle">Show or hide tools</span>
            </div>
            <div className="tool-panel__body">
              {(['transform', 'analyze', 'edit', 'advanced'] as const).map(category => (
                <div key={category} className="tool-panel__section">
                  <label className="tool-panel__label">{category}</label>
                  {TOOL_REGISTRY.filter(t => t.category === category).map(tool => (
                    <label key={tool.id} className="tool-toggle">
                      <input
                        type="checkbox"
                        checked={toolVisibility[tool.id] ?? tool.defaultVisible}
                        onChange={() => toggleToolVisibility(tool.id)}
                      />
                      <span className="tool-toggle__icon">{tool.icon}</span>
                      <span className="tool-toggle__label">{tool.label}</span>
                      <span className="tool-toggle__desc">{tool.description}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// WORKSPACE
// ═══════════════════════════════════════════════════════════════════

interface WorkspaceProps {
  selectedMedia?: SelectedFacebookMedia | null;
  onClearMedia?: () => void;
  onUpdateMedia?: (media: SelectedFacebookMedia) => void;
}

const ARCHIVE_SERVER = 'http://localhost:3002';

function Workspace({ selectedMedia, onClearMedia, onUpdateMedia }: WorkspaceProps) {
  const { activeContent, activeNode, activeBuffer, getNodeHistory, importText } = useBuffers();
  const [navLoading, setNavLoading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Get source info for navigation
  const source = activeNode?.metadata?.source;
  const hasConversationNav = source?.type === 'chatgpt' &&
    source.conversationFolder &&
    source.messageIndex !== undefined &&
    source.totalMessages !== undefined;

  const currentIndex = source?.messageIndex ?? 0;
  const totalMessages = source?.totalMessages ?? 0;
  const canGoPrev = hasConversationNav && currentIndex > 0;
  const canGoNext = hasConversationNav && currentIndex < totalMessages - 1;

  // Navigate to a different message in the same conversation
  const navigateToMessage = async (targetIndex: number) => {
    if (!source?.conversationFolder || navLoading) return;

    setNavLoading(true);
    try {
      const conv = await fetchConversation(source.conversationFolder);
      const messages = getMessages(conv, conv.messages.length); // Get all messages
      const targetMsg = messages[targetIndex];

      if (targetMsg) {
        importText(targetMsg.content, `${conv.title} [${targetMsg.role}]`, {
          type: 'chatgpt',
          conversationId: conv.id,
          conversationFolder: source.conversationFolder,
          messageId: targetMsg.id,
          messageIndex: targetIndex,
          totalMessages: messages.length,
          path: [conv.title, `Message ${targetIndex + 1}`],
        });
      }
    } catch (err) {
      console.error('Failed to navigate:', err);
    } finally {
      setNavLoading(false);
    }
  };

  // Media viewer helper
  const getMediaUrl = (filePath: string) => {
    const encoded = btoa(filePath);
    return `${ARCHIVE_SERVER}/api/facebook/image?path=${encoded}`;
  };

  const formatMediaDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatMediaSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Get current index in related media
  const getCurrentRelatedIndex = () => {
    if (!selectedMedia?.relatedMedia) return -1;
    return selectedMedia.relatedMedia.findIndex(m => m.id === selectedMedia.id);
  };

  // Handle clicking a related thumbnail - update main image
  const handleRelatedClick = (item: { id: string; file_path: string; media_type: 'image' | 'video' }) => {
    if (onUpdateMedia && selectedMedia) {
      onUpdateMedia({
        ...selectedMedia,
        id: item.id,
        file_path: item.file_path,
        media_type: item.media_type,
        filename: item.file_path.split('/').pop() || 'image',
      });
    }
  };

  // Open lightbox at current position
  const openLightbox = () => {
    const idx = getCurrentRelatedIndex();
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  // Navigate lightbox using functional update to avoid stale closure
  const navigateLightbox = (delta: number) => {
    if (!selectedMedia?.relatedMedia) return;
    setLightboxIndex(current => {
      const newIndex = current + delta;
      if (newIndex >= 0 && newIndex < (selectedMedia.relatedMedia?.length || 0)) {
        return newIndex;
      }
      return current;
    });
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen || !selectedMedia?.relatedMedia) return;

    const maxIndex = selectedMedia.relatedMedia.length - 1;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex(current => Math.max(0, current - 1));
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex(current => Math.min(maxIndex, current + 1));
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxOpen, selectedMedia?.relatedMedia?.length]);

  // Render media viewer if selectedMedia is set
  if (selectedMedia) {
    return (
      <div className="workspace workspace--media">
        <div className="media-viewer media-viewer--fullscreen">
          {/* Top bar with back button, info, and linked content */}
          <header className="media-viewer__header media-viewer__header--expanded">
            <div className="media-viewer__header-row">
              <button
                className="media-viewer__close"
                onClick={onClearMedia}
                title="Close media viewer"
              >
                ← Back
              </button>
              <div className="media-viewer__info">
                <span className="media-viewer__filename">{selectedMedia.filename}</span>
                <span className="media-viewer__meta">
                  {formatMediaDate(selectedMedia.created_at)}
                  {selectedMedia.width && selectedMedia.height && (
                    <> · {selectedMedia.width}×{selectedMedia.height}</>
                  )}
                  {selectedMedia.context?.album && (
                    <> · {selectedMedia.context.album}</>
                  )}
                </span>
              </div>
            </div>
            {/* Linked posts/comments */}
            {selectedMedia.linkedContent && selectedMedia.linkedContent.length > 0 && (
              <div className="media-viewer__linked">
                <span className="media-viewer__linked-label">Linked:</span>
                <div className="media-viewer__linked-items">
                  {selectedMedia.linkedContent.map((item, idx) => (
                    <span key={item.id} className="media-viewer__linked-item">
                      {idx > 0 && <span className="media-viewer__linked-sep">·</span>}
                      <span className={`media-viewer__linked-type media-viewer__linked-type--${item.type}`}>
                        {item.type === 'post' ? '📄' : '💬'}
                      </span>
                      <span className="media-viewer__linked-text">
                        {item.title || (item.text ? item.text.slice(0, 60) + (item.text.length > 60 ? '...' : '') : `${item.type} from ${formatMediaDate(item.created_at)}`)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </header>

          {/* Main image area - fills most of viewport */}
          <div className="media-viewer__stage">
            {selectedMedia.media_type === 'image' ? (
              <img
                src={getMediaUrl(selectedMedia.file_path)}
                alt={selectedMedia.filename}
                className="media-viewer__image media-viewer__image--clickable"
                onClick={openLightbox}
                title="Click to open lightbox"
              />
            ) : (
              <video
                src={getMediaUrl(selectedMedia.file_path)}
                controls
                className="media-viewer__video"
              />
            )}
            {/* Navigation arrows for main viewer */}
            {selectedMedia.relatedMedia && selectedMedia.relatedMedia.length > 1 && (() => {
              const currentIdx = selectedMedia.relatedMedia.findIndex(m => m.id === selectedMedia.id);
              const hasPrev = currentIdx > 0;
              const hasNext = currentIdx < selectedMedia.relatedMedia.length - 1;

              return (
                <>
                  {hasPrev && (
                    <button
                      className="media-viewer__nav media-viewer__nav--prev"
                      onClick={() => handleRelatedClick(selectedMedia.relatedMedia![currentIdx - 1])}
                      title="Previous image"
                    >
                      ‹
                    </button>
                  )}
                  {hasNext && (
                    <button
                      className="media-viewer__nav media-viewer__nav--next"
                      onClick={() => handleRelatedClick(selectedMedia.relatedMedia![currentIdx + 1])}
                      title="Next image"
                    >
                      ›
                    </button>
                  )}
                </>
              );
            })()}
          </div>

          {/* Related thumbnails strip at bottom */}
          {selectedMedia.relatedMedia && selectedMedia.relatedMedia.length > 1 && (
            <div className="media-viewer__strip">
              <span className="media-viewer__strip-label">
                Related ({selectedMedia.relatedMedia.length})
              </span>
              <div className="media-viewer__strip-scroll">
                {selectedMedia.relatedMedia.map(item => (
                  <button
                    key={item.id}
                    className={`media-viewer__strip-thumb ${item.id === selectedMedia.id ? 'media-viewer__strip-thumb--active' : ''}`}
                    onClick={() => handleRelatedClick(item)}
                    title="Click to view"
                  >
                    <img
                      src={getMediaUrl(item.file_path)}
                      alt=""
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Lightbox Modal */}
        {lightboxOpen && selectedMedia.relatedMedia && selectedMedia.relatedMedia[lightboxIndex] && (() => {
          const currentItem = selectedMedia.relatedMedia[lightboxIndex];
          const currentUrl = getMediaUrl(currentItem.file_path);
          const filename = currentItem.file_path.split('/').pop() || 'image';

          const handleDownload = async (e: React.MouseEvent) => {
            e.stopPropagation();
            try {
              const response = await fetch(currentUrl);
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } catch (err) {
              console.error('Download failed:', err);
            }
          };

          const handleFullRes = (e: React.MouseEvent) => {
            e.stopPropagation();
            window.open(currentUrl, '_blank');
          };

          return (
            <div
              className="media-lightbox"
              onClick={() => setLightboxOpen(false)}
            >
              <button
                className="media-lightbox__close"
                onClick={() => setLightboxOpen(false)}
                title="Close (Esc)"
              >
                ✕
              </button>

              {/* Navigation arrows */}
              {lightboxIndex > 0 && (
                <button
                  className="media-lightbox__nav media-lightbox__nav--prev"
                  onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}
                  title="Previous (←)"
                >
                  ‹
                </button>
              )}
              {lightboxIndex < selectedMedia.relatedMedia.length - 1 && (
                <button
                  className="media-lightbox__nav media-lightbox__nav--next"
                  onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}
                  title="Next (→)"
                >
                  ›
                </button>
              )}

              {/* Image */}
              <img
                className="media-lightbox__image"
                src={currentUrl}
                alt=""
                onClick={(e) => e.stopPropagation()}
              />

              {/* Bottom toolbar */}
              <div className="media-lightbox__toolbar">
                <span className="media-lightbox__counter">
                  {lightboxIndex + 1} / {selectedMedia.relatedMedia.length}
                </span>
                <span className="media-lightbox__filename">{filename}</span>
                <div className="media-lightbox__actions">
                  <button
                    className="media-lightbox__action"
                    onClick={handleFullRes}
                    title="View full resolution"
                  >
                    Full Size
                  </button>
                  <button
                    className="media-lightbox__action"
                    onClick={handleDownload}
                    title="Download image"
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  if (!activeContent || !activeNode) {
    return (
      <div className="workspace workspace--empty">
        <div className="workspace__placeholder">
          <h1>humanizer</h1>
          <p className="workspace__tagline">
            *Infrastructure for reclaiming subjective agency*
          </p>
          <div className="workspace__divider">* * *</div>
          <p>
            Select content from the Archive (hover left edge)<br />
            or use Tools to analyze (hover right edge)
          </p>
        </div>
      </div>
    );
  }

  const items = Array.isArray(activeContent) ? activeContent : [activeContent];
  const isArray = Array.isArray(activeContent);

  // Get operation history
  const history = getNodeHistory();

  return (
    <div className="workspace">
      {/* Breadcrumb / Path */}
      {activeNode.metadata.source && (
        <nav className="workspace__breadcrumb">
          {activeNode.metadata.source.path.map((p, i) => (
            <span key={i}>
              {i > 0 && <span className="workspace__breadcrumb-sep">›</span>}
              {p}
            </span>
          ))}
        </nav>
      )}

      {/* Conversation Navigation */}
      {hasConversationNav && (
        <div className="workspace__nav">
          <button
            className="workspace__nav-btn"
            onClick={() => navigateToMessage(0)}
            disabled={!canGoPrev || navLoading}
            title="First message (top)"
          >
            ⇤
          </button>
          <button
            className="workspace__nav-btn"
            onClick={() => navigateToMessage(currentIndex - 1)}
            disabled={!canGoPrev || navLoading}
            title="Previous message"
          >
            ←
          </button>
          <span className="workspace__nav-position">
            {currentIndex + 1} / {totalMessages}
          </span>
          <button
            className="workspace__nav-btn"
            onClick={() => navigateToMessage(currentIndex + 1)}
            disabled={!canGoNext || navLoading}
            title="Next message"
          >
            →
          </button>
          <button
            className="workspace__nav-btn"
            onClick={() => navigateToMessage(totalMessages - 1)}
            disabled={!canGoNext || navLoading}
            title="Last message (bottom)"
          >
            ⇥
          </button>
        </div>
      )}

      {/* Stats bar */}
      {isArray && (
        <div className="workspace__stats">
          <span className="workspace__stat">{items.length} items</span>
          {activeNode.metadata.avgSicScore !== undefined && (
            <span className="workspace__stat">
              SIC: {activeNode.metadata.avgSicScore.toFixed(0)} avg
            </span>
          )}
          {history.length > 1 && (
            <span className="workspace__stat">
              {history.length - 1} operations
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <article className="workspace__article">
        {activeNode.metadata.title && (
          <>
            <h1>{activeNode.metadata.title}</h1>
            <div className="workspace__divider">* * *</div>
          </>
        )}

        {items.map((item, i) => (
          <div key={item.id} className={isArray ? 'workspace__item' : ''}>
            {isArray && items.length > 1 && (
              <div className="workspace__item-index">{i + 1}</div>
            )}
            <ReactMarkdown
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[[rehypeKatex, { strict: false, trust: true }]]}
            >
              {processLatex(item.text)}
            </ReactMarkdown>
            {item.metadata?.sicScore !== undefined && (
              <div className="workspace__item-sic">
                SIC: {item.metadata.sicScore.toFixed(0)}
              </div>
            )}
          </div>
        ))}
      </article>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TOP BAR
// ═══════════════════════════════════════════════════════════════════

interface TopBarProps {
  onSelectMedia: (media: SelectedFacebookMedia) => void;
}

function TopBar({ onSelectMedia }: TopBarProps) {
  const { canUndo, canRedo, undo, redo, activeBuffer, buffers } = useBuffers();
  const { user, isAuthenticated, logout } = useAuth();
  const [visible, setVisible] = useState(true);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handleMove = () => {
      setVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setVisible(false), 3000);
    };
    window.addEventListener('mousemove', handleMove);
    handleMove();
    return () => {
      window.removeEventListener('mousemove', handleMove);
      clearTimeout(timeout);
    };
  }, []);

  // Buffer selector
  const allBuffers = buffers.getAllBuffers();

  return (
    <>
      <header className={`studio-topbar ${visible ? '' : 'studio-topbar--hidden'}`}>
        <div className="studio-topbar__left">
          <button
            className="studio-topbar__btn"
            onClick={() => setLeftOpen(!leftOpen)}
          >
            ☰ Archive
          </button>
        </div>

        <div className="studio-topbar__center">
          <button
            className="studio-topbar__nav"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (backtrack)"
          >
            ↩
          </button>

          {allBuffers.length > 1 ? (
            <select
              className="studio-topbar__select"
              value={activeBuffer?.id ?? ''}
              onChange={(e) => buffers.setActiveBuffer(e.target.value)}
            >
              {allBuffers.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          ) : (
            <span className="studio-topbar__logo">
              {activeBuffer?.name ?? 'humanizer'}
            </span>
          )}

          <button
            className="studio-topbar__nav"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (forward)"
          >
            ↪
          </button>
        </div>

        <div className="studio-topbar__right">
          <ThemeToggle />

          <button
            className="studio-topbar__btn"
            onClick={() => setRightOpen(!rightOpen)}
          >
            Tools ⚙
          </button>

          {/* Auth button */}
          {isAuthenticated ? (
            <div className="studio-topbar__user">
              <span className="studio-topbar__tier">
                {TIER_LABELS[user?.role as UserRole] || 'Free'}
              </span>
              <button
                className="studio-topbar__btn studio-topbar__btn--user"
                onClick={logout}
                title={`Signed in as ${user?.email}`}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              className="studio-topbar__btn studio-topbar__btn--signin"
              onClick={() => setShowLogin(true)}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Login modal */}
      {showLogin && (
        <LoginPage
          onSuccess={() => setShowLogin(false)}
          onClose={() => setShowLogin(false)}
        />
      )}

      <HoverPanel
        side="left"
        isOpen={leftOpen}
        onToggle={() => setLeftOpen(!leftOpen)}
        title="Archive"
      >
        <ArchivePanel onClose={() => setLeftOpen(false)} onSelectMedia={onSelectMedia} />
      </HoverPanel>

      <HoverPanel
        side="right"
        isOpen={rightOpen}
        onToggle={() => setRightOpen(!rightOpen)}
        title="Tools"
      >
        <ToolsPanel onClose={() => setRightOpen(false)} />
      </HoverPanel>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AUI CHAT - AI Assistant Interface
// ═══════════════════════════════════════════════════════════════════

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AUI_SYSTEM_PROMPT = `You are AUI, the AI assistant for humanizer.com Studio.

Your role is to help users understand and use the Studio interface effectively.

Key features of the Studio:
- **Archive Panel** (left): Browse 1,800+ ChatGPT conversations, search by title, filter by media
- **Workspace** (center): View and edit imported content, with LaTeX rendering
- **Tools Panel** (right): Transform content with Humanize, Persona, Style, and analysis tools
- **Navigation**: When viewing a conversation message, use ⇤←→⇥ to navigate between messages

Quick tips:
- Hover left edge or click "Archive" to browse conversations
- Hover right edge or click "Tools" to access transformation tools
- Use the search bar to find conversations by title
- "Hide empty" filter removes conversations with no messages
- Settings tab lets you show/hide tools you don't use

Be concise and helpful. Use markdown formatting.`;

function AUIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! I\'m AUI, your Studio assistant. How can I help you navigate the interface?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Try local Ollama first, then fall back to cloud API
      const apiUrl = import.meta.env.VITE_CHAT_API_URL || 'http://localhost:11434/api/chat';
      const isOllama = apiUrl.includes('11434');

      if (isOllama) {
        // Ollama API format
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3.2',
            messages: [
              { role: 'system', content: AUI_SYSTEM_PROMPT },
              ...messages.map(m => ({ role: m.role, content: m.content })),
              { role: 'user', content: userMessage }
            ],
            stream: false,
          }),
        });

        if (!response.ok) throw new Error('Ollama not available');
        const data = await response.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.message?.content || 'Sorry, I couldn\'t process that.' }]);
      } else {
        // Cloud API format
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: AUI_SYSTEM_PROMPT },
              ...messages.map(m => ({ role: m.role, content: m.content })),
              { role: 'user', content: userMessage }
            ],
          }),
        });

        if (!response.ok) throw new Error('Chat API not available');
        const data = await response.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.response || 'Sorry, I couldn\'t process that.' }]);
      }
    } catch (err) {
      // Fallback to static responses
      const fallbackResponses: Record<string, string> = {
        'archive': 'The **Archive panel** is on the left side. Hover over the left edge or click "Archive" in the top bar to open it. You can search conversations by title and filter by media type.',
        'tools': 'The **Tools panel** is on the right side. Hover over the right edge or click "Tools ⚙" to open it. You\'ll find transformation tools like Humanize, Persona, and Style.',
        'navigate': 'When viewing a message from a conversation, use the navigation bar: **⇤** (first), **←** (previous), **→** (next), **⇥** (last) to move through messages.',
        'search': 'Use the **search bar** at the top of the Archive panel to filter conversations by title. The search works across all 1,800+ conversations.',
        'filter': 'Use the **filter dropdowns** to sort by message count, length, or date. The "Hide empty" checkbox filters out conversations with no messages.',
      };

      const lowerInput = userMessage.toLowerCase();
      let response = 'I\'m having trouble connecting to my backend. Here\'s what I can tell you:\n\n';

      if (lowerInput.includes('archive') || lowerInput.includes('conversation')) {
        response += fallbackResponses['archive'];
      } else if (lowerInput.includes('tool')) {
        response += fallbackResponses['tools'];
      } else if (lowerInput.includes('navigate') || lowerInput.includes('arrow') || lowerInput.includes('message')) {
        response += fallbackResponses['navigate'];
      } else if (lowerInput.includes('search') || lowerInput.includes('find')) {
        response += fallbackResponses['search'];
      } else if (lowerInput.includes('filter') || lowerInput.includes('sort')) {
        response += fallbackResponses['filter'];
      } else {
        response = 'I can help you with:\n- **Archive**: Browse and search conversations\n- **Tools**: Transform content\n- **Navigation**: Move between messages\n- **Filters**: Sort and filter the archive\n\nWhat would you like to know more about?';
      }

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div className="aui-chat">
          <div className="aui-chat__header">
            <span className="aui-chat__title">AUI Assistant</span>
            <button className="aui-chat__close" onClick={() => setIsOpen(false)}>×</button>
          </div>
          <div className="aui-chat__messages">
            {messages.map((msg, i) => (
              <div key={i} className={`aui-chat__message aui-chat__message--${msg.role}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            ))}
            {loading && (
              <div className="aui-chat__message aui-chat__message--assistant aui-chat__message--loading">
                <span>···</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="aui-chat__input-area">
            <input
              type="text"
              className="aui-chat__input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the Studio..."
              disabled={loading}
            />
            <button
              className="aui-chat__send"
              onClick={sendMessage}
              disabled={!input.trim() || loading}
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Floating Chat Button */}
      <button
        className={`aui-fab ${isOpen ? 'aui-fab--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="AUI Assistant"
      >
        {isOpen ? '×' : '?'}
      </button>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STUDIO
// ═══════════════════════════════════════════════════════════════════

export function Studio() {
  const [selectedMedia, setSelectedMedia] = useState<SelectedFacebookMedia | null>(null);

  return (
    <ThemeProvider>
      <BufferProvider>
        <div className="studio">
          <TopBar onSelectMedia={setSelectedMedia} />
          <main className="studio__main">
            <Workspace
              selectedMedia={selectedMedia}
              onClearMedia={() => setSelectedMedia(null)}
              onUpdateMedia={setSelectedMedia}
            />
          </main>
          <AUIChat />
        </div>
      </BufferProvider>
    </ThemeProvider>
  );
}
