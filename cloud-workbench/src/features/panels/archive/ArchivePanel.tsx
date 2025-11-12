import { useState, useEffect } from 'react';
import { useCanvas } from '../../../core/context/CanvasContext';
import { useAuth } from '../../../core/context/AuthContext';
import { api } from '../../../core/adapters/api';
import { keyManager, encryptFile, decryptFile, uint8ArrayToText } from '../../../lib/encryption';
import { parseConversation } from '../../../lib/conversation-parser';
import { EncryptionPasswordModal } from './EncryptionPasswordModal';
import { FileUploadZone } from './FileUploadZone';
import { FileList, type ArchiveFile } from './FileList';
import { ConversationViewer } from './ConversationViewer';

/**
 * ArchivePanel - Secure encrypted file storage
 *
 * Features:
 * - Client-side encryption (zero-knowledge)
 * - Upload conversation archives and documents
 * - Organize with folders
 * - Load files into Content Source
 * - Password-protected access
 *
 * Security model:
 * - Encryption happens in browser only
 * - Server never sees plaintext
 * - Password never transmitted
 * - Management cannot decrypt user files
 */
export function ArchivePanel() {
  const { setText } = useCanvas();
  const { requiresAuth, isAuthenticated } = useAuth();

  // Encryption state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [salt, setSalt] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // Files state
  const [files, setFiles] = useState<ArchiveFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Conversation viewer state
  const [viewingConversation, setViewingConversation] = useState<{
    fileId: string;
    data: string;
  } | null>(null);

  // Initialize: Check if encryption key is already in memory
  useEffect(() => {
    if (keyManager.isInitialized()) {
      setIsUnlocked(true);
      loadFiles();
    } else {
      fetchSalt();
    }
  }, []);

  // Fetch salt from server (needed for key derivation)
  const fetchSalt = async () => {
    try {
      const salt = await api.getArchiveSalt();
      setSalt(salt);
    } catch (err: any) {
      console.error('Failed to fetch salt:', err);
      setInitError('Failed to initialize encryption. Please try again.');
    }
  };

  // Load files from server
  const loadFiles = async () => {
    try {
      setLoading(true);
      const result = await api.listArchiveFiles(selectedFolder || undefined);
      setFiles(result.files || []);
      setFolders(result.folders || []);
    } catch (err: any) {
      console.error('Failed to load files:', err);
      alert('Failed to load files. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  // Handle encryption unlock
  const handleUnlock = async () => {
    setIsUnlocked(true);
    await loadFiles();
  };

  // Handle file upload
  const handleUpload = async (file: File, folder: string | null, conversationMetadata?: any) => {
    try {
      setUploading(true);

      // Get encryption key
      const key = keyManager.getKey();

      // Encrypt file in browser
      const { encryptedData, iv } = await encryptFile(file, key);

      // Upload to server with conversation metadata
      const blob = new Blob([encryptedData as any]);
      await api.uploadArchiveFile(blob, iv, file.name, file.type, folder, conversationMetadata);

      // Refresh file list
      await loadFiles();
    } catch (err: any) {
      console.error('Upload failed:', err);
      throw new Error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Handle folder upload (conversation with images)
  const handleUploadFolder = async (files: File[], folder: string | null) => {
    try {
      setUploading(true);

      // Filter out HTML files
      const validFiles = files.filter(file =>
        !file.name.endsWith('.html') && !file.name.endsWith('.htm')
      );

      if (validFiles.length === 0) {
        throw new Error('No valid files found in folder (HTML files are skipped)');
      }

      // Find conversation.json
      const conversationFile = validFiles.find(f =>
        f.name === 'conversation.json' || f.name.endsWith('/conversation.json')
      );

      if (!conversationFile) {
        throw new Error('No conversation.json found in folder');
      }

      // Parse conversation metadata
      const conversationText = await conversationFile.text();
      const conversationData = JSON.parse(conversationText);
      const parsed = parseConversation(conversationData);
      const metadata = parsed.metadata;

      // Use conversation title as folder if not specified
      if (!folder) {
        folder = metadata.title.substring(0, 50);
      }

      // Upload conversation JSON first
      const key = keyManager.getKey();
      const { encryptedData: convEncrypted, iv: convIv } = await encryptFile(conversationFile, key);
      const convBlob = new Blob([convEncrypted as any]);
      const convResult = await api.uploadArchiveFile(
        convBlob, convIv, conversationFile.name, conversationFile.type, folder, metadata
      );
      const conversationId = convResult.fileId;

      // Upload all other files (images, etc.)
      const otherFiles = validFiles.filter(f => f !== conversationFile);
      for (const file of otherFiles) {
        const role = file.type.startsWith('image/') ? 'image' : 'attachment';
        const relativePath = file.webkitRelativePath || file.name;

        const { encryptedData, iv } = await encryptFile(file, key);
        const blob = new Blob([encryptedData as any]);
        await api.uploadArchiveFile(
          blob, iv, file.name, file.type, folder, null, conversationId, role, relativePath
        );
      }

      console.log(`Uploaded conversation with ${otherFiles.length} attachments`);
      await loadFiles();
    } catch (err: any) {
      console.error('Folder upload failed:', err);
      throw new Error(err.message || 'Folder upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Handle file load into Content Source or Conversation Viewer
  const handleLoad = async (fileId: string, filename: string) => {
    try {
      // Get encryption key
      const key = keyManager.getKey();

      // Download encrypted file
      const fileData = await api.downloadArchiveFile(fileId);

      // Decrypt in browser
      const decrypted = await decryptFile(
        new Uint8Array(fileData.data),
        JSON.parse(fileData.iv),
        key
      );

      // Convert to text
      const text = uint8ArrayToText(decrypted);

      // Check if this is a conversation file
      const file = files.find(f => f.id === fileId);
      const isConversation = file?.conversation_title || file?.file_role === 'conversation';

      if (isConversation) {
        // Show in Conversation Viewer
        setViewingConversation({
          fileId,
          data: text
        });
      } else {
        // Load into Canvas as plain text
        setText(text);
        alert(`Loaded "${filename}" into Content Source`);
      }
    } catch (err: any) {
      console.error('Failed to load file:', err);
      throw new Error('Failed to decrypt file. Wrong password or corrupted data.');
    }
  };

  // Load and decrypt images for a conversation
  const handleLoadImages = async (conversationFileId: string): Promise<Map<string, string>> => {
    const imageUrls = new Map<string, string>();

    try {
      // Get encryption key
      const key = keyManager.getKey();

      // Find all image files linked to this conversation
      const imageFiles = files.filter(f =>
        f.parent_file_id === conversationFileId && f.file_role === 'image'
      );

      // Decrypt each image and create object URL
      for (const imageFile of imageFiles) {
        try {
          // Download encrypted image
          const fileData = await api.downloadArchiveFile(imageFile.id);

          // Decrypt in browser
          const decrypted = await decryptFile(
            new Uint8Array(fileData.data),
            JSON.parse(fileData.iv),
            key
          );

          // Create blob and object URL
          const blob = new Blob([new Uint8Array(decrypted)], { type: imageFile.content_type });
          const objectUrl = URL.createObjectURL(blob);

          // Extract file-id from relative_path or filename
          // ChatGPT uses format: "images/file-XXXXX.png"
          const match = imageFile.relative_path?.match(/file-[^.\/]+/) ||
                       imageFile.filename.match(/file-[^.\/]+/);
          if (match) {
            imageUrls.set(match[0], objectUrl);
          }
        } catch (err) {
          console.error(`Failed to decrypt image ${imageFile.filename}:`, err);
        }
      }

      return imageUrls;
    } catch (err: any) {
      console.error('Failed to load images:', err);
      return imageUrls;
    }
  };

  // Handle file delete
  const handleDelete = async (fileId: string, _filename: string) => {
    try {
      await api.deleteArchiveFile(fileId);
      await loadFiles();
    } catch (err: any) {
      console.error('Failed to delete file:', err);
      throw new Error('Failed to delete file');
    }
  };

  // Require auth
  if (typeof requiresAuth === 'function' && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <div className="text-center space-y-2 p-4">
          <div className="text-4xl">🔒</div>
          <p className="font-medium">Authentication Required</p>
          <p className="text-sm">Please log in to access Secure Archive</p>
        </div>
      </div>
    );
  }

  // Show initialization error
  if (initError) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        <div className="text-center space-y-2 p-4">
          <div className="text-4xl">❌</div>
          <p className="font-medium">Initialization Failed</p>
          <p className="text-sm">{initError}</p>
          <button
            onClick={() => {
              setInitError(null);
              fetchSalt();
            }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show password modal if not unlocked
  if (!isUnlocked && salt) {
    return (
      <div className="h-full relative">
        <EncryptionPasswordModal
          salt={salt}
          onUnlock={handleUnlock}
        />
      </div>
    );
  }

  // Loading salt
  if (!salt) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <div className="text-center space-y-2">
          <div className="text-4xl">⏳</div>
          <p>Initializing encryption...</p>
        </div>
      </div>
    );
  }

  // Show Conversation Viewer if viewing a conversation
  if (viewingConversation) {
    return (
      <div className="h-full flex flex-col">
        {/* Header with back button */}
        <div className="border-b border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewingConversation(null)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded transition-colors"
            >
              ← Back to Files
            </button>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🗄️</span>
              <h2 className="text-xl font-bold text-slate-100">Viewing Conversation</h2>
            </div>
          </div>
        </div>

        {/* Conversation Viewer */}
        <div className="flex-1 overflow-hidden">
          <ConversationViewer
            conversationJson={viewingConversation.data}
            fileId={viewingConversation.fileId}
            onLoadImages={handleLoadImages}
          />
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🗄️</span>
            <h2 className="text-xl font-bold text-slate-100">Secure Archive</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Encrypted
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          Zero-knowledge encrypted storage for your conversation archives and documents
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Upload Zone */}
        <FileUploadZone
          onUpload={handleUpload}
          onUploadFolder={handleUploadFolder}
          uploading={uploading}
          folders={folders}
        />

        {/* File List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-200">Your Files</h3>
            {folders.length > 0 && (
              <select
                value={selectedFolder || ''}
                onChange={(e) => {
                  setSelectedFolder(e.target.value || null);
                  // Reload files with new filter
                  loadFiles();
                }}
                className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Folders</option>
                {folders.map((folder) => (
                  <option key={folder} value={folder}>
                    📁 {folder}
                  </option>
                ))}
              </select>
            )}
          </div>

          <FileList
            files={files}
            onLoad={handleLoad}
            onDelete={handleDelete}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
