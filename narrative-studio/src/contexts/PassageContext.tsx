/**
 * Passage Context
 *
 * Central state management for the Passage System. Manages passages,
 * their UI state, persistence, and operations like split/merge.
 *
 * @see /docs/PASSAGE_SYSTEM_SPEC_v1.1.md
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type {
  Passage,
  PassageUIState,
  PassageSource,
  PassagePosition,
  PassageContentType,
  PassageEdit,
  TransformationRecord,
  PassageCollection,
} from '../types/passage';
import {
  createPassage,
  createPassageUIState,
  generatePassageId,
  hashContent,
  calculateReadTime,
} from '../types/passage';
import {
  insertBlockMarkers,
  stripBlockMarkers,
  hasBlockMarkers,
  validateMarkedText,
  getBlockMarkerInstructions,
} from '../services/block-markers';

// ============================================================
// CONTEXT VALUE INTERFACE
// ============================================================

export interface PassageContextValue {
  // ============================================================
  // PASSAGE STATE
  // ============================================================

  /** All passages in the current session */
  passages: Passage[];

  /** UI state for each passage (keyed by passage ID) */
  uiState: Map<string, PassageUIState>;

  /** Currently active passage ID */
  activePassageId: string | null;

  /** Currently selected passage IDs (for multi-select) */
  selectedPassageIds: string[];

  // ============================================================
  // PASSAGE CRUD
  // ============================================================

  /** Add a new passage */
  addPassage: (passage: Passage) => void;

  /** Update an existing passage */
  updatePassage: (id: string, updates: Partial<Passage>) => void;

  /** Remove a passage */
  removePassage: (id: string) => void;

  /** Clear all passages */
  clearPassages: () => void;

  /** Get a passage by ID */
  getPassage: (id: string) => Passage | undefined;

  // ============================================================
  // PASSAGE CREATION (from various sources)
  // ============================================================

  /** Create passage from plain text */
  createFromText: (
    text: string,
    options?: {
      title?: string;
      contentType?: PassageContentType;
    }
  ) => Passage;

  /** Create passage from markdown */
  createFromMarkdown: (
    markdown: string,
    source: PassageSource,
    options?: {
      title?: string;
      position?: PassagePosition;
    }
  ) => Passage;

  /** Create passage from file content */
  createFromFile: (
    content: string,
    filename: string,
    format: 'txt' | 'md' | 'html' | 'pdf' | 'rtf'
  ) => Passage;

  // ============================================================
  // SELECTION & ACTIVATION
  // ============================================================

  /** Set the active passage */
  setActivePassage: (id: string | null) => void;

  /** Select a passage (add to selection) */
  selectPassage: (id: string) => void;

  /** Deselect a passage */
  deselectPassage: (id: string) => void;

  /** Toggle passage selection */
  toggleSelection: (id: string) => void;

  /** Clear all selections */
  clearSelection: () => void;

  /** Select all passages */
  selectAll: () => void;

  /** Get the active passage */
  activePassage: Passage | null;

  /** Get selected passages */
  selectedPassages: Passage[];

  // ============================================================
  // UI STATE
  // ============================================================

  /** Update UI state for a passage */
  updateUIState: (id: string, updates: Partial<PassageUIState>) => void;

  /** Toggle passage expansion */
  toggleExpanded: (id: string) => void;

  /** Set editing mode */
  setEditing: (id: string, editing: boolean) => void;

  // ============================================================
  // PASSAGE OPERATIONS
  // ============================================================

  /** Split a passage at a position */
  splitPassage: (id: string, splitPosition: number) => [Passage, Passage];

  /** Merge multiple passages into one */
  mergePassages: (ids: string[]) => Passage;

  /** Duplicate a passage */
  duplicatePassage: (id: string) => Passage;

  // ============================================================
  // BLOCK MARKERS (for transformation)
  // ============================================================

  /** Get passage content with block markers inserted */
  getMarkedContent: (id: string) => string;

  /** Update passage from marked content (after transformation) */
  updateFromMarkedContent: (id: string, markedContent: string) => void;

  /** Get LLM instructions for block markers */
  getMarkerInstructions: () => string;

  // ============================================================
  // TRANSFORMATION
  // ============================================================

  /** Record a transformation on a passage */
  recordTransformation: (
    id: string,
    tool: string,
    settings: Record<string, unknown>,
    resultContent: string,
    analysisResult?: Record<string, unknown>
  ) => Passage;

  // ============================================================
  // TEXT EXTRACTION
  // ============================================================

  /** Get plain text from active passage */
  getTextContent: () => string;

  /** Get markdown from active passage */
  getMarkdownContent: () => string;

  /** Get content from passage by ID */
  getPassageContent: (id: string) => string;

  // ============================================================
  // COLLECTIONS
  // ============================================================

  /** Collections of passages */
  collections: PassageCollection[];

  /** Create a collection from selected passages */
  createCollection: (name: string, passageIds: string[]) => PassageCollection;

  /** Delete a collection */
  deleteCollection: (id: string) => void;

  // ============================================================
  // PERSISTENCE
  // ============================================================

  /** Save passages to IndexedDB */
  saveToIndex: () => Promise<void>;

  /** Load passages from IndexedDB */
  loadFromIndex: () => Promise<void>;

  /** Is persistence enabled */
  isPersistenceEnabled: boolean;

  /** Enable/disable persistence */
  setPersistenceEnabled: (enabled: boolean) => void;

  // ============================================================
  // HISTORY (for undo)
  // ============================================================

  /** Can undo last operation */
  canUndo: boolean;

  /** Undo last operation */
  undo: () => void;

  /** Can redo */
  canRedo: boolean;

  /** Redo last undone operation */
  redo: () => void;
}

