/**
 * ReactionsParser - Parse Facebook reactions (likes, loves, etc.) from export JSON
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { FacebookReaction, Reaction } from './types.js';

export class ReactionsParser {
  /**
   * Parse Facebook reactions from a single JSON file
   */
  async parse(filePath: string): Promise<Reaction[]> {
    console.log(`❤️  Parsing reactions from: ${path.basename(filePath)}`);

    const rawData = await fs.readFile(filePath, 'utf-8');
    const reactions: FacebookReaction[] = JSON.parse(rawData);

    const reactionItems: Reaction[] = [];

    for (const reaction of reactions) {
      const item = this.convertReactionToReaction(reaction);
      if (item) {
        reactionItems.push(item);
      }
    }

    return reactionItems;
  }

  /**
   * Parse all reaction files in a directory
   * Facebook often splits reactions into multiple files (likes_and_reactions_1.json, _2.json, etc.)
   */
  async parseAll(reactionsDir: string): Promise<Reaction[]> {
    console.log(`❤️  Parsing all reaction files from: ${reactionsDir}`);

    const allReactions: Reaction[] = [];

    // Find all reaction JSON files
    const files = await fs.readdir(reactionsDir);
    const jsonFiles = files.filter(f => f.startsWith('likes_and_reactions') && f.endsWith('.json'));

    console.log(`   Found ${jsonFiles.length} reaction files`);

    for (const file of jsonFiles) {
      const filePath = path.join(reactionsDir, file);
      const reactions = await this.parse(filePath);
      allReactions.push(...reactions);
    }

    console.log(`   Total reactions parsed: ${allReactions.length}`);
    return allReactions;
  }

  /**
   * Convert a Facebook reaction to a Reaction object
   */
  private convertReactionToReaction(reaction: FacebookReaction): Reaction | null {
    if (!reaction.data || reaction.data.length === 0) {
      return null;
    }

    const reactionData = reaction.data[0]?.reaction;
    if (!reactionData) {
      return null;
    }

    // Get reaction type (LIKE, LOVE, HAHA, WOW, SAD, ANGRY)
    const reactionType = this.normalizeReactionType(reactionData.reaction);
    if (!reactionType) {
      return null;
    }

    // Get actor
    const actor = reactionData.actor ? this.decodeFacebookUnicode(reactionData.actor) : 'Tem Noon';

    // Parse context from title to try to identify what was reacted to
    const context = this.parseReactionContext(reaction.title);

    // Note: We don't have content_item_id yet - that will be linked later
    // when we correlate reactions with posts/comments
    const item: Reaction = {
      id: `fb_reaction_${reaction.timestamp}_${uuidv4().substring(0, 8)}`,
      content_item_id: '', // Will be set during linking phase
      reaction_type: reactionType,
      reactor_name: actor,
      created_at: reaction.timestamp,
    };

    // Store context in a way we can use for linking later
    (item as any).context = context;
    (item as any).title = reaction.title;

    return item;
  }

  /**
   * Normalize reaction type to our standard set
   */
  private normalizeReactionType(type?: string): 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry' | null {
    if (!type) return null;

    const normalized = type.toLowerCase();
    switch (normalized) {
      case 'like':
        return 'like';
      case 'love':
        return 'love';
      case 'haha':
        return 'haha';
      case 'wow':
        return 'wow';
      case 'sad':
        return 'sad';
      case 'angry':
        return 'angry';
      default:
        // Default to 'like' for unknown types
        return 'like';
    }
  }

  /**
   * Parse context from reaction title
   * Examples:
   * - "Tem Noon liked a link."
   * - "Tem Noon reacted to a post."
   * - "Tem Noon loved Suzy Life's post."
   */
  private parseReactionContext(title?: string): {
    targetType: 'link' | 'post' | 'photo' | 'video' | 'comment' | 'unknown';
    targetAuthor?: string;
  } {
    if (!title) {
      return { targetType: 'unknown' };
    }

    const decodedTitle = this.decodeFacebookUnicode(title);

    // Detect target type
    let targetType: 'link' | 'post' | 'photo' | 'video' | 'comment' | 'unknown' = 'unknown';
    if (decodedTitle.includes('link')) targetType = 'link';
    else if (decodedTitle.includes('photo')) targetType = 'photo';
    else if (decodedTitle.includes('video')) targetType = 'video';
    else if (decodedTitle.includes('comment')) targetType = 'comment';
    else if (decodedTitle.includes('post')) targetType = 'post';

    // Try to extract target author
    const match = decodedTitle.match(/(?:liked|loved|reacted to) (.+?)(?:'s|'s) (post|photo|video|comment)/i);
    let targetAuthor: string | undefined;
    if (match) {
      targetAuthor = match[1];
    }

    return { targetType, targetAuthor };
  }

  /**
   * Decode Facebook's non-standard Unicode encoding
   */
  private decodeFacebookUnicode(text: string): string {
    return text.replace(/\\u00([0-9a-f]{2})/gi, (match, hex) => {
      const code = parseInt(hex, 16);
      if (code >= 128) {
        return String.fromCharCode(code);
      }
      return match;
    });
  }

  /**
   * Get statistics about reactions
   */
  async getAllStats(reactionsDir: string): Promise<{
    totalReactions: number;
    byType: Record<string, number>;
    byTargetType: Record<string, number>;
    dateRange: { earliest: number; latest: number };
    hasValidTimestamps: boolean;
  }> {
    const reactions = await this.parseAll(reactionsDir);

    const byType: Record<string, number> = {};
    const byTargetType: Record<string, number> = {};
    let earliest = Infinity;
    let latest = -Infinity;
    let validTimestamps = 0;

    for (const reaction of reactions) {
      // Count by reaction type
      byType[reaction.reaction_type] = (byType[reaction.reaction_type] || 0) + 1;

      // Count by target type
      const context = (reaction as any).context;
      if (context?.targetType) {
        byTargetType[context.targetType] = (byTargetType[context.targetType] || 0) + 1;
      }

      // Track date range (but watch out for invalid timestamps like 1)
      if (reaction.created_at > 1000) {  // Skip obviously invalid timestamps
        validTimestamps++;
        if (reaction.created_at < earliest) earliest = reaction.created_at;
        if (reaction.created_at > latest) latest = reaction.created_at;
      }
    }

    return {
      totalReactions: reactions.length,
      byType,
      byTargetType,
      dateRange: { earliest, latest },
      hasValidTimestamps: validTimestamps > reactions.length * 0.5,  // At least 50% have valid timestamps
    };
  }
}
