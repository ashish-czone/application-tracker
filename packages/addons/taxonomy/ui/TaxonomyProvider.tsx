import { createContext, useContext, type ReactNode } from 'react';
import type { TaxonomyApiFn } from './types';

interface TaxonomyContextValue {
  apiFn: TaxonomyApiFn;
}

const TaxonomyContext = createContext<TaxonomyContextValue | null>(null);

interface TaxonomyProviderProps {
  children: ReactNode;
  // The shell types the provider's apiFn as `unknown` (it stacks providers
  // for many addons and can't carry per-addon types). Each addon narrows at
  // its own boundary — taxonomy expects a TaxonomyApiFn.
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
