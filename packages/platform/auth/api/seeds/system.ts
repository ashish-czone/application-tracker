import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, eq, users } from '@packages/database';
import { RbacService, rolePermissions } from '@packages/rbac';
import { AuthService } from '../services/auth.service';
import { AUTH_MODULE_CONFIG, type AuthModuleConfig } from '../types';

export const seedSystem = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const rbac = ctx.get(RbacService);
  const auth = ctx.get(AuthService);
  const config = ctx.get<AuthModuleConfig>(AUTH_MODULE_CONFIG);

  const adminEmail = config.defaultAdminEmail ?? 'admin@admin.com';
  const adminPassword = config.defaultAdminPassword ?? 'Admin1234';

  await ensureDefaultClientRole(rbac);
  const adminRoleId = await ensureAdminRole(database, rbac);
  await ensureAdminUser(database, auth, rbac, adminRoleId, adminEmail, adminPassword);
};

async function ensureDefaultClientRole(rbac: RbacService): Promise<void> {
  const existing = await rbac.findDefaultRoleForUserType('client');
  if (existing) return;
  await rbac.createRole({ name: 'Client', userType: 'client', isDefault: true });
}

async function ensureAdminRole(
  database: DatabaseService,
  rbac: RbacService,
): Promise<string> {
  const [existing] = await database.db
    .select({ roleId: rolePermissions.roleId })
    .from(rolePermissions)
    .where(eq(rolePermissions.permission, '*'))
    .limit(1);

  if (existing) return existing.roleId;

  const role = await rbac.createRole({ name: 'Admin', userType: 'client' });
  await rbac.setRolePermissions(role.id, [{ name: '*' }]);
  return role.id;
}

async function ensureAdminUser(
  database: DatabaseService,
  auth: AuthService,
  rbac: RbacService,
  adminRoleId: string,
  adminEmail: string,
  adminPassword: string,
): Promise<void> {
  const existing = await auth.findUserByEmail(adminEmail);
  if (existing) return;

  // Bootstrap user: no actor exists yet, so the event-emitting UsersService.create
  // path is unavailable. Insert directly so the audit listener has nothing to attribute.
  // Role assignment + credential still go through the service layer.
  const [user] = await database.db
    .insert(users)
    .values({
      email: adminEmail.toLowerCase(),
      firstName: 'Admin',
      lastName: 'User',
      userType: 'client',
    })
    .returning();

  await auth.createPasswordCredential(user.id, adminEmail.toLowerCase(), adminPassword);
  await rbac.assignRoleToUser(user.id, adminRoleId);
};
