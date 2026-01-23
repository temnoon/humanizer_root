# UCG Import Adapters Design Specification

**Date**: January 22, 2026  
**Status**: Design Document  
**Target Codebase**: humanizer-gm (electron/archive-server/services/content-graph/adapters/)  
**Spec Version**: Based on UCG Jan 2026 spec (post Instagram adapter)

---

## Overview

This document specifies the design for expanding the UCG (Universal Content Graph) import adapters to support additional social media platforms. All new adapters MUST conform to the January 2026 UCG specification and write to the `content_nodes` table via the standard adapter interface.

---

## Current State (Jan 19, 2026)

### Implemented Adapters

| Platform | Adapter File | Content Types | Nodes Imported |
|----------|--------------|---------------|----------------|
| ChatGPT/OpenAI | chatgpt-adapter.ts | chatgpt-message, chatgpt-conversation | 36,166 |
| Claude | claude-adapter.ts | claude-message, claude-conversation | 2 |
| Gemini | gemini-adapter.ts | gemini-message, gemini-conversation | 9 |
| Facebook | facebook-adapter.ts | facebook-post, facebook-comment, facebook-message, facebook-note | varies |
| Instagram | instagram-adapter.ts | instagram-post, instagram-comment, instagram-conversation, instagram-message | 990 |
| Reddit | reddit-adapter.ts | reddit-post, reddit-comment, reddit-message | 165 |
| Folder | folder-adapter.ts | text, markdown, json, html | varies |

### Adapter Interface (CRITICAL - DO NOT DEVIATE)

```typescript
// From packages/core/src/types/content-adapter.ts

export interface ContentAdapter {
  /** Unique adapter identifier */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Supported source types */
  sourceTypes: string[];
  
  /** Detect if this adapter can handle the given path */
  detect(path: string): Promise<DetectionResult>;
  
  /** Parse content from the path, yielding ContentNodes */
  parse(path: string, options?: ParseOptions): AsyncIterable<ContentNode> | Promise<ParseResult>;
}

export interface DetectionResult {
  canHandle: boolean;
  confidence: number;  // 0.0 - 1.0
  format?: string;
  version?: string;
  metadata?: Record<string, unknown>;
}

export interface ParseResult {
  nodes: ContentNode[];
  links: ContentLink[];
  errors: ParseError[];
  stats: ParseStats;
}

export interface ParseOptions {
  batchSize?: number;
  includeMedia?: boolean;
  preserveOriginal?: boolean;
  jobId?: string;
}
```

### ContentNode Schema (UCG Jan 2026)

```typescript
// From packages/core/src/types/content-graph.ts

export interface ContentNode {
  // Identity
  id: string;                          // UUID v4
  uri: string;                         // content://{source}/{type}/{id}
  content_hash: string;                // SHA-256 of normalized content
  
  // Content
  content: string;                     // Raw text content
  format: 'text' | 'markdown' | 'html' | 'json';
  
  // Typing
  source_type: string;                 // e.g., 'instagram-post', 'twitter-tweet'
  
  // Temporal
  created_at: string;                  // ISO 8601
  updated_at?: string;
  source_created_at?: string;          // Original timestamp from source
  
  // Attribution
  author_id?: string;
  author_name?: string;
  author_handle?: string;
  
  // Hierarchy
  parent_node_id?: string;             // For threads, replies
  thread_root_id?: string;             // Top of conversation tree
  hierarchy_level?: number;            // 0 = root, 1 = direct reply, etc.
  
  // Chunking (if chunked)
  chunk_index?: number;
  chunk_total?: number;
  chunk_offsets?: { start: number; end: number };
  
  // Embeddings
  embedding_model?: string;            // e.g., 'nomic-embed-text'
  embedding_at?: string;
  embedding_text_hash?: string;        // Detect stale embeddings
  
  // Ingestion tracking
  ingested_from_table?: string;
  ingested_from_id?: string;
  ingested_at?: string;
  import_job_id?: string;
  
  // Extensible metadata
  metadata: Record<string, unknown>;
}
```

