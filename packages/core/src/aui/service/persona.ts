/**
 * Unified AUI Service - Persona Methods
 *
 * Persona harvest, style profile, and persona profile operations.
 *
 * @module @humanizer/core/aui/service/persona
 */

import { randomUUID } from 'crypto';
import type {
  PersonaProfile,
  StyleProfile,
  CreatePersonaProfileOptions,
  CreateStyleProfileOptions,
} from '../../storage/aui-postgres-store.js';
import { getVoiceAnalyzer } from '../voice-analyzer.js';
import { getBuilderAgent, type PersonaProfileForRewrite } from '../../houses/builder.js';
import type {
  PersonaHarvestSession,
  StartHarvestResult,
  ExtractTraitsResult,
  FinalizePersonaResult,
  ServiceDependencies,
} from './types.js';
import type { BookMethods } from './books.js';
import type { SessionMethods } from './service-core.js';

// ═══════════════════════════════════════════════════════════════════════════
// PERSONA HARVEST METHODS
// ═══════════════════════════════════════════════════════════════════════════

export interface PersonaHarvestMethods {
  startPersonaHarvest(sessionId: string, options: { name: string }): Promise<StartHarvestResult>;
  addPersonaSample(
    harvestId: string,
    options: { text: string; source?: 'user-provided' | 'archive'; archiveNodeId?: string }
  ): Promise<{ totalSamples: number }>;
  harvestFromArchive(
    harvestId: string,
    options: { query: string; minRelevance?: number; limit?: number }
  ): Promise<{ samplesFound: number; totalSamples: number }>;
  extractPersonaTraits(harvestId: string): Promise<ExtractTraitsResult>;
  finalizePersona(
    harvestId: string,
    options: {
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
    }
  ): Promise<FinalizePersonaResult>;
  getHarvestSession(harvestId: string): PersonaHarvestSession | undefined;
  generatePersonaSample(
    harvestId: string,
    options?: { wordCount?: number; topic?: string }
  ): Promise<{
    sample: string;
    personaPreview: {
      name: string;
      voiceTraits: string[];
      toneMarkers: string[];
    };
    metrics: {
      forbiddenPhrasesRemoved: number;
      preferredPatternsUsed: number;
      passCount: number;
    };
  }>;
}

