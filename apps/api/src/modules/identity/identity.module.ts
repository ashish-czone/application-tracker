import { Module, type OnModuleInit } from '@nestjs/common';
import { AuthNestjsModule } from '@packages/auth-nestjs';
import { RbacNestjsModule, RbacService, PermissionRegistryService } from '@packages/rbac-nestjs';
import { DatabaseService } from '@packages/database';
import { SettingsRegistryService, SettingsService } from '@packages/settings-nestjs';
import { z } from 'zod';
import { RolesController } from './rbac/controllers/roles.controller';
import { PermissionsController } from './rbac/controllers/permissions.controller';
import {
  createRoleDelegate,
  createPermissionDelegate,
  createRolePermissionDelegate,
  createIdentityRoleDelegate,
} from './rbac-delegates';

const identitySettingsSchema = z.object({
  accessTokenExpiresIn: z.string().default('15m'),
  refreshTokenExpiresIn: z.string().default('7d'),
  passwordTokenExpiryMinutes: z.number().min(5).max(1440).default(60),
});

@Module({
  imports: [
    RbacNestjsModule.registerAsync({
      useFactory: (database: DatabaseService) => ({
        entityName: 'identity',
        getRoleDelegate: () => createRoleDelegate(database.db),
        getPermissionDelegate: () => createPermissionDelegate(database.db),
        getRolePermissionDelegate: () => createRolePermissionDelegate(database.db),
        getIdentityRoleDelegate: () => createIdentityRoleDelegate(database.db),
      }),
      inject: [DatabaseService],
    }),
    AuthNestjsModule.forEntity({
      basePath: 'users/auth',
      useFactory: async (
        rbacService: RbacService,
        settingsService: SettingsService,
      ) => ({
        entityName: 'identity',
        accessTokenExpiresIn: await settingsService.get('identity', 'accessTokenExpiresIn', '15m'),
        refreshTokenExpiresIn: await settingsService.get('identity', 'refreshTokenExpiresIn', '7d'),
        jwtSecret: process.env.JWT_SECRET!,
        enrichIdentityProfile: async (identity) => ({
          permissions: await rbacService.getIdentityPermissions(identity.id),
        }),
        onIdentityCreated: async (identity) => {
          await rbacService.bootstrapSuperadmin(identity.id);
        },
      }),
      inject: [RbacService, SettingsService],
    }),
  ],
  controllers: [RolesController, PermissionsController],
})
export class IdentityModule implements OnModuleInit {
  constructor(
    private readonly permissionRegistry: PermissionRegistryService,
    private readonly settingsRegistry: SettingsRegistryService,
  ) {}

  onModuleInit() {
    this.permissionRegistry.register('rbac.roles', [
      { action: 'manage', description: 'Manage roles and role assignments' },
    ]);

    this.permissionRegistry.register('rbac.permissions', [
      { action: 'read', description: 'View permissions and permission registry' },
    ]);

    this.settingsRegistry.register({
      module: 'identity',
      label: 'Identity & Authentication',
      schema: identitySettingsSchema,
      metadata: {
        accessTokenExpiresIn: {
          label: 'Access Token Expiry',
          description: 'How long access tokens are valid (e.g. "15m", "1h")',
          type: 'duration',
          restartRequired: true,
        },
        refreshTokenExpiresIn: {
          label: 'Refresh Token Expiry',
          description: 'How long refresh tokens are valid (e.g. "7d", "30d")',
          type: 'duration',
          restartRequired: true,
        },
        passwordTokenExpiryMinutes: {
          label: 'Password Reset Token Expiry (minutes)',
          description: 'How many minutes a password reset link stays valid',
          type: 'number',
          min: 5,
          max: 1440,
        },
      },
    });
  }
}
