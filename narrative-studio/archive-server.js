import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { JSDOM } from 'jsdom';

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

    // Build file ID to hashed filename mapping using assetPointerMap
    const fileIdToHashedName = {};

    if (parsed.mapping && Object.keys(assetPointerMap).length > 0) {
      Object.values(parsed.mapping).forEach((node) => {
        if (node.message?.content?.parts) {
          node.message.content.parts.forEach(part => {
            if (part && part.content_type === 'image_asset_pointer') {
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

    console.log(`🔗 Built mapping for ${Object.keys(fileIdToHashedName).length}/${Object.keys(assetPointerMap).length} file IDs`);
    if (Object.keys(fileIdToHashedName).length > 0) {
      console.log('Sample mappings:', Object.keys(fileIdToHashedName).slice(0, 3).map(id => `${id.substring(0, 25)}... → ${fileIdToHashedName[id].substring(0, 45)}...`));
    }

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
                // Match both file- (hyphen) and file_ (underscore) formats
                const fileIdMatch = assetPointer.match(/:\/\/(file[-_][A-Za-z0-9]+)/);
                const fileId = fileIdMatch ? fileIdMatch[1] : 'image';
                return `[Image: ${fileId}]`;
              }
              return JSON.stringify(part);
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

// Helper: Parse code blocks from message content
function parseCodeBlocks(content) {
  const blocks = {};
  // Match code blocks: ```language or just ```
  const codeBlockRegex = /```(\w+)?\n[\s\S]*?```/g;
  const matches = content.matchAll(codeBlockRegex);

  for (const match of matches) {
    const language = match[1] || 'text';
    blocks[language] = (blocks[language] || 0) + 1;
  }

  return blocks;
}

// Helper: Detect media types from message content
function detectMediaTypes(messages) {
  const mediaTypes = new Set();
  let mediaCount = 0;

  for (const msg of messages) {
    // Check for image references
    if (msg.content.includes('![') || msg.content.includes('file-service://file') || msg.content.includes('sediment://')) {
      mediaTypes.add('image');
      mediaCount++;
    }
    // Check for audio references
    if (msg.content.includes('.mp3') || msg.content.includes('.wav') || msg.content.includes('.m4a')) {
      mediaTypes.add('audio');
      mediaCount++;
    }
  }

  return { mediaTypes: Array.from(mediaTypes), mediaCount };
}

// Get or generate archive index
app.get('/api/archive-index', async (req, res) => {
  try {
    const indexPath = path.join(ARCHIVE_ROOT, '.archive-index.json');

    // Check if index exists and is fresh
    try {
      const indexStat = await fs.stat(indexPath);
      const convStat = await fs.stat(ARCHIVE_ROOT);

      // If index is newer than archive root, return cached index
      if (indexStat.mtimeMs > convStat.mtimeMs) {
        const indexData = await fs.readFile(indexPath, 'utf-8');
        return res.json(JSON.parse(indexData));
      }
    } catch (err) {
      // Index doesn't exist, will generate below
    }

    // Generate new index
    console.log('📊 Generating archive index...');
    const folders = await fs.readdir(ARCHIVE_ROOT);
    const conversationStats = [];

    for (const folder of folders) {
      if (folder.startsWith('_') || folder.startsWith('.') || !/^\d{4}-\d{2}-\d{2}/.test(folder)) {
        continue;
      }

      try {
        const jsonPath = path.join(ARCHIVE_ROOT, folder, 'conversation.json');
        const data = await fs.readFile(jsonPath, 'utf-8');
        const parsed = JSON.parse(data);

        const codeBlocks = {};
        const messages = [];

        // Extract messages and parse code blocks
        if (parsed.mapping) {
          Object.values(parsed.mapping).forEach(node => {
            if (node.message && node.message.content?.parts?.length > 0) {
              const role = node.message.author?.role || 'unknown';
              const content = node.message.content.parts.join('\n');

              messages.push({ role, content });

              // Only parse code blocks from assistant messages
              if (role === 'assistant') {
                const blocks = parseCodeBlocks(content);
                for (const [lang, count] of Object.entries(blocks)) {
                  codeBlocks[lang] = (codeBlocks[lang] || 0) + count;
                }
              }
            }
          });
        }

        const { mediaTypes, mediaCount } = detectMediaTypes(messages);

        conversationStats.push({
          id: parsed.id || folder,
          folder,
          code_blocks: codeBlocks,
          media_types: mediaTypes,
          media_count: mediaCount,
        });
      } catch (err) {
        console.warn(`Skipping ${folder}: ${err.message}`);
      }
    }

    const index = {
      version: 1,
      generated_at: new Date().toISOString(),
      conversations: conversationStats,
    };

    // Save index
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    console.log(`✅ Generated index for ${conversationStats.length} conversations`);

    res.json(index);
  } catch (error) {
    console.error('Error generating archive index:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`🗂️  Archive server running on http://localhost:${PORT}`);
  console.log(`📂 Serving: ${ARCHIVE_ROOT}`);
});
