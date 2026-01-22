# Humanizer Platinum MCP Server - Implementation Plan

**Date**: January 22, 2026  
**Project**: humanizer-platinum  
**Branch**: `blissful-rhodes`  
**Status**: Ready for Implementation

---

## Executive Summary

Implement an MCP (Model Context Protocol) server that exposes the humanizer-platinum agent capabilities to any MCP-compatible application. This enables:

1. **Development Assistance**: CodeGuard agents (architect, stylist, security, accessibility, data) for code quality
2. **Application Integration**: AppAgent council for humanizer features (book-making, archive search, transformations)
3. **Production API**: Standard MCP interface for third-party integrations

---

## Current State

### Completed
- **CodeGuard Agents** (5 agents, ~200KB total):
  - `architect.ts` - Architecture analysis, pattern detection, coupling analysis
  - `stylist.ts` - Code style, naming conventions, formatting
  - `security.ts` - Vulnerability scanning, secret detection, crypto audit
  - `accessibility.ts` - WCAG compliance, ARIA validation, contrast checking
  - `data.ts` - Schema validation, Zod usage, interface compatibility

- **Review Hooks System**: Automatic triggers for file changes, pre-commit, pre-push

- **Infrastructure**: MessageBus, ConfigManager, agent lifecycle management

### Missing
- MCP server implementation
- MCP tool definitions
- JSON-RPC transport layer
- Production deployment configuration

---

## MCP Protocol Overview

MCP uses JSON-RPC 2.0 over stdio or HTTP. Key concepts:

```typescript
// Tool definition
interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

// Tool call
interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

// Tool result
interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Client (Claude, etc.)                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ JSON-RPC 2.0 (stdio/HTTP)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     HumanizerMCPServer                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Tool Registry                         │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │    │
│  │  │ CodeGuard    │  │ AppAgent     │  │ System       │   │    │
│  │  │ Tools (15+)  │  │ Tools (10+)  │  │ Tools (5)    │   │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                │                                 │
│                                ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Agent Router                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│           │              │              │              │         │
│           ▼              ▼              ▼              ▼         │
│     ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│     │Architect │  │ Stylist  │  │ Security │  │  Data    │     │
│     └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tool Catalog

### CodeGuard Tools (Development Standards)

| Tool | Agent | Description | Input Schema |
|------|-------|-------------|--------------|
| `review_architecture` | architect | Analyze codebase architecture | `{ files: CodeFile[], focus: ArchitectureFocus, depth: ReviewDepth }` |
| `suggest_patterns` | architect | Recommend design patterns | `{ context: string, problem: string }` |
| `detect_anti_patterns` | architect | Find architectural issues | `{ files: CodeFile[] }` |
| `analyze_coupling` | architect | Measure module coupling | `{ files: CodeFile[] }` |
| `analyze_complexity` | architect | Calculate complexity metrics | `{ files: CodeFile[], threshold?: number }` |
| `review_code_style` | stylist | Check code style | `{ files: CodeFile[], strictness: Strictness }` |
| `validate_naming` | stylist | Check naming conventions | `{ files: CodeFile[] }` |
| `check_consistency` | stylist | Find style inconsistencies | `{ files: CodeFile[] }` |
| `format_code` | stylist | Auto-format code | `{ files: CodeFile[], language: string }` |
| `scan_vulnerabilities` | security | Security vulnerability scan | `{ files: CodeFile[], scanTypes?: SecurityScanType[] }` |
| `review_secrets` | security | Check for exposed secrets | `{ files: CodeFile[] }` |
| `validate_permissions` | security | Audit access controls | `{ files: CodeFile[] }` |
| `audit_accessibility` | accessibility | WCAG compliance audit | `{ components: CodeFile[], standard?: WCAGStandard }` |
| `validate_aria` | accessibility | Check ARIA usage | `{ components: CodeFile[] }` |
| `check_contrast` | accessibility | Color contrast validation | `{ components: CodeFile[] }` |
| `validate_schemas` | data | Check Zod schema usage | `{ files: CodeFile[] }` |
| `check_compatibility` | data | Interface compatibility | `{ files: CodeFile[] }` |
| `trace_data_flow` | data | Trace data through system | `{ entryPoint: string }` |

### Review Hooks Tools

| Tool | Description | Input Schema |
|------|-------------|--------------|
| `trigger_review` | Manually trigger code review | `{ files: string[], agents?: DevelopmentHouseType[] }` |
| `run_full_review` | Run all agents on files | `{ files: string[] }` |
| `get_hooks_config` | Get current hook configuration | `{}` |
| `set_hooks_enabled` | Enable/disable hooks | `{ enabled: boolean }` |

### System Tools

| Tool | Description | Input Schema |
|------|-------------|--------------|
| `list_agents` | List all available agents | `{}` |
| `get_agent_status` | Get agent health/status | `{ agentId: string }` |
| `ping` | Health check | `{}` |

---

## Implementation Plan

### Phase 1: Core MCP Server (~400 lines)

**File**: `packages/core/src/mcp/server.ts`

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export class HumanizerMCPServer {
  private server: Server;
  private tools: Map<string, MCPToolHandler>;
  
  constructor() {
    this.server = new Server(
      { name: 'humanizer-platinum', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );
    this.tools = new Map();
  }
  
  async initialize(): Promise<void> {
    // Initialize agents
    await initializeDevelopmentAgents();
    
    // Register all tools
    this.registerCodeGuardTools();
    this.registerHooksTools();
    this.registerSystemTools();
    
    // Set up handlers
    this.setupHandlers();
  }
  
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
```

### Phase 2: Tool Definitions (~300 lines)

