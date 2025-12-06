/**
 * PassageStudio Component
 *
 * Standalone studio view for the Passage System.
 * Can be toggled as an alternative to MainWorkspace.
 */

import React, { useState, useCallback } from 'react';
import { PassageProvider, usePassages } from '../../contexts/PassageContext';
import { PassageList, FindSimilar } from '../passage';
import { usePassageTransform } from '../../hooks/usePassageTransform';
import type { Passage } from '../../types/passage';

// ============================================================
// STYLES
// ============================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--color-bg-primary, #f8fafc)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-md, 16px)',
    backgroundColor: 'var(--color-bg-secondary, #ffffff)',
    borderBottom: '1px solid var(--color-border, #e2e8f0)',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'var(--color-text-primary, #1e293b)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm, 8px)',
  },
  actionButton: {
    padding: '8px 16px',
    fontSize: '0.875rem',
    fontWeight: 500,
    border: '1px solid var(--color-border, #e2e8f0)',
    borderRadius: 'var(--radius-md, 8px)',
    backgroundColor: 'var(--color-bg-primary, #ffffff)',
    color: 'var(--color-text-secondary, #475569)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  actionButtonPrimary: {
    backgroundColor: 'var(--color-primary, #0891b2)',
    borderColor: 'var(--color-primary, #0891b2)',
    color: 'white',
  },
  mainContent: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  passageListContainer: {
    flex: 1,
    overflow: 'hidden',
    borderRight: '1px solid var(--color-border, #e2e8f0)',
  },
  sidePanel: {
    width: '400px',
    flexShrink: 0,
    overflow: 'auto',
    backgroundColor: 'var(--color-bg-secondary, #ffffff)',
  },
  sidePanelEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: 'var(--space-xl, 32px)',
    textAlign: 'center',
    color: 'var(--color-text-tertiary, #94a3b8)',
  },
  transformProgress: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm, 8px)',
    padding: 'var(--space-md, 16px)',
    backgroundColor: 'var(--color-info-light, #e0f2fe)',
    borderBottom: '1px solid var(--color-info, #0284c7)',
  },
  progressBar: {
    flex: 1,
    height: '4px',
    backgroundColor: 'var(--color-bg-tertiary, #f1f5f9)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'var(--color-primary, #0891b2)',
    transition: 'width 0.3s ease',
  },
  pasteArea: {
    padding: 'var(--space-md, 16px)',
    borderBottom: '1px solid var(--color-border, #e2e8f0)',
  },
  textarea: {
    width: '100%',
    minHeight: '100px',
    padding: 'var(--space-sm, 8px)',
    border: '1px solid var(--color-border, #e2e8f0)',
    borderRadius: 'var(--radius-md, 8px)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  pasteButton: {
    marginTop: 'var(--space-sm, 8px)',
    padding: '8px 16px',
    fontSize: '0.875rem',
    fontWeight: 500,
    border: 'none',
    borderRadius: 'var(--radius-md, 8px)',
    backgroundColor: 'var(--color-primary, #0891b2)',
    color: 'white',
    cursor: 'pointer',
  },
};

// ============================================================
// INNER CONTENT (needs PassageProvider)
// ============================================================

type SidePanelView = 'none' | 'find-similar' | 'transform' | 'paste';

