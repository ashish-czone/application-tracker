import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { AuthNestjsModule } from '@packages/auth-nestjs';
import { PrismaService } from '@packages/database';

@Module({
  imports: [
    AuthNestjsModule.registerAsync({
      useFactory: (prisma: PrismaService) => ({
        entityName: 'user',
        routePrefix: 'auth',
        accessTokenExpiresIn: '15m',
        refreshTokenExpiresIn: '7d',
        jwtSecret: process.env.JWT_SECRET!,
        getUserDelegate: () => prisma.user,
        getPasswordTokenDelegate: () => prisma.passwordToken,
      }),
      inject: [PrismaService],
    }),
    RouterModule.register([
      {
        path: 'auth',
        module: AuthNestjsModule,
      },
    ]),
  ],
})
export class UsersModule {}