**File**: `packages/core/src/mcp/tools/index.ts`

```typescript
export const CODEGUARD_TOOLS: MCPToolDefinition[] = [
  {
    name: 'review_architecture',
    description: 'Analyze codebase architecture, detect patterns, measure coupling',
    inputSchema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { $ref: '#/definitions/CodeFile' } },
        focus: { enum: ['patterns', 'coupling', 'cohesion', 'complexity'] },
        depth: { enum: ['surface', 'deep', 'comprehensive'], default: 'deep' }
      },
      required: ['files']
    }
  },
  // ... more tools
];
```

### Phase 3: Tool Handlers (~500 lines)

**File**: `packages/core/src/mcp/handlers/codeguard.ts`

```typescript
export class CodeGuardHandlers {
  constructor(private agents: DevelopmentAgents) {}
  
  async reviewArchitecture(args: ReviewArchitectureArgs): Promise<MCPResult> {
    const architect = this.agents.architect;
    const review = await architect.reviewArchitecture({
      codebase: { files: args.files },
      focus: args.focus || 'patterns',
      reviewDepth: args.depth || 'deep',
    });
    
    return {
      content: [{ type: 'text', text: JSON.stringify(review, null, 2) }]
    };
  }
  
  // ... more handlers
}
```

### Phase 4: Entry Point & CLI (~100 lines)

**File**: `packages/core/src/mcp/index.ts`

```typescript
#!/usr/bin/env node

import { HumanizerMCPServer } from './server.js';

async function main() {
  const server = new HumanizerMCPServer();
  await server.initialize();
  await server.start();
}

main().catch(console.error);
```

---

## File Structure

```
packages/core/src/mcp/
├── index.ts              # Entry point, CLI
├── server.ts             # Main MCP server class
├── types.ts              # MCP-specific types
├── tools/
│   ├── index.ts          # Tool registry
│   ├── definitions.ts    # All tool definitions
│   └── schemas.ts        # JSON schemas for inputs
├── handlers/
│   ├── index.ts          # Handler registry
│   ├── codeguard.ts      # CodeGuard agent handlers
│   ├── hooks.ts          # Review hooks handlers
│   └── system.ts         # System/utility handlers
└── __tests__/
    ├── server.test.ts    # Server integration tests
    └── handlers.test.ts  # Handler unit tests
```

---

## Dependencies

Add to `packages/core/package.json`:

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.4"
  },
  "bin": {
    "humanizer-mcp": "./dist/mcp/index.js"
  }
}
```

---

## Configuration

### Claude Desktop Integration

Add to `~/.claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "humanizer": {
      "command": "npx",
      "args": ["humanizer-mcp"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Alternative: Direct Node Execution

```json
{
  "mcpServers": {
    "humanizer": {
      "command": "node",
      "args": ["/path/to/packages/core/dist/mcp/index.js"]
    }
  }
}
```

---

## Implementation Phases

### Week 1: Foundation
- [ ] Add @modelcontextprotocol/sdk dependency
- [ ] Create server.ts with basic structure
- [ ] Create types.ts with MCP types
- [ ] Implement 5 core tools (review_architecture, review_code_style, scan_vulnerabilities, audit_accessibility, validate_schemas)
- [ ] Test with Claude Desktop

### Week 2: Complete Tools
- [ ] Add remaining CodeGuard tools (15+ total)
- [ ] Add review hooks tools (4)
- [ ] Add system tools (3)
- [ ] Create comprehensive input schemas

### Week 3: Testing & Polish
- [ ] Write integration tests
- [ ] Add error handling
- [ ] Performance optimization
- [ ] Documentation

### Week 4: Production
- [ ] npm package configuration
- [ ] CI/CD pipeline
- [ ] Deployment documentation
- [ ] User guide

---

## Success Criteria

### Functionality
- [ ] All 20+ tools accessible via MCP
- [ ] Proper JSON-RPC error handling
- [ ] Graceful agent initialization
- [ ] Correct input validation

### Performance
- [ ] Server startup < 2s
- [ ] Tool response time < 5s (typical)
- [ ] Memory usage < 200MB

### Integration
- [ ] Works with Claude Desktop
- [ ] Works with other MCP clients
- [ ] Proper stdio transport
- [ ] HTTP transport option

### Quality
- [ ] 90%+ test coverage
- [ ] TypeScript strict mode
- [ ] Comprehensive documentation
- [ ] Example usage

---

## Example Usage

### From Claude Desktop

```
User: Review the architecture of my src/services directory

Claude: [Calls humanizer:review_architecture with files from src/services/]

Result:
{
  "overallScore": 78,
  "patterns": [...],
  "antiPatterns": [...],
  "recommendations": [...]
}
```

### From CLI

```bash
# Start server (for debugging)
npx humanizer-mcp

# In another terminal, send JSON-RPC
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ping"}}' | npx humanizer-mcp
```

---

## Security Considerations

1. **File Access**: Only read files explicitly provided in tool arguments
2. **No Write Operations**: MCP tools are read-only for code analysis
3. **Secret Detection**: Security agent already handles this
4. **Rate Limiting**: Consider for production deployment
5. **Audit Logging**: Log all tool invocations

---

## Next Steps

1. **Add MCP SDK dependency** to package.json
2. **Create server.ts** with basic structure
3. **Implement ping tool** as proof of concept
4. **Test with Claude Desktop**
5. **Iterate on remaining tools**

---

## References

- [MCP Specification](https://modelcontextprotocol.io/docs)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude Desktop MCP Guide](https://docs.anthropic.com/claude/docs/mcp)
