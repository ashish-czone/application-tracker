# @packages/debug-profiler

Laravel-Debugbar-style per-request profiler for the NestJS backend. Reports total request duration, every SQL query with its individual timing, and the overall query-time total.

Two subpackages:

- **`@packages/debug-profiler`** (`./api`) — NestJS interceptor + `pg.Pool` instrumentation.
- **`@packages/debug-profiler-ui`** (`./ui`) — React dock that captures results from `window.fetch` and renders them.

---

## What it captures

For each HTTP request (when enabled):

- `durationMs` — wall-clock duration from interceptor entry to response
- `queryCount`, `totalQueryMs`
- `queries[]` — `{ sql, params, durationMs }` per query
- `requestId`, `method`, `path`, `statusCode`

Two output surfaces:

- **Always**: `X-Debug-Timing: durationMs=42.3;queryCount=7;totalQueryMs=18.1` response header.
- **On `?debug=1`**: a `_debug` block appended to the JSON body with the full query list.

## Enabling

### Server

Set `DEBUG_PROFILING=true` in the app's `.env`. `createAppModule` reads it and conditionally registers `DebugProfilerModule.forRoot({ enabled: true })`. When false, the module is empty and the interceptor + pool wrapper are never loaded → zero runtime cost.

### Web

Rendered in `main.tsx` behind `import.meta.env.DEV || VITE_DEBUG_PROFILING=true`:

```tsx
{debugProfiling && (
  <DebugProfilerProvider>
    <DebugProfilerBar />
  </DebugProfilerProvider>
)}
```

`DebugProfilerProvider` monkey-patches `window.fetch` so every request gets `?debug=1` and its response's `_debug` block is parsed. `DebugProfilerBar` is a collapsible pill bottom-right of the viewport.

## Do not enable in production

Query params are logged verbatim — which includes anything the caller passes in. Treat this as a development tool only. Nothing in v1 redacts passwords, tokens, or PII.

## How the pool wrapper works

`wrapPgPool(pool, store)` replaces `pool.query` with a timing wrapper that pushes a `QueryEntry` into the active `ProfilingContextStore` (backed by `AsyncLocalStorage`). When no context is active the wrapper is a pass-through — so the same wrapped pool is safe to use during startup, migrations, background jobs, etc.

The `DebugProfilerPoolBootstrapper` in `@packages/app-shell` wraps the pool once on `onApplicationBootstrap`. Wrapping is idempotent.

## What's not here (v2 candidates)

- Retained request history / comparison
- Cache hit/miss instrumentation
- Domain-event trace
- Redaction of sensitive query parameters
- Sampling (currently: profile every request when enabled)
- OpenTelemetry export
