/**
 * Secure Archive Service
 *
 * Client for the zero-trust encrypted archive API.
 * All encryption/decryption happens client-side.
 */

import { AUTH_API_URL } from '@/config/constants';
import { encryptionContext, ivToJson, jsonToIv } from './crypto';

// Types
export interface EncryptedFile {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  folder: string | null;
  created_at: number;
  // Conversation metadata (if applicable)
  conversation_title?: string;
  conversation_provider?: string;
  conversation_id?: string;
  conversation_created_at?: number;
  conversation_updated_at?: number;
  message_count?: number;
  has_images?: boolean;
  has_code?: boolean;
  first_message?: string;
  // Media relationship
  parent_file_id?: string;
  file_role?: 'conversation' | 'media';
  relative_path?: string;
}

export interface FileListResponse {
  files: EncryptedFile[];
  folders: string[];
  total: number;
}

export interface UploadResult {
  fileId: string;
  filename: string;
  size: number;
  folder: string | null;
  conversationTitle?: string;
}

export interface ConversationMetadata {
  title?: string;
  provider?: string;
  conversationId?: string;
  created_at?: number;
  updated_at?: number;
  message_count?: number;
  has_images?: boolean;
  has_code?: boolean;
  first_message?: string;
}

// Known verification string - must match exactly for decryption to succeed
const VERIFICATION_PLAINTEXT = 'HUMANIZER_ARCHIVE_V1';

interface SaltResponse {
  salt: string;
  verification: string | null;
  isNew: boolean;
}

/**
 * Get or create encryption salt for current user
 */
export async function getSalt(token: string): Promise<SaltResponse> {
  const response = await fetch(`${AUTH_API_URL}/secure-archive/salt`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to get encryption salt');
  }

  return response.json();
}

/**
 * Check if user needs to set up their archive (no password yet)
 * Returns true if this is a new user who needs to create a passphrase
 */
export async function checkIsNewUser(token: string): Promise<boolean> {
  const { isNew, verification } = await getSalt(token);
  return isNew || !verification;
}

/**
 * Store verification data after first password setup
 */
async function storeVerification(token: string): Promise<void> {
  // Encrypt the known plaintext
  const { ciphertext, iv } = await encryptionContext.encryptString(VERIFICATION_PLAINTEXT);

  // Convert to storable format
  const encryptedVerification = Array.from(new Uint8Array(ciphertext));

  await fetch(`${AUTH_API_URL}/secure-archive/verify`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      encryptedVerification,
      iv: ivToJson(iv),
    }),
  });
}

/**
 * Verify password by decrypting stored verification data
 */
async function verifyPassword(verification: string): Promise<boolean> {
  try {
    const { data, iv } = JSON.parse(verification);
    const ciphertext = new Uint8Array(data).buffer;
    const ivArray = jsonToIv(iv);

    const decrypted = await encryptionContext.decryptString(ciphertext, ivArray);
    return decrypted === VERIFICATION_PLAINTEXT;
  } catch {
    return false;
  }
}

/**
 * Initialize encryption context with password
 * Must be called before upload/download operations
 *
 * Returns: { success: boolean, isNew: boolean, error?: string }
 */
export async function initializeEncryption(
  token: string,
  password: string
): Promise<{ success: boolean; isNew: boolean; error?: string }> {
  const { salt, verification, isNew } = await getSalt(token);

  // Initialize the encryption context
  await encryptionContext.initialize(password, salt);

  if (isNew || !verification) {
    // First time setup - store verification data
    await storeVerification(token);
    return { success: true, isNew: true };
  }

  // Verify the password by decrypting the stored verification
  const isValid = await verifyPassword(verification);

  if (!isValid) {
    // Wrong password - clear the context
    encryptionContext.clear();
    return { success: false, isNew: false, error: 'Incorrect password' };
  }

  return { success: true, isNew: false };
}

/**
 * Check if encryption is initialized
 */
export function isEncryptionReady(): boolean {
  return encryptionContext.isInitialized();
}

/**
 * Clear encryption context (logout)
 */
export function clearEncryption(): void {
  encryptionContext.clear();
}

/**
 * Upload encrypted file
 */
