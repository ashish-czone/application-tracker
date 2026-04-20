import type { PermissionRegistryEntry } from '@packages/rbac-ui';

export interface PermissionItem {
  name: string;
  label: string;
}

export interface PermissionModuleGroup {
  module: string;
  permissions: PermissionItem[];
}

export function permissionName(entry: PermissionRegistryEntry): string {
  return `${entry.module}.${entry.action}`;
}

export function groupPermissionsByModule(
  registry: PermissionRegistryEntry[],
): PermissionModuleGroup[] {
  const map = new Map<string, PermissionItem[]>();
  for (const entry of registry) {
    const items = map.get(entry.module) ?? [];
    items.push({
      name: permissionName(entry),
      label: entry.description || entry.action,
    });
    map.set(entry.module, items);
  }
  return Array.from(map.entries()).map(([module, permissions]) => ({
    module,
    permissions,
  }));
}

export function formatMemberName(member: {
  firstName: string;
  lastName: string;
}): string {
  return `${member.firstName} ${member.lastName}`.trim();
}

export function memberInitials(member: {
  firstName: string;
  lastName: string;
}): string {
  const first = member.firstName?.[0] ?? '';
  const last = member.lastName?.[0] ?? '';
  return `${first}${last}`.toUpperCase();
}
