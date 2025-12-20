import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import multer from 'multer';
import { ConversationParser, IncrementalImporter } from './src/services/parser/index.ts';

const app = express();

// CORS configuration - allow requests from production and development
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // Allow production domains
    if (origin === 'https://studio.humanizer.com' ||
        origin === 'https://humanizer.com' ||
        origin === 'https://workbench.humanizer.com' ||
        origin.endsWith('.trycloudflare.com') ||
        origin.endsWith('.pages.dev')) {
      return callback(null, true);
    }

    // Deny others
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' })); // Allow large conversation.json files

// Archive management - support multiple archives or single custom path
// If ARCHIVE_PATH env is set (Electron mode), use that directly
// Otherwise, use the base directory structure
const CUSTOM_ARCHIVE_PATH = process.env.ARCHIVE_PATH;
const ARCHIVES_BASE_DIR = CUSTOM_ARCHIVE_PATH || '/Users/tem/openai-export-parser';
const DEFAULT_ARCHIVE = 'output_v13_final';
const ARCHIVE_CONFIG_FILE = path.join(os.homedir(), '.humanizer', 'archive-config.json');

// Track if we're using a custom archive path (Electron mode)
const isCustomArchiveMode = !!CUSTOM_ARCHIVE_PATH;

// Dynamic archive root - can be changed at runtime
let currentArchiveName = isCustomArchiveMode ? path.basename(CUSTOM_ARCHIVE_PATH) : DEFAULT_ARCHIVE;
let ARCHIVE_ROOT = isCustomArchiveMode ? CUSTOM_ARCHIVE_PATH : path.join(ARCHIVES_BASE_DIR, currentArchiveName);

if (isCustomArchiveMode) {
  console.log(`📂 Custom archive mode: ${ARCHIVE_ROOT}`);
}

const SESSION_STORAGE_DIR = path.join(os.homedir(), '.humanizer', 'sessions');
const ARCHIVE_UPLOADS_DIR = '/tmp/archive-uploads';

// Load archive config from disk
async function loadArchiveConfig() {
  // Skip if using custom archive path (Electron mode)
  if (isCustomArchiveMode) {
    console.log(`📂 Using custom archive path: ${ARCHIVE_ROOT}`);
    return;
  }

  try {
    const configDir = path.dirname(ARCHIVE_CONFIG_FILE);
    await fs.mkdir(configDir, { recursive: true });
    const data = await fs.readFile(ARCHIVE_CONFIG_FILE, 'utf-8');
    const config = JSON.parse(data);
    if (config.currentArchive) {
      const archivePath = path.join(ARCHIVES_BASE_DIR, config.currentArchive);
      try {
        await fs.access(archivePath);
        currentArchiveName = config.currentArchive;
        ARCHIVE_ROOT = archivePath;
        console.log(`📂 Loaded archive config: ${currentArchiveName}`);
      } catch {
        console.warn(`⚠️ Configured archive "${config.currentArchive}" not found, using default`);
      }
    }
  } catch (err) {
    // Config doesn't exist yet, use default
    console.log(`📂 No archive config found, using default: ${DEFAULT_ARCHIVE}`);
  }
}

// Save archive config to disk
async function saveArchiveConfig() {
  try {
    const configDir = path.dirname(ARCHIVE_CONFIG_FILE);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(ARCHIVE_CONFIG_FILE, JSON.stringify({
      currentArchive: currentArchiveName,
      lastSwitched: new Date().toISOString()
    }, null, 2));
  } catch (err) {
    console.error('Failed to save archive config:', err);
  }
}

// Get current archive root (for use in other parts of the code)
function getArchiveRoot() {
  return ARCHIVE_ROOT;
}

// Configure multer for ZIP uploads
const upload = multer({
  dest: ARCHIVE_UPLOADS_DIR,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB max (for large archives)
    fieldSize: 10 * 1024 * 1024 * 1024 // 10GB field size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  }
});

// In-memory job queue for archive imports
const importJobs = new Map();

