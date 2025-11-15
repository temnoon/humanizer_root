import type { Narrative } from '../types';

// Import sample narratives
import simpleContent from './narratives/simple.md?raw';
import listsHeadingsContent from './narratives/lists-headings.md?raw';
import codeTablesContent from './narratives/code-tables.md?raw';
import latexContent from './narratives/latex.md?raw';
import comprehensiveContent from './narratives/comprehensive.md?raw';
import aiConversationContent from './narratives/ai-conversation.md?raw';

export const sampleNarratives: Narrative[] = [
  {
    id: 'sample-1',
    title: 'A Simple Narrative',
    content: simpleContent,
    metadata: {
      source: 'Sample',
      wordCount: simpleContent.split(/\s+/).length,
      tags: ['simple', 'basic'],
    },
    createdAt: new Date('2025-11-01'),
    updatedAt: new Date('2025-11-01'),
  },
  {
    id: 'sample-2',
    title: 'The Structure of Knowledge',
    content: listsHeadingsContent,
    metadata: {
      source: 'Sample',
      wordCount: listsHeadingsContent.split(/\s+/).length,
      tags: ['lists', 'headings', 'structure'],
    },
    createdAt: new Date('2025-11-02'),
    updatedAt: new Date('2025-11-02'),
  },
  {
    id: 'sample-3',
    title: 'Technical Documentation Example',
    content: codeTablesContent,
    metadata: {
      source: 'Sample',
      wordCount: codeTablesContent.split(/\s+/).length,
      tags: ['code', 'tables', 'technical'],
    },
    createdAt: new Date('2025-11-03'),
    updatedAt: new Date('2025-11-03'),
  },
  {
    id: 'sample-4',
    title: 'Mathematical Foundations',
    content: latexContent,
    metadata: {
      source: 'Sample',
      wordCount: latexContent.split(/\s+/).length,
      tags: ['latex', 'mathematics', 'equations'],
    },
    createdAt: new Date('2025-11-04'),
    updatedAt: new Date('2025-11-04'),
  },
  {
    id: 'sample-5',
    title: 'Comprehensive Feature Demonstration',
    content: comprehensiveContent,
    metadata: {
      source: 'Sample',
      wordCount: comprehensiveContent.split(/\s+/).length,
      tags: ['comprehensive', 'all-features'],
    },
    createdAt: new Date('2025-11-05'),
    updatedAt: new Date('2025-11-05'),
  },
  {
    id: 'sample-6',
    title: 'AI Conversation: Understanding Quantum Entanglement',
    content: aiConversationContent,
    metadata: {
      source: 'Claude',
      wordCount: aiConversationContent.split(/\s+/).length,
      tags: ['ai', 'conversation', 'physics', 'quantum'],
    },
    createdAt: new Date('2025-11-15'),
    updatedAt: new Date('2025-11-15'),
  },
];

/**
 * Load sample narratives into localStorage if none exist
 */
export function initializeSampleNarratives(): void {
  const existing = localStorage.getItem('narrative-studio-narratives');
  if (!existing) {
    localStorage.setItem(
      'narrative-studio-narratives',
      JSON.stringify(sampleNarratives)
    );
  }
}
