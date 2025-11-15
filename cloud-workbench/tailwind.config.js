export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],

  // DaisyUI uses data-theme attribute for theme switching
  darkMode: ['selector', '[data-theme="dark"]'],

  theme: {
    extend: {
      // Keep any custom extensions here
    }
  },

  plugins: [
    require('daisyui'),
  ],

  // DaisyUI configuration
  daisyui: {
    themes: [
      {
        light: {
          "primary": "#7c3aed",           // Purple
          "primary-content": "#ffffff",   // White text on purple
          "secondary": "#6b7280",         // Gray
          "accent": "#06b6d4",            // Cyan
          "neutral": "#1f2937",           // Dark gray
          "base-100": "#ffffff",          // White background
          "base-200": "#f9fafb",          // Light gray background
          "base-300": "#f3f4f6",          // Lighter gray
          "base-content": "#111827",      // Dark text
          "info": "#0891b2",              // Cyan
          "success": "#059669",           // Green
          "warning": "#d97706",           // Yellow/orange
          "error": "#dc2626",             // Red
        },
        dark: {
          "primary": "#a78bfa",           // Light purple
          "primary-content": "#ffffff",   // White text on purple
          "secondary": "#6b7280",         // Gray
          "accent": "#60a5fa",            // Light cyan
          "neutral": "#1f2937",           // Dark gray
          "base-100": "#0a0e14",          // Very dark background
          "base-200": "#15191f",          // Dark gray background
          "base-300": "#1f2937",          // Medium dark gray
          "base-content": "#f3f4f6",      // Light text
          "info": "#06b6d4",              // Cyan
          "success": "#34d399",           // Green
          "warning": "#fbbf24",           // Yellow
          "error": "#dc2626",             // Red
        },
      },
    ],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
  },
};
