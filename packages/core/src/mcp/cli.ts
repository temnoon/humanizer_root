#!/usr/bin/env node
/**
 * Humanizer MCP CLI
 *
 * Command-line interface for interacting with the humanizer MCP server.
 * Allows listing tools, calling tools, and inspecting resources.
 *
 * Usage:
 *   npx tsx src/mcp/cli.ts list-tools [--category=<cat>]
 *   npx tsx src/mcp/cli.ts call <tool-name> [args-json]
 *   npx tsx src/mcp/cli.ts list-resources
 *   npx tsx src/mcp/cli.ts read-resource <uri>
 *   npx tsx src/mcp/cli.ts interactive
 */

import * as readline from 'readline';
import { ALL_TOOLS, getToolsByCategory, getToolDefinition } from './tools/definitions.js';
import { getHandler } from './handlers/index.js';
import { getAuiSessionState, getBufferContents } from './handlers/aui.js';
import type { HandlerContext } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// COLORS AND FORMATTING
// ═══════════════════════════════════════════════════════════════════

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function c(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(text: string): void {
  console.log(`\n${c('bold', c('cyan', '═'.repeat(60)))}`);
  console.log(c('bold', c('cyan', `  ${text}`)));
  console.log(`${c('bold', c('cyan', '═'.repeat(60)))}\n`);
}

function printSection(text: string): void {
  console.log(`\n${c('bold', c('yellow', `▸ ${text}`))}`);
}

function printError(text: string): void {
  console.error(c('red', `Error: ${text}`));
}

function printSuccess(text: string): void {
  console.log(c('green', text));
}

// ═══════════════════════════════════════════════════════════════════
// TOOL COMMANDS
// ═══════════════════════════════════════════════════════════════════

async function listTools(category?: string): Promise<void> {
  printHeader('Available MCP Tools');

  const validCategories = ['codeguard', 'hooks', 'system', 'book-agent', 'bookmaking', 'aui', 'arxiv'] as const;

  if (category) {
    if (!validCategories.includes(category as typeof validCategories[number])) {
      printError(`Invalid category: ${category}`);
      console.log(`Valid categories: ${validCategories.join(', ')}`);
      return;
    }
    const tools = getToolsByCategory(category as typeof validCategories[number]);
    console.log(`${c('dim', `Category: ${category} (${tools.length} tools)`)}\n`);
    for (const tool of tools) {
      console.log(`  ${c('bold', c('green', tool.name))}`);
      console.log(`    ${c('dim', tool.description.split('\n')[0])}`);
    }
    return;
  }

  // Group by category
  const byCategory = new Map<string, typeof ALL_TOOLS>();
  for (const tool of ALL_TOOLS) {
    const cat = tool.category || 'other';
    if (!byCategory.has(cat)) {
      byCategory.set(cat, []);
    }
    byCategory.get(cat)!.push(tool);
  }

  for (const [cat, tools] of byCategory) {
    printSection(`${cat} (${tools.length} tools)`);
    for (const tool of tools) {
      console.log(`  ${c('green', tool.name)}`);
    }
  }

  console.log(`\n${c('dim', `Total: ${ALL_TOOLS.length} tools`)}`);
  console.log(`${c('dim', 'Use "list-tools --category=<cat>" to filter by category')}`);
  console.log(`${c('dim', 'Use "describe <tool-name>" to see tool details')}`);
}

async function describeTool(toolName: string): Promise<void> {
  const tool = getToolDefinition(toolName);
  if (!tool) {
    printError(`Tool not found: ${toolName}`);
    return;
  }

  printHeader(`Tool: ${tool.name}`);
  console.log(c('bold', 'Description:'));
  console.log(`  ${tool.description}\n`);

  console.log(c('bold', 'Category:'));
  console.log(`  ${tool.category || 'other'}\n`);

  console.log(c('bold', 'Input Schema:'));
  console.log(JSON.stringify(tool.inputSchema, null, 2));
}

async function callTool(toolName: string, argsJson?: string): Promise<void> {
  const handler = getHandler(toolName);
  if (!handler) {
    printError(`Tool not found: ${toolName}`);
    console.log(`Use "list-tools" to see available tools`);
    return;
  }

  let args: unknown = {};
  if (argsJson) {
    try {
      args = JSON.parse(argsJson);
    } catch (err) {
      printError(`Invalid JSON arguments: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
  }

  printHeader(`Calling: ${toolName}`);
  console.log(c('dim', `Arguments: ${JSON.stringify(args)}`));
  console.log('');

  // Create a context with progress reporting to console
  const context: HandlerContext = {
    sendProgress: async (current: number, total?: number) => {
      const pct = total ? Math.round((current / total) * 100) : current;
      process.stdout.write(`\r${c('dim', `Progress: ${pct}${total ? '%' : ''}`)}  `);
    },
  };

  const startTime = Date.now();
  try {
    const result = await handler(args, context);
    const elapsed = Date.now() - startTime;

    // Clear progress line
    process.stdout.write('\r' + ' '.repeat(40) + '\r');

    if (result.isError) {
      printError('Tool returned an error:');
    } else {
      printSuccess(`Completed in ${elapsed}ms`);
    }

    console.log('');
    for (const content of result.content) {
      if (content.type === 'text' && content.text) {
        try {
          // Try to pretty-print JSON
          const parsed = JSON.parse(content.text);
          console.log(JSON.stringify(parsed, null, 2));
        } catch {
          console.log(content.text);
        }
      }
    }
  } catch (err) {
    printError(`Tool execution failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// RESOURCE COMMANDS
// ═══════════════════════════════════════════════════════════════════

async function listResources(): Promise<void> {
  printHeader('Available MCP Resources');

  const sessionState = getAuiSessionState();

  console.log(`  ${c('green', 'humanizer://aui/session')}`);
  console.log(`    ${c('dim', 'AUI Session State')}`);

  if (sessionState.buffers.length > 0) {
    printSection('Buffers');
    for (const buffer of sessionState.buffers) {
      console.log(`  ${c('green', `humanizer://aui/buffer/${buffer.name}`)}`);
      console.log(`    ${c('dim', `${buffer.itemCount} items`)}`);
    }
  } else {
    console.log(`\n${c('dim', 'No buffers available. Use AUI tools to create buffers.')}`);
  }
}

async function readResource(uri: string): Promise<void> {
  printHeader(`Resource: ${uri}`);

  if (uri === 'humanizer://aui/session') {
    const sessionState = getAuiSessionState();
    console.log(JSON.stringify(sessionState, null, 2));
    return;
  }

  if (uri.startsWith('humanizer://aui/buffer/')) {
    const bufferName = decodeURIComponent(uri.replace('humanizer://aui/buffer/', ''));
    const contents = getBufferContents(bufferName);

    if (contents === null) {
      printError(`Buffer "${bufferName}" not found or AUI not initialized`);
      return;
    }

    console.log(JSON.stringify({ name: bufferName, itemCount: contents.length, items: contents }, null, 2));
    return;
  }

  printError(`Unknown resource URI: ${uri}`);
}

// ═══════════════════════════════════════════════════════════════════
// INTERACTIVE MODE
// ═══════════════════════════════════════════════════════════════════

async function interactive(): Promise<void> {
  printHeader('Humanizer MCP CLI - Interactive Mode');
  console.log('Commands:');
  console.log(`  ${c('green', 'tools')} [category]        - List available tools`);
  console.log(`  ${c('green', 'describe')} <tool>        - Show tool details`);
  console.log(`  ${c('green', 'call')} <tool> [json]     - Call a tool`);
  console.log(`  ${c('green', 'resources')}              - List resources`);
  console.log(`  ${c('green', 'read')} <uri>             - Read a resource`);
  console.log(`  ${c('green', 'help')}                   - Show this help`);
  console.log(`  ${c('green', 'exit')}                   - Exit`);
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: c('cyan', 'humanizer> '),
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      rl.prompt();
      return;
    }

    const [cmd, ...args] = trimmed.split(/\s+/);
    const restArgs = args.join(' ');

    try {
      switch (cmd.toLowerCase()) {
        case 'tools':
        case 'list-tools':
          await listTools(args[0]);
          break;

        case 'describe':
        case 'desc':
          if (!args[0]) {
            printError('Usage: describe <tool-name>');
          } else {
            await describeTool(args[0]);
          }
          break;

        case 'call':
          if (!args[0]) {
            printError('Usage: call <tool-name> [json-args]');
          } else {
            const toolName = args[0];
            const jsonArgs = args.slice(1).join(' ') || undefined;
            await callTool(toolName, jsonArgs);
          }
          break;

        case 'resources':
        case 'list-resources':
          await listResources();
          break;

        case 'read':
        case 'read-resource':
          if (!args[0]) {
            printError('Usage: read <uri>');
          } else {
            await readResource(args[0]);
          }
          break;

        case 'help':
        case '?':
          console.log('Commands:');
          console.log('  tools [category]     - List tools');
          console.log('  describe <tool>      - Show tool details');
          console.log('  call <tool> [json]   - Call a tool');
          console.log('  resources            - List resources');
          console.log('  read <uri>           - Read a resource');
          console.log('  exit                 - Exit');
          break;

        case 'exit':
        case 'quit':
        case 'q':
          rl.close();
          return;

        default:
          // Try to call it as a tool directly
          const handler = getHandler(cmd);
          if (handler) {
            await callTool(cmd, restArgs || undefined);
          } else {
            printError(`Unknown command: ${cmd}`);
            console.log('Type "help" for available commands');
          }
      }
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nGoodbye!');
    process.exit(0);
  });
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(`
${c('bold', 'Humanizer MCP CLI')}

${c('bold', 'Usage:')}
  npx tsx src/mcp/cli.ts <command> [options]

${c('bold', 'Commands:')}
  ${c('green', 'list-tools')} [--category=<cat>]   List available tools
  ${c('green', 'describe')} <tool-name>           Show tool details and schema
  ${c('green', 'call')} <tool-name> [json-args]   Call a tool with arguments
  ${c('green', 'list-resources')}                 List available resources
  ${c('green', 'read-resource')} <uri>            Read a resource
  ${c('green', 'interactive')}                    Start interactive mode

${c('bold', 'Examples:')}
  # List all tools
  npx tsx src/mcp/cli.ts list-tools

  # List tools by category
  npx tsx src/mcp/cli.ts list-tools --category=arxiv

  # Describe a tool
  npx tsx src/mcp/cli.ts describe search_arxiv

  # Call a tool
  npx tsx src/mcp/cli.ts call search_arxiv '{"query": "transformer attention"}'

  # Interactive mode
  npx tsx src/mcp/cli.ts interactive

${c('bold', 'Categories:')}
  codeguard, hooks, system, book-agent, bookmaking, aui, arxiv
`);
    return;
  }

  switch (command) {
    case 'list-tools':
    case 'tools': {
      const categoryArg = args.find(a => a.startsWith('--category='));
      const category = categoryArg?.split('=')[1];
      await listTools(category);
      break;
    }

    case 'describe':
    case 'desc': {
      const toolName = args[1];
      if (!toolName) {
        printError('Usage: describe <tool-name>');
        process.exit(1);
      }
      await describeTool(toolName);
      break;
    }

    case 'call': {
      const toolName = args[1];
      const jsonArgs = args[2];
      if (!toolName) {
        printError('Usage: call <tool-name> [json-args]');
        process.exit(1);
      }
      await callTool(toolName, jsonArgs);
      break;
    }

    case 'list-resources':
    case 'resources': {
      await listResources();
      break;
    }

    case 'read-resource':
    case 'read': {
      const uri = args[1];
      if (!uri) {
        printError('Usage: read-resource <uri>');
        process.exit(1);
      }
      await readResource(uri);
      break;
    }

    case 'interactive':
    case 'i': {
      await interactive();
      break;
    }

    default:
      // Try as a direct tool call
      const handler = getHandler(command);
      if (handler) {
        await callTool(command, args[1]);
      } else {
        printError(`Unknown command: ${command}`);
        console.log('Use --help for usage information');
        process.exit(1);
      }
  }
}

main().catch(err => {
  printError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
