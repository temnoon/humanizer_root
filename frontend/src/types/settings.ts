export interface UserSettings {
  // Ephemeral Lists settings
  ephemeralLists: {
    autoSaveEnabled: boolean;
    maxItems: number;
    autoClearOnSave: boolean;
    defaultListType: 'custom' | 'ephemeral' | 'discovery';
    excludedConversations: string[];
  };

  // UI preferences
  ui: {
    theme: 'light' | 'dark' | 'auto';
    sidebarCollapsed: boolean;
    toolPanelCollapsed: boolean;
  };

  // Feature flags
  features: {
    enableTransformationTracking: boolean;
    enableSearchTracking: boolean;
    enableMediaTracking: boolean;
  };
}

export const defaultSettings: UserSettings = {
  ephemeralLists: {
    autoSaveEnabled: false,
    maxItems: 50,
    autoClearOnSave: true,
    defaultListType: 'ephemeral',
    excludedConversations: [],
  },
  ui: {
    theme: 'auto',
    sidebarCollapsed: false,
    toolPanelCollapsed: false,
  },
  features: {
    enableTransformationTracking: true,
    enableSearchTracking: true,
    enableMediaTracking: true,
  },
};

export interface SettingsStore {
  settings: UserSettings;

  // Actions
  updateEphemeralListSettings: (settings: Partial<UserSettings['ephemeralLists']>) => void;
  updateUISettings: (settings: Partial<UserSettings['ui']>) => void;
  updateFeatureSettings: (settings: Partial<UserSettings['features']>) => void;
  resetToDefaults: () => void;
  excludeConversation: (conversationId: string) => void;
  includeConversation: (conversationId: string) => void;
}
