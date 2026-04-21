import { defineMapper } from '../registry';

export interface TeamMemberRecord {
  id: string;
  fullName: string;
  role: string | null;
  bio: string | null;
  photoUrl: string | null;
  linkedinUrl: string | null;
  email: string | null;
}

export interface TeamGridFields extends Record<string, unknown> {
  members: Array<{
    id: string;
    fullName: string;
    role: string | null;
    bio: string | null;
    photoUrl: string | null;
    linkedinUrl: string | null;
    email: string | null;
  }>;
}

export const teamGridMapper = defineMapper<TeamMemberRecord, TeamGridFields>({
  entity: 'team-members',
  block: 'team-grid',
  map: (records) => ({
    members: records.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      role: r.role,
      bio: r.bio,
      photoUrl: r.photoUrl,
      linkedinUrl: r.linkedinUrl,
      email: r.email,
    })),
  }),
});
