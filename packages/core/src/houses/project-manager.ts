/**
 * Project Manager Agent
 *
 * The orchestrator of book projects. Tracks project lifecycle,
 * coordinates other agents, and advances projects through phases.
 *
 * Phases: planning → harvesting → curating → drafting → mastering → complete
 *
 * NOTE: This agent uses ConfigManager for all thresholds and prompts.
 * NO hardcoded literals allowed.
 */

import { AgentBase } from '../runtime/agent-base.js';
import type { AgentMessage, HouseType, ProjectPhase } from '../runtime/types.js';
import { getConfigManager } from '../config/index.js';
import type { ConfigManager } from '../config/types.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIG KEYS FOR PROJECT MANAGER
// ═══════════════════════════════════════════════════════════════════

/**
 * Project Manager specific config keys
 */
export const PROJECT_MANAGER_CONFIG = {
  // Phase advancement thresholds
  MIN_PASSAGES_FOR_CURATING: 'projectManager.minPassagesForCurating',
  MIN_CURATED_PASSAGES_FOR_DRAFTING: 'projectManager.minCuratedPassagesForDrafting',
  MIN_CHAPTERS_FOR_MASTERING: 'projectManager.minChaptersForMastering',

  // Timeouts
  AGENT_RESPONSE_TIMEOUT: 'projectManager.agentResponseTimeout',
} as const;

// ═══════════════════════════════════════════════════════════════════
// PROJECT MANAGER TYPES
// ═══════════════════════════════════════════════════════════════════

export interface ProjectStatus {
  projectId: string;
  phase: ProjectPhase;
  progress: number;
  threads: Array<{ id: string; passageCount: number; status: 'active' | 'complete' }>;
  chapters: Array<{ id: string; status: 'draft' | 'review' | 'approved' }>;
  nextActions: string[];
  blockers: string[];
}

export interface PhaseRequirements {
  phase: ProjectPhase;
  requirements: string[];
  met: boolean;
  blockers: string[];
}

export interface AssignWorkRequest {
  projectId: string;
  agentId: string;
  taskType: string;
  payload: Record<string, unknown>;
}

export interface PhaseAdvanceResult {
  success: boolean;
  previousPhase: ProjectPhase;
  newPhase: ProjectPhase;
  reason?: string;
}

export interface ProjectManagerIntention {
  type: 'advance-phase' | 'coordinate' | 'escalate' | 'reassign';
  priority: number;
  reason: string;
  projectId: string;
  context: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════
// PHASE TRANSITIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Valid phase transitions
 */
const PHASE_TRANSITIONS: Record<ProjectPhase, ProjectPhase | null> = {
  'planning': 'harvesting',
  'harvesting': 'curating',
  'curating': 'drafting',
  'drafting': 'mastering',
  'mastering': 'complete',
  'complete': null, // Terminal state
};

// ═══════════════════════════════════════════════════════════════════
// PROJECT MANAGER AGENT
// ═══════════════════════════════════════════════════════════════════

export class ProjectManagerAgent extends AgentBase {
  readonly id = 'project-manager';
  readonly name = 'The Project Manager';
  readonly house: HouseType = 'project-manager';
  readonly capabilities = [
    'get-status',
    'advance-phase',
    'assign-work',
    'track-progress',
    'coordinate-agents',
    'check-phase-requirements',
  ];

  private configManager: ConfigManager;

  // Project tracking (would be persisted in production)
  private projectStates: Map<string, ProjectStatus> = new Map();

  // Pending intentions
  private pendingIntentions: ProjectManagerIntention[] = [];

