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
};
