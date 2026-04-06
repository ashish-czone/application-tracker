import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigurableThrottlerGuard } from './guards/configurable-throttler.guard';
import path from 'path';
import { LoggerModule } from '@packages/logger';
import { DatabaseModule } from '@packages/database';
import { EventsModule } from '@packages/events';
import { SettingsModule } from '@packages/settings';
import { QueueModule } from '@packages/queue';
import { AutomationsModule } from '@packages/automations';
import { NotificationsModule } from '@packages/notifications';
import { NotificationChannelsModule } from '@packages/notification-channels';
import { WorkflowsModule } from '@packages/workflows';
import { AuditModule } from '@packages/audit';
import { TaxonomyModule } from '@packages/taxonomy';
import { HierarchyModule } from '@packages/hierarchy';
import { EavAttributesModule } from '@packages/eav-attributes';
import { EntityEngineModule } from '@packages/entity-engine';
import { AuthModule, AuthGuard } from '@packages/auth';
import { OAuthModule } from '@packages/oauth';
import { RbacGuard } from '@packages/rbac';
import { AppConfigService } from '@packages/settings';
import { UsersModule } from '@packages/users';
import { ServiceAuthModule } from '@packages/service-auth';
import { OrdersBillingModule, ORDERS_CONFIG } from '@packages/orders-billing';
import { OrdersSubscriptionsModule, SUBSCRIPTION_PLANS_CONFIG, SUBSCRIPTIONS_CONFIG } from '@packages/orders-subscriptions';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ClientsModule } from './modules/clients/clients.module';
import { CLIENTS_CONFIG } from './modules/clients/clients.config';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: path.resolve(__dirname, '../.env'),
    }),
    LoggerModule.register({ provider: 'pino' }),
    DatabaseModule,
    EventsModule,
    SettingsModule,
    QueueModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        redisUrl: config.get<string>('REDIS_URL')!,
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    // Transitive dependencies required by UsersModule
    AutomationsModule,
    NotificationChannelsModule,
    NotificationsModule,
    AuditModule,
    WorkflowsModule,
    TaxonomyModule,
    HierarchyModule,
    EavAttributesModule,
    EntityEngineModule,
    // Auth + Users
    AuthModule.registerAsync({
      useFactory: (config: ConfigService, appConfig: AppConfigService) => ({
        jwtSecret: config.get<string>('JWT_SECRET')!,
        accessTokenExpiresIn: appConfig.get('auth', 'accessTokenExpiresIn', '15m'),
        refreshTokenExpiresIn: appConfig.get('auth', 'refreshTokenExpiresIn', '7d'),
        resetTokenExpiresIn: appConfig.get('auth', 'resetTokenExpiresIn', '1h'),
      }),
      inject: [ConfigService, AppConfigService],
    }),
    OAuthModule.register(),
    UsersModule,
    // Service-to-service auth for verifying incoming calls from tenant apps
    ServiceAuthModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        serviceId: 'control-plane',
        privateKey: config.get<string>('SERVICE_PRIVATE_KEY')!,
        trustedServices: JSON.parse(config.get<string>('TRUSTED_SERVICE_KEYS') || '{}'),
      }),
      inject: [ConfigService],
    }),
    // Billing + Subscriptions
    OrdersBillingModule,
    OrdersSubscriptionsModule,
    EntityEngineModule.forEntity(CLIENTS_CONFIG),
    EntityEngineModule.forEntity(ORDERS_CONFIG),
    EntityEngineModule.forEntity(SUBSCRIPTION_PLANS_CONFIG),
    EntityEngineModule.forEntity(SUBSCRIPTIONS_CONFIG),
    ClientsModule,
    // Tenant management
    TenantsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
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
      useClass: ConfigurableThrottlerGuard,
    },
  ],
})
export class AppModule {}