// Helper: Generate unique job ID
function generateJobId() {
  return `import-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Ensure directories exist and load config
(async () => {
  try {
    await fs.mkdir(SESSION_STORAGE_DIR, { recursive: true });
    await fs.mkdir(ARCHIVE_UPLOADS_DIR, { recursive: true });
    await loadArchiveConfig();
    console.log(`📁 Session storage directory ready: ${SESSION_STORAGE_DIR}`);
    console.log(`📁 Archive uploads directory ready: ${ARCHIVE_UPLOADS_DIR}`);
  } catch (error) {
    console.error('Failed to create directories:', error);
  }
})();

// ============================================================
// ARCHIVE MANAGEMENT ENDPOINTS
// ============================================================

// GET /api/archives - List all available archives
app.get('/api/archives', async (req, res) => {
  try {
    // Custom archive mode (Electron) - return only the single custom archive
    if (isCustomArchiveMode) {
      const contents = await fs.readdir(ARCHIVE_ROOT);
      const convFolders = contents.filter(f => /^\d{4}-\d{2}-\d{2}/.test(f));
      const stat = await fs.stat(ARCHIVE_ROOT);

      return res.json({
        archives: [{
          name: currentArchiveName,
          path: ARCHIVE_ROOT,
          conversationCount: convFolders.length,
          isActive: true,
          createdAt: stat.birthtime.toISOString(),
          modifiedAt: stat.mtime.toISOString(),
        }],
        current: currentArchiveName,
        basePath: path.dirname(ARCHIVE_ROOT),
        isCustomMode: true,
      });
    }

    // Multi-archive mode - list from base directory
    const entries = await fs.readdir(ARCHIVES_BASE_DIR, { withFileTypes: true });
    const archives = [];

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const archivePath = path.join(ARCHIVES_BASE_DIR, entry.name);
        try {
          // Check if it looks like a valid archive (has conversation folders)
          const contents = await fs.readdir(archivePath);
          const hasConversations = contents.some(f => /^\d{4}-\d{2}-\d{2}/.test(f));

          if (hasConversations || entry.name === currentArchiveName) {
            // Count conversations
            const convFolders = contents.filter(f => /^\d{4}-\d{2}-\d{2}/.test(f));
            const stat = await fs.stat(archivePath);

            archives.push({
              name: entry.name,
              path: archivePath,
              conversationCount: convFolders.length,
              isActive: entry.name === currentArchiveName,
              createdAt: stat.birthtime.toISOString(),
              modifiedAt: stat.mtime.toISOString(),
            });
          }
        } catch (err) {
          // Skip directories we can't read
        }
      }
    }

    // Sort by modification date, newest first
    archives.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

    res.json({
      archives,
      current: currentArchiveName,
      basePath: ARCHIVES_BASE_DIR,
      isCustomMode: false,
    });
  } catch (error) {
    console.error('Error listing archives:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/archives/current - Get current archive info
app.get('/api/archives/current', async (req, res) => {
  try {
    const contents = await fs.readdir(ARCHIVE_ROOT);
    const convFolders = contents.filter(f => /^\d{4}-\d{2}-\d{2}/.test(f));
    const stat = await fs.stat(ARCHIVE_ROOT);

    res.json({
      name: currentArchiveName,
      path: ARCHIVE_ROOT,
      conversationCount: convFolders.length,
      createdAt: stat.birthtime.toISOString(),
      modifiedAt: stat.mtime.toISOString(),
    });
  } catch (error) {
    console.error('Error getting current archive:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/archives/switch - Switch to a different archive
app.post('/api/archives/switch', async (req, res) => {
  try {
    const { archiveName } = req.body;

    if (!archiveName) {
      return res.status(400).json({ error: 'archiveName is required' });
    }

    const archivePath = path.join(ARCHIVES_BASE_DIR, archiveName);

    // Verify archive exists
    try {
      await fs.access(archivePath);
    } catch {
      return res.status(404).json({ error: `Archive "${archiveName}" not found` });
    }

    // Switch to new archive
    const previousArchive = currentArchiveName;
    currentArchiveName = archiveName;
    ARCHIVE_ROOT = archivePath;

    // Save config
    await saveArchiveConfig();

    // Count conversations in new archive
    const contents = await fs.readdir(ARCHIVE_ROOT);
    const convFolders = contents.filter(f => /^\d{4}-\d{2}-\d{2}/.test(f));

    console.log(`🔄 Switched archive: ${previousArchive} → ${currentArchiveName} (${convFolders.length} conversations)`);

    res.json({
      success: true,
      previousArchive,
      currentArchive: currentArchiveName,
      path: ARCHIVE_ROOT,
      conversationCount: convFolders.length,
    });
  } catch (error) {
    console.error('Error switching archive:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/archives/create - Create a new empty archive
app.post('/api/archives/create', async (req, res) => {
  try {
    const { name } = req.body;

    // Generate name if not provided
    const archiveName = name || `archive_${new Date().toISOString().split('T')[0]}_${Date.now().toString(36)}`;
    const archivePath = path.join(ARCHIVES_BASE_DIR, archiveName);

    // Check if already exists
    try {
      await fs.access(archivePath);
      return res.status(409).json({ error: `Archive "${archiveName}" already exists` });
    } catch {
      // Doesn't exist, good to create
    }

    // Create the directory
    await fs.mkdir(archivePath, { recursive: true });

    console.log(`📁 Created new archive: ${archiveName}`);

    res.json({
      success: true,
      name: archiveName,
      path: archivePath,
    });
  } catch (error) {
    console.error('Error creating archive:', error);
    res.status(500).json({ error: error.message });
  }
});

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
        // Count ALL messages with a message object (not just those with content.parts)
        let messageCount = 0;
        if (parsed.mapping) {
          messageCount = Object.values(parsed.mapping).filter(
            node => node.message !== undefined && node.message !== null
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
    const htmlPath = path.join(ARCHIVE_ROOT, req.params.folder, 'conversation.html');

    const data = await fs.readFile(jsonPath, 'utf-8');
    const parsed = JSON.parse(data);

    // Extract assetPointerMap from HTML - this has the complete file-service://file-XXX → hashedName mappings
    let assetPointerMap = {};
    try {
      const htmlData = await fs.readFile(htmlPath, 'utf-8');

      // Extract the assetPointerMap object from the HTML JavaScript
      // It's defined as: const assetPointerMap = {...};
      const assetPointerMapMatch = htmlData.match(/const assetPointerMap = ({[^;]+});/);
      if (assetPointerMapMatch) {
        assetPointerMap = JSON.parse(assetPointerMapMatch[1]);
        console.log(`🗺️  Extracted assetPointerMap with ${Object.keys(assetPointerMap).length} mappings`);
      }
    } catch (htmlErr) {
      console.warn(`Could not extract assetPointerMap from ${req.params.folder}:`, htmlErr.message);
    }

    // Fallback: Scan media folder to supplement assetPointerMap (handles sediment:// URLs and mixed conversations)
    try {
      const mediaDir = path.join(ARCHIVE_ROOT, req.params.folder, 'media');
      const mediaFiles = await fs.readdir(mediaDir);
      const unmappedCount = mediaFiles.length - Object.keys(assetPointerMap).length;

      if (unmappedCount > 0) {
        console.log(`📂 Found ${unmappedCount} unmapped files, scanning media folder...`);

        // Build map from file IDs found in filenames
        // Pattern: {hash}_{file_id}-{uuid}.{ext}
        // Example: 07a0f38e142c_file_00000000d9986230bb38cb21f1562ab8-d0c2b633-90cf-42c5-bf36-bfc8d07a0fd0.png
        mediaFiles.forEach(filename => {
          // Match both hex hashes and alphanumeric file IDs (case-insensitive)
          const match = filename.match(/^[a-f0-9]+_(file[-_][A-Za-z0-9]+)-/);
          if (match) {
            const fileId = match[1];
            // Only add if not already in map
            const fileServiceKey = `file-service://${fileId}`;
            const sedimentKey = `sediment://${fileId}`;

            if (!assetPointerMap[fileServiceKey] && !assetPointerMap[sedimentKey]) {
              // Store mapping with both URL schemes for compatibility
              assetPointerMap[fileServiceKey] = filename;
              assetPointerMap[sedimentKey] = filename;
              console.log(`✅ Mapped ${fileId} → ${filename.substring(0, 50)}...`);
            }
          }
        });
        console.log(`🗺️  Total mapped: ${Object.keys(assetPointerMap).length / 2} file IDs`);
      }
    } catch (mediaErr) {
      console.warn(`Could not scan media folder for ${req.params.folder}:`, mediaErr.message);
    }

    // Try to load media_manifest.json for conversations with original filename mappings
    let mediaManifest = {};
    try {
      const manifestPath = path.join(ARCHIVE_ROOT, req.params.folder, 'media_manifest.json');
      const manifestData = await fs.readFile(manifestPath, 'utf-8');
      mediaManifest = JSON.parse(manifestData);
      console.log(`📋 Loaded media_manifest.json with ${Object.keys(mediaManifest).length} entries`);
    } catch (manifestErr) {
      // No manifest file - that's okay, not all conversations have it
    }

    // Build file ID to hashed filename mapping using assetPointerMap
    const fileIdToHashedName = {};

    if (parsed.mapping && Object.keys(assetPointerMap).length > 0) {
      Object.values(parsed.mapping).forEach((node) => {
        if (node.message?.content?.parts) {
          node.message.content.parts.forEach(part => {
            // Handle both images and audio
            if (part && (part.content_type === 'image_asset_pointer' || part.content_type === 'audio_asset_pointer')) {
              const assetPointer = part.asset_pointer || '';
              // Match both file- (hyphen) and file_ (underscore) formats
              const fileIdMatch = assetPointer.match(/:\/\/(file[-_][A-Za-z0-9]+)/);
              const fileId = fileIdMatch ? fileIdMatch[1] : null;

              if (!fileId || !assetPointer) return;

              // Look up in assetPointerMap using full asset pointer
              const hashedName = assetPointerMap[assetPointer];
              if (hashedName) {
                fileIdToHashedName[fileId] = hashedName;
              }
            }
          });
        }
      });
    }

    // Supplement with media_manifest.json mapping (for conversations with original filenames)
    if (Object.keys(mediaManifest).length > 0 && parsed.mapping) {
      Object.values(parsed.mapping).forEach((node) => {
        // Check if this message has attachments metadata
        if (node.message?.metadata?.attachments) {
          node.message.metadata.attachments.forEach(attachment => {
            const fileId = attachment.id; // e.g. "file-Jgm6LLn3ENzfwxpRMBH7tq"
            const originalName = attachment.name; // e.g. "IMG_0765 3.JPG"

            if (!fileId || !originalName) return;

            // Skip if already mapped
            if (fileIdToHashedName[fileId]) return;

            // Look up the hashed filename in the manifest
            if (mediaManifest[originalName]) {
              fileIdToHashedName[fileId] = mediaManifest[originalName];
              console.log(`📋 Manifest mapping: ${fileId} → ${originalName} → ${mediaManifest[originalName]}`);
            }
          });
        }
      });
    }

    console.log(`🔗 Built mapping for ${Object.keys(fileIdToHashedName).length}/${Object.keys(assetPointerMap).length + Object.keys(mediaManifest).length} file IDs`);
    if (Object.keys(fileIdToHashedName).length > 0) {
      console.log('Sample mappings:', Object.keys(fileIdToHashedName).slice(0, 3).map(id => `${id.substring(0, 25)}... → ${fileIdToHashedName[id].substring(0, 45)}...`));
    }

    // Parse messages from mapping
    const messages = [];
    if (parsed.mapping) {
      Object.values(parsed.mapping).forEach((node) => {
        if (node.message && node.message.content?.parts?.length > 0) {
          const role = node.message.author?.role || 'unknown';

          // Handle multimodal content (text + images + audio)
          const parts = node.message.content.parts;
          const textParts = parts.map(part => {
            if (typeof part === 'string') {
              return part;
            } else if (typeof part === 'object' && part !== null) {
              // Handle audio transcriptions
              if (part.content_type === 'audio_transcription') {
                return part.text || '';
              }
              // Handle audio asset pointers
              if (part.content_type === 'audio_asset_pointer') {
                const assetPointer = part.asset_pointer || '';
                const fileIdMatch = assetPointer.match(/:\/\/(file[-_][A-Za-z0-9]+)/);
                const fileId = fileIdMatch ? fileIdMatch[1] : 'audio';
                return `[Audio: ${fileId}.${part.format || 'wav'}]`;
              }
              // Handle image asset pointers
              if (part.content_type === 'image_asset_pointer') {
                const assetPointer = part.asset_pointer || '';
                // Match both file- (hyphen) and file_ (underscore) formats
                const fileIdMatch = assetPointer.match(/:\/\/(file[-_][A-Za-z0-9]+)/);
                const fileId = fileIdMatch ? fileIdMatch[1] : 'image';
                return `[Image: ${fileId}]`;
              }
              // Skip other object types (like real_time_user_audio_video_asset_pointer)
              return '';
            }
            return '';
          }).filter(p => p.length > 0);

          let content = textParts.join('\n').trim();

          // Replace [Image: file-XXXXX] or [Image: file_XXXXX] placeholders with actual images
          if (content.includes('[Image:') && Object.keys(fileIdToHashedName).length > 0) {
            let replacementCount = 0;
            // Match both file- (hyphen) and file_ (underscore) formats
            content = content.replace(/\[Image:\s*(file[-_][^\]]+)\]/g, (match, fileId) => {
              // Get hashed filename directly from multi-strategy mapping
              const hashedName = fileIdToHashedName[fileId];
              if (!hashedName) {
                console.warn(`❌ No mapping found for file ID: ${fileId}`);
                return match;
              }

              // Build absolute URL to archive server (URL-encode filename for spaces and special chars)
              const imageUrl = `http://localhost:3002/api/conversations/${encodeURIComponent(req.params.folder)}/media/${encodeURIComponent(hashedName)}`;
              replacementCount++;
              console.log(`✅ Replaced image ${replacementCount}: ${fileId.substring(0, 20)}... -> ${hashedName.substring(0, 40)}...`);
              return `![Image](${imageUrl})`;
            });
            if (replacementCount > 0) {
              console.log(`📸 Total images replaced in message: ${replacementCount}`);
            }
          }

          // Replace [Audio: file-XXXXX.wav] placeholders with actual audio players
          if (content.includes('[Audio:') && Object.keys(fileIdToHashedName).length > 0) {
            let replacementCount = 0;
            // Match both file- (hyphen) and file_ (underscore) formats
            content = content.replace(/\[Audio:\s*(file[-_][A-Za-z0-9]+)\.(wav|mp3|m4a)\]/g, (match, fileId, ext) => {
              // Get hashed filename directly from multi-strategy mapping
              const hashedName = fileIdToHashedName[fileId];
              if (!hashedName) {
                console.warn(`❌ No mapping found for audio file ID: ${fileId}`);
                return match;
              }

              // Build absolute URL to archive server (URL-encode filename for spaces and special chars)
              const audioUrl = `http://localhost:3002/api/conversations/${encodeURIComponent(req.params.folder)}/media/${encodeURIComponent(hashedName)}`;
              replacementCount++;
              console.log(`✅ Replaced audio ${replacementCount}: ${fileId.substring(0, 20)}... -> ${hashedName.substring(0, 40)}...`);
              return `[AUDIO:${audioUrl}]`;
            });
            if (replacementCount > 0) {
              console.log(`🎵 Total audio files replaced in message: ${replacementCount}`);
            }
          }

          if (content.length > 0) {
            messages.push({
              role,
              content,
              id: node.message.id,
              created_at: node.message.create_time,
            });
          }
        }
      });
    }

    // Build enhanced media manifest for client-side URL rewriting
    const enhancedManifest = {
      files: mediaManifest, // original filename -> hashed filename
      assetPointers: assetPointerMap, // file-service://... -> hashed filename
      fileIds: fileIdToHashedName, // file-XXXXX -> hashed filename
      fileHashes: {}, // Will be populated if there are sediment:// style hashes
      sizeToFiles: {}, // For fallback matching (not populated here, but structure matches)
    };

    // Extract file hashes from assetPointerMap (sediment:// URLs)
    Object.entries(assetPointerMap).forEach(([key, value]) => {
      if (key.startsWith('sediment://')) {
        const hashMatch = key.match(/sediment:\/\/(file_[a-f0-9]+)/);
        if (hashMatch) {
          enhancedManifest.fileHashes[hashMatch[1]] = value;
        }
      }
    });

    res.json({
      id: parsed.id || req.params.folder,
      title: parsed.title || 'Untitled',
      folder: req.params.folder,
      messages,
      created_at: parsed.create_time,
      updated_at: parsed.update_time,
      // Include media manifest for client-side URL rewriting fallback
      mediaManifest: enhancedManifest,
      mediaBaseUrl: `/api/conversations/${encodeURIComponent(req.params.folder)}/media/`,
    });
  } catch (error) {
    console.error(`Error loading conversation ${req.params.folder}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Serve media files
app.get('/api/conversations/:folder/media/:filename', async (req, res) => {
  try {
    const mediaPath = path.join(ARCHIVE_ROOT, req.params.folder, 'media', req.params.filename);

    // Check if file exists
    await fs.access(mediaPath);

    // Determine content type
    const ext = path.extname(req.params.filename).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    const fileData = await fs.readFile(mediaPath);
    res.send(fileData);
  } catch (error) {
    console.error(`Error serving media ${req.params.folder}/${req.params.filename}:`, error);
    res.status(404).json({ error: 'Media file not found' });
  }
});

// Gallery endpoint - returns all images from conversations with media
app.get('/api/gallery', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const filterFolder = req.query.folder; // Optional: filter by specific conversation folder
    const searchQuery = req.query.search?.toLowerCase(); // Optional: search by filename or title

    const withMediaPath = path.join(ARCHIVE_ROOT, '_with_media');

    // Read all conversation folders in _with_media
    const folders = await fs.readdir(withMediaPath);
    const images = [];

    for (const folder of folders) {
      try {
        // If filterFolder is specified, skip folders that don't match
        if (filterFolder && folder !== filterFolder) continue;

        // Resolve symlink to actual conversation folder
        const symlinkPath = path.join(withMediaPath, folder);
        const stats = await fs.lstat(symlinkPath);

        if (!stats.isSymbolicLink() && !stats.isDirectory()) continue;

        const actualPath = stats.isSymbolicLink()
          ? await fs.realpath(symlinkPath)
          : symlinkPath;

        // Read conversation.json
        const conversationJsonPath = path.join(actualPath, 'conversation.json');
        const conversationData = JSON.parse(await fs.readFile(conversationJsonPath, 'utf-8'));

        // Read media files
        const mediaPath = path.join(actualPath, 'media');
        try {
          const mediaFiles = await fs.readdir(mediaPath);

          // Filter to image files only
          const imageFiles = mediaFiles.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
          });

          // Get image metadata from conversation messages
          const messages = Object.values(conversationData.mapping || {})
            .filter(node => node.message && node.message.content)
            .map(node => node.message);

          for (const imageFile of imageFiles) {
            // Find which message contains this image
            let messageIndex = -1;
            let imageMetadata = null;

            for (let i = 0; i < messages.length; i++) {
              const msg = messages[i];
              if (msg.content && msg.content.parts) {
                for (const part of msg.content.parts) {
                  if (typeof part === 'object' && part.content_type === 'image_asset_pointer') {
                    imageMetadata = {
                      width: part.width,
                      height: part.height,
                      size_bytes: part.size_bytes
                    };
                    messageIndex = i;
                    break;
                  }
                }
              }
              if (messageIndex !== -1) break;
            }

            const image = {
              url: `http://localhost:3002/api/conversations/${encodeURIComponent(folder)}/media/${encodeURIComponent(imageFile)}`,
              filename: imageFile,
              conversationFolder: folder,
              conversationTitle: conversationData.title || folder,
              conversationCreatedAt: conversationData.create_time || null,
              messageIndex: messageIndex,
              width: imageMetadata?.width,
              height: imageMetadata?.height,
              sizeBytes: imageMetadata?.size_bytes
            };

            // Apply search filter if specified
            if (searchQuery) {
              const matchesSearch =
                imageFile.toLowerCase().includes(searchQuery) ||
                (conversationData.title || '').toLowerCase().includes(searchQuery);

              if (!matchesSearch) continue;
            }

            images.push(image);
          }
        } catch (err) {
          // No media folder or can't read it, skip
          continue;
        }
      } catch (err) {
        console.error(`Error processing ${folder}:`, err.message);
        continue;
      }
    }

    // Sort by conversation creation date (newest first)
    images.sort((a, b) => (b.conversationCreatedAt || 0) - (a.conversationCreatedAt || 0));

    // Paginate
    const paginatedImages = images.slice(offset, offset + limit);

    res.json({
      images: paginatedImages,
      total: images.length,
      offset,
      limit,
      hasMore: offset + limit < images.length
    });
  } catch (error) {
    console.error('Error fetching gallery:', error);
    res.status(500).json({ error: 'Failed to fetch gallery' });
  }
});

// ============================================================
// TRANSFORMATION ENDPOINTS - Ollama Integration
// ============================================================

