import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DatabaseService, eq, and, users } from '@packages/database';
import { AuthService } from '@packages/auth';
import { RbacService, roles } from '@packages/rbac';

const SUPERADMIN_EMAIL = 'admin@admin.com';
const SUPERADMIN_PASSWORD = 'Admin1234';

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
    await this.ensureSuperadmin();
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

  private async ensureSuperadmin() {
    // Check if superadmin role exists
    const [existingRole] = await this.database.db
      .select()
      .from(roles)
      .where(eq(roles.isSuperadmin, true))
      .limit(1);

    let roleId: string;

    if (existingRole) {
      roleId = existingRole.id;
    } else {
      const role = await this.rbacService.createRole({
        name: 'Super Admin',
        userType: 'admin',
        isDefault: true,
        isSuperadmin: true,
      });
      roleId = role.id;
      this.logger.log('Super Admin role created');
    }

    // Check if superadmin user exists
    const [existingUser] = await this.database.db
      .select()
      .from(users)
      .where(and(eq(users.email, SUPERADMIN_EMAIL), eq(users.userType, 'admin')))
      .limit(1);

    if (existingUser) return;

    // Create superadmin user
    const [user] = await this.database.db
      .insert(users)
      .values({
        email: SUPERADMIN_EMAIL,
        firstName: 'Super',
        lastName: 'Admin',
        userType: 'admin',
      })
      .returning();

    // Create password credential
    await this.authService.createPasswordCredential(user.id, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);

    // Assign superadmin role
    await this.rbacService.assignRoleToUser(user.id, roleId);

    this.logger.log(`Superadmin user created: ${SUPERADMIN_EMAIL} / ${SUPERADMIN_PASSWORD}`);
  }
}
