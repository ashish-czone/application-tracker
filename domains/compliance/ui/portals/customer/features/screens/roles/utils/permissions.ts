import type { PermissionManifest } from '@packages/rbac-ui';

export interface PermissionItem {
  name: string;
  label: string;
}

export interface PermissionModuleGroup {
  module: string;
  permissions: PermissionItem[];
}

export function groupPermissionsByModule(
  manifests: PermissionManifest[],
): PermissionModuleGroup[] {
  const map = new Map<string, PermissionItem[]>();
  for (const m of manifests) {
    const items = map.get(m.module) ?? [];
    items.push({
      name: m.slug,
      label: m.label,
    });
    map.set(m.module, items);
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
