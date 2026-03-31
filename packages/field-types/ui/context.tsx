import { createContext, useContext, type ReactNode } from 'react';
import { fieldTypeUIRegistry } from './ui-registry';
import type { FieldTypeUIDefinition } from './types';

interface FieldTypeUIContextValue {
  get: (type: string) => FieldTypeUIDefinition | undefined;
  getOrThrow: (type: string) => FieldTypeUIDefinition;
}

const FieldTypeUIContext = createContext<FieldTypeUIContextValue | null>(null);

interface FieldTypeProviderProps {
  children: ReactNode;
}

/**
 * Provides field type UI definitions to the component tree.
 * Must be placed above any component that uses useFieldTypeUI().
 */
export function FieldTypeProvider({ children }: FieldTypeProviderProps) {
  const value: FieldTypeUIContextValue = {
    get: (type) => fieldTypeUIRegistry.get(type),
    getOrThrow: (type) => fieldTypeUIRegistry.getOrThrow(type),
  };

  return (
    <FieldTypeUIContext.Provider value={value}>
      {children}
    </FieldTypeUIContext.Provider>
  );
}

/** Get the UI definition for a specific field type. */
export function useFieldTypeUI(type: string): FieldTypeUIDefinition {
  const ctx = useContext(FieldTypeUIContext);
  if (!ctx) throw new Error('useFieldTypeUI must be used within FieldTypeProvider');
  return ctx.getOrThrow(type);
}

/** Get the full field type UI context. */
export function useFieldTypesUI(): FieldTypeUIContextValue {
  const ctx = useContext(FieldTypeUIContext);
  if (!ctx) throw new Error('useFieldTypesUI must be used within FieldTypeProvider');
  return ctx;
}
