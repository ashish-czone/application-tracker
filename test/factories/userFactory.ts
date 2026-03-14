import { faker } from '@faker-js/faker';
import type { PrismaClient } from '@prisma/client';
import { IdentityFactory } from './identityFactory';

export const UserFactory = {
  async create(prisma: PrismaClient, overrides: { identityId?: string; timezone?: string } = {}) {
    const identityId = overrides.identityId ?? (await IdentityFactory.create(prisma)).id;

    return prisma.user.create({
      data: {
        identityId,
        timezone: overrides.timezone ?? null,
      },
    });
  },
};
