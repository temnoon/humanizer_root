/**
 * LinkedIn Adapter
 *
 * Parses LinkedIn data exports (Settings > Get a copy of your data).
 *
 * Export structure (all CSV files):
 * - Connections.csv - Connections list
 * - Messages.csv - Inbox messages
 * - Invitations.csv - Connection requests
 * - Profile.csv - Profile information
 * - Skills.csv - Skills list
 * - Positions.csv - Work history
 * - Education.csv - Education history
 * - Endorsement_Received_Info.csv - Endorsements received
 * - Recommendations_Received.csv - Recommendations received
 * - Shares.csv - Posts/shares
 * - Comments.csv - Comments on posts
 * - Reactions.csv - Reactions to posts
 *
 * Output content types:
 * - linkedin-post
 * - linkedin-comment
 * - linkedin-message
 * - linkedin-connection
 * - linkedin-reaction
 */

import { join } from 'path';
import { BaseAdapter } from '../base-adapter.js';
import type {
  AdapterSource,
  DetectionResult,
  ValidationResult,
  ParseOptions,
  ImportedNode,
  SourceMetadata,
  MediaReference,
  ContentLink,
} from '../types.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES FOR LINKEDIN EXPORT FORMAT
// ═══════════════════════════════════════════════════════════════════

interface LinkedInMessage {
  'CONVERSATION ID': string;
  'CONVERSATION TITLE': string;
  FROM: string;
  'SENDER PROFILE URL': string;
  TO: string;
  DATE: string;
  SUBJECT: string;
  CONTENT: string;
  FOLDER: string;
}

interface LinkedInConnection {
  'First Name': string;
  'Last Name': string;
  'Email Address': string;
  Company: string;
  Position: string;
  'Connected On': string;
}

interface LinkedInShare {
  Date: string;
  'Share Link': string;
  'Share Commentary': string;
  'Media Link'?: string;
}

interface LinkedInComment {
  Date: string;
  Link: string;
  Message: string;
}

interface LinkedInReaction {
  Date: string;
  Link: string;
  Type: string;
}

interface LinkedInProfile {
  'First Name': string;
  'Last Name': string;
  'Maiden Name'?: string;
  Address?: string;
  'Birth Date'?: string;
  Headline?: string;
  Summary?: string;
  Industry?: string;
  'Zip Code'?: string;
  'Geo Location'?: string;
  'Twitter Handles'?: string;
  Websites?: string;
  'Instant Messengers'?: string;
}

// ═══════════════════════════════════════════════════════════════════
// LINKEDIN ADAPTER
// ═══════════════════════════════════════════════════════════════════

export class LinkedInAdapter extends BaseAdapter {
  readonly id = 'linkedin';
  readonly name = 'LinkedIn';
  readonly description = 'Import LinkedIn data exports';
  readonly version = '1.0.0';
  readonly contentTypes = [
    'linkedin-post',
    'linkedin-comment',
    'linkedin-message',
    'linkedin-connection',
    'linkedin-reaction',
  ];
  readonly supportedExtensions = ['.zip', '.csv'];

  // ─────────────────────────────────────────────────────────────────
  // DETECTION
  // ─────────────────────────────────────────────────────────────────

