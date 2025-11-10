import { useState } from "react";
import type { ReactNode } from "react";
import { APIToggle } from "../../components/ui/APIToggle";

export function WorkbenchLayout({
  left, center, right, bottom,
}: { left: ReactNode; center: ReactNode; right: ReactNode; bottom?: ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* Header with API Toggle */}
      <header className="flex items-center justify-between border-b border-slate-800 px-3 md:px-6 py-3">
        <div className="flex items-center gap-2">
          {/* Mobile hamburger menu */}
          <button
            onClick={() => setLeftOpen(!leftOpen)}
            className="lg:hidden p-2 hover:bg-slate-800 rounded transition-colors"
            aria-label="Toggle archive"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-base md:text-xl font-bold text-slate-100">
            ✨ Narrative Projection Engine
          </h1>
        </div>
        <APIToggle />
      </header>

      {/* Main Content Grid */}
      <div className="flex-1 grid grid-rows-[1fr_auto] overflow-hidden">
        {/* Desktop: 3-column grid | Tablet: 2-column | Mobile: 1-column with sliding panels */}
        <div className="relative grid grid-cols-1 md:grid-cols-[340px_1fr] lg:grid-cols-[320px_1fr_360px] gap-0 md:gap-2 p-0 md:p-2 overflow-hidden">

          {/* Left Panel (Archive) - Slides in on mobile/tablet */}
          <aside
            className={`
              fixed md:relative inset-y-0 left-0 z-40 w-[280px] md:w-auto
              transform transition-transform duration-300 ease-in-out
              ${leftOpen ? 'translate-x-0' : '-translate-x-full'}
              md:translate-x-0
              bg-slate-900 md:rounded-lg overflow-hidden
              border-r md:border-r-0 border-slate-800
            `}
          >
            {/* Mobile close button */}
            <div className="md:hidden flex justify-end p-2 border-b border-slate-800">
              <button
                onClick={() => setLeftOpen(false)}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                aria-label="Close archive"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {left}
          </aside>

          {/* Center Panel (Canvas) - Always visible */}
          <main className="rounded-none md:rounded-lg bg-slate-900 overflow-hidden">
            {center}
          </main>

          {/* Right Panel (Tool Dock) - Slides in on mobile, visible on tablet+ */}
          <aside
            className={`
              fixed md:relative inset-y-0 right-0 z-40 w-[320px] md:w-auto
              transform transition-transform duration-300 ease-in-out
              ${rightOpen ? 'translate-x-0' : 'translate-x-full'}
              md:translate-x-0
              bg-slate-900 md:rounded-lg overflow-hidden
              border-l md:border-l-0 border-slate-800
            `}
          >
            {/* Mobile close button */}
            <div className="md:hidden flex justify-end p-2 border-b border-slate-800">
              <button
                onClick={() => setRightOpen(false)}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                aria-label="Close tools"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {right}
          </aside>

          {/* Mobile floating action button for tools */}
          <button
            onClick={() => setRightOpen(!rightOpen)}
            className="md:hidden fixed bottom-6 right-6 z-30 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 rounded-full shadow-lg flex items-center justify-center transition-colors"
            aria-label="Toggle tools"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>

          {/* Overlay for mobile panels */}
          {(leftOpen || rightOpen) && (
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-30"
              onClick={() => {
                setLeftOpen(false);
                setRightOpen(false);
              }}
            />
          )}
        </div>

        {bottom && <div className="p-2">{bottom}</div>}
      </div>
    </div>
  );
}
