/**
 * Tool Name Configuration
 * Centralized mapping of transformation tool types to display names
 */

export const TOOL_TYPES = {
  COMPUTER_HUMANIZER: 'computer-humanizer',
  PERSONA: 'persona',
  STYLE: 'style',
  ROUND_TRIP: 'round-trip',
  AI_DETECTION: 'ai-detection',
  AI_DETECTION_LITE: 'ai-detection-lite'
} as const;

export type ToolType = typeof TOOL_TYPES[keyof typeof TOOL_TYPES];

/**
 * Base display names for tools (without parameters)
 */
export const TOOL_DISPLAY_NAMES = {
  [TOOL_TYPES.COMPUTER_HUMANIZER]: 'Computer Humanizer',
  [TOOL_TYPES.PERSONA]: 'Persona',
  [TOOL_TYPES.STYLE]: 'Style',
  [TOOL_TYPES.ROUND_TRIP]: 'Round-Trip',
  [TOOL_TYPES.AI_DETECTION]: 'AI Detection',
  [TOOL_TYPES.AI_DETECTION_LITE]: 'AI Detection (Lite)'
} as const;

/**
 * Configuration interface for tool parameters
 */
export interface ToolConfig {
  type: string;
  persona?: string;
  styleId?: string;
  intermediateLanguage?: string;
  [key: string]: any;
}

/**
 * Format tool name with parameters for display in BufferTabs
 *
 * Examples:
 * - 'computer-humanizer' → 'Computer Humanizer'
 * - 'persona' + {persona: 'Austen'} → 'Persona (Austen)'
 * - 'style' + {styleId: 'academic'} → 'Style (academic)'
 * - 'round-trip' + {intermediateLanguage: 'spanish'} → 'Round-Trip (spanish)'
 *
 * @param type - Tool type identifier
 * @param config - Tool configuration with parameters
 * @returns Formatted display name
 */
export function formatToolName(type: string, config?: ToolConfig | Record<string, any>): string {
  switch (type) {
    case TOOL_TYPES.COMPUTER_HUMANIZER:
      return TOOL_DISPLAY_NAMES[TOOL_TYPES.COMPUTER_HUMANIZER];

    case TOOL_TYPES.PERSONA:
      return config?.persona
        ? `${TOOL_DISPLAY_NAMES[TOOL_TYPES.PERSONA]} (${config.persona})`
        : TOOL_DISPLAY_NAMES[TOOL_TYPES.PERSONA];

    case TOOL_TYPES.STYLE:
      return config?.styleId
        ? `${TOOL_DISPLAY_NAMES[TOOL_TYPES.STYLE]} (${config.styleId})`
        : TOOL_DISPLAY_NAMES[TOOL_TYPES.STYLE];

    case TOOL_TYPES.ROUND_TRIP:
      return config?.intermediateLanguage
        ? `${TOOL_DISPLAY_NAMES[TOOL_TYPES.ROUND_TRIP]} (${config.intermediateLanguage})`
        : TOOL_DISPLAY_NAMES[TOOL_TYPES.ROUND_TRIP];

    case TOOL_TYPES.AI_DETECTION:
      return TOOL_DISPLAY_NAMES[TOOL_TYPES.AI_DETECTION];

    case TOOL_TYPES.AI_DETECTION_LITE:
      return TOOL_DISPLAY_NAMES[TOOL_TYPES.AI_DETECTION_LITE];

    default:
      // Fallback: return type as-is for unknown tools
      return type;
  }
}

/**
 * Get tool type from config object
 */
export function getToolType(config: ToolConfig): string {
  return config.type;
}

/**
 * Check if tool is an analysis tool (vs transformation)
 */
export function isAnalysisTool(type: string): boolean {
  return type === TOOL_TYPES.AI_DETECTION || type === TOOL_TYPES.AI_DETECTION_LITE;
}

/**
 * Check if tool is a transformation tool
 */
export function isTransformationTool(type: string): boolean {
  return [
    TOOL_TYPES.COMPUTER_HUMANIZER,
    TOOL_TYPES.PERSONA,
    TOOL_TYPES.STYLE,
    TOOL_TYPES.ROUND_TRIP
  ].includes(type as ToolType);
}
