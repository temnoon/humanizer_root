#!/usr/bin/env node
/**
 * Humanizer AUI CLI
 *
 * Interactive command-line interface for the Humanizer AUI system.
 * Provides conversational access to buffers, transformations, books, and more.
 *
 * Usage:
 *   npx tsx src/cli/humanizer-cli.ts [--session <id>] [--user <id>]
 *
 * @module @humanizer/core/cli/humanizer-cli
 */

import * as readline from 'readline';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { marked } from 'marked';
import puppeteer from 'puppeteer';
import {
  UnifiedAuiService,
  resetUnifiedAui,
  initBufferManager,
  resetBufferManager,
} from '../aui/index.js';
import type { ContentBuffer } from '../buffer/types.js';
import type { Book } from '../aui/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// LATEX UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if content contains LaTeX math expressions
 * Looks for: $...$ $$...$$ \[...\] \(...\)
 */
function hasLatexContent(content: string): boolean {
  return /\$[^$]+\$|\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)/.test(content);
}

/**
 * Convert ChatGPT-style LaTeX delimiters to standard $ delimiters
 * - \[...\] → $$...$$ (display math)
 * - \(...\) → $...$ (inline math)
 */
function fixLatexDelimiters(content: string): string {
  // Convert display math \[...\] → $$...$$
  let result = content.replace(/(?<!\\)\\\[([\s\S]*?)(?<!\\)\\\]/g, '$$$$1$$');
  // Convert inline math \(...\) → $...$
  result = result.replace(/(?<!\\)\\\(([\s\S]*?)(?<!\\)\\\)/g, '$$$1$');
  return result;
}

/**
 * KaTeX CSS for PDF rendering
 */
const KATEX_CSS_CDN = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
const KATEX_JS_CDN = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
const KATEX_AUTO_RENDER_CDN = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface CliState {
  sessionId: string | null;
  userId: string;
  activeBuffer: ContentBuffer | null;
  commandHistory: string[];
  outputDir: string;
}

interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI COMMANDS
// ═══════════════════════════════════════════════════════════════════════════

const COMMANDS: Record<string, { description: string; usage: string; example?: string }> = {
  // Session
  'session': { description: 'Show current session info', usage: 'session' },
  'sessions': { description: 'List all sessions', usage: 'sessions' },
  'new-session': { description: 'Create a new session', usage: 'new-session [name]', example: 'new-session "My Project"' },

  // Buffer operations
  'buffer': { description: 'Show active buffer', usage: 'buffer' },
  'buffers': { description: 'List all buffers in session', usage: 'buffers' },
  'load': { description: 'Load archive node into buffer', usage: 'load <node-id>', example: 'load abc123' },
  'create': { description: 'Create buffer from text', usage: 'create <text>', example: 'create "Hello world"' },
  'search': { description: 'Search archive and load results', usage: 'search <query>', example: 'search "machine learning"' },

  // Transformations
  'analyze': { description: 'Analyze buffer quality', usage: 'analyze' },
  'detect-ai': { description: 'Run AI detection on buffer', usage: 'detect-ai' },
  'transform': { description: 'Apply custom transformation', usage: 'transform <description>' },
  'persona': { description: 'Apply persona rewriting', usage: 'persona <persona-id> [style-id]' },
  'split': { description: 'Split buffer by strategy', usage: 'split <sentences|paragraphs>' },
  'merge': { description: 'Merge with another buffer', usage: 'merge <buffer-id>' },

  // Provenance
  'history': { description: 'Show buffer transformation history', usage: 'history' },
  'trace': { description: 'Trace buffer to origin', usage: 'trace' },

  // Export
  'save': { description: 'Save buffer as markdown', usage: 'save [filename]', example: 'save output.md' },
  'export-pdf': { description: 'Export buffer as PDF (with LaTeX)', usage: 'export-pdf [filename]' },
  'export-pandoc': { description: 'Export via pandoc (book-quality)', usage: 'export-pandoc [format] [filename]', example: 'export-pandoc pdf my-book.pdf' },

  // Books
  'books': { description: 'List all books', usage: 'books' },
  'book': { description: 'Show book details', usage: 'book <book-id>' },
  'to-book': { description: 'Commit buffer to book chapter', usage: 'to-book <book-id> <chapter-id>' },
  'new-book': { description: 'Create book from search query', usage: 'new-book <title> <query>', example: 'new-book "AI Guide" "artificial intelligence"' },

  // Clusters
  'clusters': { description: 'List or discover clusters', usage: 'clusters [discover]' },
  'cluster': { description: 'Show cluster details', usage: 'cluster <cluster-id>' },

  // Personas
  'personas': { description: 'List personas', usage: 'personas' },
  'harvest': { description: 'Start persona harvest', usage: 'harvest <name>' },

  // General
  'help': { description: 'Show this help', usage: 'help [command]' },
  'status': { description: 'Show system status', usage: 'status' },
  'quit': { description: 'Exit the CLI', usage: 'quit' },
};

