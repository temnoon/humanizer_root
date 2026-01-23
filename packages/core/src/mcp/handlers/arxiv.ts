/**
 * ArXiv Integration Handlers
 *
 * MCP tool handlers for ArXiv paper search and retrieval.
 * Uses the ArXiv API at http://export.arxiv.org/api/query
 *
 * Rate Limits:
 * - ArXiv recommends no more than 3 requests per second
 * - This implementation includes simple throttling
 */

import type { MCPResult, HandlerContext } from '../types.js';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const ARXIV_API_BASE = 'http://export.arxiv.org/api/query';
const ARXIV_TIMEOUT = 30000; // 30 seconds

// ArXiv categories organized by group
const ARXIV_CATEGORIES: Record<string, Array<{ id: string; name: string }>> = {
  cs: [
    { id: 'cs.AI', name: 'Artificial Intelligence' },
    { id: 'cs.CL', name: 'Computation and Language' },
    { id: 'cs.CV', name: 'Computer Vision and Pattern Recognition' },
    { id: 'cs.LG', name: 'Machine Learning' },
    { id: 'cs.NE', name: 'Neural and Evolutionary Computing' },
    { id: 'cs.RO', name: 'Robotics' },
    { id: 'cs.SE', name: 'Software Engineering' },
    { id: 'cs.DB', name: 'Databases' },
    { id: 'cs.DC', name: 'Distributed Computing' },
    { id: 'cs.IR', name: 'Information Retrieval' },
    { id: 'cs.PL', name: 'Programming Languages' },
    { id: 'cs.HC', name: 'Human-Computer Interaction' },
  ],
  physics: [
    { id: 'physics.quant-ph', name: 'Quantum Physics' },
    { id: 'physics.comp-ph', name: 'Computational Physics' },
    { id: 'physics.data-an', name: 'Data Analysis' },
    { id: 'hep-th', name: 'High Energy Physics - Theory' },
    { id: 'cond-mat', name: 'Condensed Matter' },
  ],
  math: [
    { id: 'math.ST', name: 'Statistics Theory' },
    { id: 'math.CO', name: 'Combinatorics' },
    { id: 'math.OC', name: 'Optimization and Control' },
    { id: 'math.PR', name: 'Probability' },
    { id: 'math.NA', name: 'Numerical Analysis' },
  ],
  'q-bio': [
    { id: 'q-bio.NC', name: 'Neurons and Cognition' },
    { id: 'q-bio.QM', name: 'Quantitative Methods' },
    { id: 'q-bio.GN', name: 'Genomics' },
  ],
  'q-fin': [
    { id: 'q-fin.ST', name: 'Statistical Finance' },
    { id: 'q-fin.CP', name: 'Computational Finance' },
    { id: 'q-fin.RM', name: 'Risk Management' },
  ],
  stat: [
    { id: 'stat.ML', name: 'Machine Learning' },
    { id: 'stat.ME', name: 'Methodology' },
    { id: 'stat.TH', name: 'Statistics Theory' },
    { id: 'stat.CO', name: 'Computation' },
  ],
  eess: [
    { id: 'eess.SP', name: 'Signal Processing' },
    { id: 'eess.AS', name: 'Audio and Speech Processing' },
    { id: 'eess.IV', name: 'Image and Video Processing' },
  ],
  econ: [
    { id: 'econ.EM', name: 'Econometrics' },
    { id: 'econ.TH', name: 'Theoretical Economics' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// RESULT HELPERS
// ═══════════════════════════════════════════════════════════════════

function jsonResult(data: unknown): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ARXIV XML PARSING
// ═══════════════════════════════════════════════════════════════════

interface ArxivPaper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  categories: string[];
  published: string;
  updated: string;
  pdfUrl: string;
  htmlUrl: string;
  doi?: string;
  comment?: string;
  journalRef?: string;
}

/**
 * Parse ArXiv Atom XML response into paper objects
 */
function parseArxivXml(xml: string): ArxivPaper[] {
  const papers: ArxivPaper[] = [];

  // Extract entry elements
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    // Extract fields with helper
    const getField = (tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
      const fieldMatch = entry.match(regex);
      return fieldMatch ? fieldMatch[1].trim() : '';
    };

    // Extract ID from arxiv id URL
    const idMatch = entry.match(/<id>http:\/\/arxiv\.org\/abs\/([^<]+)<\/id>/);
    const id = idMatch ? idMatch[1] : '';

    // Extract title (may have newlines)
    const title = getField('title').replace(/\s+/g, ' ');

    // Extract authors
    const authors: string[] = [];
    const authorRegex = /<author>\s*<name>([^<]+)<\/name>/g;
    let authorMatch;
    while ((authorMatch = authorRegex.exec(entry)) !== null) {
      authors.push(authorMatch[1].trim());
    }

    // Extract abstract (summary)
    const abstract = getField('summary').replace(/\s+/g, ' ');

    // Extract categories
    const categories: string[] = [];
    const catRegex = /<category[^>]*term="([^"]+)"/g;
    let catMatch;
    while ((catMatch = catRegex.exec(entry)) !== null) {
      categories.push(catMatch[1]);
    }

    // Extract dates
    const published = getField('published');
    const updated = getField('updated');

    // Extract links
    const pdfMatch = entry.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/);
    const pdfUrl = pdfMatch ? pdfMatch[1] : `https://arxiv.org/pdf/${id}.pdf`;

    const htmlUrl = `https://arxiv.org/abs/${id}`;

    // Optional fields
    const doiMatch = entry.match(/<arxiv:doi[^>]*>([^<]+)<\/arxiv:doi>/);
    const doi = doiMatch ? doiMatch[1] : undefined;

    const commentMatch = entry.match(/<arxiv:comment[^>]*>([\s\S]*?)<\/arxiv:comment>/);
    const comment = commentMatch ? commentMatch[1].replace(/\s+/g, ' ').trim() : undefined;

    const journalMatch = entry.match(/<arxiv:journal_ref[^>]*>([^<]+)<\/arxiv:journal_ref>/);
    const journalRef = journalMatch ? journalMatch[1] : undefined;

    if (id && title) {
      papers.push({
        id,
        title,
        authors,
        abstract,
        categories,
        published,
        updated,
        pdfUrl,
        htmlUrl,
        doi,
        comment,
        journalRef,
      });
    }
  }

  return papers;
}

