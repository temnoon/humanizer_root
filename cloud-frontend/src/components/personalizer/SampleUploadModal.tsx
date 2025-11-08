import { useState } from 'react';
import { cloudAPI } from '../../lib/cloud-api-client';

interface SampleUploadModalProps {
  onClose: () => void;
  onUploadSuccess: () => void;
}

export default function SampleUploadModal({ onClose, onUploadSuccess }: SampleUploadModalProps) {
  const [content, setContent] = useState('');
  const [source, setSource] = useState<'manual' | 'chatgpt' | 'claude' | 'other'>('manual');
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordCount = content.trim().split(/\s+/).filter(w => w.length > 0).length;
  const isValidLength = wordCount >= 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidLength) {
      setError('Sample must be at least 100 words');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const metadata = title ? { title } : undefined;
      await cloudAPI.uploadWritingSample(content, source, metadata);
      onUploadSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload sample');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--spacing-lg)'
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ margin: 0 }}>Upload Writing Sample</h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 'var(--text-2xl)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Source Type */}
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-sm)',
              fontWeight: 500
            }}>
              Source
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as any)}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)'
              }}
            >
              <option value="manual">Manual Entry</option>
              <option value="chatgpt">ChatGPT Archive</option>
              <option value="claude">Claude Archive</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Optional Title */}
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-sm)',
              fontWeight: 500
            }}>
              Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., 'Blog post about AI', 'Personal journal entry'"
              style={{
                width: '100%',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          {/* Content Textarea */}
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-sm)',
              fontWeight: 500
            }}>
              Writing Sample Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your writing here... (minimum 100 words)"
              required
              style={{
                width: '100%',
                minHeight: '300px',
                padding: 'var(--spacing-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
            <div style={{
              fontSize: '0.875rem',
              marginTop: 'var(--spacing-xs)',
              color: isValidLength ? 'var(--text-tertiary)' : 'var(--accent-yellow)'
            }}>
              {wordCount} words {!isValidLength && `(need ${100 - wordCount} more)`}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="error" style={{ marginBottom: 'var(--spacing-md)' }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isUploading || !isValidLength}
              style={{
                opacity: (isUploading || !isValidLength) ? 0.5 : 1
              }}
            >
              {isUploading ? (
                <>
                  <div className="loading"></div>
                  <span>Uploading...</span>
                </>
              ) : (
                'Upload Sample'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
