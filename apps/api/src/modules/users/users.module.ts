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
        entityName: 'user',
        getRoleDelegate: () => prisma.role,
        getPermissionDelegate: () => prisma.permission,
        getRolePermissionDelegate: () => prisma.rolePermission,
        getUserRoleDelegate: () => prisma.userRole,
      }),
      inject: [PrismaService],
    }),
    AuthNestjsModule.registerAsync({
      useFactory: (prisma: PrismaService, rbacService: RbacService) => ({
        entityName: 'user',
        routePrefix: 'auth',
        accessTokenExpiresIn: '15m',
        refreshTokenExpiresIn: '7d',
        jwtSecret: process.env.JWT_SECRET!,
        getUserDelegate: () => prisma.user,
        getPasswordTokenDelegate: () => prisma.passwordToken,
        enrichUserProfile: async (user) => ({
          permissions: await rbacService.getUserPermissions(user.id),
        }),
        onUserCreated: async (user) => {
          await rbacService.bootstrapSuperadmin(user.id);
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
export class UsersModule {}
