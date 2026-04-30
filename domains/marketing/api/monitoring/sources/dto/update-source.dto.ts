import { z } from 'zod';

export const updateMonitoringSourceSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  pollingCadenceMinutes: z.number().int().min(5).max(60 * 24).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateMonitoringSourceInput = z.infer<typeof updateMonitoringSourceSchema>;
