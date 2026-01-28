/**
 * Export Templates for Drafting Service
 *
 * Theme-aware HTML generation with support for:
 * - System color scheme detection (prefers-color-scheme)
 * - Humanizer brand colors
 * - Custom section styling (failure cards, convergence highlights, etc.)
 * - Table of contents generation
 *
 * @module @humanizer/core/aui/service/export-templates
 */

import type {
  HtmlTheme,
  ThemeColors,
  SectionStyle,
  ExportConfig,
  DraftingSession,
} from '../types/drafting-types.js';

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT THEMES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Humanizer brand light colors (matches humanizer-gm/platinum GUI).
 */
export const HUMANIZER_LIGHT_COLORS: ThemeColors = {
  bgPrimary: '#ffffff',
  bgSecondary: '#f8f9fa',
  bgTertiary: '#f1f3f4',
  textPrimary: '#1a1a2e',
  textSecondary: '#4a5568',
  textTertiary: '#718096',
  accent: '#6366f1', // Indigo
  accentHover: '#4f46e5',
  border: '#e2e8f0',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
};

/**
 * Humanizer brand dark colors (matches humanizer-gm/platinum GUI).
 */
export const HUMANIZER_DARK_COLORS: ThemeColors = {
  bgPrimary: '#1a1a2e',
  bgSecondary: '#16213e',
  bgTertiary: '#1e293b',
  textPrimary: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textTertiary: '#94a3b8',
  accent: '#818cf8', // Lighter indigo for dark mode
  accentHover: '#a5b4fc',
  border: '#334155',
  success: '#34d399',
  warning: '#fbbf24',
  error: '#f87171',
};

/**
 * Default humanizer theme with system color scheme detection.
 */
