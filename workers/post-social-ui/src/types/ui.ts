/**
 * UI State Types
 */

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export interface ModalState {
  isOpen: boolean;
  title?: string;
  content?: any;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface PanelWidths {
  left: number;
  right: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  panelWidths: PanelWidths;
}
