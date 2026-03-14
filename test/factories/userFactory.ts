import { faker } from '@faker-js/faker';
import type { DrizzleDB } from '@packages/database';
import { users, identities, eq } from '@packages/database';
import { IdentityFactory } from './identityFactory';

interface UserOverrides {
  identityId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  timezone?: string | null;
}

export const UserFactory = {
  buildProfile(overrides: Partial<UserOverrides> = {}) {
    return {
      firstName: overrides.firstName ?? faker.person.firstName(),
      lastName: overrides.lastName ?? faker.person.lastName(),
      phone: overrides.phone ?? null,
      avatarUrl: overrides.avatarUrl ?? null,
      timezone: overrides.timezone ?? null,
    };
  },

  async create(db: DrizzleDB, overrides: UserOverrides = {}) {
    const identityId = overrides.identityId ?? (await IdentityFactory.create(db)).id;
    const profile = this.buildProfile(overrides);

    const [user] = await db
      .insert(users)
      .values({
        identityId,
        ...profile,
      })
      .returning();

    const [identity] = await db
      .select({ email: identities.email })
      .from(identities)
      .where(eq(identities.id, user.identityId))
      .limit(1);

    return { ...user, identity: { email: identity.email } };
  },
};