// ═══════════════════════════════════════════════════════════════════════════
// CLI CLASS
// ═══════════════════════════════════════════════════════════════════════════

class HumanizerCli {
  private service: UnifiedAuiService;
  private state: CliState;
  private rl: readline.Interface;

  constructor(userId: string = 'cli-user', sessionId?: string) {
    resetBufferManager();
    resetUnifiedAui();
    initBufferManager();

    this.service = new UnifiedAuiService();
    this.state = {
      sessionId: sessionId || null,
      userId,
      activeBuffer: null,
      commandHistory: [],
      outputDir: './humanizer-output',
    };

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
    });

    // Ensure output directory exists
    if (!existsSync(this.state.outputDir)) {
      mkdirSync(this.state.outputDir, { recursive: true });
    }
  }

  private getPrompt(): string {
    const session = this.state.sessionId ? `[${this.state.sessionId.slice(0, 8)}]` : '[no session]';
    const buffer = this.state.activeBuffer ? ` (${this.state.activeBuffer.id.slice(0, 8)})` : '';
    return `\x1b[36mhumanizer\x1b[0m ${session}${buffer} > `;
  }

  private updatePrompt(): void {
    this.rl.setPrompt(this.getPrompt());
  }

  private print(text: string, color?: 'green' | 'yellow' | 'red' | 'cyan' | 'dim'): void {
    const colors: Record<string, string> = {
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      cyan: '\x1b[36m',
      dim: '\x1b[2m',
    };
    const reset = '\x1b[0m';
    const prefix = color ? colors[color] : '';
    console.log(`${prefix}${text}${reset}`);
  }

  private printResult(result: CommandResult): void {
    if (result.success) {
      this.print(result.message, 'green');
    } else {
      this.print(`Error: ${result.message}`, 'red');
    }
    if (result.data) {
      console.log(JSON.stringify(result.data, null, 2));
    }
  }

  async start(): Promise<void> {
    this.printBanner();

    // Initialize session if not provided
    if (!this.state.sessionId) {
      await this.createSession();
    }

    this.updatePrompt();
    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (trimmed) {
        this.state.commandHistory.push(trimmed);
        try {
          await this.executeCommand(trimmed);
        } catch (error) {
          this.print(`Error: ${(error as Error).message}`, 'red');
        }
      }
      this.updatePrompt();
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      this.print('\nGoodbye!', 'cyan');
      process.exit(0);
    });
  }

  private printBanner(): void {
    console.log(`
\x1b[36m╔═══════════════════════════════════════════════════════════════╗
║                    HUMANIZER AUI CLI                           ║
║                                                                 ║
║  Interactive command-line interface for content transformation ║
║  Type 'help' for available commands                            ║
╚═══════════════════════════════════════════════════════════════╝\x1b[0m
`);
  }

  private async createSession(name?: string): Promise<void> {
    const session = await this.service.createSession({
      userId: this.state.userId,
      name: name || `CLI Session ${new Date().toISOString()}`,
    });
    this.state.sessionId = session.id;
    this.print(`Created session: ${session.id}`, 'green');
  }

  private async executeCommand(input: string): Promise<void> {
    const parts = this.parseCommand(input);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      // Session commands
      case 'session':
        await this.showSession();
        break;
      case 'sessions':
        await this.listSessions();
        break;
      case 'new-session':
        await this.createSession(args.join(' ') || undefined);
        break;

      // Buffer commands
      case 'buffer':
        this.showBuffer();
        break;
      case 'buffers':
        await this.listBuffers();
        break;
      case 'load':
        await this.loadFromArchive(args[0]);
        break;
      case 'create':
        await this.createBuffer(args.join(' '));
        break;
      case 'search':
        await this.searchAndLoad(args.join(' '));
        break;

      // Transformation commands
      case 'analyze':
        await this.analyzeBuffer();
        break;
      case 'detect-ai':
        await this.detectAI();
        break;
      case 'transform':
        await this.transformBuffer(args.join(' '));
        break;
      case 'persona':
        await this.applyPersona(args[0], args[1]);
        break;
      case 'split':
        await this.splitBuffer(args[0] as 'sentences' | 'paragraphs');
        break;
      case 'merge':
        await this.mergeBuffer(args[0]);
        break;

      // Provenance commands
      case 'history':
        this.showHistory();
        break;
      case 'trace':
        await this.traceOrigin();
        break;

      // Export commands
      case 'save':
        await this.saveAsMarkdown(args[0]);
        break;
      case 'export-pdf':
        await this.exportAsPdf(args[0]);
        break;
      case 'export-pandoc':
        await this.exportViaPandoc(args[0], args[1]);
        break;

      // Book commands
      case 'books':
        await this.listBooks();
        break;
      case 'book':
        await this.showBook(args[0]);
        break;
      case 'to-book':
        await this.commitToBook(args[0], args[1]);
        break;
      case 'new-book':
        await this.createBook(args[0], args.slice(1).join(' '));
        break;

      // Cluster commands
      case 'clusters':
        await this.handleClusters(args[0] === 'discover');
        break;
      case 'cluster':
        await this.showCluster(args[0]);
        break;

      // Persona commands
      case 'personas':
        await this.listPersonas();
        break;
      case 'harvest':
        await this.startHarvest(args.join(' '));
        break;

      // General commands
      case 'help':
        this.showHelp(args[0]);
        break;
      case 'status':
        this.showStatus();
        break;
      case 'quit':
      case 'exit':
        this.rl.close();
        break;

      default:
        this.print(`Unknown command: ${command}. Type 'help' for available commands.`, 'yellow');
    }
  }

  private parseCommand(input: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (const char of input) {
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    if (current) {
      parts.push(current);
    }
    return parts;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION COMMANDS
  // ═══════════════════════════════════════════════════════════════════════════

  private async showSession(): Promise<void> {
    if (!this.state.sessionId) {
      this.print('No active session', 'yellow');
      return;
    }
    const session = await this.service.getSessionAsync(this.state.sessionId);
    if (session) {
      this.print(`Session: ${session.id}`, 'cyan');
      this.print(`  Name: ${session.name || '(unnamed)'}`);
      this.print(`  User: ${session.userId || '(anonymous)'}`);
      this.print(`  Created: ${new Date(session.createdAt).toLocaleString()}`);
      this.print(`  Buffers: ${session.buffers.size}`);
      this.print(`  Commands: ${session.metadata?.commandCount || 0}`);
    }
  }

  private async listSessions(): Promise<void> {
    const sessions = this.service.listSessions();
    if (sessions.length === 0) {
      this.print('No sessions', 'dim');
      return;
    }
    this.print(`Sessions (${sessions.length}):`, 'cyan');
    for (const s of sessions) {
      const marker = s.id === this.state.sessionId ? ' *' : '';
      this.print(`  ${s.id.slice(0, 8)} - ${s.name || '(unnamed)'}${marker}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUFFER COMMANDS
  // ═══════════════════════════════════════════════════════════════════════════

  private showBuffer(): void {
    if (!this.state.activeBuffer) {
      this.print('No active buffer. Use "load", "create", or "search" to create one.', 'yellow');
      return;
    }
    const b = this.state.activeBuffer;
    this.print(`Buffer: ${b.id}`, 'cyan');
    this.print(`  Content Hash: ${b.contentHash.slice(0, 12)}...`);
    this.print(`  Words: ${b.wordCount}`);
    this.print(`  Format: ${b.format}`);
    this.print(`  State: ${b.state}`);
    this.print(`  Origin: ${b.origin.sourceType}`);
    if (b.qualityMetrics) {
      this.print(`  Quality Score: ${(b.qualityMetrics.overallScore * 100).toFixed(1)}%`);
    }
    this.print('\n--- Content Preview (first 500 chars) ---', 'dim');
    console.log(b.text.slice(0, 500) + (b.text.length > 500 ? '...' : ''));
  }

  private async listBuffers(): Promise<void> {
    if (!this.state.sessionId) {
      this.print('No session', 'yellow');
      return;
    }
    const buffers = this.service.listBuffers(this.state.sessionId);
    if (buffers.length === 0) {
      this.print('No buffers in session', 'dim');
      return;
    }
    this.print(`Buffers (${buffers.length}):`, 'cyan');
    for (const b of buffers) {
      console.log(`  ${b.name} - ${b.workingContent.length} items`);
    }
  }

  private async loadFromArchive(nodeId: string): Promise<void> {
    if (!nodeId) {
      this.print('Usage: load <node-id>', 'yellow');
      return;
    }
    const bufferService = this.service.getBufferService();
    try {
      this.state.activeBuffer = await bufferService.loadFromArchive(nodeId);
      this.print(`Loaded archive node ${nodeId} into buffer`, 'green');
      this.print(`  Words: ${this.state.activeBuffer.wordCount}`);
    } catch (error) {
      this.print(`Failed to load: ${(error as Error).message}`, 'red');
    }
  }

  private async createBuffer(text: string): Promise<void> {
    if (!text) {
      this.print('Usage: create <text>', 'yellow');
      return;
    }
    const bufferService = this.service.getBufferService();
    this.state.activeBuffer = await bufferService.createFromText(text);
    this.print(`Created buffer with ${this.state.activeBuffer.wordCount} words`, 'green');
  }

  private async searchAndLoad(query: string): Promise<void> {
    if (!query) {
      this.print('Usage: search <query>', 'yellow');
      return;
    }
    this.print(`Searching for: "${query}"...`, 'dim');
    // Note: This requires agentic search to be configured
    try {
      if (!this.state.sessionId) {
        await this.createSession();
      }
      const results = await this.service.search(this.state.sessionId!, query, { limit: 5 });
      if (results.results.length === 0) {
        this.print('No results found', 'yellow');
        return;
      }
      // Combine results into a buffer
      const combinedText = results.results.map((r: any) => r.text).join('\n\n---\n\n');
      const bufferService = this.service.getBufferService();
      this.state.activeBuffer = await bufferService.createFromText(combinedText, {
        metadata: { searchQuery: query, resultCount: results.results.length },
      });
      this.print(`Loaded ${results.results.length} results into buffer`, 'green');
    } catch (error) {
      this.print(`Search failed: ${(error as Error).message}`, 'red');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSFORMATION COMMANDS
  // ═══════════════════════════════════════════════════════════════════════════

  private async analyzeBuffer(): Promise<void> {
    if (!this.state.activeBuffer) {
      this.print('No active buffer', 'yellow');
      return;
    }
    const bufferService = this.service.getBufferService();
    this.state.activeBuffer = await bufferService.analyzeQuality(this.state.activeBuffer);
    const m = this.state.activeBuffer.qualityMetrics!;
    this.print('Quality Analysis:', 'cyan');
    this.print(`  Overall Score: ${(m.overallScore * 100).toFixed(1)}%`);
    this.print(`  Reading Level: Grade ${m.readability?.fleschKincaidGrade?.toFixed(1) || 'N/A'}`);
    this.print(`  Avg Sentence Length: ${m.readability?.avgSentenceLength?.toFixed(1) || 'N/A'} words`);
    this.print(`  Formality: ${((m.voice?.formalityLevel || 0.5) * 100).toFixed(0)}%`);
  }

  private async detectAI(): Promise<void> {
    if (!this.state.activeBuffer) {
      this.print('No active buffer', 'yellow');
      return;
    }
    const bufferService = this.service.getBufferService();
    this.state.activeBuffer = await bufferService.detectAI(this.state.activeBuffer);
    const ai = this.state.activeBuffer.qualityMetrics?.aiDetection;
    if (ai) {
      this.print('AI Detection Results:', 'cyan');
      this.print(`  AI Probability: ${((ai.probability || 0) * 100).toFixed(1)}%`);
      this.print(`  Confidence: ${((ai.confidence || 0) * 100).toFixed(1)}%`);
      const label = ai.probability > 0.7 ? 'Likely AI' : ai.probability > 0.3 ? 'Uncertain' : 'Likely Human';
      this.print(`  Classification: ${label}`);
      if (ai.tells && ai.tells.length > 0) {
        this.print(`  AI Tells Found: ${ai.tells.map(t => t.phrase).join(', ')}`);
      }
    } else {
      this.print('AI detection not available', 'yellow');
    }
  }

  private async transformBuffer(description: string): Promise<void> {
    if (!this.state.activeBuffer) {
      this.print('No active buffer', 'yellow');
      return;
    }
    if (!description) {
      this.print('Usage: transform <description>', 'yellow');
      return;
    }
    const bufferService = this.service.getBufferService();
    this.state.activeBuffer = await bufferService.transform(this.state.activeBuffer, {
      type: 'transform_custom',
      parameters: { description },
      description,
    });
    this.print(`Transformation applied: ${description}`, 'green');
  }

  private async applyPersona(personaId: string, styleId?: string): Promise<void> {
    if (!this.state.activeBuffer) {
      this.print('No active buffer', 'yellow');
      return;
    }
    if (!personaId) {
      this.print('Usage: persona <persona-id> [style-id]', 'yellow');
      return;
    }
    this.print(`Applying persona ${personaId}...`, 'dim');
    const bufferService = this.service.getBufferService();
    try {
      this.state.activeBuffer = await bufferService.rewriteForPersona(
        this.state.activeBuffer,
        personaId,
        styleId
      );
      this.print(`Persona rewriting complete`, 'green');
      this.print(`  New word count: ${this.state.activeBuffer.wordCount}`);
    } catch (error) {
      this.print(`Persona rewriting failed: ${(error as Error).message}`, 'red');
    }
  }

  private async splitBuffer(strategy: 'sentences' | 'paragraphs'): Promise<void> {
    if (!this.state.activeBuffer) {
      this.print('No active buffer', 'yellow');
      return;
    }
    if (!strategy || !['sentences', 'paragraphs'].includes(strategy)) {
      this.print('Usage: split <sentences|paragraphs>', 'yellow');
      return;
    }
    const bufferService = this.service.getBufferService();
    const splits = await bufferService.split(this.state.activeBuffer, { strategy });
    this.print(`Split into ${splits.length} buffers`, 'green');
    // Keep first split as active
    if (splits.length > 0) {
      this.state.activeBuffer = splits[0];
      this.print(`Active buffer: ${splits[0].id.slice(0, 8)} (${splits[0].wordCount} words)`);
    }
  }

  private async mergeBuffer(bufferId: string): Promise<void> {
    this.print('Merge requires loading second buffer - not yet implemented', 'yellow');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROVENANCE COMMANDS
  // ═══════════════════════════════════════════════════════════════════════════

  private showHistory(): void {
    if (!this.state.activeBuffer) {
      this.print('No active buffer', 'yellow');
      return;
    }
    const bufferService = this.service.getBufferService();
    const provenance = bufferService.getProvenance(this.state.activeBuffer);
    this.print(`Provenance Chain: ${provenance.id}`, 'cyan');
    this.print(`  Root Buffer: ${provenance.rootBufferId.slice(0, 8)}`);
    this.print(`  Branch: ${provenance.branch.name}${provenance.branch.isMain ? ' (main)' : ''}`);
    this.print(`  Transformations: ${provenance.transformationCount}`);
    this.print('\nOperations:', 'dim');
    for (const op of provenance.operations) {
      const time = new Date(op.timestamp).toLocaleTimeString();
      this.print(`  [${time}] ${op.type}: ${op.description || 'No description'}`);
    }
  }

  private async traceOrigin(): Promise<void> {
    if (!this.state.activeBuffer) {
      this.print('No active buffer', 'yellow');
      return;
    }
    const trace = await this.service.traceToArchiveOrigin(this.state.activeBuffer);
    this.print('Origin Trace:', 'cyan');
    this.print(`  Archive Nodes: ${trace.archiveNodeIds.length > 0 ? trace.archiveNodeIds.join(', ') : 'None'}`);
    this.print(`  Total Transformations: ${trace.transformationCount}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT COMMANDS
  // ═══════════════════════════════════════════════════════════════════════════

  private async saveAsMarkdown(filename?: string): Promise<void> {
    if (!this.state.activeBuffer) {
      this.print('No active buffer', 'yellow');
      return;
    }
    const fname = filename || `buffer-${this.state.activeBuffer.id.slice(0, 8)}.md`;
    const filepath = join(this.state.outputDir, fname);

    const bufferService = this.service.getBufferService();
    const provenance = bufferService.getProvenance(this.state.activeBuffer);

    // Generate markdown with metadata
    const md = `# Buffer Export

**ID:** ${this.state.activeBuffer.id}
**Created:** ${new Date(this.state.activeBuffer.createdAt).toLocaleString()}
**Words:** ${this.state.activeBuffer.wordCount}
**Format:** ${this.state.activeBuffer.format}

## Provenance

- Origin: ${this.state.activeBuffer.origin.sourceType}
- Transformations: ${provenance.transformationCount}
${provenance.operations.map(op => `- ${op.type}: ${op.description || ''}`).join('\n')}

---

## Content

${this.state.activeBuffer.text}
`;

    writeFileSync(filepath, md);
    this.print(`Saved to: ${filepath}`, 'green');
  }

  private async exportAsPdf(filename?: string): Promise<void> {
    if (!this.state.activeBuffer) {
      this.print('No active buffer', 'yellow');
      return;
    }

    const fname = filename || `buffer-${this.state.activeBuffer.id.slice(0, 8)}.pdf`;
    const filepath = join(this.state.outputDir, fname);

    const bufferService = this.service.getBufferService();
    const provenance = bufferService.getProvenance(this.state.activeBuffer);

    // Check for LaTeX content and preprocess delimiters
    const rawText = this.state.activeBuffer.text;
    const needsLatex = hasLatexContent(rawText);
    const processedText = needsLatex ? fixLatexDelimiters(rawText) : rawText;

    if (needsLatex) {
      this.print('Generating PDF with LaTeX rendering...', 'dim');
    } else {
      this.print('Generating PDF...', 'dim');
    }

    // Build markdown content
    const md = `# Buffer Export

**ID:** ${this.state.activeBuffer.id}
**Created:** ${new Date(this.state.activeBuffer.createdAt).toLocaleString()}
**Words:** ${this.state.activeBuffer.wordCount}
**Format:** ${this.state.activeBuffer.format}

## Provenance

- **Origin:** ${this.state.activeBuffer.origin.sourceType}
- **Transformations:** ${provenance.transformationCount}

${provenance.operations.map(op => `- \`${op.type}\`: ${op.description || ''}`).join('\n')}

---

## Content

${processedText}
`;

    // Convert markdown to HTML
    const htmlContent = await marked.parse(md);

    // Build KaTeX includes (only if needed)
    const katexIncludes = needsLatex ? `
  <link rel="stylesheet" href="${KATEX_CSS_CDN}">
  <script defer src="${KATEX_JS_CDN}"></script>
  <script defer src="${KATEX_AUTO_RENDER_CDN}"></script>
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      renderMathInElement(document.body, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false}
        ],
        throwOnError: false
      });
    });
  </script>` : '';

    // Wrap in styled HTML document
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">${katexIncludes}
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
      line-height: 1.6;
      color: #333;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
    }
    h2 {
      color: #34495e;
      margin-top: 30px;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #f8f8f8;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      border: 1px solid #e0e0e0;
    }
    pre code {
      background: none;
      padding: 0;
    }
    hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 30px 0;
    }
    ul {
      padding-left: 25px;
    }
    li {
      margin: 5px 0;
    }
    p strong {
      color: #555;
    }
    blockquote {
      border-left: 3px solid #3498db;
      margin: 20px 0;
      padding-left: 15px;
      color: #666;
    }
    /* KaTeX display math styling */
    .katex-display {
      margin: 1.5em 0;
      overflow-x: auto;
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

    // Generate PDF using puppeteer
    let browser;
    try {
      browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Wait for KaTeX to render if needed
      if (needsLatex) {
        // Wait for network to settle and KaTeX scripts to load
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).catch(() => {
          // Timeout is okay - continue anyway
        });
        // Additional delay for rendering
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await page.pdf({
        path: filepath,
        format: 'A4',
        margin: { top: '40px', bottom: '40px', left: '40px', right: '40px' },
        printBackground: true,
      });
      this.print(`Exported to: ${filepath}`, 'green');
      if (needsLatex) {
        this.print('  LaTeX equations rendered via KaTeX', 'dim');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.print(`PDF export failed: ${msg}`, 'red');
      this.print('Tip: Use export-pandoc for book-quality output:', 'dim');
      this.print('  export-pandoc pdf output.pdf', 'dim');
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async exportViaPandoc(format?: string, filename?: string): Promise<void> {
    if (!this.state.activeBuffer) {
      this.print('No active buffer', 'yellow');
      return;
    }

    // Check if pandoc is available
    try {
      execSync('pandoc --version', { stdio: 'pipe' });
    } catch {
      this.print('Pandoc is not installed', 'red');
      this.print('Install pandoc for book-quality export:', 'dim');
      this.print('  brew install pandoc    # macOS', 'dim');
      this.print('  apt install pandoc     # Ubuntu', 'dim');
      this.print('  https://pandoc.org/installing.html', 'dim');
      return;
    }

    const outputFormat = format || 'pdf';
    const validFormats = ['pdf', 'docx', 'epub', 'html', 'latex', 'odt'];
    if (!validFormats.includes(outputFormat)) {
      this.print(`Invalid format: ${outputFormat}`, 'red');
      this.print(`Supported formats: ${validFormats.join(', ')}`, 'dim');
      return;
    }

    const extension = outputFormat === 'latex' ? 'tex' : outputFormat;
    const fname = filename || `buffer-${this.state.activeBuffer.id.slice(0, 8)}.${extension}`;
    const filepath = join(this.state.outputDir, fname);

    this.print(`Exporting via pandoc to ${outputFormat}...`, 'dim');

    const bufferService = this.service.getBufferService();
    const provenance = bufferService.getProvenance(this.state.activeBuffer);

    // Build markdown content with proper LaTeX (pandoc handles \[ \] natively)
    const md = `---
