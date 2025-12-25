/**
 * Book Composer
 *
 * Assembles clusters and passages into a coherent book structure.
 * Generates chapters, sections, transitions, and marginalia.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type {
  BookProject,
  Chapter,
  Section,
  Passage,
  Cluster,
  Marginalia,
  ExportOptions,
} from '../types/index.js';

/**
 * Compose a book from clusters
 */
export function composeBook(
  clusters: Cluster[],
  options: ComposeOptions = {}
): Chapter[] {
  const {
    maxChapters = 12,
    maxPassagesPerChapter = 30,
    generateTransitions = true,
  } = options;

  const chapters: Chapter[] = [];

  // Each major cluster becomes a chapter
  const chapterClusters = clusters.slice(0, maxChapters);

  for (let i = 0; i < chapterClusters.length; i++) {
    const cluster = chapterClusters[i];
    const passages = cluster.passages.slice(0, maxPassagesPerChapter);

    const chapter: Chapter = {
      number: i + 1,
      title: cluster.label,
      epigraph: selectEpigraph(passages),
      introduction: generateIntroduction(cluster),
      sections: organizeSections(passages, cluster),
      passages,
      marginalia: generateMarginalia(passages),
    };

    chapters.push(chapter);
  }

  // Add transitions between chapters
  if (generateTransitions) {
    for (let i = 0; i < chapters.length - 1; i++) {
      const transition = generateChapterTransition(chapters[i], chapters[i + 1]);
      if (chapters[i].sections.length > 0) {
        chapters[i].sections[chapters[i].sections.length - 1].transition = transition;
      }
    }
  }

  return chapters;
}

export interface ComposeOptions {
  /** Maximum chapters to generate */
  maxChapters?: number;

  /** Maximum passages per chapter */
  maxPassagesPerChapter?: number;

  /** Generate transitions between chapters */
  generateTransitions?: boolean;
}

/**
 * Select an epigraph from the highest-SIC passage
 */
function selectEpigraph(passages: Passage[]): Chapter['epigraph'] | undefined {
  // Find the passage with highest SIC that's short enough
  const candidates = passages
    .filter(p => p.wordCount <= 50 && (p.sic?.score || 0) > 50)
    .sort((a, b) => (b.sic?.score || 0) - (a.sic?.score || 0));

  if (candidates.length === 0) return undefined;

  const best = candidates[0];
  return {
    text: best.text,
    source: `${best.sourceConversation.title}, ${formatDate(best.sourceMessage.timestamp)}`,
  };
}

/**
 * Generate chapter introduction
 */
function generateIntroduction(cluster: Cluster): string {
  const { keyConcepts, passages } = cluster;

  const conceptList = keyConcepts.slice(0, 3).join(', ');
  const passageCount = passages.length;
  const dateRange = getDateRange(passages);

  return `This chapter gathers ${passageCount} passages exploring ${conceptList}, ` +
    `drawn from conversations spanning ${dateRange}. ` +
    `${cluster.description || ''}`;
}

/**
 * Organize passages into sections within a chapter
 */
function organizeSections(passages: Passage[], cluster: Cluster): Section[] {
  if (passages.length <= 5) {
    // Single section for small clusters
    return [{
      title: cluster.label,
      passageIds: passages.map(p => p.id),
    }];
  }

  // Group by secondary concepts
  const sections: Section[] = [];
  const assigned = new Set<string>();

  // Create sections based on concept sub-groupings
  const subConcepts = cluster.keyConcepts.slice(1);

  for (const concept of subConcepts) {
    const matching = passages.filter(p =>
      !assigned.has(p.id) &&
      (p.concepts || []).some(c => c.toLowerCase() === concept.toLowerCase())
    );

    if (matching.length >= 2) {
      sections.push({
        title: formatConceptLabel(concept),
        passageIds: matching.map(p => p.id),
      });

      for (const p of matching) {
        assigned.add(p.id);
      }
    }
  }

  // Collect remaining passages
  const remaining = passages.filter(p => !assigned.has(p.id));
  if (remaining.length > 0) {
    if (sections.length === 0) {
      sections.push({
        title: cluster.label,
        passageIds: remaining.map(p => p.id),
      });
    } else {
      sections.push({
        title: 'Further Reflections',
        passageIds: remaining.map(p => p.id),
      });
    }
  }

  return sections;
}

/**
 * Generate marginalia (annotations) for passages
 */
function generateMarginalia(passages: Passage[]): Marginalia[] {
  const marginalia: Marginalia[] = [];

  for (const passage of passages) {
    // Add source reference
    marginalia.push({
      text: `From: ${passage.sourceConversation.title}`,
      passageId: passage.id,
      type: 'reference',
    });

    // Add SIC commentary for notable scores
    if (passage.sic) {
      if (passage.sic.score >= 80) {
        marginalia.push({
          text: `High authenticity (SIC: ${passage.sic.score.toFixed(0)})`,
          passageId: passage.id,
          type: 'commentary',
        });
      } else if (passage.sic.score < 30) {
        marginalia.push({
          text: `Consider revision (SIC: ${passage.sic.score.toFixed(0)})`,
          passageId: passage.id,
          type: 'question',
        });
      }
    }

    // Add concept connections
    if (passage.concepts && passage.concepts.length > 1) {
      marginalia.push({
        text: `Connects: ${passage.concepts.slice(0, 3).join(', ')}`,
        passageId: passage.id,
        type: 'connection',
      });
    }
  }

  return marginalia;
}

