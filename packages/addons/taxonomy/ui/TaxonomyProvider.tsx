import { createContext, useContext, type ReactNode } from 'react';
import type { TaxonomyApiFn } from './types';

interface TaxonomyContextValue {
  apiFn: TaxonomyApiFn;
}

const TaxonomyContext = createContext<TaxonomyContextValue | null>(null);

interface TaxonomyProviderProps {
  children: ReactNode;
  // Loose at the manifest boundary (WebFeatureProvider hands `unknown`); the
  // shell guarantees a TaxonomyApiFn-shaped fn at runtime.
  apiFn: unknown;
}

export function TaxonomyProvider({ children, apiFn }: TaxonomyProviderProps) {
  return (
    <TaxonomyContext.Provider value={{ apiFn: apiFn as TaxonomyApiFn }}>
      {children}
    </TaxonomyContext.Provider>
  );
}

export function useTaxonomyApi(): TaxonomyApiFn {
  const ctx = useContext(TaxonomyContext);
  if (!ctx) throw new Error('useTaxonomyApi must be used within TaxonomyProvider');
  return ctx.apiFn;
}
