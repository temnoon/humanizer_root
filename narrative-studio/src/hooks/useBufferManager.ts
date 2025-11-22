import { useState, useCallback } from 'react';
import type { SessionBuffer, Edit } from '../services/sessionStorage';
import { getSessionLimit } from '../config/session-limits';

interface BufferManagerState {
  buffers: SessionBuffer[];
  activeBufferId: string;
  sourceBufferForNextOp: string | null; // For "Transform Result" chaining
}

export function useBufferManager(userTier: string = 'free') {
  const [state, setState] = useState<BufferManagerState>({
    buffers: [],
    activeBufferId: '',
    sourceBufferForNextOp: null
  });

  const limits = getSessionLimit(userTier);

  // Create a new buffer
  const createBuffer = useCallback((bufferData: Partial<SessionBuffer>): SessionBuffer | null => {
    if (state.buffers.length >= limits.buffersPerSession) {
      console.warn(`Buffer limit reached: ${limits.buffersPerSession}`);
      return null;
    }

    const newBuffer: SessionBuffer = {
      bufferId: bufferData.bufferId || `buffer-${Date.now()}`,
      type: bufferData.type || 'original',
      displayName: bufferData.displayName || 'Untitled',
      sourceBufferId: bufferData.sourceBufferId,
      sourceRef: bufferData.sourceRef,
      sourceSelection: bufferData.sourceSelection,
      tool: bufferData.tool,
      settings: bufferData.settings,
      text: bufferData.text,
      resultText: bufferData.resultText,
      analysisResult: bufferData.analysisResult,
      metadata: bufferData.metadata,
      userEdits: bufferData.userEdits || [],
      isEdited: bufferData.isEdited || false,
      created: bufferData.created || new Date().toISOString()
    };

    setState(prev => ({
      ...prev,
      buffers: [...prev.buffers, newBuffer],
      activeBufferId: newBuffer.bufferId
    }));

    return newBuffer;
  }, [state.buffers.length, limits.buffersPerSession]);

  // Create original buffer from archive message
  const createOriginalBuffer = useCallback((text: string, archiveRef: string, messageId?: string) => {
    return createBuffer({
      bufferId: 'buffer-0',
      type: 'original',
      displayName: 'Original',
      sourceRef: `archive:${archiveRef}:${messageId || 'unknown'}`,
      text,
      isEdited: false
    });
  }, [createBuffer]);

  // Create transformation buffer
  const createTransformationBuffer = useCallback((
    tool: string,
    settings: Record<string, any>,
    resultText: string,
    sourceBufferId?: string
  ) => {
    const sourceId = sourceBufferId || state.sourceBufferForNextOp || 'buffer-0';
    const toolDisplayName = formatToolName(tool, settings);

    return createBuffer({
      type: 'transformation',
      displayName: toolDisplayName,
      sourceBufferId: sourceId,
      tool,
      settings,
      resultText,
      isEdited: false
    });
  }, [createBuffer, state.sourceBufferForNextOp]);

  // Create analysis buffer
  const createAnalysisBuffer = useCallback((
    tool: string,
    analysisResult: any,
    sourceBufferId?: string
  ) => {
    const sourceId = sourceBufferId || state.sourceBufferForNextOp || 'buffer-0';
    const toolDisplayName = `${formatToolName(tool, {})}: Analysis`;

    return createBuffer({
      type: 'analysis',
      displayName: toolDisplayName,
      sourceBufferId: sourceId,
      tool,
      analysisResult,
      isEdited: false
    });
  }, [createBuffer, state.sourceBufferForNextOp]);

  // Get active buffer
  const getActiveBuffer = useCallback((): SessionBuffer | null => {
    return state.buffers.find(b => b.bufferId === state.activeBufferId) || null;
  }, [state.buffers, state.activeBufferId]);

  // Get buffer by ID
  const getBuffer = useCallback((bufferId: string): SessionBuffer | null => {
    return state.buffers.find(b => b.bufferId === bufferId) || null;
  }, [state.buffers]);

  // Set active buffer
  const setActiveBuffer = useCallback((bufferId: string) => {
    setState(prev => ({
      ...prev,
      activeBufferId: bufferId
    }));
  }, []);

  // Enable "Transform Result" mode (chain from current buffer)
  const enableChainMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      sourceBufferForNextOp: prev.activeBufferId
    }));
  }, []);

  // Disable "Transform Result" mode (back to original)
  const disableChainMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      sourceBufferForNextOp: null
    }));
  }, []);

  // Track user edit in buffer
  const addEdit = useCallback((bufferId: string, edit: Edit) => {
    setState(prev => ({
      ...prev,
      buffers: prev.buffers.map(buffer => {
        if (buffer.bufferId === bufferId) {
          return {
            ...buffer,
            userEdits: [...(buffer.userEdits || []), edit],
            isEdited: true
          };
        }
        return buffer;
      })
    }));
  }, []);

  // Update buffer text (for user edits)
  const updateBufferText = useCallback((bufferId: string, newText: string, oldText: string) => {
    const edit: Edit = {
      timestamp: new Date().toISOString(),
      type: 'replace',
      position: { start: 0, end: oldText.length },
      oldText,
      newText
    };

    addEdit(bufferId, edit);

    setState(prev => ({
      ...prev,
      buffers: prev.buffers.map(buffer => {
        if (buffer.bufferId === bufferId) {
          return {
            ...buffer,
            resultText: buffer.type === 'original' ? undefined : newText,
            text: buffer.type === 'original' ? newText : buffer.text,
            isEdited: true
          };
        }
        return buffer;
      })
    }));
  }, [addEdit]);

  // Close buffer (remove from list)
  const closeBuffer = useCallback((bufferId: string) => {
    // Can't close the original buffer
    if (bufferId === 'buffer-0') {
      console.warn('Cannot close original buffer');
      return;
    }

    setState(prev => {
      const newBuffers = prev.buffers.filter(b => b.bufferId !== bufferId);
      const newActiveId = prev.activeBufferId === bufferId
        ? (newBuffers[newBuffers.length - 1]?.bufferId || 'buffer-0')
        : prev.activeBufferId;

      return {
        ...prev,
        buffers: newBuffers,
        activeBufferId: newActiveId
      };
    });
  }, []);

  // Load buffers from session
  const loadBuffers = useCallback((buffers: SessionBuffer[], activeBufferId: string) => {
    setState({
      buffers,
      activeBufferId,
      sourceBufferForNextOp: null
    });
  }, []);

  // Clear all buffers
  const clearBuffers = useCallback(() => {
    setState({
      buffers: [],
      activeBufferId: '',
      sourceBufferForNextOp: null
    });
  }, []);

  return {
    buffers: state.buffers,
    activeBufferId: state.activeBufferId,
    sourceBufferForNextOp: state.sourceBufferForNextOp,
    isChainMode: state.sourceBufferForNextOp !== null,
    createBuffer,
    createOriginalBuffer,
    createTransformationBuffer,
    createAnalysisBuffer,
    getActiveBuffer,
    getBuffer,
    setActiveBuffer,
    enableChainMode,
    disableChainMode,
    addEdit,
    updateBufferText,
    closeBuffer,
    loadBuffers,
    clearBuffers
  };
}

// Helper: Format tool name for display
function formatToolName(tool: string, settings: Record<string, any>): string {
  const toolNames: Record<string, string> = {
    'computer-humanizer': 'Computer Humanizer',
    'ai-detection-lite': 'AI Detection: Lite',
    'ai-detection-gptzero': 'AI Detection: GPTZero',
    'persona': `Persona: ${settings.persona || 'Unknown'}`,
    'style': `Style: ${settings.style || 'Unknown'}`,
    'round-trip': `Round-Trip: ${settings.language || 'Unknown'}`,
    'namespace': 'Namespace',
    'allegorical': 'Allegorical'
  };

  return toolNames[tool] || tool;
}
