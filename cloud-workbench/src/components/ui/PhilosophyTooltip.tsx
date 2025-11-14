import { useState } from 'react';

interface PhilosophyTooltipProps {
  title: string;
  description: string;
  learnMoreUrl?: string;
}

/**
 * PhilosophyTooltip - Collapsible philosophy context for transformation tools
 *
 * Shows phenomenological grounding and links to humanizer.com docs
 * Mobile-responsive with clean, accessible design
 */
export function PhilosophyTooltip({ title, description, learnMoreUrl }: PhilosophyTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-t border-slate-700">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 sm:px-4 py-2 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left"
        aria-expanded={isOpen}
        aria-label="Toggle philosophy context"
      >
        <span className="text-xs sm:text-sm font-medium text-purple-400 flex items-center gap-1.5">
          <span>📖</span>
          <span className="hidden sm:inline">Philosophy</span>
          <span className="sm:hidden">Why?</span>
        </span>
        <svg
          className={`w-4 h-4 text-purple-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Philosophy Content */}
      {isOpen && (
        <div className="px-3 sm:px-4 py-3 bg-purple-900/10 border-t border-purple-700/30">
          <div className="space-y-2">
            <p className="text-xs sm:text-sm font-semibold text-purple-200">
              {title}
            </p>
            <p className="text-xs sm:text-sm text-purple-300/90 leading-relaxed">
              {description}
            </p>
            {learnMoreUrl && (
              <a
                href={learnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 hover:underline mt-2"
              >
                <span>Learn more</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
