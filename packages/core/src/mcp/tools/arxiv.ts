/**
 * ArXiv Integration Tools
 *
 * MCP tool definitions for searching and fetching papers from ArXiv.
 * Enables research discovery and academic paper integration for book composition.
 */

import type { MCPToolDefinition } from '../types.js';

/**
 * ArXiv search tools for paper discovery
 */
export const ARXIV_TOOLS: MCPToolDefinition[] = [
  {
    name: 'search_arxiv',
    description: `Search ArXiv for research papers by query. Returns paper metadata including titles, authors, abstracts, and links.

Examples:
- "machine learning transformers" - Find transformer papers
- "quantum computing error correction" - Find quantum papers
- "au:bengio deep learning" - Papers by Bengio on deep learning
- "cat:cs.AI neural networks" - AI category papers on neural networks`,
    category: 'arxiv',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query. Supports ArXiv query syntax (au: for author, ti: for title, abs: for abstract, cat: for category)',
          minLength: 2,
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-50)',
          minimum: 1,
          maximum: 50,
          default: 10,
        },
        sortBy: {
          type: 'string',
          enum: ['relevance', 'lastUpdatedDate', 'submittedDate'],
          default: 'relevance',
          description: 'Sort order for results',
        },
        sortOrder: {
          type: 'string',
          enum: ['ascending', 'descending'],
          default: 'descending',
          description: 'Sort direction',
        },
        category: {
          type: 'string',
          description: 'Limit to ArXiv category (e.g., cs.AI, cs.LG, physics.quant-ph)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch_arxiv_paper',
    description: `Fetch detailed metadata for a specific ArXiv paper by ID.
Returns full abstract, authors with affiliations, categories, and links.

Examples:
- "2512.24601" - Fetch paper by ID
- "cs/0112017" - Old-style ArXiv ID
- "hep-th/9711200" - Physics paper ID`,
    category: 'arxiv',
    inputSchema: {
      type: 'object',
      properties: {
        paperId: {
          type: 'string',
          description: 'ArXiv paper ID (e.g., 2512.24601, cs/0112017)',
          minLength: 4,
        },
      },
      required: ['paperId'],
    },
  },
  {
    name: 'get_arxiv_categories',
    description: 'List available ArXiv categories with descriptions. Useful for filtering searches.',
    category: 'arxiv',
    inputSchema: {
      type: 'object',
      properties: {
        group: {
          type: 'string',
          enum: ['cs', 'physics', 'math', 'q-bio', 'q-fin', 'stat', 'eess', 'econ', 'all'],
          default: 'cs',
          description: 'Category group to list',
        },
      },
    },
  },
];
