# Layout Control Guide

**Flexible, User-Controlled Screen Real Estate**

## Features

### 1. Resizable Panels ✨
**Drag the dividers** between panels to resize them:
- Hover over the vertical divider (shows purple highlight)
- Click and drag left/right to resize
- Panel widths are constrained: 200px min, 600px max
- Your sizes are automatically saved

### 2. Collapsible Panels 📦
**Click the chevron buttons** on panel edges to collapse/expand:
- **Left panel (Input)**: Click `<` button on right edge
- **Right panel (Tools)**: Click `>` button on left edge
- Collapsed panels take up zero space (maximum workspace!)

### 3. Focus Mode 🎯
**Full-screen workspace** with no distractions:
- Click the expand icon (`⤢`) in the header
- Both side panels disappear completely
- Center workspace uses 100% of screen
- Perfect for deep work

### 4. Layout Reset ⟲
**Return to default** layout anytime:
- Click the reset icon (`⟲`) in the header
- Resets all panel sizes to defaults (300px left, 350px right)
- Expands any collapsed panels
- Exits focus mode

## Keyboard Shortcuts ⌨️

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Toggle left panel | `⌘B` | `Ctrl+B` |
| Toggle right panel | `⌘\` | `Ctrl+\` |
| Toggle focus mode | `⌘⇧F` | `Ctrl+Shift+F` |

## Persistence 💾
All layout preferences are automatically saved to `localStorage`:
- Panel widths
- Collapse states
- (Note: Focus mode is **not** persisted - always starts normal)

Your layout persists across:
- Page refreshes
- Browser restarts
- Sessions

## UI Elements

### Header Controls (Right Side)
```
[🏠 Local] [🔒 Private] | [⤢] [⟲] | [☀️]
   ↑          ↑           ↑    ↑     ↑
Provider  Privacy    Focus Reset Theme
```

### Panel Controls
- **Chevron buttons**: Positioned on panel edges (50% down)
- **Hover**: Buttons become more visible
- **Active state**: Purple highlight when panel collapsed

### Resize Dividers
- **Width**: 8px (thin, unobtrusive)
- **Hover**: Purple highlight
- **Dragging**: Shows 3 dots, cursor changes to `col-resize`
- **Smooth**: Panels resize instantly as you drag

## Responsive Behavior 📱

On screens **smaller than 1024px**:
- Layout switches to **vertical stacking**
- Panels become full-width
- Side panels get max-height: 30%
- Resize dividers are hidden (not useful on mobile)
- Panel controls are hidden

## Best Practices 💡

### For Reading
- Collapse tools panel (`⌘\`)
- Expand workspace to ~80% width
- Keep input panel for quick source switching

### For Writing
- Enter focus mode (`⌘⇧F`)
- Maximum workspace, zero distractions

### For Transforming
- Keep all panels visible
- Narrow input panel to ~250px (just enough for source list)
- Wide tools panel (~400px) for transformation options

### For Exploring
- Collapse workspace, expand input + tools
- Use input to browse sources
- Use tools to run analysis

## Technical Details 🔧

### Implementation
- **Context**: `LayoutContext` manages all state
- **Components**: `Layout`, `ResizableDivider`, `PanelControls`
- **Storage**: `localStorage` with keys:
  - `humanizer-layout-left-width`
  - `humanizer-layout-right-width`
  - `humanizer-layout-left-collapsed`
  - `humanizer-layout-right-collapsed`

### Performance
- **Smooth animations**: 300ms ease transitions
- **Efficient**: Only center panel re-renders on resize
- **Instant**: Drag handles use direct DOM manipulation
- **Lightweight**: Only ~4.7 kB bundle increase

### Browser Support
- **Requires**: Modern browsers with CSS custom properties
- **Scrollbar styling**: WebKit only (Chrome, Safari, Edge)
- **Fallback**: Works fine without custom scrollbars

---

**Tip**: Try different layouts for different tasks. There's no "right" way - find what works for you!
