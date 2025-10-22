import { useState, useEffect, useMemo } from 'react';
import './App.css';
import AppShell from './components/layout/AppShell';
import TopBar from './components/layout/TopBar';
import TabBar from './components/layout/TabBar';
import Sidebar from './components/layout/Sidebar';
import MainPane from './components/layout/MainPane';
import ToolPanel from './components/tools/ToolPanel';
import AgentPrompt, { AgentMessage } from './components/agent/AgentPrompt';
import { MediaItem, api } from '@/lib/api-client';
import type { SidebarView } from '@/types/sidebar';
import { ToastProvider } from './contexts/ToastContext';
import { GUIActionExecutor, type GUIActionName, type GUIActionData } from '@/lib/gui-actions';
import WorkingMemoryWidget from './components/ephemeral/WorkingMemoryWidget';
import { useActivityTracker } from './hooks/useActivityTracker';
import SettingsPanel from './components/settings/SettingsPanel';
import { useTabStore } from './store/tabs';
import { createTabFromState, type CurrentAppState } from './types/tabs';

export interface SelectedContent {
  text: string;
  source: 'conversation' | 'message' | 'document' | 'chunk' | 'custom';
  sourceId?: string;
  messageId?: string;
  chunkId?: string;
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
  // Tab store
  const activeTabId = useTabStore(state => state.activeTabId);
  const getActiveTab = useTabStore(state => state.getActiveTab);
  const updateTab = useTabStore(state => state.updateTab);
  const createTab = useTabStore(state => state.createTab);
  const closeTab = useTabStore(state => state.closeTab);
  const switchToNextTab = useTabStore(state => state.switchToNextTab);
  const switchToPrevTab = useTabStore(state => state.switchToPrevTab);
  const switchToTabByIndex = useTabStore(state => state.switchToTabByIndex);

  // App state (synced with active tab)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toolPanelCollapsed, setToolPanelCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<SidebarView>('conversations');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<SelectedContent | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [transformationResult, setTransformationResult] = useState<TransformationResult | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string | undefined>(undefined);
  const [documentTitle, setDocumentTitle] = useState<string | undefined>(undefined);

