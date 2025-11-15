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
                const fileIdMatch = assetPointer.match(/:\/\/(file[-_][A-Za-z0-9]+)/);
                const fileId = fileIdMatch ? fileIdMatch[1] : 'image';
                return `[Image: ${fileId}]`;
              }
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

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`🗂️  Archive server running on http://localhost:${PORT}`);
  console.log(`📂 Serving: ${ARCHIVE_ROOT}`);
});
