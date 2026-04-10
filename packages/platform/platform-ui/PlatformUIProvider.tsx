import { createContext, useContext, type ReactNode } from 'react';

export interface ApiFn {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  put: <T>(path: string, body?: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
}

interface PlatformUIContextValue {
  apiFn: ApiFn;
}

const PlatformUIContext = createContext<PlatformUIContextValue | null>(null);

interface PlatformUIProviderProps {
  children: ReactNode;
  apiFn: ApiFn;
}

export function PlatformUIProvider({ children, apiFn }: PlatformUIProviderProps) {
  return (
    <PlatformUIContext.Provider value={{ apiFn }}>
      {children}
    </PlatformUIContext.Provider>
  );
}

export function usePlatformAPI(): ApiFn {
  const ctx = useContext(PlatformUIContext);
  if (!ctx) throw new Error('usePlatformAPI must be used within PlatformUIProvider');
  return ctx.apiFn;
}