  // Agent UI state
  const [agentPromptOpen, setAgentPromptOpen] = useState(false);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentConversationId, setAgentConversationId] = useState<string | null>(null);

  // Settings panel state
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);

  // Track user activity for ephemeral lists
  useActivityTracker(selectedConversation, conversationTitle, transformationResult);

  // Additional state for GUI actions (unused for now but may be needed later)
  const [_searchResults, setSearchResults] = useState<any[]>([]);
  const [_neighborsView, setNeighborsView] = useState<any>(null);
  const [_perturbationView, setPerturbationView] = useState<any>(null);
  const [_trajectoryView, setTrajectoryView] = useState<any>(null);
  const [_clusterView, setClusterView] = useState<any>(null);

  // Initialize GUIActionExecutor
  const guiExecutor = useMemo(() => {
    return new GUIActionExecutor({
      setCurrentView,
      setSelectedConversation,
      setSelectedContent,
      setSelectedMedia,
      setTransformationResult,
      setSearchResults,
      setNeighborsView,
      setPerturbationView,
      setTrajectoryView,
      setClusterView,
    });
  }, []);

  // Load conversation title when conversation changes
  useEffect(() => {
    let cancelled = false;

    // Clear title immediately when conversation changes
    setConversationTitle(undefined);

    if (selectedConversation) {
      api.getConversation(selectedConversation)
        .then((conv: any) => {
          if (!cancelled) {
            setConversationTitle(conv.title || 'Untitled');
          }
        })
        .catch(() => {
          if (!cancelled) {
            setConversationTitle(undefined);
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [selectedConversation]);

  // Load document title when document changes
  useEffect(() => {
    let cancelled = false;

    // Clear title immediately when document changes
    setDocumentTitle(undefined);

    if (selectedDocument) {
      api.getDocument(selectedDocument)
        .then((doc: any) => {
          if (!cancelled) {
            setDocumentTitle(doc.title || doc.filename);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDocumentTitle(undefined);
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [selectedDocument]);

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

  // Load active tab state into app on mount and tab switch
  useEffect(() => {
    const activeTab = getActiveTab();
    if (activeTab) {
      setSidebarCollapsed(activeTab.sidebarCollapsed);
      setToolPanelCollapsed(activeTab.toolPanelCollapsed);
      setCurrentView(activeTab.sidebarView);
      setSelectedConversation(activeTab.selectedConversation);
      setSelectedDocument(activeTab.selectedDocument || null);
      setConversationTitle(activeTab.conversationTitle);
      setDocumentTitle(activeTab.documentTitle);
      setSelectedContent(activeTab.selectedContent);
      setTransformationResult(activeTab.transformationResult);
      setSelectedMedia(activeTab.selectedMedia);
    }
  }, [activeTabId, getActiveTab]);

  // Sync app state changes to active tab
  useEffect(() => {
    const activeTab = getActiveTab();
    if (activeTab) {
      const tabTitle = documentTitle || conversationTitle || activeTab.title;
      const tabIcon = selectedDocument ? '📄' : selectedConversation ? '💬' : activeTab.icon;

      updateTab(activeTab.id, {
        sidebarCollapsed,
        toolPanelCollapsed,
        sidebarView: currentView,
        selectedConversation,
        selectedDocument,
        conversationTitle,
        documentTitle,
        selectedContent,
        transformationResult,
        selectedMedia,
        title: tabTitle,
        icon: tabIcon,
      });
    }
  }, [
    sidebarCollapsed,
    toolPanelCollapsed,
    currentView,
    selectedConversation,
    selectedDocument,
    conversationTitle,
    documentTitle,
    selectedContent,
    transformationResult,
    selectedMedia,
    getActiveTab,
    updateTab,
  ]);

  // Keyboard shortcuts for tabs and agent
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+K: Toggle agent prompt
      if (isMod && e.key === 'k') {
        e.preventDefault();
        setAgentPromptOpen(prev => !prev);
        return;
      }

      // Cmd+T: New tab
      if (isMod && e.key === 't') {
        e.preventDefault();
        const currentState: CurrentAppState = {
          sidebarView: currentView,
          sidebarCollapsed,
          selectedConversation,
          selectedDocument,
          conversationTitle,
          documentTitle,
          toolPanelCollapsed,
          selectedContent,
          transformationResult,
          selectedMedia,
        };
        const newTabTemplate = createTabFromState(currentState);
        createTab(newTabTemplate);
        return;
      }

      // Cmd+W: Close current tab
      if (isMod && e.key === 'w') {
        e.preventDefault();
        const activeTab = getActiveTab();
        if (activeTab) {
          closeTab(activeTab.id);
        }
        return;
      }

      // Cmd+Shift+[: Previous tab
      if (isMod && e.shiftKey && e.key === '[') {
        e.preventDefault();
        switchToPrevTab();
        return;
      }

      // Cmd+Shift+]: Next tab
      if (isMod && e.shiftKey && e.key === ']') {
        e.preventDefault();
        switchToNextTab();
        return;
      }

      // Cmd+1-9: Switch to tab by index
      if (isMod && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        switchToTabByIndex(index);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentView,
    sidebarCollapsed,
    selectedConversation,
    conversationTitle,
    toolPanelCollapsed,
    selectedContent,
    transformationResult,
    selectedMedia,
    getActiveTab,
    createTab,
    closeTab,
    switchToPrevTab,
    switchToNextTab,
    switchToTabByIndex,
  ]);

  // Listen for AUI action completion to close modal
  useEffect(() => {
    const handleAUIActionComplete = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('🎉 AUI action completed:', customEvent.detail);
      setAgentPromptOpen(false); // Close the modal
    };

    window.addEventListener('aui-action-complete', handleAUIActionComplete);
    return () => window.removeEventListener('aui-action-complete', handleAUIActionComplete);
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
        console.log('🎬 Received GUI action from agent:', response.message.gui_action);
        console.log('📦 GUI data:', response.message.gui_data);
        handleGuiAction(response.message.gui_action, response.message.gui_data);
      } else {
        console.log('ℹ️ No GUI action in response');
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

  // Handle GUI actions from agent using GUIActionExecutor
  const handleGuiAction = async (action: string, data: any) => {
    console.log('🎯 handleGuiAction called with:', action, data);
    try {
      await guiExecutor.execute(action as GUIActionName, data as GUIActionData, {
        animate: true,
        highlight: true,
        scrollTo: true,
      });
      console.log('✅ GUI action executed successfully');
    } catch (error) {
      console.error('❌ GUI action failed:', error);
    }
  };

  // Handle navigation from Working Memory widget
  const handleWidgetNavigation = (item: any) => {
    console.log('🧭 Navigating to item:', item);

    switch (item.type) {
      case 'conversation':
        setCurrentView('conversations');
        setSelectedConversation(item.uuid);
        break;

      case 'transformation':
        // Transformation navigation would require fetching transformation data
        // For now, just log it
        console.log('Transformation navigation not yet implemented');
        break;

      case 'media':
        setCurrentView('media');
        // Would need to fetch media item by UUID
        console.log('Media navigation not yet implemented');
        break;

      case 'search':
        // Would trigger a search with the query from metadata
        console.log('Search navigation not yet implemented');
        break;

      default:
        console.warn('Unknown item type:', item.type);
    }
  };

  return (
    <ToastProvider>
      <AppShell>
        <TopBar
          onToggleSidebar={toggleSidebar}
          onOpenAUI={() => setAgentPromptOpen(true)}
          onOpenSettings={() => setSettingsPanelOpen(true)}
        />
        <TabBar position="top" />
        <div className="app-content">
          <Sidebar
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            currentView={currentView}
            onViewChange={setCurrentView}
            selectedConversation={selectedConversation}
            onSelectConversation={setSelectedConversation}
            onSelectDocument={setSelectedDocument}
            onSelectMedia={handleSelectMedia}
            onOpenAUI={() => setAgentPromptOpen(true)}
          />
          <MainPane
            currentView={currentView}
            selectedConversation={selectedConversation}
            selectedDocument={selectedDocument}
            selectedMedia={selectedMedia}
            transformationResult={transformationResult}
            onSelectContent={setSelectedContent}
            onSelectConversation={setSelectedConversation}
            onSelectDocument={setSelectedDocument}
            onSelectMedia={handleSelectMedia}
            onClearMedia={() => setSelectedMedia(null)}
            onClearDocument={() => setSelectedDocument(null)}
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
          conversationId={agentConversationId}
          onConversationChange={setAgentConversationId}
        />

        {/* Working Memory Widget - Ephemeral Lists */}
        <WorkingMemoryWidget onNavigate={handleWidgetNavigation} />

        {/* Settings Panel */}
        <SettingsPanel isOpen={settingsPanelOpen} onClose={() => setSettingsPanelOpen(false)} />
      </AppShell>
    </ToastProvider>
  );
}

export default App;