export const HUMANIZER_THEME: HtmlTheme = {
  name: 'humanizer',
  respectSystemMode: true,
  lightColors: HUMANIZER_LIGHT_COLORS,
  darkColors: HUMANIZER_DARK_COLORS,
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    headingFontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    baseFontSize: '16px',
    lineHeight: 1.7,
    maxWidth: '800px',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT SECTION STYLES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default section styles for common content patterns.
 */
export const DEFAULT_SECTION_STYLES: SectionStyle[] = [
  {
    className: 'section-failure',
    titlePattern: /failure|catastrophic|collapse|leak|broke/i,
    borderColor: 'var(--color-error)',
    backgroundColor: 'rgba(var(--color-error-rgb), 0.05)',
    badge: {
      text: '⚠ Failure',
      color: '#ffffff',
      bgColor: 'var(--color-error)',
    },
  },
  {
    className: 'section-convergence',
    titlePattern: /convergence|pattern|common|shared/i,
    borderColor: 'var(--color-warning)',
    backgroundColor: 'rgba(var(--color-warning-rgb), 0.05)',
    badge: {
      text: '↯ Pattern',
      color: '#000000',
      bgColor: 'var(--color-warning)',
    },
  },
  {
    className: 'section-success',
    titlePattern: /success|complete|achieved|working/i,
    borderColor: 'var(--color-success)',
    backgroundColor: 'rgba(var(--color-success-rgb), 0.05)',
    badge: {
      text: '✓ Success',
      color: '#ffffff',
      bgColor: 'var(--color-success)',
    },
  },
  {
    className: 'section-quote',
    contentPattern: /^>/m,
    borderColor: 'var(--color-accent)',
    backgroundColor: 'rgba(var(--color-accent-rgb), 0.03)',
  },
  {
    className: 'section-code',
    contentPattern: /```/,
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-bg-tertiary)',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// CSS GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate CSS variables for a theme.
 */
function generateCssVariables(colors: ThemeColors, prefix: string = ''): string {
  const p = prefix ? `${prefix}-` : '';
  return `
    --${p}color-bg-primary: ${colors.bgPrimary};
    --${p}color-bg-secondary: ${colors.bgSecondary};
    --${p}color-bg-tertiary: ${colors.bgTertiary};
    --${p}color-text-primary: ${colors.textPrimary};
    --${p}color-text-secondary: ${colors.textSecondary};
    --${p}color-text-tertiary: ${colors.textTertiary};
    --${p}color-accent: ${colors.accent};
    --${p}color-accent-hover: ${colors.accentHover};
    --${p}color-border: ${colors.border};
    --${p}color-success: ${colors.success};
    --${p}color-warning: ${colors.warning};
    --${p}color-error: ${colors.error};
    --${p}color-error-rgb: ${hexToRgb(colors.error)};
    --${p}color-warning-rgb: ${hexToRgb(colors.warning)};
    --${p}color-success-rgb: ${hexToRgb(colors.success)};
    --${p}color-accent-rgb: ${hexToRgb(colors.accent)};
  `;
}

/**
 * Convert hex color to RGB values.
 */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0, 0, 0';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

/**
 * Generate full CSS for a theme.
 */
export function generateThemeCss(theme: HtmlTheme, sectionStyles: SectionStyle[] = []): string {
  const styles = sectionStyles.length > 0 ? sectionStyles : DEFAULT_SECTION_STYLES;

  let css = `
    /* ═══════════════════════════════════════════════════════════════════════
       HUMANIZER EXPORT THEME: ${theme.name}
       Generated with system color scheme detection
       ═══════════════════════════════════════════════════════════════════════ */

    :root {
      ${generateCssVariables(theme.lightColors)}
      --font-family: ${theme.typography.fontFamily};
      --font-family-heading: ${theme.typography.headingFontFamily || theme.typography.fontFamily};
      --font-size-base: ${theme.typography.baseFontSize};
      --line-height: ${theme.typography.lineHeight};
      --max-width: ${theme.typography.maxWidth};
    }
  `;

  if (theme.respectSystemMode) {
    css += `
    @media (prefers-color-scheme: dark) {
      :root {
        ${generateCssVariables(theme.darkColors)}
      }
    }

    /* Manual theme override classes */
    [data-theme="light"] {
      ${generateCssVariables(theme.lightColors)}
    }

    [data-theme="dark"] {
      ${generateCssVariables(theme.darkColors)}
    }
    `;
  }

  // Base styles
  css += `
    * {
      box-sizing: border-box;
    }

    body {
      font-family: var(--font-family);
      font-size: var(--font-size-base);
      line-height: var(--line-height);
      color: var(--color-text-primary);
      background-color: var(--color-bg-primary);
      margin: 0;
      padding: 2rem;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .container {
      max-width: var(--max-width);
      margin: 0 auto;
    }

    /* Typography */
    h1, h2, h3, h4, h5, h6 {
      font-family: var(--font-family-heading);
      color: var(--color-text-primary);
      margin-top: 2rem;
      margin-bottom: 1rem;
      line-height: 1.3;
    }

    h1 {
      font-size: 2.25rem;
      font-weight: 700;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid var(--color-accent);
      margin-top: 0;
    }

    h2 {
      font-size: 1.75rem;
      font-weight: 600;
      margin-top: 3rem;
    }

    h3 {
      font-size: 1.375rem;
      font-weight: 600;
    }

    p {
      margin: 1rem 0;
      color: var(--color-text-secondary);
    }

    a {
      color: var(--color-accent);
      text-decoration: none;
    }

    a:hover {
      color: var(--color-accent-hover);
      text-decoration: underline;
    }

    /* Blockquotes */
    blockquote {
      margin: 1.5rem 0;
      padding: 1rem 1.5rem;
      border-left: 4px solid var(--color-accent);
      background-color: var(--color-bg-secondary);
      border-radius: 0 8px 8px 0;
    }

    blockquote p {
      margin: 0;
      font-style: italic;
      color: var(--color-text-secondary);
    }

    /* Code */
    code {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.875em;
      background-color: var(--color-bg-tertiary);
      padding: 0.2em 0.4em;
      border-radius: 4px;
      color: var(--color-accent);
    }

    pre {
      background-color: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
    }

    pre code {
      background: none;
      padding: 0;
      color: var(--color-text-primary);
    }

    /* Lists */
    ul, ol {
      margin: 1rem 0;
      padding-left: 2rem;
      color: var(--color-text-secondary);
    }

    li {
      margin: 0.5rem 0;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
    }

    th, td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--color-border);
    }

    th {
      background-color: var(--color-bg-secondary);
      font-weight: 600;
      color: var(--color-text-primary);
    }

    /* Horizontal rules */
    hr {
      border: none;
      border-top: 1px solid var(--color-border);
      margin: 2rem 0;
    }

    /* Table of Contents */
    .toc {
      background-color: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }

    .toc h2 {
      margin-top: 0;
      font-size: 1.25rem;
      color: var(--color-text-primary);
    }

    .toc ul {
      list-style: none;
      padding-left: 0;
    }

    .toc li {
      margin: 0.5rem 0;
    }

    .toc a {
      color: var(--color-text-secondary);
    }

    .toc a:hover {
      color: var(--color-accent);
    }

    /* Footer */
    .footer {
      margin-top: 4rem;
      padding-top: 2rem;
      border-top: 1px solid var(--color-border);
      color: var(--color-text-tertiary);
      font-size: 0.875rem;
    }

    .footer p {
      margin: 0.5rem 0;
      color: var(--color-text-tertiary);
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  `;

  // Section styles
  for (const style of styles) {
    css += `
    .${style.className} {
      margin: 1.5rem 0;
      padding: 1.5rem;
      border-left: 4px solid ${style.borderColor || 'var(--color-border)'};
      background-color: ${style.backgroundColor || 'transparent'};
      border-radius: 0 8px 8px 0;
    }
    `;

    if (style.badge) {
      css += `
    .${style.className} .section-badge {
      background-color: ${style.badge.bgColor};
      color: ${style.badge.color};
    }
      `;
    }
  }

  // Add custom CSS if provided
  if (theme.customCss) {
    css += `\n/* Custom CSS */\n${theme.customCss}`;
  }

  // Reduced motion support
  css += `
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;

  return css;
}

// ═══════════════════════════════════════════════════════════════════════════
// HTML GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate slug from text for anchor links.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Parse markdown content and extract headings for TOC.
 */
export function extractHeadings(content: string): Array<{ level: number; text: string; slug: string }> {
  const headings: Array<{ level: number; text: string; slug: string }> = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      headings.push({ level, text, slug: slugify(text) });
    }
  }

  return headings;
}

