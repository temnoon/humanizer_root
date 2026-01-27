/**
 * WelcomeScreen - Landing view with humanizing quotes
 *
 * Displays when no content is selected. Shows rotating historical
 * quotes about humanization with keyword highlighting.
 */

import { useState, useEffect, useMemo } from 'react';
import { HISTORICAL_QUOTES, type HistoricalQuote } from '../../data/historical-quotes';

// Quote timing configuration
const QUOTE_DURATION_MS = 30000; // Total time each quote is shown
const FADE_DURATION_MS = 1200;   // Fade in/out transition (matches CSS)
const BOLD_DELAY_MS = 2500;      // Delay before keyword goes bold
const UNDERLINE_DELAY_MS = 8000; // Delay before keyword gets underlined

// Keyword patterns to highlight
const KEYWORD_PATTERN = /\b(humaniz\w*|humanis\w*|human)\b/gi;

// Animation phases for keyword
type KeywordPhase = 'italic' | 'italic-bold' | 'bold-underline';

export function WelcomeScreen() {
  // Quote rotation state
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(() =>
    Math.floor(Math.random() * HISTORICAL_QUOTES.length)
  );
  const [isQuoteFading, setIsQuoteFading] = useState(false);
  const [keywordPhase, setKeywordPhase] = useState<KeywordPhase>('italic');
  const currentQuote: HistoricalQuote = HISTORICAL_QUOTES[currentQuoteIndex];

  // Rotate quotes
  useEffect(() => {
    const interval = setInterval(() => {
      setIsQuoteFading(true);
      setTimeout(() => {
        setCurrentQuoteIndex((prev) => (prev + 1) % HISTORICAL_QUOTES.length);
        setKeywordPhase('italic'); // Reset keyword phase for new quote
        setIsQuoteFading(false);
      }, FADE_DURATION_MS);
    }, QUOTE_DURATION_MS);

    return () => clearInterval(interval);
  }, []);

  // Keyword animation phases
  useEffect(() => {
    if (isQuoteFading) return;

    // Phase 1 -> 2: italic to italic-bold
    const boldTimer = setTimeout(() => {
      setKeywordPhase('italic-bold');
    }, BOLD_DELAY_MS);

    // Phase 2 -> 3: italic-bold to bold-underline
    const underlineTimer = setTimeout(() => {
      setKeywordPhase('bold-underline');
    }, UNDERLINE_DELAY_MS);

    return () => {
      clearTimeout(boldTimer);
      clearTimeout(underlineTimer);
    };
  }, [currentQuoteIndex, isQuoteFading]);

  // Render quote text with highlighted keywords
  const renderedQuote = useMemo(() => {
    const text = currentQuote.quote;
    const parts = text.split(KEYWORD_PATTERN);
    return parts.map((part, index) => {
      if (KEYWORD_PATTERN.test(part)) {
        // Reset regex lastIndex after test
        KEYWORD_PATTERN.lastIndex = 0;
        return (
          <span
            key={index}
            className={`welcome-screen__keyword welcome-screen__keyword--${keywordPhase}`}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  }, [currentQuote.quote, keywordPhase]);

  return (
    <div
      className="workspace workspace--empty welcome-screen"
      role="region"
      aria-label="Welcome to Humanizer Studio"
    >
      <div className="workspace__placeholder">
        {/* Hero text */}
        <h1 className="welcome-screen__hero">
          <span className="welcome-screen__hero-line">Give Yourself Enough</span>
          <span className="welcome-screen__hero-line">Respect to</span>
          <span className="welcome-screen__hero-line welcome-screen__hero-line--emphasis">
            Humanize Yourself
          </span>
        </h1>
        <p className="workspace__tagline">A Tool for Reclaiming Your Life's Stories</p>

        {/* Historical quote rotation */}
        <div
          className={`welcome-screen__quote ${isQuoteFading ? 'welcome-screen__quote--fading' : ''}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <blockquote className="welcome-screen__quote-text">
            "{renderedQuote}"
          </blockquote>
          <cite className="welcome-screen__quote-attribution">
            — {currentQuote.author}, {currentQuote.year}
          </cite>
        </div>

        <hr className="workspace__divider" aria-hidden="true" />

        <div className="welcome-screen__instruction">
          <p>Access your archive through the AUI</p>
          <p className="welcome-screen__hint">
            Use semantic search, clusters, and harvesting to find content
          </p>
        </div>

        <p className="welcome-screen__nav-hint">
          Press Tab to access navigation
        </p>
      </div>
    </div>
  );
}
