/**
 * Pattern Detectors
 *
 * Shared utilities for detecting code patterns, anti-patterns,
 * and structural characteristics across all development agents.
 */

import type { DetectedPattern, AntiPattern, Severity } from '../types.js';

// ═══════════════════════════════════════════════════════════════════
// DESIGN PATTERN DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Pattern signature for detection
 */
interface PatternSignature {
  name: string;
  type: 'creational' | 'structural' | 'behavioral' | 'architectural';
  indicators: RegExp[];
  minMatches: number;
  description: string;
}

/**
 * Common design pattern signatures
 */
export const PATTERN_SIGNATURES: PatternSignature[] = [
  // Creational Patterns
  {
    name: 'Singleton',
    type: 'creational',
    indicators: [
      /private\s+static\s+(?:readonly\s+)?_?instance/i,
      /static\s+getInstance\s*\(/,
      /private\s+constructor\s*\(/,
    ],
    minMatches: 2,
    description: 'Ensures a class has only one instance',
  },
  {
    name: 'Factory Method',
    type: 'creational',
    indicators: [
      /create\w+\s*\(/,
      /make\w+\s*\(/,
      /build\w+\s*\(/,
      /interface\s+\w*Factory/,
    ],
    minMatches: 1,
    description: 'Creates objects without specifying exact class',
  },
  {
    name: 'Builder',
    type: 'creational',
    indicators: [
      /\.with\w+\s*\(/,
      /\.set\w+\s*\(/,
      /\.build\s*\(\s*\)/,
      /class\s+\w*Builder/,
    ],
    minMatches: 2,
    description: 'Constructs complex objects step by step',
  },

  // Structural Patterns
  {
    name: 'Adapter',
    type: 'structural',
    indicators: [
      /class\s+\w*Adapter/,
      /implements\s+\w+.*\{[\s\S]*?private\s+(?:readonly\s+)?\w+:/,
      /adapt\w*\s*\(/,
    ],
    minMatches: 1,
    description: 'Allows incompatible interfaces to work together',
  },
  {
    name: 'Decorator',
    type: 'structural',
    indicators: [
      /@\w+\s*\(/,
      /class\s+\w*Decorator/,
      /extends\s+\w+\s*\{[\s\S]*?super\./,
    ],
    minMatches: 1,
    description: 'Adds behavior to objects dynamically',
  },
  {
    name: 'Facade',
    type: 'structural',
    indicators: [
      /class\s+\w*Facade/,
      /class\s+\w*Service\s*\{[\s\S]*?private\s+(?:readonly\s+)?\w+:[\s\S]*?private\s+(?:readonly\s+)?\w+:/,
    ],
    minMatches: 1,
    description: 'Provides simplified interface to complex subsystem',
  },

  // Behavioral Patterns
  {
    name: 'Observer',
    type: 'behavioral',
    indicators: [
      /subscribe\s*\(/,
      /unsubscribe\s*\(/,
      /notify\w*\s*\(/,
      /on\w+\s*\(/,
      /emit\s*\(/,
      /addEventListener/,
    ],
    minMatches: 2,
    description: 'Defines one-to-many dependency between objects',
  },
  {
    name: 'Strategy',
    type: 'behavioral',
    indicators: [
      /interface\s+\w*Strategy/,
      /set\w*Strategy\s*\(/,
      /execute\s*\(\s*\)/,
    ],
    minMatches: 2,
    description: 'Defines family of interchangeable algorithms',
  },
  {
    name: 'Command',
    type: 'behavioral',
    indicators: [
      /interface\s+\w*Command/,
      /execute\s*\(\s*\)/,
      /undo\s*\(\s*\)/,
    ],
    minMatches: 2,
    description: 'Encapsulates request as an object',
  },

  // Architectural Patterns
  {
    name: 'Repository',
    type: 'architectural',
    indicators: [
      /class\s+\w*Repository/,
      /findById\s*\(/,
      /findAll\s*\(/,
      /save\s*\(/,
      /delete\s*\(/,
    ],
    minMatches: 3,
    description: 'Mediates between domain and data mapping layers',
  },
  {
    name: 'Service Layer',
    type: 'architectural',
    indicators: [
      /class\s+\w*Service/,
      /interface\s+I\w*Service/,
      /@Injectable/,
    ],
    minMatches: 1,
    description: 'Defines application boundary with services',
  },
  {
    name: 'MVC/MVP/MVVM',
    type: 'architectural',
    indicators: [
      /class\s+\w*Controller/,
      /class\s+\w*Presenter/,
      /class\s+\w*ViewModel/,
      /class\s+\w*Model/,
      /class\s+\w*View/,
    ],
    minMatches: 2,
    description: 'Separates concerns in UI architecture',
  },
];

/**
 * Detect design patterns in code
 */
export function detectPatterns(
  content: string,
  filePath: string
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  for (const signature of PATTERN_SIGNATURES) {
    const matches = signature.indicators.filter(regex => regex.test(content));

    if (matches.length >= signature.minMatches) {
      patterns.push({
        name: signature.name,
        type: signature.type,
        confidence: Math.min(1, matches.length / signature.indicators.length),
        location: [filePath],
        description: signature.description,
        isCorrectlyImplemented: true, // Default, can be verified with deeper analysis
      });
    }
  }

  return patterns;
}

// ═══════════════════════════════════════════════════════════════════
// ANTI-PATTERN DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Anti-pattern signature
 */
interface AntiPatternSignature {
  name: string;
  severity: Severity;
  indicators: RegExp[];
  minMatches: number;
  description: string;
  impact: string;
  suggestion: string;
  refactoringEffort: 'trivial' | 'small' | 'medium' | 'large';
}

/**
 * Common anti-pattern signatures
 */
export const ANTI_PATTERN_SIGNATURES: AntiPatternSignature[] = [
  {
    name: 'God Object',
    severity: 'error',
    indicators: [
      // Class with many methods
      /class\s+\w+\s*\{[\s\S]{3000,}\}/,
    ],
    minMatches: 1,
    description: 'Class that knows or does too much',
    impact: 'Hard to maintain, test, and understand',
    suggestion: 'Split into smaller, focused classes following Single Responsibility Principle',
    refactoringEffort: 'large',
  },
  {
    name: 'Spaghetti Code',
    severity: 'warning',
    indicators: [
      // Deeply nested conditionals
      /if\s*\([^)]+\)\s*\{[\s\S]*?if\s*\([^)]+\)\s*\{[\s\S]*?if\s*\([^)]+\)\s*\{/,
      // Many goto-like patterns
      /continue\s*;[\s\S]*?continue\s*;[\s\S]*?continue\s*;/,
    ],
    minMatches: 1,
    description: 'Code with complex control flow',
    impact: 'Difficult to follow, debug, and modify',
    suggestion: 'Extract methods, use early returns, apply guard clauses',
    refactoringEffort: 'medium',
  },
  {
    name: 'Feature Envy',
    severity: 'warning',
    indicators: [
      // Method accessing other object's data excessively
      /(\w+)\.\w+[\s\S]{0,50}\1\.\w+[\s\S]{0,50}\1\.\w+[\s\S]{0,50}\1\.\w+/,
    ],
    minMatches: 1,
    description: 'Method uses more features from other class than its own',
    impact: 'Poor encapsulation and high coupling',
    suggestion: 'Move method to the class it envies',
    refactoringEffort: 'small',
  },
  {
    name: 'Primitive Obsession',
    severity: 'info',
    indicators: [
      // Functions with many primitive parameters
      /function\s+\w+\s*\([^)]*,\s*[^)]*,\s*[^)]*,\s*[^)]*,\s*[^)]*\)/,
      // Type definitions with only primitives
      /interface\s+\w+\s*\{[\s\S]*?:\s*(?:string|number|boolean);[\s\S]*?:\s*(?:string|number|boolean);[\s\S]*?:\s*(?:string|number|boolean);[\s\S]*?\}/,
    ],
    minMatches: 1,
    description: 'Overuse of primitives instead of small objects',
    impact: 'Code duplication and scattered validation',
    suggestion: 'Create value objects for related primitives',
    refactoringEffort: 'small',
  },
  {
    name: 'Copy-Paste Programming',
    severity: 'warning',
    indicators: [
      // Duplicate blocks (simplified detection)
      /(\{[^{}]{50,}\})[\s\S]*?\1/,
    ],
    minMatches: 1,
    description: 'Duplicated code blocks',
    impact: 'Bugs must be fixed multiple times, hard to maintain',
    suggestion: 'Extract common code into reusable functions',
    refactoringEffort: 'small',
  },
  {
    name: 'Magic Numbers',
    severity: 'warning',
    indicators: [
      // Numbers in conditions/calculations (not 0, 1, -1)
      /[=<>]\s*[2-9]\d*(?!\.\d)/,
      /[=<>]\s*\d{2,}(?!\.\d)/,
    ],
    minMatches: 2,
    description: 'Unexplained numeric literals in code',
    impact: 'Hard to understand and maintain',
    suggestion: 'Replace with named constants',
    refactoringEffort: 'trivial',
  },
  {
    name: 'Long Method',
    severity: 'warning',
    indicators: [
      // Method body over 50 lines (simplified)
      /(?:function|async function|\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*)\{[^{}]*(?:\{[^{}]*\}[^{}]*){10,}\}/,
    ],
    minMatches: 1,
    description: 'Method with too many lines',
    impact: 'Hard to understand and test',
    suggestion: 'Extract smaller methods with clear names',
    refactoringEffort: 'medium',
  },
  {
    name: 'Callback Hell',
    severity: 'warning',
    indicators: [
      // Nested callbacks
      /\(\s*(?:err|error)?\s*\)\s*=>\s*\{[\s\S]*?\(\s*(?:err|error)?\s*\)\s*=>\s*\{[\s\S]*?\(\s*(?:err|error)?\s*\)\s*=>\s*\{/,
      /function\s*\([^)]*\)\s*\{[\s\S]*?function\s*\([^)]*\)\s*\{[\s\S]*?function\s*\([^)]*\)\s*\{/,
    ],
    minMatches: 1,
    description: 'Deeply nested callbacks',
    impact: 'Hard to read, maintain, and handle errors',
    suggestion: 'Use async/await or Promise chains',
    refactoringEffort: 'medium',
  },
  {
    name: 'Global State',
    severity: 'error',
    indicators: [
      /(?:var|let)\s+\w+\s*=[\s\S]*?(?:window|global)\./,
      /(?:window|global)\.\w+\s*=/,
    ],
    minMatches: 1,
    description: 'Reliance on global mutable state',
    impact: 'Unpredictable behavior, hard to test',
    suggestion: 'Use dependency injection or context',
    refactoringEffort: 'large',
  },
];

/**
 * Detect anti-patterns in code
 */
export function detectAntiPatterns(
  content: string,
  filePath: string
): AntiPattern[] {
  const antiPatterns: AntiPattern[] = [];

  for (const signature of ANTI_PATTERN_SIGNATURES) {
    const matches = signature.indicators.filter(regex => regex.test(content));

    if (matches.length >= signature.minMatches) {
      antiPatterns.push({
        name: signature.name,
        severity: signature.severity,
        description: signature.description,
        locations: [filePath],
        impact: signature.impact,
        suggestion: signature.suggestion,
        refactoringEffort: signature.refactoringEffort,
      });
    }
  }

  return antiPatterns;
}

// ═══════════════════════════════════════════════════════════════════
// COMPLEXITY ANALYSIS
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate cyclomatic complexity (simplified)
 */
export function calculateCyclomaticComplexity(content: string): number {
  // Count decision points
  const decisionPoints = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /\?\s*[^:]+\s*:/g, // Ternary
    /&&/g,
    /\|\|/g,
    /\?\?/g, // Nullish coalescing
  ];

  let complexity = 1; // Base complexity

  for (const pattern of decisionPoints) {
    const matches = content.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

/**
 * Calculate cognitive complexity (simplified)
 * Measures how hard code is to understand
 */
export function calculateCognitiveComplexity(content: string): number {
  let complexity = 0;
  let nestingLevel = 0;

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Increase for control structures
    if (/^(?:if|else\s+if|for|while|switch|try)\s*\(/.test(trimmed)) {
      complexity += 1 + nestingLevel;
      nestingLevel++;
    }
    // Else adds complexity but not nesting
    else if (/^else\s*\{/.test(trimmed)) {
      complexity += 1;
    }
    // Catch adds complexity
    else if (/^catch\s*\(/.test(trimmed)) {
      complexity += 1;
    }
    // Logical operators
    if (/&&|\|\|/.test(trimmed)) {
      complexity += (trimmed.match(/&&|\|\|/g) || []).length;
    }

    // Track nesting
    const opens = (trimmed.match(/\{/g) || []).length;
    const closes = (trimmed.match(/\}/g) || []).length;

    // Decrease nesting for closing braces of control structures
    if (closes > opens && nestingLevel > 0) {
      nestingLevel = Math.max(0, nestingLevel - (closes - opens));
    }
  }

  return complexity;
}

// ═══════════════════════════════════════════════════════════════════
// COUPLING ANALYSIS
// ═══════════════════════════════════════════════════════════════════

/**
 * Analyze coupling between files
 */
export function analyzeCoupling(
  files: Array<{ path: string; imports: string[] }>
): {
  afferent: Record<string, number>;
  efferent: Record<string, number>;
  instability: Record<string, number>;
} {
  const afferent: Record<string, number> = {};
  const efferent: Record<string, number> = {};

  // Initialize
  for (const file of files) {
    afferent[file.path] = 0;
    efferent[file.path] = file.imports.length;
  }

  // Count afferent coupling (who imports this file)
  for (const file of files) {
    for (const imp of file.imports) {
      // Normalize import path
      const normalizedImport = imp.replace(/^\.\//, '').replace(/\.\w+$/, '');

      for (const targetFile of files) {
        if (targetFile.path.includes(normalizedImport)) {
          afferent[targetFile.path] = (afferent[targetFile.path] || 0) + 1;
        }
      }
    }
  }

  // Calculate instability
  const instability: Record<string, number> = {};
  for (const file of files) {
    const ce = efferent[file.path] || 0;
    const ca = afferent[file.path] || 0;
    instability[file.path] = ca + ce > 0 ? ce / (ca + ce) : 0;
  }

  return { afferent, efferent, instability };
}

/**
 * Detect circular dependencies
 */
export function detectCircularDependencies(
  files: Array<{ path: string; imports: string[] }>
): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(path: string, pathSet: Set<string>) {
    if (pathSet.has(path)) {
      // Found cycle - extract it from stack
      const cycleStart = stack.indexOf(path);
      if (cycleStart !== -1) {
        cycles.push([...stack.slice(cycleStart), path]);
      }
      return;
    }

    if (visited.has(path)) return;
    visited.add(path);
    pathSet.add(path);
    stack.push(path);

    const file = files.find(f => f.path === path);
    if (file) {
      for (const imp of file.imports) {
        const target = files.find(f => f.path.includes(imp.replace(/^\.\//, '')));
        if (target) {
          dfs(target.path, new Set(pathSet));
        }
      }
    }

    stack.pop();
    pathSet.delete(path);
  }

  for (const file of files) {
    dfs(file.path, new Set());
  }

  return cycles;
}