/**
 * Generate transition text between chapters
 */
function generateChapterTransition(from: Chapter, to: Chapter): string {
  return `Having explored ${from.title.toLowerCase()}, we now turn to ${to.title.toLowerCase()}.`;
}

/**
 * Export book to various formats
 */
export function exportBook(
  project: BookProject,
  options: ExportOptions
): void {
  const { format, outputPath, includeMarginalia = true, includeCitations = true, includeSIC = false } = options;

  mkdirSync(outputPath, { recursive: true });

  switch (format) {
    case 'markdown':
      exportMarkdown(project, outputPath, { includeMarginalia, includeCitations, includeSIC });
      break;
    case 'json':
      exportJSON(project, outputPath);
      break;
    default:
      throw new Error(`Format not yet supported: ${format}`);
  }
}

function exportMarkdown(
  project: BookProject,
  outputPath: string,
  options: { includeMarginalia: boolean; includeCitations: boolean; includeSIC: boolean }
): void {
  const lines: string[] = [];

  // Title page
  lines.push(`# ${project.title}`);
  if (project.subtitle) {
    lines.push(`## ${project.subtitle}`);
  }
  lines.push('');
  lines.push(`*${project.author}*`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Table of contents
  lines.push('## Contents');
  lines.push('');
  for (const chapter of project.chapters) {
    lines.push(`${chapter.number}. [${chapter.title}](#chapter-${chapter.number})`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Chapters
  for (const chapter of project.chapters) {
    lines.push(`## Chapter ${chapter.number}: ${chapter.title} {#chapter-${chapter.number}}`);
    lines.push('');

    if (chapter.epigraph) {
      lines.push(`> *${chapter.epigraph.text}*`);
      if (chapter.epigraph.source) {
        lines.push(`> — ${chapter.epigraph.source}`);
      }
      lines.push('');
    }

    if (chapter.introduction) {
      lines.push(chapter.introduction);
      lines.push('');
    }

    for (const section of chapter.sections) {
      lines.push(`### ${section.title}`);
      lines.push('');

      for (const passageId of section.passageIds) {
        const passage = chapter.passages.find(p => p.id === passageId);
        if (!passage) continue;

        lines.push(passage.text);
        lines.push('');

        if (options.includeCitations) {
          lines.push(`*— ${passage.sourceConversation.title}, ${formatDate(passage.sourceMessage.timestamp)}*`);
          lines.push('');
        }

        if (options.includeSIC && passage.sic) {
          lines.push(`[SIC: ${passage.sic.score.toFixed(0)}/100 - ${passage.sic.category}]`);
          lines.push('');
        }
      }

      if (section.transition) {
        lines.push(`*${section.transition}*`);
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
  }

  // Write main file
  const content = lines.join('\n');
  writeFileSync(join(outputPath, 'book.md'), content);

  // Write marginalia separately if requested
  if (options.includeMarginalia) {
    const marginaliaLines: string[] = ['# Marginalia', ''];

    for (const chapter of project.chapters) {
      if (!chapter.marginalia || chapter.marginalia.length === 0) continue;

      marginaliaLines.push(`## Chapter ${chapter.number}: ${chapter.title}`);
      marginaliaLines.push('');

      for (const note of chapter.marginalia) {
        const typeIcon = {
          commentary: '💭',
          reference: '📚',
          question: '❓',
          connection: '🔗',
        }[note.type];

        marginaliaLines.push(`- ${typeIcon} ${note.text}`);
      }

      marginaliaLines.push('');
    }

    writeFileSync(join(outputPath, 'marginalia.md'), marginaliaLines.join('\n'));
  }

  console.log(`Book exported to: ${outputPath}`);
}

function exportJSON(project: BookProject, outputPath: string): void {
  writeFileSync(
    join(outputPath, 'book.json'),
    JSON.stringify(project, null, 2)
  );
}

// Utilities
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getDateRange(passages: Passage[]): string {
  if (passages.length === 0) return 'unknown period';

  const dates = passages
    .map(p => new Date(p.sourceMessage.timestamp))
    .sort((a, b) => a.getTime() - b.getTime());

  const earliest = dates[0];
  const latest = dates[dates.length - 1];

  if (earliest.getFullYear() === latest.getFullYear() &&
      earliest.getMonth() === latest.getMonth()) {
    return formatDate(earliest);
  }

  return `${formatDate(earliest)} to ${formatDate(latest)}`;
}

function formatConceptLabel(concept: string): string {
  return concept
    .split(/[\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
