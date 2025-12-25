# Humanizer Style Guide

**Version**: 0.1.0
**Philosophy**: The interface is a semifictional space—a threshold between the archive and the self. Every visual choice should support contemplation, not distraction.

---

## Core Principles

### 1. ZERO TOLERANCE for Hardcoded Styles

**NEVER** write inline styles or CSS values directly in component code.

```tsx
// FORBIDDEN
<div style={{ padding: '16px', color: '#666' }}>

// FORBIDDEN
<div className="p-4 text-gray-600">  // Utility classes with values

// CORRECT
<div className="container-primary text-secondary">
```

Every visual property flows from the token system. No exceptions.

### 2. Semantic Naming (Never Values in Names)

Names describe **function**, not appearance.

```css
/* FORBIDDEN - describes appearance */
.red-background { }
.large-text { }
.margin-16 { }

/* CORRECT - describes function */
.surface-error { }
.text-heading { }
.spacing-section { }
```

### 3. Mode-First Architecture

Every color, every shadow, every visual property MUST work in:
- Light mode (system default)
- Dark mode (system preference)
- Future modes: sepia, high-contrast, reduced-motion

```css
/* The system respects prefers-color-scheme automatically */
:root { /* light mode tokens */ }
@media (prefers-color-scheme: dark) { :root { /* dark overrides */ } }

/* Manual override via data attribute */
[data-theme="dark"] { /* forced dark */ }
[data-theme="light"] { /* forced light */ }
```

### 4. HSL Palette Generation

All colors are defined in HSL for programmatic light/dark variant generation.

```css
--color-primary-h: 220;    /* Hue */
--color-primary-s: 70%;    /* Saturation */
--color-primary-l: 50%;    /* Lightness */

/* Computed values */
--color-primary: hsl(var(--color-primary-h), var(--color-primary-s), var(--color-primary-l));
--color-primary-light: hsl(var(--color-primary-h), var(--color-primary-s), 70%);
--color-primary-dark: hsl(var(--color-primary-h), var(--color-primary-s), 30%);
```

### 5. Contrast Requirements

**WCAG AA Minimum** (required):
- Normal text: 4.5:1 contrast ratio
- Large text (18px+ or 14px bold): 3:1
- UI components: 3:1

**WCAG AAA Target** (preferred):
- Normal text: 7:1
- Large text: 4.5:1

Check every text/background combination. No exceptions.

---

## Token Hierarchy

### Spacing Scale

Based on 4px grid. Use semantic names.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-hair` | 1px | Borders, dividers |
| `--space-micro` | 2px | Icon gaps |
| `--space-tiny` | 4px | Tight spacing |
| `--space-small` | 8px | Component internal |
| `--space-medium` | 16px | Standard gaps |
| `--space-large` | 24px | Section spacing |
| `--space-xlarge` | 32px | Major sections |
| `--space-huge` | 48px | Page-level |
| `--space-massive` | 64px | Hero areas |

### Typography Scale

| Token | Usage |
|-------|-------|
| `--text-micro` | Labels, captions |
| `--text-small` | Secondary content |
| `--text-body` | Primary reading |
| `--text-large` | Emphasis |
| `--text-heading-3` | Subsection titles |
| `--text-heading-2` | Section titles |
| `--text-heading-1` | Page titles |
| `--text-display` | Hero statements |

### Semantic Colors

| Token | Purpose |
|-------|---------|
| `--color-text-primary` | Main readable text |
| `--color-text-secondary` | Supporting text |
| `--color-text-tertiary` | Disabled/muted |
| `--color-text-inverse` | Text on dark surfaces |
| `--color-surface-primary` | Main background |
| `--color-surface-secondary` | Cards, panels |
| `--color-surface-elevated` | Modals, dropdowns |
| `--color-border-subtle` | Soft divisions |
| `--color-border-strong` | Clear boundaries |
| `--color-accent-primary` | Interactive elements |
| `--color-accent-secondary` | Secondary actions |
| `--color-status-success` | Positive outcomes |
| `--color-status-warning` | Caution states |
| `--color-status-error` | Error states |
| `--color-status-info` | Informational |

### Functional Colors (Humanizer-Specific)

| Token | Purpose |
|-------|---------|
| `--color-sic-high` | High SIC score (strong human trace) |
| `--color-sic-medium` | Medium SIC score |
| `--color-sic-low` | Low SIC score (machine-like) |
| `--color-density-high` | Dense semantic content |
| `--color-density-low` | Sparse content |
| `--color-curator-voice` | Curator's observations |
| `--color-archive-source` | Imported content markers |

---

## Component Patterns

### Surface Hierarchy

```
Level 0: --color-surface-primary     (page background)
Level 1: --color-surface-secondary   (cards, panels)
Level 2: --color-surface-elevated    (modals, popovers)
Level 3: --color-surface-floating    (tooltips, menus)
```

### Interactive States

Every interactive element needs these states:
- Default
- Hover (`:hover`)
- Focus (`:focus-visible`) - ALWAYS visible for keyboard nav
- Active (`:active`)
- Disabled (`[disabled]`, `[aria-disabled="true"]`)

### Touch Targets

Minimum 44x44px for all interactive elements (WCAG 2.5.5).

```css
.interactive {
  min-height: var(--touch-target, 44px);
  min-width: var(--touch-target, 44px);
}
```

---

## Animation & Motion

### Reduced Motion

Always respect user preference:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Timing Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-instant` | 50ms | Micro-interactions |
| `--duration-fast` | 150ms | Buttons, toggles |
| `--duration-normal` | 250ms | Standard transitions |
| `--duration-slow` | 400ms | Large movements |
| `--duration-deliberate` | 600ms | Page transitions |

