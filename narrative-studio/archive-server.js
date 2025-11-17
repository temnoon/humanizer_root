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

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`🗂️  Archive server running on http://localhost:${PORT}`);
  console.log(`📂 Serving: ${ARCHIVE_ROOT}`);
  console.log(`🤖 Ollama integration: http://localhost:11434`);
});
