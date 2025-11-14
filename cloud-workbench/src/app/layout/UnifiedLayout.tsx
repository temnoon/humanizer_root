import { useState, type ReactNode } from "react";
import { ThemeToggle } from "../../components/ui/ThemeToggle";
import { toolRegistry } from "../../core/tool-registry";

export interface UnifiedLayoutProps {
  left: ReactNode;
  center: ReactNode;
  activeTool: string;
  onToolChange: (toolId: string) => void;
  currentTool: React.ComponentType | null;
}

export function UnifiedLayout({
  left,
  center,
  activeTool,
  onToolChange,
  currentTool: CurrentToolPanel,
}: UnifiedLayoutProps) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  // Filter tools by kind (transformations/analysis vs history/sessions)
  const mainTools = toolRegistry.filter(t => t.kind !== "pipeline");
  const pipelineTools = toolRegistry.filter(t => t.kind === "pipeline");

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Header with Logo, Tool Tabs, Theme Toggle, User */}
      <header
        className="flex-shrink-0 border-b"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-color)',
        }}
      >
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3">
          {/* Left: Menu Button */}
          <button
            onClick={() => setLeftOpen(!leftOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
            style={{
              background: leftOpen ? 'var(--accent-purple-alpha-10)' : 'transparent',
              border: '1px solid var(--border-color)',
            }}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-sm font-medium">Menu</span>
          </button>

          {/* Center: Logo */}
          <h1
            className="text-lg font-bold"
            style={{
              background: 'linear-gradient(135deg, var(--logo-gradient-from), var(--logo-gradient-to))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            humanizer.com
          </h1>

          {/* Right: Tools Button */}
          <button
            onClick={() => setRightOpen(!rightOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
            style={{
              background: rightOpen ? 'var(--accent-purple-alpha-10)' : 'transparent',
              border: '1px solid var(--border-color)',
            }}
            aria-label="Toggle tools"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className="text-sm font-medium">Tools</span>
          </button>
        </div>

        {/* Desktop Header */}
        <div className="hidden lg:flex items-center justify-between px-6 py-3">
          {/* Left: Logo + Tool Tabs */}
          <div className="flex items-center gap-6">
            <h1
              className="text-xl font-bold whitespace-nowrap"
              style={{
                background: 'linear-gradient(135deg, var(--logo-gradient-from), var(--logo-gradient-to))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              humanizer.com
            </h1>

            {/* Tool Tabs */}
            <nav className="flex items-center gap-1">
              {mainTools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => onToolChange(tool.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium text-sm"
                  style={{
                    background: activeTool === tool.id ? 'var(--accent-purple)' : 'transparent',
                    color: activeTool === tool.id ? 'white' : 'var(--text-secondary)',
                    border: activeTool === tool.id ? 'none' : '1px solid transparent',
                  }}
                  title={tool.label}
                >
                  {tool.icon}
                  <span>{tool.label}</span>
                </button>
              ))}

              {/* Separator */}
              <div
                className="h-6 w-px mx-2"
                style={{ background: 'var(--border-color)' }}
              />

              {/* Pipeline Tools (History, Sessions) */}
              {pipelineTools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => onToolChange(tool.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium text-sm"
                  style={{
                    background: activeTool === tool.id ? 'var(--accent-purple)' : 'transparent',
                    color: activeTool === tool.id ? 'white' : 'var(--text-secondary)',
                    border: activeTool === tool.id ? 'none' : '1px solid transparent',
                  }}
                  title={tool.label}
                >
                  {tool.icon}
                  <span>{tool.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Right: Theme Toggle + User Info */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              demo@humanizer.com
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="flex-1 grid grid-rows-[1fr] overflow-hidden">
        {/* Desktop: 3-column grid | Tablet: 2-column | Mobile: 1-column with sliding panels */}
        <div className="relative grid grid-cols-1 md:grid-cols-[340px_1fr] lg:grid-cols-[320px_1fr_360px] gap-0 md:gap-2 p-0 md:p-2 overflow-hidden">

          {/* Left Panel (Archive/History) - Slides in on mobile */}
          <aside
            className={`
              fixed md:relative inset-y-0 left-0 z-40 w-[280px] md:w-auto
              transform transition-transform duration-300 ease-in-out
              ${leftOpen ? 'translate-x-0' : '-translate-x-full'}
              md:translate-x-0
              overflow-hidden
              border-r md:border-r-0
            `}
            style={{
              background: 'var(--bg-secondary)',
              borderColor: 'var(--border-color)',
              marginTop: leftOpen ? '60px' : '0',
            }}
          >
            {/* Mobile close button */}
            <div className="md:hidden flex justify-end p-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <button
                onClick={() => setLeftOpen(false)}
                className="p-2 rounded transition-colors"
                style={{
                  background: 'var(--bg-tertiary)',
                }}
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="md:rounded-lg overflow-hidden h-full">
              {left}
            </div>
          </aside>

          {/* Center Panel (Canvas) - Always visible */}
          <main
            className="rounded-none md:rounded-lg overflow-hidden"
            style={{ background: 'var(--bg-secondary)' }}
          >
            {center}
          </main>

          {/* Right Panel (Tool Panel) - Slides in on mobile, visible on tablet+ */}
          <aside
            className={`
              fixed md:relative inset-y-0 right-0 z-40 w-full sm:w-[360px] md:w-auto
              transform transition-transform duration-300 ease-in-out
              ${rightOpen ? 'translate-x-0' : 'translate-x-full'}
              md:translate-x-0
              overflow-hidden
              border-l md:border-l-0
              max-w-full
            `}
            style={{
              background: 'var(--bg-secondary)',
              borderColor: 'var(--border-color)',
              marginTop: rightOpen ? '60px' : '0',
            }}
          >
            {/* Mobile close button */}
            <div className="md:hidden flex justify-end p-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <button
                onClick={() => setRightOpen(false)}
                className="p-2 rounded transition-colors"
                style={{
                  background: 'var(--bg-tertiary)',
                }}
                aria-label="Close tools"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Render active tool panel */}
            <div className="md:rounded-lg overflow-hidden h-full">
              {CurrentToolPanel && <CurrentToolPanel />}
            </div>
          </aside>

          {/* Overlay for mobile panels */}
          {(leftOpen || rightOpen) && (
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-30"
              onClick={() => {
                setLeftOpen(false);
                setRightOpen(false);
              }}
              style={{ marginTop: '60px' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
