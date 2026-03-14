import {
  DynamicModule,
  Module,
  Global,
  type InjectionToken,
  type OptionalFactoryDependency,
} from '@nestjs/common';
import type { SettingsModuleConfig } from './types';
import { SETTINGS_MODULE_CONFIG } from './constants';
import { SettingsRegistryService } from './services/settings-registry.service';
import { SettingsService } from './services/settings.service';

interface SettingsNestjsModuleAsyncOptions {
  imports?: DynamicModule['imports'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory: (...args: any[]) => SettingsModuleConfig | Promise<SettingsModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Global()
@Module({})
export class SettingsNestjsModule {
  static registerAsync(options: SettingsNestjsModuleAsyncOptions): DynamicModule {
    return {
      module: SettingsNestjsModule,
      imports: [...(options.imports ?? [])],
      providers: [
        {
          provide: SETTINGS_MODULE_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        SettingsRegistryService,
        SettingsService,
      ],
      exports: [SettingsRegistryService, SettingsService, SETTINGS_MODULE_CONFIG],
    };
  }
}
