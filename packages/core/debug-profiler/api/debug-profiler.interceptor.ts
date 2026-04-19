import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { map, tap } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { catchError, Observable } from 'rxjs';
import { ProfilingContextStore } from './profiling-context';
import type { RequestProfile } from './types';

interface HttpRequestLike {
  method?: string;
  url?: string;
  originalUrl?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
}

interface HttpResponseLike {
  statusCode?: number;
  setHeader?: (name: string, value: string) => void;
}

function buildHeader(profile: RequestProfile, totalQueryMs: number): string {
  return `durationMs=${profile.durationMs.toFixed(1)};queryCount=${profile.queries.length};totalQueryMs=${totalQueryMs.toFixed(1)}`;
}

function hasDebugFlag(req: HttpRequestLike): boolean {
  const query = req.query;
  if (!query) return false;
  const v = query['debug'];
  return v === '1' || v === 'true';
}

@Injectable()
export class DebugProfilerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('DebugProfiler');

  constructor(private readonly store: ProfilingContextStore) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<HttpRequestLike>();
    const res = http.getResponse<HttpResponseLike>();

    const requestId =
      (req.headers?.['x-correlation-id'] as string | undefined) ??
      (req.headers?.['x-request-id'] as string | undefined) ??
      randomUUID();

    const profile: RequestProfile = {
      requestId,
      method: req.method ?? 'UNKNOWN',
      path: req.originalUrl ?? req.url ?? '',
      startedAt: performance.now(),
      durationMs: 0,
      queries: [],
    };

    const finalize = () => {
      profile.durationMs = performance.now() - profile.startedAt;
      profile.statusCode = res.statusCode;
      const totalQueryMs = profile.queries.reduce((acc, q) => acc + q.durationMs, 0);
      try {
        res.setHeader?.('X-Debug-Timing', buildHeader(profile, totalQueryMs));
      } catch {
        // response already sent — ignore
      }
    };

    return this.store.run(profile, () =>
      next.handle().pipe(
        tap({
          next: () => finalize(),
        }),
        catchError((err) => {
          finalize();
          return throwError(() => err);
        }),
        map((body) => {
          if (!hasDebugFlag(req)) return body;
          if (body === null || body === undefined || typeof body !== 'object' || Array.isArray(body)) return body;
          const totalQueryMs = profile.queries.reduce((acc, q) => acc + q.durationMs, 0);
          return {
            ...(body as Record<string, unknown>),
            _debug: {
              requestId: profile.requestId,
              method: profile.method,
              path: profile.path,
              statusCode: profile.statusCode,
              durationMs: Number(profile.durationMs.toFixed(1)),
              queryCount: profile.queries.length,
              totalQueryMs: Number(totalQueryMs.toFixed(1)),
              queries: profile.queries.map((q) => ({
                sql: q.sql,
                params: q.params,
                durationMs: Number(q.durationMs.toFixed(1)),
              })),
            },
          };
        }),
      ),
    );
  }
}
