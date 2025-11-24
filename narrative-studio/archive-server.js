import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { JSDOM } from 'jsdom';
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

const ARCHIVE_ROOT = '/Users/tem/openai-export-parser/output_v13_final';
const SESSION_STORAGE_DIR = path.join(os.homedir(), '.humanizer', 'sessions');
const ARCHIVE_UPLOADS_DIR = '/tmp/archive-uploads';

// Configure multer for ZIP uploads
const upload = multer({
  dest: ARCHIVE_UPLOADS_DIR,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
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

// Ensure directories exist
(async () => {
  try {
    await fs.mkdir(SESSION_STORAGE_DIR, { recursive: true });
    await fs.mkdir(ARCHIVE_UPLOADS_DIR, { recursive: true });
    console.log(`📁 Session storage directory ready: ${SESSION_STORAGE_DIR}`);
    console.log(`📁 Archive uploads directory ready: ${ARCHIVE_UPLOADS_DIR}`);
  } catch (error) {
    console.error('Failed to create directories:', error);
  }
})();

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
app.post('/api/import/archive/upload', upload.single('archive'), async (req, res) => {
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

// POST /api/import/archive/parse - Trigger parsing (async job)
app.post('/api/import/archive/parse', async (req, res) => {
  try {
    const { jobId } = req.body;
    const job = importJobs.get(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'uploaded') {
      return res.status(400).json({ error: `Cannot parse job in status: ${job.status}` });
    }

    job.status = 'parsing';
    job.progress = 10;

    console.log(`🔍 Starting parse for job ${jobId}...`);
    res.json({ jobId, status: 'parsing' });

    // Parse in background (don't block response)
    setImmediate(async () => {
      try {
        job.progress = 20;

        // Step 1: Parse archive
        const parser = new ConversationParser();
        const archive = await parser.parseArchive(job.zipPath);

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
        console.log(`   - New conversations: ${preview.new_conversations.length}`);
        console.log(`   - Updated conversations: ${preview.updated_conversations.length}`);
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

    console.log(`🚀 Applying import for job ${req.params.jobId}...`);

    // Apply in background
    setImmediate(async () => {
      try {
        const importer = new IncrementalImporter();
        const result = await importer.applyImport(
          job.archive.conversations,
          ARCHIVE_ROOT,
          {
            onProgress: (progress, message) => {
              job.progress = progress;
              job.statusMessage = message;
              console.log(`   [${progress}%] ${message}`);
            }
          }
        );

        job.result = result;
        job.status = 'completed';
        job.progress = 100;

        console.log(`✅ Import completed for job ${req.params.jobId}:`);
        console.log(`   - Conversations created: ${result.conversations_created}`);
        console.log(`   - Conversations updated: ${result.conversations_updated}`);
        console.log(`   - Messages added: ${result.messages_added}`);
        console.log(`   - Media files copied: ${result.media_files_copied}`);

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

    res.json({ jobId: job.id, status: 'applying' });
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

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`🗂️  Archive server running on http://localhost:${PORT}`);
  console.log(`📂 Serving: ${ARCHIVE_ROOT}`);
  console.log(`🤖 Ollama integration: http://localhost:11434`);
  console.log(`💾 Session storage: ${SESSION_STORAGE_DIR}`);
});