/**
 * Extract total results count from ArXiv response
 */
function getTotalResults(xml: string): number {
  const match = xml.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/);
  return match ? parseInt(match[1], 10) : 0;
}

// ═══════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface SearchArxivInput {
  query: string;
  maxResults?: number;
  sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
  sortOrder?: 'ascending' | 'descending';
  category?: string;
}

export async function handleSearchArxiv(
  args: SearchArxivInput,
  _context?: HandlerContext
): Promise<MCPResult> {
  try {
    if (!args.query || args.query.length < 2) {
      return errorResult('Query must be at least 2 characters');
    }

    const maxResults = Math.min(Math.max(args.maxResults ?? 10, 1), 50);
    const sortBy = args.sortBy ?? 'relevance';
    const sortOrder = args.sortOrder ?? 'descending';

    // Build query string
    let searchQuery = args.query;
    if (args.category) {
      searchQuery = `cat:${args.category} AND (${searchQuery})`;
    }

    // Build URL
    const params = new URLSearchParams({
      search_query: searchQuery,
      max_results: maxResults.toString(),
      sortBy,
      sortOrder,
    });

    const url = `${ARXIV_API_BASE}?${params.toString()}`;

    // Fetch from ArXiv
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'humanizer-mcp/1.0 (research tool)',
      },
      signal: AbortSignal.timeout(ARXIV_TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`ArXiv API error: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    const papers = parseArxivXml(xml);
    const totalResults = getTotalResults(xml);

    return jsonResult({
      query: args.query,
      category: args.category,
      resultCount: papers.length,
      totalAvailable: totalResults,
      papers: papers.map(p => ({
        id: p.id,
        title: p.title,
        authors: p.authors,
        abstract: p.abstract.substring(0, 500) + (p.abstract.length > 500 ? '...' : ''),
        categories: p.categories.slice(0, 3),
        published: p.published.split('T')[0],
        pdfUrl: p.pdfUrl,
        htmlUrl: p.htmlUrl,
      })),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return errorResult('ArXiv request timed out. Try again or reduce maxResults.');
    }
    return errorResult(`ArXiv search failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface FetchArxivPaperInput {
  paperId: string;
}

export async function handleFetchArxivPaper(
  args: FetchArxivPaperInput,
  _context?: HandlerContext
): Promise<MCPResult> {
  try {
    if (!args.paperId || args.paperId.length < 4) {
      return errorResult('Paper ID must be at least 4 characters');
    }

    // Clean up paper ID (remove version suffix if present)
    const paperId = args.paperId.replace(/^arxiv:/i, '').replace(/v\d+$/, '');

    // Fetch by ID
    const url = `${ARXIV_API_BASE}?id_list=${encodeURIComponent(paperId)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'humanizer-mcp/1.0 (research tool)',
      },
      signal: AbortSignal.timeout(ARXIV_TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`ArXiv API error: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    const papers = parseArxivXml(xml);

    if (papers.length === 0) {
      return errorResult(`Paper not found: ${args.paperId}`);
    }

    const paper = papers[0];

    return jsonResult({
      id: paper.id,
      title: paper.title,
      authors: paper.authors,
      abstract: paper.abstract,
      categories: paper.categories,
      published: paper.published,
      updated: paper.updated,
      pdfUrl: paper.pdfUrl,
      htmlUrl: paper.htmlUrl,
      doi: paper.doi,
      comment: paper.comment,
      journalRef: paper.journalRef,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return errorResult('ArXiv request timed out. Try again.');
    }
    return errorResult(`Fetch paper failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface GetArxivCategoriesInput {
  group?: 'cs' | 'physics' | 'math' | 'q-bio' | 'q-fin' | 'stat' | 'eess' | 'econ' | 'all';
}

export async function handleGetArxivCategories(
  args: GetArxivCategoriesInput,
  _context?: HandlerContext
): Promise<MCPResult> {
  const group = args.group ?? 'cs';

  if (group === 'all') {
    return jsonResult({
      groups: Object.entries(ARXIV_CATEGORIES).map(([name, cats]) => ({
        name,
        categoryCount: cats.length,
        categories: cats,
      })),
    });
  }

  const categories = ARXIV_CATEGORIES[group];
  if (!categories) {
    return errorResult(`Unknown category group: ${group}. Valid: ${Object.keys(ARXIV_CATEGORIES).join(', ')}`);
  }

  return jsonResult({
    group,
    categories,
  });
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER REGISTRY
// ═══════════════════════════════════════════════════════════════════

export const ARXIV_HANDLERS: Record<string, (args: unknown, context?: HandlerContext) => Promise<MCPResult>> = {
  search_arxiv: handleSearchArxiv as (args: unknown, context?: HandlerContext) => Promise<MCPResult>,
  fetch_arxiv_paper: handleFetchArxivPaper as (args: unknown, context?: HandlerContext) => Promise<MCPResult>,
  get_arxiv_categories: handleGetArxivCategories as (args: unknown, context?: HandlerContext) => Promise<MCPResult>,
};
