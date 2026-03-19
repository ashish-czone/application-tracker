import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DatabaseService, eq, users } from '@packages/database';
import { AuthService } from '@packages/auth';
import { RbacService, rolePermissions } from '@packages/rbac';

const ADMIN_ROLE_NAME = 'Admin';
const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PASSWORD = 'Admin1234';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly authService: AuthService,
    private readonly rbacService: RbacService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultClientRole();
    await this.ensureAdminRole();
  }

  private async ensureDefaultClientRole() {
    const existing = await this.rbacService.findDefaultRoleForUserType('client');
    if (existing) return;

    await this.rbacService.createRole({
      name: 'Client',
      userType: 'client',
      isDefault: true,
    });
    this.logger.log('Default "Client" role created');
  }

  private async ensureAdminRole() {
    // Check if any role has the wildcard '*' permission (admin role)
    const [existingAdminPerm] = await this.database.db
      .select({ roleId: rolePermissions.roleId })
      .from(rolePermissions)
      .where(eq(rolePermissions.permission, '*'))
      .limit(1);

    let roleId: string;

    if (existingAdminPerm) {
      roleId = existingAdminPerm.roleId;
    } else {
      const role = await this.rbacService.createRole({
        name: ADMIN_ROLE_NAME,
        userType: 'client',
      });
      roleId = role.id;

      // Grant wildcard permission — this is what makes the role an admin
      await this.rbacService.setRolePermissions(roleId, [{ name: '*', scope: 'all' }]);
      this.logger.log('Admin role created with wildcard (*) permission');
    }

    // Check if admin user exists
    const [existingUser] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, ADMIN_EMAIL))
      .limit(1);

    if (existingUser) return;

    // Create admin user
    const [user] = await this.database.db
      .insert(users)
      .values({
        email: ADMIN_EMAIL,
        firstName: 'Admin',
        lastName: 'User',
        userType: 'client',
      })
      .returning();

    // Create password credential
    await this.authService.createPasswordCredential(user.id, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Assign admin role
    await this.rbacService.assignRoleToUser(user.id, roleId);

    this.logger.log(`Admin user created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  }
}