---

## New Adapters to Build

### 1. X/Twitter Adapter

**Export Format**: Twitter Data Download (GDPR/Settings export)

**Detection Patterns**:
```
twitter-archive/
├── data/
│   ├── tweet.js                    # User's tweets
│   ├── like.js                     # Liked tweets
│   ├── direct-messages.js          # DMs (if included)
│   ├── direct-messages-group.js    # Group DMs
│   ├── follower.js                 # Follower list
│   ├── following.js                # Following list
│   ├── account.js                  # Account metadata
│   └── profile.js                  # Profile data
└── assets/
    └── media/                      # Attached media files
```

**Content Types**:
| Type | Source File | UCG source_type |
|------|-------------|-----------------|
| Tweets | tweet.js | twitter-tweet |
| Retweets | tweet.js (is_retweet) | twitter-retweet |
| Quote Tweets | tweet.js (quoted) | twitter-quote |
| Replies | tweet.js (in_reply_to) | twitter-reply |
| DMs | direct-messages.js | twitter-dm |
| Group DMs | direct-messages-group.js | twitter-group-dm |
| Likes | like.js | twitter-like |
| Bookmarks | bookmark.js | twitter-bookmark |

**Special Handling**:
- Twitter JS files have `window.YTD.tweet.part0 = [...]` wrapper - strip prefix
- Tweet IDs are snowflake format (timestamp embedded)
- Thread reconstruction via `in_reply_to_status_id`
- Media URLs may need resolution from `extended_entities`

**Metadata Fields**:
```typescript
interface TwitterTweetMetadata {
  tweet_id: string;
  conversation_id?: string;
  in_reply_to_status_id?: string;
  in_reply_to_user_id?: string;
  is_retweet: boolean;
  quoted_status_id?: string;
  retweet_count: number;
  favorite_count: number;
  hashtags: string[];
  mentions: string[];
  urls: string[];
  media_keys?: string[];
  source: string;  // "Twitter Web App", "Twitter for iPhone", etc.
}
```

---

### 2. Substack Adapter

**Export Format**: Substack Settings > Export

**Detection Patterns**:
```
substack-export/
├── posts.json                      # Published posts
├── drafts.json                     # Unpublished drafts
├── comments.json                   # Comments on posts
├── subscribers.csv                 # Subscriber list (if author)
└── settings.json                   # Publication settings
```

OR individual post downloads:
```
My-Post-Title/
├── post.json
├── post.html
└── images/
```

**Content Types**:
| Type | Source File | UCG source_type |
|------|-------------|-----------------|
| Posts | posts.json | substack-post |
| Drafts | drafts.json | substack-draft |
| Comments | comments.json | substack-comment |
| Notes | notes.json | substack-note |

**Special Handling**:
- HTML content with rich formatting
- Embedded images need URL resolution
- Paywall markers in metadata
- Section headers for navigation

**Metadata Fields**:
```typescript
interface SubstackPostMetadata {
  post_id: string;
  publication_id: string;
  slug: string;
  subtitle?: string;
  audience: 'public' | 'paid' | 'founding';
  section?: string;
  word_count: number;
  reading_time_minutes: number;
  likes_count: number;
  comments_count: number;
  canonical_url: string;
  is_published: boolean;
  published_at?: string;
  podcast_url?: string;
}
```

---

### 3. Reddit Adapter (Enhancement)

**Current State**: Basic implementation exists with 165 nodes (18 posts, 129 comments, 18 messages)

**Export Format**: Reddit Data Request (GDPR)

