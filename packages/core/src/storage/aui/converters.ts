/**
 * AUI PostgreSQL Store - Row Converters
 *
 * Pure functions to convert database rows to domain types.
 *
 * @module @humanizer/core/storage/aui/converters
 */

import { fromSql } from 'pgvector';
import type {
  UnifiedAuiSession,
  VersionedBuffer,
  BufferVersion,
  BufferBranch,
  AgentTask,
  Book,
  BookChapter,
  ContentCluster,
} from '../../aui/types.js';
import type {
  ContentBuffer,
  ProvenanceChain,
  BufferOperation,
} from '../../buffer/types.js';
import type {
  AuiArtifact,
  PersonaProfile,
  StyleProfile,
} from './types.js';
import type {
  DbSessionRow,
  DbBufferRow,
  DbBranchRow,
  DbVersionRow,
  DbTaskRow,
  DbBookRow,
  DbChapterRow,
  DbClusterRow,
  DbArtifactRow,
  DbPersonaProfileRow,
  DbStyleProfileRow,
  DbContentBufferRow,
  DbProvenanceChainRow,
  DbBufferOperationRow,
} from './row-types.js';

// ═══════════════════════════════════════════════════════════════════
// SESSION CONVERTERS
// ═══════════════════════════════════════════════════════════════════

