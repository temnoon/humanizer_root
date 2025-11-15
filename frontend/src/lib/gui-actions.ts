/**
 * GUIActionExecutor - Phase 3 of AUI Implementation
 *
 * Executes GUI actions triggered by the AI agent, providing:
 * - Automated navigation
 * - State updates
 * - Visual feedback
 * - Animation coordination
 *
 * Created: Oct 15, 2025 (Evening)
 */

import type { SidebarView } from '@/types/sidebar';
import type { MediaItem } from '@/lib/api-client';
import type { TransformationResult } from '../App';

/**
 * GUI action names - must match agent.py tool definitions
 */
export type GUIActionName =
  | 'open_search_results'
  | 'open_neighbors_view'
  | 'open_perturbation_view'
  | 'open_trajectory_view'
  | 'open_cluster_view'
  | 'open_conversation_list'
  | 'open_conversation_viewer'
  | 'open_transformation_panel'
  | 'open_media_gallery'
  | 'update_interest_list'
  | 'open_connection_graph'
  | 'open_interest_list_panel'
  | 'create_interest_list_from_results';

/**
 * GUI action data - varies by action type
 */
export interface GUIActionData {
  // Search results
  results?: Array<{
    conversation_uuid: string;
    message_uuid?: string;
    similarity?: number;
    title?: string;
    preview?: string;
  }>;

  // Conversation viewer
  conversation_uuid?: string;
  message_uuid?: string; // For scrolling to specific message

  // Neighbors/clusters
  neighbors?: Array<{
    message_uuid: string;
    similarity: number;
    text: string;
  }>;
  clusters?: Array<{
    label: string;
    messages: string[];
    centroid?: number[];
  }>;

  // Perturbation/trajectory
  perturbation_data?: {
    original: any;
    perturbed: any;
    direction: string;
    magnitude: number;
  };
  trajectory_data?: {
    steps: Array<{
      text: string;
      measurements: any;
    }>;
  };

  // Transformation
  transformation?: TransformationResult;

  // Media
  media?: MediaItem[];
  selected_media_id?: string;

  // Interest tracking
  interest_item?: {
    item_type: string;
    item_id: string;
    title?: string;
  };
  connections?: Array<{
    from_id: string;
    to_id: string;
    connection_type: string;
  }>;

  // Interest list creation
  list_name?: string;
  list_description?: string;
  conversation_ids?: string[];
}

/**
 * GUI state setters - passed from App.tsx
 */
export interface GUIStateSetters {
  setCurrentView: (view: SidebarView) => void;
  setSelectedConversation: (id: string | null) => void;
  setSelectedContent: (content: any) => void;
  setSelectedMedia: (media: MediaItem | null) => void;
  setTransformationResult: (result: TransformationResult | null) => void;
  // Add custom state for new views
  setSearchResults?: (results: any[]) => void;
  setNeighborsView?: (data: any) => void;
  setPerturbationView?: (data: any) => void;
  setTrajectoryView?: (data: any) => void;
  setClusterView?: (data: any) => void;
}

/**
 * Visual feedback configuration
 */
export interface FeedbackConfig {
  animate?: boolean;
  highlight?: boolean;
  duration?: number; // ms
  scrollTo?: boolean;
}

/**
 * GUIActionExecutor - Main class for executing GUI actions
 */
export class GUIActionExecutor {
  private stateSetters: GUIStateSetters;
  private feedbackCallbacks: Map<string, (element: HTMLElement) => void>;

  constructor(stateSetters: GUIStateSetters) {
    this.stateSetters = stateSetters;
    this.feedbackCallbacks = new Map();
  }

  /**
   * Register a feedback callback for DOM manipulation
   */
  registerFeedback(elementId: string, callback: (element: HTMLElement) => void) {
    this.feedbackCallbacks.set(elementId, callback);
  }

  /**
   * Execute a GUI action
   */
  async execute(
    action: GUIActionName,
    data: GUIActionData,
    config: FeedbackConfig = { animate: true, highlight: true, scrollTo: true }
  ): Promise<void> {
    console.log('🎬 GUI Action:', action, data);

    // Execute the action
    switch (action) {
      case 'open_search_results':
        await this.openSearchResults(data, config);
        break;

      case 'open_neighbors_view':
        await this.openNeighborsView(data, config);
        break;

      case 'open_perturbation_view':
        await this.openPerturbationView(data, config);
        break;

      case 'open_trajectory_view':
        await this.openTrajectoryView(data, config);
        break;

      case 'open_cluster_view':
        await this.openClusterView(data, config);
        break;

      case 'open_conversation_list':
        await this.openConversationList(data, config);
        break;

      case 'open_conversation_viewer':
        await this.openConversationViewer(data, config);
        break;

      case 'open_transformation_panel':
        await this.openTransformationPanel(data, config);
        break;

      case 'open_media_gallery':
        await this.openMediaGallery(data, config);
        break;

      case 'update_interest_list':
        await this.updateInterestList(data, config);
        break;

      case 'open_connection_graph':
        await this.openConnectionGraph(data, config);
        break;

      case 'open_interest_list_panel':
        await this.openInterestListPanel(data, config);
        break;

      case 'create_interest_list_from_results':
        await this.createInterestListFromResults(data, config);
        break;

      default:
        console.warn('❌ Unknown GUI action:', action);
    }

    // Apply visual feedback
    if (config.animate || config.highlight) {
      await this.applyVisualFeedback(action, config);
    }
  }

