import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

const ARCHIVE_ROOT = '/Users/tem/openai-export-parser/output_v13_final';

// Get list of all conversations (metadata only)
app.get('/api/conversations', async (req, res) => {
  try {
    const folders = await fs.readdir(ARCHIVE_ROOT);
    const conversations = [];

    for (const folder of folders) {
      // Skip _ prefixed folders, only process timestamp folders
      if (folder.startsWith('_') || !/^\d{4}-\d{2}-\d{2}/.test(folder)) {
        continue;
      }

      try {
        const jsonPath = path.join(ARCHIVE_ROOT, folder, 'conversation.json');
        const data = await fs.readFile(jsonPath, 'utf-8');
        const parsed = JSON.parse(data);

        // Extract message count from mapping
        let messageCount = 0;
        if (parsed.mapping) {
          messageCount = Object.values(parsed.mapping).filter(
            node => node.message && node.message.content?.parts?.length > 0
          ).length;
        }

        conversations.push({
          id: parsed.id || folder,
          title: parsed.title || 'Untitled',
          folder: folder,
          message_count: messageCount,
          created_at: parsed.create_time,
          updated_at: parsed.update_time,
        });
      } catch (err) {
        // Skip folders without conversation.json or with parsing errors
        console.warn(`Skipping folder ${folder}: ${err.message}`);
      }
    }

    console.log(`Found ${conversations.length} conversations`);
    res.json({ conversations });
  } catch (error) {
    console.error('Error listing conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get full conversation data including all messages
app.get('/api/conversations/:folder', async (req, res) => {
  try {
    const jsonPath = path.join(ARCHIVE_ROOT, req.params.folder, 'conversation.json');
    const data = await fs.readFile(jsonPath, 'utf-8');
    const parsed = JSON.parse(data);

    // Parse messages from mapping
    const messages = [];
    if (parsed.mapping) {
      Object.values(parsed.mapping).forEach((node) => {
        if (node.message && node.message.content?.parts?.length > 0) {
          const role = node.message.author?.role || 'unknown';

          // Handle multimodal content (text + images)
          const parts = node.message.content.parts;
          const textParts = parts.map(part => {
            if (typeof part === 'string') {
              return part;
            } else if (typeof part === 'object' && part !== null) {
              // Handle image asset pointers and other objects
              if (part.content_type === 'image_asset_pointer') {
                const assetPointer = part.asset_pointer || '';
                // Match both file-XXXXX (old-style) and file_XXXXX (sediment new-style)
                const fileIdMatch = assetPointer.match(/:\/\/(file[-_][A-Za-z0-9]+)/);
                const fileId = fileIdMatch ? fileIdMatch[1] : 'image';
                return `[Image: ${fileId}]`;
              }
              // For other objects, try to extract meaningful text
              return JSON.stringify(part);
            }
            return '';
          }).filter(p => p.length > 0);

          const content = textParts.join('\n').trim();

          if (content.length > 0) {
            messages.push({
              role,
              content,
              id: node.message.id,
            });
          }
        }
      });
    }

    res.json({
      id: parsed.id || req.params.folder,
      title: parsed.title || 'Untitled',
      folder: req.params.folder,
      messages,
      created_at: parsed.create_time,
      updated_at: parsed.update_time,
    });
  } catch (error) {
    console.error(`Error loading conversation ${req.params.folder}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Get media mapping for a conversation (file-ID → hashed filename)
app.get('/api/conversations/:folder/media-mapping', async (req, res) => {
  try {
    const mediaPath = path.join(ARCHIVE_ROOT, req.params.folder, 'media');
    const jsonPath = path.join(ARCHIVE_ROOT, req.params.folder, 'conversation.json');
    const manifestPath = path.join(ARCHIVE_ROOT, req.params.folder, 'media_manifest.json');

    // Read conversation.json to get file annotations
    const data = await fs.readFile(jsonPath, 'utf-8');
    const parsed = JSON.parse(data);

    // Build comprehensive file metadata from attachments AND asset_pointers
    const fileMetadata = {}; // file-ID → { name, size, mimeType, ... }
    const assetPointers = {}; // file-service://file-{ID} → { url, filename }

    if (parsed.mapping) {
      Object.values(parsed.mapping).forEach((node) => {
        // Extract from metadata.attachments
        if (node.message?.metadata?.attachments) {
          node.message.metadata.attachments.forEach(att => {
            if (att.id) {
              fileMetadata[att.id] = {
                name: att.name,
                size: att.size,
                mimeType: att.mimeType,
                width: att.width,
                height: att.height
              };
            }
          });
        }

        // Extract from content parts (asset_pointer URLs)
        if (node.message?.content?.parts) {
          node.message.content.parts.forEach(part => {
            if (typeof part === 'object' && part.asset_pointer) {
              const assetPointer = part.asset_pointer;

              // Handle file-service:// URLs (old-style DALL-E)
              const fileServiceMatch = assetPointer.match(/file-service:\/\/(file-[A-Za-z0-9]+)/);
              if (fileServiceMatch) {
                const fileId = fileServiceMatch[1];

                // Extract filename from URL query parameter if present
                const filenameMatch = assetPointer.match(/filename%3D([^&]+)/);
                const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : null;

                assetPointers[fileId] = {
                  url: assetPointer,
                  filename: filename,
                  size_bytes: part.size_bytes
                };

                // Add to fileMetadata if not already there
                if (!fileMetadata[fileId] && filename) {
                  fileMetadata[fileId] = {
                    name: filename,
                    size: part.size_bytes,
                    mimeType: part.mime_type,
                    width: part.width,
                    height: part.height
                  };
                }
              }

              // Handle sediment:// URLs (new-style DALL-E)
              const sedimentMatch = assetPointer.match(/sediment:\/\/(file_[A-Za-z0-9]+)/);
              if (sedimentMatch) {
                const fileId = sedimentMatch[1]; // e.g., "file_0000000072d06230b9db9f737e19f8ee"

                assetPointers[fileId] = {
                  url: assetPointer,
                  filename: null, // Will be matched by file_id in filename
                  size_bytes: part.size_bytes
                };

                // Note: sediment files don't have filename in the URL
                // The file_id IS the identifier, and we'll match it to files like:
                // "file_0000000072d06230b9db9f737e19f8ee-c8df179b-c7b7-497b-a6e2-ab39dba9149a.png"
              }
            }
          });
        }
      });
    }

    console.log(`Extracted ${Object.keys(fileMetadata).length} file references (${Object.keys(assetPointers).length} from asset_pointers)`);
    console.log(`Sample fileMetadata:`, Object.keys(fileMetadata).slice(0, 5));
    console.log(`Sample asset_pointer filenames:`, Object.values(assetPointers).slice(0, 5).map(a => a.filename));

    // Read media_manifest.json if it exists (authoritative mapping)
    let manifestMapping = {};
    try {
      const manifestData = await fs.readFile(manifestPath, 'utf-8');
      manifestMapping = JSON.parse(manifestData);
    } catch (err) {
      console.warn(`No media_manifest.json for ${req.params.folder}`);
    }

    // Build comprehensive file indices from media directory
    const fileIndices = {
      byBasenameSize: new Map(), // (basename:size) → filepath
      byFileId: new Map(),        // file-ID → filepath
      bySize: new Map(),          // size → [filepaths]
      byBasename: new Map(),      // basename → filepath
      allFiles: []                // All file paths with metadata
    };

    try {
      const files = await fs.readdir(mediaPath);

      for (const file of files) {
        const filepath = path.join(mediaPath, file);
        let stats;
        try {
          stats = await fs.stat(filepath);
        } catch (err) {
          continue;
        }

        const fileSize = stats.size;
        const basename = path.basename(file);

        // Store file metadata
        fileIndices.allFiles.push({
          filepath: file,
          basename,
          size: fileSize
        });

        // Index 1: By (basename:size) - UNIVERSAL FALLBACK
        const key = `${basename}:${fileSize}`;
        fileIndices.byBasenameSize.set(key, file);

        // Index 2: By file-ID (file-{ID}_* in hashed filename)
        const fileIdMatch = basename.match(/^[a-f0-9]+_(file-[A-Za-z0-9]+)/);
        if (fileIdMatch) {
          fileIndices.byFileId.set(fileIdMatch[1], file);
        }

        // Index 3: By size (for DALL-E matching)
        if (!fileIndices.bySize.has(fileSize)) {
          fileIndices.bySize.set(fileSize, []);
        }
        fileIndices.bySize.get(fileSize).push(file);

        // Index 4: By basename alone (least reliable)
        const cleanBasename = basename.replace(/^[a-f0-9]+_/, ''); // Strip hash prefix
        if (!fileIndices.byBasename.has(cleanBasename)) {
          fileIndices.byBasename.set(cleanBasename, file);
        }

        // Index 5: By UUID (for asset_pointer matching)
        const uuidMatch = basename.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (uuidMatch) {
          const uuid = uuidMatch[1];
          if (!fileIndices.byBasename.has(uuid)) {
            fileIndices.byBasename.set(uuid, file);
          }
        }
      }
    } catch (err) {
      console.warn(`No media folder for ${req.params.folder}`);
    }

    // Build assetPointerMap by reverse-engineering from media files
    // This is THE KEY to matching DALL-E images!
    const assetPointerMap = {}; // file-service://file-{ID} → hashed filename

    // Strategy: For each media file with a UUID, try to match it to asset_pointers
    for (const file of fileIndices.allFiles) {
      const basename = file.basename;

      // Extract UUID from filename
      const uuidMatch = basename.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (uuidMatch) {
        const uuid = uuidMatch[1];
        const originalFilename = `${uuid}.webp`; // Most DALL-E images are webp

        // Check if this UUID exists in media_manifest
        if (manifestMapping[originalFilename]) {
          // Find all asset_pointers and match by size
          for (const [assetFileId, assetData] of Object.entries(assetPointers)) {
            if (assetData.size_bytes === file.size) {
              const assetPointer = assetData.url;
              assetPointerMap[assetPointer] = file.filepath;
              assetPointerMap[assetFileId] = file.filepath; // Also map by file-ID directly
              console.log(`  ✓ assetPointerMap: ${assetFileId} → ${file.filepath} (size: ${file.size})`);
            }
          }
        }
      }

      // Also try matching by exact file-ID in filename (old-style: file-XXXXX)
      const fileIdInName = basename.match(/^[a-f0-9]+_(file-[A-Za-z0-9]+)/);
      if (fileIdInName) {
        const fileId = fileIdInName[1];
        assetPointerMap[fileId] = file.filepath;
        assetPointerMap[`file-service://${fileId}`] = file.filepath;
      }

      // Also try matching sediment file_IDs (new-style: file_XXXXX)
      const sedimentIdInName = basename.match(/^[a-f0-9]+_(file_[A-Za-z0-9]+)/);
      if (sedimentIdInName) {
        const fileId = sedimentIdInName[1]; // e.g., "file_0000000072d06230b9db9f737e19f8ee"
        assetPointerMap[fileId] = file.filepath;
        assetPointerMap[`sediment://${fileId}`] = file.filepath;
        console.log(`  ✓ sediment assetPointerMap: ${fileId} → ${file.filepath}`);
      }
    }

    console.log(`  ✓ Built assetPointerMap with ${Object.keys(assetPointerMap).length} entries`);

    // Now apply comprehensive matching strategies (Python-compatible)
    const mediaMapping = {};
    const matchStats = {
      byManifest: 0,
      byFileId: 0,
      byAssetPointerMap: 0,
      byBasenameSize: 0,
      bySizeOnly: 0,
      byBasenameOnly: 0,
      unmatched: 0
    };

    // Collect ALL file-IDs from both attachments AND asset_pointers
    const allFileIds = new Set([
      ...Object.keys(fileMetadata),
      ...Object.keys(assetPointers)
    ]);

    for (const fileId of allFileIds) {
      const metadata = fileMetadata[fileId] || {};
      const assetData = assetPointers[fileId] || {};
      let matched = false;

      // Strategy 1: assetPointerMap (DALL-E images) - HIGHEST PRIORITY!
      if (assetPointerMap[fileId]) {
        mediaMapping[fileId] = assetPointerMap[fileId];
        matchStats.byAssetPointerMap++;
        matched = true;
        continue;
      }

      // Strategy 2: Manifest mapping
      if (metadata.name && manifestMapping[metadata.name]) {
        mediaMapping[fileId] = manifestMapping[metadata.name];
        matchStats.byManifest++;
        matched = true;
        continue;
      }

      // Strategy 3: File-ID in hashed filename
      if (fileIndices.byFileId.has(fileId)) {
        mediaMapping[fileId] = fileIndices.byFileId.get(fileId);
        matchStats.byFileId++;
        matched = true;
        continue;
      }

      // Strategy 4: UUID in filename (from asset_pointer)
      if (metadata.name) {
        const uuidMatch = metadata.name.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (uuidMatch) {
          const uuid = uuidMatch[1];
          if (fileIndices.byBasename.has(uuid)) {
            mediaMapping[fileId] = fileIndices.byBasename.get(uuid);
            matchStats.byBasenameSize++;
            matched = true;
            console.log(`  ✓ UUID match: ${fileId} → ${uuid} → ${mediaMapping[fileId]}`);
            continue;
          }
        }
      }

      // Strategy 5: Basename + size (most reliable fallback)
      if (metadata.name && metadata.size) {
        const key = `${metadata.name}:${metadata.size}`;
        if (fileIndices.byBasenameSize.has(key)) {
          mediaMapping[fileId] = fileIndices.byBasenameSize.get(key);
          matchStats.byBasenameSize++;
          matched = true;
          continue;
        }
      }

      // Strategy 6: Size only (for DALL-E with exact size match)
      const size = metadata.size || assetData.size_bytes;
      if (size && fileIndices.bySize.has(size)) {
        const candidates = fileIndices.bySize.get(size);
        if (candidates.length === 1) {
          mediaMapping[fileId] = candidates[0];
          matchStats.bySizeOnly++;
          matched = true;
          continue;
        }
      }

      // Strategy 7: Basename only (least reliable)
      if (metadata.name) {
        if (fileIndices.byBasename.has(metadata.name)) {
          mediaMapping[fileId] = fileIndices.byBasename.get(metadata.name);
          matchStats.byBasenameOnly++;
          matched = true;
          continue;
        }

        const matchingFile = fileIndices.allFiles.find(f =>
          f.basename.includes(metadata.name)
        );
        if (matchingFile) {
          mediaMapping[fileId] = matchingFile.filepath;
          matchStats.byBasenameOnly++;
          matched = true;
          continue;
        }
      }

      if (!matched) {
        matchStats.unmatched++;
        console.warn(`❌ Unmatched: ${fileId} (size: ${size || 'unknown'})`);
      }
    }

    console.log(`✓ Media mapping for ${req.params.folder}:`, matchStats);

    res.json({
      fileMapping: fileMetadata,
      mediaMapping,
      stats: matchStats
    });
  } catch (error) {
    console.error(`Error getting media mapping for ${req.params.folder}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Serve media files
app.get('/api/conversations/:folder/media/:filename', async (req, res) => {
  try {
    const mediaPath = path.join(ARCHIVE_ROOT, req.params.folder, 'media', req.params.filename);

    // Determine content type
    const ext = path.extname(req.params.filename).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    const fileData = await fs.readFile(mediaPath);
    res.send(fileData);
  } catch (error) {
    console.error(`Error serving media ${req.params.folder}/${req.params.filename}:`, error);
    res.status(404).json({ error: 'Media file not found' });
  }
});

// Import a conversation.json file into the archive
app.post('/api/import/conversation', async (req, res) => {
  try {
    const { conversation, filename } = req.body;

    if (!conversation) {
      return res.status(400).json({ error: 'No conversation data provided' });
    }

    // Parse if string, or use directly if object
    let parsed;
    try {
      parsed = typeof conversation === 'string' ? JSON.parse(conversation) : conversation;
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON format', details: err.message });
    }

    // Validate required fields
    if (!parsed.id && !parsed.title) {
      return res.status(400).json({ error: 'conversation.json must have at least an id or title field' });
    }

    // Generate folder name
    const timestamp = Date.now();
    const date = new Date(parsed.create_time ? parsed.create_time * 1000 : timestamp);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const uuid = parsed.id || `imported_${timestamp}`;
    const folderName = `${dateStr}_imported_${uuid.substring(0, 8)}`;

    // Check if already exists
    const folderPath = path.join(ARCHIVE_ROOT, folderName);
    try {
      await fs.access(folderPath);
      return res.status(409).json({
        error: 'Conversation already imported',
        folder: folderName
      });
    } catch {
      // Folder doesn't exist, continue with import
    }

    // Create folder and save conversation.json
    await fs.mkdir(folderPath, { recursive: true });
    const jsonPath = path.join(folderPath, 'conversation.json');
    await fs.writeFile(jsonPath, JSON.stringify(parsed, null, 2), 'utf-8');

    // Create media folder if conversation has media references
    let hasMedia = false;
    if (parsed.mapping) {
      for (const node of Object.values(parsed.mapping)) {
        if (node.message?.content?.parts) {
          for (const part of node.message.content.parts) {
            if (typeof part === 'object' && part.content_type === 'image_asset_pointer') {
              hasMedia = true;
              break;
            }
          }
        }
        if (hasMedia) break;
      }
    }

    if (hasMedia) {
      const mediaPath = path.join(folderPath, 'media');
      await fs.mkdir(mediaPath, { recursive: true });
    }

    // Count messages
    let messageCount = 0;
    if (parsed.mapping) {
      messageCount = Object.values(parsed.mapping).filter(
        node => node.message && node.message.content?.parts?.length > 0
      ).length;
    }

    console.log(`✓ Imported conversation: ${parsed.title || 'Untitled'} (${messageCount} messages) → ${folderName}`);

    res.json({
      success: true,
      folder: folderName,
      title: parsed.title || 'Untitled',
      message_count: messageCount,
      has_media: hasMedia
    });
  } catch (error) {
    console.error('Error importing conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`🗂️  Archive server running on http://localhost:${PORT}`);
  console.log(`📂 Serving: ${ARCHIVE_ROOT}`);
});
