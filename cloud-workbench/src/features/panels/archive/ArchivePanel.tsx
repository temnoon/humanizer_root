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

  // Decrypt images and return a map of file-id -> base64 data URL
  const decryptImagesForConversation = async (conversationFileId: string): Promise<Map<string, string>> => {
    const imageMap = new Map<string, string>();
    const key = keyManager.getKey();

    // Find all image files linked to this conversation
    const imageFiles = files.filter(f =>
      f.parent_file_id === conversationFileId && f.file_role === 'image'
    );

    console.log(`🔍 Looking for images with parent_file_id = ${conversationFileId}`);
    console.log(`📁 Total files in list: ${files.length}`);
    console.log(`🖼️ Found ${imageFiles.length} image files for conversation`);

    if (imageFiles.length > 0) {
      console.log('Image files:', imageFiles.map(f => ({
        filename: f.filename,
        relative_path: f.relative_path,
        content_type: f.content_type
      })));
    }

    for (const imageFile of imageFiles) {
      try {
        console.log(`⬇️ Downloading image: ${imageFile.filename}`);
        // Download and decrypt image
        const fileData = await api.downloadArchiveFile(imageFile.id);
        const decrypted = await decryptFile(
          new Uint8Array(fileData.data),
          JSON.parse(fileData.iv),
          key
        );

        console.log(`🔓 Decrypted ${decrypted.length} bytes`);

        // Convert to base64 data URL
        const blob = new Blob([new Uint8Array(decrypted)], { type: imageFile.content_type });
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        console.log(`📊 Base64 length: ${base64.length} chars`);

        // Extract file-id from relative_path or filename
        // ChatGPT uses format: "images/file-XXXXX.png"
        const match = imageFile.relative_path?.match(/file-[^.\/]+/) ||
                     imageFile.filename.match(/file-[^.\/]+/);
        if (match) {
          imageMap.set(match[0], base64);
          console.log(`✅ Mapped image: ${match[0]} -> base64 data (${Math.round(base64.length/1024)}KB)`);
        } else {
          console.warn(`⚠️ Could not extract file-id from: ${imageFile.filename} or ${imageFile.relative_path}`);
        }
      } catch (err) {
        console.error(`❌ Failed to decrypt image ${imageFile.filename}:`, err);
      }
    }

    console.log(`🎨 Image map size: ${imageMap.size} images ready`);
    return imageMap;
  };

  // Handle file load into Canvas
  const handleLoad = async (fileId: string, _filename: string) => {
    try {
      // Get encryption key
      const key = keyManager.getKey();

      // Get file metadata
      const file = files.find(f => f.id === fileId);
      if (!file) {
        throw new Error('File not found');
      }

      // Skip non-conversation files (images, attachments)
      if (file.file_role === 'image' || file.file_role === 'attachment') {
        alert('This is a media file. Please load the parent conversation instead.');
        return;
      }

      // Download encrypted file
      console.log('Downloading file:', fileId, file.filename);
      const fileData = await api.downloadArchiveFile(fileId);

      // Decrypt in browser
      console.log('Decrypting file...');
      const decrypted = await decryptFile(
        new Uint8Array(fileData.data),
        JSON.parse(fileData.iv),
        key
      );

      // Convert to text
      const text = uint8ArrayToText(decrypted);
      console.log('Decrypted text length:', text.length);

      // Check if this is a conversation file
      const isConversation = file?.conversation_title || file?.file_role === 'conversation';

      if (isConversation) {
        // Parse and format conversation for Canvas
        console.log('Parsing conversation...');
        const conversationData = JSON.parse(text);
        const parsed = parseConversation(conversationData);

        // Decrypt images if conversation has images
        let imageMap: Map<string, string> | null = null;
        if (parsed.metadata.has_images) {
          console.log('Decrypting images...');
          imageMap = await decryptImagesForConversation(fileId);
        }

        // Format as readable markdown for Canvas
        let markdown = `# ${parsed.metadata.title}\n\n`;
        markdown += `**Provider**: ${parsed.metadata.provider === 'chatgpt' ? '💬 ChatGPT' : '🤖 Claude'}\n`;
        markdown += `**Messages**: ${parsed.metadata.message_count}\n`;
        if (parsed.metadata.created_at) {
          markdown += `**Date**: ${new Date(parsed.metadata.created_at).toLocaleDateString()}\n\n`;
        } else {
          markdown += `\n`;
        }
        markdown += `---\n\n`;

        // Add each message and handle images
        for (const message of parsed.messages) {
          const roleLabel = message.role === 'user' ? '👤 **You**' : '🤖 **Assistant**';
          markdown += `## ${roleLabel}\n\n`;

          // Process content to replace image placeholders with actual images
          let content = message.content;

          // Find all image placeholders in this message
          const imagePattern = /\[Image:\s*(file-[^\]]+)\]/g;
          const imageMatches = [...content.matchAll(imagePattern)];

          if (imageMatches.length > 0) {
            console.log(`📷 Message has ${imageMatches.length} image placeholders:`, imageMatches.map(m => m[1]));
          }

          if (imageMap && imageMap.size > 0) {
            // Replace [Image: file-XXXXX] with markdown image syntax
            content = content.replace(imagePattern, (match, fileId) => {
              const dataUrl = imageMap!.get(fileId);
              if (dataUrl) {
                console.log(`✅ Replaced placeholder: ${fileId}`);
                return `![${fileId}](${dataUrl})`;
              }
              console.warn(`⚠️ No data URL found for: ${fileId}`);
              return match; // Keep placeholder if image not found
            });
          } else if (imageMatches.length > 0) {
            console.warn(`⚠️ Images found in content but imageMap is empty`);
          }

          markdown += `${content}\n\n`;
          markdown += `---\n\n`;
        }

        setText(markdown);
        console.log('✓ Loaded conversation to Canvas:', parsed.metadata.title);
      } else {
        // Load into Canvas as plain text
        console.log('Loading as plain text');
        setText(text);
      }
    } catch (err: any) {
      console.error('Failed to load file:', err);
      alert(`Failed to load file: ${err.message}`);
      throw err;
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
