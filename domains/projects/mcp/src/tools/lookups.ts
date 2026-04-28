import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../apiClient';
import { jsonResult, toErrorResult } from './result';
import { makeRegistrar } from './register';

const paging: z.ZodRawShape = {
  page: z.number().int().positive().optional().describe('1-based page number'),
  limit: z.number().int().positive().max(200).optional().describe('Page size, max 200'),
  q: z.string().optional().describe('Free-text search'),
};

export function registerLookupTools(server: McpServer, api: ApiClient): void {
  const register = makeRegistrar(server);

  register(
    'list_projects',
    'List projects in the platform. Supports search and pagination.',
    { ...paging },
    async (args) => {
      try {
        return jsonResult(await api.get('/projects', args));
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );

  register(
    'list_features',
    'List features. Pass projectId to scope to a single project, or milestoneId to scope to a milestone.',
    {
      projectId: z.string().uuid().optional(),
      milestoneId: z.string().uuid().optional(),
      ...paging,
    },
    async (args) => {
      try {
        return jsonResult(await api.get('/features', args));
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );

  register(
    'list_tasks',
    'List tasks. Filter by featureId, assigneeId, or status (workflow state name, e.g. "todo", "in_progress", "done").',
    {
      featureId: z.string().uuid().optional(),
      assigneeId: z.string().uuid().optional(),
      status: z.string().optional(),
      ...paging,
    },
    async (args) => {
      try {
        return jsonResult(await api.get('/tasks', args));
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );
}
