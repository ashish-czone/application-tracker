import { z } from 'zod';
import { MONITORING_SOURCE_KINDS } from '../schema/sources';

export const listMonitoringSourcesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  kind: z.enum(MONITORING_SOURCE_KINDS).optional(),
  isActive: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (typeof v === 'string' ? v === 'true' : v)),
  q: z.string().min(1).max(120).optional(),
  sort: z.enum(['createdAt', '-createdAt', 'label', '-label', 'lastFetchedAt', '-lastFetchedAt'])
    .optional()
    .default('-createdAt'),
});

export type ListMonitoringSourcesQuery = z.infer<typeof listMonitoringSourcesQuerySchema>;
