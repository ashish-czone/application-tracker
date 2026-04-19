import { describe, expect, it, vi } from 'vitest';
import { of, throwError, lastValueFrom, firstValueFrom } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { DebugProfilerInterceptor } from '../debug-profiler.interceptor';
import { ProfilingContextStore } from '../profiling-context';

interface FakeReq {
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, unknown>;
}

interface FakeRes {
  statusCode: number;
  headers: Record<string, string>;
  setHeader: (name: string, value: string) => void;
}

function makeContext(req: Partial<FakeReq> = {}, res: Partial<FakeRes> = {}): { ctx: ExecutionContext; req: FakeReq; res: FakeRes } {
  const fullReq: FakeReq = {
    method: 'GET',
    url: '/tasks',
    headers: {},
    query: {},
    ...req,
  };
  const headers: Record<string, string> = res.headers ?? {};
  const fullRes: FakeRes = {
    statusCode: 200,
    headers,
    setHeader: (name, value) => {
      headers[name] = value;
    },
    ...res,
  };
  const ctx = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => fullReq,
      getResponse: () => fullRes,
    }),
  } as unknown as ExecutionContext;
  return { ctx, req: fullReq, res: fullRes };
}

function makeHandler(body: unknown): CallHandler {
  return { handle: () => of(body) };
}

describe('DebugProfilerInterceptor', () => {
  it('sets X-Debug-Timing header with duration and query counts', async () => {
    const store = new ProfilingContextStore();
    const interceptor = new DebugProfilerInterceptor(store);
    const { ctx, res } = makeContext();

    await lastValueFrom(interceptor.intercept(ctx, makeHandler({ ok: true })));

    const header = res.headers['X-Debug-Timing'];
    expect(header).toBeDefined();
    expect(header).toMatch(/^durationMs=\d+(\.\d+)?;queryCount=0;totalQueryMs=0(\.0)?$/);
  });

  it('includes queries recorded during request in header totals', async () => {
    const store = new ProfilingContextStore();
    const interceptor = new DebugProfilerInterceptor(store);
    const { ctx, res } = makeContext();

    const handler: CallHandler = {
      handle: () => {
        store.recordQuery({ sql: 'SELECT 1', params: [], durationMs: 5, startedAt: 0 });
        store.recordQuery({ sql: 'SELECT 2', params: [], durationMs: 7, startedAt: 0 });
        return of({ ok: true });
      },
    };

    await lastValueFrom(interceptor.intercept(ctx, handler));
    expect(res.headers['X-Debug-Timing']).toMatch(/queryCount=2;totalQueryMs=12(\.0)?/);
  });

  it('does not inject _debug body unless ?debug=1 is set', async () => {
    const store = new ProfilingContextStore();
    const interceptor = new DebugProfilerInterceptor(store);
    const { ctx } = makeContext();

    const out = await lastValueFrom(interceptor.intercept(ctx, makeHandler({ ok: true })));
    expect(out).toEqual({ ok: true });
  });

  it('injects _debug onto JSON-object bodies when ?debug=1', async () => {
    const store = new ProfilingContextStore();
    const interceptor = new DebugProfilerInterceptor(store);
    const { ctx } = makeContext({ query: { debug: '1' } });

    const handler: CallHandler = {
      handle: () => {
        store.recordQuery({ sql: 'SELECT 1', params: [], durationMs: 3, startedAt: 0 });
        return of({ ok: true });
      },
    };

    const out = (await lastValueFrom(interceptor.intercept(ctx, handler))) as { ok: boolean; _debug: { queryCount: number; queries: unknown[] } };
    expect(out.ok).toBe(true);
    expect(out._debug.queryCount).toBe(1);
    expect(out._debug.queries).toHaveLength(1);
  });

  it('does not inject _debug when the body is an array (would break JSON shape)', async () => {
    const store = new ProfilingContextStore();
    const interceptor = new DebugProfilerInterceptor(store);
    const { ctx } = makeContext({ query: { debug: '1' } });

    const out = await lastValueFrom(interceptor.intercept(ctx, makeHandler([1, 2, 3])));
    expect(out).toEqual([1, 2, 3]);
  });

  it('bypasses non-http contexts', async () => {
    const store = new ProfilingContextStore();
    const interceptor = new DebugProfilerInterceptor(store);
    const ctx = { getType: () => 'rpc' } as unknown as ExecutionContext;

    const out = await lastValueFrom(interceptor.intercept(ctx, makeHandler({ ok: true })));
    expect(out).toEqual({ ok: true });
  });

  it('still finalizes header even when the handler throws', async () => {
    const store = new ProfilingContextStore();
    const interceptor = new DebugProfilerInterceptor(store);
    const { ctx, res } = makeContext();

    const err = new Error('nope');
    const handler: CallHandler = { handle: () => throwError(() => err) };

    await expect(firstValueFrom(interceptor.intercept(ctx, handler))).rejects.toBe(err);
    expect(res.headers['X-Debug-Timing']).toBeDefined();
  });

  it('uses x-correlation-id header as requestId when present', async () => {
    const store = new ProfilingContextStore();
    const interceptor = new DebugProfilerInterceptor(store);
    const { ctx } = makeContext({ headers: { 'x-correlation-id': 'abc-123' }, query: { debug: '1' } });

    const out = (await lastValueFrom(interceptor.intercept(ctx, makeHandler({})))) as { _debug: { requestId: string } };
    expect(out._debug.requestId).toBe('abc-123');
  });

  it('makes the profiling context available to query recording during the handler', async () => {
    const store = new ProfilingContextStore();
    const interceptor = new DebugProfilerInterceptor(store);
    const { ctx } = makeContext({ query: { debug: '1' } });

    const seen = vi.fn();
    const handler: CallHandler = {
      handle: () => {
        seen(store.current()?.path);
        return of({});
      },
    };

    await lastValueFrom(interceptor.intercept(ctx, handler));
    expect(seen).toHaveBeenCalledWith('/tasks');
  });
});
