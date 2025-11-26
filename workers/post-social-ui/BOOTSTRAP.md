# Post-Social UI - Phase 1 Bootstrap

## Setup Instructions

This document contains everything needed to bootstrap the new properly-architected Post-Social frontend.

### 1. Create Project Structure

```bash
cd ~/humanizer_root/workers
mkdir -p post-social-ui
cd post-social-ui

# Create directory structure
mkdir -p src/{config,styles,types,services,stores,hooks,pages,utils}
mkdir -p src/components/{layout,post,comment,synthesis,search,content,ui}
mkdir -p public/assets/{icons,fonts}
```

### 2. Initialize Project

Save the following files in the project root:

#### package.json
```json
{
  "name": "post-social-ui",
  "version": "1.0.0",
  "description": "Post-Social Network - Synthesis over Engagement",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && wrangler pages deploy dist",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "solid-js": "^1.8.0",
    "marked": "^11.0.0",
    "katex": "^0.16.9",
    "diff": "^5.1.0"
  },
  "devDependencies": {
    "@types/katex": "^0.16.7",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3",
    "vite": "^5.0.10",
    "vite-plugin-solid": "^2.8.2",
    "wrangler": "^3.19.0"
  }
}
```

#### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,

    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "jsxImportSource": "solid-js",

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/config/*": ["./src/config/*"],
      "@/styles/*": ["./src/styles/*"],
      "@/types/*": ["./src/types/*"],
      "@/services/*": ["./src/services/*"],
      "@/stores/*": ["./src/stores/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/components/*": ["./src/components/*"],
      "@/pages/*": ["./src/pages/*"],
      "@/utils/*": ["./src/utils/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

#### tsconfig.node.json
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

#### vite.config.ts
```typescript
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import path from 'path';

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/config': path.resolve(__dirname, './src/config'),
      '@/styles': path.resolve(__dirname, './src/styles'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/utils': path.resolve(__dirname, './src/utils'),
    },
  },
  server: {
    port: 5174,
  },
  build: {
    target: 'esnext',
  },
});
```

#### wrangler.toml
```toml
name = "post-social-ui"
compatibility_date = "2024-11-24"
pages_build_output_dir = "./dist"
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Create Core Files

I'll create each file in the next message to keep this organized.

### 5. Run Development Server

```bash
npm run dev
```

Visit: http://localhost:5174

### 6. Deploy to Cloudflare Pages

```bash
npm run deploy
```

---

## Architecture Overview

### Philosophy

**Synthesis over Engagement. Understanding over Virality.**

This isn't social media - it's a conferencing environment for authentic discourse where:
- Posts evolve through synthesis (Git for ideas)
- AI curates for quality, not engagement  
- Semantic search discovers meaning, not popularity
- Discussion transforms content (version control)

### Three-Panel Layout

```
┌─────────────────────────────────────────────────┐
│              Header / Navigation                │
├──────────┬──────────────────────────┬───────────┤
│          │                          │           │
│  Left    │     Main Content         │   Right   │
│  Panel   │                          │   Panel   │
│          │   Tabs: Feed | Post      │           │
│  - Nav   │         | Search         │  - Meta   │
│  - Tags  │                          │  - Tools  │
│  - Tools │                          │  - Info   │
│          │                          │           │
│ (resize) │                          │ (resize)  │
└──────────┴──────────────────────────┴───────────┘
```

### Key Principles

**From Narrative Studio Lessons:**
✅ Three-pane with collapsible panels
✅ Tab system for context switching
✅ Centralized theming (CSS variables)
✅ Resizable panels with localStorage
✅ Light/Dark mode
✅ Component isolation

❌ NO inline styles everywhere
❌ NO helper functions duplicating CSS
❌ NO complex nested JSX
❌ NO inconsistent patterns
❌ NO magic numbers in components
❌ NO configuration scattered

**Separation of Concerns:**
- Theme defined in `config/theme.ts`
- CSS variables in `styles/variables.css`
- Component styles in `styles/components.css`
- NO inline styles unless dynamic
- NO CSS in TypeScript files
- NO magic numbers - all from config

### Technology Stack

- **SolidJS** - Reactive, performant, less boilerplate than React
- **Vite** - Fast dev server, optimized builds
- **TypeScript** - Type safety throughout
- **CSS Modules** - Scoped styles, no runtime cost
- **Marked** - Markdown parsing
- **KaTeX** - LaTeX rendering

---

## Next Steps

Continue to the next file for the core source files.
