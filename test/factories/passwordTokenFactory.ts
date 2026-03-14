import { faker } from '@faker-js/faker';
import { generateRandomToken } from '@packages/auth';
import type { DrizzleDB } from '@packages/database';
import { passwordTokens } from '@packages/database';

export const PasswordTokenFactory = {
  build(overrides: Record<string, unknown> = {}) {
    return {
      identityId: faker.string.uuid(),
      token: generateRandomToken(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      ...overrides,
    };
  },

  async create(db: DrizzleDB, overrides: Record<string, unknown> = {}) {
    const data = this.build(overrides);
    const [result] = await db
      .insert(passwordTokens)
      .values({
        identityId: data.identityId as string,
        token: data.token as string,
        expiresAt: data.expiresAt as Date,
      })
      .returning();
    return result;
  },
};
