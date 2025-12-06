# Humanizer UI

**Unified interface that works anywhere - local or cloud**

## What is this?

The Humanizer UI is a hybrid React application that can run:
- 🖥️ **As an Electron desktop app** (with full local archive access)
- ☁️ **As a web app** (deployed to Cloudflare Pages)
- 🔄 **In both modes** with seamless switching between local and cloud APIs

## Key Features

### Multi-Source Input
- **Local Archives** (Electron): OpenAI export, Facebook/Instagram archives
- **Folder Browser** (Electron): Browse and import local files
- **Paste Content**: Direct text import
- **Project Gutenberg**: Public domain books
- **Node Network**: Browse post-social nodes
- **Book Builder**: Collect and organize project assets

### Hybrid Tools
- **Local Transformations** (Electron + Ollama):
  - Computer Humanizer
  - Round-Trip Translation

- **Cloud Transformations** (Cloudflare AI):
  - AI Detection
  - Persona & Style
  - Semantic Search
  - Curator Chat

### Privacy-First Design
- **Local Mode**: All processing on-device, archives never leave your machine
- **Cloud Mode**: Advanced AI with explicit privacy warnings
- **Privacy Indicator**: Always visible in header
- **Zero-Trust Archives**: Client-side encryption planned

## Quick Start

### Web Development
```bash
npm install
npm run dev
```
Runs on `http://localhost:5174`

### Electron Development
```bash
npm install
npm run dev:electron
```

### Build for Web (Cloudflare Pages)
```bash
npm run build:web
npm run deploy
```

### Build for Desktop (Electron)
```bash
npm run build:electron
```
Creates installers in `dist-electron/`

## Architecture

### Environment Detection
The app automatically detects whether it's running in Electron or a browser and adapts:

```typescript
const { environment, provider, features, api } = useEnvironment();

// environment: 'electron' | 'web'
// provider: 'local' | 'cloudflare'
// features: { localArchives, localTransforms, ... }
// api: { archive, npe, postSocial }
```

### API Routing
APIs are automatically routed based on provider:

**Local Provider**:
- Archive API: `http://localhost:3002` (Electron only)
- NPE API: `http://localhost:8787`
- Post-Social API: `http://localhost:8788`

**Cloudflare Provider**:
- NPE API: `https://npe-api.tem-527.workers.dev`
- Post-Social API: `https://post-social-api.tem-527.workers.dev`

### 3-Panel Layout

**Flexible and user-controlled:**
- **Resizable panels** - Drag dividers to resize (200-600px range)
- **Collapsible panels** - Click chevrons to collapse/expand (`⌘B` left, `⌘\` right)
- **Focus mode** - Full-screen workspace (`⌘⇧F`)
- **Layout persistence** - Your preferences are saved

```
┌────────────┬──────────────────┬────────────┐
│   INPUT    │    WORKSPACE     │   TOOLS    │
│  Sources   │  Viewer/Editor   │  Transform │
│  [resize→] │  [←resize→]      │  [←resize] │
│            │                  │            │
│  📂 Local  │  📄 Welcome      │  🔄 Xforms │
│  📋 Paste  │  👁️ Viewer       │  📊 Analysis│
│  📚 Books  │  ✏️ Editor       │  🌐 Network│
│  🌐 Network│                  │  📖 Books  │
└────────────┴──────────────────┴────────────┘
```

See [LAYOUT_GUIDE.md](./LAYOUT_GUIDE.md) for full layout control documentation.

## Project Structure

```
humanizer-ui/
├── src/
│   ├── components/
│   │   ├── input/          # Input source selectors
│   │   ├── workspace/      # Content viewer/editor
│   │   ├── tools/          # Transformation tools
│   │   ├── Header.tsx      # Top bar with provider switcher
│   │   └── Layout.tsx      # 3-panel layout
│   ├── contexts/
│   │   ├── EnvironmentContext.tsx  # Env detection + API routing
│   │   └── ThemeContext.tsx        # Light/dark/system theme
│   ├── services/
│   │   ├── api/            # API clients
│   │   └── parsers/        # Archive parsers
│   ├── styles/
│   │   ├── variables.css   # Design system
│   │   └── index.css       # Global styles
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── icon.svg
├── electron/               # Electron main process (TODO)
├── package.json
├── vite.config.ts
└── README.md
```

## Next Steps

### Immediate Priorities
1. ✅ Foundation + hybrid architecture
2. ✅ Environment detection
3. ✅ 3-panel layout
4. ⏳ Complete input source implementations
5. ⏳ Buffer system (from narrative-studio)
6. ⏳ Tool implementations
7. ⏳ Book Builder project manager
8. ⏳ Electron main process
9. ⏳ Parser integration (OpenAI, Facebook, Instagram)

### Future Enhancements
- Session persistence across restarts
- Real-time collaboration features
- Advanced book layout editor
- Export to multiple formats
- Plugin system for custom tools

## Design Philosophy

**"Build once, run anywhere"**

This isn't two separate codebases (Electron + Web). It's one React app that adapts to its environment:
- Same components
- Same business logic
- Same design system
- Different capabilities based on runtime

**Privacy by default, cloud by choice**

Local processing is the default. Cloud processing is opt-in with clear warnings. Users always know where their data goes.

**Progressive enhancement**

The web version works great. The Electron version adds local archive access, Ollama integration, and privacy guarantees.

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Electron** - Desktop wrapper
- **CSS Variables** - Themeable design system

## License

Proprietary - humanizer.com
