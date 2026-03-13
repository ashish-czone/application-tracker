import { useContext } from 'react';
import { PermissionsContext } from '../components/PermissionsProvider';

export function useCan(permission: string): boolean {
  const permissions = useContext(PermissionsContext);
  return permissions.includes(permission);
}
