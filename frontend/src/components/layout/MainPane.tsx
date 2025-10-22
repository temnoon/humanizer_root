import './MainPane.css';
import MediaGallery from '../media/MediaGallery';
import MediaViewer from '../media/MediaViewer';
import ConversationViewer from '../conversations/ConversationViewer';
import DocumentViewer from '../documents/DocumentViewer';
import CombinedPipelinePanel from '../pipeline/CombinedPipelinePanel';
import TransformationSplitView from '../tools/TransformationSplitView';
import { SelectedContent, TransformationResult } from '../../App';
import { MediaItem } from '@/lib/api-client';
import type { SidebarView } from '@/types/sidebar';

interface MainPaneProps {
  currentView: SidebarView;
  selectedConversation?: string | null;
  selectedDocument?: string | null;
  selectedMedia?: MediaItem | null;
  transformationResult?: TransformationResult | null;
  onSelectContent?: (content: SelectedContent | null) => void;
  onSelectConversation?: (conversationId: string | null) => void;
  onSelectDocument?: (documentId: string | null) => void;
  onSelectMedia?: (media: MediaItem | null) => void;
  onClearMedia?: () => void;
  onClearDocument?: () => void;
  onClearTransformation?: () => void;
}

/**
 * MainPane - Main content area
 * Displays content based on current sidebar view
 */
export default function MainPane({
  currentView,
  selectedConversation,
  selectedDocument,
  selectedMedia,
  transformationResult,
  onSelectContent,
  onSelectConversation,
  onSelectDocument: _onSelectDocument,
  onSelectMedia,
  onClearMedia,
  onClearDocument: _onClearDocument,
  onClearTransformation
}: MainPaneProps) {
  // Priority: Show transformation result if present
  if (transformationResult && onClearTransformation) {
    return (
      <main className="main-pane">
        <div className="main-pane-content">
          <TransformationSplitView
            result={transformationResult}
            onClose={onClearTransformation}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="main-pane">
      <div className="main-pane-content">
        {currentView === 'conversations' && (
          selectedConversation ? (
            <ConversationViewer
              conversationId={selectedConversation}
              onSelectContent={onSelectContent}
            />
          ) : (
            <WelcomeScreen />
          )
        )}
        {currentView === 'documents' && (
          selectedDocument ? (
            <DocumentViewer
              documentId={selectedDocument}
              onSelectContent={onSelectContent}
            />
          ) : (
            <PlaceholderContent title="Documents" icon="📚" description="Select a document to view" />
          )
        )}
        {currentView === 'readings' && <ReadingsContent />}
        {currentView === 'media' && (
          <MediaContent
            selectedMedia={selectedMedia}
            onSelectMedia={onSelectMedia}
            onClearMedia={onClearMedia}
            onSelectConversation={onSelectConversation}
          />
        )}
        {currentView === 'povms' && <POVMsContent />}
        {currentView === 'stats' && <StatsContent />}
        {currentView === 'pipeline' && <CombinedPipelinePanel />}
        {currentView === 'settings' && <SettingsContent />}
        {currentView === 'aui' && <AUIContent />}
      </div>
    </main>
  );
}

// Welcome screen (shown when no conversation selected)
function WelcomeScreen() {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <h1 className="welcome-title">
          <span className="welcome-icon">⚛️</span>
          Welcome to Humanizer
        </h1>
        <p className="welcome-subtitle">
          ChatGPT Archive Manager with TRM Quantum Reading
        </p>

        <div className="welcome-stats">
          <div className="stat-card">
            <div className="stat-value">1,659</div>
            <div className="stat-label">Conversations</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">46,355</div>
            <div className="stat-label">Messages</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">811</div>
            <div className="stat-label">Images</div>
          </div>
        </div>

        <div className="welcome-actions">
          <button className="action-button primary">
            <span>Browse Conversations</span>
            <span>→</span>
          </button>
          <button className="action-button">
            <span>View Documentation</span>
          </button>
        </div>

        <div className="welcome-features">
          <h2>Key Features</h2>
          <ul>
            <li>
              <span className="feature-icon">💬</span>
              <div>
                <strong>ChatGPT Archive Browser</strong>
                <p>Navigate your complete conversation history with rich metadata</p>
              </div>
            </li>
            <li>
              <span className="feature-icon">🔬</span>
              <div>
                <strong>TRM Quantum Reading</strong>
                <p>Apply quantum measurement operators (POVMs) to text</p>
              </div>
            </li>
            <li>
              <span className="feature-icon">🖼️</span>
              <div>
                <strong>Media Library</strong>
                <p>811 images indexed with full metadata and file ID resolution</p>
              </div>
            </li>
            <li>
              <span className="feature-icon">🤖</span>
              <div>
                <strong>AUI Adaptive Learning</strong>
                <p>Get personalized recommendations based on usage patterns</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Placeholder content components
function ReadingsContent() {
  return <PlaceholderContent title="Quantum Readings" icon="📖" />;
}

interface MediaContentProps {
  selectedMedia?: MediaItem | null;
  onSelectMedia?: (media: MediaItem | null) => void;
  onClearMedia?: () => void;
  onSelectConversation?: (conversationId: string | null) => void;
}

function MediaContent({ selectedMedia, onSelectMedia, onClearMedia, onSelectConversation }: MediaContentProps) {
  // If media is selected, show the viewer in MainPane
  if (selectedMedia) {
    return (
      <MediaViewer
        selectedMedia={selectedMedia}
        onClose={onClearMedia}
        onNavigateToConversation={(conversationId) => {
          onSelectConversation?.(conversationId);
          onClearMedia?.(); // Clear media selection to show conversation
        }}
      />
    );
  }

  // Otherwise show the gallery
  return <MediaGallery onSelectMedia={onSelectMedia} />;
}

function POVMsContent() {
  return <PlaceholderContent title="POVM Measurement Packs" icon="🎯" />;
}

function StatsContent() {
  return <PlaceholderContent title="Statistics & Insights" icon="📊" />;
}

function SettingsContent() {
  return <PlaceholderContent title="Settings" icon="⚙️" />;
}

function AUIContent() {
  return <PlaceholderContent title="AUI Assistant" icon="🤖" />;
}

function PlaceholderContent({ title, icon, description }: { title: string; icon: string; description?: string }) {
  return (
    <div className="placeholder-content">
      <span className="placeholder-icon">{icon}</span>
      <h2>{title}</h2>
      <p>{description || 'Content coming soon...'}</p>
    </div>
  );
}
