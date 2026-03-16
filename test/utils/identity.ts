import type { DrizzleDB } from '@packages/database';
import { users } from '@packages/database';
import { AuthService } from '@packages/auth';
import { RbacService, type ScopedPermissions } from '@packages/rbac';
import type { TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';

export interface TestIdentity {
  userId: string;
  userType: string;
  permissions: ScopedPermissions;
  accessToken: string;
}

/**
 * Creates a test user with credentials, user type, role, and permissions.
 * Returns a JWT access token ready for use in Authorization headers.
 */
export async function createTestIdentity(
  module: TestingModule,
  db: DrizzleDB,
  options: {
    userType: string;
    permissions: string[];
    email?: string;
    firstName?: string;
    lastName?: string;
  },
): Promise<TestIdentity> {
  const authService = module.get(AuthService);
  const rbacService = module.get(RbacService);

  const email = options.email ?? `test-${randomUUID()}@example.com`;
  const firstName = options.firstName ?? 'Test';
  const lastName = options.lastName ?? 'User';

  // Create user with userType directly on the row
  const [user] = await db
    .insert(users)
    .values({ email, firstName, lastName, userType: options.userType })
    .returning();

  // Create password credential
  await authService.createPasswordCredential(user.id, email, 'TestPassword1!');

  // Create role with permissions
  const role = await rbacService.createRole({
    name: `test-role-${randomUUID()}`,
    userType: options.userType,
  });

  if (options.permissions.length > 0) {
    await rbacService.setRolePermissions(role.id, options.permissions);
    await rbacService.assignRoleToUser(user.id, role.id);
  }

  // Convert permission names to scoped format (default scope 'all' for test identities)
  const scopedPermissions: ScopedPermissions = {};
  for (const p of options.permissions) {
    scopedPermissions[p] = 'all';
  }

  // Generate access token
  const accessToken = authService.generateAccessToken({
    userId: user.id,
    userType: options.userType,
    permissions: scopedPermissions,
  });

  return {
    userId: user.id,
    userType: options.userType,
    permissions: scopedPermissions,
    accessToken,
  };
}