### Easing

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-out` | cubic-bezier(0, 0, 0.2, 1) | Entering |
| `--ease-in` | cubic-bezier(0.4, 0, 1, 1) | Exiting |
| `--ease-in-out` | cubic-bezier(0.4, 0, 0.2, 1) | Moving |

---

## Responsive Breakpoints

Mobile-first. Always.

| Token | Width | Device |
|-------|-------|--------|
| base | 0-319px | Not supported |
| `--bp-mobile` | 320px+ | Small phones |
| `--bp-mobile-large` | 480px+ | Large phones |
| `--bp-tablet` | 768px+ | Tablets |
| `--bp-desktop` | 1024px+ | Laptops |
| `--bp-desktop-large` | 1280px+ | Desktops |
| `--bp-wide` | 1536px+ | Wide monitors |

---

## Style Agent Protocol

The Style Agent is a specialized sub-agent that:

1. **Receives requests** from the AUI when new interface elements are conceived
2. **Consults this guide** to determine appropriate tokens and patterns
3. **Generates compliant CSS classes** that fit the existing system
4. **Validates contrast** and accessibility requirements
5. **Returns semantic class names** to the requesting agent

### Request Format

```json
{
  "element": "SIC score indicator",
  "purpose": "Show human trace intensity in analyzed text",
  "states": ["low", "medium", "high"],
  "context": "Appears in analysis results panel",
  "interactive": false
}
```

### Response Format

```json
{
  "classes": {
    "base": "sic-indicator",
    "states": {
      "low": "sic-indicator--low",
      "medium": "sic-indicator--medium",
      "high": "sic-indicator--high"
    }
  },
  "tokens_used": [
    "--color-sic-low",
    "--color-sic-medium",
    "--color-sic-high"
  ],
  "css": "/* Generated CSS to add to tokens.css */"
}
```

---

## File Organization

```
packages/ui/styles/
├── tokens.css          # All CSS custom properties
├── reset.css           # Minimal reset
├── typography.css      # Font definitions
├── utilities.css       # Semantic utility classes
├── components/         # Component-specific styles
│   ├── button.css
│   ├── input.css
│   └── ...
└── themes/
    ├── light.css       # Light mode overrides
    └── dark.css        # Dark mode overrides
```

---

## Validation Checklist

Before any UI code is merged:

- [ ] No inline styles (except dynamic calculated values)
- [ ] No CSS values in class names
- [ ] All colors use semantic tokens
- [ ] Contrast ratios verified (4.5:1 minimum)
- [ ] Light and dark modes tested
- [ ] Touch targets meet 44px minimum
- [ ] Focus states visible for all interactive elements
- [ ] Reduced motion respected
- [ ] Responsive behavior at all breakpoints

---

*"The interface should feel like a library at dusk—quiet enough to think, structured enough to find, luminous enough to read."*
