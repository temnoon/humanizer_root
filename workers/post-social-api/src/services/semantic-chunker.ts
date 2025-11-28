/**
 * Semantic Chunker
 *
 * Creates Level 0 chunks from preprocessed text:
 * 1. Groups paragraphs into ~1000 token chunks
 * 2. Never splits mid-sentence
 * 3. Classifies content type (narration, dialogue, etc.)
 * 4. Extracts dialogue speakers
 * 5. Assigns structural position within chapter
 *
 * Target: ~1000 tokens per chunk (max 1200)
 * A token ≈ 4 characters or 0.75 words in English
 */

import type {
  PreprocessedText,
  Paragraph,
  StructuralUnit,
} from './gutenberg-preprocessor';

// ==========================================
// Types
// ==========================================

export interface ChunkConfig {
  targetTokens: number;      // Target chunk size (default: 1000)
  maxTokens: number;         // Hard maximum (default: 1200)
  minTokens: number;         // Minimum size (default: 200)
  overlapSentences: number;  // Sentences to overlap (default: 0)
}

export interface TextChunk {
  content: string;
  tokenCount: number;
  charStart: number;
  charEnd: number;
  chapterNumber?: number;
  chapterTitle?: string;
  partNumber?: number;
  structuralPosition: 'opening' | 'early' | 'middle' | 'late' | 'closing';
  chunkType: 'narration' | 'dialogue' | 'exposition' | 'description' | 'action' | 'interior' | 'mixed';
  containsDialogue: boolean;
  dialogueSpeakers: string[];
  sentenceCount: number;
  paragraphCount: number;
}

export interface ChunkingResult {
  chunks: TextChunk[];
  stats: {
    totalChunks: number;
    averageTokens: number;
    minTokens: number;
    maxTokens: number;
    totalSentences: number;
  };
}

const DEFAULT_CONFIG: ChunkConfig = {
  targetTokens: 1000,
  maxTokens: 1200,
  minTokens: 200,
  overlapSentences: 0,
};

// ==========================================
// Token Estimation
// ==========================================

/**
 * Estimate token count for text
 * Uses simple heuristic: ~4 chars per token for English
 */
export function estimateTokens(text: string): number {
  // More accurate: count words and adjust
  const words = text.trim().split(/\s+/).length;
  // GPT-style: ~1.3 tokens per word average for English
  // But for literary text with longer words, closer to 1.5
  return Math.ceil(words * 1.4);
}

/**
 * Count sentences in text
 */
export function countSentences(text: string): number {
  // Match sentence endings, accounting for abbreviations
  const sentences = text.match(/[^.!?]*[.!?]+(?:\s|$)/g);
  return sentences ? sentences.length : 1;
}

/**
 * Split text into sentences
 */
export function splitSentences(text: string): string[] {
  // Split on sentence boundaries, keeping the punctuation
  const sentences = text.match(/[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g);
  return sentences ? sentences.map(s => s.trim()).filter(s => s.length > 0) : [text];
}

// ==========================================
// Content Classification
// ==========================================

/**
 * Classify chunk content type
 */
export function classifyContent(text: string): TextChunk['chunkType'] {
  const scores = {
    narration: 0,
    dialogue: 0,
    exposition: 0,
    description: 0,
    action: 0,
    interior: 0,
  };

  // Dialogue indicators
  const quoteCount = (text.match(/["'"]/g) || []).length;
  const saidVerbs = (text.match(/\b(said|asked|replied|answered|shouted|whispered|cried|exclaimed|muttered|declared|added|continued|began|interrupted|demanded|insisted|suggested|wondered|thought)\b/gi) || []).length;
  if (quoteCount >= 4) scores.dialogue += 3;
  if (saidVerbs >= 2) scores.dialogue += 2;

  // Action indicators
  const actionVerbs = (text.match(/\b(ran|jumped|grabbed|threw|hit|fell|climbed|rushed|charged|struck|seized|leaped|darted|scrambled|ducked)\b/gi) || []).length;
  const actionPhrases = (text.match(/(suddenly|quickly|immediately|at once|in a flash)/gi) || []).length;
  scores.action += actionVerbs * 2 + actionPhrases;

  // Description indicators
  const descriptiveWords = (text.match(/\b(beautiful|dark|light|vast|small|ancient|worn|bright|dim|cold|warm|soft|hard|rough|smooth)\b/gi) || []).length;
  const settingWords = (text.match(/\b(room|house|street|sky|sea|mountain|forest|city|village|window|door|wall|floor|ceiling)\b/gi) || []).length;
  scores.description += descriptiveWords + settingWords;

  // Interior (thoughts/feelings) indicators
  const thoughtWords = (text.match(/\b(thought|felt|wondered|realized|knew|believed|feared|hoped|wished|imagined|remembered|recalled)\b/gi) || []).length;
  const emotionWords = (text.match(/\b(heart|soul|mind|spirit|feeling|emotion|joy|sorrow|anger|fear|love|hate|despair|hope)\b/gi) || []).length;
  scores.interior += thoughtWords * 2 + emotionWords;

  // Exposition indicators (factual/explanatory)
  const expositionPatterns = (text.match(/\b(because|therefore|thus|however|moreover|furthermore|indeed|certainly|naturally|of course)\b/gi) || []).length;
  const generalizations = (text.match(/\b(always|never|every|all|none|any|most|some|often|usually|generally|typically)\b/gi) || []).length;
  scores.exposition += expositionPatterns + generalizations;

  // Narration is the default/baseline
  scores.narration = 3;

  // Find highest score
  let maxType: TextChunk['chunkType'] = 'narration';
  let maxScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxType = type as TextChunk['chunkType'];
    }
  }

  // If multiple high scores, classify as mixed
  const highScores = Object.values(scores).filter(s => s >= maxScore * 0.8);
  if (highScores.length >= 3) {
    return 'mixed';
  }

  return maxType;
}

