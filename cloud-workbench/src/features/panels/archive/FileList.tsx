import { useState } from 'react';
import { formatFileSize } from '../../../lib/encryption';

export interface ArchiveFile {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  folder: string | null;
  created_at: number;
  // Conversation metadata (optional)
  conversation_title?: string | null;
  conversation_provider?: string | null;
  message_count?: number | null;
  conversation_created_at?: number | null;
  has_images?: number;
  has_code?: number;
  first_message?: string | null;
  // File relationships (optional)
  parent_file_id?: string | null;
  file_role?: string | null;
  relative_path?: string | null;
}

interface FileListProps {
  files: ArchiveFile[];
  onLoad: (fileId: string, filename: string) => Promise<void>;
  onDelete: (fileId: string, filename: string) => Promise<void>;
  loading: boolean;
}

/**
 * FileList - Display encrypted files with load/delete actions
 *
 * Features:
 * - Sortable table display
 * - Folder grouping
 * - Load file into Content Source
 * - Delete with confirmation
 */
export function FileList({ files, onLoad, onDelete, loading }: FileListProps) {
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  // Filter out media files - only show conversations and standalone files
  const displayFiles = files.filter(f =>
    f.file_role !== 'image' && f.file_role !== 'attachment'
  );

  const handleLoad = async (fileId: string, filename: string) => {
    try {
      setLoadingFileId(fileId);
      await onLoad(fileId, filename);
    } catch (err: any) {
      alert(`Failed to load file: ${err.message}`);
    } finally {
      setLoadingFileId(null);
    }
  };

  const handleDelete = async (fileId: string, filename: string) => {
    if (!confirm(`Delete "${filename}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingFileId(fileId);
      await onDelete(fileId, filename);
    } catch (err: any) {
      alert(`Failed to delete file: ${err.message}`);
    } finally {
      setDeletingFileId(null);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-secondary)' }}>
        <div className="text-center space-y-2">
          <div className="text-3xl">⏳</div>
          <p>Loading files...</p>
        </div>
      </div>
    );
  }

  if (displayFiles.length === 0) {
    return (
      <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-secondary)' }}>
        <div className="text-center space-y-2">
          <div className="text-5xl">📭</div>
          <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>No files uploaded yet</p>
          <p className="text-sm">Upload your first file to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm px-1" style={{ color: 'var(--text-secondary)' }}>
        {displayFiles.length} {displayFiles.length === 1 ? 'file' : 'files'} stored
        {files.length > displayFiles.length && (
          <span style={{ color: 'var(--text-tertiary)' }}> ({files.length - displayFiles.length} media files hidden)</span>
        )}
      </div>

      <div className="space-y-1">
        {displayFiles.map((file) => {
          const isLoading = loadingFileId === file.id;
          const isDeleting = deletingFileId === file.id;
          const isDisabled = isLoading || isDeleting || !!loadingFileId || !!deletingFileId;

          return (
            <div
              key={file.id}
              className="list-item rounded-lg p-3"
            >
              <div className="flex items-start gap-3">
                {/* File/Conversation Icon */}
                <div className="text-2xl mt-0.5">
                  {file.conversation_provider === 'chatgpt' ? '💬' :
                   file.conversation_provider === 'claude' ? '🤖' :
                   file.content_type.startsWith('text/') ? '📄' : '📦'}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {/* Title - use conversation title if available */}
                      <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {file.conversation_title || file.filename}
                      </p>

                      {/* Metadata row */}
                      <div className="flex items-center flex-wrap gap-2 text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {/* Provider badge */}
                        {file.conversation_provider && (
                          <span
                            className="px-1.5 py-0.5 rounded text-xs font-medium"
                            style={{
                              background: file.conversation_provider === 'chatgpt'
                                ? 'rgba(52, 211, 153, 0.2)'
                                : 'var(--accent-purple-alpha-10)',
                              color: file.conversation_provider === 'chatgpt'
                                ? 'var(--accent-green)'
                                : 'var(--accent-purple)',
                            }}
                          >
                            {file.conversation_provider === 'chatgpt' ? 'ChatGPT' : 'Claude'}
                          </span>
                        )}

                        {/* Message count */}
                        {file.message_count ? (
                          <span className="flex items-center gap-1">
                            💬 {file.message_count} messages
                          </span>
                        ) : null}

                        {/* Features */}
                        {file.has_images ? <span>🖼️</span> : null}
                        {file.has_code ? <span>💻</span> : null}

                        {/* Folder */}
                        {file.folder && (
                          <span className="flex items-center gap-1">
                            📁 {file.folder}
                          </span>
                        )}

                        {/* Size & Date */}
                        <span>{formatFileSize(file.size)}</span>
                        <span>{formatDate(file.conversation_created_at || file.created_at)}</span>
                      </div>

                      {/* First message preview for conversations */}
                      {file.first_message && (
                        <p className="text-xs mt-1 line-clamp-2 italic" style={{ color: 'var(--text-tertiary)' }}>
                          "{file.first_message}..."
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleLoad(file.id, file.filename)}
                        disabled={isDisabled}
                        className="btn-primary px-3 py-1.5 text-sm rounded whitespace-nowrap"
                        title="Load into Content Source"
                      >
                        {isLoading ? (
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Loading...
                          </span>
                        ) : (
                          '📥 Load'
                        )}
                      </button>

                      <button
                        onClick={() => handleDelete(file.id, file.filename)}
                        disabled={isDisabled}
                        className="btn-danger px-3 py-1.5 text-sm rounded"
                        title="Delete file"
                      >
                        {isDeleting ? (
                          <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          '🗑️'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
