import { Global, Module, type DynamicModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DebugProfilerInterceptor } from './debug-profiler.interceptor';
import { ProfilingContextStore } from './profiling-context';
import type { DebugProfilerOptions } from './types';

@Global()
@Module({})
export class DebugProfilerModule {
  static forRoot(options: DebugProfilerOptions): DynamicModule {
    if (!options.enabled) {
      return { module: DebugProfilerModule, providers: [], exports: [] };
    }

    return {
      module: DebugProfilerModule,
      providers: [
        ProfilingContextStore,
        {
          provide: APP_INTERCEPTOR,
          useClass: DebugProfilerInterceptor,
        },
      ],
      exports: [ProfilingContextStore],
    };
  }
}