export async function uploadFile(
  token: string,
  file: File,
  options: {
    folder?: string;
    conversationMetadata?: ConversationMetadata;
    parentFileId?: string;
    fileRole?: 'conversation' | 'media';
    relativePath?: string;
  } = {}
): Promise<UploadResult> {
  if (!encryptionContext.isInitialized()) {
    throw new Error('Encryption not initialized. Call initializeEncryption first.');
  }

  // Encrypt the file
  const { encryptedBlob, iv } = await encryptionContext.encryptFile(file);

  // Build form data
  const formData = new FormData();
  formData.append('file', encryptedBlob);
  formData.append('iv', JSON.stringify(ivToJson(iv)));
  formData.append('filename', file.name);
  formData.append('contentType', file.type || 'application/octet-stream');

  if (options.folder) {
    formData.append('folder', options.folder);
  }

  if (options.conversationMetadata) {
    formData.append('conversationMetadata', JSON.stringify(options.conversationMetadata));
  }

  if (options.parentFileId) {
    formData.append('parentFileId', options.parentFileId);
  }

  if (options.fileRole) {
    formData.append('fileRole', options.fileRole);
  }

  if (options.relativePath) {
    formData.append('relativePath', options.relativePath);
  }

  const response = await fetch(`${AUTH_API_URL}/secure-archive/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to upload file');
  }

  return response.json();
}

/**
 * Upload a conversation JSON file with associated media
 */
export async function uploadConversation(
  token: string,
  conversationJson: string,
  metadata: ConversationMetadata,
  mediaFiles: File[] = [],
  folder?: string
): Promise<{ conversationFileId: string; mediaFileIds: string[] }> {
  // First, upload the conversation JSON
  const jsonBlob = new Blob([conversationJson], { type: 'application/json' });
  const jsonFile = new File([jsonBlob], `${metadata.conversationId || 'conversation'}.json`, {
    type: 'application/json',
  });

  const conversationResult = await uploadFile(token, jsonFile, {
    folder: folder || 'conversations',
    conversationMetadata: metadata,
    fileRole: 'conversation',
  });

  // Then upload each media file, linked to the conversation
  const mediaFileIds: string[] = [];
  for (const mediaFile of mediaFiles) {
    const mediaResult = await uploadFile(token, mediaFile, {
      folder: folder ? `${folder}/media` : 'media',
      parentFileId: conversationResult.fileId,
      fileRole: 'media',
      relativePath: mediaFile.name,
    });
    mediaFileIds.push(mediaResult.fileId);
  }

  return {
    conversationFileId: conversationResult.fileId,
    mediaFileIds,
  };
}

/**
 * List encrypted files
 */
export async function listFiles(
  token: string,
  folder?: string
): Promise<FileListResponse> {
  const url = new URL(`${AUTH_API_URL}/secure-archive/files`);
  if (folder) {
    url.searchParams.set('folder', folder);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to list files');
  }

  return response.json();
}

/**
 * Get conversations (files with conversation metadata)
 */
export async function listConversations(token: string): Promise<EncryptedFile[]> {
  const { files } = await listFiles(token);
  // Filter to only conversation files
  return files.filter(f => f.file_role === 'conversation' || f.conversation_id);
}

/**
 * Download and decrypt a file
 */
export async function downloadFile(
  token: string,
  fileId: string
): Promise<{ blob: Blob; filename: string; contentType: string }> {
  if (!encryptionContext.isInitialized()) {
    throw new Error('Encryption not initialized. Call initializeEncryption first.');
  }

  const response = await fetch(`${AUTH_API_URL}/secure-archive/files/${fileId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to download file');
  }

  const { data, iv, filename, contentType } = await response.json();

  // Convert array back to ArrayBuffer
  const encryptedData = new Uint8Array(data).buffer;
  const ivArray = jsonToIv(iv);

  // Decrypt
  const blob = await encryptionContext.decryptFile(encryptedData, ivArray, contentType);

  return { blob, filename, contentType };
}

/**
 * Download and decrypt a conversation JSON
 */
export async function downloadConversation(
  token: string,
  fileId: string
): Promise<{ content: any; filename: string }> {
  const { blob, filename } = await downloadFile(token, fileId);
  const text = await blob.text();
  const content = JSON.parse(text);
  return { content, filename };
}

/**
 * Delete a file
 */
export async function deleteFile(token: string, fileId: string): Promise<void> {
  const response = await fetch(`${AUTH_API_URL}/secure-archive/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to delete file');
  }
}

/**
 * Delete all files in a folder
 */
export async function deleteFolder(token: string, folderName: string): Promise<void> {
  const response = await fetch(`${AUTH_API_URL}/secure-archive/folders/${folderName}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to delete folder');
  }
}

/**
 * Get media files associated with a conversation
 */
export async function getConversationMedia(
  token: string,
  conversationFileId: string
): Promise<EncryptedFile[]> {
  const { files } = await listFiles(token);
  return files.filter(f => f.parent_file_id === conversationFileId);
}
