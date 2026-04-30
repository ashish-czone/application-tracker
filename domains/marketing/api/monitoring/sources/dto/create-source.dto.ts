import { z } from 'zod';
import { MONITORING_SOURCE_KINDS } from '../schema/sources';

const redditConfigSchema = z.object({
  subreddit: z.string().min(1, 'Subreddit name required (e.g. "webdev")'),
  sort: z.enum(['new', 'hot', 'top', 'rising']).optional().default('new'),
  timeRange: z.enum(['hour', 'day', 'week', 'month']).optional(),
});

const hackernewsConfigSchema = z.object({
  query: z.string().min(1, 'Query required (Algolia search expression)'),
  tags: z.array(z.string()).optional(),
});

const rssConfigSchema = z.object({
  url: z.string().url('Valid feed URL required'),
});

export const createMonitoringSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('reddit'),
    label: z.string().min(1).max(120),
    config: redditConfigSchema,
    pollingCadenceMinutes: z.number().int().min(5).max(60 * 24).optional().default(15),
    isActive: z.boolean().optional().default(true),
  }),
  z.object({
    kind: z.literal('hackernews'),
    label: z.string().min(1).max(120),
    config: hackernewsConfigSchema,
    pollingCadenceMinutes: z.number().int().min(5).max(60 * 24).optional().default(15),
    isActive: z.boolean().optional().default(true),
  }),
  z.object({
    kind: z.literal('rss'),
    label: z.string().min(1).max(120),
    config: rssConfigSchema,
    pollingCadenceMinutes: z.number().int().min(5).max(60 * 24).optional().default(60),
    isActive: z.boolean().optional().default(true),
  }),
]);

export type CreateMonitoringSourceInput = z.infer<typeof createMonitoringSourceSchema>;

export { MONITORING_SOURCE_KINDS };