/**
 * Extract dialogue speakers from text
 */
export function extractSpeakers(text: string): string[] {
  const speakers = new Set<string>();

  // Pattern: "..." said NAME
  const saidPatterns = text.matchAll(/["'][^"']+["']\s*(?:,?\s*)(?:said|asked|replied|answered|shouted|whispered|cried|exclaimed|muttered)\s+(\w+(?:\s+\w+)?)/gi);
  for (const match of saidPatterns) {
    const name = match[1].trim();
    if (name && name.length > 1 && name.length < 30 && !isCommonWord(name)) {
      speakers.add(name);
    }
  }

  // Pattern: NAME said, "..."
  const prefixPatterns = text.matchAll(/(\w+(?:\s+\w+)?)\s+(?:said|asked|replied|answered|shouted|whispered|cried|exclaimed|muttered)(?:\s+to\s+\w+)?,?\s*["']/gi);
  for (const match of prefixPatterns) {
    const name = match[1].trim();
    if (name && name.length > 1 && name.length < 30 && !isCommonWord(name)) {
      speakers.add(name);
    }
  }

  return Array.from(speakers);
}

/**
 * Check if word is too common to be a speaker name
 */
function isCommonWord(word: string): boolean {
  const common = new Set([
    'he', 'she', 'they', 'it', 'i', 'we', 'you',
    'the', 'a', 'an', 'and', 'but', 'or', 'so',
    'that', 'this', 'these', 'those',
    'what', 'who', 'where', 'when', 'why', 'how',
    'one', 'two', 'three', 'first', 'last',
    'then', 'now', 'here', 'there',
    'man', 'woman', 'boy', 'girl', 'person',
  ]);
  return common.has(word.toLowerCase());
}

/**
 * Calculate structural position within a chapter
 */
export function calculatePosition(
  chunkIndex: number,
  totalChunks: number
): TextChunk['structuralPosition'] {
  if (totalChunks <= 1) return 'middle';

  const position = chunkIndex / (totalChunks - 1);

  if (position <= 0.05) return 'opening';
  if (position <= 0.25) return 'early';
  if (position <= 0.75) return 'middle';
  if (position <= 0.95) return 'late';
  return 'closing';
}

// ==========================================
// Chunking Algorithm
// ==========================================

/**
 * Create chunks from preprocessed text
 */
export function createChunks(
  preprocessed: PreprocessedText,
  config: Partial<ChunkConfig> = {}
): ChunkingResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const allChunks: TextChunk[] = [];

  // Process each structural unit separately
  for (const unit of preprocessed.structure) {
    const unitChunks = chunkStructuralUnit(unit, preprocessed.paragraphs, cfg);
    allChunks.push(...unitChunks);
  }

  // If no structure was detected, chunk the whole text
  if (preprocessed.structure.length === 0) {
    const wholeChunks = chunkParagraphs(
      preprocessed.paragraphs,
      cfg,
      undefined,
      undefined
    );
    allChunks.push(...wholeChunks);
  }

  // Calculate stats
  const tokenCounts = allChunks.map(c => c.tokenCount);
  const stats = {
    totalChunks: allChunks.length,
    averageTokens: Math.round(tokenCounts.reduce((a, b) => a + b, 0) / allChunks.length),
    minTokens: Math.min(...tokenCounts),
    maxTokens: Math.max(...tokenCounts),
    totalSentences: allChunks.reduce((sum, c) => sum + c.sentenceCount, 0),
  };

  return { chunks: allChunks, stats };
}

/**
 * Chunk a single structural unit (chapter, part, etc.)
 */
function chunkStructuralUnit(
  unit: StructuralUnit,
  allParagraphs: Paragraph[],
  config: ChunkConfig
): TextChunk[] {
  // Find paragraphs in this unit
  const unitParagraphs = allParagraphs.filter(p =>
    p.charStart >= unit.charStart && p.charEnd <= unit.charEnd
  );

  // Get chapter/part info
  let chapterNumber: number | undefined;
  let chapterTitle: string | undefined;
  let partNumber: number | undefined;

  if (unit.type === 'chapter') {
    chapterNumber = unit.number;
    chapterTitle = unit.title;
  } else if (unit.type === 'part') {
    partNumber = unit.number;
  }

  return chunkParagraphs(unitParagraphs, config, chapterNumber, chapterTitle, partNumber);
}

/**
 * Create chunks from a list of paragraphs
 */
function chunkParagraphs(
  paragraphs: Paragraph[],
  config: ChunkConfig,
  chapterNumber?: number,
  chapterTitle?: string,
  partNumber?: number
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let currentContent: string[] = [];
  let currentTokens = 0;
  let currentCharStart = paragraphs[0]?.charStart || 0;
  let currentSentences = 0;
  let paragraphCount = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph.content);
    const paragraphSentences = countSentences(paragraph.content);

    // Would adding this paragraph exceed the target?
    if (currentTokens + paragraphTokens > config.targetTokens && currentTokens >= config.minTokens) {
      // Finalize current chunk
      const content = currentContent.join('\n\n');
      const chunkIndex = chunks.length;

      chunks.push(createChunkFromContent(
        content,
        currentCharStart,
        paragraph.charStart - 1,
        currentSentences,
        paragraphCount,
        chapterNumber,
        chapterTitle,
        partNumber
      ));

      // Start new chunk
      currentContent = [paragraph.content];
      currentTokens = paragraphTokens;
      currentCharStart = paragraph.charStart;
      currentSentences = paragraphSentences;
      paragraphCount = 1;
    } else {
      // Add to current chunk
      currentContent.push(paragraph.content);
      currentTokens += paragraphTokens;
      currentSentences += paragraphSentences;
      paragraphCount++;
    }

    // Safety: if we're way over, force a new chunk
    if (currentTokens > config.maxTokens) {
      // Need to split mid-paragraph at sentence boundary
      const sentences = splitSentences(currentContent.join('\n\n'));
      let splitContent: string[] = [];
      let splitTokens = 0;

      for (const sentence of sentences) {
        const sentenceTokens = estimateTokens(sentence);
        if (splitTokens + sentenceTokens > config.targetTokens && splitTokens > 0) {
          // Finalize chunk at sentence boundary
          const content = splitContent.join(' ');
          chunks.push(createChunkFromContent(
            content,
            currentCharStart,
            currentCharStart + content.length,
            splitContent.length,
            paragraphCount,
            chapterNumber,
            chapterTitle,
            partNumber
          ));

          // Reset
          splitContent = [sentence];
          splitTokens = sentenceTokens;
          currentCharStart += content.length + 1;
        } else {
          splitContent.push(sentence);
          splitTokens += sentenceTokens;
        }
      }

      // Whatever remains
      currentContent = splitContent;
      currentTokens = splitTokens;
      currentSentences = splitContent.length;
    }
  }

  // Don't forget the last chunk
  if (currentContent.length > 0 && currentTokens >= config.minTokens) {
    const content = currentContent.join('\n\n');
    chunks.push(createChunkFromContent(
      content,
      currentCharStart,
      paragraphs[paragraphs.length - 1]?.charEnd || currentCharStart + content.length,
      currentSentences,
      paragraphCount,
      chapterNumber,
      chapterTitle,
      partNumber
    ));
  } else if (currentContent.length > 0 && chunks.length > 0) {
    // Merge with previous chunk if too small
    const lastChunk = chunks[chunks.length - 1];
    const additionalContent = currentContent.join('\n\n');
    lastChunk.content += '\n\n' + additionalContent;
    lastChunk.tokenCount += currentTokens;
    lastChunk.charEnd = paragraphs[paragraphs.length - 1]?.charEnd || lastChunk.charEnd;
    lastChunk.sentenceCount += currentSentences;
    lastChunk.paragraphCount += paragraphCount;
  }

  // Update structural positions based on final count
  for (let i = 0; i < chunks.length; i++) {
    chunks[i].structuralPosition = calculatePosition(i, chunks.length);
  }

  return chunks;
}