export function rowToSession(row: DbSessionRow): UnifiedAuiSession {
  return {
    id: row.id,
    name: row.name ?? undefined,
    userId: row.user_id ?? undefined,
    buffers: new Map(), // Will be populated lazily
    activeBufferName: row.active_buffer_name ?? undefined,
    searchSessionId: row.search_session_id ?? undefined,
    taskHistory: [], // Will be populated lazily
    commandHistory: row.command_history ?? [],
    variables: new Map(Object.entries(row.variables ?? {})),
    createdAt: row.created_at.getTime(),
    updatedAt: row.updated_at.getTime(),
    expiresAt: row.expires_at?.getTime(),
    metadata: row.metadata ?? {
      commandCount: 0,
      searchCount: 0,
      taskCount: 0,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// BUFFER CONVERTERS
// ═══════════════════════════════════════════════════════════════════

export function rowToBuffer(row: DbBufferRow): VersionedBuffer {
  return {
    id: row.id,
    name: row.name,
    branches: new Map(), // Will be populated when needed
    versions: new Map(), // Will be populated when needed
    currentBranch: row.current_branch,
    workingContent: row.working_content ?? [],
    isDirty: row.is_dirty,
    createdAt: row.created_at.getTime(),
    updatedAt: row.updated_at.getTime(),
    schema: row.schema as any,
  };
}

export function rowToBranch(row: DbBranchRow): BufferBranch {
  return {
    name: row.name,
    headVersionId: row.head_version_id ?? '',
    createdAt: row.created_at.getTime(),
    description: row.description ?? undefined,
    parentBranch: row.parent_branch ?? undefined,
  };
}

export function rowToVersion(row: DbVersionRow): BufferVersion {
  return {
    id: row.id,
    content: row.content ?? [],
    message: row.message,
    timestamp: row.created_at.getTime(),
    parentId: row.parent_id,
    tags: row.tags ?? [],
    metadata: row.metadata ?? {},
  };
}

// ═══════════════════════════════════════════════════════════════════
// TASK CONVERTERS
// ═══════════════════════════════════════════════════════════════════

export function rowToTask(row: DbTaskRow): AgentTask {
  return {
    id: row.id,
    request: row.request,
    status: row.status as AgentTask['status'],
    steps: (row.steps ?? []) as AgentTask['steps'],
    plan: row.plan as AgentTask['plan'],
    currentStepIndex: 0,
    result: row.result,
    error: row.error ?? undefined,
    startedAt: row.started_at.getTime(),
    completedAt: row.completed_at?.getTime(),
    totalTokens: row.total_tokens,
    totalCostCents: row.total_cost_cents,
    context: {
      variables: new Map(),
    },
    priority: row.priority,
    userId: undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════
// BOOK CONVERTERS
// ═══════════════════════════════════════════════════════════════════

export function rowToBook(row: DbBookRow, chapters: BookChapter[]): Book {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    arc: row.arc ?? {
      title: row.title,
      arcType: 'thematic',
      introduction: '',
      chapters: [],
      themes: [],
      transitions: [],
    },
    chapters,
    sourceClusterId: row.source_cluster_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status as Book['status'],
    metadata: row.metadata ?? {},
  };
}

export function rowToChapter(row: DbChapterRow): BookChapter {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    passageIds: row.passage_ids ?? [],
    position: row.position,
    wordCount: row.word_count,
  };
}

// ═══════════════════════════════════════════════════════════════════
// CLUSTER CONVERTERS
// ═══════════════════════════════════════════════════════════════════

export function rowToCluster(row: DbClusterRow): ContentCluster {
  let centroid: number[] | undefined;
  if (row.centroid) {
    if (Array.isArray(row.centroid)) {
      centroid = row.centroid;
    } else {
      centroid = fromSql(row.centroid);
    }
  }

  let dateRange: { earliest: Date | null; latest: Date | null } = {
    earliest: null,
    latest: null,
  };
  if (row.date_range) {
    dateRange = {
      earliest: row.date_range.earliest
        ? new Date(row.date_range.earliest)
        : null,
      latest: row.date_range.latest ? new Date(row.date_range.latest) : null,
    };
  }

  return {
    id: row.id,
    label: row.label,
    description: row.description ?? '',
    passages: row.passages as ContentCluster['passages'],
    totalPassages: row.total_passages,
    coherence: row.coherence ?? 0,
    keywords: row.keywords ?? [],
    sourceDistribution: row.source_distribution ?? {},
    dateRange,
    avgWordCount: row.avg_word_count ?? 0,
    centroid,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ARTIFACT CONVERTERS
// ═══════════════════════════════════════════════════════════════════

export function rowToArtifact(row: DbArtifactRow): AuiArtifact {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    name: row.name,
    artifactType: row.artifact_type as AuiArtifact['artifactType'],
    content: row.content ?? undefined,
    contentBinary: row.content_binary ?? undefined,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes ?? undefined,
    sourceType: row.source_type ?? undefined,
    sourceId: row.source_id ?? undefined,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? undefined,
    downloadCount: row.download_count,
    lastDownloadedAt: row.last_downloaded_at ?? undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════
// PERSONA & STYLE CONVERTERS
// ═══════════════════════════════════════════════════════════════════

export function rowToPersonaProfile(row: DbPersonaProfileRow): PersonaProfile {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    voiceTraits: row.voice_traits ?? [],
    toneMarkers: row.tone_markers ?? [],
    formalityRange: [row.formality_min, row.formality_max],
    styleGuide: row.style_guide ?? {
      forbiddenPhrases: [],
      preferredPatterns: [],
      sentenceVariety: 'medium',
      paragraphStyle: 'medium',
      useContractions: true,
      useRhetoricalQuestions: false,
    },
    referenceExamples: row.reference_examples ?? [],
    voiceFingerprint: row.voice_fingerprint ?? undefined,
    isDefault: row.is_default,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToStyleProfile(row: DbStyleProfileRow): StyleProfile {
  return {
    id: row.id,
    personaId: row.persona_id,
    name: row.name,
    description: row.description ?? undefined,
    context: row.context ?? undefined,
    forbiddenPhrases: row.forbidden_phrases ?? [],
    preferredPatterns: row.preferred_patterns ?? [],
    sentenceVariety: row.sentence_variety ?? 'medium',
    paragraphStyle: row.paragraph_style ?? 'medium',
    useContractions: row.use_contractions ?? true,
    useRhetoricalQuestions: row.use_rhetorical_questions ?? false,
    formalityLevel: row.formality_level ?? 0.5,
    isDefault: row.is_default,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ═══════════════════════════════════════════════════════════════════
// CONTENT BUFFER CONVERTERS
// ═══════════════════════════════════════════════════════════════════

export function rowToContentBuffer(row: DbContentBufferRow): ContentBuffer {
  let embedding: number[] | undefined;
  if (row.embedding) {
    if (Array.isArray(row.embedding)) {
      embedding = row.embedding;
    } else {
      embedding = fromSql(row.embedding);
    }
  }

  return {
    id: row.id,
    contentHash: row.content_hash,
    text: row.text,
    wordCount: row.word_count,
    format: row.format,
    state: row.state,
    origin: row.origin,
    provenanceChain: {
      // Placeholder - full chain loaded separately
      id: '',
      rootBufferId: row.id,
      currentBufferId: row.id,
      operations: [],
      branch: { name: 'main', isMain: true },
      childChainIds: [],
      transformationCount: 0,
    },
    qualityMetrics: row.quality_metrics ?? undefined,
    embedding,
    createdAt: row.created_at.getTime(),
    updatedAt: row.updated_at.getTime(),
  };
}

export function rowToProvenanceChain(row: DbProvenanceChainRow): ProvenanceChain {
  return {
    id: row.id,
    rootBufferId: row.root_buffer_id,
    currentBufferId: row.current_buffer_id,
    operations: [], // Loaded separately via getOperationsByChain
    branch: {
      name: row.branch_name,
      description: row.branch_description ?? undefined,
      isMain: row.is_main,
    },
    parentChainId: row.parent_chain_id ?? undefined,
    childChainIds: row.child_chain_ids ?? [],
    transformationCount: row.transformation_count,
  };
}

export function rowToBufferOperation(row: DbBufferOperationRow): BufferOperation {
  return {
    id: row.id,
    type: row.operation_type as BufferOperation['type'],
    timestamp: row.created_at.getTime(),
    performer: row.performer,
    parameters: row.parameters ?? {},
    hashes: {
      beforeHash: row.before_hash,
      afterHash: row.after_hash,
      deltaHash: row.delta_hash ?? undefined,
    },
    qualityImpact: row.quality_impact ?? undefined,
    description: row.description,
    durationMs: row.duration_ms ?? undefined,
    costCents: row.cost_cents ?? undefined,
  };
}
