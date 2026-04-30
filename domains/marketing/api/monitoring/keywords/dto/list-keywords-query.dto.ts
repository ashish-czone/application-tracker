import { z } from 'zod';

export const listMonitoringKeywordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  sourceId: z.string().uuid().optional(),
  isActive: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (typeof v === 'string' ? v === 'true' : v)),
  q: z.string().trim().min(1).max(200).optional(),
  sort: z
    .enum(['createdAt', '-createdAt', 'phrase', '-phrase'])
    .optional()
    .default('-createdAt'),
});

export type ListMonitoringKeywordsQuery = z.infer<typeof listMonitoringKeywordsQuerySchema>;
