/**
 * Category definitions and registry
 */

import type { CategoryDefinition, ToolCategory } from '../types';

/**
 * All tool categories with metadata
 */
export const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'analysis',
    name: 'Analysis',
    description: 'Examine content without modifying it',
    icon: '\ud83d\udd0d',
    order: 1,
  },
  {
    id: 'transformation',
    name: 'Transform',
    description: 'Modify content and create new versions',
    icon: '\u2728',
    order: 2,
  },
  {
    id: 'extraction',
    name: 'Extract',
    description: 'Create reusable assets from content',
    icon: '\ud83d\udce6',
    order: 3,
  },
  {
    id: 'generation',
    name: 'Generate',
    description: 'Create new content from parameters',
    icon: '\ud83c\udfad',
    order: 4,
  },
  {
    id: 'publishing',
    name: 'Publish',
    description: 'Prepare content for publishing',
    icon: '\ud83d\ude80',
    order: 5,
  },
];

/**
 * Get category definition by ID
 */
export function getCategory(id: ToolCategory): CategoryDefinition | undefined {
  return CATEGORIES.find((cat) => cat.id === id);
}

/**
 * Get categories sorted by order
 */
export function getCategoriesSorted(): CategoryDefinition[] {
  return [...CATEGORIES].sort((a, b) => a.order - b.order);
}

/**
 * Category lookup map for fast access
 */
export const CATEGORY_MAP = new Map<ToolCategory, CategoryDefinition>(
  CATEGORIES.map((cat) => [cat.id, cat])
);
