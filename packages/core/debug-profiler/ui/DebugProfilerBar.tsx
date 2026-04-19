import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronUp, X, Database, Clock, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { useDebugProfileBatch } from './useDebugProfile';
import type { DebugProfile, DebugQueryEntry } from './types';

function formatMs(n: number): string {
  return n >= 100 ? `${n.toFixed(0)}ms` : `${n.toFixed(1)}ms`;
}

function formatParam(value: unknown): string {
  if (value === null) return 'NULL';
  if (value === undefined) return 'undefined';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return JSON.stringify(value);
  return JSON.stringify(value);
}

function QueryDetail({ query }: { query: DebugQueryEntry }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = query.params.length
      ? `${query.sql}\n-- params: ${query.params.map(formatParam).join(', ')}`
      : query.sql;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard API unavailable (e.g. http context) — nothing to do
    }
  };

  return (
    <div className="bg-muted/40 px-3 py-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide">SQL</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-accent"
          title="Copy SQL + params"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="font-mono whitespace-pre-wrap break-all bg-background border border-border rounded p-2 text-[11px] leading-relaxed">
        {query.sql}
      </pre>
      {query.params.length > 0 && (
        <>
          <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide">Params</div>
          <div className="bg-background border border-border rounded p-2 space-y-0.5 font-mono text-[11px]">
            {query.params.map((p, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-muted-foreground shrink-0">${i + 1}</span>
                <span className="break-all">{formatParam(p)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="text-muted-foreground">
        Duration: <span className="font-mono">{formatMs(query.durationMs)}</span>
      </div>
    </div>
  );
}

function RequestRow({
  profile,
  expanded,
  onToggle,
  queryExpandedIndex,
  onToggleQuery,
}: {
  profile: DebugProfile;
  expanded: boolean;
  onToggle: () => void;
  queryExpandedIndex: number | null;
  onToggleQuery: (i: number) => void;
}) {
  return (
    <>
      <tr
        className="border-t border-border hover:bg-accent/40 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-1 text-muted-foreground align-top pt-1.5">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </td>
        <td className="px-2 py-1 font-mono text-muted-foreground align-top">{profile.method}</td>
        <td className="px-2 py-1 font-mono truncate max-w-[300px] align-top" title={profile.path}>
          {profile.path}
        </td>
        <td className="px-2 py-1 text-right font-mono align-top">{formatMs(profile.durationMs)}</td>
        <td className="px-2 py-1 text-right font-mono align-top">{profile.queryCount}</td>
      </tr>
      {expanded && (
        <tr className="border-t border-border bg-muted/20">
          <td colSpan={5} className="p-0">
            {profile.queries.length === 0 ? (
              <p className="text-muted-foreground p-3 text-[11px]">No queries captured for this request.</p>
            ) : (
              <table className="w-full">
                <tbody>
                  {profile.queries.map((q, i) => {
                    const isExpanded = queryExpandedIndex === i;
                    return (
                      <Fragment key={i}>
                        <tr
                          className="border-t border-border hover:bg-accent/40 cursor-pointer"
                          onClick={() => onToggleQuery(i)}
                        >
                          <td className="w-6 px-1 text-muted-foreground">
                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </td>
                          <td className="px-3 py-1 font-mono truncate max-w-[480px]" title={q.sql}>
                            {q.sql}
                          </td>
                          <td className="px-3 py-1 text-right font-mono w-20">{formatMs(q.durationMs)}</td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-t border-border">
                            <td colSpan={3} className="p-0">
                              <QueryDetail query={q} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function DebugProfilerBar() {
  const { batch, path } = useDebugProfileBatch();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [expandedQuery, setExpandedQuery] = useState<number | null>(null);

  const totals = useMemo(() => {
    const totalMs = batch.reduce((acc, p) => acc + p.durationMs, 0);
    const totalQueries = batch.reduce((acc, p) => acc + p.queryCount, 0);
    const totalQueryMs = batch.reduce((acc, p) => acc + p.totalQueryMs, 0);
    return { totalMs, totalQueries, totalQueryMs };
  }, [batch]);

  useEffect(() => {
    setExpandedRequest(null);
    setExpandedQuery(null);
  }, [path]);

  if (dismissed || batch.length === 0) return null;

  const toggleRequest = (key: string) => {
    setExpandedRequest((curr) => (curr === key ? null : key));
    setExpandedQuery(null);
  };

  const toggleQuery = (i: number) => {
    setExpandedQuery((curr) => (curr === i ? null : i));
  };

  return (
    <div className="fixed bottom-3 right-3 z-[9999] text-xs">
      {open ? (
        <div className="bg-background border border-border rounded-lg shadow-lg w-[720px] max-h-[75vh] flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="font-semibold">Debug profiler</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-accent rounded">
                <ChevronUp className="w-3 h-3" />
              </button>
              <button onClick={() => setDismissed(true)} className="p-1 hover:bg-accent rounded">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="px-3 py-2 border-b border-border space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="uppercase text-[10px] tracking-wide font-semibold">Page</span>
              <span className="font-mono truncate" title={path}>{path || '/'}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="font-mono">{batch.length}</span>
                <span className="text-muted-foreground">{batch.length === 1 ? 'request' : 'requests'}</span>
              </span>
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                <span className="font-mono">{totals.totalQueries}</span>
                <span className="text-muted-foreground">queries ({formatMs(totals.totalQueryMs)})</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span className="font-mono">{formatMs(totals.totalMs)}</span>
                <span className="text-muted-foreground">total</span>
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="w-6 px-1"></th>
                  <th className="text-left px-2 py-1 font-medium text-muted-foreground w-16">Method</th>
                  <th className="text-left px-2 py-1 font-medium text-muted-foreground">Path</th>
                  <th className="text-right px-2 py-1 font-medium text-muted-foreground w-20">ms</th>
                  <th className="text-right px-2 py-1 font-medium text-muted-foreground w-16">queries</th>
                </tr>
              </thead>
              <tbody>
                {batch.map((profile, i) => {
                  const key = profile.requestId ?? `${profile.method}-${profile.path}-${i}`;
                  return (
                    <RequestRow
                      key={key}
                      profile={profile}
                      expanded={expandedRequest === key}
                      onToggle={() => toggleRequest(key)}
                      queryExpandedIndex={expandedRequest === key ? expandedQuery : null}
                      onToggleQuery={toggleQuery}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-3 bg-background border border-border rounded-full shadow px-3 py-1.5 hover:bg-accent"
          title={`${batch.length} request${batch.length === 1 ? '' : 's'} since navigation`}
        >
          <span className="font-mono">{batch.length}</span>
          <span className="text-muted-foreground">{batch.length === 1 ? 'req' : 'reqs'}</span>
          <Database className="w-3 h-3" />
          <span className="font-mono">{totals.totalQueries}</span>
          <Clock className="w-3 h-3" />
          <span className="font-mono">{formatMs(totals.totalMs)}</span>
        </button>
      )}
    </div>
  );
}
