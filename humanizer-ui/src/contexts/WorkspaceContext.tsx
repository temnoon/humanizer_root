/**
 * Workspace Context
 * Manages current content buffer and workspace state
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Transformation {
  id: string;
  type: 'humanize' | 'detect-ai' | 'persona-style' | 'round-trip' | 'custom';
  timestamp: Date;
  parameters?: Record<string, any>;
  resultBufferId?: string;
}

export interface Buffer {
  id: string;
  title: string;
  content: string;
  source: {
    type: 'paste' | 'gutenberg' | 'archive' | 'facebook' | 'instagram' | 'node' | 'file' | 'transformation';
    id?: string;
    metadata?: Record<string, any>;
  };
  created: Date;
  modified: Date;
  // Variation tracking (edits saved as variations, not to original)
  isVariation: boolean;
  originalBufferId?: string;
  variationNote?: string;
  // Transformation history
  transformations: Transformation[];
  parentTransformationId?: string;
}

interface WorkspaceContextValue {
  currentBuffer: Buffer | null;
  buffers: Buffer[];
  viewMode: 'single' | 'side-by-side';
  comparisonBufferId: string | null;
  createBuffer: (title: string, content: string, source: Buffer['source']) => string;
  createVariation: (originalId: string, content: string, note?: string) => string;
  createTransformedBuffer: (
    originalId: string,
    transformation: Omit<Transformation, 'id' | 'timestamp'>,
    resultContent: string,
    resultTitle: string
  ) => string;
  updateBuffer: (id: string, content: string) => void;
  switchBuffer: (id: string) => void;
  closeBuffer: (id: string) => void;
  setViewMode: (mode: 'single' | 'side-by-side') => void;
  setComparisonBuffer: (id: string | null) => void;
  clearWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [buffers, setBuffers] = useState<Buffer[]>([]);
  const [currentBufferId, setCurrentBufferId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'side-by-side'>('single');
  const [comparisonBufferId, setComparisonBufferId] = useState<string | null>(null);

  const currentBuffer = buffers.find(b => b.id === currentBufferId) || null;

  const createBuffer = (
    title: string,
    content: string,
    source: Buffer['source']
  ): string => {
    const newBuffer: Buffer = {
      id: `buffer-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      title,
      content,
      source,
      created: new Date(),
      modified: new Date(),
      isVariation: false,
      transformations: [],
    };

    setBuffers(prev => [...prev, newBuffer]);
    setCurrentBufferId(newBuffer.id);
    return newBuffer.id;
  };

  const createVariation = (
    originalId: string,
    content: string,
    note?: string
  ): string => {
    const original = buffers.find(b => b.id === originalId);
    if (!original) return '';

    const variation: Buffer = {
      id: `buffer-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      title: `${original.title} (variation)`,
      content,
      source: original.source,
      created: new Date(),
      modified: new Date(),
      isVariation: true,
      originalBufferId: originalId,
      variationNote: note,
      transformations: [],
    };

    setBuffers(prev => [...prev, variation]);
    return variation.id;
  };

  const createTransformedBuffer = (
    originalId: string,
    transformation: Omit<Transformation, 'id' | 'timestamp'>,
    resultContent: string,
    resultTitle: string
  ): string => {
    const original = buffers.find(b => b.id === originalId);
    if (!original) return '';

    const transformationRecord: Transformation = {
      id: `transform-${Date.now()}`,
      ...transformation,
      timestamp: new Date(),
    };

    const transformed: Buffer = {
      id: `buffer-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      title: resultTitle,
      content: resultContent,
      source: {
        type: 'transformation',
        id: originalId,
        metadata: {
          transformation: transformation.type,
          parameters: transformation.parameters,
        },
      },
      created: new Date(),
      modified: new Date(),
      isVariation: false,
      transformations: [transformationRecord],
      parentTransformationId: transformationRecord.id,
    };

    // Update original buffer with transformation record
    setBuffers(prev =>
      prev.map(b =>
        b.id === originalId
          ? {
              ...b,
              transformations: [
                ...b.transformations,
                { ...transformationRecord, resultBufferId: transformed.id },
              ],
            }
          : b
      )
    );

    setBuffers(prev => [...prev, transformed]);

    // Auto-switch to side-by-side view
    setViewMode('side-by-side');
    setComparisonBufferId(originalId);
    setCurrentBufferId(transformed.id);

    return transformed.id;
  };

  const updateBuffer = (id: string, content: string) => {
    setBuffers(prev =>
      prev.map(buffer =>
        buffer.id === id
          ? { ...buffer, content, modified: new Date() }
          : buffer
      )
    );
  };

  const switchBuffer = (id: string) => {
    setCurrentBufferId(id);
  };

  const closeBuffer = (id: string) => {
    setBuffers(prev => prev.filter(b => b.id !== id));
    if (currentBufferId === id) {
      const remaining = buffers.filter(b => b.id !== id);
      setCurrentBufferId(remaining[0]?.id || null);
    }
    if (comparisonBufferId === id) {
      setComparisonBufferId(null);
    }
  };

  const clearWorkspace = () => {
    setBuffers([]);
    setCurrentBufferId(null);
    setComparisonBufferId(null);
    setViewMode('single');
  };

  const value: WorkspaceContextValue = {
    currentBuffer,
    buffers,
    viewMode,
    comparisonBufferId,
    createBuffer,
    createVariation,
    createTransformedBuffer,
    updateBuffer,
    switchBuffer,
    closeBuffer,
    setViewMode,
    setComparisonBuffer: setComparisonBufferId,
    clearWorkspace,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
