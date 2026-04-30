import { z } from 'zod';
import { MONITORING_ITEM_STATUSES } from '../schema/items';

/**
 * Inbox query DTO.
 *
 * `status='new'` returns items literally in 'new' AND items in 'snoozed'
 * whose snooze has expired — that's the operator's "what's actionable
 * right now" view. Server computes this; do not derive in JS.
 */
export const listMonitoringItemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  sourceId: z.string().uuid().optional(),
  status: z.enum(MONITORING_ITEM_STATUSES).optional(),
  matchedKeywordId: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(200).optional(),
  postedAfter: z.coerce.date().optional(),
  postedBefore: z.coerce.date().optional(),
  sort: z
    .enum(['fetchedAt', '-fetchedAt', 'postedAt', '-postedAt'])
    .optional()
    .default('-fetchedAt'),
});

export type ListMonitoringItemsQuery = z.infer<typeof listMonitoringItemsQuerySchema>;
