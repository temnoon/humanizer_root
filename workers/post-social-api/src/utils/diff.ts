// Diff utility for narrative version comparison
// Simple line-based diff algorithm (LCS-based)

export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineNumber?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  addedLines: number;
  removedLines: number;
  unchangedLines: number;
  similarity: number; // 0-1, how similar the texts are
}

/**
 * Compute longest common subsequence length matrix
 */
function lcsMatrix(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  return dp;
}

/**
 * Backtrack through LCS matrix to build diff
 */
function backtrack(
  dp: number[][],
  a: string[],
  b: string[],
  i: number,
  j: number,
  result: DiffLine[]
): void {
  if (i === 0 && j === 0) {
    return;
  }
  
  if (i === 0) {
    // All remaining in b are additions
    for (let k = 0; k < j; k++) {
      result.unshift({ type: 'added', content: b[k] });
    }
    return;
  }
  
  if (j === 0) {
    // All remaining in a are removals
    for (let k = 0; k < i; k++) {
      result.unshift({ type: 'removed', content: a[k] });
    }
    return;
  }
  
  if (a[i - 1] === b[j - 1]) {
    result.unshift({ type: 'unchanged', content: a[i - 1] });
    backtrack(dp, a, b, i - 1, j - 1, result);
  } else if (dp[i - 1][j] >= dp[i][j - 1]) {
    result.unshift({ type: 'removed', content: a[i - 1] });
    backtrack(dp, a, b, i - 1, j, result);
  } else {
    result.unshift({ type: 'added', content: b[j - 1] });
    backtrack(dp, a, b, i, j - 1, result);
  }
}

/**
 * Generate diff between two texts
 */
export function generateDiff(oldText: string, newText: string): DiffResult {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  
  const dp = lcsMatrix(oldLines, newLines);
  const lines: DiffLine[] = [];
  
  backtrack(dp, oldLines, newLines, oldLines.length, newLines.length, lines);
  
  // Add line numbers
  let oldLineNum = 0;
  let newLineNum = 0;
  
  for (const line of lines) {
    if (line.type === 'removed') {
      oldLineNum++;
      line.lineNumber = oldLineNum;
    } else if (line.type === 'added') {
      newLineNum++;
      line.lineNumber = newLineNum;
    } else {
      oldLineNum++;
      newLineNum++;
      line.lineNumber = newLineNum;
    }
  }
  
  const addedLines = lines.filter(l => l.type === 'added').length;
  const removedLines = lines.filter(l => l.type === 'removed').length;
  const unchangedLines = lines.filter(l => l.type === 'unchanged').length;
  
  // Calculate similarity (Jaccard-like)
  const totalLines = Math.max(oldLines.length, newLines.length);
  const similarity = totalLines > 0 ? unchangedLines / totalLines : 1;
  
  return {
    lines,
    addedLines,
    removedLines,
    unchangedLines,
    similarity: Math.round(similarity * 100) / 100,
  };
}

/**
 * Generate unified diff format (git-style)
 */
export function generateUnifiedDiff(
  oldText: string,
  newText: string,
  oldLabel = 'version-a',
  newLabel = 'version-b'
): string {
  const diff = generateDiff(oldText, newText);
  
  const header = [
    `--- ${oldLabel}`,
    `+++ ${newLabel}`,
  ];
  
  const body = diff.lines.map(line => {
    switch (line.type) {
      case 'added':
        return `+ ${line.content}`;
      case 'removed':
        return `- ${line.content}`;
      default:
        return `  ${line.content}`;
    }
  });
  
  return [...header, ...body].join('\n');
}

/**
 * Generate side-by-side comparison data
 */
export interface SideBySideLine {
  left: { lineNumber: number | null; content: string; type: 'unchanged' | 'removed' | 'empty' };
  right: { lineNumber: number | null; content: string; type: 'unchanged' | 'added' | 'empty' };
}

export function generateSideBySide(oldText: string, newText: string): SideBySideLine[] {
  const diff = generateDiff(oldText, newText);
  const result: SideBySideLine[] = [];
  
  let leftLineNum = 0;
  let rightLineNum = 0;
  
  for (const line of diff.lines) {
    if (line.type === 'unchanged') {
      leftLineNum++;
      rightLineNum++;
      result.push({
        left: { lineNumber: leftLineNum, content: line.content, type: 'unchanged' },
        right: { lineNumber: rightLineNum, content: line.content, type: 'unchanged' },
      });
    } else if (line.type === 'removed') {
      leftLineNum++;
      result.push({
        left: { lineNumber: leftLineNum, content: line.content, type: 'removed' },
        right: { lineNumber: null, content: '', type: 'empty' },
      });
    } else if (line.type === 'added') {
      rightLineNum++;
      result.push({
        left: { lineNumber: null, content: '', type: 'empty' },
        right: { lineNumber: rightLineNum, content: line.content, type: 'added' },
      });
    }
  }
  
  return result;
}

/**
 * Calculate semantic shift between versions
 * This is a simple word-level Jaccard similarity
 * In production, you'd use embeddings for true semantic comparison
 */
export function calculateSemanticShift(oldText: string, newText: string): number {
  const normalize = (text: string) => 
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);
  
  const oldWords = new Set(normalize(oldText));
  const newWords = new Set(normalize(newText));
  
  const intersection = new Set([...oldWords].filter(w => newWords.has(w)));
  const union = new Set([...oldWords, ...newWords]);
  
  const similarity = union.size > 0 ? intersection.size / union.size : 1;
  
  // Semantic shift is inverse of similarity
  return Math.round((1 - similarity) * 100) / 100;
}
