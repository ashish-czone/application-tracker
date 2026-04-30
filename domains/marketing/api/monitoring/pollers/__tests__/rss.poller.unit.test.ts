import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RssPoller } from '../jobs/rss.poller';
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
  const poller = new RssPoller(queue as any, sources as any, items as any, events as any, mockAppLogger);
  return { poller, queue, sources, items, events };
}

describe('RssPoller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('registers its processor on module init', () => {
    const { poller, queue } = createPoller();
    poller.onModuleInit();
    expect(queue.registerProcessor).toHaveBeenCalledWith({
      name: 'marketing.poll.rss',
      handler: expect.any(Function),
    });
  });

  it('parses feed and ingests each entry with guid + content', async () => {
    const { poller, sources, items } = createPoller();
    sources.findOne.mockResolvedValueOnce({
      id: 'src-1',
      kind: 'rss',
      isActive: true,
      configJson: { url: 'https://example.com/feed.xml' },
    });

    // Stub the parser used by the poller instance
    const parser = (poller as any).parser as { parseURL: (u: string) => Promise<unknown> };
    parser.parseURL = vi.fn().mockResolvedValueOnce({
      items: [
        {
          guid: 'item-1',
          link: 'https://example.com/post-1',
          title: 'Hello',
          contentSnippet: '<p>some <em>content</em></p>',
          creator: 'jane',
          isoDate: '2026-04-30T09:00:00Z',
        },
      ],
    });

    await poller.execute({ sourceId: 'src-1' });

    expect(items.ingestItem).toHaveBeenCalledWith(
      'src-1',
      expect.objectContaining({
        externalId: 'item-1',
        url: 'https://example.com/post-1',
        title: 'Hello',
        author: 'jane',
        bodyExcerpt: 'some content',
      }),
    );
    expect(sources.recordPollSuccess).toHaveBeenCalledWith('src-1');
  });

  it('skips entries with no guid AND no link', async () => {
    const { poller, sources, items } = createPoller();
    sources.findOne.mockResolvedValueOnce({
      id: 'src-1',
      kind: 'rss',
      isActive: true,
      configJson: { url: 'https://example.com/feed.xml' },
    });

    const parser = (poller as any).parser as { parseURL: (u: string) => Promise<unknown> };
    parser.parseURL = vi.fn().mockResolvedValueOnce({
      items: [{ title: 'no guid no link' }, { guid: 'g', link: 'https://x/y' }],
    });

    await poller.execute({ sourceId: 'src-1' });

    expect(items.ingestItem).toHaveBeenCalledTimes(1);
  });

  it('emits POLL_FAILED on parser error', async () => {
    const { poller, sources, events } = createPoller();
    sources.findOne.mockResolvedValueOnce({
      id: 'src-1',
      kind: 'rss',
      isActive: true,
      configJson: { url: 'https://bad/feed' },
    });

    const parser = (poller as any).parser as { parseURL: (u: string) => Promise<unknown> };
    parser.parseURL = vi.fn().mockRejectedValueOnce(new Error('feed unreachable'));

    await expect(poller.execute({ sourceId: 'src-1' })).rejects.toThrow(/feed unreachable/);

    expect(events.emit).toHaveBeenCalledWith(
      MARKETING_MONITORING_SOURCE_POLL_FAILED,
      expect.objectContaining({
        payload: expect.objectContaining({ kind: 'rss' }),
      }),
    );
  });
});
