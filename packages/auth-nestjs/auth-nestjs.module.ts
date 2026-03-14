import { DynamicModule, Global, Module, type InjectionToken, type OptionalFactoryDependency } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import type { AuthModuleConfig, AuthRouteConfig } from '@packages/auth';
import { AUTH_MODULE_CONFIG, AUTH_CONFIGS_MAP } from './constants';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';

interface AuthNestjsModuleAsyncOptions {
  imports?: DynamicModule['imports'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory: (...args: any[]) => AuthModuleConfig | Promise<AuthModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

/** Options for forEntity — the recommended way to mount entity-scoped auth routes. */
interface ForEntityOptions {
  /** Route prefix where auth routes are mounted (e.g., 'users/auth' → /api/v1/users/auth/login) */
  basePath: string;
  /** Configure which built-in routes are enabled. All enabled by default. */
  routes?: AuthRouteConfig;
  imports?: DynamicModule['imports'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory: (...args: any[]) => Omit<AuthModuleConfig, 'routePrefix' | 'routes'> | Promise<Omit<AuthModuleConfig, 'routePrefix' | 'routes'>>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Global()
@Module({})
export class AuthNestjsModule {
  /**
   * Mount entity-scoped auth routes with a single call.
   *
   * Automatically handles RouterModule mounting and route configuration.
   * Each entity type (users, clients, etc.) calls this once to get
   * login, me, refresh, logout, forgot-password, reset-password routes
   * scoped under its own basePath.
   *
   * @example
   * AuthNestjsModule.forEntity({
   *   basePath: 'users/auth',
   *   routes: { register: false },
   *   useFactory: (prisma, rbacService) => ({
   *     entityName: 'user',
   *     jwtSecret: process.env.JWT_SECRET!,
   *     accessTokenExpiresIn: '15m',
   *     refreshTokenExpiresIn: '7d',
   *     getIdentityDelegate: () => prisma.identity,
   *     getPasswordTokenDelegate: () => prisma.passwordToken,
   *     enrichIdentityProfile: async (identity) => ({
   *       permissions: await rbacService.getIdentityPermissions(identity.id),
   *     }),
   *   }),
   *   inject: [PrismaService, RbacService],
   * })
   */
  static forEntity(options: ForEntityOptions): DynamicModule {
    const { basePath, routes } = options;

    const authModule: DynamicModule = {
      module: AuthNestjsModule,
      imports: [...(options.imports ?? [])],
      providers: [
        {
          provide: AUTH_MODULE_CONFIG,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          useFactory: async (...args: any[]) => {
            const partialConfig = await options.useFactory(...args);
            const config: AuthModuleConfig = {
              ...partialConfig,
              routePrefix: basePath,
              routes,
            };
            AUTH_CONFIGS_MAP.set(config.entityName, config);
            return config;
          },
          inject: options.inject ?? [],
        },
        AuthService,
      ],
      controllers: [AuthController],
      exports: [AuthService],
    };

    return {
      module: AuthNestjsModule,
      imports: [
        authModule,
        RouterModule.register([
          {
            path: basePath,
            module: AuthNestjsModule,
          },
        ]),
      ],
    };
  }

  static register(config: AuthModuleConfig): DynamicModule {
    AUTH_CONFIGS_MAP.set(config.entityName, config);

    const authModule: DynamicModule = {
      module: AuthNestjsModule,
      providers: [
        {
          provide: AUTH_MODULE_CONFIG,
          useValue: config,
        },
        AuthService,
      ],
      controllers: [AuthController],
      exports: [AuthService],
    };

    return {
      module: AuthNestjsModule,
      imports: [
        authModule,
        RouterModule.register([
          {
            path: config.routePrefix,
            module: AuthNestjsModule,
          },
        ]),
      ],
    };
  }

  static registerAsync(options: AuthNestjsModuleAsyncOptions): DynamicModule {
    return {
      module: AuthNestjsModule,
      imports: [...(options.imports ?? [])],
      providers: [
        {
          provide: AUTH_MODULE_CONFIG,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          useFactory: async (...args: any[]) => {
            const config = await options.useFactory(...args);
            AUTH_CONFIGS_MAP.set(config.entityName, config);
            return config;
          },
          inject: options.inject ?? [],
        },
        AuthService,
      ],
      controllers: [AuthController],
      exports: [AuthService],
    };
  }
}
