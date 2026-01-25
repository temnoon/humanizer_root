/**
 * AUI PostgreSQL Store - Task Methods
 *
 * Agent task CRUD operations.
 *
 * @module @humanizer/core/storage/aui/tasks
 */

import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import type { AgentTask } from '../../aui/types.js';
import {
  INSERT_AUI_TASK,
  GET_AUI_TASK,
  UPDATE_AUI_TASK,
  GET_AUI_TASK_HISTORY,
} from '../schema-aui.js';
import type { DbTaskRow } from './row-types.js';
import { rowToTask } from './converters.js';

export interface TaskStoreMethods {
  createTask(sessionId: string, task: Omit<AgentTask, 'id' | 'context'>): Promise<AgentTask>;
  getTask(id: string): Promise<AgentTask | undefined>;
  updateTask(
    id: string,
    update: Partial<{
      status: AgentTask['status'];
      steps: AgentTask['steps'];
      plan: AgentTask['plan'];
      result: unknown;
      error: string;
      totalTokens: number;
      totalCostCents: number;
      completedAt: number;
    }>
  ): Promise<AgentTask | undefined>;
  getTaskHistory(sessionId: string, limit?: number): Promise<AgentTask[]>;
}

export function createTaskMethods(pool: Pool): TaskStoreMethods {
  return {
    async createTask(
      sessionId: string,
      task: Omit<AgentTask, 'id' | 'context'>
    ): Promise<AgentTask> {
      const now = new Date();
      const id = randomUUID();

      const result = await pool.query(INSERT_AUI_TASK, [
        id,
        sessionId,
        task.request,
        task.status,
        JSON.stringify(task.steps),
        task.plan ? JSON.stringify(task.plan) : null,
        task.result ? JSON.stringify(task.result) : null,
        task.error ?? null,
        task.priority,
        task.totalTokens,
        task.totalCostCents,
        new Date(task.startedAt),
        task.completedAt ? new Date(task.completedAt) : null,
        now,
      ]);

      return rowToTask(result.rows[0] as DbTaskRow);
    },

    async getTask(id: string): Promise<AgentTask | undefined> {
      const result = await pool.query(GET_AUI_TASK, [id]);
      if (result.rows.length === 0) return undefined;
      return rowToTask(result.rows[0] as DbTaskRow);
    },

    async updateTask(
      id: string,
      update: Partial<{
        status: AgentTask['status'];
        steps: AgentTask['steps'];
        plan: AgentTask['plan'];
        result: unknown;
        error: string;
        totalTokens: number;
        totalCostCents: number;
        completedAt: number;
      }>
    ): Promise<AgentTask | undefined> {
      const result = await pool.query(UPDATE_AUI_TASK, [
        id,
        update.status ?? null,
        update.steps ? JSON.stringify(update.steps) : null,
        update.plan ? JSON.stringify(update.plan) : null,
        update.result ? JSON.stringify(update.result) : null,
        update.error ?? null,
        update.totalTokens ?? null,
        update.totalCostCents ?? null,
        update.completedAt ? new Date(update.completedAt) : null,
      ]);

      if (result.rows.length === 0) return undefined;
      return rowToTask(result.rows[0] as DbTaskRow);
    },

    async getTaskHistory(sessionId: string, limit?: number): Promise<AgentTask[]> {
      const result = await pool.query(GET_AUI_TASK_HISTORY, [
        sessionId,
        limit ?? 50,
      ]);
      return result.rows.map((row) => rowToTask(row as DbTaskRow));
    },
  };
}
