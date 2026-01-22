/**
 * CodeGuard Agents - Integration Tests
 *
 * Tests the codeguard development agents working together:
 * - Agent initialization and lifecycle
 * - Inter-agent communication via message bus
 * - Review hooks coordination
 * - File change event handling
 * - Combined review results
 *
 * These tests verify that the agents function correctly as a cohesive unit.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Agent imports
import {
  ArchitectAgent,
  getArchitectAgent,
  resetArchitectAgent,
  StylistAgent,
  getStylistAgent,
  resetStylistAgent,
  SecurityAgent,
  getSecurityAgent,
  resetSecurityAgent,
  AccessibilityAgent,
  getAccessibilityAgent,
  resetAccessibilityAgent,
  DataAgent,
  getDataAgent,
  resetDataAgent,
  initializeDevelopmentAgents,
  shutdownDevelopmentAgents,
  resetDevelopmentAgents,
  getDevelopmentAgents,
  getCodeGuardAgents,
} from './index.js';

// Types
import type {
  DevelopmentHouseType,
  CodeFile,
  FileTree,
  FileChangeEvent,
  ReviewResult,
  ArchitectureReviewRequest,
  StyleReviewRequest,
  SecurityScanRequest,
  A11yAuditRequest,
} from './types.js';

// Infrastructure
import { getMessageBus, resetMessageBus } from '../../bus/message-bus.js';
import { getReviewHooksManager, resetReviewHooksManager } from '../../hooks/review-hooks.js';
import { resetConfigManager } from '../../config/index.js';

// ═══════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════

const createMockCodeFile = (
  path: string,
  content: string,
  language?: string
): CodeFile => ({
  path,
  content,
  language: language || path.split('.').pop() || 'unknown',
  size: content.length,
});

const createMockFileTree = (files: CodeFile[]): FileTree => ({
  files,
  rootPath: '/test/project',
  excludePatterns: ['node_modules/**', '*.test.ts'],
});

const SAMPLE_TS_FILE = createMockCodeFile(
  'src/utils/helper.ts',
  `
import { useState } from 'react';

export function useCounter(initial: number = 0) {
  const [count, setCount] = useState(initial);
  
  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  const reset = () => setCount(initial);
  
  return { count, increment, decrement, reset };
}

export class UserService {
  private apiKey = 'sk-test-12345'; // Potential secret!
  
  async getUser(id: string) {
    const response = await fetch(\`/api/users/\${id}\`);
    return response.json();
  }
}
`,
  'typescript'
);

const SAMPLE_TSX_FILE = createMockCodeFile(
  'src/components/Button.tsx',
  `
import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

// Missing aria-label, color contrast issues
export function Button({ label, onClick, disabled }: ButtonProps) {
  return (
    <div onClick={onClick} style={{ color: '#777', background: '#888' }}>
      {label}
    </div>
  );
}
`,
  'typescript'
);

const SAMPLE_COMPLEX_FILE = createMockCodeFile(
  'src/services/processor.ts',
  `
// High complexity function for architect detection
export function processData(data: any, options: any) {
  let result = null;
  
  if (data.type === 'A') {
    if (data.subtype === 'A1') {
      if (data.value > 10) {
        if (options.strict) {
          result = data.value * 2;
        } else {
          result = data.value;
        }
      } else {
        if (options.fallback) {
          result = options.fallback;
        } else {
          result = 0;
        }
      }
    } else if (data.subtype === 'A2') {
      result = data.value + 5;
    }
  } else if (data.type === 'B') {
    switch (data.format) {
      case 'json':
        result = JSON.parse(data.raw);
        break;
      case 'csv':
        result = data.raw.split(',');
        break;
      case 'xml':
        result = data.raw;
        break;
      default:
        result = null;
    }
  }
  
  return result;
}
`,
  'typescript'
);

// ═══════════════════════════════════════════════════════════════════
// TEST SUITE: AGENT SINGLETONS
// ═══════════════════════════════════════════════════════════════════

describe('CodeGuard Agent Singletons', () => {
  beforeEach(() => {
    resetDevelopmentAgents();
    resetMessageBus();
    resetConfigManager();
  });

  afterEach(() => {
    resetDevelopmentAgents();
    resetMessageBus();
  });

  it('should return singleton instances for each agent', () => {
    const architect1 = getArchitectAgent();
    const architect2 = getArchitectAgent();
    expect(architect1).toBe(architect2);

    const stylist1 = getStylistAgent();
    const stylist2 = getStylistAgent();
    expect(stylist1).toBe(stylist2);

    const security1 = getSecurityAgent();
    const security2 = getSecurityAgent();
    expect(security1).toBe(security2);

    const accessibility1 = getAccessibilityAgent();
    const accessibility2 = getAccessibilityAgent();
    expect(accessibility1).toBe(accessibility2);

    const data1 = getDataAgent();
    const data2 = getDataAgent();
    expect(data1).toBe(data2);
  });

  it('should return new instances after reset', () => {
    const architect1 = getArchitectAgent();
    resetArchitectAgent();
    const architect2 = getArchitectAgent();
    expect(architect1).not.toBe(architect2);
  });

  it('should have correct agent identities', () => {
    const architect = getArchitectAgent();
    expect(architect.id).toBe('architect');
    expect(architect.name).toBe('The Architect');
    expect(architect.house).toBe('architect');

    const stylist = getStylistAgent();
    expect(stylist.id).toBe('stylist');
    expect(stylist.name).toBe('The Stylist');
    expect(stylist.house).toBe('stylist');

    const security = getSecurityAgent();
    expect(security.id).toBe('security');
    expect(security.name).toBe('The Security Guard');
    expect(security.house).toBe('security');

    const accessibility = getAccessibilityAgent();
    expect(accessibility.id).toBe('accessibility');
    expect(accessibility.name).toBe('The A11y Champion');
    expect(accessibility.house).toBe('accessibility');

    const data = getDataAgent();
    expect(data.id).toBe('data');
    expect(data.name).toBe('The Data Guardian');
    expect(data.house).toBe('data');
  });

  it('should return all agents via getDevelopmentAgents', () => {
    const agents = getDevelopmentAgents();

    expect(agents.architect).toBeDefined();
    expect(agents.stylist).toBeDefined();
    expect(agents.security).toBeDefined();
    expect(agents.accessibility).toBeDefined();
    expect(agents.data).toBeDefined();

    expect(agents.architect.id).toBe('architect');
    expect(agents.stylist.id).toBe('stylist');
    expect(agents.security.id).toBe('security');
    expect(agents.accessibility.id).toBe('accessibility');
    expect(agents.data.id).toBe('data');
  });

  it('should alias getCodeGuardAgents to getDevelopmentAgents', () => {
    const devAgents = getDevelopmentAgents();
    const codeGuardAgents = getCodeGuardAgents();

    // Same singleton instances
    expect(devAgents.architect).toBe(codeGuardAgents.architect);
    expect(devAgents.stylist).toBe(codeGuardAgents.stylist);
    expect(devAgents.security).toBe(codeGuardAgents.security);
    expect(devAgents.accessibility).toBe(codeGuardAgents.accessibility);
    expect(devAgents.data).toBe(codeGuardAgents.data);
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST SUITE: AGENT LIFECYCLE
// ═══════════════════════════════════════════════════════════════════

describe('CodeGuard Agent Lifecycle', () => {
  beforeEach(() => {
    resetDevelopmentAgents();
    resetMessageBus();
    resetConfigManager();
  });

  afterEach(async () => {
    await shutdownDevelopmentAgents();
    resetDevelopmentAgents();
    resetMessageBus();
  });

  it('should initialize all agents', async () => {
    await initializeDevelopmentAgents();

    // All agents should be registered with the message bus
    const bus = getMessageBus();
    const registeredAgents = bus.listAgents().map(a => a.id);
    expect(registeredAgents).toContain('architect');
    expect(registeredAgents).toContain('stylist');
    expect(registeredAgents).toContain('security');
    expect(registeredAgents).toContain('accessibility');
    expect(registeredAgents).toContain('data');
  });

  it('should shutdown all agents gracefully', async () => {
    await initializeDevelopmentAgents();
    
    const bus = getMessageBus();
    expect(bus.listAgents().length).toBeGreaterThan(0);

    await shutdownDevelopmentAgents();
    
    // Agents should be unregistered
    const registeredAgents = bus.listAgents().map(a => a.id);
    expect(registeredAgents).not.toContain('architect');
    expect(registeredAgents).not.toContain('stylist');
    expect(registeredAgents).not.toContain('security');
    expect(registeredAgents).not.toContain('accessibility');
    expect(registeredAgents).not.toContain('data');
  });

  it('should handle multiple initialize calls idempotently', async () => {
    await initializeDevelopmentAgents();
    await initializeDevelopmentAgents();
    await initializeDevelopmentAgents();

    const bus = getMessageBus();
    // Should still only have each agent registered once
    const registeredAgents = bus.listAgents().map(a => a.id);
    const architectCount = registeredAgents.filter(id => id === 'architect').length;
    expect(architectCount).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST SUITE: AGENT CAPABILITIES
// ═══════════════════════════════════════════════════════════════════

describe('CodeGuard Agent Capabilities', () => {
  beforeEach(() => {
    resetDevelopmentAgents();
    resetMessageBus();
    resetConfigManager();
  });

  afterEach(() => {
    resetDevelopmentAgents();
    resetMessageBus();
  });

  it('should expose correct capabilities for Architect', () => {
    const architect = getArchitectAgent();
    expect(architect.capabilities).toContain('review-architecture');
    expect(architect.capabilities).toContain('suggest-patterns');
    expect(architect.capabilities).toContain('validate-structure');
    expect(architect.capabilities).toContain('analyze-coupling');
    expect(architect.capabilities).toContain('detect-anti-patterns');
  });

  it('should expose correct capabilities for Stylist', () => {
    const stylist = getStylistAgent();
    expect(stylist.capabilities).toContain('review-code-style');
    expect(stylist.capabilities).toContain('validate-naming');
    expect(stylist.capabilities).toContain('check-consistency');
    expect(stylist.capabilities).toContain('format-code');
  });

  it('should expose correct capabilities for Security', () => {
    const security = getSecurityAgent();
    expect(security.capabilities).toContain('scan-vulnerabilities');
    expect(security.capabilities).toContain('review-api-keys');
    expect(security.capabilities).toContain('validate-permissions');
    expect(security.capabilities).toContain('audit-data-flow');
  });

  it('should expose correct capabilities for Accessibility', () => {
    const accessibility = getAccessibilityAgent();
    expect(accessibility.capabilities).toContain('audit-accessibility');
    expect(accessibility.capabilities).toContain('validate-aria');
    expect(accessibility.capabilities).toContain('check-color-contrast');
    expect(accessibility.capabilities).toContain('review-keyboard-navigation');
  });

  it('should expose correct capabilities for Data', () => {
    const data = getDataAgent();
    expect(data.capabilities).toContain('validate-schemas');
    expect(data.capabilities).toContain('check-zod-usage');
    expect(data.capabilities).toContain('check-interface-compatibility');
    expect(data.capabilities).toContain('validate-api-contracts');
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST SUITE: FILE PATTERN MATCHING
// ═══════════════════════════════════════════════════════════════════

describe('CodeGuard File Pattern Matching', () => {
  beforeEach(() => {
    resetDevelopmentAgents();
  });

  afterEach(() => {
    resetDevelopmentAgents();
  });

  it('Architect should match TypeScript and config files', () => {
    const architect = getArchitectAgent();
    const patterns = architect.getFilePatterns();

    expect(patterns).toContain('**/*.ts');
    expect(patterns).toContain('**/*.tsx');
    expect(patterns).toContain('**/package.json');
    expect(patterns).toContain('**/tsconfig.json');
  });

  it('Stylist should match code and style files', () => {
    const stylist = getStylistAgent();
    const patterns = stylist.getFilePatterns();

    expect(patterns).toContain('**/*.ts');
    expect(patterns).toContain('**/*.tsx');
    expect(patterns).toContain('**/*.css');
    expect(patterns).toContain('**/*.scss');
  });

  it('Security should match code and config file patterns', () => {
    const security = getSecurityAgent();
    const patterns = security.getFilePatterns();

    expect(patterns).toContain('**/*.ts');
    expect(patterns).toContain('**/*.env*');
    expect(patterns).toContain('**/*.json');
  });

  it('Accessibility should match UI component patterns', () => {
    const accessibility = getAccessibilityAgent();
    const patterns = accessibility.getFilePatterns();

    expect(patterns).toContain('**/*.tsx');
    expect(patterns).toContain('**/*.jsx');
  });

  it('Data should match schema and type files', () => {
    const data = getDataAgent();
    const patterns = data.getFilePatterns();

    expect(patterns).toContain('**/schemas/*.ts');
    expect(patterns).toContain('**/types/*.ts');
    expect(patterns).toContain('**/*schema*.ts');
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST SUITE: DEVELOPMENT HOUSE TYPE
// ═══════════════════════════════════════════════════════════════════

describe('CodeGuard Development House Types', () => {
  beforeEach(() => {
    resetDevelopmentAgents();
  });

  afterEach(() => {
    resetDevelopmentAgents();
  });

  it('each agent should return correct development house type', () => {
    const architect = getArchitectAgent();
    expect(architect.getDevelopmentHouse()).toBe('architect');

    const stylist = getStylistAgent();
    expect(stylist.getDevelopmentHouse()).toBe('stylist');

    const security = getSecurityAgent();
    expect(security.getDevelopmentHouse()).toBe('security');

    const accessibility = getAccessibilityAgent();
    expect(accessibility.getDevelopmentHouse()).toBe('accessibility');

    const data = getDataAgent();
    expect(data.getDevelopmentHouse()).toBe('data');
  });

  it('all development house types should be distinct', () => {
    const agents = getDevelopmentAgents();
    const types = new Set<DevelopmentHouseType>();

    types.add(agents.architect.getDevelopmentHouse());
    types.add(agents.stylist.getDevelopmentHouse());
    types.add(agents.security.getDevelopmentHouse());
    types.add(agents.accessibility.getDevelopmentHouse());
    types.add(agents.data.getDevelopmentHouse());

    // All 5 should be unique
    expect(types.size).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST SUITE: HOOK INTERFACES
// ═══════════════════════════════════════════════════════════════════

describe('CodeGuard Hook Interfaces', () => {
  beforeEach(async () => {
    resetDevelopmentAgents();
    resetMessageBus();
    resetConfigManager();
    await initializeDevelopmentAgents();
  });

  afterEach(async () => {
    await shutdownDevelopmentAgents();
    resetDevelopmentAgents();
    resetMessageBus();
  });

  it('all agents should implement onFileChange hook', () => {
    const agents = getDevelopmentAgents();

    expect(typeof agents.architect.onFileChange).toBe('function');
    expect(typeof agents.stylist.onFileChange).toBe('function');
    expect(typeof agents.security.onFileChange).toBe('function');
    expect(typeof agents.accessibility.onFileChange).toBe('function');
    expect(typeof agents.data.onFileChange).toBe('function');
  });

  it('all agents should implement onPreCommit hook', () => {
    const agents = getDevelopmentAgents();

    expect(typeof agents.architect.onPreCommit).toBe('function');
    expect(typeof agents.stylist.onPreCommit).toBe('function');
    expect(typeof agents.security.onPreCommit).toBe('function');
    expect(typeof agents.accessibility.onPreCommit).toBe('function');
    expect(typeof agents.data.onPreCommit).toBe('function');
  });

  it('onFileChange should return ReviewResult structure', async () => {
    const architect = getArchitectAgent();
    
    const event: FileChangeEvent = {
      files: ['src/test.ts'],
      changeType: 'modify',
      timestamp: Date.now(),
    };

    const result = await architect.onFileChange!(event);

    expect(result).toHaveProperty('agent');
    expect(result).toHaveProperty('trigger');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('blockers');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('summary');

    expect(result.agent).toBe('architect');
    expect(typeof result.passed).toBe('boolean');
    expect(Array.isArray(result.blockers)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('onPreCommit should return ReviewResult structure', async () => {
    const stylist = getStylistAgent();
    
    const stagedFiles = ['src/component.tsx', 'src/utils.ts'];

    const result = await stylist.onPreCommit!(stagedFiles);

    expect(result).toHaveProperty('agent');
    expect(result).toHaveProperty('trigger');
    expect(result).toHaveProperty('passed');
    expect(result.agent).toBe('stylist');
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST SUITE: MESSAGE BUS INTEGRATION
// ═══════════════════════════════════════════════════════════════════

describe('CodeGuard Message Bus Integration', () => {
  beforeEach(async () => {
    resetDevelopmentAgents();
    resetMessageBus();
    resetConfigManager();
    await initializeDevelopmentAgents();
  });

  afterEach(async () => {
    await shutdownDevelopmentAgents();
    resetDevelopmentAgents();
    resetMessageBus();
  });

  it('agents should be registered with the message bus', () => {
    const bus = getMessageBus();
    const registered = bus.listAgents().map(a => a.id);

    expect(registered).toContain('architect');
    expect(registered).toContain('stylist');
    expect(registered).toContain('security');
    expect(registered).toContain('accessibility');
    expect(registered).toContain('data');
  });

  it('agents should be accessible by id', () => {
    const bus = getMessageBus();
    
    // Check that agents are accessible by their id
    expect(bus.getAgent('architect')).toBeDefined();
    expect(bus.getAgent('stylist')).toBeDefined();
    expect(bus.getAgent('security')).toBeDefined();
    expect(bus.getAgent('accessibility')).toBeDefined();
    expect(bus.getAgent('data')).toBeDefined();
  });

  it('should route messages to correct agent via bus', async () => {
    const bus = getMessageBus();
    
    // Send a message to the architect
    const response = await bus.request('architect', {
      type: 'analyze-complexity',
      payload: {
        files: [SAMPLE_COMPLEX_FILE],
      },
    });

    expect(response).toBeDefined();
    expect(response.success).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST SUITE: REVIEW HOOKS MANAGER
// ═══════════════════════════════════════════════════════════════════

describe('ReviewHooksManager Integration', () => {
  beforeEach(async () => {
    resetDevelopmentAgents();
    resetMessageBus();
    resetReviewHooksManager();
    resetConfigManager();
  });

  afterEach(async () => {
    await shutdownDevelopmentAgents();
    resetDevelopmentAgents();
    resetMessageBus();
    resetReviewHooksManager();
  });

  it('should initialize with default configuration', async () => {
    const manager = getReviewHooksManager();
    await manager.initialize();

    const config = manager.getConfig();
    
    expect(config.enabled).toBe(true);
    expect(config.autoTriggers.onFileChange).toBe(true);
    expect(config.autoTriggers.onPreCommit).toBe(true);
    expect(config.agents.architect.enabled).toBe(true);
    expect(config.agents.stylist.enabled).toBe(true);
    expect(config.agents.security.enabled).toBe(true);
    expect(config.agents.accessibility.enabled).toBe(true);
    expect(config.agents.data.enabled).toBe(true);
  });

  it('should allow enabling/disabling hooks', async () => {
    const manager = getReviewHooksManager();
    await manager.initialize();

    manager.setEnabled(false);
    expect(manager.getConfig().enabled).toBe(false);

    manager.setEnabled(true);
    expect(manager.getConfig().enabled).toBe(true);
  });

  it('should allow enabling/disabling individual agents', async () => {
    const manager = getReviewHooksManager();
    await manager.initialize();

    manager.setAgentEnabled('architect', false);
    expect(manager.getConfig().agents.architect.enabled).toBe(false);

    manager.setAgentEnabled('architect', true);
    expect(manager.getConfig().agents.architect.enabled).toBe(true);
  });

  it('should handle file change events', async () => {
    await initializeDevelopmentAgents();
    const manager = getReviewHooksManager();
    await manager.initialize();

    const event: FileChangeEvent = {
      files: ['src/component.tsx', 'src/utils.ts'],
      changeType: 'modify',
      timestamp: Date.now(),
    };

    const result = await manager.handleFileChange(event);

    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('shouldBlock');
    expect(result).toHaveProperty('agentResults');
    expect(result).toHaveProperty('allBlockers');
    expect(result).toHaveProperty('allWarnings');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('totalTimeMs');
  });

  it('should handle pre-commit events', async () => {
    await initializeDevelopmentAgents();
    const manager = getReviewHooksManager();
    await manager.initialize();

    const stagedFiles = ['src/auth.ts', 'src/Button.tsx'];

    const result = await manager.handlePreCommit(stagedFiles);

    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('agentResults');
    expect(result.agentResults.size).toBeGreaterThan(0);
  });

  it('should run full review across all agents', async () => {
    await initializeDevelopmentAgents();
    const manager = getReviewHooksManager();
    await manager.initialize();

    const files = ['src/service.ts', 'src/Component.tsx'];

    const result = await manager.runFullReview(files);

    expect(result.agentResults.size).toBeGreaterThanOrEqual(3);
  });

  it('should combine results from multiple agents', async () => {
    await initializeDevelopmentAgents();
    const manager = getReviewHooksManager();
    await manager.initialize();

    const files = ['src/component.tsx'];

    const result = await manager.triggerReview(files, [
      'architect',
      'stylist',
      'accessibility',
    ]);

    // Should have results from all 3 specified agents
    expect(result.agentResults.has('architect')).toBe(true);
    expect(result.agentResults.has('stylist')).toBe(true);
    expect(result.agentResults.has('accessibility')).toBe(true);

    // Summary should mention all agents
    expect(result.summary).toContain('architect');
    expect(result.summary).toContain('stylist');
    expect(result.summary).toContain('accessibility');
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST SUITE: CROSS-AGENT COORDINATION
// ═══════════════════════════════════════════════════════════════════

describe('Cross-Agent Coordination', () => {
  beforeEach(async () => {
    resetDevelopmentAgents();
    resetMessageBus();
    resetConfigManager();
    await initializeDevelopmentAgents();
  });

  afterEach(async () => {
    await shutdownDevelopmentAgents();
    resetDevelopmentAgents();
    resetMessageBus();
  });

  it('should run multiple agent reviews in parallel', async () => {
    const agents = getDevelopmentAgents();
    
    const event: FileChangeEvent = {
      files: ['src/component.tsx'],
      changeType: 'modify',
      timestamp: Date.now(),
    };

    // Run all reviews in parallel
    const results = await Promise.all([
      agents.architect.onFileChange!(event),
      agents.stylist.onFileChange!(event),
      agents.security.onFileChange!(event),
      agents.accessibility.onFileChange!(event),
      agents.data.onFileChange!(event),
    ]);

    // All should return valid ReviewResult
    for (const result of results) {
      expect(result).toHaveProperty('agent');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('blockers');
      expect(result).toHaveProperty('warnings');
    }

    // Each should identify as different agent
    const agentTypes = results.map(r => r.agent);
    expect(new Set(agentTypes).size).toBe(5);
  });

  it('should not interfere with each other during concurrent reviews', async () => {
    const bus = getMessageBus();
    
    // Send requests to multiple agents concurrently
    const requests = [
      bus.request('architect', {
        type: 'analyze-complexity',
        payload: { files: [SAMPLE_COMPLEX_FILE] },
      }),
      bus.request('stylist', {
        type: 'review-style',
        payload: { files: [SAMPLE_TS_FILE], strictness: 'moderate' },
      }),
      bus.request('security', {
        type: 'scan-vulnerabilities',
        payload: { codebase: createMockFileTree([SAMPLE_TS_FILE]) },
      }),
    ];

    const results = await Promise.all(requests);

    // Each should complete without error
    for (const result of results) {
      expect(result.success).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST SUITE: ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════

describe('CodeGuard Error Handling', () => {
  beforeEach(async () => {
    resetDevelopmentAgents();
    resetMessageBus();
    resetConfigManager();
    await initializeDevelopmentAgents();
  });

  afterEach(async () => {
    await shutdownDevelopmentAgents();
    resetDevelopmentAgents();
    resetMessageBus();
  });

  it('should handle empty file list gracefully', async () => {
    const architect = getArchitectAgent();
    
    const event: FileChangeEvent = {
      files: [],
      changeType: 'modify',
      timestamp: Date.now(),
    };

    const result = await architect.onFileChange!(event);

    expect(result.passed).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it('should handle unknown message types gracefully', async () => {
    const bus = getMessageBus();
    
    const response = await bus.request('architect', {
      type: 'unknown-capability',
      payload: {},
    });

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });

  it('ReviewHooksManager should handle agent errors gracefully', async () => {
    const manager = getReviewHooksManager();
    await manager.initialize();

    // Even with potential errors, should return a combined result
    const result = await manager.handleFileChange({
      files: ['nonexistent/path.ts'],
      changeType: 'create',
      timestamp: Date.now(),
    });

    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('summary');
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST SUITE: VERSION AND METADATA
// ═══════════════════════════════════════════════════════════════════

describe('CodeGuard Version and Metadata', () => {
  beforeEach(() => {
    resetDevelopmentAgents();
  });

  afterEach(() => {
    resetDevelopmentAgents();
  });

  it('all agents should have version strings', () => {
    const agents = getDevelopmentAgents();

    expect(agents.architect.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(agents.stylist.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(agents.security.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(agents.accessibility.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(agents.data.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('all agents should have category set to development', () => {
    const agents = getDevelopmentAgents();

    expect(agents.architect.category).toBe('development');
    expect(agents.stylist.category).toBe('development');
    expect(agents.security.category).toBe('development');
    expect(agents.accessibility.category).toBe('development');
    expect(agents.data.category).toBe('development');
  });
});