// ============================================================
// CONTEXT
// ============================================================

const PassageContext = createContext<PassageContextValue | undefined>(undefined);

// ============================================================
// INDEXEDDB HELPERS
// ============================================================

const DB_NAME = 'humanizer_passages';
const DB_VERSION = 1;
const STORE_PASSAGES = 'passages';
const STORE_EDITS = 'edits';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Passages store
      if (!db.objectStoreNames.contains(STORE_PASSAGES)) {
        const passageStore = db.createObjectStore(STORE_PASSAGES, { keyPath: 'id' });
        passageStore.createIndex('sourceType', 'source.type');
        passageStore.createIndex('createdAt', 'createdAt');
        passageStore.createIndex('contentHash', 'contentHash');
      }

      // Edits store
      if (!db.objectStoreNames.contains(STORE_EDITS)) {
        const editStore = db.createObjectStore(STORE_EDITS, { keyPath: 'id' });
        editStore.createIndex('passageId', 'passageId');
        editStore.createIndex('createdAt', 'createdAt');
      }
    };
  });
}

// ============================================================
// PROVIDER
// ============================================================

interface PassageProviderProps {
  children: ReactNode;
  archiveName?: string;
  enablePersistence?: boolean;
}

export function PassageProvider({
  children,
  archiveName = 'main',
  enablePersistence = false,
}: PassageProviderProps) {
  // State
  const [passages, setPassages] = useState<Passage[]>([]);
  const [uiState, setUIState] = useState<Map<string, PassageUIState>>(new Map());
  const [activePassageId, setActivePassageId] = useState<string | null>(null);
  const [selectedPassageIds, setSelectedPassageIds] = useState<string[]>([]);
  const [collections, setCollections] = useState<PassageCollection[]>([]);
  const [isPersistenceEnabled, setPersistenceEnabled] = useState(enablePersistence);

  // History for undo/redo
  const [history, setHistory] = useState<Passage[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  const activePassage = activePassageId
    ? passages.find(p => p.id === activePassageId) || null
    : null;

  const selectedPassages = selectedPassageIds
    .map(id => passages.find(p => p.id === id))
    .filter((p): p is Passage => p !== undefined);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // ============================================================
  // HISTORY MANAGEMENT
  // ============================================================

  const pushHistory = useCallback((newPassages: Passage[]) => {
    setHistory(prev => {
      // Remove any redo states
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newPassages)));
      // Keep last 50 states
      return newHistory.slice(-50);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // ============================================================
  // PASSAGE CRUD
  // ============================================================

  const addPassage = useCallback((passage: Passage) => {
    setPassages(prev => {
      const newPassages = [...prev, passage];
      pushHistory(newPassages);
      return newPassages;
    });

    // Initialize UI state
    setUIState(prev => {
      const newState = new Map(prev);
      newState.set(passage.id, createPassageUIState());
      return newState;
    });
  }, [pushHistory]);

  const updatePassage = useCallback((id: string, updates: Partial<Passage>) => {
    setPassages(prev => {
      const newPassages = prev.map(p => {
        if (p.id === id) {
          const updated = {
            ...p,
            ...updates,
            updatedAt: new Date(),
          };
          // Recalculate hash if content changed
          if (updates.content !== undefined) {
            updated.contentHash = hashContent(updates.content);
            updated.metadata = {
              ...updated.metadata,
              wordCount: updates.content.split(/\s+/).filter(Boolean).length,
              charCount: updates.content.length,
              estimatedReadTime: calculateReadTime(
                updates.content.split(/\s+/).filter(Boolean).length
              ),
            };
          }
          return updated;
        }
        return p;
      });
      pushHistory(newPassages);
      return newPassages;
    });
  }, [pushHistory]);

  const removePassage = useCallback((id: string) => {
    setPassages(prev => {
      const newPassages = prev.filter(p => p.id !== id);
      pushHistory(newPassages);
      return newPassages;
    });

    // Clean up UI state
    setUIState(prev => {
      const newState = new Map(prev);
      newState.delete(id);
      return newState;
    });

    // Update selections
    setSelectedPassageIds(prev => prev.filter(sid => sid !== id));
    if (activePassageId === id) {
      setActivePassageId(null);
    }
  }, [activePassageId, pushHistory]);

  const clearPassages = useCallback(() => {
    pushHistory([]);
    setPassages([]);
    setUIState(new Map());
    setSelectedPassageIds([]);
    setActivePassageId(null);
  }, [pushHistory]);

  const getPassage = useCallback((id: string) => {
    return passages.find(p => p.id === id);
  }, [passages]);

  // ============================================================
  // PASSAGE CREATION
  // ============================================================

  const createFromText = useCallback((
    text: string,
    options: { title?: string; contentType?: PassageContentType } = {}
  ): Passage => {
    const source: PassageSource = {
      type: 'paste',
      name: options.title || 'Pasted text',
      extractedAt: new Date(),
    };

    return createPassage(text, source, {
      contentType: options.contentType || 'text',
      title: options.title,
    });
  }, []);

  const createFromMarkdown = useCallback((
    markdown: string,
    source: PassageSource,
    options: { title?: string; position?: PassagePosition } = {}
  ): Passage => {
    return createPassage(markdown, source, {
      contentType: 'markdown',
      title: options.title,
      position: options.position,
    });
  }, []);

  const createFromFile = useCallback((
    content: string,
    filename: string,
    format: 'txt' | 'md' | 'html' | 'pdf' | 'rtf'
  ): Passage => {
    const source: PassageSource = {
      type: 'file',
      name: filename,
      path: filename,
      extractedAt: new Date(),
      fileFormat: format,
    };

    const contentType: PassageContentType =
      format === 'md' ? 'markdown' :
      format === 'html' ? 'html' : 'text';

    return createPassage(content, source, {
      contentType,
      title: filename.replace(/\.[^.]+$/, ''), // Remove extension
    });
  }, []);

  // ============================================================
  // SELECTION
  // ============================================================

  const setActivePassage = useCallback((id: string | null) => {
    setActivePassageId(id);
  }, []);

  const selectPassage = useCallback((id: string) => {
    setSelectedPassageIds(prev => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
    setUIState(prev => {
      const newState = new Map(prev);
      const current = newState.get(id) || createPassageUIState();
      newState.set(id, { ...current, isSelected: true });
      return newState;
    });
  }, []);

  const deselectPassage = useCallback((id: string) => {
    setSelectedPassageIds(prev => prev.filter(sid => sid !== id));
    setUIState(prev => {
      const newState = new Map(prev);
      const current = newState.get(id);
      if (current) {
        newState.set(id, { ...current, isSelected: false });
      }
      return newState;
    });
  }, []);

  const toggleSelection = useCallback((id: string) => {
    if (selectedPassageIds.includes(id)) {
      deselectPassage(id);
    } else {
      selectPassage(id);
    }
  }, [selectedPassageIds, selectPassage, deselectPassage]);

  const clearSelection = useCallback(() => {
    setSelectedPassageIds([]);
    setUIState(prev => {
      const newState = new Map(prev);
      for (const [id, state] of newState) {
        newState.set(id, { ...state, isSelected: false });
      }
      return newState;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = passages.map(p => p.id);
    setSelectedPassageIds(allIds);
    setUIState(prev => {
      const newState = new Map(prev);
      for (const p of passages) {
        const current = newState.get(p.id) || createPassageUIState();
        newState.set(p.id, { ...current, isSelected: true });
      }
      return newState;
    });
  }, [passages]);

  // ============================================================
  // UI STATE
  // ============================================================

  const updateUIState = useCallback((id: string, updates: Partial<PassageUIState>) => {
    setUIState(prev => {
      const newState = new Map(prev);
      const current = newState.get(id) || createPassageUIState();
      newState.set(id, { ...current, ...updates });
      return newState;
    });
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setUIState(prev => {
      const newState = new Map(prev);
      const current = newState.get(id) || createPassageUIState();
      newState.set(id, { ...current, isExpanded: !current.isExpanded });
      return newState;
    });
  }, []);

  const setEditing = useCallback((id: string, editing: boolean) => {
    updateUIState(id, { isEditing: editing });
  }, [updateUIState]);

  // ============================================================
  // PASSAGE OPERATIONS
  // ============================================================

  const splitPassage = useCallback((id: string, splitPosition: number): [Passage, Passage] => {
    const passage = passages.find(p => p.id === id);
    if (!passage) {
      throw new Error(`Passage not found: ${id}`);
    }

    const content1 = passage.content.slice(0, splitPosition);
    const content2 = passage.content.slice(splitPosition);

    const passage1 = createPassage(content1, passage.source, {
      contentType: passage.contentType,
      title: `${passage.metadata.title || 'Passage'} (Part 1)`,
      position: passage.position,
    });
    passage1.parentId = passage.id;
    passage1.status = 'derived';

    const passage2 = createPassage(content2, passage.source, {
      contentType: passage.contentType,
      title: `${passage.metadata.title || 'Passage'} (Part 2)`,
      position: passage.position
        ? { ...passage.position, characterOffset: (passage.position.characterOffset || 0) + splitPosition }
        : undefined,
    });
    passage2.parentId = passage.id;
    passage2.status = 'derived';

    // Update original to track children
    updatePassage(id, {
      childIds: [passage1.id, passage2.id],
    });

    // Add new passages
    setPassages(prev => {
      const newPassages = [...prev, passage1, passage2];
      pushHistory(newPassages);
      return newPassages;
    });

    return [passage1, passage2];
  }, [passages, pushHistory, updatePassage]);

  const mergePassages = useCallback((ids: string[]): Passage => {
    const toMerge = ids
      .map(id => passages.find(p => p.id === id))
      .filter((p): p is Passage => p !== undefined);

    if (toMerge.length < 2) {
      throw new Error('Need at least 2 passages to merge');
    }

    // Use first passage as base
    const base = toMerge[0];
    const mergedContent = toMerge.map(p => p.content).join('\n\n');

    const merged = createPassage(mergedContent, base.source, {
      contentType: base.contentType,
      title: `Merged (${toMerge.length} passages)`,
      position: base.position,
    });
    merged.status = 'derived';
    merged.parentId = base.id;

    addPassage(merged);
    return merged;
  }, [passages, addPassage]);

  const duplicatePassage = useCallback((id: string): Passage => {
    const original = passages.find(p => p.id === id);
    if (!original) {
      throw new Error(`Passage not found: ${id}`);
    }

    const duplicate = createPassage(original.content, original.source, {
      contentType: original.contentType,
      title: `${original.metadata.title || 'Passage'} (Copy)`,
      position: original.position,
    });
    duplicate.parentId = original.id;
    duplicate.status = 'derived';

    addPassage(duplicate);
    return duplicate;
  }, [passages, addPassage]);

  // ============================================================
  // BLOCK MARKERS
  // ============================================================

  const getMarkedContent = useCallback((id: string): string => {
    const passage = passages.find(p => p.id === id);
    if (!passage) return '';

    // If already has markers, return as-is
    if (hasBlockMarkers(passage.content)) {
      return passage.content;
    }

    // For markdown content, insert markers
    if (passage.contentType === 'markdown') {
      return insertBlockMarkers(passage.content);
    }

    // For plain text, wrap in paragraph markers
    const paragraphs = passage.content.split(/\n\s*\n/).filter(Boolean);
    return paragraphs.map(p => `[BLOCK:p]${p.trim()}[/BLOCK]`).join('\n\n');
  }, [passages]);

  const updateFromMarkedContent = useCallback((id: string, markedContent: string) => {
    const { valid, errors } = validateMarkedText(markedContent);
    if (!valid) {
      console.warn('Invalid marked content:', errors);
    }

    // Strip markers and restore markdown
    const restoredContent = stripBlockMarkers(markedContent);
    updatePassage(id, { content: restoredContent });
  }, [updatePassage]);

  const getMarkerInstructions = useCallback(() => {
    return getBlockMarkerInstructions();
  }, []);

  // ============================================================
  // TRANSFORMATION
  // ============================================================

  const recordTransformation = useCallback((
    id: string,
    tool: string,
    settings: Record<string, unknown>,
    resultContent: string,
    analysisResult?: Record<string, unknown>
  ): Passage => {
    const original = passages.find(p => p.id === id);
    if (!original) {
      throw new Error(`Passage not found: ${id}`);
    }

    // Strip markers if present
    const cleanContent = hasBlockMarkers(resultContent)
      ? stripBlockMarkers(resultContent)
      : resultContent;

    const record: TransformationRecord = {
      id: generatePassageId(),
      tool,
      settings,
      appliedAt: new Date(),
      inputHash: original.contentHash,
      outputHash: hashContent(cleanContent),
      analysisResult,
    };

    // Create new passage with transformation
    const transformed = createPassage(cleanContent, original.source, {
      contentType: original.contentType,
      title: `${tool} result`,
      position: original.position,
    });
    transformed.status = 'derived';
    transformed.parentId = original.id;
    transformed.history = [...original.history, record];

    addPassage(transformed);
    setActivePassage(transformed.id);

    return transformed;
  }, [passages, addPassage, setActivePassage]);

  // ============================================================
  // TEXT EXTRACTION
  // ============================================================

  const getTextContent = useCallback((): string => {
    if (!activePassage) return '';
    // Strip markers if present
    if (hasBlockMarkers(activePassage.content)) {
      return stripBlockMarkers(activePassage.content);
    }
    return activePassage.content;
  }, [activePassage]);

  const getMarkdownContent = useCallback((): string => {
    if (!activePassage) return '';
    // For markdown content, return as-is (strip markers if present)
    if (hasBlockMarkers(activePassage.content)) {
      return stripBlockMarkers(activePassage.content);
    }
    return activePassage.content;
  }, [activePassage]);

  const getPassageContent = useCallback((id: string): string => {
    const passage = passages.find(p => p.id === id);
    if (!passage) return '';
    if (hasBlockMarkers(passage.content)) {
      return stripBlockMarkers(passage.content);
    }
    return passage.content;
  }, [passages]);

  // ============================================================
  // COLLECTIONS
  // ============================================================

  const createCollection = useCallback((name: string, passageIds: string[]): PassageCollection => {
    const passagesInCollection = passageIds
      .map(id => passages.find(p => p.id === id))
      .filter((p): p is Passage => p !== undefined);

    const totalWordCount = passagesInCollection.reduce(
      (sum, p) => sum + p.metadata.wordCount,
      0
    );

    const dates = passagesInCollection
      .map(p => p.metadata.date)
      .filter((d): d is Date => d !== undefined)
      .sort((a, b) => a.getTime() - b.getTime());

    const collection: PassageCollection = {
      id: generatePassageId(),
      name,
      type: 'manual',
      passageIds,
      createdAt: new Date(),
      stats: {
        passageCount: passageIds.length,
        totalWordCount,
        dateRange: dates.length >= 2
          ? { start: dates[0], end: dates[dates.length - 1] }
          : undefined,
      },
    };

    setCollections(prev => [...prev, collection]);
    return collection;
  }, [passages]);

  const deleteCollection = useCallback((id: string) => {
    setCollections(prev => prev.filter(c => c.id !== id));
  }, []);

  // ============================================================
  // PERSISTENCE
  // ============================================================

  const saveToIndex = useCallback(async () => {
    if (!isPersistenceEnabled) return;

    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE_PASSAGES], 'readwrite');
      const store = tx.objectStore(STORE_PASSAGES);

      // Save all passages
      for (const passage of passages) {
        // Convert dates to timestamps for storage
        const serialized = {
          ...passage,
          createdAt: passage.createdAt.getTime(),
          updatedAt: passage.updatedAt.getTime(),
          source: {
            ...passage.source,
            extractedAt: passage.source.extractedAt.getTime(),
          },
          metadata: {
            ...passage.metadata,
            date: passage.metadata.date?.getTime(),
          },
          history: passage.history.map(h => ({
            ...h,
            appliedAt: h.appliedAt.getTime(),
          })),
        };
        store.put(serialized);
      }

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      console.log(`Saved ${passages.length} passages to IndexedDB`);
    } catch (error) {
      console.error('Failed to save passages:', error);
    }
  }, [passages, isPersistenceEnabled]);

  const loadFromIndex = useCallback(async () => {
    if (!isPersistenceEnabled) return;

    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE_PASSAGES], 'readonly');
      const store = tx.objectStore(STORE_PASSAGES);

      const request = store.getAll();
      const results = await new Promise<any[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Convert timestamps back to dates
      const loadedPassages: Passage[] = results.map(p => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
        source: {
          ...p.source,
          extractedAt: new Date(p.source.extractedAt),
        },
        metadata: {
          ...p.metadata,
          date: p.metadata.date ? new Date(p.metadata.date) : undefined,
        },
        history: p.history.map((h: any) => ({
          ...h,
          appliedAt: new Date(h.appliedAt),
        })),
      }));

      setPassages(loadedPassages);

      // Initialize UI state for loaded passages
      const newUIState = new Map<string, PassageUIState>();
      for (const p of loadedPassages) {
        newUIState.set(p.id, createPassageUIState());
      }
      setUIState(newUIState);

      console.log(`Loaded ${loadedPassages.length} passages from IndexedDB`);
    } catch (error) {
      console.error('Failed to load passages:', error);
    }
  }, [isPersistenceEnabled]);

  // Auto-save when passages change
  useEffect(() => {
    if (isPersistenceEnabled && passages.length > 0) {
      const timeoutId = setTimeout(() => {
        saveToIndex();
      }, 1000); // Debounce saves

      return () => clearTimeout(timeoutId);
    }
  }, [passages, isPersistenceEnabled, saveToIndex]);

  // Load on mount
  useEffect(() => {
    if (isPersistenceEnabled) {
      loadFromIndex();
    }
  }, [isPersistenceEnabled, loadFromIndex]);

  // ============================================================
  // UNDO/REDO
  // ============================================================

  const undo = useCallback(() => {
    if (!canUndo) return;

    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setPassages(JSON.parse(JSON.stringify(history[newIndex])));
  }, [canUndo, history, historyIndex]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setPassages(JSON.parse(JSON.stringify(history[newIndex])));
  }, [canRedo, history, historyIndex]);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const value: PassageContextValue = {
    // State
    passages,
    uiState,
    activePassageId,
    selectedPassageIds,

    // CRUD
    addPassage,
    updatePassage,
    removePassage,
    clearPassages,
    getPassage,

    // Creation
    createFromText,
    createFromMarkdown,
    createFromFile,

    // Selection
    setActivePassage,
    selectPassage,
    deselectPassage,
    toggleSelection,
    clearSelection,
    selectAll,
    activePassage,
    selectedPassages,

    // UI State
    updateUIState,
    toggleExpanded,
    setEditing,

    // Operations
    splitPassage,
    mergePassages,
    duplicatePassage,

    // Block markers
    getMarkedContent,
    updateFromMarkedContent,
    getMarkerInstructions,

    // Transformation
    recordTransformation,

    // Text extraction
    getTextContent,
    getMarkdownContent,
    getPassageContent,

    // Collections
    collections,
    createCollection,
    deleteCollection,

    // Persistence
    saveToIndex,
    loadFromIndex,
    isPersistenceEnabled,
    setPersistenceEnabled,

    // History
    canUndo,
    undo,
    canRedo,
    redo,
  };

  return (
    <PassageContext.Provider value={value}>
      {children}
    </PassageContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function usePassages(): PassageContextValue {
  const context = useContext(PassageContext);
  if (context === undefined) {
    throw new Error('usePassages must be used within a PassageProvider');
  }
  return context;
}

export default PassageContext;
