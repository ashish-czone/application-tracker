import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { users } from '@packages/database/schema';
import { roles } from '@packages/rbac/schema/roles';
import { rolePermissions } from '@packages/rbac/schema/role-permissions';
import { userRoles } from '@packages/rbac/schema/user-roles';
import { credentials } from '../schema/credentials';

const SALT_ROUNDS = 12;
const DEFAULT_ADMIN_EMAIL = 'admin@admin.com';
const DEFAULT_ADMIN_PASSWORD = 'Admin1234';

export const seedSystem = async (db: NodePgDatabase): Promise<void> => {
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL;
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;

  await ensureDefaultClientRole(db);
  const adminRoleId = await ensureAdminRole(db);
  await ensureAdminUser(db, adminRoleId, adminEmail, adminPassword);
};

async function ensureDefaultClientRole(db: NodePgDatabase): Promise<void> {
  const [existing] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.userType, 'client'), eq(roles.isDefault, true)))
    .limit(1);

  if (existing) return;

  await db.insert(roles).values({
    name: 'Client',
    userType: 'client',
    isDefault: true,
  });
}

async function ensureAdminRole(db: NodePgDatabase): Promise<string> {
  const [existingAdmin] = await db
    .select({ roleId: rolePermissions.roleId })
    .from(rolePermissions)
    .where(eq(rolePermissions.permission, '*'))
    .limit(1);

  if (existingAdmin) return existingAdmin.roleId;

  const [adminRole] = await db
    .insert(roles)
    .values({ name: 'Admin', userType: 'client', isDefault: false })
    .returning({ id: roles.id });

  await db
    .insert(rolePermissions)
    .values({ roleId: adminRole.id, permission: '*' });

  return adminRole.id;
}

async function ensureAdminUser(
  db: NodePgDatabase,
  adminRoleId: string,
  adminEmail: string,
  adminPassword: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (existing) return;

  const [newUser] = await db
    .insert(users)
    .values({
      email: adminEmail,
      firstName: 'Admin',
      lastName: 'User',
      userType: 'client',
    })
    .returning({ id: users.id });

  const secretHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
  await db.insert(credentials).values({
    userId: newUser.id,
    provider: 'password',
    identifier: adminEmail,
    secretHash,
  });

  await db.insert(userRoles).values({
    userId: newUser.id,
    roleId: adminRoleId,
  });
}
