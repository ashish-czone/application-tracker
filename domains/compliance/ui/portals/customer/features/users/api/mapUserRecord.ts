import type { User } from '@packages/users-ui';
import type { UserRow, UserStatus, UserRole, UserPosition } from '../data/usersMock';

const AVATAR_PALETTE = [
  '#1D3461',
  '#3A6F4A',
  '#8B5E3C',
  '#5B4A8A',
  '#C6541D',
];

function hashToIndex(input: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % modulo;
}

export function initialsFromName(firstName: string, lastName: string): string {
  const f = firstName.trim()[0] ?? '';
  const l = lastName.trim()[0] ?? '';
  const initials = `${f}${l}`.toUpperCase();
  return initials || '—';
}

export function colorForUser(id: string): string {
  return AVATAR_PALETTE[hashToIndex(id, AVATAR_PALETTE.length)];
}

function mapRoles(roles: User['roles']): UserRole[] {
  return roles.map((r) => ({ id: r.id, name: r.name }));
}

function mapPositions(positions: User['positions']): UserPosition[] {
  return positions.map((p) => ({
    id: p.unitId,
    unitName: p.unitName,
    title: p.positionName ?? 'Member',
  }));
}

export function mapUserRecordToRow(user: User): UserRow {
  const name = `${user.firstName} ${user.lastName}`.trim();
  return {
    id: user.id,
    name: name || user.email,
    email: user.email,
    phone: user.phone ?? '',
    initials: initialsFromName(user.firstName, user.lastName),
    color: colorForUser(user.id),
    status: user.status as UserStatus,
    roles: mapRoles(user.roles),
    positions: mapPositions(user.positions),
    lastActiveAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}
