/**
 * AUI Persona & Style Handlers
 *
 * MCP handlers for persona harvest, style profiles, and persona management.
 *
 * @module @humanizer/core/mcp/handlers/aui/persona
 */

import type { MCPResult } from '../../types.js';
import { jsonResult, errorResult, getService } from './helpers.js';

// ═══════════════════════════════════════════════════════════════════════════
// PERSONA HARVEST HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handlePersonaStartHarvest(args: {
  sessionId: string;
  name: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.startPersonaHarvest(args.sessionId, { name: args.name });
    return jsonResult({
      harvestId: result.harvestId,
      status: result.status,
      message: `Persona harvest session started. Add samples with persona_add_sample or persona_harvest_archive.`,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handlePersonaAddSample(args: {
  harvestId: string;
  text: string;
  source?: 'user-provided' | 'archive';
  archiveNodeId?: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.addPersonaSample(args.harvestId, {
      text: args.text,
      source: args.source,
      archiveNodeId: args.archiveNodeId,
    });
    return jsonResult({
      totalSamples: result.totalSamples,
      message: `Sample added. Total samples: ${result.totalSamples}`,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handlePersonaHarvestArchive(args: {
  harvestId: string;
  query: string;
  minRelevance?: number;
  limit?: number;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.harvestFromArchive(args.harvestId, {
      query: args.query,
      minRelevance: args.minRelevance,
      limit: args.limit,
    });
    return jsonResult({
      samplesFound: result.samplesFound,
      totalSamples: result.totalSamples,
      message: `Found ${result.samplesFound} relevant samples from archive. Total samples: ${result.totalSamples}`,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handlePersonaExtractTraits(args: {
  harvestId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.extractPersonaTraits(args.harvestId);
    return jsonResult({
      voiceTraits: result.voiceTraits,
      toneMarkers: result.toneMarkers,
      voiceFingerprint: result.voiceFingerprint,
      suggestedStyles: result.suggestedStyles.map(s => ({
        name: s.name,
        description: s.description,
        formalityLevel: s.formalityLevel,
        useContractions: s.useContractions,
      })),
      confidence: result.confidence,
      message: `Extracted ${result.voiceTraits.length} voice traits. Suggested ${result.suggestedStyles.length} styles.`,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handlePersonaFinalize(args: {
  harvestId: string;
  voiceTraits?: string[];
  toneMarkers?: string[];
  formalityRange?: [number, number];
  styles?: Array<{
    name: string;
    forbiddenPhrases?: string[];
    preferredPatterns?: string[];
    useContractions?: boolean;
    useRhetoricalQuestions?: boolean;
    formalityLevel?: number;
    isDefault?: boolean;
  }>;
  setAsDefault?: boolean;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.finalizePersona(args.harvestId, {
      voiceTraits: args.voiceTraits,
      toneMarkers: args.toneMarkers,
      formalityRange: args.formalityRange,
      styles: args.styles,
      setAsDefault: args.setAsDefault,
    });
    return jsonResult({
      personaId: result.personaId,
      styleIds: result.styleIds,
      message: `Persona created with ${result.styleIds.length} styles.`,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Generate a sample in the persona's voice for preview.
 */
export async function handlePersonaGenerateSample(args: {
  harvestId: string;
  wordCount?: number;
  topic?: string;
}): Promise<MCPResult> {
  try {
    if (!args.harvestId) {
      return errorResult('harvestId is required');
    }

    const service = getService();

    const result = await service.generatePersonaSample(args.harvestId, {
      wordCount: args.wordCount,
      topic: args.topic,
    });

    return jsonResult({
      message: 'Sample generated. Review this content to see how your persona writes.',
      sample: result.sample,
      personaPreview: result.personaPreview,
      metrics: result.metrics,
      nextSteps: [
        'If satisfied, call persona_finalize to save the persona.',
        'If not satisfied, add more samples with persona_add_sample.',
      ],
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLE PROFILE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleStyleCreate(args: {
  personaId: string;
  name: string;
  description?: string;
  context?: string;
  forbiddenPhrases?: string[];
  preferredPatterns?: string[];
  sentenceVariety?: 'low' | 'medium' | 'high';
  paragraphStyle?: 'short' | 'medium' | 'long';
  useContractions?: boolean;
  useRhetoricalQuestions?: boolean;
  formalityLevel?: number;
  isDefault?: boolean;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const style = await service.createStyleProfile({
      personaId: args.personaId,
      name: args.name,
      description: args.description,
      context: args.context,
      forbiddenPhrases: args.forbiddenPhrases,
      preferredPatterns: args.preferredPatterns,
      sentenceVariety: args.sentenceVariety,
      paragraphStyle: args.paragraphStyle,
      useContractions: args.useContractions,
      useRhetoricalQuestions: args.useRhetoricalQuestions,
      formalityLevel: args.formalityLevel,
      isDefault: args.isDefault,
    });
    return jsonResult({
      id: style.id,
      name: style.name,
      personaId: style.personaId,
      isDefault: style.isDefault,
      message: `Style "${style.name}" created.`,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleStyleList(args: {
  personaId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const styles = await service.listStyleProfiles(args.personaId);
    return jsonResult({
      styles: styles.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        context: s.context,
        formalityLevel: s.formalityLevel,
        useContractions: s.useContractions,
        isDefault: s.isDefault,
        forbiddenPhrasesCount: s.forbiddenPhrases.length,
      })),
      count: styles.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleStyleGet(args: {
  styleId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const style = await service.getStyleProfile(args.styleId);
    if (!style) {
      return errorResult(`Style "${args.styleId}" not found`);
    }
    return jsonResult(style);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleStyleUpdate(args: {
  styleId: string;
  name?: string;
  description?: string;
  context?: string;
  forbiddenPhrases?: string[];
  preferredPatterns?: string[];
  sentenceVariety?: 'low' | 'medium' | 'high';
  paragraphStyle?: 'short' | 'medium' | 'long';
  useContractions?: boolean;
  useRhetoricalQuestions?: boolean;
  formalityLevel?: number;
  isDefault?: boolean;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const style = await service.updateStyleProfile(args.styleId, {
      name: args.name,
      description: args.description,
      context: args.context,
      forbiddenPhrases: args.forbiddenPhrases,
      preferredPatterns: args.preferredPatterns,
      sentenceVariety: args.sentenceVariety,
      paragraphStyle: args.paragraphStyle,
      useContractions: args.useContractions,
      useRhetoricalQuestions: args.useRhetoricalQuestions,
      formalityLevel: args.formalityLevel,
      isDefault: args.isDefault,
    });
    if (!style) {
      return errorResult(`Style "${args.styleId}" not found`);
    }
    return jsonResult({
      id: style.id,
      name: style.name,
      message: `Style "${style.name}" updated.`,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleStyleDelete(args: {
  styleId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const deleted = await service.deleteStyleProfile(args.styleId);
    return jsonResult({
      success: deleted,
      message: deleted ? 'Style deleted.' : 'Style not found.',
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PERSONA PROFILE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handlePersonaList(args: {
  userId?: string;
  limit?: number;
  offset?: number;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const personas = await service.listPersonaProfiles({
      userId: args.userId,
      limit: args.limit,
      offset: args.offset,
    });
    return jsonResult({
      personas: personas.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        voiceTraits: p.voiceTraits,
        toneMarkers: p.toneMarkers,
        isDefault: p.isDefault,
      })),
      count: personas.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handlePersonaGet(args: {
  personaId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const persona = await service.getPersonaProfile(args.personaId);
    if (!persona) {
      return errorResult(`Persona "${args.personaId}" not found`);
    }
    return jsonResult(persona);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handlePersonaGetDefault(args: {
  userId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const persona = await service.getDefaultPersonaProfile(args.userId);
    if (!persona) {
      return jsonResult({
        message: 'No default persona set for this user.',
      });
    }
    return jsonResult(persona);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Set a persona as the default for a user.
 */
export async function handlePersonaSetDefault(args: {
  userId: string;
  personaId: string;
}): Promise<MCPResult> {
  try {
    if (!args.userId) {
      return errorResult('userId is required');
    }
    if (!args.personaId) {
      return errorResult('personaId is required');
    }

    const service = getService();
    const persona = await service.setDefaultPersona(args.userId, args.personaId);

    return jsonResult({
      message: `Persona "${persona.name}" set as default for user.`,
      persona,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}
