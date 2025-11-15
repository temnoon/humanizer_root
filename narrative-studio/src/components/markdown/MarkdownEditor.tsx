import { useRef, useEffect } from 'react';

interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  className?: string;
  placeholder?: string;
}

export function MarkdownEditor({
  content,
  onChange,
  className = '',
  placeholder = 'Enter markdown...',
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-resize textarea to fit content
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  return (
    <textarea
      ref={textareaRef}
      value={content}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full min-h-[400px] p-6 mono text-sm resize-none focus:outline-none ${className}`}
      style={{
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
      }}
    />
  );
}
