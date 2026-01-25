/**
 * Prompt Engine
 *
 * Enhanced template compilation with conditional and iteration support.
 * Part of Phase 3: LLM Prompt Centralization.
 *
 * Supports:
 * - {{variable}} - Simple variable replacement
 * - {{#if var}}...{{else}}...{{/if}} - Conditional blocks
 * - {{#each array}}{{this}}{{/each}} - Array iteration
 * - {{#unless var}}...{{/unless}} - Negated conditionals
 *
 * @module config/prompt-engine
 */

import type { PromptDefinition, CompiledPromptResult } from './prompt-types.js';

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE COMPILATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compile a prompt template with conditional and iteration support.
 *
 * @example
 * ```typescript
 * const template = `Hello {{name}}!
 * {{#if premium}}You have premium access.{{else}}Upgrade for more features.{{/if}}
 * {{#each items}}
 * - {{this}}
 * {{/each}}`;
 *
 * const result = compilePromptWithConditionals(template, {
 *   name: 'Alice',
 *   premium: true,
 *   items: ['Item 1', 'Item 2']
 * });
 * ```
 */
export function compilePromptWithConditionals(
  template: string,
  variables: Record<string, unknown>
): string {
  let result = template;

  // 1. Handle {{#each array}}...{{/each}} blocks
  result = processEachBlocks(result, variables);

  // 2. Handle {{#if var}}...{{else}}...{{/if}} blocks
  result = processIfBlocks(result, variables);

  // 3. Handle {{#unless var}}...{{/unless}} blocks
  result = processUnlessBlocks(result, variables);

  // 4. Handle simple {{variable}} replacements
  result = processSimpleVariables(result, variables);

  // 5. Clean up any remaining template artifacts
  result = cleanupTemplate(result);

  return result;
}

/**
 * Process {{#each array}}...{{/each}} blocks.
 * Supports {{this}} for current item and {{@index}} for index.
 */
function processEachBlocks(template: string, variables: Record<string, unknown>): string {
  // Pattern: {{#each varName}}content{{/each}}
  const eachPattern = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

  return template.replace(eachPattern, (_, varName: string, content: string) => {
    const array = variables[varName];

    if (!Array.isArray(array)) {
      // If not an array or undefined, return empty string
      return '';
    }

    return array
      .map((item, index) => {
        let itemContent = content;

        // Replace {{this}} with current item
        if (typeof item === 'object' && item !== null) {
          // For objects, allow {{this.property}} access
          itemContent = itemContent.replace(
            /\{\{this\.(\w+)\}\}/g,
            (_, prop: string) => String((item as Record<string, unknown>)[prop] ?? '')
          );
          // {{this}} for objects becomes JSON
          itemContent = itemContent.replace(/\{\{this\}\}/g, JSON.stringify(item));
        } else {
          // For primitives, {{this}} is the value
          itemContent = itemContent.replace(/\{\{this\}\}/g, String(item ?? ''));
        }

        // Replace {{@index}} with current index
        itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));

        return itemContent;
      })
      .join('');
  });
}

/**
 * Process {{#if var}}...{{else}}...{{/if}} blocks.
 * Truthy: non-empty strings, non-zero numbers, true, non-empty arrays/objects.
 */
function processIfBlocks(template: string, variables: Record<string, unknown>): string {
  // Pattern: {{#if varName}}ifContent{{else}}elseContent{{/if}}
  // or: {{#if varName}}ifContent{{/if}}
  const ifPattern = /\{\{#if\s+(\w+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

  return template.replace(ifPattern, (_, varName: string, ifBlock: string, elseBlock = '') => {
    const value = variables[varName];
    const isTruthy = evaluateTruthiness(value);

    return isTruthy ? ifBlock : elseBlock;
  });
}

/**
 * Process {{#unless var}}...{{/unless}} blocks (negated conditionals).
 */
function processUnlessBlocks(template: string, variables: Record<string, unknown>): string {
  const unlessPattern = /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g;

  return template.replace(unlessPattern, (_, varName: string, content: string) => {
    const value = variables[varName];
    const isTruthy = evaluateTruthiness(value);

    return isTruthy ? '' : content;
  });
}

/**
 * Process simple {{variable}} replacements.
 */
function processSimpleVariables(template: string, variables: Record<string, unknown>): string {
  // Match {{varName}} but not {{#...}} or {{/...}} or {{@...}} or {{this...}}
  const simplePattern = /\{\{(?!#|\/|@|this)(\w+(?:\.\w+)*)\}\}/g;

  return template.replace(simplePattern, (match, varPath: string) => {
    const value = getNestedValue(variables, varPath);

    if (value === undefined || value === null) {
      // Return empty string for missing variables (or could keep placeholder)
      return '';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  });
}

/**
 * Get a nested value from an object using dot notation.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Evaluate truthiness for conditional blocks.
 */
function evaluateTruthiness(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    return value.length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return Boolean(value);
}

/**
 * Clean up any remaining template artifacts.
 */
function cleanupTemplate(template: string): string {
  // Remove any unprocessed template tags (shouldn't happen, but safety)
  // Keep unknown tags as-is for debugging

  // Trim excessive whitespace from each line
  return template
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n'); // Collapse multiple blank lines
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract all variable names from a template.
 */
export function extractTemplateVariables(template: string): string[] {
  const variables = new Set<string>();

  // Simple variables: {{varName}}
  const simpleMatches = template.matchAll(/\{\{(?!#|\/|@|this|else)(\w+(?:\.\w+)*)\}\}/g);
  for (const match of simpleMatches) {
    variables.add(match[1].split('.')[0]); // Get root variable
  }

  // Conditional variables: {{#if varName}}, {{#unless varName}}
  const conditionalMatches = template.matchAll(/\{\{#(?:if|unless)\s+(\w+)\}\}/g);
  for (const match of conditionalMatches) {
    variables.add(match[1]);
  }

  // Each variables: {{#each varName}}
  const eachMatches = template.matchAll(/\{\{#each\s+(\w+)\}\}/g);
  for (const match of eachMatches) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Validate that all required variables are provided.
 */
export function validateTemplateVariables(
  template: string,
  variables: Record<string, unknown>,
  requiredVars?: string[]
): { valid: boolean; missing: string[]; extra: string[] } {
  const templateVars = extractTemplateVariables(template);
  const providedVars = Object.keys(variables);

  // Find missing variables
  const missing = templateVars.filter((v) => !(v in variables));

  // Find extra variables (provided but not in template)
  const extra = providedVars.filter((v) => !templateVars.includes(v));

  // Check required variables
  if (requiredVars) {
    for (const required of requiredVars) {
      if (!(required in variables) && !missing.includes(required)) {
        missing.push(required);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    extra,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT COMPILATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compile a PromptDefinition with variables.
 * Returns detailed result including warnings.
 */
export function compilePrompt(
  prompt: PromptDefinition,
  variables: Record<string, unknown>
): CompiledPromptResult {
  const templateVars = extractTemplateVariables(prompt.template);
  const providedVars = Object.keys(variables);

  const substitutedVars = templateVars.filter((v) => v in variables);
  const missingVars = templateVars.filter((v) => !(v in variables));
  const warnings: string[] = [];

  // Warn about missing variables
  if (missingVars.length > 0) {
    warnings.push(`Missing variables: ${missingVars.join(', ')}`);
  }

  // Warn about extra variables
  const extraVars = providedVars.filter((v) => !templateVars.includes(v));
  if (extraVars.length > 0) {
    warnings.push(`Unused variables: ${extraVars.join(', ')}`);
  }

  // Warn if prompt is deprecated
  if (prompt.deprecated) {
    warnings.push(`Prompt "${prompt.id}" is deprecated${prompt.replacedBy ? `. Use "${prompt.replacedBy}" instead.` : '.'}`);
  }

  const text = compilePromptWithConditionals(prompt.template, variables);

  return {
    text,
    substitutedVars,
    missingVars,
    warnings,
  };
}

/**
 * Simple compile - just returns the text.
 * Use when you don't need detailed results.
 */
export function compilePromptSimple(
  template: string,
  variables: Record<string, unknown>
): string {
  return compilePromptWithConditionals(template, variables);
}

// ═══════════════════════════════════════════════════════════════════════════
// ESCAPING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Escape special characters for use in prompts.
 * Useful when variable values might contain template syntax.
 */
export function escapeTemplateValue(value: string): string {
  return value
    .replace(/\{\{/g, '\\{\\{')
    .replace(/\}\}/g, '\\}\\}');
}

/**
 * Unescape template values.
 */
export function unescapeTemplateValue(value: string): string {
  return value
    .replace(/\\\{\\\{/g, '{{')
    .replace(/\\\}\\\}/g, '}}');
}
