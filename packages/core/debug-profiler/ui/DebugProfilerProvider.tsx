import { useEffect, type ReactNode } from 'react';
import { installProfilerCapture } from './installProfilerCapture';

/**
 * Installs the fetch interceptor on mount so every request captures
 * server timing + query stats. Render once near the app root, typically
 * gated on import.meta.env.DEV.
 */
export function DebugProfilerProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    installProfilerCapture();
  }, []);
  return <>{children}</>;
}
