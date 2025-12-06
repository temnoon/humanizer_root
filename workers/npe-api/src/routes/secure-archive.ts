/**
 * Secure Archive Routes
 *
 * Handles encrypted file storage for user conversation archives and documents
 * Files are encrypted client-side before upload, server only stores ciphertext
 *
 * Security model:
 * - Encryption/decryption happens in browser only
 * - Server never sees plaintext or encryption keys
 * - Each file has unique IV (initialization vector)
 * - User's encryption salt stored in DB (for key derivation)
 */

import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../middleware/auth';
import type { Env } from '../../shared/types';

const secureArchive = new Hono<{ Bindings: Env }>();

/**
 * GET /secure-archive/salt
 *
 * Get or create user's encryption salt for key derivation
 * Salt is used client-side to derive encryption key from password
 *
 * Response includes:
 * - salt: Base64-encoded salt for PBKDF2
 * - verification: Encrypted known value (if set) for password validation
 * - isNew: True if this is the first time (no password set yet)
 */
secureArchive.get('/salt', requireAuth(), async (c) => {
  const { userId } = getAuthContext(c);

  try {
    // Check if user already has a salt
    let settings = await c.env.DB.prepare(
      'SELECT salt, verification_data FROM user_encryption_settings WHERE user_id = ?'
    ).bind(userId).first();

    if (!settings) {
      // Generate new salt (32 bytes = 256 bits)
      const saltArray = new Uint8Array(32);
      crypto.getRandomValues(saltArray);
      const salt = btoa(String.fromCharCode(...saltArray)); // Base64 encode

      // Store salt (verification_data will be set on first upload)
      await c.env.DB.prepare(
        'INSERT INTO user_encryption_settings (user_id, salt, created_at) VALUES (?, ?, ?)'
      ).bind(userId, salt, Date.now()).run();

      return c.json({ salt, isNew: true });
    }

    return c.json({
      salt: settings.salt,
      verification: settings.verification_data || null,
      isNew: !settings.verification_data
    });
  } catch (error: any) {
    console.error('Error getting/creating salt:', error);
    return c.json({ error: 'Failed to get encryption salt', details: error.message }, 500);
  }
});

/**
 * POST /secure-archive/verify
 *
 * Store or verify password by encrypting/decrypting a known value.
 * On first call: stores the encrypted verification data
 * On subsequent calls: returns verification data for client-side check
 */
secureArchive.post('/verify', requireAuth(), async (c) => {
  const { userId } = getAuthContext(c);

  try {
    const { encryptedVerification, iv } = await c.req.json();

    if (!encryptedVerification || !iv) {
      return c.json({ error: 'Missing encryptedVerification or iv' }, 400);
    }

    // Check if verification already exists
    const existing = await c.env.DB.prepare(
      'SELECT verification_data FROM user_encryption_settings WHERE user_id = ?'
    ).bind(userId).first();

    if (existing?.verification_data) {
      // Already set - return existing for comparison
      return c.json({
        alreadySet: true,
        verification: existing.verification_data
      });
    }

    // First time - store the verification data
    const verificationJson = JSON.stringify({ data: encryptedVerification, iv });
    await c.env.DB.prepare(
      'UPDATE user_encryption_settings SET verification_data = ? WHERE user_id = ?'
    ).bind(verificationJson, userId).run();

    return c.json({ success: true, message: 'Verification data stored' });
  } catch (error: any) {
    console.error('Error storing verification:', error);
    return c.json({ error: 'Failed to store verification', details: error.message }, 500);
  }
});

/**
 * POST /secure-archive/upload
 *
 * Upload encrypted file to R2
 * Client must send:
 * - file: encrypted file blob
 * - iv: initialization vector (JSON array)
 * - filename: original filename
 * - contentType: MIME type
 * - folder: optional folder/category
 */
