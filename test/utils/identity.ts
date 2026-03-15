import type { DrizzleDB } from '@packages/database';
import { users, userUserTypes } from '@packages/database';
import { AuthService } from '@packages/auth';
import { RbacService } from '@packages/rbac';
import type { TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';

export interface TestIdentity {
  userId: string;
  userType: string;
  permissions: string[];
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

  // Create user
  const [user] = await db
    .insert(users)
    .values({ email, firstName, lastName })
    .returning();

  // Create password credential
  await authService.createPasswordCredential(user.id, email, 'TestPassword1!');

  // Assign user type
  await rbacService.assignUserType(user.id, options.userType);

  // Create role with permissions
  const role = await rbacService.createRole({
    name: `test-role-${randomUUID()}`,
    userType: options.userType,
  });

  if (options.permissions.length > 0) {
    await rbacService.setRolePermissions(role.id, options.permissions);
    await rbacService.assignRoleToUser(user.id, role.id);
  }

  // Generate access token
  const accessToken = authService.generateAccessToken({
    userId: user.id,
    userType: options.userType,
    permissions: options.permissions,
  });

  return {
    userId: user.id,
    userType: options.userType,
    permissions: options.permissions,
    accessToken,
  };
}
