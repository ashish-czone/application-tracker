import { createContext, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

export const PermissionsContext = createContext<string[]>([]);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { permissions } = useAuth();

  return (
    <PermissionsContext.Provider value={permissions}>
      {children}
    </PermissionsContext.Provider>
  );
}
