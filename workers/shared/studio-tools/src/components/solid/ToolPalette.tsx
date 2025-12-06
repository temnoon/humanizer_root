/**
 * ToolPalette - Main container for tool selection and execution
 */

import { Component, Show, For, createSignal, createMemo, onMount } from 'solid-js';
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
  class?: string;
}

export const ToolPalette: Component<ToolPaletteProps> = (props) => {
  const [selectedCategory, setSelectedCategory] = createSignal<ToolCategory>(
    props.defaultCategory ?? 'transformation'
  );
  const [selectedTool, setSelectedTool] = createSignal<ToolDefinition | null>(null);
  const [drawerOpen, setDrawerOpen] = createSignal(false);
  const [parameterValues, setParameterValues] = createSignal<Record<string, Record<string, unknown>>>({});
  const [isExecuting, setIsExecuting] = createSignal(false);
  const [currentResult, setCurrentResult] = createSignal<ToolResult | null>(null);

  // Load persisted parameters on mount
  onMount(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setParameterValues(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  });

  // Persist parameters when they change
  const persistParameters = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parameterValues()));
    } catch {
      // Ignore storage errors
    }
  };

  // Get categories
  const categories = getCategoriesSorted();

  // Get tools for current category, filtered by interface and tier
  const availableTools = createMemo(() => {
    let tools = getFilteredTools({
      category: selectedCategory(),
      interfaceId: props.interfaceId,
    });

    // Filter out hidden tools
    if (props.hiddenTools?.length) {
      tools = tools.filter((t) => !props.hiddenTools!.includes(t.id));
    }

    // Add additional interface-specific tools
    if (props.additionalTools?.length) {
      const extra = props.additionalTools.filter(
        (t) => t.category === selectedCategory()
      );
      tools = [...tools, ...extra];
    }

    return tools;
  });

  // Get current tool's parameters
  const currentParams = createMemo(() => {
    const tool = selectedTool();
    if (!tool) return {};
    return parameterValues()[tool.id] ?? {};
  });

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
    const tool = selectedTool();
    if (!tool) return;

    setParameterValues((prev) => ({
      ...prev,
      [tool.id]: {
        ...prev[tool.id],
        [name]: value,
      },
    }));
    persistParameters();
  };

  // Handle tool execution
  const handleExecute = async () => {
    const tool = selectedTool();
    if (!tool) return;

    setIsExecuting(true);
    setCurrentResult(null);

    try {
      const result = await executeTool(tool, props.content, currentParams());
      setCurrentResult(result);
    } catch (err) {
      setCurrentResult({
        success: false,
        toolId: tool.id,
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
    const result = currentResult();
    if (result) {
      props.onApplyResult(result);
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
    const available = isToolAvailable(tool.id, props.interfaceId, props.userTier);
    const reason = available ? null : getUnavailableReason(tool.id, props.interfaceId, props.userTier);
    return { available, reason };
  };

  return (
    <div class={`st-palette ${props.class ?? ''}`}>
      {/* Category tabs */}
      <div class="st-palette__categories">
        <For each={categories}>
          {(category) => (
            <button
              class="st-palette__category"
              classList={{ 'st-palette__category--active': selectedCategory() === category.id }}
              onClick={() => handleCategorySelect(category.id)}
              title={category.description}
            >
              <span class="st-palette__category-icon">{category.icon}</span>
              <span class="st-palette__category-name">{category.name}</span>
            </button>
          )}
        </For>
      </div>

      {/* Tool grid */}
      <div class="st-palette__tools">
        <Show
          when={availableTools().length > 0}
          fallback={
            <div class="st-palette__empty">
              No tools available in this category
            </div>
          }
        >
          <For each={availableTools()}>
            {(tool) => {
              const { available, reason } = getToolAvailability(tool);
              return (
                <ToolCard
                  tool={tool}
                  selected={selectedTool()?.id === tool.id}
                  disabled={!available}
                  disabledReason={reason ?? undefined}
                  onClick={() => handleToolSelect(tool)}
                />
              );
            }}
          </For>
        </Show>
      </div>

      {/* Tool drawer */}
      <Show when={selectedTool()}>
        <ToolDrawer
          tool={selectedTool()!}
          content={props.content}
          open={drawerOpen()}
          onClose={handleDrawerClose}
          parameters={currentParams()}
          onParameterChange={handleParameterChange}
          onExecute={handleExecute}
          isExecuting={isExecuting()}
          result={currentResult()}
          onApply={handleApply}
          onDiscard={handleDiscard}
        />
      </Show>
    </div>
  );
};
