import { describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { ApiClient } from '../../apiClient';
import { ApiError } from '../../apiClient';
import { registerLookupTools } from '../lookups';

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
  registerLookupTools(server, api);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return { server, client };
}

describe('lookup tools', () => {
  it('list_projects forwards paging args to GET /projects', async () => {
    const api = makeApi({ get: vi.fn(async () => [{ id: 'p1' }]) });
    const { client } = await pair(api);

    const result = await client.callTool({
      name: 'list_projects',
      arguments: { q: 'foo', page: 2, limit: 50 },
    });

    expect(api.get).toHaveBeenCalledWith('/projects', { q: 'foo', page: 2, limit: 50 });
    expect(result.isError).toBeFalsy();
  });

  it('list_features passes projectId filter', async () => {
    const api = makeApi();
    const { client } = await pair(api);

    await client.callTool({
      name: 'list_features',
      arguments: { projectId: '00000000-0000-0000-0000-000000000001' },
    });

    expect(api.get).toHaveBeenCalledWith('/features', {
      projectId: '00000000-0000-0000-0000-000000000001',
    });
  });

  it('list_tasks passes featureId, assigneeId, status', async () => {
    const api = makeApi();
    const { client } = await pair(api);

    await client.callTool({
      name: 'list_tasks',
      arguments: {
        featureId: '00000000-0000-0000-0000-000000000002',
        status: 'in_progress',
      },
    });

    expect(api.get).toHaveBeenCalledWith('/tasks', {
      featureId: '00000000-0000-0000-0000-000000000002',
      status: 'in_progress',
    });
  });

  it('surfaces ApiError as tool error result', async () => {
    const api = makeApi({
      get: vi.fn(async () => {
        throw new ApiError(403, 'Forbidden', 'no access');
      }),
    });
    const { client } = await pair(api);

    const result = await client.callTool({ name: 'list_tasks', arguments: {} });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]?.text).toContain('403');
    expect(content[0]?.text).toContain('no access');
  });
});
