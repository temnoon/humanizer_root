/**
 * Main App Component
 * Unified Humanizer Interface - Works anywhere, local or cloud
 */

import React from 'react';
import { EnvironmentProvider } from './contexts/EnvironmentContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { PanelHistoryProvider } from './contexts/PanelHistoryContext';
import { Header } from './components/Header';
import { Layout } from './components/Layout';
import { InputPanel } from './components/input/InputPanel';
import { WorkspacePanel } from './components/workspace/WorkspacePanel';
import { ToolsPanel } from './components/tools/ToolsPanel';
import { StatusBar } from './components/StatusBar';

export function App() {
  return (
    <EnvironmentProvider>
      <ThemeProvider>
        <LayoutProvider>
          <PanelHistoryProvider>
            <NavigationProvider>
              <WorkspaceProvider>
                <div className="app">
                  <Header />
                  <Layout
                    leftPanel={<InputPanel />}
                    centerPanel={<WorkspacePanel />}
                    rightPanel={<ToolsPanel />}
                  />
                  <StatusBar />
                </div>
              </WorkspaceProvider>
            </NavigationProvider>
          </PanelHistoryProvider>
        </LayoutProvider>
      </ThemeProvider>
    </EnvironmentProvider>
  );
}
