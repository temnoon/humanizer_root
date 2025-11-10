import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.getSelection for text selection tests
global.getSelection = () => ({
  toString: () => '',
  removeAllRanges: () => {},
  addRange: () => {},
  getRangeAt: () => ({
    cloneRange: () => ({}),
    cloneContents: () => document.createDocumentFragment(),
  }),
  rangeCount: 0,
  type: 'None',
  isCollapsed: true,
  anchorNode: null,
  anchorOffset: 0,
  focusNode: null,
  focusOffset: 0,
  collapse: () => {},
  collapseToEnd: () => {},
  collapseToStart: () => {},
  containsNode: () => false,
  deleteFromDocument: () => {},
  empty: () => {},
  extend: () => {},
  modify: () => {},
  selectAllChildren: () => {},
  setBaseAndExtent: () => {},
  setPosition: () => {},
}) as unknown as Selection;
