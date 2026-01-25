/**
 * AUI PostgreSQL Store - Persona and Style Profile Methods
 *
 * Persona profile and style profile CRUD operations.
 *
 * @module @humanizer/core/storage/aui/persona-style
 */

import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import {
  INSERT_AUI_PERSONA_PROFILE,
  GET_AUI_PERSONA_PROFILE,
  GET_AUI_PERSONA_PROFILE_BY_NAME,
  GET_AUI_DEFAULT_PERSONA_PROFILE,
  UPDATE_AUI_PERSONA_PROFILE,
  DELETE_AUI_PERSONA_PROFILE,
  LIST_AUI_PERSONA_PROFILES,
  CLEAR_DEFAULT_PERSONA_PROFILE,
  INSERT_AUI_STYLE_PROFILE,
  GET_AUI_STYLE_PROFILE,
  GET_AUI_STYLE_PROFILE_BY_NAME,
  GET_AUI_DEFAULT_STYLE_PROFILE,
  UPDATE_AUI_STYLE_PROFILE,
  DELETE_AUI_STYLE_PROFILE,
  LIST_AUI_STYLE_PROFILES,
  CLEAR_DEFAULT_STYLE_PROFILE,
} from '../schema-aui.js';
import type { DbPersonaProfileRow, DbStyleProfileRow } from './row-types.js';
import { rowToPersonaProfile, rowToStyleProfile } from './converters.js';
import type {
  PersonaProfile,
  CreatePersonaProfileOptions,
  StyleProfile,
  CreateStyleProfileOptions,
  StyleGuide,
  VoiceFingerprint,
} from './types.js';

