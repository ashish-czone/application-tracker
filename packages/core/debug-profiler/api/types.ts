export interface QueryEntry {
  sql: string;
  params: unknown[];
  durationMs: number;
  startedAt: number;
}

export interface RequestProfile {
  requestId: string;
  method: string;
  path: string;
  statusCode?: number;
  startedAt: number;
  durationMs: number;
  queries: QueryEntry[];
}

export interface DebugProfilerOptions {
  enabled: boolean;
}
