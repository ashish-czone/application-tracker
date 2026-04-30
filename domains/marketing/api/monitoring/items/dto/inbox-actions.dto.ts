import { z } from 'zod';

export const markEngagedSchema = z.object({
  note: z.string().trim().max(2000).optional(),
});
export type MarkEngagedInput = z.infer<typeof markEngagedSchema>;

export const dismissItemSchema = z.object({
  note: z.string().trim().max(2000).optional(),
});
export type DismissItemInput = z.infer<typeof dismissItemSchema>;

export const snoozeItemSchema = z.object({
  snoozedUntil: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
    message: 'snoozedUntil must be in the future',
  }),
  note: z.string().trim().max(2000).optional(),
});
export type SnoozeItemInput = z.infer<typeof snoozeItemSchema>;
