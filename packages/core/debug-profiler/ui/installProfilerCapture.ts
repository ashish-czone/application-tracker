import { emitProfile } from './profilerBus';
import type { DebugProfile, DebugQueryEntry } from './types';

const INSTALLED = Symbol.for('debug-profiler-ui.installed');

interface Installable {
  fetch: typeof fetch;
  [INSTALLED]?: boolean;
}

function parseHeader(header: string | null): { durationMs: number; queryCount: number; totalQueryMs: number } | null {
  if (!header) return null;
  const out: Record<string, number> = {};
  for (const pair of header.split(';')) {
    const [k, v] = pair.split('=');
    if (k && v) out[k.trim()] = Number(v);
  }
  if (out.durationMs == null) return null;
  return {
    durationMs: out.durationMs ?? 0,
    queryCount: out.queryCount ?? 0,
    totalQueryMs: out.totalQueryMs ?? 0,
  };
}

function ensureDebugParam(input: string | URL | Request): string | URL | Request {
  if (typeof input === 'string') {
    return input.includes('debug=1') || input.includes('debug=true')
      ? input
      : input + (input.includes('?') ? '&' : '?') + 'debug=1';
  }
  if (input instanceof URL) {
    input.searchParams.set('debug', '1');
    return input;
  }
  const url = input.url;
  if (url.includes('debug=1') || url.includes('debug=true')) return input;
  return new Request(url + (url.includes('?') ? '&' : '?') + 'debug=1', input);
}

function extractMethodAndPath(input: string | URL | Request, init?: RequestInit): { method: string; path: string } {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const rawUrl = input instanceof URL ? input.toString() : input instanceof Request ? input.url : input;
  let path = rawUrl;
  try {
    const u = new URL(rawUrl, window.location.origin);
    path = u.pathname + u.search;
  } catch {
    // rawUrl might already be a path-only string
  }
  return { method, path };
}

interface BodyDebug {
  requestId?: string;
  durationMs?: number;
  queryCount?: number;
  totalQueryMs?: number;
  queries?: DebugQueryEntry[];
}

async function buildProfile(
  response: Response,
  method: string,
  path: string,
): Promise<DebugProfile | null> {
  const headerSummary = parseHeader(response.headers.get('X-Debug-Timing'));

  let bodyDebug: BodyDebug | null = null;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const clone = response.clone();
      const body = await clone.json();
      if (body && typeof body === 'object' && '_debug' in body) {
        bodyDebug = (body as { _debug: BodyDebug })._debug ?? null;
      }
    } catch {
      // body already consumed or not JSON — fall through to header summary
    }
  }

  if (!headerSummary && !bodyDebug) return null;

  return {
    requestId: bodyDebug?.requestId,
    method,
    path,
    statusCode: response.status,
    durationMs: bodyDebug?.durationMs ?? headerSummary?.durationMs ?? 0,
    queryCount: bodyDebug?.queryCount ?? headerSummary?.queryCount ?? 0,
    totalQueryMs: bodyDebug?.totalQueryMs ?? headerSummary?.totalQueryMs ?? 0,
    queries: bodyDebug?.queries ?? [],
  };
}

/**
 * Monkey-patches window.fetch to (a) append ?debug=1 so the server includes
 * the _debug body block and (b) parse timing/query info out of each response
 * and publish it via profilerBus. Idempotent — a second call is a no-op.
 *
 * Returns the original fetch so callers can uninstall if needed.
 */
export function installProfilerCapture(): typeof fetch {
  const target = window as unknown as Installable;
  if (target[INSTALLED]) return target.fetch;

  const original = target.fetch.bind(window);

  target.fetch = async function profilerFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const patchedInput = ensureDebugParam(input as string | URL | Request);
    const { method, path } = extractMethodAndPath(input as string | URL | Request, init);

    const response = await original(patchedInput as RequestInfo | URL, init);
    void buildProfile(response, method, path).then((profile) => {
      if (profile) emitProfile(profile);
    });
    return response;
  };

  target[INSTALLED] = true;
  return original;
}
