/**
 * Stable queue names per source kind. Each kind has its own queue so that
 * a backed-up Reddit fetch doesn't slow down RSS polling, and each poller's
 * concurrency / retry behaviour can be tuned independently later.
 */
export const POLLER_QUEUES = {
  reddit: 'marketing.poll.reddit',
  hackernews: 'marketing.poll.hackernews',
  rss: 'marketing.poll.rss',
} as const;

export type PollerQueueName = (typeof POLLER_QUEUES)[keyof typeof POLLER_QUEUES];

/**
 * Job payload pushed by PollerSchedulerService into a per-kind queue.
 * The poller resolves the source on demand from the sourceId.
 */
export interface PollJobData {
  sourceId: string;
}

/**
 * BullMQ scheduler ID convention. Stable per source so update/remove
 * stay deterministic.
 */
export function pollerSchedulerId(sourceId: string): string {
  return `marketing.poll.${sourceId}`;
}
