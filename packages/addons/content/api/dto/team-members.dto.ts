import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { teamMembers } from '../schema/team-members';

export const TeamMemberRowSchema = createSelectSchema(teamMembers);
export const CreateTeamMemberSchema = createInsertSchema(teamMembers, {
  fullName: (s) => s.min(1),
}).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, deletedBy: true });
export const UpdateTeamMemberSchema = CreateTeamMemberSchema.partial();

export type CreateTeamMemberDto = z.infer<typeof CreateTeamMemberSchema>;
export type UpdateTeamMemberDto = z.infer<typeof UpdateTeamMemberSchema>;
