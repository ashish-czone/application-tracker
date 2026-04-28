import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../apiClient';
import { jsonResult, toErrorResult } from './result';
import { makeRegistrar } from './register';

const createTaskSchema: z.ZodRawShape = {
  featureId: z.string().uuid().describe('Feature this task belongs to'),
  title: z.string().min(1).describe('Task title'),
  description: z.string().optional(),
  assigneeId: z.string().uuid().optional().describe('User to assign'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .optional()
    .describe('Due date in YYYY-MM-DD'),
  status: z
    .string()
    .optional()
    .describe('Initial workflow state. Defaults to the entity initial state if omitted.'),
};

const transitionTaskSchema: z.ZodRawShape = {
  id: z.string().uuid().describe('Task id to transition'),
  to: z
    .string()
    .min(1)
    .describe(
      'Target workflow state name (e.g. "in_progress", "done"). Server enforces allowed transitions.',
    ),
  fieldKey: z
    .string()
    .min(1)
    .optional()
    .describe('Workflow field key. Defaults to "status".'),
  reason: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
};

export function registerMutationTools(server: McpServer, api: ApiClient): void {
  const register = makeRegistrar(server);

  register(
    'create_task',
    'Create a new task under a feature. Returns the created task.',
    createTaskSchema,
    async (args) => {
      try {
        return jsonResult(await api.post('/tasks', args));
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );

  register(
    'transition_task',
    'Move a task to a different workflow state (e.g. mark as done). The server validates the transition against the workflow definition; invalid targets return an error.',
    transitionTaskSchema,
    async (args) => {
      const { id, fieldKey, to, reason, comment } = args as {
        id: string;
        fieldKey?: string;
        to: string;
        reason?: string;
        comment?: string;
      };
      try {
        return jsonResult(
          await api.post(`/tasks/${encodeURIComponent(id)}/transition`, {
            fieldKey: fieldKey ?? 'status',
            to,
            reason,
            comment,
          }),
        );
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );
}
