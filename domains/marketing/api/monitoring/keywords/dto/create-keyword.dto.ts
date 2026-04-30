import { z } from 'zod';

export const createMonitoringKeywordSchema = z.object({
  sourceId: z.string().uuid('Valid source ID required'),
  phrase: z.string().trim().min(2, 'Phrase must be at least 2 characters').max(200),
  isRegex: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
}).refine(
  (data) => {
    if (!data.isRegex) return true;
    try {
      new RegExp(data.phrase);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid regular expression', path: ['phrase'] },
);

export type CreateMonitoringKeywordInput = z.infer<typeof createMonitoringKeywordSchema>;
