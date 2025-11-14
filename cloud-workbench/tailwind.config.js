export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],

  // Use 'selector' mode with [data-theme] attribute (not 'media')
  darkMode: ['selector', '[data-theme="dark"]'],

  theme: {
    // Disable ALL color utilities - we use CSS variables only
    colors: {},
    backgroundColor: {},
    textColor: {},
    borderColor: {},

    // Keep spacing, sizing, and layout utilities
    extend: {
      // These are fine - they're not colors
    }
  },

  // Explicitly disable color-related utilities
  corePlugins: {
    // Disable all color utilities
    backgroundColor: false,
    backgroundOpacity: false,
    textColor: false,
    textOpacity: false,
    borderColor: false,
    borderOpacity: false,
    placeholderColor: false,
    placeholderOpacity: false,
    divideColor: false,
    divideOpacity: false,
    ringColor: false,
    ringOpacity: false,
    ringOffsetColor: false,
    gradientColorStops: false,

    // Keep everything else (layout, spacing, flexbox, grid, etc.)
  },

  plugins: [],
};
