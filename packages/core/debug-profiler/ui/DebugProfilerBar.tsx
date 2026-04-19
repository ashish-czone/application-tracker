import { useState } from 'react';
import { ChevronUp, X, Database, Clock } from 'lucide-react';
import { useDebugProfile } from './useDebugProfile';
import type { DebugProfile } from './types';

function formatMs(n: number): string {
  return n >= 100 ? `${n.toFixed(0)}ms` : `${n.toFixed(1)}ms`;
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

export function DebugProfilerBar() {
  const { latest, history } = useDebugProfile();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !latest) return null;

  return (
    <div className="fixed bottom-3 right-3 z-[9999] text-xs">
      {open ? (
        <div className="bg-background border border-border rounded-lg shadow-lg w-[520px] max-h-[60vh] flex flex-col">
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
                    <th className="text-left px-3 py-1 font-medium text-muted-foreground">SQL</th>
                    <th className="text-right px-3 py-1 font-medium text-muted-foreground w-20">ms</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.queries.map((q, i) => (
                    <tr key={i} className="border-t border-border hover:bg-accent/40">
                      <td className="px-3 py-1 font-mono truncate max-w-[400px]" title={q.sql}>{q.sql}</td>
                      <td className="px-3 py-1 text-right font-mono">{formatMs(q.durationMs)}</td>
                    </tr>
                  ))}
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