/**
 * Create a TextChunk from content
 */
function createChunkFromContent(
  content: string,
  charStart: number,
  charEnd: number,
  sentenceCount: number,
  paragraphCount: number,
  chapterNumber?: number,
  chapterTitle?: string,
  partNumber?: number
): TextChunk {
  const speakers = extractSpeakers(content);

  return {
    content,
    tokenCount: estimateTokens(content),
    charStart,
    charEnd,
    chapterNumber,
    chapterTitle,
    partNumber,
    structuralPosition: 'middle', // Will be updated later
    chunkType: classifyContent(content),
    containsDialogue: speakers.length > 0 || content.includes('"'),
    dialogueSpeakers: speakers,
    sentenceCount,
    paragraphCount,
  };
}

// ==========================================
// Convenience Functions
// ==========================================

/**
 * Chunk preprocessed text with default settings
 */
export function chunkText(preprocessed: PreprocessedText): ChunkingResult {
  return createChunks(preprocessed);
}

/**
 * Get chunk by index with context (previous/next chunks)
 */
export function getChunkWithContext(
  chunks: TextChunk[],
  index: number,
  contextSize: number = 1
): {
  previous: TextChunk[];
  current: TextChunk;
  next: TextChunk[];
} {
  const start = Math.max(0, index - contextSize);
  const end = Math.min(chunks.length, index + contextSize + 1);

  return {
    previous: chunks.slice(start, index),
    current: chunks[index],
    next: chunks.slice(index + 1, end),
  };
}

