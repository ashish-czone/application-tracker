import { describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { ApiClient } from '../../apiClient';
import { ApiError } from '../../apiClient';
import { registerMutationTools } from '../mutations';

function makeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: vi.fn(async () => []),
    post: vi.fn(async () => ({})),
    patch: vi.fn(async () => ({})),
    ...overrides,
  } as ApiClient;
}

async function pair(api: ApiClient) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerMutationTools(server, api);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client };
}

const FEATURE_ID = '00000000-0000-0000-0000-0000000000aa';
const TASK_ID = '00000000-0000-0000-0000-0000000000bb';
const ASSIGNEE_ID = '00000000-0000-0000-0000-0000000000cc';

describe('mutation tools', () => {
  it('create_task POSTs to /tasks with provided fields', async () => {
    const post = vi.fn(async () => ({ id: TASK_ID }));
    const api = makeApi({ post });
    const { client } = await pair(api);

    const result = await client.callTool({
      name: 'create_task',
      arguments: {
        featureId: FEATURE_ID,
        title: 'Wire up login',
        assigneeId: ASSIGNEE_ID,
        dueDate: '2026-05-01',
      },
    });

    expect(result.isError).toBeFalsy();
    expect(post).toHaveBeenCalledWith('/tasks', {
      featureId: FEATURE_ID,
      title: 'Wire up login',
      assigneeId: ASSIGNEE_ID,
      dueDate: '2026-05-01',
    });
  });

  it('create_task rejects bad dueDate', async () => {
    const api = makeApi();
    const { client } = await pair(api);

    const result = await client.callTool({
      name: 'create_task',
      arguments: { featureId: FEATURE_ID, title: 'X', dueDate: '05/01/2026' },
    });

    expect(result.isError).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('transition_task POSTs to /tasks/:id/transition with default fieldKey "status"', async () => {
    const post = vi.fn(async () => ({ ok: true }));
    const api = makeApi({ post });
    const { client } = await pair(api);

    await client.callTool({
      name: 'transition_task',
      arguments: { id: TASK_ID, to: 'done' },
    });

    expect(post).toHaveBeenCalledWith(`/tasks/${TASK_ID}/transition`, {
      fieldKey: 'status',
      to: 'done',
      reason: undefined,
      comment: undefined,
    });
  });

  it('transition_task forwards reason + comment', async () => {
    const post = vi.fn(async () => ({}));
    const api = makeApi({ post });
    const { client } = await pair(api);

    await client.callTool({
      name: 'transition_task',
      arguments: {
        id: TASK_ID,
        to: 'in_progress',
        reason: 'starting work',
        comment: 'kicking off after standup',
      },
    });

    expect(post).toHaveBeenCalledWith(`/tasks/${TASK_ID}/transition`, {
      fieldKey: 'status',
      to: 'in_progress',
      reason: 'starting work',
      comment: 'kicking off after standup',
    });
  });

  it('transition_task surfaces 422 from server as tool error', async () => {
    const post = vi.fn(async () => {
      throw new ApiError(422, 'Unprocessable Entity', 'transition not allowed');
    });
    const api = makeApi({ post });
    const { client } = await pair(api);

    const result = await client.callTool({
      name: 'transition_task',
      arguments: { id: TASK_ID, to: 'done' },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]?.text).toContain('422');
    expect(content[0]?.text).toContain('transition not allowed');
  });
});
