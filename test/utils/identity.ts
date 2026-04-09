import type { DrizzleDB } from '@packages/database';
import { users } from '@packages/database';
import { AuthService } from '@packages/auth';
import { RbacService, type BooleanPermissions } from '@packages/rbac';
import type { TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';

export interface TestIdentity {
  userId: string;
  userType: string;
  permissions: BooleanPermissions;
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

  // Build boolean permissions map
  const booleanPermissions: BooleanPermissions = {};
  for (const p of options.permissions) {
    booleanPermissions[p] = true;
  }

  // Generate access token
  const accessToken = authService.generateAccessToken({
    userId: user.id,
    userType: options.userType,
    permissions: booleanPermissions,
  });

  return {
    userId: user.id,
    userType: options.userType,
    permissions: booleanPermissions,
    accessToken,
  };
}
