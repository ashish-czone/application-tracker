import { faker } from '@faker-js/faker';
import { hashPassword } from '@packages/auth';
import type { PrismaClient } from '@prisma/client';

const DEFAULT_PASSWORD = 'Password123!';

export const IdentityFactory = {
  build(overrides: Record<string, unknown> = {}) {
    return {
      email: faker.internet.email().toLowerCase(),
      password: DEFAULT_PASSWORD,
      ...overrides,
    };
  },

  async create(prisma: PrismaClient, overrides: Record<string, unknown> = {}) {
    const { password, ...rest } = { ...this.build(), ...overrides };
    const passwordHash = await hashPassword(password as string);

    return prisma.identity.create({
      data: {
        email: (rest.email as string) ?? faker.internet.email().toLowerCase(),
        passwordHash,
      },
    });
  },

  async createWithRole(prisma: PrismaClient, roleName: string, overrides: Record<string, unknown> = {}) {
    const identity = await this.create(prisma, overrides);

    // Find or create role
    let role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      role = await prisma.role.create({
        data: { name: roleName, description: `${roleName} role` },
      });
    }

    await prisma.identityRole.create({
      data: { identityId: identity.id, roleId: role.id },
    });

    return identity;
  },

  DEFAULT_PASSWORD,
};
