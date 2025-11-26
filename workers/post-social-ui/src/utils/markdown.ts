/**
 * Markdown + LaTeX Rendering
 */

import { marked } from 'marked';
import katex from 'katex';

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
});

/**
 * Render markdown with LaTeX support
 */
export function renderMarkdown(content: string): string {
  // First, render markdown
  let html = marked.parse(content) as string;

  // Then, render LaTeX math
  // Display math: $$...$$
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => {
    try {
      return katex.renderToString(math, {
        displayMode: true,
        throwOnError: false,
      });
    } catch (e) {
      return match;
    }
  });

  // Inline math: $...$
  html = html.replace(/\$([^\$]+?)\$/g, (match, math) => {
    try {
      return katex.renderToString(math, {
        displayMode: false,
        throwOnError: false,
      });
    } catch (e) {
      return match;
    }
  });

  return html;
}

/**
 * Strip markdown to plain text (for previews)
 */
export function stripMarkdown(content: string): string {
  return content
    .replace(/\$\$[\s\S]+?\$\$/g, '[math]')
    .replace(/\$[^\$]+?\$/g, '[math]')
    .replace(/#+\s/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
