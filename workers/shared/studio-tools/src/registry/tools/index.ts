/**
 * Tool definitions exports
 */

// AI Detection tools
export { aiDetectionLiteTool, aiDetectionGPTZeroTool } from './ai-detection';

// Humanizer tool
export { humanizerTool } from './humanizer';

// Translation tools
export { translationTool, roundTripTool } from './translation';

// Local tools (narrative-studio only)
export { quantumReadingTool } from './quantum-reading';
export { voiceDiscoveryTool } from './voice-discovery';

import type { ToolDefinition } from '../../types';
import { aiDetectionLiteTool, aiDetectionGPTZeroTool } from './ai-detection';
import { humanizerTool } from './humanizer';
import { translationTool, roundTripTool } from './translation';
import { quantumReadingTool } from './quantum-reading';
import { voiceDiscoveryTool } from './voice-discovery';

/**
 * All core tools bundled together
 */
export const CORE_TOOLS: ToolDefinition[] = [
  // Analysis
  aiDetectionLiteTool,
  aiDetectionGPTZeroTool,
  roundTripTool,

  // Transformation
  humanizerTool,
  translationTool,

  // Local tools (narrative-studio)
  quantumReadingTool,
  voiceDiscoveryTool,
];
