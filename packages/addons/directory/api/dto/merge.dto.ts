import { z } from 'zod';

export const MergeRequestSchema = z.object({
  loserId: z.string().uuid(),
  winnerId: z.string().uuid(),
});

export type MergeRequest = z.infer<typeof MergeRequestSchema>;
