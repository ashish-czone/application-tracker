import { Module, type OnModuleInit } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import path from 'path';
import { DatabaseModule, DatabaseService, settings, eq, and } from '@packages/database';
import { EventsModule } from '@packages/events';
import { AuthGuard } from '@packages/auth-nestjs';
import { RbacGuard } from '@packages/rbac-nestjs';
import { SettingsNestjsModule, SettingsService, SettingsRegistryService } from '@packages/settings-nestjs';
import type { SettingDelegate } from '@packages/settings-nestjs';
import type { DrizzleDB } from '@packages/database';
import { SettingsModule } from './modules/settings/settings.module';
import { IdentityModule } from './modules/identity/identity.module';
import { UsersModule } from './modules/users/users.module';
import { validate } from './config/env.validation';

function createSettingDelegate(db: DrizzleDB): SettingDelegate {
  return {
    async findByModule(module) {
      return db.select().from(settings).where(eq(settings.module, module));
    },
    async upsert(data) {
      const [existing] = await db
        .select()
        .from(settings)
        .where(and(eq(settings.module, data.module), eq(settings.key, data.key)))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(settings)
          .set({ value: data.value, updatedBy: data.updatedBy })
          .where(eq(settings.id, existing.id))
          .returning();
        return updated;
      }

      const [created] = await db.insert(settings).values(data).returning();
      return created;
    },
    async deleteByModuleAndKey(module, key) {
      await db
        .delete(settings)
        .where(and(eq(settings.module, module), eq(settings.key, key)));
    },
  };
}

const throttlerSettingsSchema = z.object({
  rateLimitTtl: z.number().min(1000).max(600000).default(60000),
  rateLimitRequests: z.number().min(1).max(10000).default(100),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: path.resolve(__dirname, '../.env'),
    }),
    DatabaseModule,
    EventsModule,
    SettingsNestjsModule.registerAsync({
      useFactory: (database: DatabaseService) => ({
        getSettingDelegate: () => createSettingDelegate(database.db),
      }),
      inject: [DatabaseService],
    }),
    ThrottlerModule.forRootAsync({
      useFactory: async (settingsService: SettingsService) => ([{
        ttl: await settingsService.get('throttler', 'rateLimitTtl', 60000),
        limit: await settingsService.get('throttler', 'rateLimitRequests', 100),
      }]),
      inject: [SettingsService],
    }),
    IdentityModule,
    UsersModule,
    SettingsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RbacGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly settingsRegistry: SettingsRegistryService) {}

  onModuleInit() {
    this.settingsRegistry.register({
      module: 'throttler',
      label: 'Rate Limiting',
      schema: throttlerSettingsSchema,
      metadata: {
        rateLimitTtl: {
          label: 'Rate Limit Window (ms)',
          description: 'Time window in milliseconds for rate limiting',
          type: 'number',
          min: 1000,
          max: 600000,
          restartRequired: true,
        },
        rateLimitRequests: {
          label: 'Max Requests per Window',
          description: 'Maximum number of requests allowed per time window',
          type: 'number',
          min: 1,
          max: 10000,
          restartRequired: true,
        },
      },
    });
  }
}