**Detection Patterns**:
```
reddit-export/
├── posts.csv                       # Submitted posts
├── comments.csv                    # All comments
├── messages.csv                    # Private messages
├── saved_posts.csv                 # Saved posts
├── saved_comments.csv              # Saved comments
├── upvoted_posts.csv              # Upvoted posts
├── downvoted_posts.csv            # Downvoted posts
├── subscribed_subreddits.csv      # Subreddit subscriptions
└── statistics.csv                  # Account stats
```

**Content Types**:
| Type | Source File | UCG source_type |
|------|-------------|-----------------|
| Posts | posts.csv | reddit-post |
| Comments | comments.csv | reddit-comment |
| Messages | messages.csv | reddit-message |
| Saved Posts | saved_posts.csv | reddit-saved-post |
| Saved Comments | saved_comments.csv | reddit-saved-comment |

**Special Handling**:
- CSV format (not JSON like others)
- HTML entities in content need decoding
- Subreddit context critical for meaning
- Deleted content shows as [deleted] or [removed]
- Parent/child relationships via `parent_id`

**Metadata Fields**:
```typescript
interface RedditPostMetadata {
  post_id: string;           // t3_xxxxx format
  subreddit: string;
  subreddit_id: string;
  is_self: boolean;          // Text post vs link
  url?: string;              // For link posts
  score: number;
  upvote_ratio?: number;
  num_comments: number;
  flair?: string;
  is_nsfw: boolean;
  is_spoiler: boolean;
  permalink: string;
}

interface RedditCommentMetadata {
  comment_id: string;        // t1_xxxxx format
  post_id: string;           // Parent post
  parent_id: string;         // Direct parent (post or comment)
  subreddit: string;
  score: number;
  permalink: string;
}
```

---

### 4. TikTok Adapter

**Export Format**: TikTok Data Download (Settings > Privacy > Download your data)

**Detection Patterns**:
```
tiktok-export/
├── Activity/
│   ├── Video Browsing History.txt
│   ├── Favorite Videos.txt
│   ├── Like List.txt
│   └── Search History.txt
├── Comment/
│   └── Comments.txt
├── Direct Messages/
│   ├── Chat History.txt
│   └── Inbox.txt
├── Profile/
│   └── Profile Information.txt
├── Video/
│   └── Videos.txt                  # Your posted videos
└── Transactions/
    └── TikTok Shopping.txt
```

