import { z } from 'zod';

export const updateMonitoringKeywordSchema = z
  .object({
    phrase: z.string().trim().min(2).max(200).optional(),
    isRegex: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (!data.isRegex || !data.phrase) return true;
      try {
        new RegExp(data.phrase);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Invalid regular expression', path: ['phrase'] },
  );

export type UpdateMonitoringKeywordInput = z.infer<typeof updateMonitoringKeywordSchema>;
