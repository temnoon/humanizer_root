import { useState } from "react";
import { ThemeToggle } from "../../components/ui/ThemeToggle";
import { Canvas } from "../../features/canvas/Canvas";
import { ComputerHumanizerPanel } from "../../features/panels/computer-humanizer/ComputerHumanizerPanel";
import { useAuth } from "../../core/context/AuthContext";

export function SimpleLayout() {
  const { logout } = useAuth();
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);

  return (
    <div className="h-screen flex flex-col bg-base-100">
      {/* Header */}
      <header className="bg-base-200 border-b border-base-300">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-base-content">
              humanizer.com
            </h1>
            <span className="text-sm text-base-content/50">
              Workbench
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              className="btn btn-sm btn-ghost"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* 3-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Archive (placeholder) */}
        {leftPanelOpen && (
          <div className="w-80 bg-base-200 border-r border-base-300 flex flex-col">
            <div className="p-4 border-b border-base-300 flex items-center justify-between">
              <h2 className="font-semibold text-base-content">Archive</h2>
              <button
                className="btn btn-sm btn-ghost btn-square"
                onClick={() => setLeftPanelOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="text-center text-base-content/50 py-8">
                <p className="mb-2">Archive panel</p>
                <p className="text-xs">Coming soon</p>
              </div>
            </div>
          </div>
        )}

        {/* Center Panel - Canvas */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-hidden">
            <Canvas />
          </div>
        </div>

        {/* Right Panel - Tool (Computer Humanizer) */}
        <div className="w-96 bg-base-200 border-l border-base-300 flex flex-col overflow-hidden">
          <ComputerHumanizerPanel />
        </div>
      </div>
    </div>
  );
}
