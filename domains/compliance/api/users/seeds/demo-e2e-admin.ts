import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, eq, users } from '@packages/database';
import { AuthService } from '@packages/auth';
import { RbacService, rolePermissions } from '@packages/rbac';

const E2E_ADMIN_EMAIL = 'e2e-admin@compliance.test';
const E2E_ADMIN_PASSWORD = 'E2eAdmin1234';

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
      email: E2E_ADMIN_EMAIL,
      firstName: 'E2E',
      lastName: 'Admin',
      userType: 'client',
    })
    .returning();

  await auth.createPasswordCredential(user.id, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD);
  await rbac.assignRoleToUser(user.id, superAdminRow.roleId);
};
