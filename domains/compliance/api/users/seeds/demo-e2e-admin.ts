import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, eq, users } from '@packages/database';
import { AuthService } from '@packages/auth';
import { RbacService, rolePermissions } from '@packages/rbac';

const E2E_ADMIN_EMAIL = 'e2e-admin@compliance.test';
const E2E_ADMIN_PASSWORD = 'E2eAdmin1234';
// Pinned id so JWTs minted for the e2e-admin survive truncate-and-reseed
// cycles run by the test-hooks reset endpoint. Without a stable id, every
// reset would mint a new userId and invalidate the suite's auth token.
const E2E_ADMIN_USER_ID = 'e2ea0000-0000-4000-8000-000000000000';

export const seedDemoE2eAdmin = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const auth = ctx.get(AuthService);
  const rbac = ctx.get(RbacService);

  const existing = await auth.findUserByEmail(E2E_ADMIN_EMAIL);
  if (existing) return;

  const [superAdminRow] = await database.db
    .select({ roleId: rolePermissions.roleId })
    .from(rolePermissions)
    .where(eq(rolePermissions.permission, '*'))
    .limit(1);
  if (!superAdminRow) return;

  const [user] = await database.db
    .insert(users)
    .values({
      id: E2E_ADMIN_USER_ID,
      email: E2E_ADMIN_EMAIL,
      firstName: 'E2E',
      lastName: 'Admin',
      userType: 'client',
    })
    .returning();

  await auth.createPasswordCredential(user.id, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD);
  await rbac.assignRoleToUser(user.id, superAdminRow.roleId);
};