// AI Tell-Words Database (200+ phrases that indicate AI generation)
const AI_TELL_WORDS = [
  // Hedging phrases (expanded)
  'it is important to note', 'it\'s important to note', 'it should be noted',
  'it is crucial to', 'it\'s crucial to', 'it is vital to', 'it\'s vital to',
  'it is essential to', 'it\'s essential to', 'it is imperative to',
  'it must be emphasized', 'it should be emphasized', 'it bears mentioning',
  'notably', 'importantly', 'significantly', 'crucially',

  // Meta-commentary (expanded)
  'in conclusion', 'in summary', 'to summarize', 'overall',
  'as mentioned', 'as previously discussed', 'as we have seen',
  'it is worth noting', 'it\'s worth noting', 'it\'s worth mentioning',
  'as noted above', 'as discussed earlier', 'as stated previously',
  'to sum up', 'all in all', 'in light of', 'taking into account',

  // Realm/domain phrases (expanded)
  'in the realm of', 'in the domain of', 'in the field of', 'in the area of',
  'in the sphere of', 'in the landscape of', 'in the context of',
  'in the world of', 'within the framework of', 'in today\'s world',

  // Excessive formality (expanded)
  'furthermore', 'moreover', 'additionally', 'consequently',
  'thus', 'hence', 'therefore', 'accordingly',
  'nevertheless', 'nonetheless', 'notwithstanding',
  'subsequently', 'henceforth', 'whereby', 'wherein',
  'heretofore', 'thereafter', 'therein',

  // Vague intensifiers (expanded)
  'very important', 'highly significant', 'extremely crucial',
  'incredibly vital', 'particularly noteworthy',
  'exceptionally important', 'remarkably significant',
  'profoundly important', 'undeniably crucial',

  // Passive constructions (expanded)
  'it can be seen that', 'it is evident that', 'it is clear that',
  'it is apparent that', 'it should be understood that',
  'it has been shown that', 'it has been demonstrated that',
  'it can be argued that', 'it must be recognized that',
  'it cannot be denied that', 'it is widely acknowledged that',

  // Apologetic/uncertain (expanded)
  'it\'s worth mentioning', 'one might argue', 'one could say',
  'it could be argued', 'some may consider', 'some might say',
  'one may observe', 'it could be suggested', 'arguably',

  // List markers (expanded)
  'firstly', 'secondly', 'thirdly', 'lastly', 'finally',
  'in the first place', 'to begin with', 'first and foremost',

  // Academic distance (expanded)
  'the aforementioned', 'the abovementioned', 'the said',
  'such as', 'for instance', 'for example', 'namely',
  'specifically', 'in particular', 'that is to say',

  // Obvious statements (expanded)
  'it goes without saying', 'needless to say', 'obviously',
  'clearly', 'evidently', 'undoubtedly', 'certainly',
  'without a doubt', 'it is obvious that', 'it is clear that',

  // Exaggeration (expanded)
  'myriad', 'plethora', 'multitude', 'array', 'abundance',
  'delve into', 'embark on', 'navigate through', 'dive deep into',
  'explore the depths of', 'unpack', 'drill down into',

  // Buzzwords (expanded)
  'paradigm', 'synergy', 'leverage', 'utilize', 'utilization',
  'facilitate', 'optimize', 'streamline', 'enhance', 'enhancement',
  'robust', 'cutting-edge', 'state-of-the-art', 'innovative',
  'revolutionary', 'groundbreaking', 'transformative',
  'comprehensive', 'holistic', 'dynamic', 'scalable',
  'seamlessly', 'effortlessly', 'intuitively',

  // Common AI patterns (expanded)
  'remember that', 'keep in mind', 'bear in mind',
  'it\'s essential to', 'it is essential to',
  'you should', 'one should', 'we should',
  'it is recommended', 'it is advisable', 'it is suggested',

  // Filler phrases (expanded)
  'in order to', 'due to the fact that', 'for the purpose of',
  'with regard to', 'in relation to', 'with respect to',
  'at this point in time', 'in the event that', 'in light of the fact',
  'for all intents and purposes', 'as a matter of fact',

  // Transition overkill
  'on the other hand', 'by the same token', 'along the same lines',
  'in a similar vein', 'that being said', 'having said that',

  // Certainty expressions
  'without question', 'beyond doubt', 'unquestionably',
  'indisputably', 'irrefutably', 'undeniably',

  // Process verbs (overused)
  'encompass', 'encompasses', 'comprising', 'entail', 'entails',
  'constitute', 'constitutes', 'embody', 'embodies',

  // Qualification overuse
  'to a certain extent', 'to some degree', 'in some respects',
  'relatively speaking', 'comparatively speaking',

  // Grandiose statements
  'game-changing', 'paradigm shift', 'sea change',
  'quantum leap', 'revolutionary breakthrough',

  // Academic throat-clearing
  'this paper examines', 'this study explores',
  'research indicates', 'studies suggest', 'evidence shows',

  // Redundancy patterns
  'absolutely essential', 'completely unique', 'very unique',
  'extremely important', 'highly critical', 'vitally important',

  // Corporate speak
  'moving forward', 'going forward', 'at the end of the day',
  'circle back', 'touch base', 'low-hanging fruit',
  'synergize', 'incentivize', 'actionable',
];

// Helper: Call Ollama API
async function callOllama(prompt, model = 'llama3.2') {
  try {
    // Use 127.0.0.1 instead of localhost to avoid IPv6 issues
    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 2000,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('[Ollama Error]', error);
    throw new Error(`Failed to call Ollama: ${error.message}`);
  }
}

// Helper: Detect tell-words in text
function detectTellWords(text) {
  const found = [];
  const textLower = text.toLowerCase();

  AI_TELL_WORDS.forEach(phrase => {
    const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      found.push(...matches.map(m => m.trim()));
    }
  });

  return [...new Set(found)]; // Remove duplicates
}

// Helper: Calculate burstiness (sentence length variation)
function calculateBurstiness(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length < 2) return 0;

  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, len) => sum + Math.pow(len - mean, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);

  // Normalize to 0-100 scale (higher = more varied, more human-like)
  // Human text typically has stdDev around 8-15, AI text around 2-5
  return Math.min(100, Math.round((stdDev / 15) * 100));
}

// Helper: Calculate perplexity (text predictability - statistical approximation)
function calculatePerplexity(text) {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length < 10) return 0;

  // Count bigram frequencies
  const bigrams = new Map();
  const unigramCounts = new Map();

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    unigramCounts.set(word, (unigramCounts.get(word) || 0) + 1);

    if (i < words.length - 1) {
      const bigram = `${word} ${words[i + 1]}`;
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
  }

  // Calculate average predictability
  // Highly predictable (AI) = low unique bigrams relative to total
  // Less predictable (human) = high unique bigrams
  const uniqueBigrams = bigrams.size;
  const totalBigrams = words.length - 1;
  const uniquenessRatio = uniqueBigrams / totalBigrams;

  // Also consider vocabulary diversity
  const vocabularySize = unigramCounts.size;
  const vocabularyRatio = vocabularySize / words.length;

  // Combined perplexity score (0-100, higher = more human-like)
  // AI text: high repetition, low uniqueness → low score
  // Human text: varied, unpredictable → high score
  const perplexity = Math.min(100, Math.round(uniquenessRatio * 60 + vocabularyRatio * 40));

  return perplexity;
}

