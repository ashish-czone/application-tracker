import type { OrgUnit } from '@packages/org-units-ui';

export function getUnitChildren(units: OrgUnit[], parentId: string): OrgUnit[] {
  return units
    .filter((u) => u.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function hasChildUnits(units: OrgUnit[], parentId: string): boolean {
  return units.some((u) => u.parentId === parentId);
}

export function buildBreadcrumb(units: OrgUnit[], unitId: string): OrgUnit[] {
  const trail: OrgUnit[] = [];
  let current: OrgUnit | undefined = units.find((u) => u.id === unitId);
  while (current) {
    trail.unshift(current);
    current = current.parentId ? units.find((u) => u.id === current!.parentId) : undefined;
  }
  return trail;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Visual weight for a level tag, keyed by its sortOrder within the dynamic
 * level list. Lower sortOrder = higher in the hierarchy = heavier tag.
 * Fine-grained differentiation isn't worth the cognitive cost — three bands is
 * enough for a user to spot hierarchy depth at a glance.
 */
export function levelTagClass(sortOrder: number): string {
  if (sortOrder === 0) return 'bg-authority text-paper';
  if (sortOrder === 1) return 'bg-ink text-paper';
  return 'bg-ink-muted text-paper';
}