  /**
   * Open search results in main pane
   */
  private async openSearchResults(data: GUIActionData, _config: FeedbackConfig) {
    const { setCurrentView, setSearchResults } = this.stateSetters;

    if (data.results && setSearchResults) {
      setSearchResults(data.results);
    }

    // Navigate to conversations view to show results
    setCurrentView('conversations');

    // If there's a top result, open it
    if (data.results && data.results.length > 0 && _config.scrollTo) {
      const topResult = data.results[0];
      if (topResult.conversation_uuid) {
        // Wait for view to render, then open top conversation
        await this.delay(100);
        this.stateSetters.setSelectedConversation(topResult.conversation_uuid);
      }
    }
  }

  /**
   * Open neighbors view for a message
   */
  private async openNeighborsView(data: GUIActionData, _config: FeedbackConfig) {
    const { setCurrentView, setNeighborsView } = this.stateSetters;

    if (data.neighbors && setNeighborsView) {
      setNeighborsView({
        neighbors: data.neighbors,
        source_message: data.message_uuid,
      });
    }

    setCurrentView('conversations');
  }

  /**
   * Open perturbation analysis view
   */
  private async openPerturbationView(data: GUIActionData, _config: FeedbackConfig) {
    const { setCurrentView, setPerturbationView } = this.stateSetters;

    if (data.perturbation_data && setPerturbationView) {
      setPerturbationView(data.perturbation_data);
    }

    setCurrentView('tools');
  }

  /**
   * Open trajectory visualization
   */
  private async openTrajectoryView(data: GUIActionData, _config: FeedbackConfig) {
    const { setCurrentView, setTrajectoryView } = this.stateSetters;

    if (data.trajectory_data && setTrajectoryView) {
      setTrajectoryView(data.trajectory_data);
    }

    setCurrentView('tools');
  }

  /**
   * Open cluster view
   */
  private async openClusterView(data: GUIActionData, _config: FeedbackConfig) {
    const { setCurrentView, setClusterView } = this.stateSetters;

    if (data.clusters && setClusterView) {
      setClusterView({
        clusters: data.clusters,
        n_clusters: data.clusters.length,
      });
    }

    setCurrentView('conversations');
  }

  /**
   * Open conversation list
   */
  private async openConversationList(_data: GUIActionData, _config: FeedbackConfig) {
    const { setCurrentView } = this.stateSetters;
    setCurrentView('conversations');
  }

  /**
   * Open specific conversation viewer
   */
  private async openConversationViewer(data: GUIActionData, config: FeedbackConfig) {
    const { setCurrentView, setSelectedConversation } = this.stateSetters;

    if (data.conversation_uuid) {
      setSelectedConversation(data.conversation_uuid);
      setCurrentView('conversations');

      // Scroll to specific message if provided
      if (data.message_uuid && config.scrollTo) {
        await this.delay(200); // Wait for conversation to load
        this.scrollToMessage(data.message_uuid);
      }
    }
  }

  /**
   * Open transformation panel with result
   */
  private async openTransformationPanel(data: GUIActionData, _config: FeedbackConfig) {
    const { setTransformationResult } = this.stateSetters;

    if (data.transformation) {
      setTransformationResult(data.transformation);
    }
  }

  /**
   * Open media gallery
   */
  private async openMediaGallery(data: GUIActionData, _config: FeedbackConfig) {
    const { setCurrentView, setSelectedMedia } = this.stateSetters;

    setCurrentView('media');

    // Select specific media item if provided
    if (data.selected_media_id && data.media) {
      const mediaItem = data.media.find((m: any) => m.file_id === data.selected_media_id);
      if (mediaItem) {
        await this.delay(100);
        setSelectedMedia(mediaItem);
      }
    }
  }

  /**
   * Update interest list
   */
  private async updateInterestList(data: GUIActionData, _config: FeedbackConfig) {
    // Interest list updates are handled by the backend
    // Just provide visual feedback
    console.log('✅ Interest item tracked:', data.interest_item);
  }

  /**
   * Open connection graph view
   */
  private async openConnectionGraph(data: GUIActionData, _config: FeedbackConfig) {
    const { setCurrentView } = this.stateSetters;

    // TODO: Implement connection graph view in Phase 4
    console.log('🔗 Connection graph:', data.connections);
    setCurrentView('interest');
  }

