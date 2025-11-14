import { useState } from "react";
import { UnifiedLayout } from "./layout/UnifiedLayout";
import { LeftPanel } from "../features/archive/LeftPanel";
import { Canvas } from "../features/canvas/Canvas";
import { toolRegistry } from "../core/tool-registry";
import { ArchiveProvider } from "../core/context/ArchiveContext";
import { CanvasProvider } from "../core/context/CanvasContext";
import { AuthProvider } from "../core/context/AuthContext";

export default function App() {
  // Tool switching state - Computer Humanizer is default (first in registry)
  const [activeTool, setActiveTool] = useState<string>(toolRegistry[0]?.id || "computer-humanizer");
  const currentTool = toolRegistry.find(t => t.id === activeTool);

  return (
    <AuthProvider>
      <ArchiveProvider>
        <CanvasProvider>
          <UnifiedLayout
            left={<LeftPanel />}
            center={<Canvas />}
            activeTool={activeTool}
            onToolChange={setActiveTool}
            currentTool={currentTool?.panel || null}
          />
        </CanvasProvider>
      </ArchiveProvider>
    </AuthProvider>
  );
}
