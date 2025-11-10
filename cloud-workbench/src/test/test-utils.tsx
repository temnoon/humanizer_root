import type { ReactElement } from 'react';
import type { RenderOptions } from '@testing-library/react';n
import { render } from '@testing-library/react';
import { CanvasProvider } from '../core/context/CanvasContext';
import { ArchiveProvider } from '../core/context/ArchiveContext';

/**
 * Custom render function that wraps components with necessary providers
 */
interface AllTheProvidersProps {
  children: React.ReactNode;
}

function AllTheProviders({ children }: AllTheProvidersProps) {
  return (
    <ArchiveProvider>
      <CanvasProvider>
        {children}
      </CanvasProvider>
    </ArchiveProvider>
  );
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

/**
 * Mock window.getSelection with custom text
 */
export function mockTextSelection(text: string) {
  const mockSelection = {
    toString: () => text,
    removeAllRanges: vi.fn(),
    addRange: vi.fn(),
    getRangeAt: () => ({
      cloneRange: () => ({}),
      cloneContents: () => document.createDocumentFragment(),
    }),
    rangeCount: text ? 1 : 0,
    type: text ? 'Range' : 'None',
    isCollapsed: !text,
    anchorNode: text ? document.createTextNode(text) : null,
    anchorOffset: 0,
    focusNode: text ? document.createTextNode(text) : null,
    focusOffset: text.length,
    collapse: vi.fn(),
    collapseToEnd: vi.fn(),
    collapseToStart: vi.fn(),
    containsNode: () => false,
    deleteFromDocument: vi.fn(),
    empty: vi.fn(),
    extend: vi.fn(),
    modify: vi.fn(),
    selectAllChildren: vi.fn(),
    setBaseAndExtent: vi.fn(),
    setPosition: vi.fn(),
  } as unknown as Selection;

  global.getSelection = () => mockSelection;
  return mockSelection;
}

/**
 * Helper to wait for async state updates
 */
export const waitFor = async (callback: () => void, options?: { timeout?: number }) => {
  const timeout = options?.timeout || 1000;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      callback();
      return;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  callback(); // Final attempt, will throw if still failing
};
