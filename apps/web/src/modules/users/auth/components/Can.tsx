import type { ReactNode } from 'react';
import { useCan } from '../hooks/useCan';

interface CanProps {
  permission: string;
  children: ReactNode;
}

export function Can({ permission, children }: CanProps) {
  const allowed = useCan(permission);

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
