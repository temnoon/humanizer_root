import { useState } from 'react';

interface InputCopyButtonProps {
  text: string;
  label?: string;
}

/**
 * Simple copy button for input textareas
 * Single button that copies the plain text content
 */
export default function InputCopyButton({ text, label = 'Copy Input' }: InputCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="copy-button"
      title={label}
      disabled={!text || text.trim().length === 0}
      style={{
        opacity: (!text || text.trim().length === 0) ? 0.5 : 1,
        cursor: (!text || text.trim().length === 0) ? 'not-allowed' : 'pointer'
      }}
    >
      {copied ? '✓ Copied!' : `📄 ${label}`}
    </button>
  );
}
