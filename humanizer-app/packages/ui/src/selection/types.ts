/**
 * Selection System Types
 */

export interface TextSelection {
  /** Selected text content */
  text: string;

  /** Start offset in the source */
  startOffset: number;

  /** End offset in the source */
  endOffset: number;

  /** Bounding rect for positioning toolbar */
  rect: DOMRect | null;

  /** Source element reference */
  anchorNode: Node | null;
}

export interface TransformAction {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  group?: 'transform' | 'style' | 'generate' | 'analyze';
  handler: (selection: TextSelection) => void | Promise<void>;
}

export interface TransformMenuGroup {
  id: string;
  label: string;
  actions: TransformAction[];
}

export type SelectionMode = 'none' | 'selecting' | 'selected' | 'editing';