title: Buffer Export
author: Humanizer AUI
date: ${new Date().toISOString().split('T')[0]}
---

# Buffer Export

**ID:** ${this.state.activeBuffer.id}
**Created:** ${new Date(this.state.activeBuffer.createdAt).toLocaleString()}
**Words:** ${this.state.activeBuffer.wordCount}
**Format:** ${this.state.activeBuffer.format}

## Provenance

- **Origin:** ${this.state.activeBuffer.origin.sourceType}
- **Transformations:** ${provenance.transformationCount}

${provenance.operations.map(op => `- \`${op.type}\`: ${op.description || ''}`).join('\n')}

---

## Content

${this.state.activeBuffer.text}
`;

    // Write temp markdown file
    const tempMdPath = join(this.state.outputDir, `.temp-${Date.now()}.md`);
    writeFileSync(tempMdPath, md);

    try {
      // Build pandoc command with appropriate options
      const pandocArgs = ['pandoc', tempMdPath, '-o', filepath];

      // Add format-specific options
      if (outputFormat === 'pdf') {
        // Use xelatex for better unicode/font support
        pandocArgs.push('--pdf-engine=xelatex');
        pandocArgs.push('-V', 'geometry:margin=1in');
        pandocArgs.push('-V', 'fontsize=11pt');
      } else if (outputFormat === 'epub') {
        pandocArgs.push('--toc');
        pandocArgs.push('--toc-depth=2');
      } else if (outputFormat === 'docx') {
        // Could add reference-doc for styling
      }

      // Enable smart typography
      pandocArgs.push('--smart');

      execSync(pandocArgs.join(' '), { stdio: 'pipe' });

      this.print(`Exported to: ${filepath}`, 'green');
      if (hasLatexContent(this.state.activeBuffer.text)) {
        this.print('  LaTeX equations processed natively by pandoc', 'dim');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.print(`Pandoc export failed: ${msg}`, 'red');

      // Common error: missing xelatex for PDF
      if (outputFormat === 'pdf' && msg.includes('xelatex')) {
        this.print('xelatex not found. Install a LaTeX distribution:', 'dim');
        this.print('  brew install --cask mactex   # macOS', 'dim');
        this.print('  apt install texlive-xetex    # Ubuntu', 'dim');
      }
    } finally {
      // Clean up temp file
      try {
        execSync(`rm "${tempMdPath}"`, { stdio: 'pipe' });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOK COMMANDS
  // ═══════════════════════════════════════════════════════════════════════════

  private async listBooks(): Promise<void> {
    const books = await this.service.listBooks();
    if (books.length === 0) {
      this.print('No books', 'dim');
      return;
    }
    this.print(`Books (${books.length}):`, 'cyan');
    for (const b of books) {
      this.print(`  ${b.id.slice(0, 8)} - ${b.title} (${b.chapters.length} chapters)`);
    }
  }

  private async showBook(bookId: string): Promise<void> {
    if (!bookId) {
      this.print('Usage: book <book-id>', 'yellow');
      return;
    }
    const book = await this.service.getBook(bookId);
    if (!book) {
      this.print('Book not found', 'red');
      return;
    }
    this.print(`Book: ${book.title}`, 'cyan');
    this.print(`  ID: ${book.id}`);
    this.print(`  Status: ${book.status}`);
    this.print(`  Chapters: ${book.chapters.length}`);
    this.print(`  Total Words: ${book.metadata?.totalWordCount || 'Unknown'}`);
    if (book.arc) {
      this.print(`  Arc Type: ${book.arc.arcType}`);
    }
    this.print('\nChapters:', 'dim');
    for (const ch of book.chapters) {
      this.print(`  ${ch.position + 1}. ${ch.title} (${ch.wordCount} words)`);
    }
  }

  private async commitToBook(bookId: string, chapterId: string): Promise<void> {
    if (!this.state.activeBuffer) {
      this.print('No active buffer', 'yellow');
      return;
    }
    if (!bookId || !chapterId) {
      this.print('Usage: to-book <book-id> <chapter-id>', 'yellow');
      return;
    }
    try {
      const result = await this.service.transformAndCommitToBook({
        text: this.state.activeBuffer.text,
        bookId,
        chapterId,
        chapterTitle: `Chapter from buffer ${this.state.activeBuffer.id.slice(0, 8)}`,
      });
      this.print(`Committed to book ${bookId}, chapter ${chapterId}`, 'green');
    } catch (error) {
      this.print(`Commit failed: ${(error as Error).message}`, 'red');
    }
  }

  private async createBook(title: string, query: string): Promise<void> {
    if (!title || !query) {
      this.print('Usage: new-book <title> <query>', 'yellow');
      return;
    }
    this.print(`Creating book "${title}" from query: ${query}...`, 'dim');
    try {
      const book = await this.service.createBookWithPersona({
        title,
        query,
        userId: this.state.userId,
        onProgress: (p) => this.print(`  ${p.message}`, 'dim'),
      });
      this.print(`Created book: ${book.id}`, 'green');
      this.print(`  Title: ${book.title}`);
      this.print(`  Chapters: ${book.chapters.length}`);
    } catch (error) {
      this.print(`Book creation failed: ${(error as Error).message}`, 'red');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLUSTER COMMANDS
  // ═══════════════════════════════════════════════════════════════════════════

  private async handleClusters(discover: boolean): Promise<void> {
    if (discover) {
      this.print('Discovering clusters...', 'dim');
      try {
        const result = await this.service.discoverClusters({
          sampleSize: 500,
          minClusterSize: 5,
        });
        this.print(`Found ${result.clusters.length} clusters`, 'green');
        for (const c of result.clusters) {
          this.print(`  ${c.id.slice(0, 8)} - ${c.label} (${c.totalPassages} passages)`);
        }
      } catch (error) {
        this.print(`Clustering failed: ${(error as Error).message}`, 'red');
      }
    } else {
      const clusters = await this.service.listClusters();
      if (clusters.length === 0) {
        this.print('No clusters. Use "clusters discover" to find some.', 'dim');
        return;
      }
      this.print(`Clusters (${clusters.length}):`, 'cyan');
      for (const c of clusters) {
        this.print(`  ${c.id.slice(0, 8)} - ${c.label}`);
      }
    }
  }

  private async showCluster(clusterId: string): Promise<void> {
    if (!clusterId) {
      this.print('Usage: cluster <cluster-id>', 'yellow');
      return;
    }
    const cluster = await this.service.getCluster(clusterId);
    if (!cluster) {
      this.print('Cluster not found', 'red');
      return;
    }
    this.print(`Cluster: ${cluster.label}`, 'cyan');
    this.print(`  ID: ${cluster.id}`);
    this.print(`  Passages: ${cluster.totalPassages}`);
    this.print(`  Coherence: ${(cluster.coherence * 100).toFixed(1)}%`);
    this.print(`  Keywords: ${cluster.keywords.join(', ')}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONA COMMANDS
  // ═══════════════════════════════════════════════════════════════════════════

  private async listPersonas(): Promise<void> {
    this.print('Persona listing requires store connection', 'yellow');
  }

  private async startHarvest(name: string): Promise<void> {
    if (!name) {
      this.print('Usage: harvest <persona-name>', 'yellow');
      return;
    }
    if (!this.state.sessionId) {
      await this.createSession();
    }
    try {
      const result = await this.service.startPersonaHarvest(this.state.sessionId!, { name });
      this.print(`Started persona harvest: ${result.harvestId}`, 'green');
      this.print('Add samples with archive search or manual text input.', 'dim');
    } catch (error) {
      this.print(`Failed to start harvest: ${(error as Error).message}`, 'red');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELP & STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  private showHelp(command?: string): void {
    if (command && COMMANDS[command]) {
      const cmd = COMMANDS[command];
      this.print(`\n${command}`, 'cyan');
      this.print(`  ${cmd.description}`);
      this.print(`  Usage: ${cmd.usage}`);
      if (cmd.example) {
        this.print(`  Example: ${cmd.example}`, 'dim');
      }
      return;
    }

    this.print('\nAvailable Commands:', 'cyan');
    this.print('\nSession Management:', 'dim');
    this.printCommandGroup(['session', 'sessions', 'new-session']);

    this.print('\nBuffer Operations:', 'dim');
    this.printCommandGroup(['buffer', 'buffers', 'load', 'create', 'search']);

    this.print('\nTransformations:', 'dim');
    this.printCommandGroup(['analyze', 'detect-ai', 'transform', 'persona', 'split', 'merge']);

    this.print('\nProvenance:', 'dim');
    this.printCommandGroup(['history', 'trace']);

    this.print('\nExport:', 'dim');
    this.printCommandGroup(['save', 'export-pdf', 'export-pandoc']);

    this.print('\nBooks:', 'dim');
    this.printCommandGroup(['books', 'book', 'to-book', 'new-book']);

    this.print('\nClusters & Personas:', 'dim');
    this.printCommandGroup(['clusters', 'cluster', 'personas', 'harvest']);

    this.print('\nGeneral:', 'dim');
    this.printCommandGroup(['help', 'status', 'quit']);

    this.print('\nUse "help <command>" for details on a specific command.', 'dim');
  }

  private printCommandGroup(commands: string[]): void {
    for (const name of commands) {
      const cmd = COMMANDS[name];
      if (cmd) {
        console.log(`  ${name.padEnd(15)} ${cmd.description}`);
      }
    }
  }

  private showStatus(): void {
    this.print('System Status:', 'cyan');
    this.print(`  Session: ${this.state.sessionId || 'None'}`);
    this.print(`  User: ${this.state.userId}`);
    this.print(`  Active Buffer: ${this.state.activeBuffer ? this.state.activeBuffer.id.slice(0, 8) : 'None'}`);
    this.print(`  Command History: ${this.state.commandHistory.length} commands`);
    this.print(`  Output Directory: ${this.state.outputDir}`);
    this.print(`  Has Store: ${this.service.hasStore()}`);
    this.print(`  Has Books Store: ${this.service.hasBooksStore()}`);
    this.print(`  Has Archive Store: ${this.service.hasArchiveStore()}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let userId = 'cli-user';
  let sessionId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--user' && args[i + 1]) {
      userId = args[i + 1];
      i++;
    } else if (args[i] === '--session' && args[i + 1]) {
      sessionId = args[i + 1];
      i++;
    } else if (args[i] === '--help') {
      console.log(`
Humanizer AUI CLI

Usage:
  npx tsx src/cli/humanizer-cli.ts [options]

Options:
  --user <id>       User ID (default: cli-user)
  --session <id>    Resume existing session
  --help            Show this help
`);
      process.exit(0);
    }
  }

  const cli = new HumanizerCli(userId, sessionId);
  await cli.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
