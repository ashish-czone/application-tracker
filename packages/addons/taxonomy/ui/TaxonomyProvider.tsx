import { createContext, useContext, type ReactNode } from 'react';
import type { TaxonomyApiFn } from './types';

interface TaxonomyContextValue {
  apiFn: TaxonomyApiFn;
}

const TaxonomyContext = createContext<TaxonomyContextValue | null>(null);

interface TaxonomyProviderProps {
  children: ReactNode;
  apiFn: TaxonomyApiFn;
}

export function TaxonomyProvider({ children, apiFn }: TaxonomyProviderProps) {
  return (
    <TaxonomyContext.Provider value={{ apiFn }}>
      {children}
    </TaxonomyContext.Provider>
  );
}

export function useTaxonomyApi(): TaxonomyApiFn {
  const ctx = useContext(TaxonomyContext);
  if (!ctx) throw new Error('useTaxonomyApi must be used within TaxonomyProvider');
  return ctx.apiFn;
}
