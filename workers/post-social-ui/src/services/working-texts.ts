/**
 * Working Texts Service
 *
 * API client for node working texts (reformatted book chapters).
 */

export interface ChapterMetadata {
  chapterNumber: number;
  title: string;
  wordCount: number;
}

export interface ChapterContent {
  chapterNumber: number;
  title: string;
  workingContent: string;
  wordCount: number;
  enhancements: {
    headersAdded: number;
    quotesFormatted: number;
    paragraphsJoined: number;
  } | null;
}

export interface WorkingTextsResponse {
  nodeId: string;
  hasWorkingTexts: boolean;
  chapters: ChapterMetadata[];
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8788';

/**
 * Get list of chapters for a node
 */
export async function getNodeChapters(nodeId: string): Promise<WorkingTextsResponse> {
  const response = await fetch(`${API_BASE}/api/working-text/node/${nodeId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch chapters: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get specific chapter content
 */
export async function getChapterContent(
  nodeId: string,
  chapterNumber: number
): Promise<ChapterContent> {
  const response = await fetch(
    `${API_BASE}/api/working-text/node/${nodeId}/chapter/${chapterNumber}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch chapter: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Trigger reformatting for a node (requires auth)
 */
export async function triggerReformat(nodeId: string, token: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/working-text/node/${nodeId}/reformat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to trigger reformat: ${response.statusText}`);
  }
}

export const workingTextsService = {
  getNodeChapters,
  getChapterContent,
  triggerReformat
};
