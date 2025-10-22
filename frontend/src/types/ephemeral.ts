export interface EphemeralItem {
  type: 'conversation' | 'search' | 'media' | 'transformation';
  uuid: string;
  timestamp: Date;
  metadata: {
    title?: string;
    query?: string;
    resultCount?: number;
    [key: string]: any;
  };
}

export interface EphemeralList {
  id: string;
  sessionId: string;
  startedAt: Date;
  items: EphemeralItem[];
  isSaved: boolean;
  autoSaveEnabled: boolean;
  maxItems: number;
}

export interface EphemeralListStore {
  list: EphemeralList | null;

  // Actions
  addItem: (item: Omit<EphemeralItem, 'timestamp'>) => void;
  removeItem: (uuid: string) => void;
  clear: () => void;
  save: (name: string, description?: string) => Promise<string>;
  restore: () => void;

  // Settings
  setAutoSave: (enabled: boolean) => void;
  setMaxItems: (max: number) => void;
}