export interface PersonaStyleStoreMethods {
  // Persona profile methods
  createPersonaProfile(options: CreatePersonaProfileOptions): Promise<PersonaProfile>;
  getPersonaProfile(id: string): Promise<PersonaProfile | undefined>;
  getPersonaProfileByName(userId: string, name: string): Promise<PersonaProfile | undefined>;
  getDefaultPersonaProfile(userId: string): Promise<PersonaProfile | undefined>;
  updatePersonaProfile(
    id: string,
    update: Partial<{
      name: string;
      description: string;
      voiceTraits: string[];
      toneMarkers: string[];
      formalityMin: number;
      formalityMax: number;
      styleGuide: StyleGuide;
      referenceExamples: string[];
      voiceFingerprint: VoiceFingerprint;
      isDefault: boolean;
      metadata: Record<string, unknown>;
    }>
  ): Promise<PersonaProfile | undefined>;
  deletePersonaProfile(id: string): Promise<boolean>;
  listPersonaProfiles(options?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<PersonaProfile[]>;

  // Style profile methods
  createStyleProfile(options: CreateStyleProfileOptions): Promise<StyleProfile>;
  getStyleProfile(id: string): Promise<StyleProfile | undefined>;
  getStyleProfileByName(personaId: string, name: string): Promise<StyleProfile | undefined>;
  getDefaultStyleProfile(personaId: string): Promise<StyleProfile | undefined>;
  updateStyleProfile(
    id: string,
    update: Partial<{
      name: string;
      description: string;
      context: string;
      forbiddenPhrases: string[];
      preferredPatterns: string[];
      sentenceVariety: 'low' | 'medium' | 'high';
      paragraphStyle: 'short' | 'medium' | 'long';
      useContractions: boolean;
      useRhetoricalQuestions: boolean;
      formalityLevel: number;
      isDefault: boolean;
      metadata: Record<string, unknown>;
    }>
  ): Promise<StyleProfile | undefined>;
  deleteStyleProfile(id: string): Promise<boolean>;
  listStyleProfiles(personaId: string): Promise<StyleProfile[]>;
}

export function createPersonaStyleMethods(pool: Pool): PersonaStyleStoreMethods {
  const methods: PersonaStyleStoreMethods = {
    // ═══════════════════════════════════════════════════════════════════
    // PERSONA PROFILES
    // ═══════════════════════════════════════════════════════════════════

    async createPersonaProfile(options: CreatePersonaProfileOptions): Promise<PersonaProfile> {
      const now = new Date();
      const id = randomUUID();

      const defaultStyleGuide: StyleGuide = {
        forbiddenPhrases: [],
        preferredPatterns: [],
        sentenceVariety: 'medium',
        paragraphStyle: 'medium',
        useContractions: true,
        useRhetoricalQuestions: false,
      };

      const styleGuide = {
        ...defaultStyleGuide,
        ...options.styleGuide,
      };

      const formalityRange = options.formalityRange ?? [0.3, 0.7];

      // If setting as default, clear existing default
      if (options.isDefault && options.userId) {
        await pool.query(CLEAR_DEFAULT_PERSONA_PROFILE, [options.userId]);
      }

      const result = await pool.query(INSERT_AUI_PERSONA_PROFILE, [
        id,
        options.userId ?? null,
        options.name,
        options.description ?? null,
        options.voiceTraits ?? [],
        options.toneMarkers ?? [],
        formalityRange[0],
        formalityRange[1],
        JSON.stringify(styleGuide),
        options.referenceExamples ?? [],
        options.voiceFingerprint ? JSON.stringify(options.voiceFingerprint) : null,
        options.isDefault ?? false,
        JSON.stringify(options.metadata ?? {}),
        now,
        now,
      ]);

      return rowToPersonaProfile(result.rows[0] as DbPersonaProfileRow);
    },

    async getPersonaProfile(id: string): Promise<PersonaProfile | undefined> {
      const result = await pool.query(GET_AUI_PERSONA_PROFILE, [id]);
      if (result.rows.length === 0) return undefined;
      return rowToPersonaProfile(result.rows[0] as DbPersonaProfileRow);
    },

    async getPersonaProfileByName(
      userId: string,
      name: string
    ): Promise<PersonaProfile | undefined> {
      const result = await pool.query(GET_AUI_PERSONA_PROFILE_BY_NAME, [userId, name]);
      if (result.rows.length === 0) return undefined;
      return rowToPersonaProfile(result.rows[0] as DbPersonaProfileRow);
    },

    async getDefaultPersonaProfile(userId: string): Promise<PersonaProfile | undefined> {
      const result = await pool.query(GET_AUI_DEFAULT_PERSONA_PROFILE, [userId]);
      if (result.rows.length === 0) return undefined;
      return rowToPersonaProfile(result.rows[0] as DbPersonaProfileRow);
    },

    async updatePersonaProfile(
      id: string,
      update: Partial<{
        name: string;
        description: string;
        voiceTraits: string[];
        toneMarkers: string[];
        formalityMin: number;
        formalityMax: number;
        styleGuide: StyleGuide;
        referenceExamples: string[];
        voiceFingerprint: VoiceFingerprint;
        isDefault: boolean;
        metadata: Record<string, unknown>;
      }>
    ): Promise<PersonaProfile | undefined> {
      // If setting as default, get the profile first to find userId
      if (update.isDefault) {
        const existing = await methods.getPersonaProfile(id);
        if (existing?.userId) {
          await pool.query(CLEAR_DEFAULT_PERSONA_PROFILE, [existing.userId]);
        }
      }

      const result = await pool.query(UPDATE_AUI_PERSONA_PROFILE, [
        id,
        update.name ?? null,
        update.description ?? null,
        update.voiceTraits ?? null,
        update.toneMarkers ?? null,
        update.formalityMin ?? null,
        update.formalityMax ?? null,
        update.styleGuide ? JSON.stringify(update.styleGuide) : null,
        update.referenceExamples ?? null,
        update.voiceFingerprint ? JSON.stringify(update.voiceFingerprint) : null,
        update.isDefault ?? null,
        update.metadata ? JSON.stringify(update.metadata) : null,
      ]);

      if (result.rows.length === 0) return undefined;
      return rowToPersonaProfile(result.rows[0] as DbPersonaProfileRow);
    },

    async deletePersonaProfile(id: string): Promise<boolean> {
      const result = await pool.query(DELETE_AUI_PERSONA_PROFILE, [id]);
      return (result.rowCount ?? 0) > 0;
    },

    async listPersonaProfiles(options?: {
      userId?: string;
      limit?: number;
      offset?: number;
    }): Promise<PersonaProfile[]> {
      const result = await pool.query(LIST_AUI_PERSONA_PROFILES, [
        options?.userId ?? null,
        options?.limit ?? 100,
        options?.offset ?? 0,
      ]);

      return result.rows.map((row) => rowToPersonaProfile(row as DbPersonaProfileRow));
    },

    // ═══════════════════════════════════════════════════════════════════
    // STYLE PROFILES
    // ═══════════════════════════════════════════════════════════════════

    async createStyleProfile(options: CreateStyleProfileOptions): Promise<StyleProfile> {
      const now = new Date();
      const id = randomUUID();

      // If setting as default, clear existing default for this persona
      if (options.isDefault) {
        await pool.query(CLEAR_DEFAULT_STYLE_PROFILE, [options.personaId]);
      }

      const result = await pool.query(INSERT_AUI_STYLE_PROFILE, [
        id,
        options.personaId,
        options.name,
        options.description ?? null,
        options.context ?? null,
        options.forbiddenPhrases ?? [],
        options.preferredPatterns ?? [],
        options.sentenceVariety ?? 'medium',
        options.paragraphStyle ?? 'medium',
        options.useContractions ?? true,
        options.useRhetoricalQuestions ?? false,
        options.formalityLevel ?? 0.5,
        options.isDefault ?? false,
        JSON.stringify(options.metadata ?? {}),
        now,
        now,
      ]);

      return rowToStyleProfile(result.rows[0] as DbStyleProfileRow);
    },

    async getStyleProfile(id: string): Promise<StyleProfile | undefined> {
      const result = await pool.query(GET_AUI_STYLE_PROFILE, [id]);
      if (result.rows.length === 0) return undefined;
      return rowToStyleProfile(result.rows[0] as DbStyleProfileRow);
    },

    async getStyleProfileByName(
      personaId: string,
      name: string
    ): Promise<StyleProfile | undefined> {
      const result = await pool.query(GET_AUI_STYLE_PROFILE_BY_NAME, [personaId, name]);
      if (result.rows.length === 0) return undefined;
      return rowToStyleProfile(result.rows[0] as DbStyleProfileRow);
    },

    async getDefaultStyleProfile(personaId: string): Promise<StyleProfile | undefined> {
      const result = await pool.query(GET_AUI_DEFAULT_STYLE_PROFILE, [personaId]);
      if (result.rows.length === 0) return undefined;
      return rowToStyleProfile(result.rows[0] as DbStyleProfileRow);
    },

    async updateStyleProfile(
      id: string,
      update: Partial<{
        name: string;
        description: string;
        context: string;
        forbiddenPhrases: string[];
        preferredPatterns: string[];
        sentenceVariety: 'low' | 'medium' | 'high';
        paragraphStyle: 'short' | 'medium' | 'long';
        useContractions: boolean;
        useRhetoricalQuestions: boolean;
        formalityLevel: number;
        isDefault: boolean;
        metadata: Record<string, unknown>;
      }>
    ): Promise<StyleProfile | undefined> {
      // If setting as default, get the style first to find personaId
      if (update.isDefault) {
        const existing = await methods.getStyleProfile(id);
        if (existing) {
          await pool.query(CLEAR_DEFAULT_STYLE_PROFILE, [existing.personaId]);
        }
      }

      const result = await pool.query(UPDATE_AUI_STYLE_PROFILE, [
        id,
        update.name ?? null,
        update.description ?? null,
        update.context ?? null,
        update.forbiddenPhrases ?? null,
        update.preferredPatterns ?? null,
        update.sentenceVariety ?? null,
        update.paragraphStyle ?? null,
        update.useContractions ?? null,
        update.useRhetoricalQuestions ?? null,
        update.formalityLevel ?? null,
        update.isDefault ?? null,
        update.metadata ? JSON.stringify(update.metadata) : null,
      ]);

      if (result.rows.length === 0) return undefined;
      return rowToStyleProfile(result.rows[0] as DbStyleProfileRow);
    },

    async deleteStyleProfile(id: string): Promise<boolean> {
      const result = await pool.query(DELETE_AUI_STYLE_PROFILE, [id]);
      return (result.rowCount ?? 0) > 0;
    },

    async listStyleProfiles(personaId: string): Promise<StyleProfile[]> {
      const result = await pool.query(LIST_AUI_STYLE_PROFILES, [personaId]);
      return result.rows.map((row) => rowToStyleProfile(row as DbStyleProfileRow));
    },
  };

  return methods;
}
