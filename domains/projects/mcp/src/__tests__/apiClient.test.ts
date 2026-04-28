import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '../apiClient';

const config = { apiUrl: 'https://api.example.com', apiToken: 'tok' };

function mockFetch(response: { status?: number; body?: unknown; text?: string }) {
  const status = response.status ?? 200;
  const text =
    response.text ?? (response.body !== undefined ? JSON.stringify(response.body) : '');
  return vi.fn<typeof fetch>(async () =>
    new Response(text, {
      status,
      statusText: status === 200 ? 'OK' : 'Error',
    }),
  );
}

describe('apiClient', () => {
  it('GET sends bearer token and parses JSON', async () => {
    const fetchImpl = mockFetch({ body: { ok: true } });
    const client = createApiClient(config, fetchImpl);

    const result = await client.get<{ ok: boolean }>('/tasks');

    expect(result).toEqual({ ok: true });
    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    const [url, init] = call!;
    expect(url).toBe('https://api.example.com/tasks');
    expect(init?.method).toBe('GET');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer tok',
      Accept: 'application/json',
    });
  });

  it('GET appends query params and skips undefined', async () => {
    const fetchImpl = mockFetch({ body: [] });
    const client = createApiClient(config, fetchImpl);

    await client.get('/tasks', { projectId: 'p1', assigneeId: undefined, page: 2 });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://api.example.com/tasks?projectId=p1&page=2',
    );
  });

  it('POST sends JSON body and Content-Type', async () => {
    const fetchImpl = mockFetch({ body: { id: 't1' } });
    const client = createApiClient(config, fetchImpl);

    await client.post('/tasks', { title: 'New' });

    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ title: 'New' }));
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('throws ApiError on non-2xx with body in message', async () => {
    const fetchImpl = mockFetch({ status: 403, text: 'forbidden' });
    const client = createApiClient(config, fetchImpl);

    await expect(client.get('/tasks')).rejects.toBeInstanceOf(ApiError);
  });

  it('ApiError captures status and body', async () => {
    const fetchImpl = mockFetch({ status: 422, text: '{"message":"bad"}' });
    const client = createApiClient(config, fetchImpl);

    await expect(client.get('/tasks')).rejects.toMatchObject({
      status: 422,
      body: '{"message":"bad"}',
    });
  });
});
