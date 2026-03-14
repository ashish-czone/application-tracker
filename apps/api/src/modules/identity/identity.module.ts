import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { AuthNestjsModule } from '@packages/auth-nestjs';
import { RbacNestjsModule, RbacService } from '@packages/rbac-nestjs';
import { PrismaService } from '@packages/database';
import { RolesController } from './rbac/controllers/roles.controller';
import { PermissionsController } from './rbac/controllers/permissions.controller';

@Module({
  imports: [
    RbacNestjsModule.registerAsync({
      useFactory: (prisma: PrismaService) => ({
        entityName: 'identity',
        getRoleDelegate: () => prisma.role,
        getPermissionDelegate: () => prisma.permission,
        getRolePermissionDelegate: () => prisma.rolePermission,
        getIdentityRoleDelegate: () => prisma.identityRole,
      }),
      inject: [PrismaService],
    }),
    AuthNestjsModule.registerAsync({
      useFactory: (prisma: PrismaService, rbacService: RbacService) => ({
        entityName: 'identity',
        routePrefix: 'auth',
        accessTokenExpiresIn: '15m',
        refreshTokenExpiresIn: '7d',
        jwtSecret: process.env.JWT_SECRET!,
        getIdentityDelegate: () => prisma.identity,
        getPasswordTokenDelegate: () => prisma.passwordToken,
        enrichIdentityProfile: async (identity) => ({
          permissions: await rbacService.getIdentityPermissions(identity.id),
        }),
        onIdentityCreated: async (identity) => {
          await rbacService.bootstrapSuperadmin(identity.id);
        },
      }),
      inject: [PrismaService, RbacService],
    }),
    RouterModule.register([
      {
        path: 'auth',
        module: AuthNestjsModule,
      },
    ]),
  ],
  controllers: [RolesController, PermissionsController],
})
export class IdentityModule {}