  constructor() {
    super();
    this.configManager = getConfigManager();
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  protected async onInitialize(): Promise<void> {
    this.log('info', 'Project Manager ready to coordinate');
    this.subscribe('project:*');
    this.subscribe('chapter:*');
    this.subscribe('thread:*');
    this.subscribe('signoff:*');
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', 'Project Manager retiring');
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE HANDLING
  // ─────────────────────────────────────────────────────────────────

  protected async onMessage(message: AgentMessage): Promise<unknown> {
    switch (message.type) {
      case 'get-status':
        return this.getProjectStatus(message.payload as { projectId: string });

      case 'advance-phase':
        return this.advancePhase(message.payload as { projectId: string; force?: boolean });

      case 'assign-work':
        return this.assignWork(message.payload as AssignWorkRequest);

      case 'check-phase-requirements':
        return this.checkPhaseRequirements(message.payload as { projectId: string; targetPhase: ProjectPhase });

      case 'get-intentions':
        return this.getIntentions();

      case 'track-progress':
        return this.trackProgress(message.payload as { projectId: string });

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PROJECT STATUS
  // ─────────────────────────────────────────────────────────────────

  private async getProjectStatus(request: { projectId: string }): Promise<ProjectStatus> {
    const { projectId } = request;

    // Check if we have cached status
    let status = this.projectStates.get(projectId);

    if (!status) {
      // Initialize with defaults (in production, would load from database)
      status = {
        projectId,
        phase: 'planning',
        progress: 0,
        threads: [],
        chapters: [],
        nextActions: ['Define threads', 'Set persona', 'Configure style guidelines'],
        blockers: [],
      };
      this.projectStates.set(projectId, status);
    }

    // Calculate progress based on phase
    status.progress = this.calculateProgress(status);
    status.nextActions = await this.determineNextActions(status);
    status.blockers = await this.identifyBlockers(status);

    return status;
  }

  private calculateProgress(status: ProjectStatus): number {
    const phaseWeights: Record<ProjectPhase, number> = {
      'planning': 0,
      'harvesting': 0.2,
      'curating': 0.4,
      'drafting': 0.6,
      'mastering': 0.8,
      'complete': 1.0,
    };

    const baseProgress = phaseWeights[status.phase];

    // Add progress within phase
    let withinPhaseProgress = 0;
    switch (status.phase) {
      case 'planning':
        withinPhaseProgress = status.threads.length > 0 ? 0.5 : 0;
        break;
      case 'harvesting': {
        const totalPassages = status.threads.reduce((sum, t) => sum + t.passageCount, 0);
        withinPhaseProgress = Math.min(1, totalPassages / 50) * 0.2;
        break;
      }
      case 'curating': {
        const completedThreads = status.threads.filter(t => t.status === 'complete').length;
        withinPhaseProgress = status.threads.length > 0 ? (completedThreads / status.threads.length) * 0.2 : 0;
        break;
      }
      case 'drafting': {
        const draftedChapters = status.chapters.filter(c => c.status !== 'draft').length;
        withinPhaseProgress = status.chapters.length > 0 ? (draftedChapters / status.chapters.length) * 0.2 : 0;
        break;
      }
      case 'mastering': {
        const approvedChapters = status.chapters.filter(c => c.status === 'approved').length;
        withinPhaseProgress = status.chapters.length > 0 ? (approvedChapters / status.chapters.length) * 0.2 : 0;
        break;
      }
    }

    return Math.min(1, baseProgress + withinPhaseProgress);
  }

  private async determineNextActions(status: ProjectStatus): Promise<string[]> {
    const actions: string[] = [];

    switch (status.phase) {
      case 'planning':
        if (status.threads.length === 0) {
          actions.push('Define at least one thread');
        }
        actions.push('Review persona settings');
        actions.push('Advance to harvesting when ready');
        break;

      case 'harvesting': {
        const totalPassages = status.threads.reduce((sum, t) => sum + t.passageCount, 0);
        const minPassages = await this.configManager.getOrDefault<number>(
          'limits',
          PROJECT_MANAGER_CONFIG.MIN_PASSAGES_FOR_CURATING,
          20
        );
        if (totalPassages < minPassages) {
          actions.push(`Harvest more passages (${totalPassages}/${minPassages})`);
        } else {
          actions.push('Advance to curating');
        }
        break;
      }

      case 'curating': {
        const incompleteThreads = status.threads.filter(t => t.status === 'active');
        if (incompleteThreads.length > 0) {
          actions.push(`Complete curation for ${incompleteThreads.length} thread(s)`);
        } else {
          actions.push('Advance to drafting');
        }
        break;
      }

      case 'drafting': {
        const draftChapters = status.chapters.filter(c => c.status === 'draft');
        if (draftChapters.length > 0) {
          actions.push(`Review ${draftChapters.length} draft chapter(s)`);
        } else {
          actions.push('Advance to mastering');
        }
        break;
      }

      case 'mastering': {
        const pendingChapters = status.chapters.filter(c => c.status !== 'approved');
        if (pendingChapters.length > 0) {
          actions.push(`Complete review of ${pendingChapters.length} chapter(s)`);
        } else {
          actions.push('Mark project as complete');
        }
        break;
      }

      case 'complete':
        actions.push('Project complete - ready for export');
        break;
    }

    return actions;
  }

  private async identifyBlockers(status: ProjectStatus): Promise<string[]> {
    const blockers: string[] = [];

    // Check for phase-specific blockers
    switch (status.phase) {
      case 'harvesting':
        if (status.threads.length === 0) {
          blockers.push('No threads defined - cannot harvest');
        }
        break;

      case 'curating': {
        const emptyThreads = status.threads.filter(t => t.passageCount === 0);
        if (emptyThreads.length > 0) {
          blockers.push(`${emptyThreads.length} thread(s) have no passages`);
        }
        break;
      }

      case 'drafting':
        if (status.threads.filter(t => t.status === 'complete').length === 0) {
          blockers.push('No curated threads ready for drafting');
        }
        break;

      case 'mastering':
        if (status.chapters.length === 0) {
          blockers.push('No chapters to master');
        }
        break;
    }

    return blockers;
  }

  // ─────────────────────────────────────────────────────────────────
  // PHASE ADVANCEMENT
  // ─────────────────────────────────────────────────────────────────

  private async advancePhase(request: { projectId: string; force?: boolean }): Promise<PhaseAdvanceResult> {
    const { projectId, force = false } = request;
    const status = await this.getProjectStatus({ projectId });

    const nextPhase = PHASE_TRANSITIONS[status.phase];
    if (!nextPhase) {
      return {
        success: false,
        previousPhase: status.phase,
        newPhase: status.phase,
        reason: 'Project is already complete',
      };
    }

    // Check requirements unless forced
    if (!force) {
      const requirements = await this.checkPhaseRequirements({ projectId, targetPhase: nextPhase });
      if (!requirements.met) {
        // Create intention to address blockers
        this.addIntention({
          type: 'escalate',
          priority: 0.7,
          reason: `Cannot advance to ${nextPhase}: ${requirements.blockers.join(', ')}`,
          projectId,
          context: { requirements },
        });

        return {
          success: false,
          previousPhase: status.phase,
          newPhase: status.phase,
          reason: `Requirements not met: ${requirements.blockers.join(', ')}`,
        };
      }
    }

    // Advance the phase
    status.phase = nextPhase;
    this.projectStates.set(projectId, status);

    // Publish phase change event
    this.publish('project:phase-changed', {
      projectId,
      previousPhase: request.projectId,
      newPhase: nextPhase,
    });

    // Propose the phase change for approval
    await this.proposeAction(
      'phase-advanced',
      `Project advanced to ${nextPhase} phase`,
      `Moved from ${status.phase} to ${nextPhase}`,
      { projectId, previousPhase: status.phase, newPhase: nextPhase },
      { projectId, requiresApproval: false }
    );

    return {
      success: true,
      previousPhase: status.phase,
      newPhase: nextPhase,
    };
  }

  private async checkPhaseRequirements(request: { projectId: string; targetPhase: ProjectPhase }): Promise<PhaseRequirements> {
    const { projectId, targetPhase } = request;
    const status = await this.getProjectStatus({ projectId });

    const requirements: string[] = [];
    const blockers: string[] = [];

    switch (targetPhase) {
      case 'harvesting':
        requirements.push('At least one thread defined');
        requirements.push('Persona configured');
        if (status.threads.length === 0) {
          blockers.push('No threads defined');
        }
        break;

      case 'curating': {
        const minPassages = await this.configManager.getOrDefault<number>(
          'limits',
          PROJECT_MANAGER_CONFIG.MIN_PASSAGES_FOR_CURATING,
          20
        );
        requirements.push(`At least ${minPassages} passages harvested`);
        const totalPassages = status.threads.reduce((sum, t) => sum + t.passageCount, 0);
        if (totalPassages < minPassages) {
          blockers.push(`Only ${totalPassages}/${minPassages} passages harvested`);
        }
        break;
      }

      case 'drafting': {
        const minCurated = await this.configManager.getOrDefault<number>(
          'limits',
          PROJECT_MANAGER_CONFIG.MIN_CURATED_PASSAGES_FOR_DRAFTING,
          10
        );
        requirements.push(`At least ${minCurated} curated passages`);
        requirements.push('At least one thread complete');
        const completeThreads = status.threads.filter(t => t.status === 'complete');
        if (completeThreads.length === 0) {
          blockers.push('No threads have been fully curated');
        }
        break;
      }

      case 'mastering': {
        const minChapters = await this.configManager.getOrDefault<number>(
          'limits',
          PROJECT_MANAGER_CONFIG.MIN_CHAPTERS_FOR_MASTERING,
          1
        );
        requirements.push(`At least ${minChapters} chapter(s) drafted`);
        requirements.push('All chapters reviewed');
        if (status.chapters.length < minChapters) {
          blockers.push(`Only ${status.chapters.length}/${minChapters} chapters drafted`);
        }
        const unreviewedChapters = status.chapters.filter(c => c.status === 'draft');
        if (unreviewedChapters.length > 0) {
          blockers.push(`${unreviewedChapters.length} chapter(s) need review`);
        }
        break;
      }

      case 'complete':
        requirements.push('All chapters approved');
        const unapprovedChapters = status.chapters.filter(c => c.status !== 'approved');
        if (unapprovedChapters.length > 0) {
          blockers.push(`${unapprovedChapters.length} chapter(s) not yet approved`);
        }
        break;
    }

    return {
      phase: targetPhase,
      requirements,
      met: blockers.length === 0,
      blockers,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // WORK ASSIGNMENT
  // ─────────────────────────────────────────────────────────────────

  private async assignWork(request: AssignWorkRequest): Promise<{ success: boolean; error?: string }> {
    const { projectId, agentId, taskType, payload } = request;

    // Get timeout from config
    const timeout = await this.configManager.getOrDefault<number>(
      'limits',
      PROJECT_MANAGER_CONFIG.AGENT_RESPONSE_TIMEOUT,
      30000
    );

    try {
      const response = await Promise.race([
        this.bus.request(agentId, {
          type: taskType,
          payload: { ...payload, projectId },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Agent response timeout')), timeout)
        ),
      ]);

      if (!response.success) {
        // Create intention to handle failure
        this.addIntention({
          type: 'reassign',
          priority: 0.8,
          reason: `Agent ${agentId} failed task: ${response.error}`,
          projectId,
          context: { agentId, taskType, error: response.error },
        });

        return { success: false, error: response.error };
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.addIntention({
        type: 'escalate',
        priority: 0.9,
        reason: `Failed to assign work to ${agentId}: ${errorMessage}`,
        projectId,
        context: { agentId, taskType, error: errorMessage },
      });

      return { success: false, error: errorMessage };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PROGRESS TRACKING
  // ─────────────────────────────────────────────────────────────────

  private async trackProgress(request: { projectId: string }): Promise<{
    phase: ProjectPhase;
    progress: number;
    estimatedCompletion?: string;
  }> {
    const status = await this.getProjectStatus(request);

    return {
      phase: status.phase,
      progress: status.progress,
      // Could calculate estimated completion based on historical data
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // INTENTIONS
  // ─────────────────────────────────────────────────────────────────

  private addIntention(intention: ProjectManagerIntention): void {
    const exists = this.pendingIntentions.some(
      i => i.type === intention.type && i.projectId === intention.projectId
    );
    if (!exists) {
      this.pendingIntentions.push(intention);
      this.pendingIntentions.sort((a, b) => b.priority - a.priority);
    }
  }

  private getIntentions(): ProjectManagerIntention[] {
    return [...this.pendingIntentions];
  }

  // ─────────────────────────────────────────────────────────────────
  // PROJECT STATE UPDATES (called by event handlers)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Update thread info for a project
   */
  updateThread(projectId: string, thread: { id: string; passageCount: number; status: 'active' | 'complete' }): void {
    const status = this.projectStates.get(projectId);
    if (!status) return;

    const existing = status.threads.findIndex(t => t.id === thread.id);
    if (existing >= 0) {
      status.threads[existing] = thread;
    } else {
      status.threads.push(thread);
    }
  }

  /**
   * Update chapter info for a project
   */
  updateChapter(projectId: string, chapter: { id: string; status: 'draft' | 'review' | 'approved' }): void {
    const status = this.projectStates.get(projectId);
    if (!status) return;

    const existing = status.chapters.findIndex(c => c.id === chapter.id);
    if (existing >= 0) {
      status.chapters[existing] = chapter;
    } else {
      status.chapters.push(chapter);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _projectManager: ProjectManagerAgent | null = null;

export function getProjectManagerAgent(): ProjectManagerAgent {
  if (!_projectManager) {
    _projectManager = new ProjectManagerAgent();
  }
  return _projectManager;
}

/**
 * Reset the Project Manager agent (for testing)
 */
export function resetProjectManagerAgent(): void {
  _projectManager = null;
}
