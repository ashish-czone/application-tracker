import { Module, type DynamicModule } from '@nestjs/common';
import {
  LOGGER_MODULE_CONFIG,
  LOGGER_PROVIDER,
  type LoggerModuleConfig,
  type LoggerModuleAsyncOptions,
} from './types';
import { NestjsLoggerProvider } from './providers/nestjs.provider';
import { AppLoggerService } from './services/logger.service';

function createProviderFactory(config: LoggerModuleConfig) {
  switch (config.provider ?? 'nestjs') {
    case 'nestjs':
    default:
      return new NestjsLoggerProvider();
  }
}

@Module({})
export class LoggerModule {
  static register(config: LoggerModuleConfig = {}): DynamicModule {
    return {
      module: LoggerModule,
      global: true,
      providers: [
        { provide: LOGGER_MODULE_CONFIG, useValue: config },
        {
          provide: LOGGER_PROVIDER,
          useFactory: () => createProviderFactory(config),
        },
        AppLoggerService,
      ],
      exports: [AppLoggerService, LOGGER_PROVIDER],
    };
  }

  static registerAsync(options: LoggerModuleAsyncOptions): DynamicModule {
    return {
      module: LoggerModule,
      global: true,
      providers: [
        {
          provide: LOGGER_MODULE_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        {
          provide: LOGGER_PROVIDER,
          useFactory: (config: LoggerModuleConfig) => createProviderFactory(config),
          inject: [LOGGER_MODULE_CONFIG],
        },
        AppLoggerService,
      ],
      exports: [AppLoggerService, LOGGER_PROVIDER],
    };
  }
}
