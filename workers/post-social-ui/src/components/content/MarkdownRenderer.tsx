/**
 * Markdown Renderer Component
 * 
 * Renders markdown content with support for:
 * - Standard markdown syntax
 * - Code highlighting
 * - LaTeX math (via KaTeX)
 */

import { Component, createMemo } from 'solid-js';
import { marked } from 'marked';
import katex from 'katex';

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Custom renderer for LaTeX
const renderer = new marked.Renderer();

// Process LaTeX blocks
function processLatex(content: string): string {
  // Block math: $$...$$ or \[...\]
  content = content.replace(/\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/g, (match, p1, p2) => {
    const latex = p1 || p2;
    try {
      return katex.renderToString(latex.trim(), { displayMode: true });
    } catch (e) {
      console.error('KaTeX error:', e);
      return `<code class="katex-error">${latex}</code>`;
    }
  });
  
  // Inline math: $...$ or \(...\)
  content = content.replace(/\$([^\$\n]+?)\$|\\\(([^\)]+?)\\\)/g, (match, p1, p2) => {
    const latex = p1 || p2;
    try {
      return katex.renderToString(latex.trim(), { displayMode: false });
    } catch (e) {
      console.error('KaTeX error:', e);
      return `<code class="katex-error">${latex}</code>`;
    }
  });
  
  return content;
}

interface MarkdownRendererProps {
  content: string;
  class?: string;
}

export const MarkdownRenderer: Component<MarkdownRendererProps> = (props) => {
  const html = createMemo(() => {
    if (!props.content) return '';
    
    // First process LaTeX, then markdown
    const withLatex = processLatex(props.content);
    const result = marked.parse(withLatex, { async: false });
    return result as string;
  });
  
  return (
    <div 
      class={`markdown-content ${props.class || ''}`}
      innerHTML={html()}
    />
  );
};
