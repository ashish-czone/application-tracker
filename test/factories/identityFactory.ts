import { faker } from '@faker-js/faker';
import { hashPassword } from '@packages/auth';
import type { DrizzleDB } from '@packages/database';
import { identities, roles, identityRoles, eq } from '@packages/database';

const DEFAULT_PASSWORD = 'Password123!';

export const IdentityFactory = {
  build(overrides: Record<string, unknown> = {}) {
    return {
      email: faker.internet.email().toLowerCase(),
      password: DEFAULT_PASSWORD,
      ...overrides,
    };
  },

  async create(db: DrizzleDB, overrides: Record<string, unknown> = {}) {
    const { password, ...rest } = { ...this.build(), ...overrides };
    const passwordHash = await hashPassword(password as string);

    const [identity] = await db
      .insert(identities)
      .values({
        email: (rest.email as string) ?? faker.internet.email().toLowerCase(),
        passwordHash,
      })
      .returning();

    return identity;
  },

  async createWithRole(db: DrizzleDB, roleName: string, overrides: Record<string, unknown> = {}) {
    const identity = await this.create(db, overrides);

    // Find or create role
    let [role] = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1);
    if (!role) {
      [role] = await db
        .insert(roles)
        .values({ name: roleName, description: `${roleName} role` })
        .returning();
    }

    await db.insert(identityRoles).values({ identityId: identity.id, roleId: role.id });

    return identity;
  },

  DEFAULT_PASSWORD,
};
