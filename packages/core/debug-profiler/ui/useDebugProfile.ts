import { useEffect, useState } from 'react';
import { subscribeProfiler } from './profilerBus';
import type { DebugProfile } from './types';

const HISTORY_LIMIT = 50;

export function useDebugProfile(): { latest: DebugProfile | null; history: DebugProfile[] } {
  const [history, setHistory] = useState<DebugProfile[]>([]);

  useEffect(
    () =>
      subscribeProfiler((profile) => {
        setHistory((prev) => [profile, ...prev].slice(0, HISTORY_LIMIT));
      }),
    [],
  );

  return { latest: history[0] ?? null, history };
}
