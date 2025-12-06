// Simple icon components using Unicode/SVG
// These can be replaced with a proper icon library later

export const Icons = {
  Menu: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 4h16M2 10h16M2 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Close: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Archive: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <rect x="2" y="4" width="16" height="14" rx="2" strokeWidth="2" />
      <path d="M2 8h16" strokeWidth="2" />
      <path d="M8 12h4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Tools: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path d="M10 2v16M2 10h16" strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="10" r="3" strokeWidth="2" />
    </svg>
  ),

  Sun: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <circle cx="10" cy="10" r="4" strokeWidth="2" />
      <path d="M10 2v2M10 16v2M18 10h-2M4 10H2M15.66 4.34l-1.41 1.41M5.75 14.25l-1.41 1.41M15.66 15.66l-1.41-1.41M5.75 5.75L4.34 4.34" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Moon: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
    </svg>
  ),

  Edit: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path d="M14 6l-8 8-4 1 1-4 8-8 3 3zM11 3l3-3 3 3-3 3-3-3z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  Eye: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z" strokeWidth="2" />
      <circle cx="10" cy="10" r="3" strokeWidth="2" />
    </svg>
  ),

  Play: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M5 3l12 7-12 7V3z" />
    </svg>
  ),

  Search: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <circle cx="8" cy="8" r="6" strokeWidth="2" />
      <path d="M13 13l5 5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Image: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <rect x="2" y="2" width="16" height="16" rx="2" strokeWidth="2" />
      <circle cx="7" cy="7" r="2" strokeWidth="2" />
      <path d="M18 13l-4-4-6 6-4-4-2 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  ArrowLeft: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path d="M15 10H5M5 10l4 4M5 10l4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  ChevronLeft: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path d="M13 16l-6-6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  Split: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <rect x="2" y="3" width="16" height="14" rx="1" strokeWidth="2" />
      <path d="M10 3v14" strokeWidth="2" />
    </svg>
  ),

  Tabs: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <rect x="2" y="7" width="16" height="10" rx="1" strokeWidth="2" />
      <path d="M2 7h5v-2h0a1 1 0 011-1h4a1 1 0 011 1h0v2h5" strokeWidth="2" />
    </svg>
  ),

  Copy: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" strokeWidth="2" />
      <path d="M14 6V4a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h2" strokeWidth="2" />
    </svg>
  ),

  Code: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path d="M6 6L2 10l4 4M14 6l4 4-4 4M8 16l4-12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  Check: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path d="M4 10l4 4 8-8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  Highlight: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path d="M12 2l6 6-10 10H2v-6L12 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 18h18" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Settings: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      {/* Gear/Cog icon */}
      <circle cx="12" cy="12" r="3" strokeWidth="2" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};
