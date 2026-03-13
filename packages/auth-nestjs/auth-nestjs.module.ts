import { DynamicModule, Module, type InjectionToken, type OptionalFactoryDependency } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import type { AuthModuleConfig } from '@packages/auth';
import { AUTH_MODULE_CONFIG, AUTH_CONFIGS_MAP } from './constants';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';

interface AuthNestjsModuleAsyncOptions {
  imports?: DynamicModule['imports'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory: (...args: any[]) => AuthModuleConfig | Promise<AuthModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class AuthNestjsModule {
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