// Helper: Remove tell-words from text
function removeTellWords(text, intensity) {
  let result = text;
  const intensityMap = { light: 0.3, moderate: 0.6, aggressive: 0.9 };
  const removalRate = intensityMap[intensity];

  const found = detectTellWords(text);
  const toRemove = found.slice(0, Math.ceil(found.length * removalRate));

  toRemove.forEach(phrase => {
    // Remove the phrase and clean up extra spaces/punctuation
    const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[,.]?\\s*`, 'gi');
    result = result.replace(regex, ' ');
  });

  // Clean up multiple spaces
  result = result.replace(/\s{2,}/g, ' ').trim();

  // Clean up awkward punctuation
  result = result.replace(/\s+([.,;:!?])/g, '$1');
  result = result.replace(/([.!?])\s*([.!?])/g, '$1');

  return result;
}

// Helper: Classify sentence function/density type
function classifySentenceType(sentence, index, totalSentences) {
  const lower = sentence.toLowerCase();

  // Connective tissue patterns (low density)
  const connectivePatterns = [
    'but there', 'this brings', 'let\'s', 'now,', 'here\'s', 'think about',
    'consider this', 'pause here', 'interesting', 'question', 'explain'
  ];

  // Transition patterns (low-medium density)
  const transitionPatterns = [
    'however', 'nevertheless', 'furthermore', 'moreover',
    'in addition', 'on the other hand', 'that said', 'meanwhile'
  ];

  // Main point patterns (high density)
  const mainPointPatterns = [
    'research shows', 'evidence', 'data', 'study', 'findings',
    'suggests', 'indicates', 'demonstrates', 'reveals', 'analysis'
  ];

  // Check patterns
  if (connectivePatterns.some(p => lower.includes(p))) return 'CONNECTIVE';
  if (transitionPatterns.some(p => lower.includes(p))) return 'TRANSITION';
  if (mainPointPatterns.some(p => lower.includes(p))) return 'MAIN_POINT';

  // Position-based heuristics
  if (index === 0 || index === totalSentences - 1) return 'MAIN_POINT'; // First/last tend to be main points
  if (sentence.split(/\s+/).length > 20) return 'MAIN_POINT'; // Long sentences often main points
  if (sentence.split(/\s+/).length < 10) return 'CONNECTIVE'; // Short sentences often connective

  return 'ELABORATION'; // Default
}

// Helper: Generate cognitive rhythm pattern
function generateCognitiveRhythm(sentences) {
  const rhythm = [];
  let attentionLevel = 0.7; // Start at moderate attention

  for (let i = 0; i < sentences.length; i++) {
    const sentenceType = classifySentenceType(sentences[i], i, sentences.length);

    // Simulate attention drift
    if (sentenceType === 'MAIN_POINT') {
      attentionLevel = Math.min(1.0, attentionLevel + 0.2); // Focus increases
    } else if (sentenceType === 'CONNECTIVE') {
      attentionLevel = Math.max(0.3, attentionLevel - 0.3); // Attention drifts
    } else {
      attentionLevel = Math.max(0.4, attentionLevel - 0.1); // Gradual drift
    }

    // Add random drift (simulate distractions)
    if (Math.random() < 0.15) {
      attentionLevel = Math.max(0.3, attentionLevel - 0.2);
    }

    rhythm.push({
      index: i,
      type: sentenceType,
      attentionLevel,
      sentence: sentences[i]
    });
  }

  return rhythm;
}

// Helper: Get density target for sentence type
function getDensityTarget(type, attentionLevel) {
  const targets = {
    MAIN_POINT: {
      wordRange: [20, 35],
      infoUnits: '3-5 key ideas, use multiple clauses',
      style: 'HIGH INFORMATION DENSITY - pack in details, be substantive and complex'
    },
    ELABORATION: {
      wordRange: [15, 25],
      infoUnits: '2-3 supporting details',
      style: 'MEDIUM INFORMATION DENSITY - provide examples or clarification'
    },
    TRANSITION: {
      wordRange: [10, 18],
      infoUnits: '1-2 ideas, bridge between points',
      style: 'LOW-MEDIUM INFORMATION DENSITY - connect ideas smoothly'
    },
    CONNECTIVE: {
      wordRange: [5, 12],
      infoUnits: '0-1 ideas, minimal substance',
      style: 'LOW INFORMATION DENSITY - transition/pause/observation, like "looking out the window"'
    }
  };

  return targets[type] || targets.ELABORATION;
}

// Helper: Enhance burstiness with cognitive rhythm variation
async function enhanceBurstiness(text, intensity) {
  // SIMPLIFIED: Just vary sentence length, preserve original structure
  // Previous cognitive rhythm was over-engineered and broke formatting

  const wordCount = text.split(/\s+/).length;
  const prompt = `Rewrite this text to sound more natural and human-like:

REQUIREMENTS:
- Vary sentence lengths (mix short 8-12 word sentences with longer 20-30 word ones)
- Keep total length SIMILAR to original (${wordCount} words ±15%)
- Preserve all markdown formatting (headers ##, lists -, emphasis *, etc)
- Do NOT add quotes around sentences
- Do NOT expand or add new ideas
- Do NOT add "let's observe" or "looking out" phrases
- Keep the same structure and flow

ORIGINAL TEXT:
${text}

REWRITTEN (preserve formatting):`;

  const enhanced = await callOllama(prompt, 'llama3.2');
  return enhanced.trim();
}

// Helper: LLM polish pass
async function llmPolish(text) {
  const wordCount = text.split(/\s+/).length;
  const prompt = `Make this text sound natural and conversational, like a real person wrote it. Use simpler words. Remove any remaining formal or robotic language. Keep it around ${wordCount} words (±10%). Don't add new facts or explanations. Return ONLY the polished text.

Text:
${text}

Polished:`;

  const polished = await callOllama(prompt, 'mistral:7b');
  return polished.trim();
}

// Helper: Detect suspicious phrases that might need human polish
function detectSuspiciousPhrases(text) {
  const suggestions = [];
  const lowerText = text.toLowerCase();

  // AI-specific jargon (NOT field-specific technical terms)
  // Only flag corporate buzzwords and overused AI writing patterns
  const jargonPhrases = [
    'leverage', 'utilize', 'synergy', 'paradigm', 'robust', 'scalable',
    'ecosystem', 'holistic', 'innovative solution', 'cutting-edge',
    'revolutionary', 'game-changing', 'next-generation'
  ];

  // Generic platitudes (AI loves these)
  const platitudes = [
    'at the end of the day', 'it\'s all about', 'do your homework',
    'make an informed decision', 'what works for one', 'varies considerably',
    'carefully evaluate', 'it\'s important to', 'you should consider'
  ];

  // Formal transitions (might sound robotic)
  const formalTransitions = [
    'however', 'nevertheless', 'furthermore', 'moreover',
    'in addition', 'consequently', 'therefore', 'thus'
  ];

  // Check for jargon
  jargonPhrases.forEach(phrase => {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      suggestions.push({
        phrase: matches[0],
        reason: 'Technical jargon - consider simpler language',
        severity: 'high',
        suggestion: `Replace with everyday language`
      });
    }
  });

  // Check for platitudes
  platitudes.forEach(phrase => {
    if (lowerText.includes(phrase)) {
      suggestions.push({
        phrase,
        reason: 'Generic platitude - be more specific',
        severity: 'medium',
        suggestion: 'Add personal touch or specific example'
      });
    }
  });

  // Check for excessive formal transitions
  const transitionCount = formalTransitions.filter(t =>
    lowerText.includes(t.toLowerCase())
  ).length;

  if (transitionCount > 3) {
    suggestions.push({
      phrase: formalTransitions.filter(t => lowerText.includes(t.toLowerCase())).join(', '),
      reason: 'Too many formal transitions',
      severity: 'low',
      suggestion: 'Replace some with: "but", "so", "and", or remove entirely'
    });
  }

  return suggestions;
}

// Helper: Generate user guidance based on results
function generateUserGuidance(suggestions, usedLLM, remainingTellWords) {
  const guidance = [];

  // Overall status
  if (remainingTellWords === 0 && suggestions.length === 0) {
    guidance.push({
      type: 'success',
      message: '✅ Excellent! No AI tell-words detected and text looks natural.'
    });
  } else if (remainingTellWords === 0 && suggestions.length > 0) {
    guidance.push({
      type: 'good',
      message: `✅ AI tell-words removed. Consider manually polishing ${suggestions.length} highlighted phrases.`
    });
  } else {
    guidance.push({
      type: 'warning',
      message: `⚠️ ${remainingTellWords} tell-words still present. Manual review recommended.`
    });
  }

  // LLM guidance
  if (!usedLLM) {
    guidance.push({
      type: 'tip',
      message: '💡 LLM polish was skipped (recommended for best results). Add your own personal touch to highlighted sections.'
    });
  } else {
    guidance.push({
      type: 'tip',
      message: '⚠️ LLM polish was used. Check for added jargon or generic phrases.'
    });
  }

  // Manual polish suggestions
  if (suggestions.length > 0) {
    guidance.push({
      type: 'action',
      message: `📝 Review ${suggestions.length} suggested edits below. Your personal voice will make this sound more human than any AI can.`
    });
  }

  // Humanization tip
  guidance.push({
    type: 'insight',
    message: '🎯 Pro tip: Read aloud and change anything that sounds stiff or unnatural. Trust your ear!'
  });

  return guidance;
}

// ============================================================
// COMPUTER HUMANIZER ENDPOINT
// ============================================================

app.post('/api/transform/computer-humanizer', async (req, res) => {
  try {
    const { text, intensity = 'moderate', useLLM = false } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log(`\n🤖 Computer Humanizer: Processing ${text.length} characters (${intensity} intensity, LLM: ${useLLM})`);
    const startTime = Date.now();

    // Stage 1: Analyze original
    const tellWordsBefore = detectTellWords(text);
    const burstinessBefore = calculateBurstiness(text);
    const perplexityBefore = calculatePerplexity(text);
    console.log(`📊 Before: ${tellWordsBefore.length} tell-words, burstiness ${burstinessBefore}/100, perplexity ${perplexityBefore}/100`);

    // Stage 2: Remove tell-words
    const stage1 = removeTellWords(text, intensity);
    console.log(`✂️  Stage 1: Removed ${tellWordsBefore.length - detectTellWords(stage1).length} tell-words`);

    // Stage 3: Enhance burstiness (if moderate or aggressive)
    let stage2 = stage1;
    if (intensity === 'moderate' || intensity === 'aggressive') {
      stage2 = await enhanceBurstiness(stage1, intensity);
      console.log(`📈 Stage 2: Enhanced burstiness ${calculateBurstiness(stage1)} → ${calculateBurstiness(stage2)}`);
    }

    // Stage 4: LLM polish pass (optional)
    let final = stage2;
    if (useLLM) {
      final = await llmPolish(stage2);
      console.log(`✨ Stage 3: LLM polish complete`);
    }

    // Final metrics
    const tellWordsAfter = detectTellWords(final);
    const burstinessAfter = calculateBurstiness(final);
    const perplexityAfter = calculatePerplexity(final);
    const processingTime = Date.now() - startTime;

    // Improved AI confidence formula that factors in all metrics
    // Lower confidence = more human-like
    const aiConfidenceBefore = Math.max(0, Math.min(100,
      (tellWordsBefore.length * 3) +        // More tell-words = more AI-like
      (50 - burstinessBefore) * 0.5 +        // Low burstiness = more AI-like
      (50 - perplexityBefore) * 0.4          // Low perplexity = more AI-like
    ));

    const aiConfidenceAfter = Math.max(0, Math.min(100,
      (tellWordsAfter.length * 3) +
      (50 - burstinessAfter) * 0.5 +
      (50 - perplexityAfter) * 0.4
    ));

    console.log(`📊 After: ${tellWordsAfter.length} tell-words, burstiness ${burstinessAfter}/100, perplexity ${perplexityAfter}/100`);
    console.log(`📊 AI Confidence: ${aiConfidenceBefore.toFixed(1)}% → ${aiConfidenceAfter.toFixed(1)}%`);
    console.log(`⏱️  Completed in ${processingTime}ms\n`);

    // Detect phrases that might benefit from human polish
    const manualReviewSuggestions = detectSuspiciousPhrases(final);
    const userGuidance = generateUserGuidance(manualReviewSuggestions, useLLM, tellWordsAfter.length);

    res.json({
      transformation_id: `ch-${Date.now()}`,
      original: text,
      transformed: final,
      reflection: `Removed ${tellWordsBefore.length - tellWordsAfter.length} AI tell-words and enhanced text naturalness.`,
      metadata: {
        aiConfidenceBefore,
        aiConfidenceAfter,
        burstinessBefore,
        burstinessAfter,
        perplexityBefore,
        perplexityAfter,
        tellWordsRemoved: tellWordsBefore.length - tellWordsAfter.length,
        tellWordsFound: tellWordsBefore,
        processingTime,
        usedLLM: useLLM,
        manualReviewSuggestions,
        userGuidance,
        stages: {
          original: text,
          tellWordsRemoved: stage1,
          burstinessEnhanced: stage2,
          ...(useLLM && { llmPolished: final }),
        },
      },
    });
  } catch (error) {
    console.error('❌ Computer Humanizer error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// AI DETECTION ENDPOINT
// ============================================================

app.post('/api/transform/ai-detection', async (req, res) => {
  try {
    const { text, threshold = 0.5 } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log(`\n🔍 AI Detection: Analyzing ${text.length} characters`);

    // Analyze metrics
    const tellWords = detectTellWords(text);
    const burstiness = calculateBurstiness(text);
    const perplexity = calculatePerplexity(text);

    // Calculate AI confidence (0-100%)
    // Low burstiness + low perplexity = AI-like uniformity
    // Scale: 0-100 where higher values = more human-like, so we invert them
    // Calibrated to be more skeptical - human text scores 5-15%, AI scores 30-60%
    const confidence = Math.max(0, Math.min(100,
      (tellWords.length * 5) +           // Tell-words: 0-50+ points (increased from 4)
      ((100 - burstiness) * 0.6) +       // Inverse burstiness: 0-60 points (increased from 0.5)
      ((100 - perplexity) * 0.5)         // Inverse perplexity: 0-50 points (increased from 0.4)
    ));

    // Determine verdict
    let verdict = 'mixed';
    if (confidence >= threshold * 100) {
      verdict = 'ai';
    } else if (confidence < 30) {
      verdict = 'human';
    }

    // Generate reasoning
    const reasoning = `Found ${tellWords.length} AI tell-words. Burstiness: ${burstiness}/100 (${burstiness > 60 ? 'human-like' : 'AI-like'}). Perplexity: ${perplexity}/100 (${perplexity > 60 ? 'varied' : 'predictable'}). Overall confidence: ${confidence.toFixed(1)}% AI-generated.`;

    console.log(`📊 Verdict: ${verdict.toUpperCase()} (${confidence.toFixed(1)}% confidence)`);
    console.log(`   Tell-words: ${tellWords.length}, Burstiness: ${burstiness}/100, Perplexity: ${perplexity}/100\n`);

    res.json({
      transformation_id: `ad-${Date.now()}`,
      original: text,
      transformed: text,
      metadata: {
        aiDetection: {
          confidence: confidence / 100,
          verdict,
          tellWords,
          burstiness,
          perplexity,
          reasoning,
        },
      },
    });
  } catch (error) {
    console.error('❌ AI Detection error:', error);
    res.status(500).json({ error: error.message });
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

    // Generate folder name from title
    const timestamp = Date.now();
    const date = new Date(parsed.create_time ? parsed.create_time * 1000 : timestamp);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

    // Sanitize title for folder name (remove special chars, limit length)
    const sanitizedTitle = (parsed.title || 'Untitled')
      .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 50); // Limit length

    // Use title + random suffix to avoid collisions
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const folderName = `${dateStr}_imported_${sanitizedTitle}_${randomSuffix}`;

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

    // Create folder and save conversation.json (use writeFileSync for immediate completion)
    await fs.mkdir(folderPath, { recursive: true });
    const jsonPath = path.join(folderPath, 'conversation.json');

    // Write synchronously to ensure file is completely written before returning
    const fsSync = await import('fs');
    fsSync.writeFileSync(jsonPath, JSON.stringify(parsed, null, 2), 'utf-8');

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

    // Count actual messages (only nodes with text content)
    let messageCount = 0;
    if (parsed.mapping) {
      messageCount = Object.values(parsed.mapping).filter(node => {
        if (!node.message || !node.message.content?.parts) return false;
        // Only count messages with actual text content
        const hasTextContent = node.message.content.parts.some(part => {
          if (typeof part === 'string' && part.trim().length > 0) return true;
          if (typeof part === 'object' && part !== null && part.content_type === 'text') {
            return part.parts?.[0]?.trim().length > 0;
          }
          return false;
        });
        return hasTextContent;
      }).length;
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

// ============================================================
// ARCHIVE IMPORT ENDPOINTS - ZIP Import with Smart Merge
// ============================================================

// POST /api/import/archive/upload - Upload ZIP file
app.post('/api/import/archive/upload', (req, res) => {
  upload.single('archive')(req, res, async (err) => {
    // Handle multer errors
    if (err) {
      console.error('Upload error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'File too large',
          message: 'Maximum file size is 10GB',
          maxSize: 10 * 1024 * 1024 * 1024
        });
      }
      return res.status(500).json({ error: err.message });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const jobId = generateJobId();
      const zipPath = req.file.path;

      importJobs.set(jobId, {
        id: jobId,
        status: 'uploaded',
        progress: 0,
        zipPath,
        filename: req.file.originalname,
        size: req.file.size,
        startTime: Date.now(),
      });

      console.log(`📤 Upload complete: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB) → Job ${jobId}`);
      res.json({ jobId, status: 'uploaded', filename: req.file.originalname });
    } catch (error) {
      console.error('Error uploading archive:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// POST /api/import/archive/parse - Trigger parsing (async job)
app.post('/api/import/archive/parse', async (req, res) => {
  try {
    const { jobId, additionalMediaSourceDirs } = req.body;
    const job = importJobs.get(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'uploaded') {
      return res.status(400).json({ error: `Cannot parse job in status: ${job.status}` });
    }

    // Store additional media sources in job for use during parsing
    job.additionalMediaSourceDirs = additionalMediaSourceDirs || [];

    job.status = 'parsing';
    job.progress = 10;

    console.log(`🔍 Starting parse for job ${jobId}...`);
    if (job.additionalMediaSourceDirs.length > 0) {
      console.log(`   With ${job.additionalMediaSourceDirs.length} additional media source(s)`);
    }
    res.json({ jobId, status: 'parsing' });

    // Parse in background (don't block response)
    setImmediate(async () => {
      try {
        job.progress = 20;

        // Step 1: Parse archive (with additional media sources if provided)
        const parser = new ConversationParser();
        const archive = await parser.parseArchive(job.zipPath, undefined, job.additionalMediaSourceDirs);

        job.archive = archive;
        job.progress = 50;
        console.log(`✅ Parsed ${archive.conversations.length} conversations from ${jobId}`);

        // Step 2: Generate preview
        job.status = 'previewing';
        const importer = new IncrementalImporter();
        const preview = await importer.generatePreview(
          archive.conversations,
          ARCHIVE_ROOT
        );

        job.preview = preview;
        job.progress = 100;
        job.status = 'ready';

        console.log(`✅ Preview ready for job ${jobId}:`);
        console.log(`   - New conversations: ${preview.newConversations}`);
        console.log(`   - Updated conversations: ${preview.existingConversationsToUpdate}`);
        console.log(`   - Conflicts: ${preview.conflicts.length}`);
      } catch (err) {
        job.status = 'failed';
        job.error = err.message;
        job.progress = 0;
        console.error(`❌ Parse failed for job ${jobId}:`, err);
      }
    });
  } catch (error) {
    console.error('Error starting parse:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/import/archive/folder - Import from expanded folder (no upload)
app.post('/api/import/archive/folder', async (req, res) => {
  try {
    const { folderPath, archiveType, additionalMediaSourceDirs } = req.body;

    if (!folderPath) {
      return res.status(400).json({ error: 'folderPath is required' });
    }

    // Verify folder exists
    try {
      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Path is not a directory' });
      }
    } catch (err) {
      return res.status(400).json({ error: `Folder not found: ${folderPath}` });
    }

    // Create a job (no ZIP file, just the folder path)
    const jobId = `folder-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
    const job = {
      id: jobId,
      status: 'parsing',
      progress: 0,
      filename: path.basename(folderPath),
      startTime: Date.now(),
      folderPath, // Store folder path instead of zipPath
      archiveType: archiveType || 'auto',
      additionalMediaSourceDirs: additionalMediaSourceDirs || [], // Additional media sources
    };

    importJobs.set(jobId, job);
    console.log(`📂 Folder import started: ${folderPath} (job: ${jobId})`);

    // Parse in background
    setImmediate(async () => {
      try {
        job.status = 'parsing';
        job.progress = 10;

        // Create parser and parse directly from folder (no extraction needed)
        const { ConversationParser, IncrementalImporter } = await import('./src/services/parser/index.js');
        const parser = new ConversationParser(true);

        // Detect format first
        const { OpenAIParser, ClaudeParser, FacebookParser, ChromePluginParser } = await import('./src/services/parser/index.js');
        let format = 'unknown';

        // Check Chrome plugin format first (it has conversation.json but different structure)
        if (await ChromePluginParser.detectFormat(folderPath)) {
          format = 'chrome-plugin';
        } else if (await FacebookParser.detectFormat(folderPath)) {
          format = 'facebook';
        } else if (await OpenAIParser.detectFormat(folderPath)) {
          format = 'openai';
        } else if (await ClaudeParser.detectFormat(folderPath)) {
          format = 'claude';
        }

        if (format === 'unknown') {
          throw new Error('Could not detect archive format. Make sure the folder contains conversations.json (OpenAI/Chrome plugin), conversations/ folder (Claude), or messages/inbox/ (Facebook).');
        }

        job.progress = 20;
        console.log(`   Detected format: ${format}`);

        // Parse conversations directly from folder
        const openAIParser = new OpenAIParser();
        const claudeParser = new ClaudeParser();
        const facebookParser = new FacebookParser();
        const chromePluginParser = new ChromePluginParser();

        let conversations;
        if (format === 'chrome-plugin') {
          conversations = await chromePluginParser.parseConversations(folderPath);
        } else if (format === 'facebook') {
          conversations = await facebookParser.parseConversations(folderPath);
        } else if (format === 'openai') {
          conversations = await openAIParser.parseConversations(folderPath);
        } else {
          conversations = await claudeParser.parseConversations(folderPath);
        }

        job.progress = 50;
        console.log(`   Parsed ${conversations.length} conversations`);

        // Build media index (including additional sources if provided)
        const { ComprehensiveMediaIndexer, ComprehensiveMediaMatcher } = await import('./src/services/parser/index.js');
        const mediaIndexer = new ComprehensiveMediaIndexer(true);
        const mediaMatcher = new ComprehensiveMediaMatcher(true);

        // Log additional sources being used
        if (job.additionalMediaSourceDirs && job.additionalMediaSourceDirs.length > 0) {
          console.log(`   Including ${job.additionalMediaSourceDirs.length} additional media source(s):`);
          job.additionalMediaSourceDirs.forEach(dir => console.log(`     - ${dir}`));
        }

        const indices = mediaIndexer.buildIndex(folderPath, job.additionalMediaSourceDirs);
        const conversationsWithMedia = mediaMatcher.match(conversations, indices);

        const archive = {
          conversations: conversationsWithMedia,
          mediaFiles: Array.from(indices.pathToMetadata.values()),
          format,
          extractedPath: folderPath, // Use folder path directly
          stats: {
            totalConversations: conversations.length,
            totalMessages: conversations.reduce((sum, c) => sum + Object.values(c.mapping).filter(n => n.message).length, 0),
            totalMediaFiles: mediaMatcher.getStats().totalFilesMatched,
            parseErrors: 0,
          },
        };

        job.archive = archive;
        job.progress = 70;

        // Generate preview
        job.status = 'previewing';
        const importer = new IncrementalImporter();
        const preview = await importer.generatePreview(archive.conversations, ARCHIVE_ROOT);

        job.preview = preview;
        job.progress = 100;
        job.status = 'ready';

        console.log(`✅ Folder import ready for job ${jobId}:`);
        console.log(`   - Format: ${format}`);
        console.log(`   - Conversations: ${archive.stats.totalConversations}`);
        console.log(`   - Messages: ${archive.stats.totalMessages}`);
        console.log(`   - Media files: ${archive.stats.totalMediaFiles}`);
      } catch (err) {
        job.status = 'failed';
        job.error = err.message;
        job.progress = 0;
        console.error(`❌ Folder import failed for job ${jobId}:`, err);
      }
    });

    res.json({
      jobId,
      status: 'parsing',
      message: `Parsing folder: ${folderPath}`,
    });
  } catch (error) {
    console.error('Error starting folder import:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/import/media-only - Import media files into existing conversations
app.post('/api/import/media-only', async (req, res) => {
  try {
    const { mediaFolderPath } = req.body;

    if (!mediaFolderPath) {
      return res.status(400).json({ error: 'mediaFolderPath is required' });
    }

    // Verify folder exists
    try {
      const stats = await fs.stat(mediaFolderPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Path is not a directory' });
      }
    } catch (err) {
      return res.status(400).json({ error: `Folder not found: ${mediaFolderPath}` });
    }

    const jobId = `media-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
    const job = {
      id: jobId,
      status: 'processing',
      progress: 0,
      filename: path.basename(mediaFolderPath),
      startTime: Date.now(),
      folderPath: mediaFolderPath,
    };

    importJobs.set(jobId, job);
    console.log(`📸 Media-only import started: ${mediaFolderPath} (job: ${jobId})`);

    // Process in background
    setImmediate(async () => {
      try {
        const { ComprehensiveMediaIndexer, ComprehensiveMediaMatcher, MediaReferenceExtractor } = await import('./src/services/parser/index.js');
        const crypto = await import('crypto');

        // Step 1: Index all media files in the source folder
        job.progress = 10;
        console.log(`   Indexing media files in: ${mediaFolderPath}`);
        const indexer = new ComprehensiveMediaIndexer(true);
        const mediaIndices = indexer.buildIndex(mediaFolderPath);

        console.log(`   Found ${mediaIndices.allFiles.length} media files`);
        if (mediaIndices.allFiles.length === 0) {
          throw new Error('No media files found in the specified folder');
        }

        // Step 2: Scan existing conversation folders in ARCHIVE_ROOT
        job.progress = 30;
        console.log(`   Scanning conversations in: ${ARCHIVE_ROOT}`);

        const convFolders = await fs.readdir(ARCHIVE_ROOT);
        const stats = {
          conversationsScanned: 0,
          conversationsUpdated: 0,
          mediaFilesCopied: 0,
          manifestsUpdated: 0,
        };

        const matcher = new ComprehensiveMediaMatcher(true);
        const extractor = new MediaReferenceExtractor();

        // Step 3: For each conversation, try to match and copy media
        for (let i = 0; i < convFolders.length; i++) {
          const folder = convFolders[i];
          if (folder.startsWith('_') || folder.startsWith('.')) continue;

          const convPath = path.join(ARCHIVE_ROOT, folder);
          const convJsonPath = path.join(convPath, 'conversation.json');

          if (!await fs.stat(convPath).then(s => s.isDirectory()).catch(() => false)) continue;
          if (!await fs.stat(convJsonPath).catch(() => false)) continue;

          stats.conversationsScanned++;

          try {
            // Load conversation
            const convData = JSON.parse(await fs.readFile(convJsonPath, 'utf-8'));

            // Extract media references from conversation
            const references = extractor.extractAllReferences(convData);
            const totalRefs = references.asset_pointers.length + references.attachments.length + references.dalle_generations.length;

            if (totalRefs === 0) continue; // No media references

            // Try to match media files to this conversation
            const matchedConv = matcher.matchSingle ? matcher.matchSingle(convData, mediaIndices) : null;

            // Alternative: Manual matching based on references
            const matchedFiles = new Set();

            // Match by file hash (sediment://)
            for (const ref of references.asset_pointers) {
              if (ref.file_hash && mediaIndices.fileHashToPath.has(ref.file_hash)) {
                matchedFiles.add(mediaIndices.fileHashToPath.get(ref.file_hash));
              }
              if (ref.file_id && mediaIndices.fileIdToPath.has(ref.file_id)) {
                matchedFiles.add(mediaIndices.fileIdToPath.get(ref.file_id));
              }
              if (ref.size_bytes) {
                const filesWithSize = mediaIndices.sizeToPaths.get(ref.size_bytes) || [];
                if (filesWithSize.length === 1) {
                  matchedFiles.add(filesWithSize[0]);
                }
              }
            }

            // Match by conversation_id in path
            const convId = convData.conversation_id || convData.id;
            if (convId && mediaIndices.conversationToPaths.has(convId)) {
              for (const filePath of mediaIndices.conversationToPaths.get(convId)) {
                matchedFiles.add(filePath);
              }
            }

            if (matchedFiles.size === 0) continue;

            // Copy matched files to conversation's media folder
            const mediaDir = path.join(convPath, 'media');
            await fs.mkdir(mediaDir, { recursive: true });

            // Load or create manifest
            const manifestPath = path.join(convPath, 'media_manifest.json');
            let manifest;
            try {
              manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
            } catch {
              manifest = { files: {}, assetPointers: {}, fileIds: {}, fileHashes: {}, sizeToFiles: {} };
            }

            let filesCopied = 0;
            for (const srcPath of matchedFiles) {
              const basename = path.basename(srcPath);

              // Check if already exists
              if (manifest.files[basename]) continue;

              try {
                // Generate hash for unique naming
                const fileBuffer = await fs.readFile(srcPath);
                const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex').slice(0, 12);
                const hashedName = `${hash}_${basename}`;
                const destPath = path.join(mediaDir, hashedName);

                // Copy file
                await fs.copyFile(srcPath, destPath);
                filesCopied++;

                // Update manifest
                manifest.files[basename] = hashedName;

                const fileStats = await fs.stat(srcPath);
                const fileSize = fileStats.size;

                if (!manifest.sizeToFiles[fileSize]) {
                  manifest.sizeToFiles[fileSize] = [];
                }
                manifest.sizeToFiles[fileSize].push(hashedName);

                // Extract and add file-ID
                const fileIdMatch = basename.match(/^(file-[A-Za-z0-9]+)[_-]/);
                if (fileIdMatch) {
                  manifest.fileIds[fileIdMatch[1]] = hashedName;
                }

                // Extract and add file hash
                const fileHashMatch = basename.match(/^(file_[a-f0-9]{32})-/);
                if (fileHashMatch) {
                  manifest.fileHashes[fileHashMatch[1]] = hashedName;
                }
              } catch (copyErr) {
                console.warn(`   Failed to copy ${basename}: ${copyErr.message}`);
              }
            }

            if (filesCopied > 0) {
              // Map asset_pointers to copied files
              for (const ref of references.asset_pointers) {
                if (ref.size_bytes && manifest.sizeToFiles[ref.size_bytes]) {
                  const filesWithSize = manifest.sizeToFiles[ref.size_bytes];
                  if (filesWithSize.length > 0 && !manifest.assetPointers[ref.pointer]) {
                    manifest.assetPointers[ref.pointer] = filesWithSize[0];
                  }
                }
                if (ref.file_hash && manifest.fileHashes[ref.file_hash]) {
                  manifest.assetPointers[ref.pointer] = manifest.fileHashes[ref.file_hash];
                }
                if (ref.file_id && manifest.fileIds[ref.file_id]) {
                  manifest.assetPointers[ref.pointer] = manifest.fileIds[ref.file_id];
                }
              }

              // Write updated manifest
              await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

              stats.conversationsUpdated++;
              stats.mediaFilesCopied += filesCopied;
              stats.manifestsUpdated++;

              console.log(`   📁 ${folder}: Copied ${filesCopied} media files`);
            }
          } catch (convErr) {
            console.warn(`   Error processing ${folder}: ${convErr.message}`);
          }

          job.progress = 30 + Math.floor((i / convFolders.length) * 60);
        }

        job.progress = 100;
        job.status = 'completed';
        job.result = stats;

        console.log(`✅ Media-only import completed:`);
        console.log(`   - Conversations scanned: ${stats.conversationsScanned}`);
        console.log(`   - Conversations updated: ${stats.conversationsUpdated}`);
        console.log(`   - Media files copied: ${stats.mediaFilesCopied}`);
        console.log(`   - Manifests updated: ${stats.manifestsUpdated}`);
      } catch (err) {
        job.status = 'failed';
        job.error = err.message;
        job.progress = 0;
        console.error(`❌ Media-only import failed: ${err.message}`);
      }
    });

    res.json({
      jobId,
      status: 'processing',
      message: `Processing media from: ${mediaFolderPath}`,
    });
  } catch (error) {
    console.error('Error starting media-only import:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/import/archive/status/:jobId - Check parsing progress
app.get('/api/import/archive/status/:jobId', (req, res) => {
  try {
    const job = importJobs.get(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Return job status without heavy data (exclude archive/preview for status checks)
    const statusResponse = {
      id: job.id,
      status: job.status,
      progress: job.progress,
      filename: job.filename,
      size: job.size,
      startTime: job.startTime,
      error: job.error,
    };

    // Include result if import is completed
    if (job.status === 'completed' && job.result) {
      statusResponse.result = job.result;
    }

    res.json(statusResponse);
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/import/archive/preview/:jobId - Preview import changes
app.get('/api/import/archive/preview/:jobId', (req, res) => {
  try {
    const job = importJobs.get(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'ready') {
      return res.status(400).json({
        error: `Preview not ready. Job status: ${job.status}`,
        status: job.status,
        progress: job.progress
      });
    }

    if (!job.preview) {
      return res.status(500).json({ error: 'Preview data missing' });
    }

    console.log(`📋 Returning preview for job ${req.params.jobId}`);
    res.json({
      jobId: job.id,
      preview: job.preview,
      filename: job.filename,
      parsedAt: job.startTime,
    });
  } catch (error) {
    console.error('Error getting preview:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/import/archive/apply/:jobId - Apply import with merge
app.post('/api/import/archive/apply/:jobId', async (req, res) => {
  try {
    const job = importJobs.get(req.params.jobId);
    const { createNewArchive, archiveName } = req.body || {};

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'ready') {
      return res.status(400).json({ error: `Cannot apply job in status: ${job.status}` });
    }

    if (!job.archive) {
      return res.status(500).json({ error: 'Archive data missing' });
    }

    job.status = 'applying';
    job.progress = 0;

    // Determine target archive
    let targetArchiveRoot = ARCHIVE_ROOT;
    let targetArchiveName = currentArchiveName;
    let switchedArchive = false;

    if (createNewArchive) {
      // Create new archive folder
      const newArchiveName = archiveName || `import_${new Date().toISOString().split('T')[0]}_${Date.now().toString(36)}`;
      const newArchivePath = path.join(ARCHIVES_BASE_DIR, newArchiveName);

      // Create the directory
      await fs.mkdir(newArchivePath, { recursive: true });

      targetArchiveRoot = newArchivePath;
      targetArchiveName = newArchiveName;
      switchedArchive = true;

      console.log(`📁 Created new archive for import: ${newArchiveName}`);
    }

    console.log(`🚀 Applying import for job ${req.params.jobId} to archive "${targetArchiveName}"...`);

    // Apply in background
    setImmediate(async () => {
      try {
        const importer = new IncrementalImporter();
        const result = await importer.applyImport(
          job.archive.conversations,
          targetArchiveRoot,
          job.archive.extractedPath // Path to extracted archive (for media files)
        );

        // If we created a new archive and import succeeded, switch to it
        if (switchedArchive) {
          currentArchiveName = targetArchiveName;
          ARCHIVE_ROOT = targetArchiveRoot;
          await saveArchiveConfig();
          result.newArchiveName = targetArchiveName;
          result.switchedArchive = true;
          console.log(`🔄 Switched to new archive: ${targetArchiveName}`);
        }

        job.result = result;
        job.status = 'completed';
        job.progress = 100;

        console.log(`✅ Import completed for job ${req.params.jobId}:`);
        console.log(`   - Target archive: ${targetArchiveName}`);
        console.log(`   - Conversations created: ${result.conversationsCreated}`);
        console.log(`   - Conversations updated: ${result.conversationsUpdated}`);
        console.log(`   - Messages added: ${result.totalMessagesAdded}`);
        console.log(`   - Media files copied: ${result.totalMediaFilesAdded}`);

        // Clean up uploaded ZIP after 1 minute
        setTimeout(async () => {
          try {
            await fs.unlink(job.zipPath);
            console.log(`🗑️  Cleaned up ZIP for job ${req.params.jobId}`);
          } catch (cleanupErr) {
            console.warn(`Failed to clean up ZIP: ${cleanupErr.message}`);
          }
        }, 60000);
      } catch (err) {
        job.status = 'failed';
        job.error = err.message;
        job.progress = 0;
        console.error(`❌ Apply failed for job ${req.params.jobId}:`, err);
      }
    });

    res.json({
      jobId: job.id,
      status: 'applying',
      targetArchive: targetArchiveName,
      createNewArchive: switchedArchive,
    });
  } catch (error) {
    console.error('Error applying import:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/import/archive/cancel/:jobId - Cancel import job
app.delete('/api/import/archive/cancel/:jobId', async (req, res) => {
  try {
    const job = importJobs.get(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Clean up uploaded file
    try {
      await fs.unlink(job.zipPath);
    } catch (err) {
      console.warn(`Failed to delete ZIP for job ${req.params.jobId}: ${err.message}`);
    }

    // Remove from job queue
    importJobs.delete(req.params.jobId);

    console.log(`🗑️  Cancelled and removed job ${req.params.jobId}`);
    res.json({ success: true, jobId: req.params.jobId });
  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// SESSION ENDPOINTS - Session History & Buffer System
// ============================================================

// POST /sessions - Create new session
app.post('/sessions', async (req, res) => {
  try {
    const session = req.body;
    const sessionPath = path.join(SESSION_STORAGE_DIR, `${session.sessionId}.json`);

    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));

    console.log(`✓ Created session: ${session.sessionId} (${session.name})`);
    res.json({ success: true, sessionId: session.sessionId });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /sessions - List all sessions
app.get('/sessions', async (req, res) => {
  try {
    const files = await fs.readdir(SESSION_STORAGE_DIR);
    const sessionFiles = files.filter(f => f.endsWith('.json'));

    const sessions = (await Promise.all(
      sessionFiles.map(async (file) => {
        try {
          const content = await fs.readFile(
            path.join(SESSION_STORAGE_DIR, file),
            'utf-8'
          );
          return JSON.parse(content);
        } catch (parseError) {
          // Log corrupted file but don't crash - skip it
          console.warn(`⚠️  Skipping corrupted session file: ${file}`, parseError.message);
          return null;
        }
      })
    )).filter(session => session !== null); // Remove corrupted sessions

    // Sort by updated timestamp (most recent first)
    sessions.sort((a, b) =>
      new Date(b.updated).getTime() - new Date(a.updated).getTime()
    );

    console.log(`📋 Listed ${sessions.length} sessions (${sessionFiles.length - sessions.length} corrupted/skipped)`);
    res.json(sessions);
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /sessions/:id - Get specific session
app.get('/sessions/:id', async (req, res) => {
  try {
    const sessionPath = path.join(SESSION_STORAGE_DIR, `${req.params.id}.json`);
    const content = await fs.readFile(sessionPath, 'utf-8');

    let session;
    try {
      session = JSON.parse(content);
    } catch (parseError) {
      console.error(`⚠️  Corrupted session file: ${req.params.id}.json`, parseError.message);
      res.status(422).json({ error: 'Session file is corrupted', detail: 'Invalid JSON format' });
      return;
    }

    console.log(`✓ Retrieved session: ${req.params.id}`);
    res.json(session);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`❌ Session not found: ${req.params.id}`);
      res.status(404).json({ error: 'Session not found' });
    } else {
      console.error('Error getting session:', error);
      res.status(500).json({ error: error.message });
    }
  }
});

// PUT /sessions/:id - Update session
app.put('/sessions/:id', async (req, res) => {
  try {
    const session = req.body;
    const sessionPath = path.join(SESSION_STORAGE_DIR, `${req.params.id}.json`);
    const backupPath = `${sessionPath}.backup`;

    // Backup existing file before overwriting (if it exists)
    try {
      const existing = await fs.readFile(sessionPath, 'utf-8');
      await fs.writeFile(backupPath, existing);
      console.log(`💾 Backed up session: ${req.params.id}`);
    } catch (backupError) {
      // File doesn't exist yet (first save) - skip backup
      if (backupError.code !== 'ENOENT') {
        console.warn(`⚠️  Backup failed (continuing anyway): ${backupError.message}`);
      }
    }

    // Write updated session
    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));

    console.log(`✓ Updated session: ${req.params.id} (${session.name})`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /sessions/:id - Delete session
app.delete('/sessions/:id', async (req, res) => {
  try {
    const sessionPath = path.join(SESSION_STORAGE_DIR, `${req.params.id}.json`);
    await fs.unlink(sessionPath);

    console.log(`🗑️  Deleted session: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /sessions/:id/rename - Rename session
app.put('/sessions/:id/rename', async (req, res) => {
  try {
    const { name } = req.body;
    const sessionPath = path.join(SESSION_STORAGE_DIR, `${req.params.id}.json`);

    const content = await fs.readFile(sessionPath, 'utf-8');
    const session = JSON.parse(content);

    session.name = name;
    session.updated = new Date().toISOString();

    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));

    console.log(`✏️  Renamed session: ${req.params.id} → "${name}"`);
    res.json({ success: true, session });
  } catch (error) {
    console.error('Error renaming session:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// EMBEDDING & SEARCH ENDPOINTS
// =============================================================================

import { ArchiveIndexer, ClusteringService } from './src/services/embeddings/index.ts';

// Cache indexers per archive path
const indexerCache = new Map();
const clusteringCache = new Map();
// Cache for discovered clusters (keyed by archivePath)
// Stores the full cluster objects with memberIds for subsequent member queries
const discoveredClustersCache = new Map();

function getIndexer(archivePath) {
  if (!indexerCache.has(archivePath)) {
    indexerCache.set(archivePath, new ArchiveIndexer(archivePath));
  }
  return indexerCache.get(archivePath);
}

function getClusteringService(archivePath) {
  if (!clusteringCache.has(archivePath)) {
    const indexer = getIndexer(archivePath);
    clusteringCache.set(archivePath, new ClusteringService(indexer.getDatabase()));
  }
  return clusteringCache.get(archivePath);
}

// Active indexing jobs
const indexingJobs = new Map();

// Build embedding index for archive
app.post('/api/embeddings/build', async (req, res) => {
  try {
    const archivePath = req.body.archivePath || getArchiveRoot();
    const options = req.body.options || {};

    // Check if already indexing
    if (indexingJobs.has(archivePath)) {
      return res.json({
        status: 'already_running',
        progress: indexingJobs.get(archivePath).progress,
      });
    }

    const indexer = getIndexer(archivePath);
    const jobId = Date.now().toString();

    // Track progress
    const job = {
      id: jobId,
      archivePath,
      progress: null,
      startedAt: Date.now(),
    };
    indexingJobs.set(archivePath, job);

    // Start indexing in background
    indexer.buildIndex({
      ...options,
      onProgress: (progress) => {
        job.progress = progress;
      },
    }).then(() => {
      console.log(`✅ Indexing complete for ${archivePath}`);
      indexingJobs.delete(archivePath);
    }).catch((err) => {
      console.error(`❌ Indexing failed for ${archivePath}:`, err);
      job.progress = { status: 'error', error: err.message };
    });

    res.json({
      status: 'started',
      jobId,
      archivePath,
    });
  } catch (error) {
    console.error('Error starting index build:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get indexing status
app.get('/api/embeddings/status', (req, res) => {
  try {
    const archivePath = req.query.archivePath || getArchiveRoot();
    const job = indexingJobs.get(archivePath);

    if (job) {
      return res.json({
        status: 'indexing',
        progress: job.progress,
        startedAt: job.startedAt,
      });
    }

    // Return stats if not actively indexing
    const indexer = getIndexer(archivePath);
    const stats = indexer.getStats();

    res.json({
      status: 'idle',
      stats,
    });
  } catch (error) {
    console.error('Error getting embedding status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get embedding stats
app.get('/api/embeddings/stats', (req, res) => {
  try {
    const archivePath = req.query.archivePath || getArchiveRoot();
    const indexer = getIndexer(archivePath);
    const stats = indexer.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting embedding stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Semantic search for messages
app.post('/api/embeddings/search/messages', async (req, res) => {
  try {
    const { query, limit = 20 } = req.body;
    const archivePath = req.body.archivePath || getArchiveRoot();

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const indexer = getIndexer(archivePath);
    const results = await indexer.searchMessages(query, limit);

    res.json({ results });
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Semantic search for conversations (by summary)
app.post('/api/embeddings/search/conversations', async (req, res) => {
  try {
    const { query, limit = 20 } = req.body;
    const archivePath = req.body.archivePath || getArchiveRoot();

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const indexer = getIndexer(archivePath);
    const results = await indexer.searchConversations(query, limit);

    res.json({ results });
  } catch (error) {
    console.error('Error searching conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Find messages similar to a given message
app.post('/api/embeddings/search/similar', async (req, res) => {
  try {
    const { embeddingId, limit = 20, excludeSameConversation = false } = req.body;
    const archivePath = req.body.archivePath || getArchiveRoot();

    if (!embeddingId) {
      return res.status(400).json({ error: 'embeddingId is required' });
    }

    const indexer = getIndexer(archivePath);
    const results = await indexer.findSimilarMessages(embeddingId, limit, excludeSameConversation);

    res.json({ results });
  } catch (error) {
    console.error('Error finding similar messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark conversation as interesting (triggers finer-grain indexing)
app.post('/api/embeddings/mark-interesting', async (req, res) => {
  try {
    const { conversationId, interesting = true } = req.body;
    const archivePath = req.body.archivePath || getArchiveRoot();

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required' });
    }

    const indexer = getIndexer(archivePath);
    await indexer.markInteresting(conversationId, interesting);

    res.json({ success: true, conversationId, interesting });
  } catch (error) {
    console.error('Error marking conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate summary embedding for a conversation
app.post('/api/embeddings/summary', async (req, res) => {
  try {
    const { conversationId, summary } = req.body;
    const archivePath = req.body.archivePath || getArchiveRoot();

    if (!conversationId || !summary) {
      return res.status(400).json({ error: 'conversationId and summary are required' });
    }

    const indexer = getIndexer(archivePath);
    const embeddingId = await indexer.generateSummaryEmbedding(conversationId, summary);

    res.json({ success: true, conversationId, embeddingId });
  } catch (error) {
    console.error('Error generating summary embedding:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add sentence-level embeddings for a specific message
app.post('/api/embeddings/sentences', async (req, res) => {
  try {
    const { messageId } = req.body;
    const archivePath = req.body.archivePath || getArchiveRoot();

    if (!messageId) {
      return res.status(400).json({ error: 'messageId is required' });
    }

    const indexer = getIndexer(archivePath);
    const count = await indexer.embedMessageSentences(messageId);

    res.json({ success: true, messageId, sentenceCount: count });
  } catch (error) {
    console.error('Error embedding sentences:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// CLUSTERING & ANCHOR ENDPOINTS
// =============================================================================

// Discover clusters in the embedding space
app.post('/api/clustering/discover', async (req, res) => {
  try {
    const archivePath = req.body.archivePath || getArchiveRoot();
    const options = req.body.options || {};

    const clustering = getClusteringService(archivePath);
    const clusters = await clustering.discoverClusters(options);

    // Cache the full clusters with memberIds for subsequent member queries
    discoveredClustersCache.set(archivePath, clusters);

    res.json({
      success: true,
      clusterCount: clusters.length,
      clusters: clusters.map(c => ({
        id: c.id,
        memberCount: c.memberCount,
        coherence: c.coherence,
        sampleTexts: c.sampleTexts,
        memberIds: c.memberIds, // Include memberIds for client-side reference
      })),
    });
  } catch (error) {
    console.error('Error discovering clusters:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save discovered clusters to database
app.post('/api/clustering/save', async (req, res) => {
  try {
    const { clusters } = req.body;
    const archivePath = req.body.archivePath || getArchiveRoot();

    if (!clusters || !Array.isArray(clusters)) {
      return res.status(400).json({ error: 'clusters array is required' });
    }

    const clustering = getClusteringService(archivePath);
    await clustering.saveClusters(clusters);

    res.json({ success: true, savedCount: clusters.length });
  } catch (error) {
    console.error('Error saving clusters:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get cluster statistics
app.get('/api/clustering/stats', (req, res) => {
  try {
    const archivePath = req.query.archivePath || getArchiveRoot();
    const clustering = getClusteringService(archivePath);
    const stats = clustering.getClusterStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting cluster stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get cluster members with filtering
// Supports: role filter, image prompt exclusion, pagination, grouping by conversation
app.post('/api/clustering/members', (req, res) => {
  try {
    const archivePath = req.body.archivePath || getArchiveRoot();
    const {
      memberIds,
      clusterId,
      roles,              // ['user', 'assistant'] - filter by role
      excludeImagePrompts = false,
      excludeShortMessages = 0,  // exclude messages shorter than N chars
      limit = 50,
      offset = 0,
      groupByConversation = false,
    } = req.body;

    // Get memberIds either directly or from cached cluster
    let ids = memberIds;
    if (!ids && clusterId) {
      const cachedClusters = discoveredClustersCache.get(archivePath);
      if (cachedClusters) {
        const cluster = cachedClusters.find(c => c.id === clusterId);
        if (cluster) {
          ids = cluster.memberIds;
        }
      }
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: 'memberIds array or valid clusterId required. Run /api/clustering/discover first.',
      });
    }

    const indexer = getIndexer(archivePath);
    const db = indexer.getDatabase();

    const result = db.getMessagesByEmbeddingIds(ids, {
      roles: roles,
      excludeImagePrompts,
      excludeShortMessages,
      limit,
      offset,
      groupByConversation,
    });

    // Convert Map to plain object for JSON serialization
    let response = {
      success: true,
      total: result.total,
      messages: result.messages,
      limit,
      offset,
      hasMore: offset + result.messages.length < result.total,
    };

    if (groupByConversation && result.byConversation) {
      const conversationsArray = [];
      for (const [convId, msgs] of result.byConversation) {
        // Get conversation title from first message
        const title = result.messages.find(m => m.conversationId === convId)?.conversationTitle || 'Untitled';
        conversationsArray.push({
          conversationId: convId,
          conversationTitle: title,
          messageCount: msgs.length,
          messages: msgs,
        });
      }
      // Sort by message count descending
      conversationsArray.sort((a, b) => b.messageCount - a.messageCount);
      response.conversations = conversationsArray;
      response.conversationCount = conversationsArray.length;
    }

    res.json(response);
  } catch (error) {
    console.error('Error getting cluster members:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create an anchor from embedding IDs
app.post('/api/anchors/create', async (req, res) => {
  try {
    const { name, embeddingIds, method = 'centroid' } = req.body;
    const archivePath = req.body.archivePath || getArchiveRoot();

    if (!name || !embeddingIds || !Array.isArray(embeddingIds)) {
      return res.status(400).json({ error: 'name and embeddingIds array are required' });
    }

    const clustering = getClusteringService(archivePath);
    const anchor = clustering.computeAnchor(name, embeddingIds, method);
    const anchorId = clustering.saveAnchor(anchor);

    res.json({ success: true, anchorId, anchor: { id: anchorId, name, type: 'anchor' } });
  } catch (error) {
    console.error('Error creating anchor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create an anti-anchor (point far from targets)
app.post('/api/anchors/create-anti', async (req, res) => {
  try {
    const { name, targetEmbeddingIds, k = 100 } = req.body;
    const archivePath = req.body.archivePath || getArchiveRoot();

    if (!name || !targetEmbeddingIds || !Array.isArray(targetEmbeddingIds)) {
      return res.status(400).json({ error: 'name and targetEmbeddingIds array are required' });
    }

    const clustering = getClusteringService(archivePath);
    const antiAnchor = clustering.computeAntiAnchor(name, targetEmbeddingIds, k);
    const anchorId = clustering.saveAnchor(antiAnchor);

    res.json({ success: true, anchorId, anchor: { id: anchorId, name, type: 'anti_anchor' } });
  } catch (error) {
    console.error('Error creating anti-anchor:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all anchors
app.get('/api/anchors', (req, res) => {
  try {
    const archivePath = req.query.archivePath || getArchiveRoot();
    const indexer = getIndexer(archivePath);
    const db = indexer.getDatabase();
    const anchors = db.getAllAnchors();

    res.json({
      anchors: anchors.map(a => ({
        id: a.id,
        name: a.name,
        type: a.anchorType,
        sourceCount: a.sourceEmbeddingIds.length,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error listing anchors:', error);
    res.status(500).json({ error: error.message });
  }
});

// Find content between anchors
app.post('/api/anchors/between', async (req, res) => {
  try {
    const { anchorIds, weights, limit = 20 } = req.body;
    const archivePath = req.body.archivePath || getArchiveRoot();

    if (!anchorIds || !Array.isArray(anchorIds)) {
      return res.status(400).json({ error: 'anchorIds array is required' });
    }

    const clustering = getClusteringService(archivePath);
    const results = clustering.findBetweenAnchors(anchorIds, weights, limit);

    res.json({ results });
  } catch (error) {
    console.error('Error finding between anchors:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete an anchor
app.delete('/api/anchors/:id', (req, res) => {
  try {
    const archivePath = req.query.archivePath || getArchiveRoot();
    const indexer = getIndexer(archivePath);
    const db = indexer.getDatabase();
    db.deleteAnchor(req.params.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting anchor:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// FACEBOOK FULL IMPORT ENDPOINTS
// ============================================================

// POST /api/import/facebook/preview - Get preview of Facebook export
app.post('/api/import/facebook/preview', async (req, res) => {
  try {
    const { exportDir, settings } = req.body;

    if (!exportDir) {
      return res.status(400).json({ error: 'exportDir is required' });
    }

    console.log(`👀 Getting Facebook import preview: ${exportDir}`);

    const { FacebookFullParser } = await import('./src/services/facebook/index.js');
    const parser = new FacebookFullParser();

    const preview = await parser.getImportPreview(exportDir, settings);

    res.json(preview);
  } catch (error) {
    console.error('Error getting Facebook import preview:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/import/facebook/start - Start Facebook full import
app.post('/api/import/facebook/start', async (req, res) => {
  try {
    const { exportDir, targetDir, archivePath, settings, preserveSource, generateEmbeddings } = req.body;

    if (!exportDir || !targetDir) {
      return res.status(400).json({ error: 'exportDir and targetDir are required' });
    }

    console.log(`🎯 Starting Facebook full import...`);
    console.log(`   Export: ${exportDir}`);
    console.log(`   Target: ${targetDir}`);
    console.log(`   Archive: ${archivePath || 'auto'}`);

    const { FacebookFullParser } = await import('./src/services/facebook/index.js');
    const parser = new FacebookFullParser();

    // Run import (this could be long-running, consider making it async in the future)
    const result = await parser.importExport({
      exportDir,
      targetDir,
      archivePath: archivePath || getArchiveRoot(),
      settings,
      preserveSource: preserveSource !== false,
      generateEmbeddings: generateEmbeddings !== false,
      onProgress: (progress) => {
        console.log(`   Progress: ${progress.stage} - ${progress.message}`);
      },
    });

    console.log(`✅ Facebook import complete!`);
    console.log(`   Archive: ${result.archive_id}`);
    console.log(`   Items: ${result.total_items}`);

    res.json(result);
  } catch (error) {
    console.error('Error importing Facebook export:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// GET /api/content/items - Get content items from database
app.get('/api/content/items', async (req, res) => {
  try {
    const archivePath = req.query.archivePath || getArchiveRoot();
    const source = req.query.source;
    const type = req.query.type;
    const period = req.query.period; // NEW: Filter by period
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const indexer = getIndexer(archivePath);
    const db = indexer.getDatabase();

    let items;
    if (source) {
      items = db.getContentItemsBySource(source);

      // Apply type filter if specified
      if (type) {
        items = items.filter(item => item.type === type);
      }

      // Apply period filter if specified (e.g., "Q2_2015")
      if (period) {
        const [qStr, yearStr] = period.split('_');
        const targetQuarter = parseInt(qStr.replace('Q', ''));
        const targetYear = parseInt(yearStr);

        items = items.filter(item => {
          const date = new Date(item.created_at * 1000);
          const year = date.getFullYear();
          const month = date.getMonth();
          const day = date.getDate();

          // Calculate quarter for this item
          let quarter, qYear;
          const BIRTHDAY_MONTH = 3; // April
          const BIRTHDAY_DAY = 21;

          if ((month === BIRTHDAY_MONTH && day >= BIRTHDAY_DAY) || (month > BIRTHDAY_MONTH && month < 6) || (month === 6 && day < 20)) {
            quarter = 1;
            qYear = year;
          } else if ((month === 6 && day >= 20) || (month > 6 && month < 9) || (month === 9 && day < 18)) {
            quarter = 2;
            qYear = year;
          } else if ((month === 9 && day >= 18) || month === 10 || month === 11 || (month === 0 && day < 16)) {
            quarter = 3;
            qYear = month >= 9 ? year : year - 1;
          } else {
            quarter = 4;
            qYear = month === 0 ? year - 1 : year;
          }

          return quarter === targetQuarter && qYear === targetYear;
        });
      }
    } else if (type) {
      items = db.getContentItemsByType(type);
    } else {
      // Get all - not implemented yet, would need a new method
      items = [];
    }

    // Apply pagination
    const paginated = items.slice(offset, offset + limit);

    res.json({
      items: paginated,
      total: items.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error getting content items:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/facebook/periods - Get all available periods/quarters
app.get('/api/facebook/periods', async (req, res) => {
  try {
    const archivePath = req.query.archivePath || getArchiveRoot();
    const indexer = getIndexer(archivePath);
    const db = indexer.getDatabase();

    // Birthday: April 21 (month 3, day 21 in 0-indexed)
    const BIRTHDAY_MONTH = 3; // April (0-indexed)
    const BIRTHDAY_DAY = 21;

    // Get all Facebook items
    const items = db.db.prepare(`
      SELECT created_at
      FROM content_items
      WHERE source = 'facebook'
      ORDER BY created_at ASC
    `).all();

    // Calculate periods for each item and group
    const periodMap = new Map();

    items.forEach(item => {
      const date = new Date(item.created_at * 1000);
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();

      // Calculate quarter (birthday-based, starting Apr 21)
      // Q1: Apr 21 - Jul 19, Q2: Jul 20 - Oct 17, Q3: Oct 18 - Jan 15, Q4: Jan 16 - Apr 20
      let quarter, qYear;

      if ((month === BIRTHDAY_MONTH && day >= BIRTHDAY_DAY) || (month > BIRTHDAY_MONTH && month < 6) || (month === 6 && day < 20)) {
        quarter = 1;
        qYear = year;
      } else if ((month === 6 && day >= 20) || (month > 6 && month < 9) || (month === 9 && day < 18)) {
        quarter = 2;
        qYear = year;
      } else if ((month === 9 && day >= 18) || month === 10 || month === 11 || (month === 0 && day < 16)) {
        quarter = 3;
        qYear = month >= 9 ? year : year - 1;
      } else {
        quarter = 4;
        qYear = month === 0 ? year - 1 : year;
      }

      const periodKey = `Q${quarter}_${qYear}`;

      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, {
          period: periodKey,
          count: 0,
          start_date: item.created_at,
          end_date: item.created_at,
          quarter,
          year: qYear,
        });
      }

      const period = periodMap.get(periodKey);
      period.count++;
      period.start_date = Math.min(period.start_date, item.created_at);
      period.end_date = Math.max(period.end_date, item.created_at);
    });

    const periods = Array.from(periodMap.values())
      .sort((a, b) => b.year - a.year || b.quarter - a.quarter);

    res.json({ periods });
  } catch (error) {
    console.error('Error getting Facebook periods:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/facebook/media - Get Facebook images/media
app.get('/api/facebook/media', async (req, res) => {
  try {
    const archivePath = req.query.archivePath || getArchiveRoot();
    const period = req.query.period;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const indexer = getIndexer(archivePath);
    const db = indexer.getDatabase();

    // Get items with media
    let items = db.db.prepare(`
      SELECT id, type, text, title, created_at, media_refs, media_count, file_path
      FROM content_items
      WHERE source = 'facebook' AND media_count > 0
      ${period ? "AND file_path LIKE '%' || ? || '%'" : ""}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...(period ? [period, limit, offset] : [limit, offset]));

    // Parse media_refs and flatten
    const media = [];
    items.forEach(item => {
      try {
        const refs = JSON.parse(item.media_refs || '[]');
        refs.forEach(ref => {
          media.push({
            url: ref,
            postId: item.id,
            postType: item.type,
            postText: item.text,
            postTitle: item.title,
            created_at: item.created_at,
          });
        });
      } catch (e) {
        // Skip invalid JSON
      }
    });

    res.json({
      media,
      total: media.length,
      hasMore: items.length === limit,
    });
  } catch (error) {
    console.error('Error getting Facebook media:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/facebook/image - Serve Facebook images by encoded path
app.get('/api/facebook/image', async (req, res) => {
  try {
    // Path is base64-encoded to avoid URL encoding issues
    const encodedPath = req.query.path;
    if (!encodedPath) {
      return res.status(400).json({ error: 'path parameter is required' });
    }

    const imagePath = Buffer.from(encodedPath, 'base64').toString('utf-8');

    // Check if file exists
    await fs.access(imagePath);

    // Determine content type
    const ext = path.extname(imagePath).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    const fileData = await fs.readFile(imagePath);
    res.send(fileData);
  } catch (error) {
    console.error(`Error serving Facebook image:`, error);
    res.status(404).json({ error: 'Image file not found' });
  }
});

// GET /api/facebook/media-gallery - Get all media with advanced filters
app.get('/api/facebook/media-gallery', async (req, res) => {
  try {
    const archivePath = req.query.archivePath || getArchiveRoot();

    // Parse query parameters
    const filters = {
      sourceType: req.query.sourceType,
      mediaType: req.query.mediaType,
      period: req.query.period,
      filenamePattern: req.query.filename,
      minSize: req.query.minSize ? parseInt(req.query.minSize) : undefined,
      maxSize: req.query.maxSize ? parseInt(req.query.maxSize) : undefined,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
    };

    // Parse dimension filters (ballpark matching with tolerance)
    if (req.query.widthMin && req.query.widthMax) {
      filters.widthRange = [
        parseInt(req.query.widthMin),
        parseInt(req.query.widthMax),
      ];
    }
    if (req.query.heightMin && req.query.heightMax) {
      filters.heightRange = [
        parseInt(req.query.heightMin),
        parseInt(req.query.heightMax),
      ];
    }

    // Import MediaItemsDatabase
    const { MediaItemsDatabase } = await import('./src/services/facebook/MediaItemsDatabase.js');
    const mediaDb = new MediaItemsDatabase(archivePath);

    // Get media items with filters
    const items = mediaDb.getMediaItems(filters);
    const total = mediaDb.getTotalMediaCount();
    const countBySource = mediaDb.getMediaCountBySource();

    mediaDb.close();

    res.json({
      items,
      total,
      countBySource,
      filters,
      hasMore: items.length === filters.limit,
    });
  } catch (error) {
    console.error('Error getting media gallery:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/facebook/media-stats - Get media statistics
app.get('/api/facebook/media-stats', async (req, res) => {
  try {
    const archivePath = req.query.archivePath || getArchiveRoot();

    const { MediaItemsDatabase } = await import('./src/services/facebook/MediaItemsDatabase.js');
    const mediaDb = new MediaItemsDatabase(archivePath);

    const total = mediaDb.getTotalMediaCount();
    const countBySource = mediaDb.getMediaCountBySource();

    // Get count by media type
    const allItems = mediaDb.getMediaItems({ limit: 100000 });
    const imageCount = allItems.filter(m => m.media_type === 'image').length;
    const videoCount = allItems.filter(m => m.media_type === 'video').length;

    // Get size statistics
    const sizes = allItems.map(m => m.file_size);
    const totalSize = sizes.reduce((sum, s) => sum + s, 0);
    const avgSize = totalSize / sizes.length;

    mediaDb.close();

    res.json({
      total,
      images: imageCount,
      videos: videoCount,
      bySource: countBySource,
      totalSizeBytes: totalSize,
      averageSizeBytes: Math.round(avgSize),
    });
  } catch (error) {
    console.error('Error getting media stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/content/search - Semantic search across content items
app.post('/api/content/search', async (req, res) => {
  try {
    const { query, limit = 20, type, source, archivePath: reqArchivePath } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const archivePath = reqArchivePath || getArchiveRoot();
    const indexer = getIndexer(archivePath);
    const db = indexer.getDatabase();

    // Import embed function dynamically
    const { embed } = await import('./src/services/embeddings/EmbeddingGenerator.js');

    // Generate embedding for query
    const queryEmbedding = await embed(query);

    // Search content items
    const results = db.searchContentItems(
      Array.from(queryEmbedding),
      limit,
      type,
      source
    );

    // Fetch full content items
    const items = results.map(result => {
      const item = db.getContentItem(result.content_item_id);
      return {
        ...item,
        distance: result.distance,
        similarity: 1 - result.distance,
      };
    });

    res.json({ results: items, query });
  } catch (error) {
    console.error('Error searching content items:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// STUDIO TOOLS: QUANTUM READING
// Deep semantic analysis using local Ollama
// ============================================================

app.post('/api/quantum/analyze', async (req, res) => {
  try {
    const {
      text,
      depth = 'deep',
      focusTopics = [],
      includeEmotional = true,
      findConnections = true,
    } = req.body;

    if (!text || text.trim().length < 20) {
      return res.status(400).json({ error: 'Text must be at least 20 characters' });
    }

    console.log(`\n🔮 Quantum Reading: Analyzing ${text.length} characters (${depth} depth)`);
    const startTime = Date.now();

    // Build the analysis prompt based on depth
    let analysisPrompt;
    const focusContext = focusTopics.length > 0
      ? `\nFocus especially on these topics: ${focusTopics.join(', ')}`
      : '';

    if (depth === 'surface') {
      analysisPrompt = `Analyze this text briefly. Identify 3-5 main themes and provide a one-sentence summary.
${focusContext}

TEXT:
${text}

Respond in JSON format:
{
  "themes": ["theme1", "theme2", ...],
  "summary": "one sentence summary"
}`;
    } else if (depth === 'quantum') {
      analysisPrompt = `Perform a deep phenomenological analysis of this text. Explore multiple layers of meaning, emotional undertones, implicit assumptions, and connections to broader concepts.
${focusContext}
${includeEmotional ? '\nInclude emotional resonance mapping with intensity scores (0-1).' : ''}

TEXT:
${text}

Respond in JSON format:
{
  "themes": ["theme1", "theme2", ...],
  "summary": "detailed interpretive summary",
  "anchors": [
    {"term": "key concept", "significance": 0.9, "context": "why this matters"}
  ],
  ${includeEmotional ? '"emotionalProfile": {"curiosity": 0.7, "tension": 0.3, ...},' : ''}
  "phenomenologicalLayers": {
    "surface": "what the text explicitly says",
    "implicit": "what is implied but not stated",
    "existential": "deeper meaning or significance"
  }
}`;
    } else {
      // deep (default)
      analysisPrompt = `Analyze this text in depth. Identify themes, key concepts (anchors), and provide a comprehensive summary.
${focusContext}
${includeEmotional ? '\nInclude emotional resonance mapping with intensity scores (0-1).' : ''}

TEXT:
${text}

Respond in JSON format:
{
  "themes": ["theme1", "theme2", ...],
  "summary": "comprehensive summary",
  "anchors": [
    {"term": "key concept", "significance": 0.8, "context": "brief explanation"}
  ]${includeEmotional ? ',\n  "emotionalProfile": {"curiosity": 0.5, "engagement": 0.7, ...}' : ''}
}`;
    }

    // Call Ollama for analysis
    let analysis;
    try {
      const ollamaResponse = await callOllama(analysisPrompt);
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = ollamaResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Ollama response:', parseError);
      // Fallback to basic analysis
      analysis = {
        themes: ['Unable to parse AI response'],
        summary: 'Analysis completed but response format was invalid. Try again.',
        anchors: [],
      };
    }

    // Find connections in archive if requested
    let connections = [];
    if (findConnections && embeddingDatabase) {
      try {
        const searchResults = await embeddingDatabase.search(text.substring(0, 500), 5);
        connections = searchResults.map(r => ({
          messageId: r.message_id,
          snippet: r.text?.substring(0, 200) || '',
          similarity: r.similarity || 0,
        }));
      } catch (searchError) {
        console.log('Archive search unavailable:', searchError.message);
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`✨ Quantum Reading complete in ${processingTime}ms\n`);

    res.json({
      themes: analysis.themes || [],
      summary: analysis.summary || '',
      anchors: analysis.anchors || [],
      emotionalProfile: analysis.emotionalProfile || {},
      phenomenologicalLayers: analysis.phenomenologicalLayers,
      connections,
      depth,
      processingTime,
    });
  } catch (error) {
    console.error('❌ Quantum Reading error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// STUDIO TOOLS: VOICE DISCOVERY
// Extract persona/voice from text using local Ollama
// ============================================================

app.post('/api/voice/extract', async (req, res) => {
  try {
    const {
      text,
      personaName = 'Extracted Voice',
      analysisScope = 'comprehensive',
      includeExamples = true,
      detectMultipleVoices = false,
    } = req.body;

    if (!text || text.trim().length < 100) {
      return res.status(400).json({ error: 'Text must be at least 100 characters for voice analysis' });
    }

    console.log(`\n🎭 Voice Discovery: Analyzing ${text.length} characters (${analysisScope} scope)`);
    const startTime = Date.now();

    // Build the extraction prompt based on scope
    let extractionPrompt;

    if (analysisScope === 'quick') {
      extractionPrompt = `Quickly analyze the writing voice in this text. Identify the main tone, style, and 3-5 key characteristics.

TEXT:
${text}

Respond in JSON format:
{
  "name": "${personaName}",
  "description": "brief description of the voice",
  "traits": [
    {"trait": "characteristic", "strength": 0.8, "examples": []}
  ],
  "tone": {
    "primary": "main tone",
    "secondary": ["other tones"]
  }
}`;
    } else if (analysisScope === 'comparative') {
      extractionPrompt = `Analyze the writing voice in this text comprehensively, as if preparing to compare it against other writing samples.

TEXT:
${text}

${detectMultipleVoices ? 'Also check if there appear to be multiple distinct voices in the text.' : ''}

Respond in JSON format:
{
  "name": "${personaName}",
  "description": "detailed description",
  "traits": [
    {"trait": "characteristic", "strength": 0.9, "examples": ${includeExamples ? '["quote1", "quote2"]' : '[]'}}
  ],
  "vocabulary": {
    "complexity": "simple|moderate|sophisticated",
    "preferredTerms": ["words they use often"],
    "avoidedTerms": ["words they never use"]
  },
  "sentencePatterns": {
    "averageLength": 15,
    "preferredStructures": ["short declarative", "complex compound"]
  },
  "tone": {
    "primary": "main tone",
    "secondary": ["other tones"],
    "emotionalRange": {"curiosity": 0.7, "formality": 0.5}
  },
  "distinctiveMarkers": ["unique patterns or phrases"]
  ${detectMultipleVoices ? ',"multipleVoices": [{"voiceId": 1, "percentage": 70, "characteristics": ["..."]}]' : ''}
}`;
    } else {
      // comprehensive (default)
      extractionPrompt = `Perform a comprehensive voice analysis of this text. Extract all characteristics needed to recreate this writing voice.

TEXT:
${text}

${detectMultipleVoices ? 'Also check if there appear to be multiple distinct voices in the text.' : ''}

Respond in JSON format:
{
  "name": "${personaName}",
  "description": "comprehensive description of the voice and its character",
  "traits": [
    {"trait": "characteristic", "strength": 0.85, "examples": ${includeExamples ? '["quote from text"]' : '[]'}}
  ],
  "vocabulary": {
    "complexity": "simple|moderate|sophisticated",
    "preferredTerms": ["words/phrases they favor"],
    "avoidedTerms": ["words/phrases they avoid"]
  },
  "sentencePatterns": {
    "averageLength": 12,
    "preferredStructures": ["pattern descriptions"]
  },
  "tone": {
    "primary": "dominant tone",
    "secondary": ["supporting tones"],
    "emotionalRange": {"dimension": 0.5}
  },
  "systemPrompt": "A brief instruction that could be used to prompt an AI to write in this voice"
  ${detectMultipleVoices ? ',"multipleVoices": [{"voiceId": 1, "percentage": 80, "characteristics": ["..."]}]' : ''}
}`;
    }

    // Call Ollama for voice extraction
    let voiceProfile;
    try {
      const ollamaResponse = await callOllama(extractionPrompt);
      // Extract JSON from response
      const jsonMatch = ollamaResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        voiceProfile = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Ollama response:', parseError);
      voiceProfile = {
        name: personaName,
        description: 'Voice extraction completed but response format was invalid. Try again.',
        traits: [],
        tone: { primary: 'unknown', secondary: [] },
      };
    }

    const processingTime = Date.now() - startTime;
    console.log(`✨ Voice Discovery complete in ${processingTime}ms\n`);

    res.json({
      persona: {
        name: voiceProfile.name || personaName,
        description: voiceProfile.description || '',
        traits: voiceProfile.traits || [],
        vocabulary: voiceProfile.vocabulary || {},
        sentencePatterns: voiceProfile.sentencePatterns || {},
        tone: voiceProfile.tone || {},
        systemPrompt: voiceProfile.systemPrompt,
      },
      multipleVoices: voiceProfile.multipleVoices,
      confidence: 0.85,
      processingTime,
      analysisScope,
    });
  } catch (error) {
    console.error('❌ Voice Discovery error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: Date.now() });
});

const PORT = parseInt(process.env.PORT || '3002', 10);
app.listen(PORT, () => {
  console.log(`🗂️  Archive server running on http://localhost:${PORT}`);
  console.log(`📂 Serving: ${ARCHIVE_ROOT}`);
  console.log(`🤖 Ollama integration: http://localhost:11434`);
  console.log(`💾 Session storage: ${SESSION_STORAGE_DIR}`);
});