export function createPersonaHarvestMethods(
  deps: ServiceDependencies,
  sessionMethods: SessionMethods,
  bookMethods: BookMethods
): PersonaHarvestMethods {
  return {
    async startPersonaHarvest(
      sessionId: string,
      options: { name: string }
    ): Promise<StartHarvestResult> {
      const harvestId = randomUUID();
      const now = new Date();

      const harvestSession: PersonaHarvestSession = {
        harvestId,
        sessionId,
        name: options.name,
        status: 'collecting',
        samples: [],
        createdAt: now,
        updatedAt: now,
      };

      deps.getHarvestSessions().set(harvestId, harvestSession);

      return {
        harvestId,
        status: 'collecting',
      };
    },

    async addPersonaSample(
      harvestId: string,
      options: { text: string; source?: 'user-provided' | 'archive'; archiveNodeId?: string }
    ): Promise<{ totalSamples: number }> {
      const harvest = deps.getHarvestSessions().get(harvestId);
      if (!harvest) {
        throw new Error(`Harvest session "${harvestId}" not found`);
      }

      if (harvest.status !== 'collecting') {
        throw new Error(
          `Harvest session is in "${harvest.status}" status, cannot add samples`
        );
      }

      harvest.samples.push({
        text: options.text,
        source: options.source ?? 'user-provided',
        archiveNodeId: options.archiveNodeId,
        addedAt: new Date(),
      });
      harvest.updatedAt = new Date();

      return { totalSamples: harvest.samples.length };
    },

    async harvestFromArchive(
      harvestId: string,
      options: { query: string; minRelevance?: number; limit?: number }
    ): Promise<{ samplesFound: number; totalSamples: number }> {
      const harvest = deps.getHarvestSessions().get(harvestId);
      if (!harvest) {
        throw new Error(`Harvest session "${harvestId}" not found`);
      }

      if (harvest.status !== 'collecting') {
        throw new Error(
          `Harvest session is in "${harvest.status}" status, cannot add samples`
        );
      }

      const harvestResult = await bookMethods.harvest({
        query: options.query,
        minRelevance: options.minRelevance ?? 0.6,
        limit: options.limit ?? 20,
      });

      let samplesFound = 0;
      for (const passage of harvestResult.passages) {
        if (harvest.samples.some(s => s.archiveNodeId === passage.id)) {
          continue;
        }

        if (passage.authorRole === 'user' || !passage.authorRole) {
          harvest.samples.push({
            text: passage.text,
            source: 'archive',
            archiveNodeId: passage.id,
            addedAt: new Date(),
          });
          samplesFound++;
        }
      }

      harvest.updatedAt = new Date();

      return {
        samplesFound,
        totalSamples: harvest.samples.length,
      };
    },

    async extractPersonaTraits(harvestId: string): Promise<ExtractTraitsResult> {
      const harvest = deps.getHarvestSessions().get(harvestId);
      if (!harvest) {
        throw new Error(`Harvest session "${harvestId}" not found`);
      }

      if (harvest.samples.length === 0) {
        throw new Error('No samples collected. Add samples before extracting traits.');
      }

      harvest.status = 'analyzing';
      harvest.updatedAt = new Date();

      const voiceAnalyzer = getVoiceAnalyzer();
      const sampleTexts = harvest.samples.map(s => s.text);
      const analysis = voiceAnalyzer.analyze(sampleTexts);

      harvest.analysis = analysis;
      harvest.updatedAt = new Date();

      return {
        voiceTraits: analysis.proposedTraits.voiceTraits,
        toneMarkers: analysis.proposedTraits.toneMarkers,
        voiceFingerprint: analysis.fingerprint,
        suggestedStyles: analysis.suggestedStyles,
        confidence: analysis.proposedTraits.confidence,
      };
    },

    async finalizePersona(
      harvestId: string,
      options: {
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
      }
    ): Promise<FinalizePersonaResult> {
      const harvest = deps.getHarvestSessions().get(harvestId);
      if (!harvest) {
        throw new Error(`Harvest session "${harvestId}" not found`);
      }

      const store = deps.getStore();
      if (!store) {
        throw new Error('Persistent store not configured - cannot save persona');
      }

      const session = await sessionMethods.getSessionAsync(harvest.sessionId);
      const userId = session?.userId;

      harvest.status = 'finalizing';
      harvest.updatedAt = new Date();

      let analysis = harvest.analysis;
      if (!analysis && harvest.samples.length > 0) {
        const voiceAnalyzer = getVoiceAnalyzer();
        analysis = voiceAnalyzer.analyze(harvest.samples.map(s => s.text));
        harvest.analysis = analysis;
      }

      const personaOptions: CreatePersonaProfileOptions = {
        userId,
        name: harvest.name,
        voiceTraits: options.voiceTraits ?? analysis?.proposedTraits.voiceTraits ?? [],
        toneMarkers: options.toneMarkers ?? analysis?.proposedTraits.toneMarkers ?? [],
        formalityRange:
          options.formalityRange ?? analysis?.proposedTraits.formalityRange ?? [0.3, 0.7],
        voiceFingerprint: analysis?.fingerprint,
        referenceExamples: harvest.samples.slice(0, 5).map(s => s.text.substring(0, 500)),
        isDefault: options.setAsDefault ?? false,
        metadata: {
          harvestId,
          samplesCount: harvest.samples.length,
          harvestedAt: new Date().toISOString(),
        },
      };

      const persona = await store.createPersonaProfile(personaOptions);

      const styleIds: string[] = [];

      if (options.styles && options.styles.length > 0) {
        for (let i = 0; i < options.styles.length; i++) {
          const styleOpts = options.styles[i];
          const style = await store.createStyleProfile({
            personaId: persona.id,
            name: styleOpts.name,
            forbiddenPhrases: styleOpts.forbiddenPhrases ?? [],
            preferredPatterns: styleOpts.preferredPatterns ?? [],
            useContractions: styleOpts.useContractions ?? true,
            useRhetoricalQuestions: styleOpts.useRhetoricalQuestions ?? false,
            formalityLevel: styleOpts.formalityLevel ?? 0.5,
            isDefault: styleOpts.isDefault ?? i === 0,
          });
          styleIds.push(style.id);
        }
      } else if (analysis?.suggestedStyles) {
        for (let i = 0; i < analysis.suggestedStyles.length; i++) {
          const suggested = analysis.suggestedStyles[i];
          const style = await store.createStyleProfile({
            personaId: persona.id,
            name: suggested.name,
            description: suggested.description,
            forbiddenPhrases: [],
            preferredPatterns: [],
            useContractions: suggested.useContractions,
            useRhetoricalQuestions: suggested.useRhetoricalQuestions,
            formalityLevel: suggested.formalityLevel,
            sentenceVariety: suggested.sentenceVariety,
            paragraphStyle: suggested.paragraphStyle,
            isDefault: i === 0,
          });
          styleIds.push(style.id);
        }
      }

      harvest.status = 'complete';
      harvest.updatedAt = new Date();

      setTimeout(() => {
        deps.getHarvestSessions().delete(harvestId);
      }, 60000);

      return {
        personaId: persona.id,
        styleIds,
      };
    },

    getHarvestSession(harvestId: string): PersonaHarvestSession | undefined {
      return deps.getHarvestSessions().get(harvestId);
    },

    async generatePersonaSample(
      harvestId: string,
      options?: { wordCount?: number; topic?: string }
    ): Promise<{
      sample: string;
      personaPreview: {
        name: string;
        voiceTraits: string[];
        toneMarkers: string[];
      };
      metrics: {
        forbiddenPhrasesRemoved: number;
        preferredPatternsUsed: number;
        passCount: number;
      };
    }> {
      const harvest = deps.getHarvestSessions().get(harvestId);
      if (!harvest) {
        throw new Error(`Harvest session "${harvestId}" not found`);
      }

      if (!harvest.analysis) {
        const voiceAnalyzer = getVoiceAnalyzer();
        harvest.analysis = voiceAnalyzer.analyze(harvest.samples.map(s => s.text));
      }

      const analysis = harvest.analysis;
      const wordCount = options?.wordCount ?? 300;
      const topic = options?.topic ?? 'a reflection on everyday moments and observations';

      const tempPersona: PersonaProfileForRewrite = {
        name: harvest.name,
        description: `Voice harvested from ${harvest.samples.length} samples`,
        voiceTraits: analysis.proposedTraits.voiceTraits,
        toneMarkers: analysis.proposedTraits.toneMarkers,
        formalityRange: [
          analysis.suggestedStyles?.[0]?.formalityLevel ?? 0.4,
          analysis.suggestedStyles?.[0]?.formalityLevel ?? 0.6,
        ] as [number, number],
        styleGuide: {
          forbiddenPhrases: [
            'delve',
            'delve into',
            'dive into',
            'tapestry',
            'rich tapestry',
            'the fact that',
            'in conclusion',
            'it is worth noting',
            'it is important to note',
            'essentially',
            'fundamentally',
            'at its core',
            'at its essence',
            'beacon',
            'stark',
            'however, it is',
            'moreover,',
            'furthermore,',
            'thus,',
            'hence,',
            'consequently,',
            'nonetheless,',
            'notwithstanding',
            'leveraging',
            'leverage',
            'utilize',
            'utilization',
          ],
          preferredPatterns: [],
          useContractions: analysis.suggestedStyles?.[0]?.useContractions ?? true,
          useRhetoricalQuestions: analysis.suggestedStyles?.[0]?.useRhetoricalQuestions ?? false,
        },
        referenceExamples: harvest.samples.slice(0, 3).map(s => s.text),
      };

      const builder = getBuilderAgent();
      const rawSample = await builder['callAI'](
        'creative',
        `
Write a ${wordCount}-word piece about ${topic}.
Write naturally and reflectively.
Draw on personal observation and lived experience.
Avoid clichés and academic language.
Output only the content, no titles or meta-commentary.
    `.trim(),
        {
          systemPrompt: `You are a skilled writer with these voice characteristics:
Voice traits: ${tempPersona.voiceTraits.join(', ')}
Tone: ${tempPersona.toneMarkers.join(', ')}

Write naturally. Avoid phrases like: ${tempPersona.styleGuide.forbiddenPhrases.slice(0, 10).join(', ')}.
${tempPersona.styleGuide.useContractions ? 'Use contractions naturally.' : 'Avoid contractions.'}`,
        }
      );

      const result = await builder.rewriteForPersonaWithRetry(
        {
          text: rawSample,
          persona: tempPersona,
          sourceType: 'sample-preview',
        },
        { maxPasses: 3 }
      );

      const changesApplied = result.changesApplied || [];
      const forbiddenPhrasesRemoved = changesApplied.filter(
        c => c.toLowerCase().includes('removed') || c.toLowerCase().includes('replaced')
      ).length;
      const preferredPatternsUsed = changesApplied.filter(
        c => c.toLowerCase().includes('pattern') || c.toLowerCase().includes('used')
      ).length;

      return {
        sample: result.rewritten,
        personaPreview: {
          name: harvest.name,
          voiceTraits: analysis.proposedTraits.voiceTraits,
          toneMarkers: analysis.proposedTraits.toneMarkers,
        },
        metrics: {
          forbiddenPhrasesRemoved,
          preferredPatternsUsed,
          passCount: result.passCount ?? 1,
        },
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLE PROFILE METHODS
// ═══════════════════════════════════════════════════════════════════════════

export interface StyleProfileMethods {
  createStyleProfile(options: CreateStyleProfileOptions): Promise<StyleProfile>;
  getStyleProfile(id: string): Promise<StyleProfile | undefined>;
  getDefaultStyleProfile(personaId: string): Promise<StyleProfile | undefined>;
  listStyleProfiles(personaId: string): Promise<StyleProfile[]>;
  updateStyleProfile(
    id: string,
    update: Partial<Omit<StyleProfile, 'id' | 'personaId' | 'createdAt' | 'updatedAt'>>
  ): Promise<StyleProfile | undefined>;
  deleteStyleProfile(id: string): Promise<boolean>;
}

export function createStyleProfileMethods(deps: ServiceDependencies): StyleProfileMethods {
  return {
    async createStyleProfile(options: CreateStyleProfileOptions): Promise<StyleProfile> {
      const store = deps.getStore();
      if (!store) {
        throw new Error('Persistent store not configured');
      }
      return store.createStyleProfile(options);
    },

    async getStyleProfile(id: string): Promise<StyleProfile | undefined> {
      const store = deps.getStore();
      if (!store) {
        throw new Error('Persistent store not configured');
      }
      return store.getStyleProfile(id);
    },

    async getDefaultStyleProfile(personaId: string): Promise<StyleProfile | undefined> {
      const store = deps.getStore();
      if (!store) {
        throw new Error('Persistent store not configured');
      }
      return store.getDefaultStyleProfile(personaId);
    },

    async listStyleProfiles(personaId: string): Promise<StyleProfile[]> {
      const store = deps.getStore();
      if (!store) {
        throw new Error('Persistent store not configured');
      }
      return store.listStyleProfiles(personaId);
    },

    async updateStyleProfile(
      id: string,
      update: Partial<Omit<StyleProfile, 'id' | 'personaId' | 'createdAt' | 'updatedAt'>>
    ): Promise<StyleProfile | undefined> {
      const store = deps.getStore();
      if (!store) {
        throw new Error('Persistent store not configured');
      }
      return store.updateStyleProfile(id, update);
    },

    async deleteStyleProfile(id: string): Promise<boolean> {
      const store = deps.getStore();
      if (!store) {
        throw new Error('Persistent store not configured');
      }
      return store.deleteStyleProfile(id);
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PERSONA PROFILE METHODS
// ═══════════════════════════════════════════════════════════════════════════

export interface PersonaProfileMethods {
  getPersonaProfile(id: string): Promise<PersonaProfile | undefined>;
  listPersonaProfiles(options?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<PersonaProfile[]>;
  getDefaultPersonaProfile(userId: string): Promise<PersonaProfile | undefined>;
  setDefaultPersona(userId: string, personaId: string): Promise<PersonaProfile>;
}

export function createPersonaProfileMethods(deps: ServiceDependencies): PersonaProfileMethods {
  return {
    async getPersonaProfile(id: string): Promise<PersonaProfile | undefined> {
      const store = deps.getStore();
      if (!store) {
        throw new Error('Persistent store not configured');
      }
      return store.getPersonaProfile(id);
    },

    async listPersonaProfiles(options?: {
      userId?: string;
      limit?: number;
      offset?: number;
    }): Promise<PersonaProfile[]> {
      const store = deps.getStore();
      if (!store) {
        throw new Error('Persistent store not configured');
      }
      return store.listPersonaProfiles(options);
    },

    async getDefaultPersonaProfile(userId: string): Promise<PersonaProfile | undefined> {
      const store = deps.getStore();
      if (!store) {
        throw new Error('Persistent store not configured');
      }
      return store.getDefaultPersonaProfile(userId);
    },

    async setDefaultPersona(userId: string, personaId: string): Promise<PersonaProfile> {
      const store = deps.getStore();
      if (!store) {
        throw new Error('Persistent store not configured');
      }

      const persona = await store.getPersonaProfile(personaId);
      if (!persona) {
        throw new Error(`Persona "${personaId}" not found`);
      }

      if (persona.userId && persona.userId !== userId) {
        throw new Error(`Persona "${personaId}" does not belong to user "${userId}"`);
      }

      const updated = await store.updatePersonaProfile(personaId, { isDefault: true });
      if (!updated) {
        throw new Error(`Failed to set persona "${personaId}" as default`);
      }

      return updated;
    },
  };
}