/**
 * Find chunks containing a search term
 */
export function searchChunks(
  chunks: TextChunk[],
  term: string,
  options: { caseSensitive?: boolean; wholeWord?: boolean } = {}
): Array<{ chunk: TextChunk; index: number; matches: number }> {
  const results: Array<{ chunk: TextChunk; index: number; matches: number }> = [];

  let pattern = options.caseSensitive ? term : term.toLowerCase();
  if (options.wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }
  const regex = new RegExp(pattern, options.caseSensitive ? 'g' : 'gi');

  for (let i = 0; i < chunks.length; i++) {
    const content = options.caseSensitive ? chunks[i].content : chunks[i].content.toLowerCase();
    const matches = content.match(regex);
    if (matches) {
      results.push({ chunk: chunks[i], index: i, matches: matches.length });
    }
  }

  return results;
}

/**
 * Group chunks by chapter
 */
export function groupByChapter(
  chunks: TextChunk[]
): Map<number | undefined, TextChunk[]> {
  const groups = new Map<number | undefined, TextChunk[]>();

  for (const chunk of chunks) {
    const key = chunk.chapterNumber;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(chunk);
  }

  return groups;
}

/**
 * Get statistics about chunk distribution
 */
export function getChunkStats(chunks: TextChunk[]): {
  byType: Record<string, number>;
  byPosition: Record<string, number>;
  dialogueChunks: number;
  uniqueSpeakers: string[];
  averageTokensPerChapter: number;
} {
  const byType: Record<string, number> = {};
  const byPosition: Record<string, number> = {};
  let dialogueChunks = 0;
  const allSpeakers = new Set<string>();

  for (const chunk of chunks) {
    byType[chunk.chunkType] = (byType[chunk.chunkType] || 0) + 1;
    byPosition[chunk.structuralPosition] = (byPosition[chunk.structuralPosition] || 0) + 1;

    if (chunk.containsDialogue) dialogueChunks++;
    for (const speaker of chunk.dialogueSpeakers) {
      allSpeakers.add(speaker);
    }
  }

  const chapters = groupByChapter(chunks);
  const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
  const averageTokensPerChapter = chapters.size > 0
    ? Math.round(totalTokens / chapters.size)
    : totalTokens;

  return {
    byType,
    byPosition,
    dialogueChunks,
    uniqueSpeakers: Array.from(allSpeakers).sort(),
    averageTokensPerChapter,
  };
}
