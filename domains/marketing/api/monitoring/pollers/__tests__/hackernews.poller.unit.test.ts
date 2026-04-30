import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HackernewsPoller } from '../jobs/hackernews.poller';
import { MARKETING_MONITORING_SOURCE_POLL_FAILED } from '../events/types';

const mockLogger = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
const mockAppLogger = { forContext: () => mockLogger } as any;

function createPoller() {
  const queue = { registerProcessor: vi.fn() };
  const sources = {
    findOne: vi.fn(),
    recordPollSuccess: vi.fn().mockResolvedValue(undefined),
    recordPollError: vi.fn().mockResolvedValue(undefined),
  };
  const items = { ingestItem: vi.fn().mockResolvedValue(null) };
  const events = { emit: vi.fn() };
  const poller = new HackernewsPoller(queue as any, sources as any, items as any, events as any, mockAppLogger);
  return { poller, queue, sources, items, events };
}

describe('HackernewsPoller', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('registers its processor on module init', () => {
    const { poller, queue } = createPoller();
    poller.onModuleInit();
    expect(queue.registerProcessor).toHaveBeenCalledWith({
      name: 'marketing.poll.hackernews',
      handler: expect.any(Function),
    });
  });

  it('fetches Algolia search and ingests each hit', async () => {
    const { poller, sources, items } = createPoller();
    sources.findOne.mockResolvedValueOnce({
      id: 'src-1',
      kind: 'hackernews',
      isActive: true,
      configJson: { query: 'react', tags: ['story'] },
    });

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          hits: [
            {
              objectID: '12345',
              title: 'Show HN: React thing',
              story_text: 'we built a thing',
              comment_text: null,
              url: 'https://example.com/x',
              author: 'pg',
              created_at: '2026-04-30T10:00:00Z',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as any;

    await poller.execute({ sourceId: 'src-1' });

    expect(items.ingestItem).toHaveBeenCalledWith(
      'src-1',
      expect.objectContaining({
        externalId: '12345',
        url: 'https://example.com/x',
        title: 'Show HN: React thing',
        bodyExcerpt: 'we built a thing',
        author: 'pg',
      }),
    );
    expect(sources.recordPollSuccess).toHaveBeenCalledWith('src-1');
  });

  it('falls back to news.ycombinator URL when hit.url is null', async () => {
    const { poller, sources, items } = createPoller();
    sources.findOne.mockResolvedValueOnce({
      id: 'src-1',
      kind: 'hackernews',
      isActive: true,
      configJson: { query: 'a' },
    });

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          hits: [
            {
              objectID: '99',
              title: 'Ask HN',
              story_text: null,
              comment_text: 'comment body',
              url: null,
              author: 'x',
              created_at: '2026-04-30T10:00:00Z',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as any;

    await poller.execute({ sourceId: 'src-1' });

    expect(items.ingestItem).toHaveBeenCalledWith(
      'src-1',
      expect.objectContaining({
        externalId: '99',
        url: 'https://news.ycombinator.com/item?id=99',
        bodyExcerpt: 'comment body',
      }),
    );
  });

  it('emits POLL_FAILED on Algolia error', async () => {
    const { poller, sources, events } = createPoller();
    sources.findOne.mockResolvedValueOnce({
      id: 'src-1',
      kind: 'hackernews',
      isActive: true,
      configJson: { query: 'x' },
    });

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response('boom', { status: 500 }),
    ) as any;

    await expect(poller.execute({ sourceId: 'src-1' })).rejects.toThrow(/HN search failed/);

    expect(events.emit).toHaveBeenCalledWith(
      MARKETING_MONITORING_SOURCE_POLL_FAILED,
      expect.objectContaining({
        payload: expect.objectContaining({ kind: 'hackernews' }),
      }),
    );
  });
});
