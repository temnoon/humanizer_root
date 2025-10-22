import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SettingsStore } from '../types/settings';
import { defaultSettings } from '../types/settings';

export type { UserSettings } from '../types/settings';

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,

      updateEphemeralListSettings: (newSettings) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ephemeralLists: {
              ...state.settings.ephemeralLists,
              ...newSettings,
            },
          },
        })),

      updateUISettings: (newSettings) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ui: {
              ...state.settings.ui,
              ...newSettings,
            },
          },
        })),

      updateFeatureSettings: (newSettings) =>
        set((state) => ({
          settings: {
            ...state.settings,
            features: {
              ...state.settings.features,
              ...newSettings,
            },
          },
        })),

      resetToDefaults: () =>
        set({
          settings: defaultSettings,
        }),

      excludeConversation: (conversationId) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ephemeralLists: {
              ...state.settings.ephemeralLists,
              excludedConversations: [
                ...state.settings.ephemeralLists.excludedConversations,
                conversationId,
              ],
            },
          },
        })),

      includeConversation: (conversationId) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ephemeralLists: {
              ...state.settings.ephemeralLists,
              excludedConversations: state.settings.ephemeralLists.excludedConversations.filter(
                (id) => id !== conversationId
              ),
            },
          },
        })),
    }),
    {
      name: 'humanizer-settings',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);
