import { useState, useRef } from 'react';
import { formatFileSize, validateFileType } from '../../../lib/encryption';
import { parseConversation, isConversationJSON, type ConversationMetadata } from '../../../lib/conversation-parser';

interface FileUploadZoneProps {
  onUpload: (file: File, folder: string | null, conversationMetadata?: ConversationMetadata) => Promise<void>;
  onUploadFolder: (files: File[], folder: string | null) => Promise<void>;
  uploading: boolean;
  folders: string[];
}

const ALLOWED_FILE_TYPES = [
  'text/plain',           // .txt
  'text/markdown',        // .md
  'application/json',     // .json
  'text/*',               // Any text file
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * FileUploadZone - Drag-and-drop file upload with encryption
 *
 * Features:
 * - Drag and drop or click to select
 * - File type validation (.txt, .md, .json)
 * - File size validation (50 MB max)
 * - Optional folder assignment
 */
export function FileUploadZone({ onUpload, onUploadFolder, uploading, folders }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // If multiple files (folder drag), process as conversation folder
    if (files.length > 1) {
      await handleConversationFolder(files);
    } else {
      // Single file
      await handleFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // If multiple files (folder upload), process as conversation archive
    if (files.length > 1) {
      await handleConversationFolder(Array.from(files));
    } else {
      // Single file upload
      await handleFile(files[0]);
    }
  };

  const handleConversationFolder = async (files: File[]) => {
    setError(null);

    try {
      // Determine folder name
      let folder = selectedFolder;
      if (showNewFolder && newFolderName.trim()) {
        folder = newFolderName.trim();
      }

      // Call parent handler
      await onUploadFolder(files, folder);

      // Reset
      if (showNewFolder) {
        setNewFolderName('');
        setShowNewFolder(false);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err: any) {
      console.error('Folder upload failed:', err);
      setError(err.message || 'Failed to upload conversation folder');
    }
  };

  const handleFile = async (file: File) => {
    setError(null);

    // Validate file type
    if (!validateFileType(file, ALLOWED_FILE_TYPES)) {
      setError(`File type not supported. Please upload .txt, .md, or .json files.`);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large (${formatFileSize(file.size)}). Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`);
      return;
    }

    // Determine folder
    let folder = selectedFolder;
    if (showNewFolder && newFolderName.trim()) {
      folder = newFolderName.trim();
    }

    // Parse conversation metadata if JSON
    let conversationMetadata: ConversationMetadata | undefined;
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      try {
        const text = await file.text();
        if (isConversationJSON(text)) {
          const parsed = parseConversation(JSON.parse(text));
          conversationMetadata = parsed.metadata;
          console.log('Parsed conversation:', conversationMetadata);
        }
      } catch (err) {
        console.warn('Failed to parse conversation JSON:', err);
        // Continue anyway - will upload as regular file
      }
    }

    try {
      await onUpload(file, folder, conversationMetadata);

      // Reset new folder input
      if (showNewFolder) {
        setNewFolderName('');
        setShowNewFolder(false);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.');
    }
  };

  const handleFolderClick = () => {
    if (fileInputRef.current) {
      // Enable folder selection
      fileInputRef.current.setAttribute('webkitdirectory', '');
      fileInputRef.current.setAttribute('directory', '');
      fileInputRef.current.click();
    }
  };

  const handleFileClick = () => {
    if (fileInputRef.current) {
      // Disable folder selection
      fileInputRef.current.removeAttribute('webkitdirectory');
      fileInputRef.current.removeAttribute('directory');
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-3">
      {/* Folder Selector */}
      <div className="flex gap-2 items-center">
        <label className="text-sm text-slate-400 whitespace-nowrap">
          Folder:
        </label>
        <select
          value={selectedFolder || ''}
          onChange={(e) => {
            setSelectedFolder(e.target.value || null);
            setShowNewFolder(false);
          }}
          disabled={uploading}
          className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
        >
          <option value="">No folder (root)</option>
          {folders.map((folder) => (
            <option key={folder} value={folder}>
              📁 {folder}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowNewFolder(!showNewFolder)}
          disabled={uploading}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-slate-300 text-sm rounded transition-colors whitespace-nowrap"
        >
          {showNewFolder ? 'Cancel' : 'New Folder'}
        </button>
      </div>

      {/* New Folder Input */}
      {showNewFolder && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Enter folder name"
            disabled={uploading}
            className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          />
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-all
          ${isDragging
            ? 'border-purple-500 bg-purple-950 bg-opacity-30'
            : 'border-slate-600 bg-slate-800'
          }
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept=".txt,.md,.json,text/*,image/*"
          multiple
          disabled={uploading}
          className="hidden"
        />

        {uploading ? (
          <div className="space-y-2">
            <div className="text-4xl">⏳</div>
            <p className="text-slate-300 font-medium">Encrypting and uploading...</p>
            <p className="text-sm text-slate-400">Please wait</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-4xl">{isDragging ? '⬇️' : '📤'}</div>
            <p className="text-slate-300 font-medium">
              {isDragging ? 'Drop files or folder here' : 'Upload Conversation Archive'}
            </p>

            {/* Upload Options */}
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={handleFileClick}
                disabled={uploading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 text-white text-sm rounded transition-colors"
              >
                📄 Select File
              </button>
              <button
                type="button"
                onClick={handleFolderClick}
                disabled={uploading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white text-sm rounded transition-colors"
              >
                📁 Select Folder
              </button>
            </div>

            <p className="text-xs text-slate-500">
              File: .txt, .md, .json • Folder: ChatGPT/Claude exports with images
            </p>
            <p className="text-xs text-slate-500">
              Max size: {formatFileSize(MAX_FILE_SIZE)} per file • HTML files skipped
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-950 border border-red-800 rounded-md p-3 text-red-300 text-sm">
          <span className="font-semibold">Error: </span>
          {error}
        </div>
      )}
    </div>
  );
}
