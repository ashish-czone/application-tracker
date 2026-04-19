import { Fragment, useEffect, useState } from 'react';
import { ChevronUp, X, Database, Clock, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { useDebugProfile } from './useDebugProfile';
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

function ProfileRow({ profile }: { profile: DebugProfile }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="font-mono text-muted-foreground">{profile.method}</span>
      <span className="font-mono truncate max-w-[200px]" title={profile.path}>{profile.path}</span>
      <span className="ml-auto flex items-center gap-1"><Clock className="w-3 h-3" />{formatMs(profile.durationMs)}</span>
      <span className="flex items-center gap-1"><Database className="w-3 h-3" />{profile.queryCount}</span>
    </div>
  );
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

export function DebugProfilerBar() {
  const { latest, history } = useDebugProfile();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    setExpandedIndex(null);
  }, [latest?.requestId]);

  if (dismissed || !latest) return null;

  const toggleExpand = (i: number) => {
    setExpandedIndex((curr) => (curr === i ? null : i));
  };

  return (
    <div className="fixed bottom-3 right-3 z-[9999] text-xs">
      {open ? (
        <div className="bg-background border border-border rounded-lg shadow-lg w-[640px] max-h-[70vh] flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="font-semibold">Debug profiler</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-accent rounded"><ChevronUp className="w-3 h-3" /></button>
              <button onClick={() => setDismissed(true)} className="p-1 hover:bg-accent rounded"><X className="w-3 h-3" /></button>
            </div>
          </div>
          <div className="px-3 py-2 border-b border-border">
            <ProfileRow profile={latest} />
          </div>
          <div className="flex-1 overflow-auto">
            {latest.queries.length === 0 ? (
              <p className="text-muted-foreground p-3">No queries captured. Ensure the server is running with DEBUG_PROFILING=true.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="w-6 px-1"></th>
                    <th className="text-left px-3 py-1 font-medium text-muted-foreground">SQL</th>
                    <th className="text-right px-3 py-1 font-medium text-muted-foreground w-20">ms</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.queries.map((q, i) => {
                    const isExpanded = expandedIndex === i;
                    return (
                      <Fragment key={i}>
                        <tr
                          className="border-t border-border hover:bg-accent/40 cursor-pointer"
                          onClick={() => toggleExpand(i)}
                        >
                          <td className="px-1 text-muted-foreground">
                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </td>
                          <td className="px-3 py-1 font-mono truncate max-w-[440px]" title={q.sql}>{q.sql}</td>
                          <td className="px-3 py-1 text-right font-mono">{formatMs(q.durationMs)}</td>
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
          </div>
          {history.length > 1 && (
            <div className="px-3 py-1 border-t border-border text-muted-foreground">
              {history.length} requests in session
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-3 bg-background border border-border rounded-full shadow px-3 py-1.5 hover:bg-accent"
        >
          <Clock className="w-3 h-3" />
          <span className="font-mono">{formatMs(latest.durationMs)}</span>
          <Database className="w-3 h-3" />
          <span className="font-mono">{latest.queryCount}</span>
          <span className="font-mono text-muted-foreground">({formatMs(latest.totalQueryMs)})</span>
        </button>
      )}
    </div>
  );
}
