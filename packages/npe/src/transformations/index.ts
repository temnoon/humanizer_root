/**
 * Transformations Module
 *
 * Persona, style, and namespace transformations.
 */

export { TransformerService } from './transformer.js';

export type {
  TransformOptions,
  TransformResult,
  PersonaDefinition,
  StyleDefinition,
  NamespaceDefinition,
} from './types.js';

export {
  BUILTIN_PERSONAS,
  BUILTIN_STYLES,
  BUILTIN_NAMESPACES,
} from './types.js';

export {
  sanitizeOutput,
} from './prompts.js';