  async detect(source: AdapterSource): Promise<DetectionResult> {
    try {
      const path = source.path;

      // Check for LinkedIn-specific CSV files
      const connectionsCsv = join(path, 'Connections.csv');
      const messagesCsv = join(path, 'Messages.csv');
      const profileCsv = join(path, 'Profile.csv');
      const sharesCsv = join(path, 'Shares.csv');

      const hasConnections = await this.fileExists(connectionsCsv);
      const hasMessages = await this.fileExists(messagesCsv);
      const hasProfile = await this.fileExists(profileCsv);
      const hasShares = await this.fileExists(sharesCsv);

      const matchCount = [hasConnections, hasMessages, hasProfile, hasShares].filter(Boolean).length;

      if (matchCount >= 2) {
        return {
          canHandle: true,
          confidence: 0.9,
          format: 'linkedin-export',
          reason: `Found ${matchCount} LinkedIn export files`,
        };
      }

      // Check for specific LinkedIn file patterns
      if (hasConnections) {
        // Verify it's LinkedIn by checking header
        const content = await this.readFile(connectionsCsv);
        if (content.includes('First Name') && content.includes('Connected On')) {
          return {
            canHandle: true,
            confidence: 0.85,
            format: 'linkedin-export',
            reason: 'Found LinkedIn Connections.csv',
          };
        }
      }

      if (hasMessages) {
        const content = await this.readFile(messagesCsv);
        if (content.includes('CONVERSATION ID') && content.includes('SENDER PROFILE URL')) {
          return {
            canHandle: true,
            confidence: 0.85,
            format: 'linkedin-export',
            reason: 'Found LinkedIn Messages.csv',
          };
        }
      }

      return {
        canHandle: false,
        confidence: 0,
        reason: 'No LinkedIn export structure detected',
      };
    } catch (error) {
      return {
        canHandle: false,
        confidence: 0,
        reason: `Detection error: ${error}`,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────────────

  async validate(source: AdapterSource): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    const detection = await this.detect(source);
    if (!detection.canHandle) {
      errors.push({
        code: 'INVALID_FORMAT',
        message: 'Not a valid LinkedIn export',
        details: { reason: detection.reason },
      });
      return { valid: false, errors, warnings };
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // SOURCE METADATA
  // ─────────────────────────────────────────────────────────────────

  async getSourceMetadata(source: AdapterSource): Promise<SourceMetadata> {
    const detection = await this.detect(source);

    let estimatedCount = 0;
    let earliestDate: Date | undefined;
    let latestDate: Date | undefined;
    const contentTypes = new Set<string>();
    let accountInfo: SourceMetadata['account'] = undefined;

    // Get profile info
    const profileCsv = join(source.path, 'Profile.csv');
    if (await this.fileExists(profileCsv)) {
      try {
        const content = await this.readFile(profileCsv);
        const profiles = this.parseCsv<LinkedInProfile>(content);
        if (profiles.length > 0) {
          const profile = profiles[0];
          accountInfo = {
            name: `${profile['First Name']} ${profile['Last Name']}`.trim(),
          };
        }
      } catch (error) {
        console.debug('[LinkedInAdapter] Failed to parse profile:', error);
      }
    }

    // Count connections
    const connectionsCsv = join(source.path, 'Connections.csv');
    if (await this.fileExists(connectionsCsv)) {
      try {
        const content = await this.readFile(connectionsCsv);
        const connections = this.parseCsv<LinkedInConnection>(content);
        estimatedCount += connections.length;
        if (connections.length > 0) contentTypes.add('linkedin-connection');
      } catch (error) {
        console.debug('[LinkedInAdapter] Failed to parse connections:', error);
      }
    }

    // Count messages
    const messagesCsv = join(source.path, 'Messages.csv');
    if (await this.fileExists(messagesCsv)) {
      try {
        const content = await this.readFile(messagesCsv);
        const messages = this.parseCsv<LinkedInMessage>(content);
        estimatedCount += messages.length;
        if (messages.length > 0) contentTypes.add('linkedin-message');
      } catch (error) {
        console.debug('[LinkedInAdapter] Failed to parse messages:', error);
      }
    }

    // Count shares/posts
    const sharesCsv = join(source.path, 'Shares.csv');
    if (await this.fileExists(sharesCsv)) {
      try {
        const content = await this.readFile(sharesCsv);
        const shares = this.parseCsv<LinkedInShare>(content);
        estimatedCount += shares.length;
        if (shares.length > 0) contentTypes.add('linkedin-post');
      } catch (error) {
        console.debug('[LinkedInAdapter] Failed to parse shares:', error);
      }
    }

    return {
      format: detection.format || 'linkedin-export',
      formatVersion: '1.0',
      estimatedCount,
      dateRange: {
        earliest: earliestDate,
        latest: latestDate,
      },
      contentTypes: Array.from(contentTypes),
      account: accountInfo,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PARSING
  // ─────────────────────────────────────────────────────────────────

  protected async *parseSource(
    source: AdapterSource,
    options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    // Parse messages
    yield* this.parseMessages(source, options);

    // Parse shares/posts
    yield* this.parseShares(source, options);

    // Parse comments
    yield* this.parseComments(source, options);

    // Parse reactions
    yield* this.parseReactions(source, options);

    // Parse connections
    yield* this.parseConnections(source, options);
  }

  private async *parseMessages(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const messagesCsv = join(source.path, 'Messages.csv');
    if (!(await this.fileExists(messagesCsv))) return;

    try {
      const content = await this.readFile(messagesCsv);
      const messages = this.parseCsv<LinkedInMessage>(content);

      // Group by conversation
      const convMap = new Map<string, LinkedInMessage[]>();
      for (const msg of messages) {
        const convId = msg['CONVERSATION ID'];
        if (!convMap.has(convId)) {
          convMap.set(convId, []);
        }
        convMap.get(convId)!.push(msg);
      }

      // Process each conversation
      for (const [convId, msgs] of convMap) {
        let position = 0;
        for (const msg of msgs) {
          const node = this.messageToNode(msg, position);
          if (node) {
            yield node;
            position++;
          }
        }
      }
    } catch (error) {
      this.log('warn', 'Failed to parse Messages.csv', error);
    }
  }

  private async *parseShares(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const sharesCsv = join(source.path, 'Shares.csv');
    if (!(await this.fileExists(sharesCsv))) return;

    try {
      const content = await this.readFile(sharesCsv);
      const shares = this.parseCsv<LinkedInShare>(content);

      for (let i = 0; i < shares.length; i++) {
        const share = shares[i];
        const node = this.shareToNode(share, i);
        if (node) yield node;
      }
    } catch (error) {
      this.log('warn', 'Failed to parse Shares.csv', error);
    }
  }

  private async *parseComments(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const commentsCsv = join(source.path, 'Comments.csv');
    if (!(await this.fileExists(commentsCsv))) return;

    try {
      const content = await this.readFile(commentsCsv);
      const comments = this.parseCsv<LinkedInComment>(content);

      for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        const node = this.commentToNode(comment, i);
        if (node) yield node;
      }
    } catch (error) {
      this.log('warn', 'Failed to parse Comments.csv', error);
    }
  }

  private async *parseReactions(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const reactionsCsv = join(source.path, 'Reactions.csv');
    if (!(await this.fileExists(reactionsCsv))) return;

    try {
      const content = await this.readFile(reactionsCsv);
      const reactions = this.parseCsv<LinkedInReaction>(content);

      for (let i = 0; i < reactions.length; i++) {
        const reaction = reactions[i];
        const node = this.reactionToNode(reaction, i);
        if (node) yield node;
      }
    } catch (error) {
      this.log('warn', 'Failed to parse Reactions.csv', error);
    }
  }

  private async *parseConnections(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const connectionsCsv = join(source.path, 'Connections.csv');
    if (!(await this.fileExists(connectionsCsv))) return;

    try {
      const content = await this.readFile(connectionsCsv);
      const connections = this.parseCsv<LinkedInConnection>(content);

      for (let i = 0; i < connections.length; i++) {
        const conn = connections[i];
        const node = this.connectionToNode(conn, i);
        if (node) yield node;
      }
    } catch (error) {
      this.log('warn', 'Failed to parse Connections.csv', error);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // CONVERTERS
  // ─────────────────────────────────────────────────────────────────

  private messageToNode(msg: LinkedInMessage, position: number): ImportedNode | null {
    const content = msg.CONTENT || '';
    if (!content) return null;

    const convId = msg['CONVERSATION ID'];
    const id = `message-${convId}-${position}`;
    const date = this.parseLinkedInDate(msg.DATE);

    return {
      id,
      uri: this.generateUri('message', id),
      contentHash: this.hashContent(content),
      content,
      format: 'text',
      sourceType: 'linkedin-message',
      sourceCreatedAt: date,
      author: {
        name: msg.FROM,
      },
      parentUri: this.generateUri('conversation', convId),
      threadRootUri: this.generateUri('conversation', convId),
      position,
      links: [
        {
          type: 'parent',
          targetUri: this.generateUri('conversation', convId),
        },
      ],
      metadata: {
        conversationId: convId,
        conversationTitle: msg['CONVERSATION TITLE'],
        from: msg.FROM,
        senderProfileUrl: msg['SENDER PROFILE URL'],
        to: msg.TO,
        subject: msg.SUBJECT,
        folder: msg.FOLDER,
      },
    };
  }

  private shareToNode(share: LinkedInShare, index: number): ImportedNode | null {
    const content = share['Share Commentary'] || '';
    const id = `post-${index}`;
    const date = this.parseLinkedInDate(share.Date);

    // Extract media
    const media: MediaReference[] = [];
    if (share['Media Link']) {
      media.push({
        id: `media-${id}`,
        type: 'other',
        url: share['Media Link'],
      });
    }

    return {
      id,
      uri: this.generateUri('post', id),
      contentHash: this.hashContent(content || share['Share Link'] || `post-${index}`),
      content: content || 'Shared post',
      format: 'text',
      sourceType: 'linkedin-post',
      sourceCreatedAt: date,
      media: media.length > 0 ? media : undefined,
      links: share['Share Link'] ? [
        {
          type: 'references',
          targetUri: share['Share Link'],
        },
      ] : undefined,
      metadata: {
        shareLink: share['Share Link'],
        mediaLink: share['Media Link'],
      },
    };
  }

  private commentToNode(comment: LinkedInComment, index: number): ImportedNode | null {
    const content = comment.Message || '';
    if (!content) return null;

    const id = `comment-${index}`;
    const date = this.parseLinkedInDate(comment.Date);

    return {
      id,
      uri: this.generateUri('comment', id),
      contentHash: this.hashContent(content),
      content,
      format: 'text',
      sourceType: 'linkedin-comment',
      sourceCreatedAt: date,
      links: comment.Link ? [
        {
          type: 'references',
          targetUri: comment.Link,
        },
      ] : undefined,
      metadata: {
        postLink: comment.Link,
      },
    };
  }

  private reactionToNode(reaction: LinkedInReaction, index: number): ImportedNode | null {
    const id = `reaction-${index}`;
    const date = this.parseLinkedInDate(reaction.Date);

    return {
      id,
      uri: this.generateUri('reaction', id),
      contentHash: this.hashContent(`reaction:${reaction.Link}:${reaction.Type}`),
      content: reaction.Type || 'LIKE',
      format: 'text',
      sourceType: 'linkedin-reaction',
      sourceCreatedAt: date,
      links: reaction.Link ? [
        {
          type: 'references',
          targetUri: reaction.Link,
        },
      ] : undefined,
      metadata: {
        reactionType: reaction.Type,
        postLink: reaction.Link,
      },
    };
  }

  private connectionToNode(conn: LinkedInConnection, index: number): ImportedNode | null {
    const name = `${conn['First Name']} ${conn['Last Name']}`.trim();
    if (!name) return null;

    const id = `connection-${index}`;
    const date = this.parseLinkedInDate(conn['Connected On']);

    return {
      id,
      uri: this.generateUri('connection', id),
      contentHash: this.hashContent(`connection:${name}:${conn['Email Address'] || ''}`),
      content: name,
      format: 'text',
      sourceType: 'linkedin-connection',
      sourceCreatedAt: date,
      metadata: {
        firstName: conn['First Name'],
        lastName: conn['Last Name'],
        email: conn['Email Address'],
        company: conn.Company,
        position: conn.Position,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Parse CSV content into array of objects
   */
  private parseCsv<T>(content: string): T[] {
    const lines = content.split('\n');
    if (lines.length < 2) return [];

    // Parse header
    const headerLine = lines[0];
    const headers = this.parseCsvLine(headerLine);

    // Parse data rows
    const results: T[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCsvLine(line);
      const obj: Record<string, string> = {};

      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = values[j] || '';
      }

      results.push(obj as T);
    }

    return results;
  }

  /**
   * Parse a single CSV line, handling quoted fields
   */
  private parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    fields.push(current.trim());
    return fields;
  }

  /**
   * Parse LinkedIn date formats
   * Common formats: "Jan 1, 2023", "2023-01-01", "01 Jan 2023"
   */
  private parseLinkedInDate(dateStr: string): Date | undefined {
    if (!dateStr) return undefined;

    // Try direct parsing
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;

    // Try "DD Mon YYYY" format
    const match = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
    if (match) {
      date = new Date(`${match[2]} ${match[1]}, ${match[3]}`);
      if (!isNaN(date.getTime())) return date;
    }

    return undefined;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════

export const linkedinAdapter = new LinkedInAdapter();
