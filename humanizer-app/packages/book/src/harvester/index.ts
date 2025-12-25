/**
 * Passage Harvester
 *
 * Extracts relevant passages from an archive based on search queries.
 * This is the first step in book building - gathering raw material.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { analyzeSIC } from '@humanizer/core';
import type { ParsedArchive, Conversation, Message } from '@humanizer/archive';
import type { Passage, HarvestOptions } from '../types/index.js';

/**
 * Harvest passages from an archive
 */
export async function harvestPassages(
  archivePath: string,
  options: HarvestOptions
): Promise<Passage[]> {
  const {
    queries,
    minWords = 20,
    maxWords = 500,
    userOnly = true,
    minSIC,
    dateRange,
    limit = 500,
  } = options;

  // Load archive
  const fullPath = join(archivePath, 'archive.json');
  if (!existsSync(fullPath)) {
    throw new Error(`Archive not found: ${fullPath}`);
  }

  const archive: ParsedArchive = JSON.parse(readFileSync(fullPath, 'utf-8'));
  const passages: Passage[] = [];
  let passageId = 0;

  // Search through all conversations
  for (const conv of archive.conversations) {
    for (const msg of conv.messages) {
      // Filter by author
      if (userOnly && msg.author.role !== 'user') continue;

      // Filter by date
      if (dateRange) {
        const msgDate = new Date(msg.timestamp);
        if (dateRange.start && msgDate < dateRange.start) continue;
        if (dateRange.end && msgDate > dateRange.end) continue;
      }

      // Check if message matches any query
      const contentLower = msg.content.toLowerCase();
      const matchedQueries = queries.filter(q =>
        contentLower.includes(q.toLowerCase())
      );

      if (matchedQueries.length === 0) continue;

      // Extract passages from the message
      const msgPassages = extractPassages(msg.content, matchedQueries, {
        minWords,
        maxWords,
      });

      for (const extracted of msgPassages) {
        const passage: Passage = {
          id: `p-${++passageId}`,
          text: extracted.text,
          sourceConversation: {
            id: conv.id,
            title: conv.title || 'Untitled',
          },
          sourceMessage: {
            id: msg.id,
            timestamp: new Date(msg.timestamp),
            author: msg.author.role,
          },
          offset: extracted.offset,
          wordCount: extracted.text.split(/\s+/).length,
          relevance: matchedQueries.length / queries.length,
        };

        // Analyze SIC
        const sicResult = analyzeSIC(passage.text, { includeEvidence: false });
        passage.sic = sicResult;

        // Filter by SIC if specified
        if (minSIC && sicResult.score < minSIC) continue;

        passages.push(passage);

        if (passages.length >= limit) break;
      }

      if (passages.length >= limit) break;
    }

    if (passages.length >= limit) break;
  }

  // Sort by relevance and SIC
  passages.sort((a, b) => {
    const relevanceScore = (b.relevance || 0) - (a.relevance || 0);
    if (relevanceScore !== 0) return relevanceScore;
    return (b.sic?.score || 0) - (a.sic?.score || 0);
  });

  return passages;
}

interface ExtractedPassage {
  text: string;
  offset: number;
}

/**
 * Extract coherent passages from a message, centered on query matches
 */
function extractPassages(
  content: string,
  queries: string[],
  options: { minWords: number; maxWords: number }
): ExtractedPassage[] {
  const { minWords, maxWords } = options;
  const passages: ExtractedPassage[] = [];
  const usedRanges: Array<[number, number]> = [];

  // Split into sentences
  const sentences = splitIntoSentences(content);

  for (const query of queries) {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();

    let searchStart = 0;
    while (true) {
      const matchIdx = contentLower.indexOf(queryLower, searchStart);
      if (matchIdx === -1) break;
      searchStart = matchIdx + query.length;

      // Check if this range is already covered
      if (usedRanges.some(([start, end]) => matchIdx >= start && matchIdx < end)) {
        continue;
      }

      // Find the sentence containing this match
      let sentenceStart = 0;
      let sentenceEnd = content.length;
      let matchSentenceIdx = -1;

      for (let i = 0; i < sentences.length; i++) {
        const sent = sentences[i];
        const idx = content.indexOf(sent.text, sentenceStart);
        if (idx !== -1 && idx <= matchIdx && idx + sent.text.length > matchIdx) {
          matchSentenceIdx = i;
          break;
        }
        sentenceStart = idx + sent.text.length;
      }

      if (matchSentenceIdx === -1) continue;

      // Expand to include context (neighboring sentences)
      let startSentence = matchSentenceIdx;
      let endSentence = matchSentenceIdx;
      let wordCount = sentences[matchSentenceIdx].wordCount;

      // Expand backwards
      while (startSentence > 0 && wordCount < maxWords) {
        startSentence--;
        wordCount += sentences[startSentence].wordCount;
      }

      // Expand forwards
      while (endSentence < sentences.length - 1 && wordCount < maxWords) {
        endSentence++;
        wordCount += sentences[endSentence].wordCount;
      }

      // Trim if too long
      while (wordCount > maxWords && endSentence > matchSentenceIdx) {
        wordCount -= sentences[endSentence].wordCount;
        endSentence--;
      }
      while (wordCount > maxWords && startSentence < matchSentenceIdx) {
        wordCount -= sentences[startSentence].wordCount;
        startSentence++;
      }

      // Skip if too short
      if (wordCount < minWords) continue;

      // Build passage text
      const passageText = sentences
        .slice(startSentence, endSentence + 1)
        .map(s => s.text)
        .join(' ')
        .trim();

      // Find offset in original content
      const offset = content.indexOf(sentences[startSentence].text);

      // Mark this range as used
      const endOffset = offset + passageText.length;
      usedRanges.push([offset, endOffset]);

      passages.push({
        text: passageText,
        offset,
      });
    }
  }

  return passages;
}

interface SentenceInfo {
  text: string;
  wordCount: number;
}

function splitIntoSentences(text: string): SentenceInfo[] {
  // Simple sentence splitting
  const parts = text.split(/(?<=[.!?])\s+/);

  return parts
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .map(part => ({
      text: part,
      wordCount: part.split(/\s+/).length,
    }));
}

/**
 * Get statistics about harvested passages
 */
export function getHarvestStats(passages: Passage[]): HarvestStats {
  if (passages.length === 0) {
    return {
      count: 0,
      totalWords: 0,
      averageWords: 0,
      averageSIC: 0,
      dateRange: undefined,
      byConversation: new Map(),
    };
  }

  const totalWords = passages.reduce((sum, p) => sum + p.wordCount, 0);
  const totalSIC = passages.reduce((sum, p) => sum + (p.sic?.score || 0), 0);

  const dates = passages
    .map(p => p.sourceMessage.timestamp)
    .sort((a, b) => a.getTime() - b.getTime());

  const byConversation = new Map<string, number>();
  for (const p of passages) {
    const title = p.sourceConversation.title;
    byConversation.set(title, (byConversation.get(title) || 0) + 1);
  }

  return {
    count: passages.length,
    totalWords,
    averageWords: totalWords / passages.length,
    averageSIC: totalSIC / passages.length,
    dateRange: {
      earliest: dates[0],
      latest: dates[dates.length - 1],
    },
    byConversation,
  };
}

export interface HarvestStats {
  count: number;
  totalWords: number;
  averageWords: number;
  averageSIC: number;
  dateRange?: {
    earliest: Date;
    latest: Date;
  };
  byConversation: Map<string, number>;
}
