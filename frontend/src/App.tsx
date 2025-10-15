import { useState, useEffect } from 'react';
import './App.css';
import AppShell from './components/layout/AppShell';
import TopBar from './components/layout/TopBar';
import Sidebar from './components/layout/Sidebar';
import MainPane from './components/layout/MainPane';
import ToolPanel from './components/tools/ToolPanel';
import AgentPrompt, { AgentMessage } from './components/agent/AgentPrompt';
import { MediaItem, api } from '@/lib/api-client';
import type { SidebarView } from '@/types/sidebar';
import { ToastProvider } from './contexts/ToastContext';

export interface SelectedContent {
  text: string;
  source: 'conversation' | 'message' | 'custom';
  sourceId?: string;
  messageId?: string;
}

export interface TransformationResult {
  transformation_id?: string;
  method: string;
  original_text: string;
  transformed_text: string;
  iterations?: number;
  convergence_score?: number;
  processing_time?: number;
  embedding_drift?: number[];
  ai_patterns?: any;
  ai_confidence?: number;
  target_stance?: any;
  examples_used?: any[];
  strength?: number;
}

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toolPanelCollapsed, setToolPanelCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<SidebarView>('conversations');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<SelectedContent | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [transformationResult, setTransformationResult] = useState<TransformationResult | null>(null);

  // Agent UI state
  const [agentPromptOpen, setAgentPromptOpen] = useState(false);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentConversationId, setAgentConversationId] = useState<string | null>(null);

  // Load conversation messages when conversation ID changes
  useEffect(() => {
    if (agentConversationId) {
      loadAgentConversation(agentConversationId);
    }
  }, [agentConversationId]);

  const loadAgentConversation = async (conversationId: string) => {
    try {
      const conversation = await api.getAgentConversation(conversationId);
      const messages = conversation.messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        tool_call: msg.tool_call,
        tool_result: msg.tool_result,
        gui_action: msg.gui_action,
        timestamp: new Date(msg.timestamp),
      }));
      setAgentMessages(messages);
    } catch (error) {
      console.error('Failed to load agent conversation:', error);
    }
  };

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);
  const toggleToolPanel = () => setToolPanelCollapsed(!toolPanelCollapsed);

  // Keyboard shortcut for agent prompt (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setAgentPromptOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectMedia = (media: MediaItem | null) => {
    setSelectedMedia(media);
    // When media is selected, switch to media view if not already there
    if (media && currentView !== 'media') {
      setCurrentView('media');
    }
  };

  // Handle agent message submission
  const handleAgentSubmit = async (message: string) => {
    setAgentLoading(true);

    // Add user message
    const userMessage: AgentMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setAgentMessages(prev => [...prev, userMessage]);

    try {
      // Call agent API
      const response = await api.agentChat(message, agentConversationId || undefined);

      // Update conversation ID
      if (response.conversation_id && !agentConversationId) {
        setAgentConversationId(response.conversation_id);
      }

      // Add assistant message
      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content: response.message.content,
        tool_call: response.message.tool_call,
        tool_result: response.message.tool_result,
        gui_action: response.message.gui_action,
        timestamp: new Date(),
      };
      setAgentMessages(prev => [...prev, assistantMessage]);

      // Handle GUI actions
      if (response.message.gui_action && response.message.gui_data) {
        handleGuiAction(response.message.gui_action, response.message.gui_data);
      }
    } catch (error) {
      console.error('Agent chat error:', error);
      const errorMessage: AgentMessage = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setAgentMessages(prev => [...prev, errorMessage]);
    } finally {
      setAgentLoading(false);
    }
  };

  // Handle GUI actions from agent
  const handleGuiAction = (action: string, data: any) => {
    console.log('GUI Action:', action, data);

    switch (action) {
      case 'open_search_results':
        // TODO: Display search results in main pane
        setCurrentView('conversations');
        break;

      case 'open_conversation_viewer':
        if (data.conversation_uuid) {
          setSelectedConversation(data.conversation_uuid);
          setCurrentView('conversations');
        }
        break;

      case 'open_neighbors_view':
        // TODO: Display neighbors in main pane
        break;

      case 'open_perturbation_view':
        // TODO: Display perturbation analysis
        break;

      case 'open_trajectory_view':
        // TODO: Display trajectory
        break;

      case 'open_cluster_view':
        // TODO: Display clusters
        break;

      default:
        console.log('Unknown GUI action:', action);
    }
  };

  return (
    <ToastProvider>
      <AppShell>
        <TopBar onToggleSidebar={toggleSidebar} />
        <div className="app-content">
          <Sidebar
            collapsed={sidebarCollapsed}
            currentView={currentView}
            onViewChange={setCurrentView}
            selectedConversation={selectedConversation}
            onSelectConversation={setSelectedConversation}
            onSelectMedia={handleSelectMedia}
          />
          <MainPane
            currentView={currentView}
            selectedConversation={selectedConversation}
            selectedMedia={selectedMedia}
            transformationResult={transformationResult}
            onSelectContent={setSelectedContent}
            onSelectConversation={setSelectedConversation}
            onSelectMedia={handleSelectMedia}
            onClearMedia={() => setSelectedMedia(null)}
            onClearTransformation={() => setTransformationResult(null)}
          />
          <ToolPanel
            collapsed={toolPanelCollapsed}
            onToggle={toggleToolPanel}
            selectedContent={selectedContent}
            onShowTransformation={setTransformationResult}
          />
        </div>

        {/* Agent Prompt - Cmd+K / Ctrl+K */}
        <AgentPrompt
          isOpen={agentPromptOpen}
          onClose={() => setAgentPromptOpen(false)}
          onSubmit={handleAgentSubmit}
          messages={agentMessages}
          isLoading={agentLoading}
        />
      </AppShell>
    </ToastProvider>
  );
}

export default App;
