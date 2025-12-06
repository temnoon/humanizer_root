/** @jsxImportSource react */
/**
 * ToolPalette - Main container for tool selection and execution (React version)
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import type { ToolCategory, ToolDefinition, ToolResult, InterfaceId, UserTier } from '../../types';
import { getCategoriesSorted } from '../../registry/category-registry';
import { getFilteredTools, isToolAvailable, getUnavailableReason } from '../../registry/tool-registry';
import { executeTool } from '../../services/npe-api-client';
import { ToolCard } from './ToolCard';
import { ToolDrawer } from './ToolDrawer';

// Storage key for persisting parameter values
const STORAGE_KEY = 'humanizer:tool-parameters';

export interface ToolPaletteProps {
  // Content to transform
  content: string;

  // Interface and user context
  interfaceId: InterfaceId;
  userTier: UserTier;

  // Callbacks
  onApplyResult: (result: ToolResult) => void;
  onChainTool?: (result: ToolResult, nextToolId: string) => void;

  // Optional customization
  defaultCategory?: ToolCategory;
  hiddenTools?: string[];
  additionalTools?: ToolDefinition[];

  // Styling
  className?: string;
}

export function ToolPalette({
  content,
  interfaceId,
  userTier,
  onApplyResult,
  defaultCategory = 'transformation',
  hiddenTools,
  additionalTools,
  className,
}: ToolPaletteProps) {
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory>(defaultCategory);
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [parameterValues, setParameterValues] = useState<Record<string, Record<string, unknown>>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentResult, setCurrentResult] = useState<ToolResult | null>(null);

  // Load persisted parameters on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setParameterValues(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Persist parameters when they change
  const persistParameters = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parameterValues));
    } catch {
      // Ignore storage errors
    }
  }, [parameterValues]);

  // Get categories
  const categories = useMemo(() => getCategoriesSorted(), []);

  // Get tools for current category, filtered by interface and tier
  const availableTools = useMemo(() => {
    let tools = getFilteredTools({
      category: selectedCategory,
      interfaceId,
    });

    // Filter out hidden tools
    if (hiddenTools?.length) {
      tools = tools.filter((t) => !hiddenTools.includes(t.id));
    }

    // Add additional interface-specific tools
    if (additionalTools?.length) {
      const extra = additionalTools.filter(
        (t) => t.category === selectedCategory
      );
      tools = [...tools, ...extra];
    }

    return tools;
  }, [selectedCategory, interfaceId, hiddenTools, additionalTools]);

  // Get current tool's parameters
  const currentParams = useMemo(() => {
    if (!selectedTool) return {};
    return parameterValues[selectedTool.id] ?? {};
  }, [selectedTool, parameterValues]);

  // Handle category selection
  const handleCategorySelect = (category: ToolCategory) => {
    setSelectedCategory(category);
    // Don't close drawer, user might be browsing
  };

  // Handle tool selection
  const handleToolSelect = (tool: ToolDefinition) => {
    setSelectedTool(tool);
    setCurrentResult(null);
    setDrawerOpen(true);
  };

  // Handle parameter change
  const handleParameterChange = (name: string, value: unknown) => {
    if (!selectedTool) return;

    setParameterValues((prev) => ({
      ...prev,
      [selectedTool.id]: {
        ...prev[selectedTool.id],
        [name]: value,
      },
    }));
    // Persist after state update
    setTimeout(persistParameters, 0);
  };

  // Handle tool execution
  const handleExecute = async () => {
    if (!selectedTool) return;

    setIsExecuting(true);
    setCurrentResult(null);

    try {
      const result = await executeTool(selectedTool, content, currentParams);
      setCurrentResult(result);
    } catch (err) {
      setCurrentResult({
        success: false,
        toolId: selectedTool.id,
        error: {
          code: 'EXECUTION_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle apply result
  const handleApply = () => {
    if (currentResult) {
      onApplyResult(currentResult);
      setDrawerOpen(false);
      setCurrentResult(null);
    }
  };

  // Handle discard
  const handleDiscard = () => {
    setCurrentResult(null);
  };

  // Handle drawer close
  const handleDrawerClose = () => {
    setDrawerOpen(false);
    // Keep result in case user reopens
  };

  // Check if tool is available for user
  const getToolAvailability = (tool: ToolDefinition) => {
    const available = isToolAvailable(tool.id, interfaceId, userTier);
    const reason = available ? null : getUnavailableReason(tool.id, interfaceId, userTier);
    return { available, reason };
  };

  return (
    <div className={`st-palette ${className ?? ''}`}>
      {/* Category tabs */}
      <div className="st-palette__categories">
        {categories.map((category) => (
          <button
            key={category.id}
            className={`st-palette__category ${selectedCategory === category.id ? 'st-palette__category--active' : ''}`}
            onClick={() => handleCategorySelect(category.id)}
            title={category.description}
          >
            <span className="st-palette__category-icon">{category.icon}</span>
            <span className="st-palette__category-name">{category.name}</span>
          </button>
        ))}
      </div>

      {/* Tool grid */}
      <div className="st-palette__tools">
        {availableTools.length > 0 ? (
          availableTools.map((tool) => {
            const { available, reason } = getToolAvailability(tool);
            return (
              <ToolCard
                key={tool.id}
                tool={tool}
                selected={selectedTool?.id === tool.id}
                disabled={!available}
                disabledReason={reason ?? undefined}
                onClick={() => handleToolSelect(tool)}
              />
            );
          })
        ) : (
          <div className="st-palette__empty">
            No tools available in this category
          </div>
        )}
      </div>

      {/* Tool drawer */}
      {selectedTool && (
        <ToolDrawer
          tool={selectedTool}
          content={content}
          open={drawerOpen}
          onClose={handleDrawerClose}
          parameters={currentParams}
          onParameterChange={handleParameterChange}
          onExecute={handleExecute}
          isExecuting={isExecuting}
          result={currentResult}
          onApply={handleApply}
          onDiscard={handleDiscard}
        />
      )}
    </div>
  );
}
