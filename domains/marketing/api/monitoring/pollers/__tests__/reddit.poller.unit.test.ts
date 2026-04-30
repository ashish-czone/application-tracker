import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RedditPoller } from '../jobs/reddit.poller';
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
  const poller = new RedditPoller(queue as any, sources as any, items as any, events as any, mockAppLogger);
  return { poller, queue, sources, items, events };
}

describe('RedditPoller', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
    process.env.REDDIT_CLIENT_ID = 'cid';
    process.env.REDDIT_CLIENT_SECRET = 'csec';
    process.env.REDDIT_USER_AGENT = 'test-agent/1.0';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.REDDIT_CLIENT_ID;
    delete process.env.REDDIT_CLIENT_SECRET;
    delete process.env.REDDIT_USER_AGENT;
  });

  it('registers its processor on module init', () => {
    const { poller, queue } = createPoller();
    poller.onModuleInit();
    expect(queue.registerProcessor).toHaveBeenCalledWith({
      name: 'marketing.poll.reddit',
      handler: expect.any(Function),
    });
  });

  it('skips silently when source not found', async () => {
    const { poller, sources, items, events } = createPoller();
    sources.findOne.mockRejectedValueOnce(new Error('not found'));

    await poller.execute({ sourceId: 'missing' });

    expect(items.ingestItem).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('skips when source kind mismatches', async () => {
    const { poller, sources, items } = createPoller();
    sources.findOne.mockResolvedValueOnce({ id: 'src-1', kind: 'rss', isActive: true });

    await poller.execute({ sourceId: 'src-1' });

    expect(items.ingestItem).not.toHaveBeenCalled();
  });

  it('skips when source is inactive', async () => {
    const { poller, sources, items } = createPoller();
    sources.findOne.mockResolvedValueOnce({ id: 'src-1', kind: 'reddit', isActive: false });

    await poller.execute({ sourceId: 'src-1' });

    expect(items.ingestItem).not.toHaveBeenCalled();
  });

  it('fetches token, lists subreddit, and ingests each child', async () => {
    const { poller, sources, items } = createPoller();
    sources.findOne.mockResolvedValueOnce({
      id: 'src-1',
      kind: 'reddit',
      isActive: true,
      configJson: { subreddit: 'webdev', sort: 'new' },
    });

    globalThis.fetch = vi
      .fn()
      // Token request
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'tok-1', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      // Listing request
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              children: [
                {
                  data: {
                    id: 'abc',
                    name: 't3_abc',
                    permalink: '/r/webdev/comments/abc/foo/',
                    title: 'Need a developer',
                    selftext: 'looking for react help',
                    author: 'someone',
                    created_utc: 1714400000,
                    url: 'https://reddit.com/...',
                  },
                },
              ],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ) as any;

    await poller.execute({ sourceId: 'src-1' });

    expect(items.ingestItem).toHaveBeenCalledWith(
      'src-1',
      expect.objectContaining({
        externalId: 't3_abc',
        url: 'https://www.reddit.com/r/webdev/comments/abc/foo/',
        title: 'Need a developer',
        bodyExcerpt: 'looking for react help',
        author: 'someone',
      }),
    );
    expect(sources.recordPollSuccess).toHaveBeenCalledWith('src-1');
  });

  it('records error, emits POLL_FAILED, and rethrows on fetch failure', async () => {
    const { poller, sources, events } = createPoller();
    sources.findOne.mockResolvedValueOnce({
      id: 'src-1',
      kind: 'reddit',
      isActive: true,
      configJson: { subreddit: 'webdev' },
    });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('rate limited', { status: 429 }),
      ) as any;

    await expect(poller.execute({ sourceId: 'src-1' })).rejects.toThrow(/Reddit token request failed/);

    expect(sources.recordPollError).toHaveBeenCalledWith('src-1', expect.any(String));
    expect(events.emit).toHaveBeenCalledWith(
      MARKETING_MONITORING_SOURCE_POLL_FAILED,
      expect.objectContaining({
        payload: expect.objectContaining({ sourceId: 'src-1', kind: 'reddit' }),
      }),
    );
  });
});
