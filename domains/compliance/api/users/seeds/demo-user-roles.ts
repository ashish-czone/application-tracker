import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, and, eq, isNull, users } from '@packages/database';
import { RbacService, roles } from '@packages/rbac';

/**
 * Demo seed that assigns each of the four compliance demo users to one of
 * the four compliance roles, painting a realistic small-firm picture:
 *
 *   Priya Sharma   → Team Lead   (runs a team, full task lifecycle, catalogue writes)
 *   Rahul Verma    → Reviewer    (senior preparer, has tasks.review)
 *   Anjali Iyer    → Preparer    (rank-and-file worker)
 *   Vikram Patel   → Firm Admin  (practice owner, holds deletes + law-handler config)
 *
 * Additive: leaves the default 'Client' role assignment put in place by
 * @domains/compliance-api/demo-users alone. Each user ends up with two roles
 * — the default client role and their compliance role. Re-running is a
 * no-op because assignRoleToUser uses onConflictDoNothing.
 *
 * Depends on:
 *   - @domains/compliance-api/demo-users  (users must exist)
 *   - @domains/compliance-api/system-roles (roles must exist)
 * Register accordingly in complianceDemoSeedSources().
 */

interface RoleAssignment {
  email: string;
  roleName: string;
}

const ASSIGNMENTS: RoleAssignment[] = [
  { email: 'priya.sharma@compliance.example.com',  roleName: 'Team Lead'  },
  { email: 'rahul.verma@compliance.example.com',   roleName: 'Reviewer'   },
  { email: 'anjali.iyer@compliance.example.com',   roleName: 'Preparer'   },
  { email: 'vikram.patel@compliance.example.com',  roleName: 'Firm Admin' },
];

export const seedDemoUserRoles = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const rbac = ctx.get(RbacService);

  for (const { email, roleName } of ASSIGNMENTS) {
    const [user] = await database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    if (!user) continue;

    const [role] = await database.db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.name, roleName), isNull(roles.userType)))
      .limit(1);
    if (!role) continue;

    await rbac.assignRoleToUser(user.id, role.id);
  }
};
