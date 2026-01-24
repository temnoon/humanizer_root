/**
 * Facebook Relationship Parser
 *
 * Parses relationship metadata from Facebook GDPR exports:
 * - Friends (with friendship dates, removed, requests)
 * - Advertisers (tracking you, data brokers)
 * - Pages (liked, followed, unfollowed)
 * - Reactions (likes, loves on others' content)
 * - Groups (memberships, posts, comments)
 *
 * This data enables building a social graph and understanding
 * advertising/tracking relationships.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import type {
  RelationshipData,
  ParsedFriend,
  ParsedAdvertiser,
  ParsedPage,
  ParsedReaction,
  ParsedGroup,
  ParsedGroupPost,
  ParsedGroupComment,
} from './types.js';

// Known data brokers (companies that aggregate and sell personal data)
const DATA_BROKERS = new Set([
  'LiveRamp',
  'Oracle Data Cloud',
  'Experian Marketing Services',
  'Experian Marketing Services - Audiences',
  'Nielsen Marketing Cloud',
  'Acxiom',
  'Epsilon',
  'TransUnion',
  'Equifax',
  'Neustar',
  'Foursquare',
  'Foursquare City Guide',
  'Samba TV',
  'Cross Screen Media',
  'Lotame',
  'Eyeota',
  'ShareThis',
  'Tapad',
  'Drawbridge',
]);

export class FacebookRelationshipParser {
  private exportPath: string = '';

  /**
   * Parse all relationship data from a Facebook export
   */
  async parseAll(exportPath: string): Promise<RelationshipData> {
    this.exportPath = exportPath;

    console.log(`\n=== Parsing Facebook Relationship Data ===`);

    const friends = await this.parseFriends();
    const advertisers = await this.parseAdvertisers();
    const pages = await this.parsePages();
    const reactions = await this.parseReactions();
    const groups = await this.parseGroups();

    console.log(`\n=== Relationship Parsing Complete ===`);
    console.log(`  Friends: ${friends.stats.totalFriends}`);
    console.log(`  Advertisers: ${advertisers.stats.total} (${advertisers.stats.dataBrokers} data brokers)`);
    console.log(`  Pages: ${pages.stats.totalLiked} liked, ${pages.stats.totalFollowed} followed`);
    console.log(`  Reactions: ${reactions.stats.total}`);
    console.log(`  Groups: ${groups.stats.totalGroups} (${groups.stats.totalPosts} posts, ${groups.stats.totalComments} comments)`);

    return { friends, advertisers, pages, reactions, groups };
  }

  // ═══════════════════════════════════════════════════════════════════
  // FRIENDS PARSING
  // ═══════════════════════════════════════════════════════════════════

  private async parseFriends(): Promise<RelationshipData['friends']> {
    const friendsDir = path.join(this.exportPath, 'connections', 'friends');

    const friends: ParsedFriend[] = [];
    const removed: ParsedFriend[] = [];
    const sentRequests: ParsedFriend[] = [];
    const rejectedRequests: ParsedFriend[] = [];

    // Parse current friends
    const friendsFile = path.join(friendsDir, 'your_friends.json');
    if (fs.existsSync(friendsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(friendsFile, 'utf-8'));
        const rawFriends = data.friends_v2 || [];
        for (const friend of rawFriends) {
          friends.push({
            id: this.generateFriendId(friend.name),
            name: this.decodeFacebookUnicode(friend.name),
            friendshipDate: friend.timestamp,
            status: 'friend',
          });
        }
        console.log(`  Friends: ${friends.length}`);
      } catch (err) {
        console.log(`  Could not parse your_friends.json`);
      }
    }

    // Parse removed friends
    const removedFile = path.join(friendsDir, 'removed_friends.json');
    if (fs.existsSync(removedFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(removedFile, 'utf-8'));
        const rawFriends = data.deleted_friends_v2 || [];
        for (const friend of rawFriends) {
          removed.push({
            id: this.generateFriendId(friend.name),
            name: this.decodeFacebookUnicode(friend.name),
            friendshipDate: 0,
            status: 'removed',
            removedDate: friend.timestamp,
          });
        }
        console.log(`  Removed friends: ${removed.length}`);
      } catch {
        // ignore
      }
    }

    // Parse sent friend requests
    const sentFile = path.join(friendsDir, 'sent_friend_requests.json');
    if (fs.existsSync(sentFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(sentFile, 'utf-8'));
        const rawFriends = data.sent_requests_v2 || [];
        for (const friend of rawFriends) {
          sentRequests.push({
            id: this.generateFriendId(friend.name),
            name: this.decodeFacebookUnicode(friend.name),
            friendshipDate: friend.timestamp,
            status: 'sent_request',
          });
        }
        console.log(`  Sent requests: ${sentRequests.length}`);
      } catch {
        // ignore
      }
    }

    // Parse rejected friend requests
    const rejectedFile = path.join(friendsDir, 'rejected_friend_requests.json');
    if (fs.existsSync(rejectedFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(rejectedFile, 'utf-8'));
        const rawFriends = data.rejected_requests_v2 || [];
        for (const friend of rawFriends) {
          rejectedRequests.push({
            id: this.generateFriendId(friend.name),
            name: this.decodeFacebookUnicode(friend.name),
            friendshipDate: friend.timestamp,
            status: 'rejected_request',
          });
        }
        console.log(`  Rejected requests: ${rejectedRequests.length}`);
      } catch {
        // ignore
      }
    }

    const allTimestamps = [
      ...friends.map(f => f.friendshipDate),
      ...removed.map(f => f.friendshipDate),
    ].filter(t => t > 1000);

    return {
      friends,
      removed,
      sentRequests,
      rejectedRequests,
      stats: {
        totalFriends: friends.length,
        totalRemoved: removed.length,
        totalSentRequests: sentRequests.length,
        totalRejectedRequests: rejectedRequests.length,
        earliestFriendship: allTimestamps.length > 0 ? Math.min(...allTimestamps) : 0,
        latestFriendship: allTimestamps.length > 0 ? Math.max(...allTimestamps) : 0,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // ADVERTISERS PARSING
  // ═══════════════════════════════════════════════════════════════════

  private async parseAdvertisers(): Promise<RelationshipData['advertisers']> {
    const advertisers = new Map<string, ParsedAdvertiser>();
    const byTargetingType: Record<string, number> = {};

    // Parse advertisers using your activity
    const adsPath = path.join(this.exportPath, 'ads_information/advertisers_using_your_activity_or_information.json');
    if (fs.existsSync(adsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(adsPath, 'utf-8'));
        const labelValues = data.label_values || [];

        for (const category of labelValues) {
          const targetingType = this.categorizeTargetingType(category.label);
          const names = category.vec || [];

          for (const item of names) {
            const name = item.value;
            if (!name) continue;

            const id = this.generateId('advertiser', name);
            const existing = advertisers.get(id);

            if (existing) {
              existing.interactionCount++;
            } else {
              advertisers.set(id, {
                id,
                name: this.decodeFacebookUnicode(name),
                targetingType,
                interactionCount: 1,
                isDataBroker: DATA_BROKERS.has(name),
              });
            }

            byTargetingType[targetingType] = (byTargetingType[targetingType] || 0) + 1;
          }
        }
        console.log(`  Advertisers (activity): ${advertisers.size}`);
      } catch {
        // ignore
      }
    }

    // Parse advertisers you've interacted with
    const interactedPath = path.join(this.exportPath, "ads_information/advertisers_you've_interacted_with.json");
    if (fs.existsSync(interactedPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(interactedPath, 'utf-8'));
        const interactions = Array.isArray(data) ? data : (data.history_v2 || []);

        let interactedCount = 0;
        for (const interaction of interactions) {
          let name: string | undefined;
          let timestamp: number | undefined = interaction.timestamp;

          for (const lv of interaction.label_values || []) {
            if (lv.label === 'Title' && lv.value) {
              name = lv.value;
            }
          }

          if (!name) continue;

          const id = this.generateId('advertiser', name);
          const existing = advertisers.get(id);

          if (existing) {
            existing.interactionCount++;
            if (timestamp) {
              if (!existing.firstSeen || timestamp < existing.firstSeen) {
                existing.firstSeen = timestamp;
              }
              if (!existing.lastSeen || timestamp > existing.lastSeen) {
                existing.lastSeen = timestamp;
              }
            }
          } else {
            advertisers.set(id, {
              id,
              name: this.decodeFacebookUnicode(name),
              targetingType: 'interacted',
              interactionCount: 1,
              firstSeen: timestamp,
              lastSeen: timestamp,
              isDataBroker: DATA_BROKERS.has(name),
            });
          }
          interactedCount++;
        }
        console.log(`  Advertisers (interacted): ${interactedCount}`);
      } catch {
        // ignore
      }
    }

    const dataBrokerCount = Array.from(advertisers.values()).filter(a => a.isDataBroker).length;

    return {
      advertisers: Array.from(advertisers.values()),
      stats: {
        total: advertisers.size,
        dataBrokers: dataBrokerCount,
        byTargetingType,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // PAGES PARSING
  // ═══════════════════════════════════════════════════════════════════

  private async parsePages(): Promise<RelationshipData['pages']> {
    const pages = new Map<string, ParsedPage>();
    let totalLiked = 0;
    let totalFollowed = 0;
    let totalUnfollowed = 0;
    let earliestLike: number | undefined;
    let latestLike: number | undefined;

    // Parse pages you've liked
    const likedPath = path.join(this.exportPath, "your_facebook_activity/pages/pages_you've_liked.json");
    if (fs.existsSync(likedPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(likedPath, 'utf-8'));
        const likedPages = data.page_likes_v2 || [];

        for (const page of likedPages) {
          const id = this.generateId('page', page.name);
          let facebookId: string | undefined;
          if (page.url) {
            const match = page.url.match(/facebook\.com\/(\d+)/);
            if (match) facebookId = match[1];
          }

          const existing = pages.get(id);
          if (existing) {
            existing.isLiked = true;
            existing.likedAt = page.timestamp;
            if (!existing.url) existing.url = page.url;
            if (!existing.facebookId) existing.facebookId = facebookId;
          } else {
            pages.set(id, {
              id,
              name: this.decodeFacebookUnicode(page.name),
              facebookId,
              url: page.url,
              isLiked: true,
              likedAt: page.timestamp,
              isFollowing: false,
            });
          }

          if (page.timestamp) {
            if (!earliestLike || page.timestamp < earliestLike) earliestLike = page.timestamp;
            if (!latestLike || page.timestamp > latestLike) latestLike = page.timestamp;
          }
          totalLiked++;
        }
        console.log(`  Pages liked: ${likedPages.length}`);
      } catch {
        // ignore
      }
    }

    // Parse pages and profiles you follow
    const followedPath = path.join(this.exportPath, 'your_facebook_activity/pages/pages_and_profiles_you_follow.json');
    if (fs.existsSync(followedPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(followedPath, 'utf-8'));
        const followedPages = data.pages_followed_v2 || [];

        for (const page of followedPages) {
          const name = page.title || page.data?.[0]?.name;
          if (!name) continue;

          const id = this.generateId('page', name);
          const existing = pages.get(id);

          if (existing) {
            existing.isFollowing = true;
            existing.followedAt = page.timestamp;
          } else {
            pages.set(id, {
              id,
              name: this.decodeFacebookUnicode(name),
              isLiked: false,
              isFollowing: true,
              followedAt: page.timestamp,
            });
          }
          totalFollowed++;
        }
        console.log(`  Pages followed: ${followedPages.length}`);
      } catch {
        // ignore
      }
    }

    // Parse unfollowed pages
    const unfollowedPath = path.join(this.exportPath, "your_facebook_activity/pages/pages_and_profiles_you've_unfollowed.json");
    if (fs.existsSync(unfollowedPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(unfollowedPath, 'utf-8'));
        const unfollowedPages = data.pages_unfollowed_v2 || [];

        for (const page of unfollowedPages) {
          const name = page.title || page.data?.[0]?.name;
          if (!name) continue;

          const id = this.generateId('page', name);
          const existing = pages.get(id);

          if (existing) {
            existing.unfollowedAt = page.timestamp;
          } else {
            pages.set(id, {
              id,
              name: this.decodeFacebookUnicode(name),
              isLiked: false,
              isFollowing: false,
              unfollowedAt: page.timestamp,
            });
          }
          totalUnfollowed++;
        }
        console.log(`  Pages unfollowed: ${unfollowedPages.length}`);
      } catch {
        // ignore
      }
    }

    return {
      pages: Array.from(pages.values()),
      stats: {
        totalLiked,
        totalFollowed,
        totalUnfollowed,
        earliestLike,
        latestLike,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // REACTIONS PARSING
  // ═══════════════════════════════════════════════════════════════════

  private async parseReactions(): Promise<RelationshipData['reactions']> {
    const reactions: ParsedReaction[] = [];

    // Try both possible directory names
    let reactionsDir = path.join(this.exportPath, 'your_facebook_activity/comments_and_reactions');
    if (!fs.existsSync(reactionsDir)) {
      reactionsDir = path.join(this.exportPath, 'your_facebook_activity/likes_and_reactions');
    }

    if (!fs.existsSync(reactionsDir)) {
      return {
        reactions: [],
        stats: {
          total: 0,
          byType: {},
          byTargetType: {},
          dateRange: { earliest: 0, latest: 0 },
        },
      };
    }

    const files = fs.readdirSync(reactionsDir);
    // Match both likes_and_reactions.json and likes_and_reactions_N.json
    const jsonFiles = files.filter(f => /^likes_and_reactions(_\d+)?\.json$/.test(f));

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(reactionsDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        for (const reaction of data) {
          const reactionData = reaction.data?.[0]?.reaction;
          if (!reactionData) continue;

          const reactionType = this.normalizeReactionType(reactionData.reaction);
          if (!reactionType) continue;

          const actor = reactionData.actor ? this.decodeFacebookUnicode(reactionData.actor) : 'self';
          const context = this.parseReactionContext(reaction.title);

          reactions.push({
            id: `fb_reaction_${reaction.timestamp}_${reactions.length}`,
            reactionType,
            reactorName: actor,
            createdAt: reaction.timestamp,
            targetType: context.targetType,
            targetAuthor: context.targetAuthor,
            title: reaction.title,
          });
        }
      } catch {
        // ignore individual file errors
      }
    }

    console.log(`  Reactions: ${reactions.length}`);

    // Calculate stats
    const byType: Record<string, number> = {};
    const byTargetType: Record<string, number> = {};
    let earliest = Infinity;
    let latest = -Infinity;

    for (const reaction of reactions) {
      byType[reaction.reactionType] = (byType[reaction.reactionType] || 0) + 1;
      byTargetType[reaction.targetType] = (byTargetType[reaction.targetType] || 0) + 1;

      if (reaction.createdAt > 1000) {
        if (reaction.createdAt < earliest) earliest = reaction.createdAt;
        if (reaction.createdAt > latest) latest = reaction.createdAt;
      }
    }

    return {
      reactions,
      stats: {
        total: reactions.length,
        byType,
        byTargetType,
        dateRange: { earliest: earliest === Infinity ? 0 : earliest, latest: latest === -Infinity ? 0 : latest },
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // GROUPS PARSING
  // ═══════════════════════════════════════════════════════════════════

  private async parseGroups(): Promise<RelationshipData['groups']> {
    const groupsDir = path.join(this.exportPath, 'your_facebook_activity', 'groups');

    const posts: ParsedGroupPost[] = [];
    const comments: ParsedGroupComment[] = [];
    const groupMap = new Map<string, ParsedGroup>();

    // Parse group posts
    const postsFile = path.join(groupsDir, 'group_posts_and_comments.json');
    if (fs.existsSync(postsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(postsFile, 'utf-8'));
        const rawPosts = data.group_posts_v2 || [];

        for (const raw of rawPosts) {
          const text = this.decodeFacebookUnicode(raw.data?.[0]?.post || '');
          const groupName = this.extractGroupNameFromTitle(raw.title, 'posted in');

          const externalUrls: string[] = [];
          if (raw.attachments) {
            for (const attachment of raw.attachments) {
              for (const item of attachment.data || []) {
                if (item.external_context?.url) {
                  externalUrls.push(item.external_context.url);
                }
              }
            }
          }

          posts.push({
            id: this.generateGroupPostId(groupName, raw.timestamp, text),
            groupName,
            text,
            timestamp: raw.timestamp,
            externalUrls,
            hasAttachments: externalUrls.length > 0 || (raw.attachments?.length || 0) > 0,
            title: this.decodeFacebookUnicode(raw.title),
          });

          // Update group map
          const groupId = this.generateGroupId(groupName);
          if (!groupMap.has(groupId)) {
            groupMap.set(groupId, {
              id: groupId,
              name: groupName,
              joinedAt: null,
              postCount: 0,
              commentCount: 0,
              lastActivity: raw.timestamp,
            });
          }
          const group = groupMap.get(groupId)!;
          group.postCount++;
          group.lastActivity = Math.max(group.lastActivity, raw.timestamp);
        }

        console.log(`  Group posts: ${posts.length}`);
      } catch {
        // ignore
      }
    }

    // Parse group comments
    const commentsFile = path.join(groupsDir, 'your_comments_in_groups.json');
    if (fs.existsSync(commentsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(commentsFile, 'utf-8'));
        const rawComments = data.group_comments_v2 || [];

        for (const raw of rawComments) {
          const commentData = raw.data?.[0]?.comment;
          if (!commentData) continue;

          const text = this.decodeFacebookUnicode(commentData.comment || '');
          const groupName = this.decodeFacebookUnicode(commentData.group || '');
          const author = this.decodeFacebookUnicode(commentData.author || '');
          const originalPostAuthor = this.extractOriginalAuthor(raw.title);

          comments.push({
            id: this.generateGroupCommentId(groupName, raw.timestamp, text),
            groupName,
            text,
            timestamp: commentData.timestamp || raw.timestamp,
            author,
            originalPostAuthor,
            title: this.decodeFacebookUnicode(raw.title),
          });

          // Update group map
          const groupId = this.generateGroupId(groupName);
          if (!groupMap.has(groupId)) {
            groupMap.set(groupId, {
              id: groupId,
              name: groupName,
              joinedAt: null,
              postCount: 0,
              commentCount: 0,
              lastActivity: raw.timestamp,
            });
          }
          const group = groupMap.get(groupId)!;
          group.commentCount++;
          group.lastActivity = Math.max(group.lastActivity, raw.timestamp);
        }

        console.log(`  Group comments: ${comments.length}`);
      } catch {
        // ignore
      }
    }

    // Parse group memberships
    const membershipFile = path.join(groupsDir, 'your_group_membership_activity.json');
    if (fs.existsSync(membershipFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(membershipFile, 'utf-8'));
        const rawMemberships = data.groups_joined_v2 || [];

        for (const raw of rawMemberships) {
          const groupName = this.decodeFacebookUnicode(raw.data?.[0]?.name || '');
          if (!groupName) continue;

          const groupId = this.generateGroupId(groupName);
          if (!groupMap.has(groupId)) {
            groupMap.set(groupId, {
              id: groupId,
              name: groupName,
              joinedAt: raw.timestamp,
              postCount: 0,
              commentCount: 0,
              lastActivity: raw.timestamp,
            });
          } else {
            const group = groupMap.get(groupId)!;
            group.joinedAt = raw.timestamp;
          }
        }

        console.log(`  Group memberships: ${rawMemberships.length}`);
      } catch {
        // ignore
      }
    }

    const groups = Array.from(groupMap.values()).sort((a, b) =>
      (b.postCount + b.commentCount) - (a.postCount + a.commentCount)
    );

    const allTimestamps = [
      ...posts.map(p => p.timestamp),
      ...comments.map(c => c.timestamp),
    ].filter(t => t > 1000);

    return {
      groups,
      posts,
      comments,
      stats: {
        totalGroups: groups.length,
        totalPosts: posts.length,
        totalComments: comments.length,
        dateRange: {
          earliest: allTimestamps.length > 0 ? Math.min(...allTimestamps) : 0,
          latest: allTimestamps.length > 0 ? Math.max(...allTimestamps) : 0,
        },
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════

  private generateFriendId(name: string): string {
    const normalizedName = this.decodeFacebookUnicode(name).toLowerCase().replace(/\s+/g, '_');
    const hash = crypto.createHash('md5').update(normalizedName).digest('hex').slice(0, 8);
    return `fb_friend_${hash}`;
  }

  private generateId(type: string, name: string): string {
    const hash = crypto.createHash('md5').update(name.toLowerCase()).digest('hex').slice(0, 12);
    return `fb_${type}_${hash}`;
  }

  private generateGroupId(groupName: string): string {
    const slug = groupName.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 40);
    return `fb_group_${slug}`;
  }

  private generateGroupPostId(groupName: string, timestamp: number, text: string): string {
    const hash = crypto.createHash('md5')
      .update(`${groupName}:${timestamp}:${text.substring(0, 100)}`)
      .digest('hex')
      .substring(0, 8);
    return `fb_gpost_${timestamp}_${hash}`;
  }

  private generateGroupCommentId(groupName: string, timestamp: number, text: string): string {
    const hash = crypto.createHash('md5')
      .update(`${groupName}:${timestamp}:${text.substring(0, 100)}`)
      .digest('hex')
      .substring(0, 8);
    return `fb_gcmt_${timestamp}_${hash}`;
  }

  private categorizeTargetingType(label: string): string {
    if (!label) return 'unknown';
    const lower = label.toLowerCase();
    if (lower.includes('uploaded') || lower.includes('list')) return 'uploaded_list';
    if (lower.includes('activity')) return 'activity';
    if (lower.includes('interest')) return 'interest';
    if (lower.includes('retarget') || lower.includes('visited')) return 'retargeting';
    if (lower.includes('custom')) return 'custom';
    return 'other';
  }

  private normalizeReactionType(type?: string): 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry' | null {
    if (!type) return null;
    const normalized = type.toLowerCase();
    switch (normalized) {
      case 'like': return 'like';
      case 'love': return 'love';
      case 'haha': return 'haha';
      case 'wow': return 'wow';
      case 'sad': return 'sad';
      case 'angry': return 'angry';
      default: return 'like';
    }
  }

  private parseReactionContext(title?: string): {
    targetType: 'link' | 'post' | 'photo' | 'video' | 'comment' | 'unknown';
    targetAuthor?: string;
  } {
    if (!title) return { targetType: 'unknown' };

    const decodedTitle = this.decodeFacebookUnicode(title);

    let targetType: 'link' | 'post' | 'photo' | 'video' | 'comment' | 'unknown' = 'unknown';
    if (decodedTitle.includes('link')) targetType = 'link';
    else if (decodedTitle.includes('photo')) targetType = 'photo';
    else if (decodedTitle.includes('video')) targetType = 'video';
    else if (decodedTitle.includes('comment')) targetType = 'comment';
    else if (decodedTitle.includes('post')) targetType = 'post';

    const match = decodedTitle.match(/(?:liked|loved|reacted to) (.+?)(?:'s|'s) (post|photo|video|comment)/i);
    let targetAuthor: string | undefined;
    if (match) {
      targetAuthor = match[1];
    }

    return { targetType, targetAuthor };
  }

  private extractGroupNameFromTitle(title: string, action: string): string {
    const decoded = this.decodeFacebookUnicode(title);
    const pattern = new RegExp(`${action}\\s+(.+?)\\s*\\.?$`, 'i');
    const match = decoded.match(pattern);
    return match ? match[1].trim().replace(/\.$/, '') : decoded;
  }

  private extractOriginalAuthor(title: string): string {
    const decoded = this.decodeFacebookUnicode(title);
    const match = decoded.match(/commented on (.+?)['']s post/i);
    if (match) {
      return match[1] === 'his own' || match[1] === 'her own' ? 'self' : match[1];
    }
    return '';
  }

  private decodeFacebookUnicode(text: string): string {
    if (!text) return '';
    try {
      const parsed = JSON.parse(`"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}"`);
      const bytes = new Uint8Array([...parsed].map(c => c.charCodeAt(0)));
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return text
        .replace(/\\u00([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    }
  }

  /**
   * Check if Facebook relationship data exists in export
   */
  static hasRelationshipData(exportPath: string): boolean {
    const paths = [
      'connections/friends/your_friends.json',
      'ads_information/advertisers_using_your_activity_or_information.json',
      "your_facebook_activity/pages/pages_you've_liked.json",
      'your_facebook_activity/likes_and_reactions',
      'your_facebook_activity/groups',
    ];

    for (const p of paths) {
      if (fs.existsSync(path.join(exportPath, p))) {
        return true;
      }
    }

    return false;
  }
}
