import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { EphemeralList, EphemeralListStore, EphemeralItem } from '../types/ephemeral';
import { api } from '../lib/api-client';
import { useSettingsStore } from './settings';

const createDefaultList = (): EphemeralList => {
  // Get settings from the settings store
  const settings = useSettingsStore.getState().settings;

  return {
    id: uuidv4(),
    sessionId: uuidv4(),
    startedAt: new Date(),
    items: [],
    isSaved: false,
    autoSaveEnabled: settings.ephemeralLists.autoSaveEnabled,
    maxItems: settings.ephemeralLists.maxItems,
  };
};

export const useEphemeralListStore = create<EphemeralListStore>()(
  persist(
    (set, get) => ({
      list: createDefaultList(),

      addItem: (item) => {
        set((state) => {
          if (!state.list) return state;

          const newItem: EphemeralItem = {
            ...item,
            timestamp: new Date(),
          };

          // Check if item already exists
          const existingIndex = state.list.items.findIndex(i => i.uuid === item.uuid);

          if (existingIndex !== -1) {
            // Item exists - update its metadata if different
            const existing = state.list.items[existingIndex];
            const metadataChanged = JSON.stringify(existing.metadata) !== JSON.stringify(item.metadata);

            if (metadataChanged) {
              const items = [...state.list.items];
              items[existingIndex] = newItem;
              return {
                list: {
                  ...state.list,
                  items,
                },
              };
            }

            return state; // No changes needed
          }

          // Add new item and trim to maxItems
          const items = [...state.list.items, newItem];
          if (items.length > state.list.maxItems) {
            items.shift(); // Remove oldest
          }

          return {
            list: {
              ...state.list,
              items,
            },
          };
        });
      },

      removeItem: (uuid) => {
        set((state) => {
          if (!state.list) return state;
          return {
            list: {
              ...state.list,
              items: state.list.items.filter(i => i.uuid !== uuid),
            },
          };
        });
      },

      clear: () => {
        set({ list: createDefaultList() });
      },

      save: async (name, description) => {
        const { list } = get();
        if (!list) throw new Error('No list to save');
        if (list.items.length === 0) throw new Error('No items to save');

        // Create the interest list
        const createdList = await api.createInterestList({
          name,
          description: description || `Working memory from ${new Date(list.startedAt).toLocaleString()}`,
          listType: 'ephemeral',
        });

        // Add all items to the list
        for (const item of list.items) {
          await api.addToInterestList(createdList.id, {
            itemType: item.type,
            itemUuid: item.uuid,
            itemMetadata: item.metadata,
          });
        }

        // Mark as saved
        set((state) => ({
          list: state.list ? { ...state.list, isSaved: true } : null,
        }));

        return createdList.id;
      },

      restore: () => {
        // Restore is handled by persist middleware
      },

      setAutoSave: (enabled) => {
        set((state) => ({
          list: state.list ? { ...state.list, autoSaveEnabled: enabled } : null,
        }));
      },

      setMaxItems: (max) => {
        set((state) => ({
          list: state.list ? { ...state.list, maxItems: max } : null,
        }));
      },
    }),
    {
      name: 'ephemeral-list-storage',
      storage: {
        getItem: (name) => {
          const str = sessionStorage.getItem(name);
          if (!str) return null;
          return JSON.parse(str);
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        },
      },
    }
  )
);
