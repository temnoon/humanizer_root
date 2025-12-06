/**
 * Input Panel - Left Side
 * Multi-source content importer:
 * - Local archives (Electron only)
 * - Folder browser (Electron only)
 * - Paste content
 * - Gutenberg import
 * - Facebook/Instagram archives
 * - Post-Social node network
 * - Book Builder projects
 */

import React, { useState, useEffect, useRef } from 'react';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { usePanelHistory } from '@/contexts/PanelHistoryContext';
import { PanelNavigation } from '@/components/PanelNavigation';
import { useServices } from '@/services/api';
import { FacebookFeed } from './FacebookFeed';
import './InputPanel.css';

type InputSource =
  | 'local-archive'
  | 'folder'
  | 'paste'
  | 'gutenberg'
  | 'facebook'
  | 'instagram'
  | 'node-network'
  | 'book-builder';

export function InputPanel() {
  const { features } = useEnvironment();
  const { state: navState, navigateBack, navigateToRoot, resetNavigation } = useNavigation();
  const {
    canGoBackLeft,
    canGoForwardLeft,
    goBackLeft,
    goForwardLeft,
    pushLeftState,
    currentLeftState,
  } = usePanelHistory();
  const [activeSource, setActiveSource] = useState<InputSource | null>(null);

  const sources: Array<{
    id: InputSource;
    label: string;
    icon: string;
    description: string;
    available: boolean;
    badge?: string;
  }> = [
    {
      id: 'local-archive',
      label: 'Local Archive',
      icon: '🏠',
      description: 'OpenAI export archives',
      available: features.localArchives,
    },
    {
      id: 'folder',
      label: 'Folder Browser',
      icon: '📁',
      description: 'Browse local files and folders',
      available: features.localArchives,
    },
    {
      id: 'paste',
      label: 'Paste Content',
      icon: '📋',
      description: 'Paste text directly',
      available: true,
    },
    {
      id: 'gutenberg',
      label: 'Project Gutenberg',
      icon: '📚',
      description: 'Import public domain books',
      available: true,
    },
    {
      id: 'facebook',
      label: 'Facebook Archive',
      icon: '👥',
      description: 'Import Facebook data export',
      available: true,
      badge: 'Beta',
    },
    {
      id: 'instagram',
      label: 'Instagram Archive',
      icon: '📸',
      description: 'Import Instagram data export',
      available: true,
      badge: 'Coming Soon',
    },
    {
      id: 'node-network',
      label: 'Node Network',
      icon: '🌐',
      description: 'Browse post-social nodes',
      available: features.nodeNetwork,
    },
    {
      id: 'book-builder',
      label: 'Book Projects',
      icon: '📖',
      description: 'Manage book projects',
      available: features.bookBuilder,
      badge: 'WIP',
    },
  ];

  const handleSourceClick = (source: InputSource) => {
    if (!sources.find(s => s.id === source)?.available) return;
    setActiveSource(source);
    navigateToRoot(source);

    // Push to panel history
    pushLeftState({
      id: `source-${source}`,
      type: 'source',
      data: { source },
    });
  };

  // Push initial root state on mount
  useEffect(() => {
    pushLeftState({
      id: 'sources-root',
      type: 'root',
      data: {},
    });
  }, []); // Only run once on mount

  // Restore state when navigating through panel history
  useEffect(() => {
    if (currentLeftState?.type === 'source') {
      const source = currentLeftState.data.source as InputSource;
      setActiveSource(source);
      if (navState.sourceType !== source) {
        navigateToRoot(source);
      }
    } else if (currentLeftState?.type === 'root') {
      setActiveSource(null);
      resetNavigation();
    }
  }, [currentLeftState]);

  return (
    <div className="input-panel">
      {/* Panel Navigation - Always visible */}
      <PanelNavigation
        position="left"
        canGoBack={canGoBackLeft}
        canGoForward={canGoForwardLeft}
        onBack={goBackLeft}
        onForward={goForwardLeft}
        title="Sources"
      />

      <div className="panel-header">
        <h2>📂 Sources</h2>
        <p>Choose your content source</p>
      </div>

      {/* Breadcrumbs */}
      {navState.path.length > 0 && (
        <div className="navigation-breadcrumbs">
          <button
            className="breadcrumb-item breadcrumb-root"
            onClick={() => {
              resetNavigation();
              setActiveSource(null);
            }}
          >
            Sources
          </button>
          {navState.path.map((node, index) => (
            <React.Fragment key={node.id}>
              <span className="breadcrumb-separator">/</span>
              <button
                className={`breadcrumb-item ${index === navState.path.length - 1 ? 'active' : ''}`}
                onClick={() => {
                  // Navigate to this level by going back to it
                  const stepsBack = navState.path.length - 1 - index;
                  for (let i = 0; i < stepsBack; i++) {
                    navigateBack();
                  }
                }}
              >
                {node.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Back Button */}
      {navState.path.length > 0 && (
        <button className="back-button" onClick={navigateBack}>
          ← Back
        </button>
      )}

      <div className="panel-content">
        {/* Show source list only when at root */}
        {!navState.sourceType && (
          <div className="source-list">
            {sources.map((source) => (
              <button
                key={source.id}
                className={`source-item ${activeSource === source.id ? 'active' : ''} ${!source.available ? 'disabled' : ''}`}
                onClick={() => handleSourceClick(source.id)}
                disabled={!source.available}
              >
                <div className="source-icon">{source.icon}</div>
                <div className="source-info">
                  <div className="source-label">
                    {source.label}
                    {source.badge && (
                      <span className="source-badge">{source.badge}</span>
                    )}
                  </div>
                  <div className="source-description">{source.description}</div>
                </div>
                {!source.available && (
                  <div className="source-lock">🔒</div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Source-specific UI */}
        {navState.sourceType && (
          <div className="source-content">
            <SourceContent source={navState.sourceType as InputSource} />
          </div>
        )}
      </div>
    </div>
  );
}

function SourceContent({ source }: { source: InputSource }) {
  switch (source) {
    case 'paste':
      return <PasteContent />;
    case 'gutenberg':
      return <GutenbergContent />;
    case 'local-archive':
      return <LocalArchiveContent />;
    case 'folder':
      return <FolderContent />;
    case 'facebook':
      return <FacebookContent />;
    default:
      return (
        <div className="source-placeholder">
          <p>🚧 {source} importer coming soon...</p>
        </div>
      );
  }
}

function PasteContent() {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const { createBuffer } = useWorkspace();

  const handleImport = () => {
    if (text.trim()) {
      const bufferTitle = title.trim() || 'Pasted Content';
      createBuffer(bufferTitle, text, {
        type: 'paste',
        metadata: {
          wordCount: text.split(/\s+/).length,
          characterCount: text.length,
        },
      });
      setText('');
      setTitle('');
    }
  };

  const wordCount = text.split(/\s+/).filter(w => w).length;
  const charCount = text.length;

  return (
    <div className="paste-content">
      <h3>Paste Your Content</h3>
      <input
        type="text"
        className="paste-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
      />
      <textarea
        className="paste-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your text here..."
        rows={12}
      />
      <div className="paste-stats">
        <span>{wordCount} words</span>
        <span>{charCount} characters</span>
      </div>
      <button
        className="btn btn-primary"
        onClick={handleImport}
        disabled={!text.trim()}
      >
        Import to Workspace
      </button>
    </div>
  );
}

function GutenbergContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { gutenberg } = useServices();
  const { createBuffer } = useWorkspace();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const results = await gutenberg.search(searchQuery, { limit: 10 });
      setSearchResults(results.results || []);
    } catch (error) {
      console.error('Gutenberg search failed:', error);
      alert('Failed to search Gutenberg. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (bookId: number, title: string) => {
    setDownloading(true);
    try {
      const text = await gutenberg.getBookText(bookId);
      createBuffer(title, text, {
        type: 'gutenberg',
        id: String(bookId),
        metadata: {
          bookId,
          source: 'Project Gutenberg',
        },
      });
      setSearchResults([]);
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to download book:', error);
      alert('Failed to download book. It may not be available in plain text format.');
    } finally {
      setDownloading(false);
    }
  };

  const handleQuickLoad = async () => {
    const bookId = parseInt(searchQuery);
    if (isNaN(bookId)) {
      alert('Please enter a valid book ID number');
      return;
    }

    setDownloading(true);
    try {
      const book = await gutenberg.getBook(bookId);
      const text = await gutenberg.getBookText(bookId);
      createBuffer(book.title, text, {
        type: 'gutenberg',
        id: String(bookId),
        metadata: {
          bookId,
          authors: book.authors,
          source: 'Project Gutenberg',
        },
      });
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to load book:', error);
      alert('Failed to load book. Check the book ID and try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="gutenberg-content">
      <h3>Project Gutenberg</h3>
      <p className="source-help">
        Search by title/author or enter a book ID
      </p>
      <div className="gutenberg-search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Book ID or search..."
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <div className="gutenberg-buttons">
          <button
            className="btn btn-secondary"
            onClick={handleQuickLoad}
            disabled={loading || downloading}
          >
            {downloading ? 'Loading...' : 'Load by ID'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSearch}
            disabled={loading || downloading}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="gutenberg-results">
          <h4>Results ({searchResults.length})</h4>
          <div className="results-list">
            {searchResults.map((book) => (
              <div key={book.id} className="result-item">
                <div className="result-info">
                  <div className="result-title">{book.title}</div>
                  <div className="result-meta">
                    {book.authors?.join(', ')} • ID: {book.id}
                  </div>
                  {book.subjects && book.subjects.length > 0 && (
                    <div className="result-subjects">
                      {book.subjects.slice(0, 3).join(' • ')}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => handleDownload(book.id, book.title)}
                  disabled={downloading}
                >
                  {downloading ? '...' : 'Import'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Popular Books */}
      {searchResults.length === 0 && (
        <div className="gutenberg-popular">
          <h4>Popular Books</h4>
          <div className="popular-list">
            {[
              { id: 84, title: 'Frankenstein', author: 'Mary Shelley' },
              { id: 1342, title: 'Pride and Prejudice', author: 'Jane Austen' },
              { id: 11, title: 'Alice in Wonderland', author: 'Lewis Carroll' },
              { id: 1661, title: 'Sherlock Holmes Adventures', author: 'Arthur Conan Doyle' },
              { id: 98, title: 'A Tale of Two Cities', author: 'Charles Dickens' },
            ].map((book) => (
              <button
                key={book.id}
                className="popular-item"
                onClick={() => handleDownload(book.id, book.title)}
                disabled={downloading}
              >
                <span className="popular-title">{book.title}</span>
                <span className="popular-author">{book.author}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LocalArchiveContent() {
  const { archive } = useServices();
  const { createBuffer } = useWorkspace();
  const [archives, setArchives] = useState<any[]>([]);
  const [selectedArchive, setSelectedArchive] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);

  useEffect(() => {
    loadArchives();
  }, []);

  const loadArchives = async () => {
    if (!archive) {
      return;
    }
    setLoading(true);
    try {
      const result = await archive.listArchives();
      setArchives(result);
    } catch (error) {
      console.error('Failed to load archives:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async (archiveId: string) => {
    if (!archive) return;
    setLoadingConv(true);
    try {
      const result = await archive.listConversations(archiveId, { limit: 50 });
      setConversations(result);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoadingConv(false);
    }
  };

  const handleArchiveClick = (archiveId: string) => {
    setSelectedArchive(archiveId);
    loadConversations(archiveId);
  };

  const handleConversationClick = async (convId: string) => {
    if (!archive || !selectedArchive) return;

    setLoadingConv(true);
    try {
      const conversation = await archive.getConversation(selectedArchive, convId);
      const fullText = conversation.messages
        .map(m => `**${m.role}**: ${m.content}`)
        .join('\n\n');

      createBuffer(conversation.title, fullText, {
        type: 'archive',
        id: convId,
        metadata: {
          archiveId: selectedArchive,
          conversationId: convId,
          messageCount: conversation.messages.length,
        },
      });
    } catch (error) {
      console.error('Failed to load conversation:', error);
      alert('Failed to load conversation');
    } finally {
      setLoadingConv(false);
    }
  };

  if (!archive) {
    return (
      <div className="source-placeholder">
        <p>🔒 Local archives only available in Electron mode</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="source-placeholder">
        <p>Loading archives...</p>
      </div>
    );
  }

  if (!selectedArchive) {
    return (
      <div className="archive-list">
        <h3>Your Archives</h3>
        {archives.length === 0 ? (
          <p>No archives found. Import an archive to get started.</p>
        ) : (
          <div className="archive-items">
            {archives.map((arch) => (
              <button
                key={arch.id}
                className="archive-item"
                onClick={() => handleArchiveClick(arch.id)}
              >
                <div className="archive-name">{arch.name}</div>
                <div className="archive-stats">
                  {arch.conversationCount} conversations • {arch.messageCount} messages
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="conversation-list">
      <button className="back-button" onClick={() => setSelectedArchive(null)}>
        ← Back to Archives
      </button>
      <h3>Conversations</h3>
      {loadingConv ? (
        <p>Loading conversations...</p>
      ) : (
        <div className="conversation-items">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              className="conversation-item"
              onClick={() => handleConversationClick(conv.id)}
            >
              <div className="conversation-title">{conv.title}</div>
              <div className="conversation-meta">
                {conv.messageCount} messages • {new Date(conv.created).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FolderContent() {
  const { archive } = useServices();
  const [folderPath, setFolderPath] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [importing, setImporting] = useState(false);

  const handleBrowse = async () => {
    // Use Electron API to browse for folder
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) {
      alert('Folder browsing only available in Electron mode');
      return;
    }

    try {
      const result = await electronAPI.selectFolder();
      if (result) {
        setFolderPath(result);
        setStatus('');
      }
    } catch (error) {
      console.error('Failed to browse folder:', error);
    }
  };

  const pollJobStatus = async (id: string) => {
    if (!archive) return;

    const interval = setInterval(async () => {
      try {
        const jobData = await archive.getImportStatus(id);
        setProgress(jobData.progress || 0);
        setStatus(jobData.status);

        if (jobData.status === 'ready') {
          clearInterval(interval);
          const preview = await archive.getImportPreview(id);
          setStatus(`Ready! Found ${preview.preview?.conversations?.length || 0} conversations`);

          // Auto-apply import
          await archive.applyImport(id, undefined, true);
          setStatus('Import completed successfully!');
          setImporting(false);
          setFolderPath('');
          setJobId(null);

          setTimeout(() => {
            setStatus('');
            setProgress(0);
          }, 3000);
        } else if (jobData.status === 'failed') {
          clearInterval(interval);
          setStatus(`Import failed: ${jobData.error || 'Unknown error'}`);
          setImporting(false);
        }
      } catch (error) {
        console.error('Error polling job status:', error);
        clearInterval(interval);
        setImporting(false);
      }
    }, 1000);
  };

  const handleImport = async () => {
    if (!archive || !folderPath) return;

    setImporting(true);
    setStatus('Starting import...');

    try {
      // Import from folder
      const { jobId: newJobId } = await archive.importFromFolder(folderPath);
      setJobId(newJobId);
      setStatus('Parsing folder...');

      // Start polling for status
      pollJobStatus(newJobId);
    } catch (error) {
      console.error('Failed to start import:', error);
      setStatus('Import failed');
      setImporting(false);
    }
  };

  if (!archive) {
    return (
      <div className="source-placeholder">
        <p>🔒 Folder browsing only available in Electron mode</p>
      </div>
    );
  }

  return (
    <div className="folder-content">
      <h3>Import from Folder</h3>
      <p className="source-help">
        Select a folder containing conversation data (e.g., OpenAI export)
      </p>
      <div className="folder-input-group">
        <input
          type="text"
          value={folderPath}
          onChange={(e) => setFolderPath(e.target.value)}
          placeholder="/path/to/folder"
          readOnly
        />
        <button
          className="btn btn-secondary"
          onClick={handleBrowse}
          disabled={importing}
        >
          Browse...
        </button>
      </div>
      {status && (
        <div className="import-status">
          <p>{status}</p>
          {progress > 0 && progress < 100 && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}
      <button
        className="btn btn-primary"
        onClick={handleImport}
        disabled={!folderPath || importing}
      >
        {importing ? 'Importing...' : 'Start Import'}
      </button>
    </div>
  );
}

// Facebook Content Wrapper - Browse and Import tabs
function FacebookContent() {
  const [mode, setMode] = useState<'browse' | 'import'>('browse');

  return (
    <div className="facebook-content-wrapper">
      <div className="mode-tabs">
        <button
          className={`mode-tab ${mode === 'browse' ? 'active' : ''}`}
          onClick={() => setMode('browse')}
        >
          📖 Browse Archive
        </button>
        <button
          className={`mode-tab ${mode === 'import' ? 'active' : ''}`}
          onClick={() => setMode('import')}
        >
          📤 Import New
        </button>
      </div>

      {mode === 'browse' ? <FacebookFeed /> : <FacebookImport />}
    </div>
  );
}

// Facebook Import Component
function FacebookImport() {
  const { archive } = useServices();
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.zip')) {
      setArchiveFile(file);
      setStatus('');
    } else if (file) {
      alert('Please select a ZIP file');
    }
  };

  const pollJobStatus = async (id: string) => {
    if (!archive) return;

    const interval = setInterval(async () => {
      try {
        const jobData = await archive.getImportStatus(id);
        setProgress(jobData.progress || 0);
        setStatus(jobData.status);

        if (jobData.status === 'ready') {
          clearInterval(interval);
          const preview = await archive.getImportPreview(id);
          setStatus(`Ready! Found ${preview.preview?.conversations?.length || 0} conversations`);

          // Auto-apply import
          await archive.applyImport(id, undefined, true);
          setStatus('Import completed successfully!');
          setUploading(false);
          setArchiveFile(null);
          setJobId(null);

          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }

          setTimeout(() => {
            setStatus('');
            setProgress(0);
          }, 3000);
        } else if (jobData.status === 'failed') {
          clearInterval(interval);
          setStatus(`Import failed: ${jobData.error || 'Unknown error'}`);
          setUploading(false);
        }
      } catch (error) {
        console.error('Error polling job status:', error);
        clearInterval(interval);
        setUploading(false);
      }
    }, 1000);
  };

  const handleImport = async () => {
    if (!archiveFile || !archive) return;

    setUploading(true);
    setStatus('Uploading...');

    try {
      // Upload the ZIP file
      const { jobId: newJobId } = await archive.uploadArchive(archiveFile, 'facebook');
      setJobId(newJobId);

      // Trigger parsing
      setStatus('Parsing Facebook archive...');
      await archive.parseArchive(newJobId);

      // Start polling for status
      pollJobStatus(newJobId);
    } catch (error) {
      console.error('Failed to upload archive:', error);
      setStatus('Upload failed');
      setUploading(false);
    }
  };

  if (!archive) {
    return (
      <div className="source-placeholder">
        <p>Archive server not available</p>
        <p className="help-text">Start the server: npx tsx archive-server.js</p>
      </div>
    );
  }

  return (
    <div className="facebook-import">
      <h3>Facebook Archive Import</h3>
      <p className="source-help">
        Upload your Facebook data export (.zip file)
      </p>
      <div className="file-input-group">
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileSelect}
          disabled={uploading}
        />
      </div>
      {archiveFile && !uploading && (
        <div className="selected-file">
          <p>Selected: {archiveFile.name} ({(archiveFile.size / 1024 / 1024).toFixed(2)} MB)</p>
        </div>
      )}
      {status && (
        <div className="import-status">
          <p>{status}</p>
          {progress > 0 && progress < 100 && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}
      <button
        className="btn btn-primary"
        onClick={handleImport}
        disabled={!archiveFile || uploading}
      >
        {uploading ? 'Importing...' : 'Import Archive'}
      </button>
    </div>
  );
}
