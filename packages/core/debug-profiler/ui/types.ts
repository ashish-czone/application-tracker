export interface DebugQueryEntry {
  sql: string;
  params: unknown[];
  durationMs: number;
}

export interface DebugProfile {
  requestId?: string;
  method: string;
  path: string;
  statusCode?: number;
  durationMs: number;
  queryCount: number;
  totalQueryMs: number;
  queries: DebugQueryEntry[];
}
