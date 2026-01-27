/**
 * MathMarkdown - Beautiful markdown renderer with KaTeX math support
 *
 * Features:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists, autolinks)
 * - Reddit-style formatting (spoilers, superscript)
 * - KaTeX math rendering with lazy loading
 * - Converts LaTeX formats: \[...\] → $$...$$, \(...\) → $...$
 * - Syntax highlighting for code blocks
 * - Responsive typography
 */

import { memo, useMemo, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import type { PluggableList } from 'unified';

// Track if KaTeX CSS has been loaded
let katexCssLoaded = false;

/**
 * Lazily load KaTeX CSS via link tag
 */
function loadKatexCss(): void {
  if (katexCssLoaded || typeof document === 'undefined') return;

  // Check if already loaded
  const existing = document.querySelector('link[href*="katex"]');
  if (existing) {
    katexCssLoaded = true;
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
  link.integrity = 'sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV';
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
  katexCssLoaded = true;
}

/**
 * Preprocess text to normalize LaTeX delimiters to standard markdown math
 * Converts:
 *   \[...\]  → $$...$$  (display math)
 *   \(...\)  → $...$    (inline math)
 *   \{       → \lbrace  (escaped braces in math)
 *   \}       → \rbrace
 */
function normalizeLatexDelimiters(text: string): string {
  let result = text;

  // Convert display math: \[...\] → $$...$$
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$1$$');

  // Convert inline math: \(...\) → $...$
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  // Handle LaTeX environments (begin/end) - wrap in $$
  result = result.replace(
    /\\begin\{(equation|align|gather|multline)\*?\}([\s\S]*?)\\end\{\1\*?\}/g,
    '$$\\begin{$1}$2\\end{$1}$$'
  );

  return result;
}

/**
 * Process Reddit-style markdown extensions
 * - >!spoiler text!< → <span class="spoiler">spoiler text</span>
 * - ^superscript → <sup>superscript</sup>
 */
function processRedditMarkdown(text: string): string {
  let result = text;

  // Spoiler tags: >!text!<
  result = result.replace(/>!([^!]+)!</g, '<span class="md-spoiler">$1</span>');

  // Superscript: ^word or ^(multiple words)
  result = result.replace(/\^(\([^)]+\)|\S+)/g, (_, content) => {
    const text = content.startsWith('(') ? content.slice(1, -1) : content;
    return `<sup>${text}</sup>`;
  });

  return result;
}

interface MathMarkdownProps {
  children: string;
  className?: string;
}

/**
 * MathMarkdown component with lazy KaTeX loading
 */
function MathMarkdownInner({ children, className = '' }: MathMarkdownProps) {
  const [rehypePlugins, setRehypePlugins] = useState<PluggableList>([]);

  // Preprocess the markdown content
  const processedContent = useMemo(() => {
    let text = children;
    text = normalizeLatexDelimiters(text);
    text = processRedditMarkdown(text);
    return text;
  }, [children]);

  // Detect if content has math to conditionally load KaTeX
  const hasMath = useMemo(() => {
    return /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\begin\{/.test(processedContent);
  }, [processedContent]);

  // Lazy load rehype-katex when math is detected
  useEffect(() => {
    if (hasMath) {
      loadKatexCss();
      import('rehype-katex').then((module) => {
        setRehypePlugins((prev) => {
          // Don't add if already present
          if (prev.some((p) => p === module.default)) return prev;
          return [...prev, module.default];
        });
      });
    }
  }, [hasMath]);

  return (
    <div className={`md-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm, // GitHub Flavored Markdown
          remarkMath, // Math parsing
        ]}
        rehypePlugins={rehypePlugins}
        components={{
          // Custom code block rendering with syntax highlighting
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;

            if (isInline) {
              return (
                <code className="md-code md-code--inline" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <pre className="md-code-block">
                <code className={`md-code ${className || ''}`} {...props}>
                  {children}
                </code>
              </pre>
            );
          },

          // Tables with proper styling
          table({ children }) {
            return (
              <div className="md-table-wrapper">
                <table className="md-table">{children}</table>
              </div>
            );
          },

          // Task lists
          li({ children, ...props }) {
            const hasCheckbox = Array.isArray(children) &&
              children.some((child: unknown) =>
                typeof child === 'object' &&
                child !== null &&
                'type' in child &&
                (child as { type: string }).type === 'input'
              );

            if (hasCheckbox) {
              return (
                <li className="md-task-item" {...props}>
                  {children}
                </li>
              );
            }

            return <li {...props}>{children}</li>;
          },

          // Blockquotes
          blockquote({ children }) {
            return <blockquote className="md-blockquote">{children}</blockquote>;
          },

          // Links open in new tab
          a({ children, href, ...props }) {
            const isExternal = href?.startsWith('http');
            return (
              <a
                href={href}
                className="md-link"
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                {...props}
              >
                {children}
              </a>
            );
          },

          // Images with lazy loading
          img({ src, alt, ...props }) {
            return (
              <img
                src={src}
                alt={alt || ''}
                className="md-image"
                loading="lazy"
                {...props}
              />
            );
          },

          // Horizontal rule
          hr() {
            return <hr className="md-divider" />;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

export const MathMarkdown = memo(MathMarkdownInner);
export default MathMarkdown;
