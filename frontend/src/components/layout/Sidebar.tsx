import { useState, useEffect } from 'react';
import './Sidebar.css';
import ConversationList from '../conversations/ConversationList';
import MediaGallery from '../media/MediaGallery';
import SemanticSearch from '../search/SemanticSearch';
import PipelinePanel from '../pipeline/PipelinePanel';
import InterestListPanel from '../interest/InterestListPanel';
import { MediaItem } from '@/lib/api-client';
import type { SidebarView } from '@/types/sidebar';

interface SidebarProps {
  collapsed: boolean;
  currentView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  selectedConversation?: string | null;
  onSelectConversation?: (uuid: string) => void;
  onSelectMedia?: (media: MediaItem | null) => void;
}

interface SidebarIcon {
  id: SidebarView;
  icon: string;
  label: string;
  ariaLabel: string;
}

const sidebarIcons: SidebarIcon[] = [
  { id: 'conversations', icon: '💬', label: 'Conversations', ariaLabel: 'View conversations' },
  { id: 'search', icon: '🔍', label: 'Search', ariaLabel: 'Semantic search' },
  { id: 'lists', icon: '📋', label: 'Lists', ariaLabel: 'Interest lists' },
  { id: 'readings', icon: '📖', label: 'Readings', ariaLabel: 'View quantum readings' },
  { id: 'media', icon: '🖼️', label: 'Media', ariaLabel: 'View media library' },
  { id: 'povms', icon: '🎯', label: 'POVMs', ariaLabel: 'View POVM packs' },
  { id: 'stats', icon: '📊', label: 'Stats', ariaLabel: 'View statistics' },
  { id: 'pipeline', icon: '⚡', label: 'Pipeline', ariaLabel: 'Manage embedding pipeline' },
  { id: 'settings', icon: '⚙️', label: 'Settings', ariaLabel: 'Open settings' },
  { id: 'aui', icon: '🤖', label: 'AUI', ariaLabel: 'Open AUI assistant' },
];

/**
 * Sidebar - Left navigation panel with icon-based view switching
 */
export default function Sidebar({ collapsed, currentView, onViewChange, selectedConversation, onSelectConversation, onSelectMedia }: SidebarProps) {
  const [isResizing, setIsResizing] = useState(false);

  // Load sidebar width from localStorage, default to 380px
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved, 10) : 380;
  });

  const handleMouseDown = () => {
    setIsResizing(true);
  };

  // Use global mouse events for dragging (not React events)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = e.clientX - 48; // 48px for icon bar
        if (newWidth >= 250 && newWidth <= 800) {
          setSidebarWidth(newWidth);
          // Save to localStorage immediately during drag
          localStorage.setItem('sidebarWidth', newWidth.toString());
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Icon Bar (always visible) */}
      <div className="sidebar-icons">
        {sidebarIcons.map((item) => (
          <button
            key={item.id}
            className={`sidebar-icon ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
            aria-label={item.ariaLabel}
            title={item.label}
          >
            <span className="icon">{item.icon}</span>
          </button>
        ))}
      </div>

      {/* Content Panel (collapsible) */}
      {!collapsed && (
        <div className="sidebar-content" style={{ width: sidebarWidth }}>
          <div className="sidebar-header">
            <h2 className="sidebar-title">
              {sidebarIcons.find((i) => i.id === currentView)?.label}
            </h2>
          </div>

          <div className="sidebar-body">
            {currentView === 'conversations' && <ConversationsView selectedConversation={selectedConversation} onSelectConversation={onSelectConversation} />}
            {currentView === 'search' && <SearchView onSelectConversation={onSelectConversation} />}
            {currentView === 'lists' && <ListsView onSelectConversation={onSelectConversation} />}
            {currentView === 'readings' && <ReadingsView />}
            {currentView === 'media' && <MediaView onSelectMedia={onSelectMedia} />}
            {currentView === 'povms' && <POVMsView />}
            {currentView === 'stats' && <StatsView />}
            {currentView === 'pipeline' && <PipelineView />}
            {currentView === 'settings' && <SettingsView />}
            {currentView === 'aui' && <AUIView />}
          </div>
          {/* Resize Handle */}
          <div
            className="resize-handle"
            onMouseDown={handleMouseDown}
            role="separator"
            aria-label="Resize sidebar"
          />
        </div>
      )}
    </div>
  );
}

// View components
function ConversationsView({ selectedConversation, onSelectConversation }: { selectedConversation?: string | null, onSelectConversation?: (uuid: string) => void }) {
  return (
    <ConversationList
      selectedConversation={selectedConversation}
      onSelect={onSelectConversation}
    />
  );
}

function SearchView({ onSelectConversation }: { onSelectConversation?: (uuid: string) => void }) {
  return (
    <SemanticSearch
      onSelectConversation={onSelectConversation}
    />
  );
}

function ListsView({ onSelectConversation }: { onSelectConversation?: (uuid: string) => void }) {
  const handleSelectItem = (itemType: string, itemUuid: string) => {
    // For now, if it's a conversation, select it
    if (itemType === 'conversation' && onSelectConversation) {
      onSelectConversation(itemUuid);
    }
    // TODO: Handle other item types (messages, media, etc.)
  };

  return <InterestListPanel onSelectItem={handleSelectItem} />;
}

function ReadingsView() {
  return (
    <div className="view-placeholder">
      <p className="text-secondary">Quantum Readings</p>
      <p className="text-tertiary text-sm">TRM sessions</p>
    </div>
  );
}

function MediaView({ onSelectMedia }: { onSelectMedia?: (media: MediaItem | null) => void }) {
  return <MediaGallery onSelectMedia={onSelectMedia} />;
}

function POVMsView() {
  return (
    <div className="view-placeholder">
      <p className="text-secondary">POVM Packs</p>
      <p className="text-tertiary text-sm">5 measurement packs</p>
    </div>
  );
}

function StatsView() {
  return (
    <div className="view-placeholder">
      <p className="text-secondary">Statistics</p>
      <p className="text-tertiary text-sm">Usage & AUI insights</p>
    </div>
  );
}

function PipelineView() {
  return <PipelinePanel />;
}

function SettingsView() {
  return (
    <div className="view-placeholder">
      <p className="text-secondary">Settings</p>
      <p className="text-tertiary text-sm">App configuration</p>
    </div>
  );
}

function AUIView() {
  return (
    <div className="view-placeholder">
      <p className="text-secondary">AUI Assistant</p>
      <p className="text-tertiary text-sm">Adaptive recommendations</p>
    </div>
  );
}