  /**
   * Open interest list panel
   */
  private async openInterestListPanel(_data: GUIActionData, _config: FeedbackConfig) {
    const { setCurrentView } = this.stateSetters;
    setCurrentView('interest');
  }

  /**
   * Create an interest list from search/query results
   */
  private async createInterestListFromResults(data: GUIActionData, _config: FeedbackConfig) {
    console.log('🎯 Creating interest list from results:', data);

    if (!data.list_name || !data.conversation_ids || data.conversation_ids.length === 0) {
      console.warn('❌ Missing list_name or conversation_ids in data:', data);
      return;
    }

    try {
      // Import api client dynamically
      const { api } = await import('@/lib/api-client');

      // Create the interest list
      const newList = await api.createInterestList({
        name: data.list_name,
        description: data.list_description || '',
        listType: 'query_result',
      });

      console.log('✅ Created interest list:', newList);

      // Add each conversation to the list WITH METADATA
      for (const convId of data.conversation_ids) {
        try {
          // Fetch conversation metadata
          const conv = await api.getConversation(convId);

          // Add to list with proper metadata
          await api.addToInterestList(newList.id, {
            itemType: 'conversation',
            itemUuid: convId,
            itemMetadata: {
              title: conv.title || 'Untitled',
              content_preview: conv.title || '',
              message_count: conv.message_count || 0,
            },
          });
        } catch (error) {
          console.error(`⚠️ Failed to fetch metadata for conversation ${convId}:`, error);
          // Fallback: add with empty metadata
          await api.addToInterestList(newList.id, {
            itemType: 'conversation',
            itemUuid: convId,
            itemMetadata: {
              title: 'Untitled',
              content_preview: '',
            },
          });
        }
      }

      console.log(`✅ Added ${data.conversation_ids.length} conversations to list`);

      // Navigate to interest list view and close AUI modal
      this.stateSetters.setCurrentView('lists');

      // Signal to close AUI modal (parent component will handle)
      window.dispatchEvent(new CustomEvent('aui-action-complete', {
        detail: { action: 'create_interest_list_from_results', listId: newList.id }
      }));

      // Provide visual feedback
      await this.delay(100);

    } catch (error) {
      console.error('❌ Failed to create interest list:', error);
    }
  }

  /**
   * Scroll to a specific message
   */
  private scrollToMessage(messageUuid: string) {
    const element = document.querySelector(`[data-message-id="${messageUuid}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.highlightElement(element as HTMLElement);
    }
  }

  /**
   * Highlight an element temporarily
   */
  private highlightElement(element: HTMLElement, duration: number = 2000) {
    element.classList.add('gui-action-highlight');
    setTimeout(() => {
      element.classList.remove('gui-action-highlight');
    }, duration);
  }

  /**
   * Apply visual feedback after action
   */
  private async applyVisualFeedback(action: GUIActionName, config: FeedbackConfig) {
    if (!config.animate) return;

    // Find the target element based on action
    const targetId = this.getTargetElementId(action);
    if (!targetId) return;

    const element = document.getElementById(targetId);
    if (!element) return;

    // Apply animation
    if (config.animate) {
      element.classList.add('gui-action-animate');
      await this.delay(config.duration || 300);
      element.classList.remove('gui-action-animate');
    }

    // Apply highlight
    if (config.highlight) {
      this.highlightElement(element, config.duration || 2000);
    }

    // Execute custom feedback callback
    const callback = this.feedbackCallbacks.get(targetId);
    if (callback) {
      callback(element);
    }
  }

  /**
   * Map action to target element ID
   */
  private getTargetElementId(action: GUIActionName): string | null {
    const mapping: Record<GUIActionName, string> = {
      open_search_results: 'main-pane',
      open_neighbors_view: 'main-pane',
      open_perturbation_view: 'tool-panel',
      open_trajectory_view: 'tool-panel',
      open_cluster_view: 'main-pane',
      open_conversation_list: 'sidebar',
      open_conversation_viewer: 'main-pane',
      open_transformation_panel: 'tool-panel',
      open_media_gallery: 'main-pane',
      update_interest_list: 'interest-panel',
      open_connection_graph: 'main-pane',
      open_interest_list_panel: 'sidebar',
      create_interest_list_from_results: 'sidebar',
    };

    return mapping[action] || null;
  }

  /**
   * Utility: delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * CSS classes for visual feedback (add to global CSS)
 */
export const GUI_ACTION_STYLES = `
.gui-action-highlight {
  animation: gui-highlight 2s ease-out;
}

@keyframes gui-highlight {
  0% {
    box-shadow: 0 0 0 0 var(--accent-purple);
    background-color: var(--accent-purple-alpha-10);
  }
  50% {
    box-shadow: 0 0 20px 5px var(--accent-purple);
    background-color: var(--accent-purple-alpha-20);
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
    background-color: transparent;
  }
}

.gui-action-animate {
  animation: gui-slide-in 0.3s ease-out;
}

@keyframes gui-slide-in {
  0% {
    opacity: 0;
    transform: translateY(-10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
`;
