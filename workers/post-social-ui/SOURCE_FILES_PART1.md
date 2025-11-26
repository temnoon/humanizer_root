# Post-Social UI - Source Files (Part 1: Config & Styles)

## Configuration Files

### src/config/theme.ts

```typescript
/**
 * Post-Social Design System
 * 
 * Centralized theme configuration.
 * All colors, spacing, typography defined here.
 * CSS variables generated from this config.
 */

export const theme = {
  colors: {
    // Light mode
    light: {
      primary: '#0891b2',        // Cyan-600 - Main brand color
      accent: '#8b5cf6',         // Purple-500 - Synthesis/AI features
      success: '#10b981',        // Green-500 - Approved versions
      warning: '#f59e0b',        // Amber-500 - Pending/attention
      error: '#ef4444',          // Red-500 - Errors/rejected
      
      text: {
        primary: '#111827',      // Gray-900 - Main text
        secondary: '#6b7280',    // Gray-500 - Meta/secondary
        tertiary: '#9ca3af',     // Gray-400 - Disabled/placeholder
      },
      
      bg: {
        primary: '#ffffff',      // Main background
        secondary: '#f9fafb',    // Gray-50 - Subtle sections
        tertiary: '#f3f4f6',     // Gray-100 - Input backgrounds
        card: '#ffffff',         // Card backgrounds
      },
      
      border: '#e5e7eb',         // Gray-200 - Borders
    },
    
    // Dark mode
    dark: {
      primary: '#22d3ee',        // Cyan-400
      accent: '#a78bfa',         // Purple-400
      success: '#34d399',        // Green-400
      warning: '#fbbf24',        // Amber-400
      error: '#f87171',          // Red-400
      
      text: {
        primary: '#f9fafb',      // Gray-50
        secondary: '#d1d5db',    // Gray-300
        tertiary: '#9ca3af',     // Gray-400
      },
      
      bg: {
        primary: '#111827',      // Gray-900
        secondary: '#1f2937',    // Gray-800
        tertiary: '#374151',     // Gray-700
        card: '#1f2937',
      },
      
      border: '#374151',         // Gray-700
    },
  },
  
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
    '3xl': '4rem',   // 64px
  },
  
  typography: {
    fontFamily: {
      sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      mono: '"SF Mono", "Courier New", monospace',
    },
    
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
    },
    
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
      loose: 2,
    },
  },
  
  animation: {
    duration: {
      fast: '150ms',
      normal: '250ms',
      slow: '350ms',
    },
    
    easing: {
      linear: 'linear',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  
  borderRadius: {
    sm: '0.25rem',   // 4px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    full: '9999px',  // Pill shape
  },
  
  layout: {
    maxWidth: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      content: '65ch',  // Optimal reading width
    },
    
    panel: {
      minWidth: '200px',
      maxWidth: '600px',
      defaultWidth: '300px',
    },
    
    header: {
      height: '4rem',  // 64px
    },
  },
  
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1020,
    modal: 1030,
    popover: 1040,
    toast: 1050,
  },
} as const;

export type Theme = typeof theme;
export type ThemeMode = 'light' | 'dark';
```

### src/config/constants.ts

```typescript
/**
 * Application Constants
 * 
 * All magic numbers, URLs, limits defined here.
 * NO hardcoded values in components.
 */

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://post-social-api.tem-527.workers.dev';
export const AUTH_API_URL = import.meta.env.VITE_AUTH_URL || 'https://npe-api.tem-527.workers.dev';

// Content Limits
export const LIMITS = {
  post: {
    minLength: 20,      // words
    maxLength: 5000,    // characters
  },
  comment: {
    minLength: 1,       // words
    maxLength: 2000,    // characters
  },
  search: {
    minQueryLength: 2,
    maxResults: 50,
    debounceMs: 500,
  },
} as const;

// Synthesis Configuration
export const SYNTHESIS = {
  commentThreshold: 5,     // Auto-trigger after N comments
  versionRetention: 50,    // Keep last N versions
} as const;

// UI Configuration
export const UI = {
  toastDuration: 5000,     // ms
  modalAnimationDuration: 250, // ms
  infiniteScrollThreshold: 200, // px from bottom
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  theme: 'post-social:theme',
  token: 'post-social:token',
  user: 'post-social:user',
  panelWidths: 'post-social:panel-widths',
  preferences: 'post-social:preferences',
} as const;

// Feature Flags
export const FEATURES = {
  synthesis: true,
  semanticSearch: true,
  realTimeUpdates: false,  // Future: WebSocket
  aiCurator: false,        // Future: AI responds to comments
} as const;
```

### src/config/routes.ts

```typescript
/**
 * Route Definitions
 */

export const ROUTES = {
  home: '/',
  login: '/login',
  dashboard: '/dashboard',
  post: (id: string) => `/post/${id}`,
  search: '/search',
  profile: '/profile',
  settings: '/settings',
} as const;
```

---

## Style Files

### src/styles/index.css

```css
/* Main stylesheet - imports all other styles */

@import './reset.css';
@import './variables.css';
@import './typography.css';
@import './layout.css';
@import './components.css';
@import './utilities.css';

/* Third-party CSS */
@import 'katex/dist/katex.min.css';
```

### src/styles/reset.css

```css
/**
 * Modern CSS Reset
 * Normalize browser inconsistencies
 */

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  min-height: 100vh;
  line-height: 1.5;
}

img, picture, video, canvas, svg {
  display: block;
  max-width: 100%;
}

input, button, textarea, select {
  font: inherit;
}

p, h1, h2, h3, h4, h5, h6 {
  overflow-wrap: break-word;
}

button {
  cursor: pointer;
  background: none;
  border: none;
}

a {
  color: inherit;
  text-decoration: none;
}
```

### src/styles/variables.css

```css
/**
 * CSS Variables
 * Generated from theme.ts config
 */

:root {
  /* Colors - Light Mode */
  --color-primary: #0891b2;
  --color-accent: #8b5cf6;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-text-tertiary: #9ca3af;
  
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f9fafb;
  --color-bg-tertiary: #f3f4f6;
  --color-bg-card: #ffffff;
  
  --color-border: #e5e7eb;
  
  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  --space-3xl: 4rem;
  
  /* Typography */
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "SF Mono", "Courier New", monospace;
  
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;
  
  --weight-normal: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;
  --line-height-loose: 2;
  
  /* Animation */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
  
  --ease-linear: linear;
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;
  
  /* Layout */
  --max-width-content: 65ch;
  --panel-min-width: 200px;
  --panel-max-width: 600px;
  --panel-default-width: 300px;
  --header-height: 4rem;
  
  /* Z-Index */
  --z-base: 0;
  --z-dropdown: 1000;
  --z-sticky: 1020;
  --z-modal: 1030;
  --z-popover: 1040;
  --z-toast: 1050;
}

[data-theme="dark"] {
  --color-primary: #22d3ee;
  --color-accent: #a78bfa;
  --color-success: #34d399;
  --color-warning: #fbbf24;
  --color-error: #f87171;
  
  --color-text-primary: #f9fafb;
  --color-text-secondary: #d1d5db;
  --color-text-tertiary: #9ca3af;
  
  --color-bg-primary: #111827;
  --color-bg-secondary: #1f2937;
  --color-bg-tertiary: #374151;
  --color-bg-card: #1f2937;
  
  --color-border: #374151;
}
```

---

Continue to SOURCE_FILES_PART2.md for components and pages.
