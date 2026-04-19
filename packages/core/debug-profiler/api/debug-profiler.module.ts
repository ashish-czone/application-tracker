import { Global, Module, type DynamicModule, type FactoryProvider, type InjectionToken } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DebugProfilerInterceptor } from './debug-profiler.interceptor';
import { ProfilingContextStore } from './profiling-context';
import type { DebugProfilerOptions } from './types';

export const DEBUG_PROFILER_OPTIONS: InjectionToken = Symbol.for('DEBUG_PROFILER_OPTIONS');

export interface DebugProfilerAsyncOptions {
  useFactory: (...args: never[]) => DebugProfilerOptions | Promise<DebugProfilerOptions>;
  inject?: FactoryProvider['inject'];
}

@Global()
@Module({})
export class DebugProfilerModule {
  static forRootAsync(asyncOptions: DebugProfilerAsyncOptions): DynamicModule {
    return {
      module: DebugProfilerModule,
      providers: [
        {
          provide: DEBUG_PROFILER_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: asyncOptions.inject ?? [],
        },
        ProfilingContextStore,
        {
          provide: APP_INTERCEPTOR,
          useClass: DebugProfilerInterceptor,
        },
      ],
      exports: [ProfilingContextStore, DEBUG_PROFILER_OPTIONS],
    };
  }
}
