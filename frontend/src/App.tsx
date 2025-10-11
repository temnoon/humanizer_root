import { useState } from 'react';
import './App.css';
import AppShell from './components/layout/AppShell';
import TopBar from './components/layout/TopBar';
import Sidebar from './components/layout/Sidebar';
import MainPane from './components/layout/MainPane';
import ToolPanel from './components/tools/ToolPanel';

type SidebarView = 'conversations' | 'readings' | 'media' | 'povms' | 'stats' | 'settings' | 'aui';

export interface SelectedContent {
  text: string;
  source: 'conversation' | 'message' | 'custom';
  sourceId?: string;
  messageId?: string;
}

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toolPanelCollapsed, setToolPanelCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<SidebarView>('conversations');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<SelectedContent | null>(null);

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);
  const toggleToolPanel = () => setToolPanelCollapsed(!toolPanelCollapsed);

  return (
    <AppShell>
      <TopBar onToggleSidebar={toggleSidebar} />
      <div className="app-content">
        <Sidebar
          collapsed={sidebarCollapsed}
          currentView={currentView}
          onViewChange={setCurrentView}
          selectedConversation={selectedConversation}
          onSelectConversation={setSelectedConversation}
        />
        <MainPane
          currentView={currentView}
          selectedConversation={selectedConversation}
          onSelectContent={setSelectedContent}
        />
        <ToolPanel
          collapsed={toolPanelCollapsed}
          onToggle={toggleToolPanel}
          selectedContent={selectedContent}
        />
      </div>
    </AppShell>
  );
}

export default App;
