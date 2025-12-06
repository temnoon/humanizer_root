/**
 * Tool registry - central registry for all tools
 */

import type {
  ToolDefinition,
  ToolCategory,
  InterfaceId,
  UserTier,
} from '../types';

/**
 * Internal tool storage
 */
const tools = new Map<string, ToolDefinition>();

/**
 * Register a tool in the registry
 */
export function registerTool(tool: ToolDefinition): void {
  if (tools.has(tool.id)) {
    console.warn(`Tool "${tool.id}" is already registered. Overwriting.`);
  }
  tools.set(tool.id, tool);
}

/**
 * Register multiple tools at once
 */
export function registerTools(toolList: ToolDefinition[]): void {
  for (const tool of toolList) {
    registerTool(tool);
  }
}

/**
 * Get a tool by ID
 */
export function getTool(id: string): ToolDefinition | undefined {
  return tools.get(id);
}

/**
 * Get all registered tools
 */
export function getAllTools(): ToolDefinition[] {
  return Array.from(tools.values());
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return getAllTools().filter((tool) => tool.category === category);
}

/**
 * Get tools available in a specific interface
 */
export function getToolsForInterface(interfaceId: InterfaceId): ToolDefinition[] {
  return getAllTools().filter(
    (tool) =>
      tool.availableIn.includes('all') || tool.availableIn.includes(interfaceId)
  );
}

/**
 * Get tools available for a user tier
 */
export function getToolsForTier(tier: UserTier): ToolDefinition[] {
  const tierOrder: UserTier[] = ['free', 'pro', 'premium', 'admin'];
  const userTierIndex = tierOrder.indexOf(tier);

  return getAllTools().filter((tool) => {
    const toolTierIndex = tierOrder.indexOf(tool.tier);
    return toolTierIndex <= userTierIndex;
  });
}

/**
 * Filter options for tool queries
 */
export interface ToolFilterOptions {
  category?: ToolCategory;
  interfaceId?: InterfaceId;
  userTier?: UserTier;
  excludeIds?: string[];
}

/**
 * Get tools with multiple filters applied
 */
export function getFilteredTools(options: ToolFilterOptions): ToolDefinition[] {
  let result = getAllTools();

  if (options.category) {
    result = result.filter((tool) => tool.category === options.category);
  }

  if (options.interfaceId) {
    result = result.filter(
      (tool) =>
        tool.availableIn.includes('all') ||
        tool.availableIn.includes(options.interfaceId!)
    );
  }

  if (options.userTier) {
    const tierOrder: UserTier[] = ['free', 'pro', 'premium', 'admin'];
    const userTierIndex = tierOrder.indexOf(options.userTier);
    result = result.filter((tool) => {
      const toolTierIndex = tierOrder.indexOf(tool.tier);
      return toolTierIndex <= userTierIndex;
    });
  }

  if (options.excludeIds?.length) {
    result = result.filter((tool) => !options.excludeIds!.includes(tool.id));
  }

  return result;
}

/**
 * Check if a tool is available for a user
 */
export function isToolAvailable(
  toolId: string,
  interfaceId: InterfaceId,
  userTier: UserTier
): boolean {
  const tool = getTool(toolId);
  if (!tool) return false;

  // Check interface
  const interfaceOk =
    tool.availableIn.includes('all') || tool.availableIn.includes(interfaceId);
  if (!interfaceOk) return false;

  // Check tier
  const tierOrder: UserTier[] = ['free', 'pro', 'premium', 'admin'];
  const userTierIndex = tierOrder.indexOf(userTier);
  const toolTierIndex = tierOrder.indexOf(tool.tier);

  return toolTierIndex <= userTierIndex;
}

/**
 * Get reason why a tool is unavailable
 */
export function getUnavailableReason(
  toolId: string,
  interfaceId: InterfaceId,
  userTier: UserTier
): string | null {
  const tool = getTool(toolId);
  if (!tool) return 'Tool not found';

  // Check interface
  const interfaceOk =
    tool.availableIn.includes('all') || tool.availableIn.includes(interfaceId);
  if (!interfaceOk) {
    return `Only available in: ${tool.availableIn.join(', ')}`;
  }

  // Check tier
  const tierOrder: UserTier[] = ['free', 'pro', 'premium', 'admin'];
  const userTierIndex = tierOrder.indexOf(userTier);
  const toolTierIndex = tierOrder.indexOf(tool.tier);

  if (toolTierIndex > userTierIndex) {
    return `Requires ${tool.tier} subscription`;
  }

  return null;
}

/**
 * Clear all registered tools (useful for testing)
 */
export function clearRegistry(): void {
  tools.clear();
}
