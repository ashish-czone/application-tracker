import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService, eq, users } from '@packages/database';
import { RbacService, rolePermissions } from '@packages/rbac';
import { AuthService } from '../services/auth.service';
import { AUTH_MODULE_CONFIG, type AuthModuleConfig } from '../types';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    private readonly authService: AuthService,
    private readonly rbacService: RbacService,
    @Inject(AUTH_MODULE_CONFIG) private readonly config: AuthModuleConfig,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(SeedService.name);
  }

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
    const adminEmail = this.config.defaultAdminEmail ?? 'admin@admin.com';
    const adminPassword = this.config.defaultAdminPassword ?? 'Admin1234';

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
        name: 'Admin',
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
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (existingUser) return;

    // Create admin user
    const [user] = await this.database.db
      .insert(users)
      .values({
        email: adminEmail,
        firstName: 'Admin',
        lastName: 'User',
        userType: 'client',
      })
      .returning();

    // Create password credential
    await this.authService.createPasswordCredential(user.id, adminEmail, adminPassword);

    // Assign admin role
    await this.rbacService.assignRoleToUser(user.id, roleId);

    this.logger.log(`Admin user created: ${adminEmail} / ${adminPassword}`);
  }
}