function PassageStudioContent() {
  const {
    passages,
    uiState,
    activePassageId,
    selectedPassageIds,
    setActivePassage,
    toggleSelection,
    clearSelection,
    selectAll,
    toggleExpanded,
    splitPassage,
    mergePassages,
    duplicatePassage,
    removePassage,
    addPassage,
    createFromText,
    undo,
    redo,
    canUndo,
    canRedo,
  } = usePassages();

  const {
    transformPassage,
    transformMultiple,
    analyzePassage,
    state: transformState,
  } = usePassageTransform();

  const [sidePanelView, setSidePanelView] = useState<SidePanelView>('none');
  const [pasteText, setPasteText] = useState('');

  // Handle single passage selection (clicking checkbox)
  const handleSelect = useCallback((id: string) => {
    toggleSelection(id);
  }, [toggleSelection]);

  // Handle passage activation (clicking the card)
  const handleActivate = useCallback((id: string) => {
    setActivePassage(id);
  }, [setActivePassage]);

  // Handle expand/collapse
  const handleToggleExpand = useCallback((id: string) => {
    toggleExpanded(id);
  }, [toggleExpanded]);

  // Handle transformation
  const handleTransform = useCallback(async (id: string) => {
    setSidePanelView('transform');
    // For now, run computer-humanizer as default
    await transformPassage(id, 'computer-humanizer', { intensity: 'moderate' });
  }, [transformPassage]);

  // Handle analysis
  const handleAnalyze = useCallback(async (id: string) => {
    const result = await analyzePassage(id);
    if (result.success) {
      console.log('Analysis result:', result.metadata);
    }
  }, [analyzePassage]);

  // Handle find similar
  const handleFindSimilar = useCallback((id: string) => {
    setActivePassage(id);
    setSidePanelView('find-similar');
  }, [setActivePassage]);

  // Handle split
  const handleSplit = useCallback((id: string) => {
    const passage = passages.find(p => p.id === id);
    if (passage) {
      // Split in the middle by default
      const splitPoint = Math.floor(passage.content.length / 2);
      splitPassage(id, splitPoint);
    }
  }, [passages, splitPassage]);

  // Handle duplicate
  const handleDuplicate = useCallback((id: string) => {
    duplicatePassage(id);
  }, [duplicatePassage]);

  // Handle delete
  const handleDelete = useCallback((id: string) => {
    if (confirm('Delete this passage?')) {
      removePassage(id);
    }
  }, [removePassage]);

  // Bulk actions
  const handleBulkTransform = useCallback(async (ids: string[]) => {
    await transformMultiple(ids, 'computer-humanizer', { intensity: 'moderate' });
  }, [transformMultiple]);

  const handleBulkDelete = useCallback((ids: string[]) => {
    ids.forEach(id => removePassage(id));
    clearSelection();
  }, [removePassage, clearSelection]);

  const handleBulkMerge = useCallback((ids: string[]) => {
    mergePassages(ids);
    clearSelection();
  }, [mergePassages, clearSelection]);

  // Handle paste
  const handlePaste = useCallback(() => {
    if (pasteText.trim()) {
      const passage = createFromText(pasteText, { title: 'Pasted content' });
      addPassage(passage);
      setPasteText('');
      setSidePanelView('none');
    }
  }, [pasteText, createFromText, addPassage]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>Passage Studio</div>
        <div style={styles.actions}>
          <button
            style={styles.actionButton}
            onClick={() => setSidePanelView('paste')}
            title="Add new passage from text"
          >
            + Add Passage
          </button>
          <button
            style={styles.actionButton}
            onClick={undo}
            disabled={!canUndo}
            title="Undo"
          >
            Undo
          </button>
          <button
            style={styles.actionButton}
            onClick={redo}
            disabled={!canRedo}
            title="Redo"
          >
            Redo
          </button>
        </div>
      </div>

      {/* Transform Progress */}
      {transformState.isTransforming && (
        <div style={styles.transformProgress}>
          <span>Transforming with {transformState.currentTool}...</span>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${transformState.progress}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Passage List */}
        <div style={styles.passageListContainer}>
          <PassageList
            passages={passages}
            uiState={uiState}
            activePassageId={activePassageId}
            selectedPassageIds={selectedPassageIds}
            onSelect={handleSelect}
            onActivate={handleActivate}
            onToggleExpand={handleToggleExpand}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onTransform={handleTransform}
            onAnalyze={handleAnalyze}
            onFindSimilar={handleFindSimilar}
            onSplit={handleSplit}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onBulkTransform={handleBulkTransform}
            onBulkDelete={handleBulkDelete}
            onBulkMerge={handleBulkMerge}
          />
        </div>

        {/* Side Panel */}
        <div style={styles.sidePanel}>
          {sidePanelView === 'find-similar' && activePassageId ? (
            <FindSimilar
              passageId={activePassageId}
              onClose={() => setSidePanelView('none')}
            />
          ) : sidePanelView === 'paste' ? (
            <div style={styles.pasteArea}>
              <h3 style={{ marginBottom: '12px', color: 'var(--color-text-primary)' }}>
                Add New Passage
              </h3>
              <textarea
                style={styles.textarea}
                placeholder="Paste or type text here..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  style={styles.pasteButton}
                  onClick={handlePaste}
                  disabled={!pasteText.trim()}
                >
                  Create Passage
                </button>
                <button
                  style={styles.actionButton}
                  onClick={() => {
                    setPasteText('');
                    setSidePanelView('none');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.sidePanelEmpty}>
              <div style={{ fontSize: '2rem', marginBottom: '16px', opacity: 0.5 }}>
                &#128269;
              </div>
              <div>Select a passage and click "Find Similar"</div>
              <div style={{ fontSize: '0.8rem', marginTop: '8px' }}>
                or use the "Add Passage" button to import text
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN EXPORT (with Provider)
// ============================================================

export interface PassageStudioProps {
  archiveName?: string;
  enablePersistence?: boolean;
}

export function PassageStudio({
  archiveName = 'main',
  enablePersistence = true,
}: PassageStudioProps) {
  return (
    <PassageProvider
      archiveName={archiveName}
      enablePersistence={enablePersistence}
    >
      <PassageStudioContent />
    </PassageProvider>
  );
}

export default PassageStudio;
