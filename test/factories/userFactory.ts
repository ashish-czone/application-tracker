import { faker } from '@faker-js/faker';
import type { PrismaClient } from '@packages/database';
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

  async create(prisma: PrismaClient, overrides: UserOverrides = {}) {
    const identityId = overrides.identityId ?? (await IdentityFactory.create(prisma)).id;
    const profile = this.buildProfile(overrides);

    return prisma.user.create({
      data: {
        identityId,
        ...profile,
      },
      include: { identity: { select: { email: true } } },
    });
  },
};