secureArchive.post('/upload', requireAuth(), async (c) => {
  const { userId } = getAuthContext(c);

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const iv = formData.get('iv') as string; // JSON array as string
    const filename = formData.get('filename') as string;
    const contentType = formData.get('contentType') as string;
    const folder = formData.get('folder') as string | null;
    const conversationMetadataStr = formData.get('conversationMetadata') as string | null;
    const parentFileId = formData.get('parentFileId') as string | null;
    const fileRole = formData.get('fileRole') as string | null;
    const relativePath = formData.get('relativePath') as string | null;

    if (!file || !iv || !filename || !contentType) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Parse conversation metadata if provided
    let conversationMetadata: any = null;
    if (conversationMetadataStr) {
      try {
        conversationMetadata = JSON.parse(conversationMetadataStr);
      } catch (err) {
        console.warn('Failed to parse conversation metadata:', err);
      }
    }

    // Generate unique file ID
    const fileId = crypto.randomUUID();
    const r2Key = `${userId}/${fileId}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await c.env.R2_ARCHIVE.put(r2Key, arrayBuffer, {
      customMetadata: {
        userId,
        filename,
        contentType,
        uploadedAt: Date.now().toString()
      }
    });

    // Store metadata in D1
    if (conversationMetadata) {
      // Insert with conversation metadata
      await c.env.DB.prepare(`
        INSERT INTO encrypted_files (
          id, user_id, filename, content_type, size, iv, r2_key, folder, created_at,
          conversation_title, conversation_provider, conversation_id,
          conversation_created_at, conversation_updated_at, message_count,
          has_images, has_code, first_message,
          parent_file_id, file_role, relative_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        fileId,
        userId,
        filename,
        contentType,
        arrayBuffer.byteLength,
        iv,
        r2Key,
        folder || null,
        Date.now(),
        conversationMetadata.title || null,
        conversationMetadata.provider || null,
        conversationMetadata.conversationId || null,
        conversationMetadata.created_at || null,
        conversationMetadata.updated_at || null,
        conversationMetadata.message_count || 0,
        conversationMetadata.has_images ? 1 : 0,
        conversationMetadata.has_code ? 1 : 0,
        conversationMetadata.first_message || null,
        parentFileId || null,
        fileRole || null,
        relativePath || null
      ).run();
    } else {
      // Insert without conversation metadata (regular file or media attachment)
      await c.env.DB.prepare(`
        INSERT INTO encrypted_files (
          id, user_id, filename, content_type, size, iv, r2_key, folder, created_at,
          parent_file_id, file_role, relative_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        fileId,
        userId,
        filename,
        contentType,
        arrayBuffer.byteLength,
        iv,
        r2Key,
        folder || null,
        Date.now(),
        parentFileId || null,
        fileRole || null,
        relativePath || null
      ).run();
    }

    return c.json({
      fileId,
      filename,
      size: arrayBuffer.byteLength,
      folder: folder || null,
      conversationTitle: conversationMetadata?.title,
      message: 'File uploaded successfully'
    });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return c.json({ error: 'Failed to upload file', details: error.message }, 500);
  }
});

/**
 * GET /secure-archive/files
 *
 * List all encrypted files for the user
 * Optional query params:
 * - folder: filter by folder
 */
secureArchive.get('/files', requireAuth(), async (c) => {
  const { userId } = getAuthContext(c);
  const folder = c.req.query('folder');

  try {
    let query = `
      SELECT
        id, filename, content_type, size, folder, created_at,
        conversation_title, conversation_provider, conversation_id,
        conversation_created_at, conversation_updated_at, message_count,
        has_images, has_code, first_message,
        parent_file_id, file_role, relative_path
      FROM encrypted_files
      WHERE user_id = ?
    `;
    const bindings: any[] = [userId];

    if (folder) {
      query += ' AND folder = ?';
      bindings.push(folder);
    }

    query += ' ORDER BY created_at DESC';

    const result = await c.env.DB.prepare(query).bind(...bindings).all();

    // Get folders list
    const foldersResult = await c.env.DB.prepare(`
      SELECT DISTINCT folder
      FROM encrypted_files
      WHERE user_id = ? AND folder IS NOT NULL
      ORDER BY folder
    `).bind(userId).all();

    const folders = foldersResult.results.map((row: any) => row.folder);

    return c.json({
      files: result.results,
      folders,
      total: result.results.length
    });
  } catch (error: any) {
    console.error('Error listing files:', error);
    return c.json({ error: 'Failed to list files', details: error.message }, 500);
  }
});

/**
 * GET /secure-archive/files/:fileId
 *
 * Download encrypted file
 * Returns encrypted file + IV (client will decrypt)
 */
secureArchive.get('/files/:fileId', requireAuth(), async (c) => {
  const { userId } = getAuthContext(c);
  const fileId = c.req.param('fileId');

  try {
    // Get metadata and verify ownership
    const metadata = await c.env.DB.prepare(`
      SELECT * FROM encrypted_files WHERE id = ? AND user_id = ?
    `).bind(fileId, userId).first();

    if (!metadata) {
      return c.json({ error: 'File not found or access denied' }, 404);
    }

    // Fetch encrypted file from R2
    const object = await c.env.R2_ARCHIVE.get(metadata.r2_key);
    if (!object) {
      return c.json({ error: 'File not found in storage' }, 404);
    }

    const encryptedData = await object.arrayBuffer();

    // Return file data + metadata
    return c.json({
      fileId: metadata.id,
      filename: metadata.filename,
      contentType: metadata.content_type,
      size: metadata.size,
      iv: metadata.iv, // Client needs this to decrypt
      folder: metadata.folder,
      createdAt: metadata.created_at,
      data: Array.from(new Uint8Array(encryptedData)) // Convert to array for JSON
    });
  } catch (error: any) {
    console.error('Error downloading file:', error);
    return c.json({ error: 'Failed to download file', details: error.message }, 500);
  }
});

/**
 * GET /secure-archive/files/:fileId/raw
 *
 * Download encrypted file as binary stream
 * More efficient for large files (no base64/JSON overhead)
 * Returns encrypted bytes directly - client decrypts
 */
secureArchive.get('/files/:fileId/raw', requireAuth(), async (c) => {
  const { userId } = getAuthContext(c);
  const fileId = c.req.param('fileId');

  try {
    // Get metadata and verify ownership
    const metadata = await c.env.DB.prepare(`
      SELECT * FROM encrypted_files WHERE id = ? AND user_id = ?
    `).bind(fileId, userId).first();

    if (!metadata) {
      return c.json({ error: 'File not found or access denied' }, 404);
    }

    // Fetch encrypted file from R2
    const object = await c.env.R2_ARCHIVE.get(metadata.r2_key);
    if (!object) {
      return c.json({ error: 'File not found in storage' }, 404);
    }

    // Return binary stream with metadata in headers
    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(metadata.size),
        'X-Original-Filename': encodeURIComponent(metadata.filename as string),
        'X-Original-Content-Type': metadata.content_type as string,
        'X-Encryption-IV': metadata.iv as string,
        'X-File-Id': fileId,
      },
    });
  } catch (error: any) {
    console.error('Error downloading file:', error);
    return c.json({ error: 'Failed to download file', details: error.message }, 500);
  }
});

/**
 * POST /secure-archive/upload/media
 *
 * Upload encrypted media file (images, audio, video)
 * Separate from conversation uploads for efficiency
 * Links to parent conversation via parentFileId
 */
secureArchive.post('/upload/media', requireAuth(), async (c) => {
  const { userId } = getAuthContext(c);

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const iv = formData.get('iv') as string;
    const filename = formData.get('filename') as string;
    const contentType = formData.get('contentType') as string;
    const parentFileId = formData.get('parentFileId') as string;
    const relativePath = formData.get('relativePath') as string | null;

    if (!file || !iv || !filename || !contentType || !parentFileId) {
      return c.json({ error: 'Missing required fields: file, iv, filename, contentType, parentFileId' }, 400);
    }

    // Verify parent file exists and belongs to user
    const parentFile = await c.env.DB.prepare(
      'SELECT id FROM encrypted_files WHERE id = ? AND user_id = ?'
    ).bind(parentFileId, userId).first();

    if (!parentFile) {
      return c.json({ error: 'Parent file not found or access denied' }, 404);
    }

    // Generate unique file ID
    const fileId = crypto.randomUUID();
    const r2Key = `${userId}/media/${fileId}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await c.env.R2_ARCHIVE.put(r2Key, arrayBuffer, {
      customMetadata: {
        userId,
        filename,
        contentType,
        parentFileId,
        uploadedAt: Date.now().toString()
      }
    });

    // Store metadata in D1
    await c.env.DB.prepare(`
      INSERT INTO encrypted_files (
        id, user_id, filename, content_type, size, iv, r2_key, folder, created_at,
        parent_file_id, file_role, relative_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      fileId,
      userId,
      filename,
      contentType,
      arrayBuffer.byteLength,
      iv,
      r2Key,
      'media',
      Date.now(),
      parentFileId,
      'media',
      relativePath || null
    ).run();

    return c.json({
      fileId,
      filename,
      size: arrayBuffer.byteLength,
      parentFileId,
      message: 'Media uploaded successfully'
    });
  } catch (error: any) {
    console.error('Error uploading media:', error);
    return c.json({ error: 'Failed to upload media', details: error.message }, 500);
  }
});

/**
 * GET /secure-archive/files/:fileId/media
 *
 * List all media files associated with a conversation
 */
secureArchive.get('/files/:fileId/media', requireAuth(), async (c) => {
  const { userId } = getAuthContext(c);
  const fileId = c.req.param('fileId');

  try {
    // Verify parent file exists and belongs to user
    const parentFile = await c.env.DB.prepare(
      'SELECT id FROM encrypted_files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first();

    if (!parentFile) {
      return c.json({ error: 'File not found or access denied' }, 404);
    }

    // Get all media files for this conversation
    const mediaFiles = await c.env.DB.prepare(`
      SELECT id, filename, content_type, size, relative_path, created_at
      FROM encrypted_files
      WHERE parent_file_id = ? AND user_id = ?
      ORDER BY created_at ASC
    `).bind(fileId, userId).all();

    return c.json({
      parentFileId: fileId,
      media: mediaFiles.results,
      count: mediaFiles.results.length
    });
  } catch (error: any) {
    console.error('Error listing media:', error);
    return c.json({ error: 'Failed to list media', details: error.message }, 500);
  }
});

/**
 * DELETE /secure-archive/files/:fileId
 *
 * Delete encrypted file from R2 and database
 */
secureArchive.delete('/files/:fileId', requireAuth(), async (c) => {
  const { userId } = getAuthContext(c);
  const fileId = c.req.param('fileId');

  try {
    // Get metadata and verify ownership
    const metadata = await c.env.DB.prepare(`
      SELECT * FROM encrypted_files WHERE id = ? AND user_id = ?
    `).bind(fileId, userId).first();

    if (!metadata) {
      return c.json({ error: 'File not found or access denied' }, 404);
    }

    // Delete from R2
    await c.env.R2_ARCHIVE.delete(metadata.r2_key);

    // Delete from D1
    await c.env.DB.prepare(
      'DELETE FROM encrypted_files WHERE id = ?'
    ).bind(fileId).run();

    return c.json({ success: true, message: 'File deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    return c.json({ error: 'Failed to delete file', details: error.message }, 500);
  }
});

/**
 * DELETE /secure-archive/folders/:folderName
 *
 * Delete all files in a folder
 */
secureArchive.delete('/folders/:folderName', requireAuth(), async (c) => {
  const { userId } = getAuthContext(c);
  const folderName = c.req.param('folderName');

  try {
    // Get all files in folder
    const files = await c.env.DB.prepare(`
      SELECT id, r2_key FROM encrypted_files
      WHERE user_id = ? AND folder = ?
    `).bind(userId, folderName).all();

    if (files.results.length === 0) {
      return c.json({ error: 'Folder not found or empty' }, 404);
    }

    // Delete from R2
    for (const file of files.results) {
      await c.env.R2_ARCHIVE.delete((file as any).r2_key);
    }

    // Delete from D1
    await c.env.DB.prepare(`
      DELETE FROM encrypted_files WHERE user_id = ? AND folder = ?
    `).bind(userId, folderName).run();

    return c.json({
      success: true,
      message: `Deleted ${files.results.length} files from folder "${folderName}"`
    });
  } catch (error: any) {
    console.error('Error deleting folder:', error);
    return c.json({ error: 'Failed to delete folder', details: error.message }, 500);
  }
});

export { secureArchive };