/**
 * Convert markdown to HTML (basic conversion).
 */
export function markdownToHtml(content: string, sectionStyles: SectionStyle[] = []): string {
  const styles = sectionStyles.length > 0 ? sectionStyles : DEFAULT_SECTION_STYLES;
  let html = escapeHtml(content);

  // Headers with IDs for TOC linking
  html = html.replace(/^######\s+(.+)$/gm, (_, text) => `<h6 id="${slugify(text)}">${text}</h6>`);
  html = html.replace(/^#####\s+(.+)$/gm, (_, text) => `<h5 id="${slugify(text)}">${text}</h5>`);
  html = html.replace(/^####\s+(.+)$/gm, (_, text) => `<h4 id="${slugify(text)}">${text}</h4>`);
  html = html.replace(/^###\s+(.+)$/gm, (_, text) => `<h3 id="${slugify(text)}">${text}</h3>`);
  html = html.replace(/^##\s+(.+)$/gm, (_, text) => `<h2 id="${slugify(text)}">${text}</h2>`);
  html = html.replace(/^#\s+(.+)$/gm, (_, text) => `<h1 id="${slugify(text)}">${text}</h1>`);

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Blockquotes
  html = html.replace(/^&gt;\s*(.+)$/gm, '<blockquote><p>$1</p></blockquote>');
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr>');
  html = html.replace(/^\*\*\*+$/gm, '<hr>');

  // Unordered lists
  html = html.replace(/^[\*\-]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Tables (basic support)
  html = html.replace(/^\|(.+)\|$/gm, (match, content) => {
    const cells = content.split('|').map((c: string) => c.trim());
    // Check if it's a separator row
    if (cells.every((c: string) => /^[-:]+$/.test(c))) {
      return ''; // Remove separator row
    }
    const isHeader = content.includes('---');
    const tag = isHeader ? 'th' : 'td';
    const row = cells.map((c: string) => `<${tag}>${c}</${tag}>`).join('');
    return `<tr>${row}</tr>`;
  });
  html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>');

  // Paragraphs (wrap remaining text)
  html = html
    .split('\n\n')
    .map(block => {
      block = block.trim();
      if (!block) return '';
      // Don't wrap if already an HTML element
      if (/^<(h[1-6]|ul|ol|li|table|tr|td|th|blockquote|pre|hr|div|p)/.test(block)) {
        return block;
      }
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n\n');

  return html;
}

/**
 * Generate table of contents HTML.
 */
export function generateTocHtml(headings: Array<{ level: number; text: string; slug: string }>): string {
  if (headings.length === 0) return '';

  let html = '<nav class="toc">\n<h2>Contents</h2>\n<ul>\n';

  for (const heading of headings) {
    // Only include h2 and h3 in TOC
    if (heading.level === 2 || heading.level === 3) {
      const indent = heading.level === 3 ? '  ' : '';
      html += `${indent}<li><a href="#${heading.slug}">${escapeHtml(heading.text)}</a></li>\n`;
    }
  }

  html += '</ul>\n</nav>';
  return html;
}

/**
 * Generate full HTML document from a drafting session.
 */
export function generateHtmlDocument(
  session: DraftingSession,
  config?: ExportConfig
): string {
  const theme = config?.htmlTheme || HUMANIZER_THEME;
  const sectionStyles = config?.sectionStyles || DEFAULT_SECTION_STYLES;
  const generateToc = config?.generateToc ?? true;
  const includeMetadata = config?.includeMetadata ?? true;

  const currentDraft = session.versions[session.currentVersion - 1];
  if (!currentDraft) {
    throw new Error('No draft content to export');
  }

  const headings = extractHeadings(currentDraft.content);
  const tocHtml = generateToc ? generateTocHtml(headings) : '';
  const contentHtml = markdownToHtml(currentDraft.content, sectionStyles);

  let metadataHtml = '';
  if (includeMetadata) {
    metadataHtml = `
    <div class="footer">
      <p>Generated by <a href="https://humanizer.com">humanizer.com</a></p>
      <p>Draft version ${currentDraft.version} • ${currentDraft.wordCount.toLocaleString()} words</p>
      <p>Created: ${session.metadata.createdAt.toISOString().split('T')[0]}</p>
      ${session.metadata.feedbackRounds > 0 ? `<p>${session.metadata.feedbackRounds} revision${session.metadata.feedbackRounds > 1 ? 's' : ''}</p>` : ''}
    </div>
    `;
  }

  const css = generateThemeCss(theme, sectionStyles);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(session.title)}</title>
  <style>
${css}
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(session.title)}</h1>
    ${tocHtml}
    <article>
${contentHtml}
    </article>
    ${metadataHtml}
  </div>
</body>
</html>`;
}

/**
 * Generate markdown document from a drafting session.
 */
export function generateMarkdownDocument(
  session: DraftingSession,
  config?: ExportConfig
): string {
  const currentDraft = session.versions[session.currentVersion - 1];
  if (!currentDraft) {
    throw new Error('No draft content to export');
  }

  const includeMetadata = config?.includeMetadata ?? true;

  let markdown = `# ${session.title}\n\n`;
  markdown += currentDraft.content;

  if (includeMetadata) {
    markdown += `\n\n---\n\n`;
    markdown += `*Generated by [humanizer.com](https://humanizer.com)*\n`;
    markdown += `*Draft version ${currentDraft.version} • ${currentDraft.wordCount.toLocaleString()} words*\n`;
    markdown += `*Created: ${session.metadata.createdAt.toISOString().split('T')[0]}*\n`;
  }

  return markdown;
}

/**
 * Generate JSON document from a drafting session.
 */
export function generateJsonDocument(session: DraftingSession): string {
  const currentDraft = session.versions[session.currentVersion - 1];

  return JSON.stringify({
    id: session.id,
    title: session.title,
    status: session.status,
    currentVersion: session.currentVersion,
    draft: currentDraft ? {
      version: currentDraft.version,
      content: currentDraft.content,
      wordCount: currentDraft.wordCount,
      createdAt: currentDraft.createdAt.toISOString(),
    } : null,
    sources: session.sources,
    metadata: {
      createdAt: session.metadata.createdAt.toISOString(),
      updatedAt: session.metadata.updatedAt.toISOString(),
      totalGenerationMs: session.metadata.totalGenerationMs,
      feedbackRounds: session.metadata.feedbackRounds,
    },
    allVersions: session.versions.map(v => ({
      version: v.version,
      wordCount: v.wordCount,
      createdAt: v.createdAt.toISOString(),
      feedbackApplied: v.feedbackApplied,
    })),
  }, null, 2);
}
