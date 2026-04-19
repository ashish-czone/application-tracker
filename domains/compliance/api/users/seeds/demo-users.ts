import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, eq, users } from '@packages/database';
import { AuthService } from '@packages/auth';
import { RbacService } from '@packages/rbac';

interface DemoUser {
  firstName: string;
  lastName: string;
  email: string;
}

const DEMO_USERS: DemoUser[] = [
  { firstName: 'Priya',  lastName: 'Sharma',    email: 'priya.sharma@compliance.example.com' },
  { firstName: 'Rahul',  lastName: 'Verma',     email: 'rahul.verma@compliance.example.com' },
  { firstName: 'Anjali', lastName: 'Iyer',      email: 'anjali.iyer@compliance.example.com' },
  { firstName: 'Vikram', lastName: 'Patel',     email: 'vikram.patel@compliance.example.com' },
];

export const DEMO_USER_EMAILS = DEMO_USERS.map((u) => u.email.toLowerCase());

export const seedDemoUsers = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const authService = ctx.get(AuthService);
  const rbacService = ctx.get(RbacService);

  const [existing] = await database.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_USERS[0].email.toLowerCase()))
    .limit(1);
  if (existing) return;

  const defaultRole = await rbacService.findDefaultRoleForUserType('client');
  if (!defaultRole) return;

  for (const u of DEMO_USERS) {
    const email = u.email.toLowerCase();
    const [user] = await database.db
      .insert(users)
      .values({
        email,
        firstName: u.firstName,
        lastName: u.lastName,
        userType: 'client',
      })
      .returning();

    await authService.createPasswordCredential(user.id, email, 'Password123');
    await rbacService.assignRoleToUser(user.id, defaultRole.id);
  }
};
