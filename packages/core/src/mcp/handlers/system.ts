/**
 * System Handlers
 *
 * MCP tool handlers for system and utility operations.
 * Includes health checks, agent status, and server information.
 */

import type { MCPResult, GetAgentStatusInput, HealthCheck, ServerStatus } from '../types.js';
import type { DevelopmentHouseType } from '../../houses/codeguard/types.js';
import {
  getArchitectAgent,
  getStylistAgent,
  getSecurityAgent,
  getAccessibilityAgent,
  getDataAgent,
} from '../../houses/codeguard/index.js';

// Server start time for uptime calculation
const SERVER_START_TIME = Date.now();

// ═══════════════════════════════════════════════════════════════════
// RESULT HELPERS
// ═══════════════════════════════════════════════════════════════════

function jsonResult(data: unknown): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ═══════════════════════════════════════════════════════════════════
// AGENT DESCRIPTIONS
// ═══════════════════════════════════════════════════════════════════

const AGENT_DESCRIPTIONS: Record<DevelopmentHouseType, {
  name: string;
  description: string;
  capabilities: string[];
}> = {
  architect: {
    name: 'The Architect',
    description: 'Guardian of code structure and design patterns. Analyzes architecture, detects patterns and anti-patterns, measures coupling and complexity.',
    capabilities: [
      'review_architecture - Analyze codebase architecture',
      'suggest_patterns - Recommend design patterns',
      'detect_anti_patterns - Find architectural issues',
      'analyze_coupling - Measure module coupling',
      'analyze_complexity - Calculate complexity metrics',
      'validate_structure - Validate architectural constraints',
      'plan_refactoring - Create refactoring plans',
    ],
  },
  stylist: {
    name: 'The Stylist',
    description: 'Keeper of code aesthetics and conventions. Ensures consistent style, naming, and formatting across the codebase.',
    capabilities: [
      'review_code_style - Check code style and formatting',
      'validate_naming - Check naming conventions',
      'check_consistency - Find style inconsistencies',
    ],
  },
  security: {
    name: 'The Guardian',
    description: 'Protector against vulnerabilities. Scans for security issues, secret leaks, and cryptographic weaknesses.',
    capabilities: [
      'scan_vulnerabilities - Scan for security vulnerabilities',
      'review_secrets - Check for exposed secrets',
      'audit_crypto - Audit cryptographic implementations',
      'audit_permissions - Audit permission models',
      'review_auth - Review authentication implementation',
    ],
  },
  accessibility: {
    name: 'The Advocate',
    description: 'Champion of inclusive design. Ensures WCAG compliance, proper ARIA usage, and accessible UI components.',
    capabilities: [
      'audit_accessibility - WCAG compliance audit',
      'validate_aria - Check ARIA attribute usage',
      'check_contrast - Validate color contrast ratios',
    ],
  },
  data: {
    name: 'The Librarian',
    description: 'Curator of data structures and schemas. Validates Zod schemas, checks interface compatibility, and traces data flow.',
    capabilities: [
      'validate_schemas - Check Zod schema usage',
      'check_compatibility - Check interface compatibility',
      'trace_data_flow - Trace data through the system',
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════

export async function handlePing(): Promise<MCPResult> {
  return jsonResult({
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: 'humanizer-platinum',
    version: '1.0.0',
  });
}

export async function handleListAgents(): Promise<MCPResult> {
  const agents = Object.entries(AGENT_DESCRIPTIONS).map(([id, info]) => ({
    id,
    ...info,
  }));
  
  return jsonResult({
    agents,
    count: agents.length,
  });
}

export async function handleGetAgentStatus(args: GetAgentStatusInput): Promise<MCPResult> {
  try {
    const agentId = args.agentId;
    
    // Get the agent instance
    let agent;
    switch (agentId) {
      case 'architect':
        agent = getArchitectAgent();
        break;
      case 'stylist':
        agent = getStylistAgent();
        break;
      case 'security':
        agent = getSecurityAgent();
        break;
      case 'accessibility':
        agent = getAccessibilityAgent();
        break;
      case 'data':
        agent = getDataAgent();
        break;
      default:
        return errorResult(`Unknown agent: ${agentId}`);
    }
    
    const description = AGENT_DESCRIPTIONS[agentId];
    
    return jsonResult({
      id: agentId,
      name: description.name,
      description: description.description,
      status: 'ready',
      capabilities: description.capabilities,
      version: agent.version,
    });
  } catch (err) {
    return errorResult(`Failed to get agent status: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleGetServerStatus(): Promise<MCPResult> {
  const uptime = Date.now() - SERVER_START_TIME;
  
  // Check each agent
  const agentStatuses: Array<{ id: DevelopmentHouseType; status: 'ready' | 'initializing' | 'error' }> = [];
  
  for (const agentId of ['architect', 'stylist', 'security', 'accessibility', 'data'] as DevelopmentHouseType[]) {
    try {
      // Just getting the agent is enough to check if it's available
      switch (agentId) {
        case 'architect':
          getArchitectAgent();
          break;
        case 'stylist':
          getStylistAgent();
          break;
        case 'security':
          getSecurityAgent();
          break;
        case 'accessibility':
          getAccessibilityAgent();
          break;
        case 'data':
          getDataAgent();
          break;
      }
      agentStatuses.push({ id: agentId, status: 'ready' });
    } catch {
      agentStatuses.push({ id: agentId, status: 'error' });
    }
  }
  
  const status: ServerStatus = {
    name: 'humanizer-platinum',
    version: '1.0.0',
    uptime,
    agents: agentStatuses,
    toolCount: 30, // Total number of tools
  };
  
  return jsonResult(status);
}

export async function handleHealthCheck(): Promise<MCPResult> {
  const agentHealth: Record<DevelopmentHouseType, boolean> = {
    architect: true,
    stylist: true,
    security: true,
    accessibility: true,
    data: true,
  };
  
  // Check each agent
  for (const agentId of Object.keys(agentHealth) as DevelopmentHouseType[]) {
    try {
      switch (agentId) {
        case 'architect':
          getArchitectAgent();
          break;
        case 'stylist':
          getStylistAgent();
          break;
        case 'security':
          getSecurityAgent();
          break;
        case 'accessibility':
          getAccessibilityAgent();
          break;
        case 'data':
          getDataAgent();
          break;
      }
    } catch {
      agentHealth[agentId] = false;
    }
  }
  
  const allHealthy = Object.values(agentHealth).every(v => v);
  const someHealthy = Object.values(agentHealth).some(v => v);
  
  const health: HealthCheck = {
    status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
    timestamp: new Date().toISOString(),
    agents: agentHealth,
  };
  
  return jsonResult(health);
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER REGISTRY
// ═══════════════════════════════════════════════════════════════════

export const SYSTEM_HANDLERS: Record<string, (args: unknown) => Promise<MCPResult>> = {
  ping: handlePing,
  list_agents: handleListAgents,
  get_agent_status: handleGetAgentStatus as (args: unknown) => Promise<MCPResult>,
  get_server_status: handleGetServerStatus,
  health_check: handleHealthCheck,
};
