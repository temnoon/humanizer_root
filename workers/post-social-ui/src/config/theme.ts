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