**Content Types**:
| Type | Source File | UCG source_type |
|------|-------------|-----------------|
| Videos | Video/Videos.txt | tiktok-video |
| Comments | Comment/Comments.txt | tiktok-comment |
| DMs | Direct Messages/*.txt | tiktok-dm |
| Likes | Activity/Like List.txt | tiktok-like |
| Favorites | Activity/Favorite Videos.txt | tiktok-favorite |
| Browsing | Activity/Video Browsing History.txt | tiktok-view |

**Special Handling**:
- TXT format with custom delimiters (often `\n\n` between entries)
- Date formats vary by region
- Video descriptions may include hashtags
- Music/sound references need separate handling
- Duet/stitch relationships

**Metadata Fields**:
```typescript
interface TikTokVideoMetadata {
  video_id: string;
  description: string;
  hashtags: string[];
  sound_name?: string;
  sound_author?: string;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  views_count?: number;
  duration_seconds?: number;
  is_duet: boolean;
  is_stitch: boolean;
  original_video_id?: string;  // For duets/stitches
}
```

---

### 5. Discord Adapter (Bonus)

**Export Format**: Discord Data Package (Settings > Privacy > Request all of my Data)

**Detection Patterns**:
```
discord-export/
├── account/
│   └── user.json
├── messages/
│   ├── index.json                  # Channel listing
│   └── c{channel_id}/
│       ├── channel.json
│       └── messages.csv
├── servers/
│   └── index.json
└── activity/
    ├── analytics/
    └── reporting/
```

**Content Types**:
| Type | UCG source_type |
|------|-----------------|
| Server Messages | discord-message |
| DMs | discord-dm |
| Group DMs | discord-group-dm |
| Forum Posts | discord-forum-post |

---

### 6. LinkedIn Adapter (Bonus)

**Export Format**: LinkedIn Data Export

**Detection Patterns**:
```
linkedin-export/
├── Connections.csv
├── Messages.csv
├── Posts.csv
├── Comments.csv
├── Reactions.csv
├── Shares.csv
├── Profile.csv
└── Skills.csv
```

---

## Implementation Guidelines

### 1. File Structure Convention

```
electron/archive-server/services/content-graph/adapters/
├── index.ts                        # Registry & exports
├── types.ts                        # Shared types
├── utils.ts                        # Shared utilities
├── chatgpt-adapter.ts
├── claude-adapter.ts
├── gemini-adapter.ts
├── facebook-adapter.ts
├── instagram-adapter.ts
├── reddit-adapter.ts
├── twitter-adapter.ts              # NEW
├── substack-adapter.ts             # NEW
├── tiktok-adapter.ts               # NEW
├── discord-adapter.ts              # OPTIONAL
└── linkedin-adapter.ts             # OPTIONAL
```

### 2. Adapter Template

```typescript
import { v4 as uuid } from 'uuid';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import { join } from 'path';
import {
  ContentAdapter,
  ContentNode,
  ContentLink,
  DetectionResult,
  ParseResult,
  ParseOptions,
} from '@humanizer/core';

export class TwitterAdapter implements ContentAdapter {
  id = 'twitter';
  name = 'Twitter/X';
  sourceTypes = [
    'twitter-tweet',
    'twitter-retweet',
    'twitter-quote',
    'twitter-reply',
    'twitter-dm',
    'twitter-group-dm',
    'twitter-like',
    'twitter-bookmark',
  ];

  async detect(path: string): Promise<DetectionResult> {
    // Check for characteristic files
    const hasTweetJs = await this.fileExists(join(path, 'data', 'tweet.js'));
    const hasAccountJs = await this.fileExists(join(path, 'data', 'account.js'));
    
    if (hasTweetJs && hasAccountJs) {
      return { canHandle: true, confidence: 0.95, format: 'twitter-archive' };
    }
    
    // Fallback: check for manifest
    const hasManifest = await this.fileExists(join(path, 'data', 'manifest.js'));
    if (hasManifest) {
      return { canHandle: true, confidence: 0.7, format: 'twitter-archive' };
    }
    
    return { canHandle: false, confidence: 0 };
  }

  async *parse(path: string, options?: ParseOptions): AsyncIterable<ContentNode> {
    // Parse tweets
    const tweetsPath = join(path, 'data', 'tweet.js');
    if (await this.fileExists(tweetsPath)) {
      const tweets = await this.parseTwitterJs(tweetsPath);
      
      for (const tweet of tweets) {
        yield this.tweetToNode(tweet);
      }
    }
    
    // Parse DMs
    const dmsPath = join(path, 'data', 'direct-messages.js');
    if (await this.fileExists(dmsPath)) {
      const dms = await this.parseTwitterJs(dmsPath);
      
      for (const dm of dms) {
        yield this.dmToNode(dm);
      }
    }
    
    // ... other content types
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async parseTwitterJs(path: string): Promise<any[]> {
    const content = await fs.readFile(path, 'utf-8');
    // Strip "window.YTD.tweet.part0 = " prefix
    const jsonStart = content.indexOf('[');
    const jsonContent = content.slice(jsonStart);
    return JSON.parse(jsonContent);
  }

  private tweetToNode(tweet: any): ContentNode {
    const tweetData = tweet.tweet;
    const id = uuid();
    const sourceId = tweetData.id;
    
    return {
      id,
      uri: `content://twitter/tweet/${sourceId}`,
      content_hash: this.hashContent(tweetData.full_text),
      content: tweetData.full_text,
      format: 'text',
      source_type: this.classifyTweet(tweetData),
      created_at: new Date().toISOString(),
      source_created_at: new Date(tweetData.created_at).toISOString(),
      author_id: tweetData.user_id,
      author_handle: tweetData.user?.screen_name,
      parent_node_id: tweetData.in_reply_to_status_id
        ? `content://twitter/tweet/${tweetData.in_reply_to_status_id}`
        : undefined,
      metadata: {
        tweet_id: sourceId,
        conversation_id: tweetData.conversation_id,
        in_reply_to_status_id: tweetData.in_reply_to_status_id,
        in_reply_to_user_id: tweetData.in_reply_to_user_id,
        is_retweet: !!tweetData.retweeted_status,
        retweet_count: parseInt(tweetData.retweet_count) || 0,
        favorite_count: parseInt(tweetData.favorite_count) || 0,
        hashtags: this.extractHashtags(tweetData),
        mentions: this.extractMentions(tweetData),
        urls: this.extractUrls(tweetData),
        source: tweetData.source,
      },
    };
  }

  private dmToNode(dm: any): ContentNode {
    const id = uuid();
    // Implementation for DM conversion
    return {
      id,
      uri: `content://twitter/dm/${dm.id}`,
      content_hash: this.hashContent(dm.text),
      content: dm.text,
      format: 'text',
      source_type: 'twitter-dm',
      created_at: new Date().toISOString(),
      source_created_at: dm.createdAt,
      metadata: {
        dm_id: dm.id,
        conversation_id: dm.conversationId,
        sender_id: dm.senderId,
        recipient_id: dm.recipientId,
      },
    };
  }

  private classifyTweet(tweet: any): string {
    if (tweet.retweeted_status) return 'twitter-retweet';
    if (tweet.quoted_status_id) return 'twitter-quote';
    if (tweet.in_reply_to_status_id) return 'twitter-reply';
    return 'twitter-tweet';
  }

  private hashContent(content: string): string {
    return createHash('sha256')
      .update(content.normalize('NFC'))
      .digest('hex');
  }

  private extractHashtags(tweet: any): string[] {
    return tweet.entities?.hashtags?.map((h: any) => h.text) || [];
  }

  private extractMentions(tweet: any): string[] {
    return tweet.entities?.user_mentions?.map((m: any) => m.screen_name) || [];
  }

  private extractUrls(tweet: any): string[] {
    return tweet.entities?.urls?.map((u: any) => u.expanded_url) || [];
  }
}

export const twitterAdapter = new TwitterAdapter();
```

### 3. Registration Pattern

```typescript
// adapters/index.ts
import { twitterAdapter } from './twitter-adapter';
import { substackAdapter } from './substack-adapter';
import { tiktokAdapter } from './tiktok-adapter';

export const adapters = {
  twitter: twitterAdapter,
  substack: substackAdapter,
  tiktok: tiktokAdapter,
  // ... existing adapters
};

export async function getAdapterForPath(path: string): Promise<ContentAdapter | null> {
  for (const adapter of Object.values(adapters)) {
    const result = await adapter.detect(path);
    if (result.canHandle && result.confidence > 0.5) {
      return adapter;
    }
  }
  return null;
}
```

### 4. API Routes Pattern

```typescript
// routes/content-graph.ts

// Add import route for each adapter
router.post('/api/ucg/import/twitter', async (req, res) => {
  const { exportPath } = req.body;
  
  const detection = await twitterAdapter.detect(exportPath);
  if (!detection.canHandle) {
    return res.status(400).json({ error: 'Not a valid Twitter export' });
  }
  
  const jobId = uuid();
  // Queue background processing
  importQueue.add({
    id: jobId,
    adapter: 'twitter',
    path: exportPath,
  });
  
  return res.json({ jobId, status: 'queued' });
});

// Similar for substack, tiktok, etc.
```

---

## Encoding & Normalization

### Character Encoding Issues

Each platform has quirks:

| Platform | Issue | Solution |
|----------|-------|----------|
| Instagram | UTF-8/Latin-1 mix | `fixInstagramEncoding()` |
| Facebook | `\u00XX\u00YY` sequences | Custom decoder |
| Twitter | HTML entities | `he.decode()` |
| Reddit | HTML entities in CSV | `he.decode()` |
| TikTok | Variable encoding | Auto-detect with `chardet` |

### Timestamp Normalization

```typescript
function normalizeTimestamp(value: unknown, source: string): string {
  if (!value) return new Date().toISOString();
  
  // Epoch milliseconds (Facebook, Instagram)
  if (typeof value === 'number' && value > 1e12) {
    return new Date(value).toISOString();
  }
  
  // Epoch seconds (Twitter)
  if (typeof value === 'number' && value < 1e12) {
    return new Date(value * 1000).toISOString();
  }
  
  // ISO 8601
  if (typeof value === 'string') {
    return new Date(value).toISOString();
  }
  
  // Twitter-specific: "Wed Oct 10 20:19:24 +0000 2018"
  if (source === 'twitter' && typeof value === 'string') {
    return new Date(value).toISOString();
  }
  
  return new Date().toISOString();
}
```

---

## Testing Requirements

### Per-Adapter Test Suite

Each adapter needs:

1. **Detection Tests**
   - Positive: Valid export structure -> confidence > 0.7
   - Negative: Wrong platform -> confidence < 0.3
   - Edge: Partial export -> appropriate confidence

2. **Parsing Tests**
   - Parse real export -> correct node count
   - Content integrity -> hash matches
   - Metadata extraction -> all fields populated
   - Link creation -> parent/child relationships

3. **Edge Cases**
   - Empty export
   - Deleted content
   - Unicode edge cases
   - Very large exports (>100k items)

### Sample Exports Location

```
/Users/tem/humanizer_root/test-exports/
├── twitter/
│   └── twitter-temnoon-2025-*.zip
├── substack/
│   └── substack-export-*.zip
├── tiktok/
│   └── tiktok-data-*.zip
└── reddit/
    └── reddit-export-*.zip
```

---

## Link Types for New Platforms

### Twitter Links

| Relationship | Link Type | Example |
|--------------|-----------|---------|
| Reply | `parent` | Reply -> Original tweet |
| Retweet | `retweet-of` | RT -> Original |
| Quote Tweet | `quotes` | QT -> Original |
| Thread | `follows` | Tweet 2 -> Tweet 1 |
| Conversation | `thread-root` | All tweets -> Root |

### Substack Links

| Relationship | Link Type |
|--------------|-----------|
| Comment on Post | `parent` |
| Note references Post | `references` |
| Post in Series | `series-member` |

### TikTok Links

| Relationship | Link Type |
|--------------|-----------|
| Comment | `parent` |
| Duet | `duet-of` |
| Stitch | `stitch-of` |
| Reply Video | `video-reply-to` |

---

## Priority Order

Based on user data availability and complexity:

| Priority | Platform | Effort | Notes |
|----------|----------|--------|-------|
| P1 | Twitter/X | 2-3 days | User has export ready |
| P2 | Substack | 1-2 days | Simple JSON/HTML |
| P3 | Reddit Enhancement | 1 day | Expand existing |
| P4 | TikTok | 2-3 days | Complex TXT parsing |
| P5 | Discord | 2-3 days | CSV + nested structure |
| P6 | LinkedIn | 1-2 days | Simple CSV |

---

## References

- UCG Spec: `docs/UCG_SPECIFICATION.md` (Jan 18, 2026)
- Instagram Adapter: `adapters/instagram-adapter.ts` (Jan 19, 2026)
- Import Architecture: ChromaDB `c5bb50c1...` (universal patterns)
- Platform Roadmap: ChromaDB `c794588a...` (Jan 12, 2026)

---

## Changelog

- 2026-01-22: Initial design document created
