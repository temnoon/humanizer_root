import { useState, useEffect } from 'react';
import { useCanvas } from '../../../core/context/CanvasContext';
import { useAuth } from '../../../core/context/AuthContext';
import { api } from '../../../core/adapters/api';
import { keyManager, encryptFile, decryptFile, uint8ArrayToText } from '../../../lib/encryption';
import { parseConversation } from '../../../lib/conversation-parser';
import { EncryptionPasswordModal } from './EncryptionPasswordModal';
import { FileUploadZone } from './FileUploadZone';
import { FileList, type ArchiveFile } from './FileList';

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

  // Handle folder upload (conversation JSON only, skip images)
  const handleUploadFolder = async (files: File[], folder: string | null) => {
    try {
      setUploading(true);

      // Find conversation.json (check various possible locations)
      const conversationFile = files.find(f =>
        f.name === 'conversation.json' ||
        f.name.endsWith('/conversation.json') ||
        f.webkitRelativePath?.endsWith('conversation.json')
      );

      if (!conversationFile) {
        const fileList = files.map(f => f.webkitRelativePath || f.name).join(', ');
        console.error('Files in upload:', fileList);
        throw new Error(`No conversation.json found in folder. Found ${files.length} files: ${fileList.substring(0, 200)}...`);
      }

      // Parse JSON
      const conversationText = await conversationFile.text();
      const conversationData = JSON.parse(conversationText);
      const parsed = parseConversation(conversationData);
      const metadata = parsed.metadata;

      // Count skipped images
      const imageFiles = files.filter(f =>
        f.type.startsWith('image/') ||
        f.webkitRelativePath?.includes('/media/') ||
        f.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      );

      // Use conversation title as folder if not specified
      if (!folder) {
        folder = metadata.title.substring(0, 50);
      }

      // Upload conversation JSON only (no images)
      const key = keyManager.getKey();
      const { encryptedData: convEncrypted, iv: convIv } = await encryptFile(conversationFile, key);
      const convBlob = new Blob([convEncrypted as any]);
      await api.uploadArchiveFile(
        convBlob, convIv, conversationFile.name, conversationFile.type, folder, metadata
      );

      console.log(`✅ Uploaded conversation: ${metadata.title}`);
      if (imageFiles.length > 0) {
        console.log(`ℹ️ Skipped ${imageFiles.length} image files (images not supported in MVP)`);
      }

      await loadFiles();
    } catch (err: any) {
      console.error('Folder upload failed:', err);
      throw new Error(err.message || 'Folder upload failed');
    } finally {
      setUploading(false);
    }
  };

  // State for conversation and messages
  const [currentConversation, setCurrentConversation] = useState<any>(null);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);

  // Handle conversation load - parse and show message cards
  const handleLoad = async (fileId: string, _filename: string) => {
    try {
      // Get encryption key
      const key = keyManager.getKey();

      // Get file metadata
      const file = files.find(f => f.id === fileId);
      if (!file) {
        throw new Error('File not found');
      }

      // Download and decrypt file
      console.log('Loading conversation:', file.filename);
      const fileData = await api.downloadArchiveFile(fileId);
      const decrypted = await decryptFile(
        new Uint8Array(fileData.data),
        JSON.parse(fileData.iv),
        key
      );

      // Convert to text and parse
      const text = uint8ArrayToText(decrypted);
      console.log('Decrypted text length:', text.length);

      // Parse conversation JSON
      const conversationData = JSON.parse(text);
      const parsed = parseConversation(conversationData);

      // Store conversation in state for message cards
      setCurrentConversation({ fileId, ...parsed });
      setSelectedMessageIndex(null); // Reset selection

      console.log(`✅ Loaded conversation: ${parsed.metadata.title} (${parsed.messages.length} messages)`);
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
      alert(`Failed to load conversation: ${err.message}`);
    }
  };

  // Handle loading a specific message into Canvas
  const handleLoadMessage = (messageIndex: number) => {
    if (!currentConversation) return;

    const message = currentConversation.messages[messageIndex];
    setSelectedMessageIndex(messageIndex);

    // Format message for Canvas (clean, no image placeholders)
    let content = message.content;

    // Remove image placeholders (they're not supported)
    content = content.replace(/\[Image:\s*[^\]]+\]/g, '[Image]');

    setText(content);
    console.log(`Loaded message ${messageIndex + 1}/${currentConversation.messages.length}`);
  };

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
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>
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
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--accent-red)' }}>
        <div className="text-center space-y-2 p-4">
          <div className="text-4xl">❌</div>
          <p className="font-medium">Initialization Failed</p>
          <p className="text-sm">{initError}</p>
          <button
            onClick={() => {
              setInitError(null);
              fetchSalt();
            }}
            className="btn-secondary mt-4 px-4 py-2 rounded"
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
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>
        <div className="text-center space-y-2">
          <div className="text-4xl">⏳</div>
          <p>Initializing encryption...</p>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🗄️</span>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Secure Archive</h2>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-green)' }}></span>
              Encrypted
            </span>
          </div>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Zero-knowledge encrypted storage for your conversation archives and documents
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {currentConversation ? (
          /* Message Cards View */
          <div>
            <button
              onClick={() => {
                setCurrentConversation(null);
                setSelectedMessageIndex(null);
              }}
              className="mb-4 text-sm hover-accent flex items-center gap-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              ← Back to Files
            </button>

            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                💬 {currentConversation.metadata.title}
              </h3>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {currentConversation.messages.length} messages
                {selectedMessageIndex !== null && (
                  <span> • Message {selectedMessageIndex + 1} loaded in Canvas</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {currentConversation.messages.map((message: any, index: number) => (
                <div
                  key={index}
                  onClick={() => handleLoadMessage(index)}
                  className="list-item cursor-pointer"
                  style={
                    selectedMessageIndex === index
                      ? {
                          borderColor: 'var(--accent-purple)',
                          background: 'var(--accent-purple-alpha-10)',
                        }
                      : {}
                  }
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-medium"
                      style={{
                        color: message.role === 'user' ? 'var(--accent-cyan)' : 'var(--accent-purple)',
                      }}
                    >
                      {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Message {index + 1}
                    </span>
                  </div>
                  <p className="text-sm line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                    {message.content.substring(0, 100)}...
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* File List View */
          <>
            <FileUploadZone
              onUpload={handleUpload}
              onUploadFolder={handleUploadFolder}
              uploading={uploading}
              folders={folders}
            />

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Your Files</h3>
                {folders.length > 0 && (
                  <select
                    value={selectedFolder || ''}
                    onChange={(e) => {
                      setSelectedFolder(e.target.value || null);
                      loadFiles();
                    }}
                    className="input px-3 py-1.5 rounded text-sm"
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
          </>
        )}
      </div>
    </div>
  );
}
