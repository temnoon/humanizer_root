# Humanizer Narrative Studio

A thoughtful workspace for reading, analyzing, and transforming narratives.

## Features

- **Rich Markdown Rendering**: Full support for headings, lists, tables, code blocks with syntax highlighting, LaTeX equations (inline and display), and images
- **Dual View Modes**: Toggle between rendered and markdown edit views for any narrative
- **Split-Pane Workspace**: Side-by-side comparison of original and transformed narratives
- **Archive Management**: Browse, search, and filter narratives with tags
- **Transformation Tools**:
  - Computer Humanizer (remove AI tell-words, improve naturalness)
  - Allegorical Transformation (phenomenological perspective shifts)
  - AI Detection (analyze text for AI patterns)
- **Light/Dark Themes**: Automatic theme detection with manual toggle
- **Mobile-First Responsive**: Works seamlessly on all device sizes
- **Extensible Architecture**: Easy to add new transformation tools

## Tech Stack

- **React 19** + **TypeScript**
- **Vite 7** (fast build tooling)
- **Tailwind CSS 4** (utility-first styling with CSS variables)
- **react-markdown** (markdown rendering)
- **KaTeX** (LaTeX math rendering)
- **highlight.js** (code syntax highlighting)

## Typography

- **Body Text**: Crimson Text (serif, editorial feel)
- **UI Elements**: DM Sans (sans-serif, clean)
- **Code**: SF Mono / Monaco / Cascadia Code (monospace)

Fonts are easily switchable via CSS variables in `src/index.css`:
```css
:root {
  --font-body: 'Crimson Text', Georgia, serif;
  --font-ui: 'DM Sans', system-ui, sans-serif;
  --font-mono: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}
```

## Project Structure

```
narrative-studio/
├── src/
│   ├── components/
│   │   ├── layout/         # TopBar, ThemeToggle, Icons
│   │   ├── panels/         # ArchivePanel, ToolsPanel
│   │   ├── workspace/      # MainWorkspace (split-pane logic)
│   │   └── markdown/       # MarkdownRenderer, MarkdownEditor
│   ├── contexts/           # ThemeContext
│   ├── utils/              # API client, utilities
│   ├── types/              # TypeScript type definitions
│   ├── data/               # Sample narratives
│   ├── App.tsx             # Main application
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles + theme variables
├── public/                 # Static assets
├── index.html              # HTML template with theme detection
├── package.json
├── vite.config.ts
├── wrangler.toml           # Cloudflare Pages config
└── README.md
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API URL (Optional)

Copy `.env.example` to `.env` and set your API base URL:

```bash
cp .env.example .env
# Edit .env to set VITE_API_BASE_URL
```

Default API: `https://npe-api.tem-527.workers.dev`

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

**First-Time Login:**
- Email: `demo@humanizer.com`
- Password: `testpass123`
- Or click "Use Demo Account" button

The app will show a login screen on first visit. After authentication, you'll have access to all features.

### 4. Build for Production

```bash
npm run build
```

Output will be in `dist/`.

## Deployment

### Cloudflare Pages

```bash
npm run build
npx wrangler pages deploy dist --project-name=narrative-studio --commit-dirty=true
```

### Other Platforms

The build output in `dist/` is a static site that can be deployed to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Any static hosting service

## API Integration

The app integrates with the Humanizer API (`npe-api` Cloudflare Workers backend).

### Endpoints Used

- `POST /transformations/computer-humanizer` - Computer Humanizer transformation
- `POST /transformations/allegorical` - Allegorical transformation
- `POST /transformations/ai-detection` - AI detection analysis
- `GET /archive/conversations` - List encrypted conversations
- `POST /archive/upload` - Upload conversation archive

### Authentication

The app features a complete authentication system with login UI and session management.

**Login Flow:**
1. On first visit, users see a login page
2. Enter credentials (or click "Use Demo Account")
3. App authenticates with JWT tokens
4. Token stored in localStorage for persistence
5. Automatic re-authentication on page reload

**Demo Credentials:**
- Email: `demo@humanizer.com`
- Password: `testpass123`
- Role: PRO (full access to all features)

**User Session:**
- User info displayed in top-right corner
- Dropdown menu shows email and role
- "Sign Out" button clears session
- Auth state managed via React Context

**API Client Usage:**

```typescript
import { api } from './utils/api';

// Login programmatically
await api.login('demo@humanizer.com', 'testpass123');

// Check auth status
const isAuth = api.isAuthenticated();

// Get current user
const user = await api.me();

// Logout
await api.logout();

// Run transformation (requires authentication)
const result = await api.runTransformation(text, {
  type: 'computer-humanizer',
  parameters: { intensity: 'moderate' },
});
```

**Components:**
- `src/contexts/AuthContext.tsx` - Authentication state management
- `src/components/auth/LoginPage.tsx` - Login UI
- `src/components/layout/TopBar.tsx` - User menu and logout

### Adding New Transformations

1. Add type to `src/types/index.ts`:
   ```typescript
   export type TransformationType =
     | 'computer-humanizer'
     | 'allegorical'
     | 'ai-detection'
     | 'new-tool'; // Add here
   ```

2. Update API client (`src/utils/api.ts`):
   ```typescript
   private getTransformEndpoint(type: TransformConfig['type']): string {
     switch (type) {
       // ... existing cases
       case 'new-tool':
         return '/transformations/new-tool';
     }
   }
   ```

3. Add UI in `src/components/panels/ToolsPanel.tsx`:
   ```typescript
   const TRANSFORM_TYPES = [
     // ... existing types
     {
       value: 'new-tool',
       label: 'New Tool',
       description: 'Description of new tool',
     },
   ];
   ```

## Sample Narratives

The app includes 6 sample narratives demonstrating all features:

1. **Simple** - Plain text
2. **Structure** - Headings, lists, nested lists
3. **Technical** - Code blocks, tables
4. **Mathematics** - LaTeX equations (inline and display)
5. **Comprehensive** - All features combined
6. **AI Conversation** - Realistic AI chat export

Located in `src/data/narratives/`.

## Theme Customization

All colors are defined as CSS variables in `src/index.css`:

```css
:root {
  /* Light theme */
  --bg-primary: #fafaf9;
  --text-primary: #1c1917;
  --accent-primary: #7c3aed;
  /* ... */
}

[data-theme='dark'] {
  /* Dark theme */
  --bg-primary: #1c1917;
  --text-primary: #fafaf9;
  --accent-primary: #a78bfa;
  /* ... */
}
```

To change the color scheme, simply edit these variables.

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

MIT
